import { db } from './index.js';
import { runMigrations } from './migrate.js';

runMigrations();

const NAWRA_BODY = {
  hero_title: 'Free school meals are changing',
  hero_subtitle: 'Important news for parents and carers',
  hero_date: 'From September 2026',
  intro_html:
    '<strong>Every child whose family receives Universal Credit</strong> can get free school meals.',
  cta_primary_title: 'Register from 1 June',
  cta_primary_body_html:
    'Sign up <strong><u>before the Autumn term starts</u></strong> so your child gets every free meal they\'re entitled to.',
  cta_primary_bg: '#1F7A3F',
  box1_title: 'If your child currently gets free school meals',
  box1_body_html:
    '<p>From the <strong>2026/27 school year</strong>, eligibility will be checked every year. In some areas your local authority will auto-enrol your child — otherwise make sure you claim again so your child keeps their free meals.</p>',
  box2_title: 'If you receive Universal Credit but haven\'t claimed before',
  box2_body_html:
    '<p>Your child is now eligible. <strong>Claim from 1 June</strong> for the start of September.</p>',
  how_to_intro: 'For both situations above:',
  how_to_steps_html:
    '<li>Download the form from your school\'s website</li><li>Or pick up a paper copy from the school office</li>',
  cta_secondary_title: 'Not on Universal Credit yet?',
  cta_secondary_body_html:
    'You may still be entitled. A free benefit calculator will tell you if you could qualify for Universal Credit and free school meals.',
  calculator_url: 'https://www.gov.uk/benefits-calculators',
  calculator_url_display: 'https://www.gov.uk/benefits-calculators',
  contact_name: '[School name]',
  contact_phone: '[Telephone]',
  contact_email: '[Email]',
  contact_website: '[Website]',
};

const NAWRA_PALETTE = {
  brand: '#1F4F5C',     // dark teal
  accent: '#16A34A',    // CTA green
  cta_primary_bg: '#1F7A3F',
};

const NAWRA_FACTS = {
  eligibility_basis: 'Receipt of Universal Credit (England, from September 2026)',
  auto_enrolment_status: 'Some LAs auto-enrol; others require parents to claim each year.',
  claim_window_opens: '1 June 2026',
  claim_window_purpose: 'To be ready for the start of September.',
  re_check_cadence: 'Eligibility re-checked annually from 2026/27 onwards.',
  application_route: 'School-distributed form (paper or online).',
  benefit_calculator_url: 'https://www.gov.uk/benefits-calculators',
};

const ENTITLEDTO_BODY = {
  ...NAWRA_BODY,
  cta_secondary_body_html:
    'You may still be entitled. Use our free benefit calculator to check if you could qualify for Universal Credit and free school meals.',
  calculator_url: 'https://entitledto.co.uk',
  calculator_url_display: 'entitledto.co.uk',
  contact_name: '[Local authority name]',
  contact_phone: '[Telephone]',
  contact_email: '[Email]',
  contact_website: '[Website]',
};

const ENTITLEDTO_PALETTE = {
  brand: '#1F4F5C',
  accent: '#BAE6FD',
  cta_primary_bg: '#1F7A3F',
};

const HOUSING_BODY = {
  ...NAWRA_BODY,
  hero_title: 'Free school meals — for tenant families',
  hero_subtitle: 'Information from your housing association',
  contact_name: '[Housing association name]',
};

type TemplateSeed = {
  slug: string;
  name: string;
  description: string;
  audience: 'school' | 'la' | 'housing-association';
  body_path: string;
  body: Record<string, string>;
  palette: Record<string, string>;
  facts: Record<string, string>;
  status: 'published' | 'draft';
};

const templates: TemplateSeed[] = [
  {
    slug: 'nawra',
    name: 'NAWRA generic',
    description: 'NAWRA v11 — adviser-focused generic version, school-customisable footer.',
    audience: 'school',
    body_path: 'nawra/leaflet.html',
    body: NAWRA_BODY,
    palette: NAWRA_PALETTE,
    facts: NAWRA_FACTS,
    status: 'published',
  },
  {
    slug: 'entitledto-la',
    name: 'entitledto — LA bespoke',
    description:
      'LA-customisable version with auto-enrolment messaging. Calculator URL points to the LA-specific entitledto subdomain.',
    audience: 'la',
    body_path: 'nawra/leaflet.html', // shares the structure; palette + content drives the bespoke look
    body: ENTITLEDTO_BODY,
    palette: ENTITLEDTO_PALETTE,
    facts: NAWRA_FACTS,
    status: 'published',
  },
  {
    slug: 'housing-association',
    name: 'Housing association (stub)',
    description:
      'Placeholder template demonstrating the platform supports audiences beyond schools/LAs. Not yet wired into a public flow.',
    audience: 'housing-association',
    body_path: 'nawra/leaflet.html',
    body: HOUSING_BODY,
    palette: NAWRA_PALETTE,
    facts: NAWRA_FACTS,
    status: 'draft',
  },
];

