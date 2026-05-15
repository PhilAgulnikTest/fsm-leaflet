import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { db } from '../db/index.js';

export const customizationsRouter = Router();

type Body = {
  template_slug: string;
  school_urn?: string | null;
  la_slug?: string | null;
  overrides?: Record<string, string>;
  owner_email?: string;
};

function shortToken(len = 4): string {
  // base36 from random bytes — short, URL-safe, low collision risk at this scale.
  return randomBytes(8).toString('base64url').replace(/[^a-z0-9]/gi, '').slice(0, len).toLowerCase();
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

customizationsRouter.post('/', (req, res) => {
  const { template_slug, school_urn, la_slug, overrides, owner_email } = (req.body ?? {}) as Body;
  if (!template_slug) return res.status(400).json({ error: 'template_slug required' });
  if (!school_urn && !la_slug) {
    return res.status(400).json({ error: 'either school_urn or la_slug required' });
  }

  const template = db
    .prepare('SELECT id, slug, audience, version FROM templates WHERE slug = ?')
    .get(template_slug) as { id: number; slug: string; audience: string; version: number } | undefined;
  if (!template) return res.status(404).json({ error: 'template_not_found' });

  // Cross-check audience/identifier alignment.
  if (school_urn && template.audience !== 'school') {
    return res.status(400).json({ error: 'template_audience_mismatch' });
  }
  if (la_slug && template.audience !== 'la') {
    return res.status(400).json({ error: 'template_audience_mismatch' });
  }

  // Resolve a human-readable base for the slug.
  let base = 'leaflet';
  if (school_urn) {
    const s = db.prepare('SELECT name, urn FROM schools WHERE urn = ?').get(school_urn) as
      | { name: string; urn: string }
      | undefined;
    if (!s) return res.status(404).json({ error: 'school_not_found' });
    base = slugify(s.name);
  } else if (la_slug) {
    const la = db.prepare('SELECT slug, name FROM la_clients WHERE slug = ?').get(la_slug) as
      | { slug: string; name: string }
      | undefined;
    if (!la) return res.status(404).json({ error: 'la_not_found' });
    base = la.slug;
  }
  const public_slug = `${base}-${shortToken()}`;

  const insert = db.prepare(`
    INSERT INTO customizations
      (template_id, template_version_at_publish, school_urn, la_slug, overrides_json,
       public_slug, owner_email, published_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  const info = insert.run(
    template.id,
    template.version,
    school_urn ?? null,
    la_slug ?? null,
    JSON.stringify(overrides ?? {}),
    public_slug,
    owner_email ?? null
  );

  res.status(201).json({
    id: info.lastInsertRowid,
    public_slug,
    public_url: `/c/${public_slug}`,
    // The "edit URL" is a magic-link-issuing route — possessing it does not
    // grant edit access, it just triggers a magic link to the verified email.
    edit_url: `/edit/${public_slug}`,
  });
});

/* PATCH endpoint for re-editing a customization after the owner has come
 * back via the edit URL + magic-link verify. Requires a session scoped to
 * the same customization. */
customizationsRouter.patch('/:slug', (req, res) => {
  const slug = req.params.slug;
  const c = db
    .prepare('SELECT id, public_slug FROM customizations WHERE public_slug = ?')
    .get(slug) as { id: number; public_slug: string } | undefined;
  if (!c) return res.status(404).json({ error: 'not_found' });

  if (!req.session || req.session.customization_id !== c.id) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { overrides } = (req.body ?? {}) as { overrides?: Record<string, string> };
  if (!overrides) return res.status(400).json({ error: 'overrides_required' });

  db.prepare(`
    UPDATE customizations
       SET overrides_json = ?,
           updated_at = datetime('now')
     WHERE id = ?
  `).run(JSON.stringify(overrides), c.id);

  res.json({ ok: true, public_slug: c.public_slug, public_url: `/c/${c.public_slug}` });
});

customizationsRouter.get('/:slug', (req, res) => {
  const row = db
    .prepare('SELECT * FROM customizations WHERE public_slug = ?')
    .get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json({ customization: row });
});
