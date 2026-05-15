import { Router } from 'express';
import { db } from '../db/index.js';

export const laClientsRouter = Router();

laClientsRouter.get('/', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT slug, name, calculator_subdomain, default_brand_colour,
              default_accent_colour, logo_url, default_source_url,
              enabled_languages, notes
         FROM la_clients ORDER BY name`
    )
    .all() as Array<Record<string, unknown>>;
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
