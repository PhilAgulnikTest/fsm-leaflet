/* Platform-admin routes. All gated by requireSession('platform-admin').
 *
 * Surface area:
 *   GET    /templates                                  — list (incl. drafts)
 *   GET    /templates/:id                              — full template incl. body defaults
 *   PATCH  /templates/:id                              — edit metadata / status / palette / facts
 *   POST   /templates/:id/version-bump                 — bump version with mandatory changelog
 *
 *   GET    /la-clients                                 — list
 *   PUT    /la-clients/:slug                           — create or update (manual entry)
 *   DELETE /la-clients/:slug                           — remove
 *   POST   /la-clients/upload-csv                      — bulk upsert from pasted CSV body
 *
 *   GET    /trust-domain-requests?status=pending       — review queue
 *   POST   /trust-domain-requests/:id/approve          — adds to trust_domain_allowlist + marks reviewed
 *   POST   /trust-domain-requests/:id/reject           — marks reviewed, no allowlist entry
 *   GET    /trust-domain-allowlist                     — current allowlist (audit view)
 *   DELETE /trust-domain-allowlist/:domain             — revoke
 */

import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import { db } from '../db/index.js';
import { requireSession } from '../auth/sessions.js';
import { checkBrandColour } from '../render/contrast.js';

export const adminRouter = Router();

// Gated by the platform-admin session cookie set by POST /api/auth/platform/login.
// Password is the ADMIN_PASSWORD env var on Render (default '3ntitledto').
adminRouter.use(requireSession('platform-admin'));

// --- Templates -----------------------------------------------------------

adminRouter.get('/templates', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, slug, name, description, audience, version, changelog, status,
              created_at, updated_at FROM templates ORDER BY audience, name`
    )
    .all();
  res.json({ templates: rows });
});

adminRouter.get('/templates/:id', (req, res) => {
  const row = db
    .prepare(
      `SELECT id, slug, name, description, audience, body_path,
              default_palette_json, facts_json, version, changelog, status,
              created_at, updated_at FROM templates WHERE id = ?`
    )
    .get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json({
    template: {
      ...row,
      default_palette: JSON.parse((row.default_palette_json as string) || '{}'),
      facts: JSON.parse((row.facts_json as string) || '{}'),
    },
  });
});

type TemplatePatch = {
  name?: string;
  description?: string;
  audience?: 'school' | 'la' | 'housing-association';
  status?: 'draft' | 'published';
  default_palette?: Record<string, unknown>;
  facts?: Record<string, unknown>;
};

adminRouter.patch('/templates/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare('SELECT default_palette_json, facts_json FROM templates WHERE id = ?')
    .get(id) as { default_palette_json: string; facts_json: string } | undefined;
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const patch = (req.body ?? {}) as TemplatePatch;
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const k of ['name', 'description', 'audience', 'status'] as const) {
    if (patch[k] != null) { fields.push(`${k} = ?`); values.push(patch[k]); }
  }
  if (patch.default_palette) {
    const current = JSON.parse(existing.default_palette_json || '{}') as Record<string, unknown>;
    fields.push('default_palette_json = ?');
    values.push(JSON.stringify({ ...current, ...patch.default_palette }));
  }
  if (patch.facts) {
    const current = JSON.parse(existing.facts_json || '{}') as Record<string, unknown>;
    fields.push('facts_json = ?');
    values.push(JSON.stringify({ ...current, ...patch.facts }));
  }

  if (fields.length === 0) return res.json({ ok: true, noop: true });

  fields.push("updated_at = datetime('now')");
  db.prepare(`UPDATE templates SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  res.json({ ok: true });
});

