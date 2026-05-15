import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './index.js';
import { config } from '../config.js';

function ensureMigrationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function appliedMigrations(): Set<string> {
  const rows = db.prepare('SELECT filename FROM _migrations').all() as { filename: string }[];
  return new Set(rows.map((r) => r.filename));
}

function migrationFiles(): string[] {
  return fs
    .readdirSync(config.paths.migrations)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

export function runMigrations(): { applied: string[]; skipped: string[] } {
  ensureMigrationsTable();
  const already = appliedMigrations();
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of migrationFiles()) {
    if (already.has(file)) {
      skipped.push(file);
      continue;
    }
    const sql = fs.readFileSync(path.join(config.paths.migrations, file), 'utf8');
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
    });
    tx();
    applied.push(file);
  }

  return { applied, skipped };
}

// Robust direct-run detection: tsx + Windows paths break the naive
// `import.meta.url === ...` comparison, so compare the resolved filename
// against argv[1] instead.
const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry && (entry === thisFile || entry.endsWith('migrate.ts') || entry.endsWith('migrate.js'))) {
  const { applied, skipped } = runMigrations();
  for (const f of skipped) console.log(`  skip  ${f}`);
  for (const f of applied) console.log(`apply  ${f}`);
  if (applied.length === 0) console.log('(no new migrations)');
}
