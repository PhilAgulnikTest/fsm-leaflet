/* Public render routes.
 *   GET /c/:slug          -> HTML render of a saved customization
 *   GET /c/:slug/preview  -> same, but with the QR block always shown (admin view)
 *   GET /generic/:templateSlug -> the unmodified template, used by the "generic PDF" download
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { renderLeaflet } from '../render/leaflet.js';
import { htmlToPdf } from '../render/pdf.js';

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
    const customization = db
      .prepare(
        `SELECT id, template_id, template_version_at_publish, school_urn, la_slug,
                overrides_json, public_slug FROM customizations WHERE public_slug = ?`
      )
      .get(req.params.slug) as CustomizationRow | undefined;
    if (!customization) return res.status(404).type('text/plain').send('Customization not found.');

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

    const html = await renderLeaflet({
      template,
      customization,
      palette,
      withEntitledtoCredit,
      qrTarget: `${config.publicBaseUrl}/c/${customization.public_slug}`,
      qr: { include: req.query.preview === '1', printable: false },
    });
    res.type('html').send(html);
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
        const pdf = await htmlToPdf(html, config.publicBaseUrl);
        res
          .type('application/pdf')
          .set('Content-Disposition', `inline; filename="fsm-leaflet-${template.slug}.pdf"`)
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

/** Same idea for a published customization. */
renderRouter.get('/c/:slug.pdf', async (req, res, next) => {
  try {
    const customization = db
      .prepare(
        `SELECT id, template_id, template_version_at_publish, school_urn, la_slug,
                overrides_json, public_slug FROM customizations WHERE public_slug = ?`
      )
      .get(req.params.slug) as CustomizationRow | undefined;
    if (!customization) return res.status(404).type('text/plain').send('Not found.');
    const template = loadTemplate(customization.template_id);
    if (!template) return res.status(500).type('text/plain').send('Template missing.');
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
    const html = await renderLeaflet({
      template,
      customization,
      palette,
      withEntitledtoCredit,
      qrTarget: `${config.publicBaseUrl}/c/${customization.public_slug}`,
      qr: { include: false },
    });
    try {
      const pdf = await htmlToPdf(html, config.publicBaseUrl);
      res
        .type('application/pdf')
        .set('Content-Disposition', `inline; filename="${customization.public_slug}.pdf"`)
        .send(pdf);
    } catch (err) {
      res.status(503).type('text/plain').send(`PDF generation unavailable: ${(err as Error).message}`);
    }
  } catch (e) { next(e); }
});
