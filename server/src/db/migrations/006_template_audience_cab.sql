-- Extend templates.audience CHECK constraint to allow 'cab' (Citizens Advice).
--
-- SQLite can't ALTER a CHECK constraint in place, so the table is rebuilt
-- following the official "other kinds of table schema changes" recipe
-- (https://sqlite.org/lang_altertable.html): foreign_keys OFF, rebuild,
-- foreign_keys ON. Doing it with FK enforcement *on* is not viable here:
--   * templates has an ON DELETE CASCADE child (template_translations, ~20
--     rows) that the implicit DELETE in DROP TABLE would wipe; and
--   * the customizations -> templates FK would orphan during the swap, which
--     under node:sqlite leaves the deferred-constraint counter non-zero and
--     fails at COMMIT even when PRAGMA foreign_key_check reports no violations
--     (so PRAGMA defer_foreign_keys is not a reliable alternative here).
-- With foreign_keys OFF, no cascade fires and no orphan check runs, so all
-- child data (template_translations, customizations) is preserved and simply
-- re-points at the rebuilt table, whose row ids are copied verbatim.
--
-- PRAGMA foreign_keys is a no-op inside a transaction, and the migration
-- runner wraps each file in one. The leading COMMIT closes that wrapping
-- transaction so the pragma takes effect; the trailing BEGIN re-opens a
-- transaction so the runner's own COMMIT (around its _migrations bookkeeping)
-- still balances.

COMMIT;

PRAGMA foreign_keys = OFF;

CREATE TABLE templates_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL CHECK (audience IN ('school', 'la', 'housing-association', 'cab')),
  body_path TEXT NOT NULL,
  default_palette_json TEXT NOT NULL DEFAULT '{}',
  facts_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  changelog TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO templates_new
  (id, slug, name, description, audience, body_path, default_palette_json,
   facts_json, version, changelog, status, created_at, updated_at)
SELECT
  id, slug, name, description, audience, body_path, default_palette_json,
  facts_json, version, changelog, status, created_at, updated_at
FROM templates;

DROP TABLE templates;
ALTER TABLE templates_new RENAME TO templates;

PRAGMA foreign_keys = ON;

BEGIN;
