import { Router } from 'express';
import { db } from '../db/index.js';

export const templatesRouter = Router();

templatesRouter.get('/', (req, res) => {
  const audience = typeof req.query.audience === 'string' ? req.query.audience : null;
  const rows = audience
    ? db
        .prepare(
          `SELECT id, slug, name, description, audience, version, status
             FROM templates WHERE status = 'published' AND audience = ? ORDER BY name`
        )
        .all(audience)
    : db
        .prepare(
          `SELECT id, slug, name, description, audience, version, status
             FROM templates WHERE status = 'published' ORDER BY audience, name`
        )
        .all();
  res.json({ templates: rows });
});
