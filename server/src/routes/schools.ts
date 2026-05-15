import { Router } from 'express';
import { db } from '../db/index.js';

export const schoolsRouter = Router();

/**
 * Search by name or postcode prefix. Returns up to 20 matches.
 * The school customize flow uses this to drive the type-ahead.
 */
schoolsRouter.get('/search', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) return res.json({ results: [] });

  // Postcode-shaped queries (letters+digits, optional space) hit the postcode index;
  // everything else does a LIKE on name. SQLite's LIKE is case-insensitive for ASCII,
  // and the schools.name index uses NOCASE collation, so this is cheap.
  const isPostcodeish = /^[A-Z]{1,2}[0-9][0-9A-Z]?(\s?[0-9])?$/i.test(q);

  const rows = isPostcodeish
    ? db
        .prepare(
          `SELECT urn, name, postcode, town, la, phone, website, email
             FROM schools
            WHERE status = 'Open' AND postcode LIKE ?
            ORDER BY name LIMIT 20`
        )
        .all(q.toUpperCase() + '%')
    : db
        .prepare(
          `SELECT urn, name, postcode, town, la, phone, website, email
             FROM schools
            WHERE status = 'Open' AND name LIKE ? COLLATE NOCASE
            ORDER BY name LIMIT 20`
        )
        .all('%' + q + '%');

  res.json({ results: rows });
});

schoolsRouter.get('/:urn', (req, res) => {
  const row = db
    .prepare(
      `SELECT urn, name, postcode, street, town, phone, website, email, phase, la, status, last_refreshed_at
         FROM schools WHERE urn = ?`
    )
    .get(req.params.urn);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json({ school: row });
});
