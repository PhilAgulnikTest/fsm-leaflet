/* GIAS (Get Information About Schools) importer.
 *
 * DfE publishes a monthly establishment CSV at:
 *   https://get-information-schools.service.gov.uk/Downloads
 * The actual file is served from S3 with a dated filename, e.g.
 *   edubasealldata20260501.csv
 * We accept either a remote URL or a local path via `--file=`.
 *
 * Filter: England, state-funded, Status = Open.
 *
 * Pass A behaviour: tolerates the column-naming quirks of GIAS (TelephoneNum,
 * SchoolWebsite, SchoolEmail, Postcode) and is idempotent (upsert by URN). */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse';
import { request } from 'undici';
import { db } from '../db/index.js';
import { config } from '../config.js';

const STATE_FUNDED_TYPE_GROUPS = new Set([
  'Local authority maintained schools',
  'Academies',
  'Free Schools',
]);

/* GIAS publishes a dated all-establishments CSV at:
 *   https://get-information-schools.service.gov.uk/Downloads
 * The actual file URL is dated and changes each month, e.g.:
 *   https://ea-edubase-api-prod.azurewebsites.net/edubase/downloads/public/edubasealldata{YYYYMMDD}.csv
 * We attempt the first-of-this-month and first-of-last-month URLs as best
 * guesses; if neither works we tell the user to download manually. */

function candidateUrls(): string[] {
  const today = new Date();
  const dates = [
    new Date(today.getFullYear(), today.getMonth(), 1),
    new Date(today.getFullYear(), today.getMonth() - 1, 1),
  ];
  return dates.map((d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `https://ea-edubase-api-prod.azurewebsites.net/edubase/downloads/public/edubasealldata${yyyy}${mm}${dd}.csv`;
  });
}

type Row = Record<string, string>;

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function tryFetch(url: string): Promise<Buffer | null> {
  console.log(`  trying ${url}`);
  try {
    const res = await request(url, { method: 'GET' });
    if (res.statusCode !== 200) {
      console.log(`    HTTP ${res.statusCode}`);
      // Drain the body so undici doesn't warn about leaked connections.
      await res.body.arrayBuffer();
      return null;
    }
    return Buffer.from(await res.body.arrayBuffer());
  } catch (err) {
    console.log(`    fetch error: ${(err as Error).message}`);
    return null;
  }
}

async function resolveCsvPath(): Promise<string> {
  const fileArg = arg('file');
  if (fileArg) return path.resolve(fileArg);

  fs.mkdirSync(config.paths.giasData, { recursive: true });
  const cached = path.join(config.paths.giasData, 'edubase-latest.csv');
  if (fs.existsSync(cached) && !arg('refresh')) {
    console.log(`Using cached CSV at ${cached} (pass --refresh to re-download).`);
    return cached;
  }

  const urls = arg('url') ? [arg('url')!] : candidateUrls();
  console.log('Trying GIAS download URLs:');
  for (const url of urls) {
    const buf = await tryFetch(url);
    if (buf) {
      fs.writeFileSync(cached, buf);
      console.log(`Wrote ${(buf.length / 1024 / 1024).toFixed(1)} MB to ${cached}`);
      return cached;
    }
  }

  throw new Error(
    [
      'Could not download the GIAS establishment CSV automatically.',
      'Workaround:',
      '  1. Open https://get-information-schools.service.gov.uk/Downloads',
      '  2. Tick "Establishment fields" → "CSV" → Download.',
      `  3. Run: npm run gias:import -w server -- --file="C:\\path\\to\\edubasealldata.csv"`,
    ].join('\n')
  );
}

function pick(row: Row, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v !== '') return v;
  }
  return null;
}

const upsert = db.prepare(`
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

async function importCsv(csvPath: string): Promise<{ inserted: number; skipped: number }> {
  const parser = fs
    .createReadStream(csvPath)
    .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true }));

  let inserted = 0;
  let skipped = 0;
  const txStart = db.prepare('BEGIN');
  const txCommit = db.prepare('COMMIT');
  txStart.run();

  try {
    for await (const r of parser) {
      const row = r as Row;
      const country = pick(row, 'Country (name)', 'Country');
      const status = pick(row, 'EstablishmentStatus (name)', 'EstablishmentStatus');
      const typeGroup = pick(row, 'EstablishmentTypeGroup (name)', 'EstablishmentTypeGroup');

      if (country && !/england/i.test(country)) { skipped++; continue; }
      if (status && !/open/i.test(status)) { skipped++; continue; }
      if (typeGroup && !STATE_FUNDED_TYPE_GROUPS.has(typeGroup)) { skipped++; continue; }

      const urn = pick(row, 'URN');
      const name = pick(row, 'EstablishmentName');
      if (!urn || !name) { skipped++; continue; }

      upsert.run({
        urn,
        name,
        postcode: pick(row, 'Postcode'),
        street: pick(row, 'Street'),
        town: pick(row, 'Town'),
        phone: pick(row, 'TelephoneNum'),
        website: pick(row, 'SchoolWebsite'),
        email: pick(row, 'SchoolEmail'),
        phase: pick(row, 'PhaseOfEducation (name)', 'PhaseOfEducation'),
        la: pick(row, 'LA (name)', 'LA'),
        status,
      });
      inserted++;
      if (inserted % 5000 === 0) {
        process.stdout.write(`  ${inserted} rows...\r`);
      }
    }
    txCommit.run();
  } catch (e) {
    db.prepare('ROLLBACK').run();
    throw e;
  }

  return { inserted, skipped };
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry && (entry === thisFile || entry.endsWith('import.ts') || entry.endsWith('import.js'))) {
  const start = Date.now();
  resolveCsvPath()
    .then(importCsv)
    .then(({ inserted, skipped }) => {
      const ms = Date.now() - start;
      console.log(`GIAS import done: ${inserted} schools, ${skipped} rows filtered out (${ms} ms).`);
    })
    .catch((err) => {
      console.error('GIAS import failed:', err);
      process.exit(1);
    });
}
