/* Import the entitledto LA client list from the sites CSV.
 *
 * Exposes `importEntitledtoSites(csvPath)` for direct use from boot code
 * (server/src/index.ts auto-seed), and runs the same function as a CLI:
 *
 *   npm run la:import-sites -w server -- --file="C:\path\to\sites csv.csv"
 *
 * Source format (Phil's spreadsheet):
 *   header row 1: "E2 Local Authority Clients — Benefit Calculator URLs,,"
 *   header row 3: "#,Local Authority,e2calc URL"
 *   data rows:    "1,Hounslow,https://hounslow.entitledto.co.uk"
 *
 * Mapping rules:
 *   - slug derived from URL subdomain when present, else from a kebab-cased name
 *   - calculator_subdomain: extracted from URL, or `<slug>.entitledto.co.uk` placeholder
 *   - default branding: entitledto house colours (override per-LA via admin UI)
 *   - upsert by slug so re-running is safe and doesn't overwrite edited branding */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { db } from './index.js';
import { runMigrations } from './migrate.js';

const DEFAULT_BRAND = '#1B2A6B';   // entitledto navy
const DEFAULT_ACCENT = '#E64A3C';  // entitledto coral

function slugFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (!host.endsWith('.entitledto.co.uk')) return null;
    const sub = host.slice(0, -'.entitledto.co.uk'.length);
    return sub.replace(/calc$/, '').replace(/[^a-z0-9-]/g, '');
  } catch {
    return null;
  }
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bcouncil\b|\bborough\b|\bcity of\b|\bcounty\b|\bcommunity\b/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function subdomainFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  } catch {
    return url;
  }
}

export type ImportResult = {
  imported: number;
  placeholders: number;
  skipped: string[];
};

export function importEntitledtoSites(csvPath: string): ImportResult {
  const csv = fs.readFileSync(path.resolve(csvPath), 'utf8');

  // The CSV has a 2-line title block before the real header. Find the header
  // row dynamically rather than hard-coding the offset.
  const lines = csv.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => /^\s*#\s*,/.test(l));
  if (headerIdx < 0) {
    throw new Error('Could not locate header row (expected "#,Local Authority,...").');
  }
  const body = lines.slice(headerIdx).join('\n');

  type Row = { '#': string; 'Local Authority': string; 'e2calc URL': string };
  const rows = parse(body, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Row[];

  const upsert = db.prepare(`
    INSERT INTO la_clients
      (slug, name, calculator_subdomain, default_brand_colour, default_accent_colour,
       logo_url, default_source_url, enabled_languages, notes)
    VALUES
      (@slug, @name, @calculator_subdomain, @default_brand_colour, @default_accent_colour,
       @logo_url, @default_source_url, @enabled_languages, @notes)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      calculator_subdomain = excluded.calculator_subdomain,
      -- Don't overwrite brand colours / notes / source URL on re-run: those may
      -- have been edited via the admin UI after the initial import.
      updated_at = datetime('now')
  `);

  let imported = 0;
  let placeholders = 0;
  const seen = new Set<string>();
  const skipped: string[] = [];

  const tx = db.transaction(() => {
    for (const r of rows) {
      const name = r['Local Authority']?.trim();
      const url = r['e2calc URL']?.trim();
      if (!name) continue;

      const slug = (url && slugFromUrl(url)) || slugFromName(name);
      if (!slug) { skipped.push(name); continue; }
      if (seen.has(slug)) {
        // Two rows mapping to the same slug — keep the first, log the second.
        // Happens in Phil's CSV where Boston Borough points at southkesteven.
        skipped.push(`${name} (slug collision: ${slug})`);
        continue;
      }
      seen.add(slug);

      const hasRealUrl = !!url;
      const subdomain = hasRealUrl ? subdomainFromUrl(url) : `${slug}.entitledto.co.uk`;
      if (!hasRealUrl) placeholders++;

      upsert.run({
        slug,
        name,
        calculator_subdomain: subdomain,
        default_brand_colour: DEFAULT_BRAND,
        default_accent_colour: DEFAULT_ACCENT,
        logo_url: null,
        default_source_url: null,
        enabled_languages: JSON.stringify(['en']),
        notes: hasRealUrl
          ? `Imported from sites CSV on ${new Date().toISOString().slice(0, 10)}.`
          : `Imported from sites CSV on ${new Date().toISOString().slice(0, 10)}. NO CALCULATOR URL — placeholder subdomain. Verify and update.`,
      });
      imported++;
    }
  });
  tx();

  return { imported, placeholders, skipped };
}

// --- CLI wrapper ---------------------------------------------------------

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isDirectRun =
  entry && (entry === thisFile || entry.endsWith('import-entitledto-sites.ts') || entry.endsWith('import-entitledto-sites.js'));

if (isDirectRun) {
  runMigrations();
  const fileArg = process.argv.find((a) => a.startsWith('--file='))?.slice('--file='.length);
  if (!fileArg) {
    console.error('Usage: npm run la:import-sites -w server -- --file="<path>"');
    process.exit(1);
  }
  const { imported, placeholders, skipped } = importEntitledtoSites(fileArg);
  console.log(`\nImported ${imported} LA clients (${placeholders} with placeholder URLs).`);
  if (skipped.length) {
    console.log(`Skipped ${skipped.length} rows:`);
    for (const s of skipped) console.log(`  - ${s}`);
  }
}
