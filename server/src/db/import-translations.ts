/* Import per-language JSON translation files into the template_translations
 * table. Files live at server/data/translations/{lang}.json — one per
 * language, format documented in the scaffold script.
 *
 *   npm run translate:import -w server
 *
 * Also exposed as importTranslations() so the auto-seed in index.ts can run
 * it on boot. Idempotent: re-runs upsert by (template_id, language). Values
 * still carrying the "__TODO__ " prefix are skipped — that's the signal from
 * the translator that they haven't done that string yet. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './index.js';
import { runMigrations } from './migrate.js';
import { config } from '../config.js';

const TODO_PREFIX = '__TODO__ ';

type FileShape = {
  _language?: string;
  _instructions?: string;
  // Per-template sections — key is the template slug, value is a map of
  // field key → translated string.
  [templateSlug: string]: undefined | string | Record<string, string>;
};

export function importTranslations(): { imported: number; skipped: number; pending: number } {
  const dir = path.resolve(config.paths.serverRoot, 'data', 'translations');
  if (!fs.existsSync(dir)) return { imported: 0, skipped: 0, pending: 0 };

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && /^[a-z]{2,3}\.json$/.test(f));

  let imported = 0;
  let skipped = 0;
  let pending = 0;

  const findTemplate = db.prepare('SELECT id FROM templates WHERE slug = ?');
  const upsert = db.prepare(`
    INSERT INTO template_translations (template_id, language, content_json, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(template_id, language) DO UPDATE SET
      content_json = excluded.content_json,
      updated_at = datetime('now')
  `);

  for (const file of files) {
    const lang = file.replace(/\.json$/, '');
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    let parsed: FileShape;
    try {
      parsed = JSON.parse(raw) as FileShape;
    } catch (err) {
      console.error(`Bad JSON in ${file}: ${(err as Error).message}`);
      skipped++;
      continue;
    }

    // Iterate per-template sections.
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('_')) continue; // metadata key
      if (typeof value !== 'object' || value === null) continue;

      const templateSlug = key;
      const row = findTemplate.get(templateSlug) as { id: number } | undefined;
      if (!row) {
        console.warn(`${file}: template "${templateSlug}" not found, skipping`);
        skipped++;
        continue;
      }

      // Drop any field still carrying the TODO marker. Only commit fields
      // that have been translated.
      const translated: Record<string, string> = {};
      let pendingThis = 0;
      for (const [k, v] of Object.entries(value as Record<string, string>)) {
        if (typeof v !== 'string') continue;
        if (v.startsWith(TODO_PREFIX) || v.trim() === '') {
          pendingThis++;
          continue;
        }
        translated[k] = v;
      }
      pending += pendingThis;

      if (Object.keys(translated).length === 0) {
        // Don't insert an empty row — the renderer treats "no translation"
        // and "empty translation" differently (no row → no switcher entry).
        continue;
      }

      upsert.run(row.id, lang, JSON.stringify(translated));
      imported++;
    }
  }

  return { imported, skipped, pending };
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry && (entry === thisFile || entry.endsWith('import-translations.ts') || entry.endsWith('import-translations.js'))) {
  runMigrations();
  const result = importTranslations();
  console.log(
    `Translations imported: ${result.imported} template-language combos. ` +
      `${result.pending} fields still on __TODO__. ${result.skipped} bad files.`
  );
}