adminRouter.post('/templates/:id/version-bump', (req, res) => {
  const id = Number(req.params.id);
  const { changelog } = (req.body ?? {}) as { changelog?: string };
  if (!changelog || changelog.trim().length < 10) {
    return res
      .status(400)
      .json({ error: 'changelog_required', hint: 'Changelog must describe what changed and why (min 10 chars).' });
  }
  const result = db
    .prepare(
      `UPDATE templates
          SET version = version + 1,
              changelog = changelog || char(10) || '— v' || (version + 1) || ': ' || ?,
              updated_at = datetime('now')
        WHERE id = ?`
    )
    .run(changelog.trim(), id);
  if (result.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// --- LA clients -----------------------------------------------------------

adminRouter.get('/la-clients', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT slug, name, calculator_subdomain, default_brand_colour, default_accent_colour,
              logo_url, default_source_url, enabled_languages, notes, created_at, updated_at
         FROM la_clients ORDER BY name`
    )
    .all() as Array<Record<string, unknown>>;
  res.json({
    clients: rows.map((r) => ({
      ...r,
      enabled_languages: JSON.parse((r.enabled_languages as string) || '["en"]'),
    })),
  });
});

type LaClientInput = {
  name: string;
  calculator_subdomain: string;
  default_brand_colour: string;
  default_accent_colour: string;
  logo_url?: string | null;
  default_source_url?: string | null;
  enabled_languages?: string[];
  notes?: string;
};

function upsertLaClient(slug: string, input: LaClientInput) {
  return db
    .prepare(
      `INSERT INTO la_clients
         (slug, name, calculator_subdomain, default_brand_colour, default_accent_colour,
          logo_url, default_source_url, enabled_languages, notes)
       VALUES
         (@slug, @name, @calculator_subdomain, @default_brand_colour, @default_accent_colour,
          @logo_url, @default_source_url, @enabled_languages, @notes)
       ON CONFLICT(slug) DO UPDATE SET
         name = excluded.name,
         calculator_subdomain = excluded.calculator_subdomain,
         default_brand_colour = excluded.default_brand_colour,
         default_accent_colour = excluded.default_accent_colour,
         logo_url = excluded.logo_url,
         default_source_url = excluded.default_source_url,
         enabled_languages = excluded.enabled_languages,
         notes = excluded.notes,
         updated_at = datetime('now')`
    )
    .run({
      slug,
      name: input.name,
      calculator_subdomain: input.calculator_subdomain,
      default_brand_colour: input.default_brand_colour,
      default_accent_colour: input.default_accent_colour,
      logo_url: input.logo_url ?? null,
      default_source_url: input.default_source_url ?? null,
      enabled_languages: JSON.stringify(input.enabled_languages ?? ['en']),
      notes: input.notes ?? '',
    });
}

adminRouter.put('/la-clients/:slug', (req, res) => {
  const slug = req.params.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const input = (req.body ?? {}) as LaClientInput;
  if (!input.name || !input.calculator_subdomain || !input.default_brand_colour || !input.default_accent_colour) {
    return res.status(400).json({
      error: 'missing_fields',
      hint: 'name, calculator_subdomain, default_brand_colour, default_accent_colour required.',
    });
  }
  const brand = checkBrandColour(input.default_brand_colour);
  const accent = checkBrandColour(input.default_accent_colour);
  if (!brand.ok || !accent.ok) {
    return res.status(400).json({
      error: 'contrast_fail',
      brand,
      accent,
    });
  }
  upsertLaClient(slug, input);
  res.json({ ok: true, slug });
});

adminRouter.delete('/la-clients/:slug', (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const result = db.prepare('DELETE FROM la_clients WHERE slug = ?').run(slug);
  if (result.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

type CsvUploadBody = { csv?: string };

adminRouter.post('/la-clients/upload-csv', (req, res) => {
  const { csv } = (req.body ?? {}) as CsvUploadBody;
  if (!csv) return res.status(400).json({ error: 'csv_required' });

  let rows: Record<string, string>[];
  try {
    rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    return res.status(400).json({ error: 'csv_parse_failed', message: (err as Error).message });
  }

  const errors: Array<{ row: number; slug: string; reason: string; details?: unknown }> = [];
  const upserts: Array<{ slug: string; name: string }> = [];

  const tx = db.transaction(() => {
    rows.forEach((r, idx) => {
      const slug = (r.slug ?? r.la_slug ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (!slug) {
        errors.push({ row: idx + 2, slug: '', reason: 'missing_slug' });
        return;
      }
      const name = r.name ?? r.la_name ?? '';
      const subdomain = r.calculator_subdomain ?? '';
      const brand = r.default_brand_colour ?? r.brand ?? '';
      const accent = r.default_accent_colour ?? r.accent ?? '';
      if (!name || !subdomain || !brand || !accent) {
        errors.push({ row: idx + 2, slug, reason: 'missing_columns' });
        return;
      }
      const brandCheck = checkBrandColour(brand);
      const accentCheck = checkBrandColour(accent);
      if (!brandCheck.ok || !accentCheck.ok) {
        errors.push({ row: idx + 2, slug, reason: 'contrast_fail', details: { brand: brandCheck, accent: accentCheck } });
        return;
      }
      const enabled_languages = (r.enabled_languages ?? r.languages ?? 'en')
        .split(/[|,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      upsertLaClient(slug, {
        name,
        calculator_subdomain: subdomain,
        default_brand_colour: brand,
        default_accent_colour: accent,
        logo_url: r.logo_url || null,
        default_source_url: r.default_source_url || r.source_url || null,
        enabled_languages,
        notes: r.notes ?? '',
      });
      upserts.push({ slug, name });
    });
  });
  tx();

  res.json({ imported: upserts.length, errors });
});

// --- Trust-domain requests -----------------------------------------------

adminRouter.get('/trust-domain-requests', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
  const rows = db
    .prepare(
      `SELECT id, domain, requested_email, requested_for_urn, notes, status,
              reviewed_by, reviewed_at, created_at
         FROM trust_domain_requests
        WHERE status = ?
        ORDER BY created_at DESC`
    )
    .all(status);
  res.json({ requests: rows });
});

adminRouter.post('/trust-domain-requests/:id/approve', (req, res) => {
  const id = Number(req.params.id);
  const reviewer = req.session!.email;

  const request = db
    .prepare('SELECT id, domain FROM trust_domain_requests WHERE id = ? AND status = ?')
    .get(id, 'pending') as { id: number; domain: string } | undefined;
  if (!request) return res.status(404).json({ error: 'not_found_or_already_reviewed' });

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO trust_domain_allowlist (domain, approved_by, notes)
      VALUES (?, ?, ?)
      ON CONFLICT(domain) DO UPDATE SET approved_by = excluded.approved_by, approved_at = datetime('now')
    `).run(request.domain, reviewer, `Approved via request #${id}`);
    db.prepare(`
      UPDATE trust_domain_requests
         SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now')
       WHERE id = ?
    `).run(reviewer, id);
  });
  tx();
  res.json({ ok: true, allowlisted: request.domain });
});

