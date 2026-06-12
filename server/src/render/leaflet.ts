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

  // School flow lets parents leave the email blank; the template default is
  // the editable "[Email]" placeholder, so without explicit suppression that
  // placeholder leaks through to the published leaflet. When the override key
  // is present but empty, drop the corresponding contact span entirely after
  // substitution.
  const explicitEmpty = (key: string) =>
    Object.prototype.hasOwnProperty.call(overrides, key) &&
    typeof overrides[key] === 'string' &&
    overrides[key].trim() === '';
  const dropEmail = explicitEmpty('contact_email');
  const dropPhone = explicitEmpty('contact_phone');
  const dropWebsite = explicitEmpty('contact_website');

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

  // Optional LA logo in the hero. Off by default. Three knobs:
  //   content.show_logo === 'true'  → render the logo block
  //   content.logo_url              → explicit override URL
  //   palette.logo_url              → falls back to the LA's default logo URL
  //                                   (passed by the route handler)
  const showLogo = content.show_logo === 'true' || content.show_logo === '1';
  const logoUrl = content.logo_url || (defaults as { logo_url?: string }).logo_url || '';
  const logoHtml = showLogo && logoUrl
    ? `<div class="leaflet__hero-logo"><img src="${logoUrl}" alt="" class="leaflet__hero-logo-img"></div>`
    : '';

  // Optional third info-box — a targeted notice (e.g. the reception/Year 1/
  // Year 2 reminder on the CAB leaflet). Only rendered when the template
  // supplies box3 content AND the "secondary school" flag is off (secondary
  // schools have no infant pupils, so the universal-infant-FSM note is dropped).
  // Templates without box3 content render exactly as before.
  const isSecondary = content.is_secondary === 'true' || content.is_secondary === '1';
  const box3Title = content.box3_title ?? '';
  const box3Body = content.box3_body_html ?? '';
  const box3Kicker = content.box3_kicker ?? content.box3_eyebrow ?? '';
  const extraBoxHtml = !isSecondary && (box3Title || box3Body)
    ? `<article class="leaflet__info-box">` +
      (box3Kicker
        ? `<p class="leaflet__info-box-eyebrow" data-edit-key="box3_kicker">${box3Kicker}</p>`
        : '') +
      `<h3 class="leaflet__info-box-title" data-edit-key="box3_title">${box3Title}</h3>` +
      `<div class="leaflet__info-box-body" data-edit-key="box3_body_html">${box3Body}</div>` +
      `</article>`
    : '';

  // Per-template attribution block. Falls back to a NAWRA-only credit if a
  // template hasn't set its own (keeps CC BY 4.0 attribution intact).
  const defaultAttribution =
    '<p><strong>Template by NAWRA</strong> — National Association of Welfare Rights Advisors · ' +
    '<a href="https://nawra.org.uk">nawra.org.uk</a></p>' +
    '<p class="leaflet__credit-licence">Free to copy, adapt and share · ' +
    '<span class="leaflet__cc">CC BY 4.0</span></p>';
  const attributionHtml = content.attribution_html ?? defaultAttribution;

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
    EXTRA_BOX_HTML: extraBoxHtml,
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
    LABEL_WHAT_THIS_MEANS: content.label_what_this_means ?? 'WHAT THIS MEANS FOR YOU',
    LABEL_HOW_TO_CLAIM: content.label_how_to_claim ?? 'HOW TO CLAIM',
    ENTITLEDTO_CREDIT_HTML: entitledtoCredit,
    ATTRIBUTION_HTML: attributionHtml,
    QR_BLOCK_HTML: qrBlockHtml,
    LOGO_HTML: logoHtml,
  };

  // Inline CTA-primary background colour — overrides the CSS default
  // so LA-bespoke renders can swap the green block for magenta (Lambeth) etc.
  const inlinedCtaBg = `style="background: ${palette.cta_primary_bg};"`;
  let out = html.replace(/style="background:\s*var\(--cta-bg, #1f7a3f\);"/i, inlinedCtaBg);

  for (const [key, value] of Object.entries(substitutions)) {
    out = out.split(`{{${key}}}`).join(value);
  }

  if (dropEmail) {
    out = out.replace(/\s*<span class="leaflet__contact-email"[^>]*>[\s\S]*?<\/span>/i, '');
  }
  if (dropPhone) {
    out = out.replace(/\s*<span class="leaflet__contact-phone"[^>]*>[\s\S]*?<\/span>/i, '');
  }
  if (dropWebsite) {
    out = out.replace(/\s*<span class="leaflet__contact-website"[^>]*>[\s\S]*?<\/span>/i, '');
  }
  return out;
}
