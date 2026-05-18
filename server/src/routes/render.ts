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

    // Language overlay. Precedence (highest wins):
    //   1. customization_translations[lang]  — bespoke translated text
    //   2. customization.overrides            — bespoke English text
    //   3. template_translations[lang]        — translated standard text
    //   4. template defaults                  — English standard text
    const requestedLang = typeof req.query.lang === 'string' ? req.query.lang.toLowerCase() : 'en';
    let mergedCustomization = customization;
    if (requestedLang !== 'en') {
      const tpl = db
        .prepare('SELECT content_json FROM template_translations WHERE template_id = ? AND language = ?')
        .get(customization.template_id, requestedLang) as { content_json: string } | undefined;
      const cust = db
        .prepare('SELECT overrides_json FROM customization_translations WHERE customization_id = ? AND language = ?')
        .get(customization.id, requestedLang) as { overrides_json: string } | undefined;
      if (tpl || cust) {
        const englishOverrides = JSON.parse(customization.overrides_json || '{}') as Record<string, string>;
        const templateTr = tpl ? (JSON.parse(tpl.content_json || '{}') as Record<string, string>) : {};
        const customTr = cust ? (JSON.parse(cust.overrides_json || '{}') as Record<string, string>) : {};
        // template translation goes UNDER the English overrides — those
        // bespoke values are LA-specific and we don't translate them
        // automatically — then customization translation goes on top.
        mergedCustomization = {
          ...customization,
          overrides_json: JSON.stringify({ ...templateTr, ...englishOverrides, ...customTr }),
        };
      }
    }

    // Union of available languages: template-level + customization-level.
    const templateLangs = db
      .prepare('SELECT language FROM template_translations WHERE template_id = ? ORDER BY language')
      .all(customization.template_id) as Array<{ language: string }>;
    const customLangs = db
      .prepare('SELECT language FROM customization_translations WHERE customization_id = ? ORDER BY language')
      .all(customization.id) as Array<{ language: string }>;
    const availableLanguages = [...new Set([
      ...templateLangs.map((l) => l.language),
      ...customLangs.map((l) => l.language),
    ])].sort().map((language) => ({ language }));

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