adminRouter.post('/trust-domain-requests/:id/reject', (req, res) => {
  const id = Number(req.params.id);
  const reviewer = req.session!.email;
  const result = db
    .prepare(
      `UPDATE trust_domain_requests
          SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now')
        WHERE id = ? AND status = 'pending'`
    )
    .run(reviewer, id);
  if (result.changes === 0) return res.status(404).json({ error: 'not_found_or_already_reviewed' });
  res.json({ ok: true });
});

adminRouter.get('/trust-domain-allowlist', (_req, res) => {
  const rows = db
    .prepare('SELECT domain, approved_by, approved_at, notes FROM trust_domain_allowlist ORDER BY approved_at DESC')
    .all();
  res.json({ entries: rows });
});

adminRouter.delete('/trust-domain-allowlist/:domain', (req, res) => {
  const result = db
    .prepare('DELETE FROM trust_domain_allowlist WHERE domain = ?')
    .run(req.params.domain.toLowerCase());
  if (result.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// --- AI usage / cost --------------------------------------------------------

adminRouter.get('/ai-usage', (_req, res) => {
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS total_calls,
         SUM(CASE WHEN accepted = 1 THEN 1 ELSE 0 END) AS accepted_calls,
         SUM(CASE WHEN accepted_with_warnings = 1 THEN 1 ELSE 0 END) AS accepted_with_warnings,
         SUM(json_array_length(warnings_json)) AS total_warnings,
         SUM(COALESCE(input_tokens, 0)) AS input_tokens,
         SUM(COALESCE(output_tokens, 0)) AS output_tokens
       FROM ai_rewrites`
    )
    .get();

  const perLa = db
    .prepare(
      `SELECT la_slug,
              COUNT(*) AS calls,
              SUM(COALESCE(input_tokens, 0)) AS input_tokens,
              SUM(COALESCE(output_tokens, 0)) AS output_tokens
         FROM ai_rewrites
        WHERE la_slug IS NOT NULL
        GROUP BY la_slug
        ORDER BY calls DESC`
    )
    .all();

  const last30 = db
    .prepare(
      `SELECT date(created_at) AS day,
              COUNT(*) AS calls,
              SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) AS tokens
         FROM ai_rewrites
        WHERE created_at > datetime('now', '-30 days')
        GROUP BY date(created_at)
        ORDER BY day DESC`
    )
    .all();

  res.json({ totals, per_la: perLa, last_30_days: last30 });
});

// --- Customizations admin view ---------------------------------------------

adminRouter.get('/customizations', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.public_slug, c.school_urn, c.la_slug, c.owner_email,
              c.template_version_at_publish, c.published_at, c.updated_at,
              t.slug AS template_slug, t.name AS template_name,
              t.version AS current_template_version,
              s.name AS school_name,
              la.name AS la_name,
              (SELECT COUNT(*) FROM customization_translations ct WHERE ct.customization_id = c.id) AS translation_count
         FROM customizations c
         JOIN templates t ON t.id = c.template_id
         LEFT JOIN schools s ON s.urn = c.school_urn
         LEFT JOIN la_clients la ON la.slug = c.la_slug
        ORDER BY c.created_at DESC`
    )
    .all() as Array<Record<string, unknown> & { template_version_at_publish: number; current_template_version: number }>;
  const customizations = rows.map((r) => ({
    ...r,
    template_drift: r.current_template_version > r.template_version_at_publish,
  }));
  res.json({ customizations });
});

adminRouter.delete('/customizations/:slug', (req, res) => {
  const result = db.prepare('DELETE FROM customizations WHERE public_slug = ?').run(req.params.slug);
  if (result.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

adminRouter.get('/ai-usage/recent', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, customization_id, la_slug, section_key, mode, target_language,
              substr(output, 1, 200) AS output_preview,
              json_array_length(warnings_json) AS warning_count,
              accepted, accepted_with_warnings,
              input_tokens, output_tokens, created_at
         FROM ai_rewrites
        ORDER BY created_at DESC
        LIMIT 50`
    )
    .all();
  res.json({ recent: rows });
});
