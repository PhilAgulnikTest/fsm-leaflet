/* AI rewrite endpoint.
 *
 *   POST /api/ai/rewrite
 *     { template_slug, section_key, current_text,
 *       mode: 'rewrite' | 'translate',
 *       target_language?: string,
 *       source_url?: string,
 *       source_text?: string,
 *       customization_id?: number }
 *
 *   → { rewrite_id, output, warnings, source_byte_count, source_url_used }
 *
 * Per-LA rate limit defaults to 20 calls per day (configurable). The pipeline
 * is generate → verify → persist; the row in `ai_rewrites` keeps the prompt,
 * output, structured warnings, and token counts for audit + cost tracking. */

import { Router } from 'express';
import { createHash } from 'node:crypto';
import { db } from '../db/index.js';
import { fetchSourceUrl, SsrfError } from '../ai/fetch-source.js';
import { generate, verify, type Contradiction } from '../ai/rewrite.js';

export const aiRouter = Router();

const PER_LA_DAILY_LIMIT = Number(process.env.AI_REWRITE_DAILY_LIMIT ?? 20);
const RETENTION_DAYS = Number(process.env.AI_REWRITE_RETENTION_DAYS ?? 30);

type Body = {
  template_slug?: string;
  section_key?: string;
  current_text?: string;
  mode?: 'rewrite' | 'translate';
  target_language?: string;
  source_url?: string;
  source_text?: string;
  customization_id?: number;
  la_slug?: string;
};

