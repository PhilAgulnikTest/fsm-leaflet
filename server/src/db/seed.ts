import { db } from './index.js';
import { runMigrations } from './migrate.js';

runMigrations();

// --- Attribution blocks ----------------------------------------------------
//
// Per Phil's direction: NAWRA reference text removed from both the school-
// facing NAWRA template and the LA-bespoke template. All templates keep the
// "Free to copy, adapt and share · CC BY 4.0" line.
//
// ⚠️ CC BY 4.0 licensing note: strictly the licence requires NAWRA attribution
// on every derivative. Confirm with NAWRA before any public launch.

const NAWRA_ATTRIBUTION =
  '<p class="leaflet__credit-licence">Free to copy, adapt and share · ' +
  '<span class="leaflet__cc">CC BY 4.0</span></p>';

const LA_BESPOKE_ATTRIBUTION =
  '<p class="leaflet__credit-licence">' +
  'Published by <a href="https://entitledto.co.uk">entitledto.co.uk</a>' +
  ' · Free to copy, adapt and share' +
  ' · <span class="leaflet__cc">CC BY 4.0</span>' +
  '</p>';

// --- Template defaults -----------------------------------------------------

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
  attribution_html: NAWRA_ATTRIBUTION,
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
  intro_html:
    'From September 2026, every child whose family receives <strong>Universal Credit</strong> can get free school meals.',
  cta_primary_title: 'The government are expanding free school meals and getting everyone to register annually.',
  cta_primary_body_html:
    '<strong><u>Apply before the Autumn term starts</u></strong> so your child doesn\'t miss out.',
  cta_primary_bg: '#2858E5',
  box2_body_html:
    '<p>Your child is now eligible. <strong>Claim from 1 June</strong> for the start of September.</p>',
  cta_secondary_body_html:
    'You may still be entitled. Use the free, independent entitledto calculator to check Universal Credit, free school meals, and 30+ other benefits in under 10 minutes.',
  calculator_url: 'https://entitledto.co.uk',
  calculator_url_display: 'entitledto.co.uk',
  contact_name: 'independent | accurate | reliable',
  contact_phone: '',
  contact_email: '',
  contact_website: 'Used by Local Authorities, Housing Associations and Citizens Advice',
  attribution_html: LA_BESPOKE_ATTRIBUTION,
};

const ENTITLEDTO_PALETTE = {
  brand: '#1B2A6B',          // navy
  accent: '#E64A3C',
  cta_primary_bg: '#2858E5', // bright blue CTA
};

const HOUSING_BODY = {
  ...NAWRA_BODY,
  hero_title: 'Free school meals — for tenant families',
  hero_subtitle: 'Information from your housing association',
  contact_name: '[Housing association name]',
  attribution_html: LA_BESPOKE_ATTRIBUTION,
};

const CAB_BODY = {
  ...NAWRA_BODY,
  box1_body_html:
    '<p>From the <strong>2026/27 school year</strong>, eligibility will be ' +
    'checked every year. In some areas your local authority will auto-enrol ' +
    'your child — otherwise make sure you claim again so your child keeps ' +
    'their free meals <strong>and your school keeps its Pupil Premium ' +
    'funding</strong>.</p>',
  box2_body_html:
    '<p>Your child is now eligible. <strong>Claim from 1 June</strong> for ' +
    'the start of September. Claiming also unlocks <strong>Pupil Premium' +
    '</strong> funding for the school — extra money used for catch-up ' +
    'tutoring, extra teaching support, and educational visits.</p>',
  how_to_intro: 'About an hour of your time — and two things worth doing:',
  how_to_steps_html:
    '<li><strong>Apply for free school meals</strong> through your school ' +
    "office, your school's website, or your local council. You'll need: " +
    "your National Insurance number, your address and postcode, your child's " +
    'full name and date of birth, and the name of the benefit you receive ' +
    '(Universal Credit or another qualifying benefit).</li>' +
    "<li><strong>Check you're claiming " +
    '<a href="https://www.gov.uk/child-benefit/how-to-claim">Child Benefit</a>' +
    '.</strong> Even if one parent earns over £80,000 and the payment is ' +
    'fully clawed back by the High Income Child Benefit Charge, register ' +
    'anyway and tick the box to opt out of payment — it protects the ' +
    "at-home parent's National Insurance record.</li>",
  contact_name: '[Citizens Advice office name]',
  contact_phone: '[Telephone]',
  contact_email: '[Email]',
  contact_website: '[Website]',
};

const CAB_FACTS = {
  ...NAWRA_FACTS,
  application_route:
    'School- or LA-distributed form; CAB advisers may help families complete.',
};

