/* CLI: translate the standard leaflet copy for every template into the 10
 * non-English UK languages we ship (Polish, Romanian, Punjabi, Urdu,
 * Portuguese, Spanish, Bengali, Gujarati, Italian, Welsh).
 *
 *   npm run translate:templates -w server
 *
 * Reads each template's default content (default_palette_json.content),
 * sends it to Claude Sonnet for a parent-friendly translation of each
 * editable field, persists the result in template_translations.
 *
 * Idempotent: re-running overwrites the row for that template+language.
 * Pass --force to re-translate even when a row already exists; default
 * skips templates with existing rows for the target languages so re-runs
 * are cheap.
 *
 * Requires ANTHROPIC_API_KEY in the env. Run once locally with a real
 * key, commit the resulting template_translations rows via seed or a
 * dump — the production server doesn't call the API at runtime. */

import Anthropic from '@anthropic-ai/sdk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './index.js';
import { runMigrations } from './migrate.js';
import { config } from '../config.js';

const MODEL = process.env.AI_TRANSLATE_MODEL ?? 'claude-sonnet-4-6';

const LANGUAGES: Array<{ code: string; name: string }> = [
  { code: 'pl', name: 'Polish' },
  { code: 'ro', name: 'Romanian' },
  { code: 'pa', name: 'Punjabi (Gurmukhi script)' },
  { code: 'ur', name: 'Urdu' },
  { code: 'pt', name: 'Portuguese (European)' },
  { code: 'es', name: 'Spanish' },
  { code: 'bn', name: 'Bengali' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'it', name: 'Italian' },
  { code: 'cy', name: 'Welsh' },
];

// Editable fields the leaflet template renders. Other content fields (e.g.
// calculator_url, contact_email) are URLs / proper nouns and don't translate.
const TRANSLATABLE_KEYS = [
  'hero_title',
  'hero_subtitle',
  'hero_date',
  'intro_html',
  'cta_primary_title',
  'cta_primary_body_html',
  'box1_title',
  'box1_body_html',
  'box2_title',
  'box2_body_html',
  'box3_kicker',
  'box3_body_html',
  'how_to_intro',
  'how_to_steps_html',
  'cta_secondary_title',
  'cta_secondary_body_html',
  'label_what_this_means',
  'label_how_to_claim',
  'attribution_html',
];

type TemplateRow = {
  id: number;
  slug: string;
  name: string;
  default_palette_json: string;
};

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  return process.argv.includes(`--${name}`) ? '' : undefined;
}

function buildPrompt(language: string, payload: Record<string, string>): string {
  return `You are translating a UK government-information leaflet about free school meals into ${language}.

CONTEXT
- Audience: parents and carers of school-age children in England.
- Voice: plain language, reading age ~9, parent-friendly, warm but factual.
- Some values contain simple HTML tags (<strong>, <u>, <li>, <p>). Preserve tags exactly.
- Preserve numbers, dates, proper nouns (Universal Credit, the council, NAWRA, entitledto).
- Do NOT translate URLs or HTML entities.
- Keep each translation roughly the same length as the source.

SOURCE (JSON object, each value is a field of the leaflet):
${JSON.stringify(payload, null, 2)}

Output VALID JSON with the SAME keys as the source, each value being the ${language} translation. Output JSON only, no preamble or markdown fence.`;
}

async function translateOne(client: Anthropic, language: string, payload: Record<string, string>): Promise<Record<string, string>> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: buildPrompt(language, payload) }],
  });
  const raw = msg.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(stripped) as Record<string, string>;
}

async function main() {
  runMigrations();

  if (!config.anthropicApiKey) {
    console.error('ANTHROPIC_API_KEY not set. Put it in .env then re-run.');
    process.exit(1);
  }
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const force = arg('force') !== undefined;
  const onlySlug = arg('template');
  const onlyLang = arg('lang');

  const templates = (
    onlySlug
      ? db.prepare('SELECT id, slug, name, default_palette_json FROM templates WHERE slug = ?').all(onlySlug)
      : db.prepare('SELECT id, slug, name, default_palette_json FROM templates').all()
  ) as TemplateRow[];
  if (templates.length === 0) {
    console.error(onlySlug ? `Template ${onlySlug} not found.` : 'No templates.');
    process.exit(1);
  }

  const upsert = db.prepare(`
    INSERT INTO template_translations (template_id, language, content_json, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(template_id, language) DO UPDATE SET
      content_json = excluded.content_json,
      updated_at = datetime('now')
  `);
  const has = db.prepare('SELECT 1 FROM template_translations WHERE template_id = ? AND language = ?');

  const targetLangs = onlyLang ? LANGUAGES.filter((l) => l.code === onlyLang) : LANGUAGES;
  if (targetLangs.length === 0) {
    console.error(`Language code ${onlyLang} not in our shortlist.`);
    process.exit(1);
  }

  for (const t of templates) {
    const defaults = JSON.parse(t.default_palette_json || '{}') as {
      content?: Record<string, string>;
    };
    const content = defaults.content ?? {};
    const payload: Record<string, string> = {};
    for (const k of TRANSLATABLE_KEYS) {
      if (content[k]) payload[k] = content[k];
    }
    if (Object.keys(payload).length === 0) {
      console.log(`Template ${t.slug}: no translatable content, skipping.`);
      continue;
    }

    for (const lang of targetLangs) {
      if (!force && has.get(t.id, lang.code)) {
        console.log(`Template ${t.slug} → ${lang.code} (${lang.name}): already done, skipping.`);
        continue;
      }
      console.log(`Template ${t.slug} → ${lang.code} (${lang.name}): translating...`);
      try {
        const result = await translateOne(client, lang.name, payload);
        upsert.run(t.id, lang.code, JSON.stringify(result));
        console.log(`  saved ${Object.keys(result).length} keys.`);
      } catch (err) {
        console.error(`  failed: ${(err as Error).message}`);
      }
    }
  }

  console.log('\nDone.');
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry && (entry === thisFile || entry.endsWith('translate-templates.ts') || entry.endsWith('translate-templates.js'))) {
  main().catch((err) => {
    console.error('translate-templates failed:', err);
    process.exit(1);
  });
}
