import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { db } from '../db/index.js';

import { renderLeaflet } from '../render/leaflet.js';

export const customizationsRouter = Router();

/* Preview render — given a template + overrides + optional LA, returns the
 * leaflet HTML. Used by the LA customise flow's live iframe so edits show
 * up instantly without persisting a draft customisation.
 *
 * POST /api/customizations/preview-render
 *   { template_slug, la_slug?, overrides? }
 *   → HTML body */
customizationsRouter.post('/preview-render', async (req, res, next) => {
  try {
    const { template_slug, la_slug, overrides, with_pens } = (req.body ?? {}) as {
      template_slug?: string;
      la_slug?: string;
      overrides?: Record<string, string>;
      with_pens?: boolean;
    };
    if (!template_slug) return res.status(400).type('text/plain').send('template_slug required');

    const template = db
      .prepare(
        `SELECT id, slug, name, audience, body_path, default_palette_json,
                facts_json, version FROM templates WHERE slug = ?`
      )
      .get(template_slug) as
      | {
          id: number; slug: string; name: string; audience: string; body_path: string;
          default_palette_json: string; facts_json: string; version: number;
        }
      | undefined;
    if (!template) return res.status(404).type('text/plain').send('template_not_found');

    let palette: { brand?: string; accent?: string } | undefined;
    let withEntitledtoCredit = false;
    if (la_slug) {
      const la = db
        .prepare('SELECT default_brand_colour, default_accent_colour FROM la_clients WHERE slug = ?')
        .get(la_slug) as
        | { default_brand_colour: string; default_accent_colour: string }
        | undefined;
      if (la) palette = { brand: la.default_brand_colour, accent: la.default_accent_colour };
      withEntitledtoCredit = true;
    }

    // Synthesize a customization-shaped object for the renderer.
    const fakeCustomization = {
      id: 0,
      template_id: template.id,
      template_version_at_publish: template.version,
      school_urn: null,
      la_slug: la_slug ?? null,
      overrides_json: JSON.stringify(overrides ?? {}),
      public_slug: '__preview__',
    };

    const html = await renderLeaflet({
      template,
      customization: fakeCustomization,
      palette,
      withEntitledtoCredit,
      qr: { include: false },
    });

    // When the LA editor asks for pens, inject a small in-page script that
    // adds a pen icon next to every element with a data-edit-key attribute.
    // Clicking a pen postMessages back to the parent window so the React
    // editor can open the relevant modal.
    if (with_pens) {
      const penScript = `
<style>
  [data-edit-key] { position: relative; transition: outline-color 0.1s, background 0.1s; outline: 2px dashed transparent; outline-offset: 2px; }
  [data-edit-key]:hover { outline-color: rgba(40, 88, 229, 0.45); }
  .__editpen {
    position: absolute; top: -10px; right: -10px;
    width: 30px; height: 30px; border-radius: 50%;
    background: #fff; border: 2px solid #2858E5;
    color: #2858E5; font-size: 14px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.18);
    z-index: 50; padding: 0;
  }
  .__editpen:hover { background: #2858E5; color: #fff; transform: scale(1.1); }
  [data-edit-key] > .__editpen { pointer-events: auto; }
</style>
<script>
(function () {
  document.querySelectorAll('[data-edit-key]').forEach(function (el) {
    var key = el.getAttribute('data-edit-key');
    var pen = document.createElement('button');
    pen.type = 'button';
    pen.className = '__editpen';
    pen.title = 'Edit this section';
    pen.setAttribute('aria-label', 'Edit ' + key);
    pen.textContent = '✏️';
    pen.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      try {
        window.parent.postMessage({ type: 'leaflet-edit', key: key }, '*');
      } catch (err) { console.warn(err); }
    });
    el.appendChild(pen);
  });
})();
</script>`;
      const withPensHtml = html.replace('</body>', penScript + '</body>');
      return res.type('html').send(withPensHtml);
    }

    res.type('html').send(html);
  } catch (e) { next(e); }
});

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

/* PATCH endpoint for re-editing a customization. Auth intentionally
 * removed per Phil — no fraud concern, anyone with the edit URL can save
 * changes. The session-check code is left in sessions.ts for when the
 * platform is ready to flip it back on. */