aiRouter.post('/rewrite', async (req, res) => {
  const body = (req.body ?? {}) as Body;
  if (!body.template_slug || !body.section_key || !body.current_text || !body.mode) {
    return res.status(400).json({ error: 'missing_fields', hint: 'template_slug, section_key, current_text, mode required.' });
  }
  if (body.mode === 'translate' && !body.target_language) {
    return res.status(400).json({ error: 'target_language_required_for_translate' });
  }
  if (body.mode === 'rewrite' && !body.source_url && !body.source_text) {
    return res.status(400).json({ error: 'source_url_or_source_text_required_for_rewrite' });
  }

  // Load template + facts.
  const template = db
    .prepare('SELECT slug, facts_json FROM templates WHERE slug = ?')
    .get(body.template_slug) as { slug: string; facts_json: string } | undefined;
  if (!template) return res.status(404).json({ error: 'template_not_found' });
  let facts: Record<string, unknown>;
  try { facts = JSON.parse(template.facts_json || '{}'); }
  catch { facts = {}; }

  // Resolve la_slug from customization if not passed directly. Rate limit
  // applies per-LA — the brief: 20 calls per day, platform-admin override.
  let laSlug = body.la_slug ?? null;
  if (!laSlug && body.customization_id) {
    const c = db
      .prepare('SELECT la_slug FROM customizations WHERE id = ?')
      .get(body.customization_id) as { la_slug: string | null } | undefined;
    laSlug = c?.la_slug ?? null;
  }
  if (laSlug) {
    const usedToday = (db
      .prepare(
        `SELECT COUNT(*) AS n FROM ai_rewrites
           WHERE la_slug = ?
             AND created_at > datetime('now', '-1 day')`
      )
      .get(laSlug) as { n: number }).n;
    if (usedToday >= PER_LA_DAILY_LIMIT) {
      return res.status(429).json({
        error: 'rate_limited',
        used_today: usedToday,
        daily_limit: PER_LA_DAILY_LIMIT,
        hint: 'Contact a platform admin to raise the limit.',
      });
    }
  }

  // For translate: the "source" IS the current English text. Skip the URL fetch.
  // For rewrite: pull from URL (SSRF-safe) or use pasted text directly.
  let sourceText = body.source_text ?? '';
  let sourceUrlUsed: string | null = body.source_url ?? null;
  let sourceByteCount = 0;
  if (body.mode === 'translate') {
    sourceText = body.current_text;
  } else if (body.source_url) {
    try {
      const fetched = await fetchSourceUrl(body.source_url);
      sourceText = fetched.text;
      sourceUrlUsed = fetched.url;
      sourceByteCount = fetched.byte_count;
    } catch (err) {
      if (err instanceof SsrfError) {
        return res.status(400).json({ error: 'source_fetch_blocked', message: err.message });
      }
      return res.status(502).json({ error: 'source_fetch_failed', message: (err as Error).message });
    }
  }

  // Run the two passes. If either fails (network, model error, etc.) we still
  // try to return enough context for the client to surface a useful error.
  let generated;
  try {
    generated = await generate({
      mode: body.mode,
      sectionKey: body.section_key,
      currentText: body.current_text,
      sourceText,
      facts,
      targetLanguage: body.target_language,
    });
  } catch (err) {
    return res.status(502).json({ error: 'generate_failed', message: (err as Error).message });
  }

  let verifyResult: { warnings: Contradiction[]; inputTokens?: number; outputTokens?: number };
  try {
    verifyResult = await verify(generated.output, facts, body.mode);
  } catch (err) {
    // Verify failure shouldn't lose the user's generation. Persist with an
    // explicit warning entry explaining the verify call broke.
    verifyResult = {
      warnings: [
        {
          contradicted_phrase: '(verify pass failed)',
          fact_key: '(unknown)',
          rationale: `Verify call errored: ${(err as Error).message}. Manual review recommended.`,
        },
      ],
    };
  }

  // Persist for audit + cost tracking.
  const purgeAfter = RETENTION_DAYS > 0
    ? new Date(Date.now() + RETENTION_DAYS * 24 * 3600 * 1000).toISOString()
    : null;
  const result = db.prepare(`
    INSERT INTO ai_rewrites
      (customization_id, template_slug, la_slug, section_key, mode, target_language,
       source_url, source_text, source_text_hash, prompt, model, output,
       warnings_json, input_tokens, output_tokens, purge_after)
    VALUES
      (@customization_id, @template_slug, @la_slug, @section_key, @mode, @target_language,
       @source_url, @source_text, @source_text_hash, @prompt, @model, @output,
       @warnings_json, @input_tokens, @output_tokens, @purge_after)
  `).run({
    customization_id: body.customization_id ?? null,
    template_slug: template.slug,
    la_slug: laSlug,
    section_key: body.section_key,
    mode: body.mode,
    target_language: body.target_language ?? null,
    source_url: sourceUrlUsed,
    source_text: sourceText.slice(0, 50_000),  // hard cap on stored source text
    source_text_hash: sourceText ? createHash('sha256').update(sourceText).digest('hex') : null,
    prompt: generated.promptUsed,
    model: process.env.AI_REWRITE_MODEL ?? 'claude-sonnet-4-6',
    output: generated.output,
    warnings_json: JSON.stringify(verifyResult.warnings),
    input_tokens: (generated.inputTokens ?? 0) + (verifyResult.inputTokens ?? 0),
    output_tokens: (generated.outputTokens ?? 0) + (verifyResult.outputTokens ?? 0),
    purge_after: purgeAfter,
  });

  res.json({
    rewrite_id: result.lastInsertRowid,
    output: generated.output,
    warnings: verifyResult.warnings,
    source_url_used: sourceUrlUsed,
    source_byte_count: sourceByteCount,
  });
});

/* POST /api/ai/rewrite/:id/accept — mark a rewrite as accepted. The LA admin
 * can still accept despite warnings; we just record `accepted_with_warnings=1`
 * so the audit trail captures the explicit override decision. */
aiRouter.post('/rewrite/:id/accept', (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare('SELECT warnings_json FROM ai_rewrites WHERE id = ?')
    .get(id) as { warnings_json: string } | undefined;
  if (!row) return res.status(404).json({ error: 'not_found' });
  const hasWarnings = (JSON.parse(row.warnings_json || '[]') as unknown[]).length > 0;
  db.prepare(`
    UPDATE ai_rewrites
       SET accepted = 1, accepted_with_warnings = ?
     WHERE id = ?
  `).run(hasWarnings ? 1 : 0, id);
  res.json({ ok: true });
});
