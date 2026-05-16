import { Router } from 'express';
import { db } from '../db/index.js';

export const laClientsRouter = Router();

laClientsRouter.get('/', (req, res) => {
  // Public dropdown defaults to England only (per brief v1 scope). Admin UI
  // hits /api/admin/la-clients which doesn't filter.
  const region = typeof req.query.region === 'string' ? req.query.region : 'england';
  const includeAll = region === 'all';

  const rows = includeAll
    ? db.prepare(
        `SELECT slug, name, calculator_subdomain, default_brand_colour,
                default_accent_colour, logo_url, default_source_url,
                enabled_languages, notes, region
           FROM la_clients ORDER BY name`
      ).all() as Array<Record<string, unknown>>
    : db.prepare(
        `SELECT slug, name, calculator_subdomain, default_brand_colour,
                default_accent_colour, logo_url, default_source_url,
                enabled_languages, notes, region
           FROM la_clients WHERE region = ? ORDER BY name`
      ).all(region) as Array<Record<string, unknown>>;

  const clients = rows.map((r) => ({
    ...r,
    enabled_languages: JSON.parse((r.enabled_languages as string) || '["en"]'),
  }));
  res.json({ clients });
});

laClientsRouter.get('/:slug', (req, res) => {
  const row = db
    .prepare(
      `SELECT slug, name, calculator_subdomain, default_brand_colour,
              default_accent_colour, logo_url, default_source_url,
              enabled_languages, notes
         FROM la_clients WHERE slug = ?`
    )
    .get(req.params.slug) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json({
    client: { ...row, enabled_languages: JSON.parse((row.enabled_languages as string) || '["en"]') },
  });
});
