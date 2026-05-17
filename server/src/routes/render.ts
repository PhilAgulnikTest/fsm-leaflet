/* Public render routes.
 *   GET /c/:slug          -> HTML render of a saved customization
 *   GET /c/:slug/preview  -> same, but with the QR block always shown (admin view)
 *   GET /generic/:templateSlug -> the unmodified template, used by the "generic PDF" download
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { renderLeaflet } from '../render/leaflet.js';
import { urlToPdf } from '../render/pdf.js';

export const renderRouter = Router();

type TemplateRow = {
  id: number;
  slug: string;
  name: string;
  audience: string;
  body_path: string;
  default_palette_json: string;
  facts_json: string;
  version: number;
};

type CustomizationRow = {
  id: number;
  template_id: number;
  template_version_at_publish: number;
  school_urn: string | null;
  la_slug: string | null;
  overrides_json: string;
  public_slug: string;
};

function loadTemplate(id: number): TemplateRow | undefined {
  return db
    .prepare(
      `SELECT id, slug, name, audience, body_path, default_palette_json,
              facts_json, version FROM templates WHERE id = ?`
    )
    .get(id) as TemplateRow | undefined;
}

function loadTemplateBySlug(slug: string): TemplateRow | undefined {
  return db
    .prepare(
      `SELECT id, slug, name, audience, body_path, default_palette_json,
              facts_json, version FROM templates WHERE slug = ?`
    )
    .get(slug) as TemplateRow | undefined;
}

renderRouter.get('/c/:slug', async (req, res, next) => {
  try {
    // Express's :slug greedy-matches the literal '.pdf' suffix, so registering
    // a separate '/c/:slug.pdf' route after this one never gets hit. Detect
    // the suffix here and branch to PDF generation.
    const rawSlug = req.params.slug;
    const wantsPdf = rawSlug.endsWith('.pdf');
    const slug = wantsPdf ? rawSlug.slice(0, -4) : rawSlug;

    const customization = db
      .prepare(
        `SELECT id, template_id, template_version_at_publish, school_urn, la_slug,
                overrides_json, public_slug FROM customizations WHERE public_slug = ?`
      )
      .get(slug) as CustomizationRow | undefined;
    if (!customization) return res.status(404).type('text/plain').send('Customization not found.');

    if (wantsPdf) {
      try {
        const internalUrl = `http://localhost:${config.port}/c/${customization.public_slug}?embed=1`;
        const pdf = await urlToPdf(internalUrl);
        return res
          .type('application/pdf')
          .set('Content-Disposition', `attachment; filename="${customization.public_slug}.pdf"`)
          .send(pdf);
      } catch (err) {
        return res
          .status(503)
          .type('text/plain')
          .send(`PDF generation unavailable: ${(err as Error).message}`);
      }
    }

    const template = loadTemplate(customization.template_id);
    if (!template) return res.status(500).type('text/plain').send('Template missing.');

    // LA-bespoke renders pull the LA palette so the hero/CTA blocks pick up
    // brand and accent colours.
    let palette: { brand?: string; accent?: string } | undefined;
    let withEntitledtoCredit = false;
    if (customization.la_slug) {
      const la = db
        .prepare('SELECT default_brand_colour, default_accent_colour FROM la_clients WHERE slug = ?')
        .get(customization.la_slug) as
        | { default_brand_colour: string; default_accent_colour: string }
        | undefined;
      if (la) palette = { brand: la.default_brand_colour, accent: la.default_accent_colour };
      withEntitledtoCredit = true;
    }

    // Language overlay. If ?lang=xx is set AND a customization_translations row
    // exists for that language, merge its overrides on top of the English
    // overrides. Translation rows are partial — sections without a translation
    // fall back to the English value.
    const requestedLang = typeof req.query.lang === 'string' ? req.query.lang.toLowerCase() : 'en';
    let mergedCustomization = customization;
    if (requestedLang !== 'en') {
      const tr = db
        .prepare('SELECT overrides_json FROM customization_translations WHERE customization_id = ? AND language = ?')
        .get(customization.id, requestedLang) as { overrides_json: string } | undefined;
      if (tr) {
        const englishOverrides = JSON.parse(customization.overrides_json || '{}') as Record<string, string>;
        const translatedOverrides = JSON.parse(tr.overrides_json || '{}') as Record<string, string>;
        mergedCustomization = {
          ...customization,
          overrides_json: JSON.stringify({ ...englishOverrides, ...translatedOverrides }),
        };
      }
    }

    // List of languages the customization has translations for — drives the
    // language switcher rendered above the leaflet.
    const availableLanguages = db
      .prepare('SELECT language FROM customization_translations WHERE customization_id = ? ORDER BY language')
      .all(customization.id) as Array<{ language: string }>;

    const leafletHtml = await renderLeaflet({
      template,
      customization: mergedCustomization,
      palette,
      withEntitledtoCredit,
      language: requestedLang,
      qrTarget: `${config.publicBaseUrl}/c/${customization.public_slug}`,
      qr: { include: req.query.preview === '1', printable: false },
    });

    // If there are no translations, return the bare leaflet (preserves the
    // current behaviour and the print-PDF path). Otherwise prepend a switcher.
    if (availableLanguages.length === 0 || req.query.embed === '1') {
      return res.type('html').send(leafletHtml);
    }
    res.type('html').send(renderLeafletWithSwitcher(leafletHtml, customization.public_slug, requestedLang, availableLanguages.map((l) => l.language)));
  } catch (e) { next(e); }
});

const LANGUAGE_LABELS: Record<string, { native: string; english: string; dir?: 'rtl' }> = {
  en: { native: 'English', english: 'English' },
  pl: { native: 'Polski', english: 'Polish' },
  ur: { native: 'اردو', english: 'Urdu', dir: 'rtl' },
  bn: { native: 'বাংলা', english: 'Bengali' },
  ro: { native: 'Română', english: 'Romanian' },
  so: { native: 'Soomaali', english: 'Somali' },
  ar: { native: 'العربية', english: 'Arabic', dir: 'rtl' },
};

function renderLeafletWithSwitcher(leafletHtml: string, slug: string, current: string, available: string[]): string {
  const all = ['en', ...available.filter((l) => l !== 'en')];
  const switcher = all
    .map((code) => {
      const label = LANGUAGE_LABELS[code] ?? { native: code, english: code };
      const active = code === current;
      const href = code === 'en' ? `/c/${slug}` : `/c/${slug}?lang=${code}`;
      return `<a href="${href}" lang="${code}"${label.dir ? ` dir="${label.dir}"` : ''} class="lang-switch__btn${active ? ' lang-switch__btn--active' : ''}">${label.native}</a>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="${current}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Free school meals leaflet</title>
  <style>
    body { margin: 0; font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; background: #E5E7EB; }
    .lang-switch {
      background: #1B2A6B; color: #fff;
      padding: 0.6rem 1rem;
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem;
      justify-content: center;
      font-size: 0.9rem;
    }
    .lang-switch__label { opacity: 0.7; margin-right: 0.4rem; }
    .lang-switch__btn {
      color: #fff; text-decoration: none;
      padding: 0.3rem 0.7rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      transition: background 0.1s;
    }
    .lang-switch__btn:hover { background: rgba(255, 255, 255, 0.18); }
    .lang-switch__btn--active { background: #E64A3C; }
    .leaflet-frame {
      display: block;
      width: 210mm;
      max-width: 100%;
      margin: 1rem auto;
      background: #fff;
      border: none;
      box-shadow: 0 10px 40px rgba(15, 23, 42, 0.12);
    }
    @media print {
      .lang-switch { display: none; }
      .leaflet-frame { box-shadow: none; margin: 0; }
    }
  </style>
</head>
<body>
  <nav class="lang-switch" aria-label="Choose language">
    <span class="lang-switch__label">Read in:</span>
    ${switcher}
  </nav>
  <iframe class="leaflet-frame" src="/c/${slug}?${current === 'en' ? '' : `lang=${current}&`}embed=1" style="height: 297mm;" title="Leaflet"></iframe>
</body>
</html>`;
}

/* "Viewer" page: leaflet rendered in an iframe with a prominent download bar
 * at the top. The Landing page's leaflet preview image opens this in a new
 * tab, so visitors get the rendered leaflet + a one-click PDF download
 * without going through the customise flow. */
