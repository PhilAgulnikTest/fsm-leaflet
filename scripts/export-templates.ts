/* One-off backup exporter.
 *
 * Dumps the CURRENT content of every template and customisation in the SQLite
 * database to one JSON file per slug, under a target folder (default:
 * "Templates before 12 June" at the repo root).
 *
 * Usage (from repo root):
 *   npx tsx scripts/export-templates.ts ["Output folder name"]
 *
 * Kept in-repo per the 12 June backup task. Reads the dev DB at
 * server/data/fsm.db. That DB mirrors seed.ts and, as verified against the
 * live site on 12/06/2026, matches production (no admin-time drift). */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(repoRoot, 'server', 'data', 'fsm.db');
const outDir = path.join(repoRoot, process.argv[2] || 'Templates before 12 June');

fs.mkdirSync(outDir, { recursive: true });
const db = new DatabaseSync(dbPath);

function write(name: string, data: unknown) {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('  wrote', name);
}

// --- Templates: one file per slug -----------------------------------------
const templates = db
  .prepare(
    `SELECT slug, name, description, audience, body_path, default_palette_json,
            facts_json, version, changelog, status, created_at, updated_at
       FROM templates ORDER BY id`
  )
  .all() as Array<Record<string, unknown>>;

console.log(`Exporting ${templates.length} templates →`, outDir);
for (const t of templates) {
  const palette = JSON.parse((t.default_palette_json as string) || '{}') as Record<string, unknown>;
  const body = (palette.content as Record<string, string>) ?? {};
  const paletteOnly = { ...palette };
  delete (paletteOnly as Record<string, unknown>).content;
  write(`${t.slug as string}.json`, {
    slug: t.slug,
    name: t.name,
    description: t.description,
    audience: t.audience,
    status: t.status,
    body_path: t.body_path,
    version: t.version,
    changelog: t.changelog,
    palette: paletteOnly,
    body,
    facts: JSON.parse((t.facts_json as string) || '{}'),
    created_at: t.created_at,
    updated_at: t.updated_at,
  });
}

// --- Customisations (incl. LA demos): one file per public_slug ------------
const customizations = db
  .prepare(
    `SELECT c.public_slug, c.la_slug, c.school_urn, c.owner_email,
            c.template_version_at_publish, c.overrides_json, c.published_at,
            t.slug AS template_slug
       FROM customizations c JOIN templates t ON t.id = c.template_id
      ORDER BY c.id`
  )
  .all() as Array<Record<string, unknown>>;

console.log(`Exporting ${customizations.length} customisations`);
for (const c of customizations) {
  write(`customization-${c.public_slug as string}.json`, {
    public_slug: c.public_slug,
    template_slug: c.template_slug,
    la_slug: c.la_slug,
    school_urn: c.school_urn,
    owner_email: c.owner_email,
    template_version_at_publish: c.template_version_at_publish,
    overrides: JSON.parse((c.overrides_json as string) || '{}'),
    published_at: c.published_at,
  });
}

console.log('Done.');
