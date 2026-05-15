/* Leaflet render pipeline.
 *
 * Read template HTML/CSS from /templates/{slug}/leaflet.html, merge the template's
 * default content (in default_palette_json.content) with per-customisation overrides,
 * substitute {{PLACEHOLDERS}}, and return final HTML. CSS is served as a sibling
 * static asset rather than inlined — keeps the rendered HTML legible. */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { generateQr, renderQrBlockHtml, type QrOptions } from './qr.js';

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

export type RenderInput = {
  template: TemplateRow;
  customization?: CustomizationRow;
  /** Brand colour override (LA palette) — wins over the template default. */
  palette?: { brand?: string; accent?: string; cta_primary_bg?: string };
  /** Language for the rendered output. Defaults to 'en'. */
  language?: string;
  /** Where the QR should point. Defaults to publicBaseUrl. */
  qrTarget?: string;
  /** Whether the QR block is included in the rendered output and the print version. */
  qr?: QrOptions & { include?: boolean };
  /** Whether this render belongs to an LA template — adds the entitledto credit. */
  withEntitledtoCredit?: boolean;
};

const RTL_LANGS = new Set(['ar', 'ur', 'he', 'fa']);

function templatePaths(bodyPath: string) {
  const root = path.resolve(config.paths.templates, path.dirname(bodyPath));
  return {
    html: path.resolve(config.paths.templates, bodyPath),
    cssUrl: `/templates/${path.relative(config.paths.templates, path.join(root, 'leaflet.css')).split(path.sep).join('/')}`,
  };
}

export async function renderLeaflet(input: RenderInput): Promise<string> {
  const { template, customization } = input;
  const paths = templatePaths(template.body_path);
  const html = fs.readFileSync(paths.html, 'utf8');

  const defaults = JSON.parse(template.default_palette_json || '{}') as {
    brand?: string; accent?: string; cta_primary_bg?: string;
    content?: Record<string, string>;
  };
  const content = { ...(defaults.content ?? {}) };
  const overrides = customization
    ? (JSON.parse(customization.overrides_json || '{}') as Record<string, string>)
    : {};
  for (const [k, v] of Object.entries(overrides)) {
    if (v != null && v !== '') content[k] = v;
  }

  const palette = {
    brand: input.palette?.brand ?? defaults.brand ?? '#1F4F5C',
    accent: input.palette?.accent ?? defaults.accent ?? '#16A34A',
    cta_primary_bg: input.palette?.cta_primary_bg ?? defaults.cta_primary_bg ?? '#1F7A3F',
  };

  const lang = input.language ?? 'en';
  const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';

  let qrBlockHtml = '';
  if (input.qr?.include !== false) {
    const target = input.qrTarget ?? config.publicBaseUrl;
    const qr = await generateQr(target);
    qrBlockHtml = renderQrBlockHtml(qr, { printable: input.qr?.printable ?? false });
  }

  const entitledtoCredit = input.withEntitledtoCredit
    ? ' · <strong>Powered by entitledto.co.uk</strong>'
    : '';

  const substitutions: Record<string, string> = {
    LANG: lang,
    DIR: dir,
    TITLE: content.hero_title ?? 'Free school meals are changing',
    CSS_URL: paths.cssUrl,
    TEMPLATE_SLUG: template.slug,
    BRAND_COLOUR: palette.brand,
    ACCENT_COLOUR: palette.accent,
    HERO_TITLE: content.hero_title ?? '',
    HERO_SUBTITLE: content.hero_subtitle ?? '',
    HERO_DATE: content.hero_date ?? '',
    INTRO_HTML: content.intro_html ?? '',
    CTA_PRIMARY_TITLE: content.cta_primary_title ?? '',
    CTA_PRIMARY_BODY_HTML: content.cta_primary_body_html ?? '',
    BOX1_TITLE: content.box1_title ?? '',
    BOX1_BODY_HTML: content.box1_body_html ?? '',
    BOX2_TITLE: content.box2_title ?? '',
    BOX2_BODY_HTML: content.box2_body_html ?? '',
    HOW_TO_INTRO: content.how_to_intro ?? '',
    HOW_TO_STEPS_HTML: content.how_to_steps_html ?? '',
    CTA_SECONDARY_TITLE: content.cta_secondary_title ?? '',
    CTA_SECONDARY_BODY_HTML: content.cta_secondary_body_html ?? '',
    CALCULATOR_URL: content.calculator_url ?? '',
    CALCULATOR_URL_DISPLAY: content.calculator_url_display ?? content.calculator_url ?? '',
    CONTACT_NAME: content.contact_name ?? '',
    CONTACT_PHONE: content.contact_phone ?? '',
    CONTACT_EMAIL: content.contact_email ?? '',
    CONTACT_WEBSITE: content.contact_website ?? '',
    ENTITLEDTO_CREDIT_HTML: entitledtoCredit,
    QR_BLOCK_HTML: qrBlockHtml,
  };

  // Inline CTA-primary background colour — overrides the CSS default
  // so LA-bespoke renders can swap the green block for magenta (Lambeth) etc.
  const inlinedCtaBg = `style="background: ${palette.cta_primary_bg};"`;
  let out = html.replace(/style="background:\s*var\(--cta-bg, #1f7a3f\);"/i, inlinedCtaBg);

  for (const [key, value] of Object.entries(substitutions)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}