const insertTemplate = db.prepare(`
  INSERT INTO templates
    (slug, name, description, audience, body_path, default_palette_json, facts_json, version, changelog, status)
  VALUES
    (@slug, @name, @description, @audience, @body_path, @palette_json, @facts_json, 1, @changelog, @status)
  ON CONFLICT(slug) DO UPDATE SET
    name = excluded.name,
    description = excluded.description,
    audience = excluded.audience,
    body_path = excluded.body_path,
    default_palette_json = excluded.default_palette_json,
    facts_json = excluded.facts_json,
    status = excluded.status,
    updated_at = datetime('now')
`);

const seedTemplates = db.transaction(() => {
  for (const t of templates) {
    insertTemplate.run({
      slug: t.slug,
      name: t.name,
      description: t.description,
      audience: t.audience,
      body_path: t.body_path,
      palette_json: JSON.stringify({ ...t.palette, content: t.body }),
      facts_json: JSON.stringify(t.facts),
      changelog: 'Initial seed.',
      status: t.status,
    });
  }
});
seedTemplates();

// Seed LA client list — Lambeth as the single MVP client.
const insertLA = db.prepare(`
  INSERT INTO la_clients
    (slug, name, calculator_subdomain, default_brand_colour, default_accent_colour,
     logo_url, default_source_url, enabled_languages, notes)
  VALUES
    (@slug, @name, @calculator_subdomain, @default_brand_colour, @default_accent_colour,
     @logo_url, @default_source_url, @enabled_languages, @notes)
  ON CONFLICT(slug) DO UPDATE SET
    name = excluded.name,
    calculator_subdomain = excluded.calculator_subdomain,
    default_brand_colour = excluded.default_brand_colour,
    default_accent_colour = excluded.default_accent_colour,
    logo_url = excluded.logo_url,
    default_source_url = excluded.default_source_url,
    enabled_languages = excluded.enabled_languages,
    notes = excluded.notes,
    updated_at = datetime('now')
`);

insertLA.run({
  slug: 'lambeth',
  name: 'Lambeth Council',
  calculator_subdomain: 'lambeth.entitledto.co.uk',
  default_brand_colour: '#1F4F5C',
  default_accent_colour: '#C2185B',
  logo_url: null,
  default_source_url: 'https://lambeth.gov.uk/freeschoolmeals',
  enabled_languages: JSON.stringify(['en', 'pl', 'ur']),
  notes:
    'Seed LA for MVP. Pioneering FSM auto-enrolment via the LIFT platform across Lambeth, Lewisham and Wandsworth.',
});

// Demo schools. These are real Lambeth primaries but with synthetic URNs in the
// 9xxxxxx range — clearly outside the real GIAS allocation, so they won't collide
// once the real CSV is imported. Lets the school flow demo end-to-end before
// gias:import has been run.
const DEMO_SCHOOLS: Array<Record<string, string | null>> = [
  {
    urn: '9900001',
    name: 'Sudbourne Primary School',
    postcode: 'SW2 5AQ',
    street: 'Hayter Road',
    town: 'London',
    phone: '020 7274 7631',
    website: 'https://sudbourneprimary.co.uk',
    email: 'admin@sudbourneprimary.lambeth.sch.uk',
    phase: 'Primary',
    la: 'Lambeth',
    status: 'Open',
  },
  {
    urn: '9900002',
    name: 'Bonneville Primary School',
    postcode: 'SW4 9LB',
    street: 'Bonneville Gardens',
    town: 'London',
    phone: '020 8673 0445',
    website: 'https://bonneville.lambeth.sch.uk',
    email: 'admin@bonneville.lambeth.sch.uk',
    phase: 'Primary',
    la: 'Lambeth',
    status: 'Open',
  },
  {
    urn: '9900003',
    name: 'St Helen’s Catholic Primary School',
    postcode: 'SW9 7AU',
    street: 'Stockwell Road',
    town: 'London',
    phone: '020 7274 4853',
    website: 'https://sthelenscatholicprimary.org.uk',
    email: 'office@sthelenscatholic.lambeth.sch.uk',
    phase: 'Primary',
    la: 'Lambeth',
    status: 'Open',
  },
];

const insertSchool = db.prepare(`
  INSERT INTO schools
    (urn, name, postcode, street, town, phone, website, email, phase, la, status, last_refreshed_at)
  VALUES
    (@urn, @name, @postcode, @street, @town, @phone, @website, @email, @phase, @la, @status, datetime('now'))
  ON CONFLICT(urn) DO UPDATE SET
    name = excluded.name,
    postcode = excluded.postcode,
    street = excluded.street,
    town = excluded.town,
    phone = excluded.phone,
    website = excluded.website,
    email = excluded.email,
    phase = excluded.phase,
    la = excluded.la,
    status = excluded.status,
    last_refreshed_at = datetime('now')
`);
for (const s of DEMO_SCHOOLS) insertSchool.run(s);

console.log(`Seeded ${templates.length} templates, 1 LA client (Lambeth), and ${DEMO_SCHOOLS.length} demo schools.`);