renderRouter.get('/view/:templateSlug', (req, res, next) => {
  try {
    const template = loadTemplateBySlug(req.params.templateSlug);
    if (!template) return res.status(404).type('text/plain').send('Template not found.');

    const escape = (s: string) => s.replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>
    )[c]!);

    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Download — ${escape(template.name)}</title>
  <style>
    :root {
      --brand: #1B2A6B;
      --accent: #E64A3C;
      --bright: #2858E5;
      --ink: #0F172A;
      --ink-muted: #475569;
      --paper: #f5f7fb;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--paper); font-family: 'Inter','Segoe UI',system-ui,sans-serif; color: var(--ink); }

    .viewer-bar {
      position: sticky; top: 0; z-index: 10;
      background: linear-gradient(180deg, var(--brand-dark, #14215A) 0%, var(--brand) 100%);
      color: #fff;
      padding: 0.75rem 1.5rem;
      display: flex; align-items: center; gap: 1rem;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);
      flex-wrap: wrap;
    }
    .viewer-bar__brand { display: block; line-height: 0; }
    .viewer-bar__logo { height: 40px; display: block; background: #fff; padding: 4px 10px; border-radius: 6px; }
    .viewer-bar__title { font-weight: 600; font-size: 1rem; flex: 1; }
    .viewer-bar__title small { opacity: 0.75; font-weight: 400; }
    .viewer-bar__actions { display: flex; gap: 0.5rem; align-items: center; }
    .btn-download {
      background: var(--accent);
      color: #fff;
      font-weight: 700;
      font-size: 1rem;
      padding: 0.7rem 1.4rem;
      border-radius: 0.5rem;
      text-decoration: none;
      display: inline-flex; align-items: center; gap: 0.5rem;
      box-shadow: 0 2px 6px rgba(230, 74, 60, 0.4);
      transition: transform 0.1s, box-shadow 0.1s;
    }
    .btn-download:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(230, 74, 60, 0.5); }
    .btn-download svg { width: 18px; height: 18px; }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      text-decoration: none;
      padding: 0.7rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.9rem;
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.22); }

    .viewer-frame-wrap {
      max-width: 230mm;
      margin: 1.5rem auto;
      padding: 0 1rem;
    }
    .viewer-frame {
      width: 100%;
      height: calc(100vh - 8rem);
      min-height: 600px;
      border: 1px solid #E2E8F0;
      border-radius: 0.5rem;
      background: #fff;
      box-shadow: 0 10px 40px rgba(15, 23, 42, 0.1);
    }
    @media (max-width: 600px) {
      .viewer-bar { padding: 0.75rem 1rem; }
      .viewer-bar__title small { display: none; }
      .btn-download { padding: 0.6rem 1rem; font-size: 0.9rem; }
    }
  </style>
</head>
<body>
  <header class="viewer-bar">
    <a href="/" class="viewer-bar__brand" aria-label="entitledto — home">
      <img src="/entitledto-logo.svg" alt="entitledto" class="viewer-bar__logo">
    </a>
    <div class="viewer-bar__title">
      ${escape(template.name)}
      <small>· Free school meals leaflet · A4 print-ready</small>
    </div>
    <div class="viewer-bar__actions">
      <a href="/" class="btn-secondary">← Back</a>
      <a href="/generic/${escape(template.slug)}?format=pdf" class="btn-download" download>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download PDF
      </a>
    </div>
  </header>

  <div class="viewer-frame-wrap">
    <iframe class="viewer-frame" src="/generic/${escape(template.slug)}" title="${escape(template.name)} preview"></iframe>
  </div>
</body>
</html>`);
  } catch (e) { next(e); }
});

/** Renders an unmodified template (no customization). Used both as a preview
 *  and as the source for the generic-PDF download from the landing page.
 *  ?format=pdf returns the PDF (requires Playwright; see render/pdf.ts). */
renderRouter.get('/generic/:templateSlug', async (req, res, next) => {
  try {
    const template = loadTemplateBySlug(req.params.templateSlug);
    if (!template) return res.status(404).type('text/plain').send('Template not found.');
    const html = await renderLeaflet({
      template,
      qrTarget: config.publicBaseUrl,
      qr: { include: req.query.preview === '1', printable: false },
    });
    if (req.query.format === 'pdf') {
      try {
        // Hit our own server with Playwright so CSS / images resolve. Internal
        // localhost URL avoids public-domain round-trips and SSL gotchas.
        const internalUrl = `http://localhost:${config.port}/generic/${template.slug}`;
        const pdf = await urlToPdf(internalUrl);
        // attachment (not inline) so the browser actually downloads instead of
        // opening the PDF in-tab. The Landing page leaflet preview link uses
        // download too, but the server-side header is the more reliable signal.
        res
          .type('application/pdf')
          .set('Content-Disposition', `attachment; filename="fsm-leaflet-${template.slug}.pdf"`)
          .send(pdf);
      } catch (err) {
        res
          .status(503)
          .type('text/plain')
          .send(`PDF generation unavailable: ${(err as Error).message}`);
      }
      return;
    }
    res.type('html').send(html);
  } catch (e) { next(e); }
});

// (PDF route for customizations is handled inline in /c/:slug above by
// branching on the '.pdf' suffix — Express's greedy :slug match would
// otherwise consume the suffix before a separate '/c/:slug.pdf' route
// could catch it.)