type TemplateSeed = {
  slug: string;
  name: string;
  description: string;
  audience: 'school' | 'la' | 'housing-association' | 'cab';
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
  {
    slug: 'cab',
    name: 'Citizens Advice (CAB)',
    description:
      'For Citizens Advice offices and other advice agencies to hand to ' +
      'clients. Adds Pupil Premium and Child Benefit messaging to the NAWRA ' +
      'structure.',
    audience: 'cab',
    body_path: 'nawra/leaflet.html',
    body: CAB_BODY,
    palette: NAWRA_PALETTE,
    facts: CAB_FACTS,
    status: 'published',
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

// --- LA clients ------------------------------------------------------------
//
// Three named LAs from the brief, each with their own brand palette. These
// match the colours seen in the reference bespoke PNGs (Lambeth=teal+magenta,
// Leeds=navy+yellow, Oxfordshire=red+yellow).

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

const NAMED_LAS: Array<Parameters<typeof insertLA.run>[0]> = [
  {
    slug: 'lambeth',
    name: 'Lambeth Council',
    calculator_subdomain: 'lambeth.entitledto.co.uk',
    default_brand_colour: '#0F6E5B',
    default_accent_colour: '#C2185B',
    logo_url: '/logos/lambeth.svg',
    default_source_url: 'https://lambeth.gov.uk/freeschoolmeals',
    enabled_languages: JSON.stringify(['en', 'pl', 'ur']),
    notes:
      'Pioneering FSM auto-enrolment via the LIFT platform across Lambeth, Lewisham and Wandsworth.',
  },
  {
    slug: 'leeds',
    name: 'Leeds City Council',
    calculator_subdomain: 'leeds.entitledto.co.uk',
    default_brand_colour: '#0F2A52',
    default_accent_colour: '#F0B92E',
    logo_url: null,
    default_source_url: 'https://leeds.gov.uk/freeschoolmeals',
    enabled_languages: JSON.stringify(['en']),
    notes: 'Reference render in the brief bundle.',
  },
  {
    slug: 'oxfordshire',
    name: 'Oxfordshire County Council',
    calculator_subdomain: 'oxfordshire.entitledto.co.uk',
    default_brand_colour: '#8B1F1F',
    default_accent_colour: '#F0B92E',
    logo_url: '/logos/oxfordshire.svg',
    default_source_url:
      'https://schools.oxfordshire.gov.uk/schools-news/2026/free-school-meal-eligibility-and-checking-processes',
    enabled_languages: JSON.stringify(['en']),
    notes: 'Reference render in the brief bundle.',
  },
];
for (const la of NAMED_LAS) insertLA.run(la);

// --- Demo customisations (publish the three reference renders) -------------

const upsertCustomization = db.prepare(`
  INSERT INTO customizations
    (template_id, template_version_at_publish, la_slug, overrides_json, public_slug,
     owner_email, published_at)
  VALUES
    ((SELECT id FROM templates WHERE slug = @template_slug),
     1, @la_slug, @overrides_json, @public_slug, @owner_email, datetime('now'))
  ON CONFLICT(public_slug) DO UPDATE SET
    overrides_json = excluded.overrides_json,
    updated_at = datetime('now')
`);

type DemoCustomization = {
  public_slug: string;
  la_slug: string;
  overrides: Record<string, string>;
};

const DEMOS: DemoCustomization[] = [
  {
    public_slug: 'lambeth-demo',
    la_slug: 'lambeth',
    overrides: {
      show_logo: 'true',
      logo_url: '/logos/lambeth.svg',
      hero_title: 'Free school meals: Lambeth\'s expanded offer',
      hero_subtitle: 'Important news for parents and carers',
      hero_date: 'From September 2026',
      intro_html:
        'From September 2026, every Lambeth child whose family receives <strong>Universal Credit</strong> can get free school meals.',
      cta_primary_title: 'We may auto-enrol your child',
      cta_primary_body_html:
        'Lambeth has been auto-enrolling children for years. <strong><u>Most eligible children will be signed up automatically</u></strong> — but contact your school if you don\'t hear from us by September.',
      cta_primary_bg: '#C2185B',
      box1_title: 'If your child currently gets free school meals',
      box1_body_html:
        '<p>Lambeth checks eligibility every year and <strong>auto-enrols most eligible children</strong>. If your circumstances have changed, contact your school or the Lambeth Welfare team to make sure your child stays signed up.</p>',
      box2_title: 'If you receive Universal Credit but haven\'t claimed before',
      box2_body_html:
        '<p>Your child is now eligible. <strong>Lambeth may auto-enrol you from 1 June</strong> — or apply directly through your school for the start of September. ' +
        'Full details: <a href="https://lambeth.gov.uk/freeschoolmeals">lambeth.gov.uk/freeschoolmeals</a>.</p>',
      how_to_steps_html:
        '<li>Apply at <a href="https://lambeth.gov.uk/freeschoolmeals">lambeth.gov.uk/freeschoolmeals</a></li>' +
        '<li>Or via your school\'s website</li>' +
        '<li>Or pick up a paper copy from the school office</li>',
      cta_secondary_title: 'Not on Universal Credit yet?',
      cta_secondary_body_html:
        'You may still be entitled. Use Lambeth\'s free benefit calculator to check if you could qualify for Universal Credit and free school meals.',
      calculator_url: 'https://lambeth.entitledto.co.uk',
      calculator_url_display: 'lambeth.entitledto.co.uk',
      contact_name: 'Lambeth Welfare and Benefits Team',
      contact_phone: '',
      contact_email: 'fsm@lambeth.gov.uk',
      contact_website: '<a href="https://lambeth.gov.uk/freeschoolmeals">lambeth.gov.uk/freeschoolmeals</a>',
    },
  },
  {
    public_slug: 'leeds-demo',
    la_slug: 'leeds',
    overrides: {
      hero_title: 'Free school meals: what\'s changing in Leeds',
      hero_subtitle: 'Important news for parents and carers',
      hero_date: 'From September 2026',
      intro_html:
        'From September 2026, every Leeds child whose family receives <strong>Universal Credit</strong> can get free school meals.',
      cta_primary_title: 'Apply now for September',
      cta_primary_body_html:
        'Leeds processes applications over the summer. <strong><u>Apply online or through your school</u></strong> so your child is signed up before the Autumn term starts.',
      cta_primary_bg: '#F0B92E',
      box1_title: 'If your child currently gets free school meals',
      box1_body_html:
        '<p>From <strong>7 September 2026</strong>, the current rules and £7,400 earnings limit end. Eligibility will be checked every year — if your situation has changed, contact Welfare and Benefits to make sure your child keeps their free meals.</p>',
      box2_title: 'If you receive Universal Credit but haven\'t claimed before',
      box2_body_html:
        '<p>Your child is now eligible. <strong>Apply online from 1 June</strong> or download the form — Leeds will process applications over the summer.</p>',
      cta_secondary_title: 'Not on Universal Credit yet?',
      cta_secondary_body_html:
        'You may still be entitled. Use Leeds\' free benefit calculator to check if you could qualify for Universal Credit and free school meals.',
      calculator_url: 'https://leeds.entitledto.co.uk',
      calculator_url_display: 'leeds.entitledto.co.uk',
      contact_name: 'Leeds Welfare and Benefits (FSM Claims)',
      contact_phone: '',
      contact_email: 'lcc.benefits@leeds.gov.uk',
      contact_website: 'leeds.gov.uk/freeschoolmeals',
    },
  },
  {
    public_slug: 'oxfordshire-demo',
    la_slug: 'oxfordshire',
    overrides: {
      show_logo: 'true',
      logo_url: '/logos/oxfordshire.svg',
      hero_title: 'Free school meals: what\'s changing in Oxfordshire',
      hero_subtitle: 'Important news for parents and carers',
      hero_date: 'From September 2026',
      intro_html:
        'From September 2026, every child whose family receives <strong>Universal Credit</strong> can get free school meals.',
      cta_primary_title: 'Apply by end of summer term',
      cta_primary_body_html:
        'Oxfordshire processes applications <strong><u>over the summer</u></strong> so your child is ready for free meals on the first day of the Autumn term.',
      cta_primary_bg: '#E8951A',
      box1_title: 'If your child currently gets free school meals',
      box1_body_html:
        '<p>From the <strong>2026/27 school year</strong>, eligibility will be checked every year. Oxfordshire is <strong>exploring auto-enrolment</strong> — look out for a letter from us, and contact your school if you don\'t hear by the start of term.</p>',
      box2_title: 'If you receive Universal Credit but haven\'t claimed before',
      box2_body_html:
        '<p>Your child is now eligible. <strong>Apply through your school by the end of the summer term</strong>. ' +
        'Full details: <a href="https://schools.oxfordshire.gov.uk/schools-news/2026/free-school-meal-eligibility-and-checking-processes">schools.oxfordshire.gov.uk</a>.</p>',
      how_to_steps_html:
        '<li>Apply at <a href="https://schools.oxfordshire.gov.uk/schools-news/2026/free-school-meal-eligibility-and-checking-processes">schools.oxfordshire.gov.uk</a></li>' +
        '<li>Or download the form from your school\'s website</li>' +
        '<li>Or pick up a paper copy from the school office</li>',
      cta_secondary_title: 'Not on Universal Credit yet?',
      cta_secondary_body_html:
        'You may still be entitled. Use Oxfordshire\'s free benefit calculator to check if you could qualify for Universal Credit and free school meals.',
      calculator_url: 'https://oxfordshire.entitledto.co.uk',
      calculator_url_display: 'oxfordshire.entitledto.co.uk',
      contact_name: 'Oxfordshire Free School Meals Team',
      contact_phone: '',
      contact_email: 'Free.SchoolMeals@Oxfordshire.gov.uk',
      contact_website: '<a href="https://schools.oxfordshire.gov.uk/schools-news/2026/free-school-meal-eligibility-and-checking-processes">schools.oxfordshire.gov.uk</a>',
    },
  },
];

for (const d of DEMOS) {
  upsertCustomization.run({
    template_slug: 'entitledto-la',
    la_slug: d.la_slug,
    overrides_json: JSON.stringify(d.overrides),
    public_slug: d.public_slug,
    owner_email: 'demo@entitledto.co.uk',
  });
}

// --- Demo schools (Lambeth primaries with synthetic URNs) -----------------

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

console.log(
  `Seeded ${templates.length} templates, ${NAMED_LAS.length} LA clients, ` +
    `${DEMOS.length} demo customisations, and ${DEMO_SCHOOLS.length} demo schools.`
);
