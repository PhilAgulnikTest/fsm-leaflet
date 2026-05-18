/* One-shot: generate 10 starter JSON files at server/data/translations/{code}.json,
 * each containing the English source strings prefixed with "__TODO__ ".
 *
 *   npm run translate:scaffold -w server
 *
 * The translator overwrites each __TODO__ value with the target-language
 * translation. The importer (import-translations.ts) skips any value still
 * carrying the __TODO__ prefix, so partial fills are safe. */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const LANGUAGES: Array<{ code: string; native: string; english: string }> = [
  { code: 'pl', native: 'Polski', english: 'Polish' },
  { code: 'ro', native: 'Română', english: 'Romanian' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
  { code: 'ur', native: 'اردو', english: 'Urdu' },
  { code: 'pt', native: 'Português', english: 'Portuguese' },
  { code: 'es', native: 'Español', english: 'Spanish' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati' },
  { code: 'it', native: 'Italiano', english: 'Italian' },
  { code: 'cy', native: 'Cymraeg', english: 'Welsh' },
];

const NAWRA_SOURCE: Record<string, string> = {
  hero_title: 'Free school meals are changing',
  hero_subtitle: 'Important news for parents and carers',
  hero_date: 'From September 2026',
  intro_html:
    '<strong>Every child whose family receives Universal Credit</strong> can get free school meals.',
  cta_primary_title: 'Register from 1 June',
  cta_primary_body_html:
    'Sign up <strong><u>before the Autumn term starts</u></strong> so your child gets every free meal they\'re entitled to.',
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
};

const ENTITLEDTO_LA_SOURCE: Record<string, string> = {
  ...NAWRA_SOURCE,
  intro_html:
    'From September 2026, every child whose family receives <strong>Universal Credit</strong> can get free school meals.',
  cta_primary_title:
    'The government are expanding free school meals and getting everyone to register annually.',
  cta_primary_body_html:
    '<strong><u>Apply before the Autumn term starts</u></strong> so your child doesn\'t miss out.',
  cta_secondary_body_html:
    'You may still be entitled. Use the free, independent entitledto calculator to check Universal Credit, free school meals, and 30+ other benefits in under 10 minutes.',
};

function withTodoPrefix(record: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) out[k] = `__TODO__ ${v}`;
  return out;
}

const outDir = path.resolve(config.paths.serverRoot, 'data', 'translations');
fs.mkdirSync(outDir, { recursive: true });

for (const lang of LANGUAGES) {
  const filePath = path.join(outDir, `${lang.code}.json`);
  if (fs.existsSync(filePath)) {
    console.log(`  skip   ${lang.code}.json (already exists)`);
    continue;
  }
  const payload = {
    _language: `${lang.native} (${lang.english}, ${lang.code})`,
    _instructions:
      `Replace every value below with the ${lang.english} translation. ` +
      `Strip the "__TODO__ " prefix when you're done with that string ` +
      `(the importer skips values that still have it). Keep HTML tags ` +
      `exactly (<strong>, <u>, <li>, <p>). Don't translate URLs or ` +
      `proper nouns (Universal Credit, NAWRA, entitledto). Right-to-left ` +
      `languages don't need any special markup — the renderer sets dir="rtl" ` +
      `automatically based on the file's language code.`,
    nawra: withTodoPrefix(NAWRA_SOURCE),
    'entitledto-la': withTodoPrefix(ENTITLEDTO_LA_SOURCE),
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`  write  ${lang.code}.json`);
}

console.log(`\nDone. Files in ${outDir}.`);