customizationsRouter.patch('/:slug', (req, res) => {
  const slug = req.params.slug;
  const c = db
    .prepare('SELECT id, public_slug FROM customizations WHERE public_slug = ?')
    .get(slug) as { id: number; public_slug: string } | undefined;
  if (!c) return res.status(404).json({ error: 'not_found' });

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
    .prepare(
      `SELECT c.id, c.template_id, c.template_version_at_publish,
              c.school_urn, c.la_slug, c.overrides_json, c.public_slug,
              c.owner_email, c.published_at, c.created_at, c.updated_at,
              t.version AS current_template_version,
              t.changelog AS template_changelog
         FROM customizations c
         JOIN templates t ON t.id = c.template_id
        WHERE c.public_slug = ?`
    )
    .get(req.params.slug) as
    | (Record<string, unknown> & { id: number; template_version_at_publish: number; current_template_version: number })
    | undefined;
  if (!row) return res.status(404).json({ error: 'not_found' });

  // Include any saved translations so the editor can show what's been done.
  const translations = db
    .prepare(
      `SELECT language, overrides_json, updated_at
         FROM customization_translations
        WHERE customization_id = ?`
    )
    .all(row.id) as Array<{ language: string; overrides_json: string; updated_at: string }>;

  const templateDrift = row.current_template_version > row.template_version_at_publish;

  res.json({
    customization: row,
    template_drift: templateDrift,
    translations: translations.map((t) => ({
      language: t.language,
      overrides: JSON.parse(t.overrides_json || '{}'),
      updated_at: t.updated_at,
    })),
  });
});

/* Adopt the latest template version: bumps the customization's
 * template_version_at_publish to the current template version, which clears
 * the "Template updated" banner. Existing overrides are preserved. */
customizationsRouter.post('/:slug/adopt-template-version', (req, res) => {
  const row = db
    .prepare(
      `SELECT c.id, t.version AS current_version
         FROM customizations c JOIN templates t ON t.id = c.template_id
        WHERE c.public_slug = ?`
    )
    .get(req.params.slug) as { id: number; current_version: number } | undefined;
  if (!row) return res.status(404).json({ error: 'not_found' });

  // Auth intentionally removed per Phil — anyone with the edit URL can adopt.

  db.prepare(`
    UPDATE customizations
       SET template_version_at_publish = ?,
           updated_at = datetime('now')
     WHERE id = ?
  `).run(row.current_version, row.id);
  res.json({ ok: true, adopted_version: row.current_version });
});

/* Save (or replace) a translation for a specific language. */
customizationsRouter.put('/:slug/translations/:lang', (req, res) => {
  const slug = req.params.slug;
  const lang = req.params.lang.toLowerCase();
  if (!/^[a-z]{2}(-[a-z]{2})?$/.test(lang)) {
    return res.status(400).json({ error: 'invalid_language_code', hint: 'Expected ISO code like pl, ur, bn, ro, so, ar.' });
  }
  const c = db
    .prepare('SELECT id FROM customizations WHERE public_slug = ?')
    .get(slug) as { id: number } | undefined;
  if (!c) return res.status(404).json({ error: 'not_found' });

  const { overrides } = (req.body ?? {}) as { overrides?: Record<string, string> };
  if (!overrides || typeof overrides !== 'object') {
    return res.status(400).json({ error: 'overrides_required' });
  }

  db.prepare(`
    INSERT INTO customization_translations (customization_id, language, overrides_json, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(customization_id, language) DO UPDATE SET
      overrides_json = excluded.overrides_json,
      updated_at = datetime('now')
  `).run(c.id, lang, JSON.stringify(overrides));

  res.json({ ok: true, language: lang });
});

customizationsRouter.delete('/:slug/translations/:lang', (req, res) => {
  const slug = req.params.slug;
  const lang = req.params.lang.toLowerCase();
  const c = db.prepare('SELECT id FROM customizations WHERE public_slug = ?').get(slug) as { id: number } | undefined;
  if (!c) return res.status(404).json({ error: 'not_found' });
  db.prepare('DELETE FROM customization_translations WHERE customization_id = ? AND language = ?').run(c.id, lang);
  res.json({ ok: true });
});