// The 10 non-English UK languages targeted by the 'Other languages' feature
// (per Phil's brief: top 10 UK non-English, includes Welsh).
const LANGUAGE_LABELS: Record<string, { native: string; english: string; dir?: 'rtl' }> = {
  en: { native: 'English', english: 'English' },
  pl: { native: 'Polski', english: 'Polish' },
  ro: { native: 'Română', english: 'Romanian' },
  pa: { native: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
  ur: { native: 'اردو', english: 'Urdu', dir: 'rtl' },
  pt: { native: 'Português', english: 'Portuguese' },
  es: { native: 'Español', english: 'Spanish' },
  bn: { native: 'বাংলা', english: 'Bengali' },
  gu: { native: 'ગુજરાતી', english: 'Gujarati' },
  it: { native: 'Italiano', english: 'Italian' },
  cy: { native: 'Cymraeg', english: 'Welsh' },
};

function renderLeafletWithSwitcher(leafletHtml: string, slug: string, current: string, available: string[]): string {
  // Always include English in the dropdown so users can switch back.
  const all = ['en', ...available.filter((l) => l !== 'en')];
  const currentLabel = LANGUAGE_LABELS[current] ?? { native: current, english: current };

  const links = all
    .map((code) => {
      const label = LANGUAGE_LABELS[code] ?? { native: code, english: code };
      const active = code === current;
      const href = code === 'en' ? `/c/${slug}` : `/c/${slug}?lang=${code}`;
      return `<li><a href="${href}" lang="${code}"${label.dir ? ` dir="${label.dir}"` : ''} class="lang-switch__link${active ? ' lang-switch__link--active' : ''}">${label.native}<span class="lang-switch__english"> · ${label.english}</span></a></li>`;
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
      padding: 0.4rem 1.5rem;
      display: flex; align-items: center; gap: 0.5rem;
      justify-content: flex-end;
      font-size: 0.9rem;
    }
    .lang-switch__current {
      margin-right: auto;
      opacity: 0.85;
      font-size: 0.85rem;
    }
    .lang-switch__details { position: relative; }
    .lang-switch__details summary {
      list-style: none;
      cursor: pointer;
      padding: 0.4rem 0.9rem;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      font-weight: 600;
    }
    .lang-switch__details summary::-webkit-details-marker { display: none; }
    .lang-switch__details summary:hover { background: rgba(255, 255, 255, 0.22); }
    .lang-switch__details[open] summary { background: rgba(255, 255, 255, 0.22); }
    .lang-switch__panel {
      position: absolute; top: calc(100% + 0.4rem); right: 0;
      min-width: 14rem;
      background: #fff; color: #0F172A;
      border-radius: 0.5rem;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
      padding: 0.4rem 0;
      list-style: none; margin: 0;
      z-index: 20;
    }
    .lang-switch__panel li { margin: 0; }
    .lang-switch__link {
      display: block;
      padding: 0.5rem 0.9rem;
      color: #0F172A;
      text-decoration: none;
      font-size: 0.95rem;
    }
    .lang-switch__link:hover { background: #F1F5F9; }
    .lang-switch__link--active { background: rgba(40, 88, 229, 0.1); font-weight: 600; }
    .lang-switch__english { color: #94A3B8; font-size: 0.78rem; font-weight: 400; margin-left: 0.25rem; }
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
    <span class="lang-switch__current">${
      current === 'en' ? '' : `Viewing in <strong>${currentLabel.native} · ${currentLabel.english}</strong>`
    }</span>
    <details class="lang-switch__details">
      <summary>🌐 Other languages</summary>
      <ul class="lang-switch__panel">${links}</ul>
    </details>
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

    // Languages that have a translation row for this template — drives the
    // "Other languages" dropdown in the viewer bar.
    const availableLangs = (db
      .prepare('SELECT language FROM template_translations WHERE template_id = ? ORDER BY language')
      .all(template.id) as Array<{ language: string }>).map((r) => r.language);
    const langOptions = ['en', ...availableLangs.filter((l) => l !== 'en')]
      .map((code) => {
        const label = LANGUAGE_LABELS[code] ?? { native: code, english: code };
        return { code, native: label.native, english: label.english };
      });

    // Initial language: respect ?lang=xx from the URL (header dropdown links
    // arrive with this set). Falls back to English. Must be a known language
    // for this template, otherwise we silently ignore it.
    const rawLang = typeof req.query.lang === 'string' ? req.query.lang.toLowerCase() : 'en';
    const initialLang = langOptions.some((o) => o.code === rawLang) ? rawLang : 'en';
    const initialIframeSrc = initialLang === 'en'
      ? `/generic/${escape(template.slug)}`
      : `/generic/${escape(template.slug)}?lang=${encodeURIComponent(initialLang)}`;

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

    .viewer-lang {
      display: inline-flex; align-items: center; gap: 0.4rem;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 0.5rem;
      padding: 0.35rem 0.6rem 0.35rem 0.75rem;
      color: #fff;
      font-size: 0.9rem;
    }
    .viewer-lang:hover { background: rgba(255, 255, 255, 0.22); }
    .viewer-lang__icon { font-size: 1rem; line-height: 1; }
    .viewer-lang__sr {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }
    .viewer-lang select {
      background: transparent;
      color: #fff;
      border: 0;
      font: inherit;
      padding: 0.2rem 0;
      cursor: pointer;
      outline: none;
    }
    .viewer-lang select option { color: #0F172A; background: #fff; }

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
      ${
        langOptions.length > 1
          ? `<label class="viewer-lang">
              <span class="viewer-lang__icon" aria-hidden="true">🌐</span>
              <span class="viewer-lang__sr">Other languages</span>
              <select id="lang-picker" aria-label="Choose language">
                ${langOptions
                  .map((o) => `<option value="${o.code}"${o.code === initialLang ? ' selected' : ''}>${o.native} · ${o.english}</option>`)
                  .join('')}
              </select>
            </label>`
          : ''
      }
      <button id="dl-btn" class="btn-download" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span class="dl-btn__label">Download PDF</span>
      </button>
    </div>
  </header>
  <script>
    (function () {
      var btn = document.getElementById('dl-btn');
      var label = btn.querySelector('.dl-btn__label');
      var slug = ${JSON.stringify(template.slug)};
      var picker = document.getElementById('lang-picker');
      var currentLang = ${JSON.stringify(initialLang)};

      function setLang(code) {
        currentLang = code;
        var qs = code === 'en' ? '' : '?lang=' + encodeURIComponent(code);
        // Look up the iframe lazily — this script runs in <head> before the
        // iframe is parsed, so caching the reference at module-load returns
        // null and the picker silently no-ops.
        var frame = document.getElementById('preview-frame');
        if (frame) frame.src = '/generic/' + slug + qs;
        // Keep the page URL in sync so refresh / share / back-forward work.
        var pageUrl = code === 'en' ? window.location.pathname : window.location.pathname + '?lang=' + encodeURIComponent(code);
        window.history.replaceState({}, '', pageUrl);
      }
      if (picker) {
        picker.addEventListener('change', function (e) { setLang(e.target.value); });
      }

      btn.addEventListener('click', async function () {
        var original = label.textContent;
        label.textContent = 'Generating PDF…';
        btn.disabled = true;
        try {
          var qs = '?format=pdf' + (currentLang !== 'en' ? '&lang=' + encodeURIComponent(currentLang) : '');
          var res = await fetch('/generic/' + slug + qs);
          if (!res.ok) throw new Error('HTTP ' + res.status + ' from server');
          var blob = await res.blob();
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          var suffix = currentLang !== 'en' ? '-' + currentLang : '';
          a.download = 'fsm-leaflet-' + slug + suffix + '.pdf';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          label.textContent = '✓ Downloaded';
          setTimeout(function () { label.textContent = original; btn.disabled = false; }, 2000);
        } catch (err) {
          label.textContent = original;
          btn.disabled = false;
          alert('Could not generate PDF: ' + err.message);
        }
      });
    })();
  </script>

  <div class="viewer-frame-wrap">
    <iframe id="preview-frame" class="viewer-frame" src="${initialIframeSrc}" title="${escape(template.name)} preview"></iframe>
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

    // Translation overlay — when ?lang=xx is set AND a template_translations
    // row exists, render with those values instead of the English defaults.
    // No customisation here (generic == bare template), so the merge is just
    // translation-over-defaults; no per-customisation overrides to compete.
    const requestedLang = typeof req.query.lang === 'string' ? req.query.lang.toLowerCase() : 'en';
    let synthCustomization;
    if (requestedLang !== 'en') {
      const tpl = db
        .prepare('SELECT content_json FROM template_translations WHERE template_id = ? AND language = ?')
        .get(template.id, requestedLang) as { content_json: string } | undefined;
      if (tpl) {
        synthCustomization = {
          id: 0,
          template_id: template.id,
          template_version_at_publish: template.version,
          school_urn: null,
          la_slug: null,
          overrides_json: tpl.content_json,
          public_slug: '__preview__',
        };
      }
    }

    const html = await renderLeaflet({
      template,
      customization: synthCustomization,
      language: requestedLang,
      qrTarget: config.publicBaseUrl,
      qr: { include: req.query.preview === '1', printable: false },
    });
    if (req.query.format === 'pdf') {
      try {
        // Hit our own server with Playwright so CSS / images resolve. Internal
        // localhost URL avoids public-domain round-trips and SSL gotchas.
        const langSuffix = requestedLang !== 'en' ? `?lang=${requestedLang}` : '';
        const internalUrl = `http://localhost:${config.port}/generic/${template.slug}${langSuffix}`;
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
