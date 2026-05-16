-- AI rewrite audit + cost-tracking table.
--
-- One row per generate-then-verify cycle, regardless of whether the result
-- was accepted. The `warnings_json` column holds the structured fact-check
-- contradictions surfaced by the verify pass (or NULL if none). Retention
-- defaults to 30 days (purge_after) per the brief; platform admins can
-- extend per-record by clearing purge_after.

CREATE TABLE ai_rewrites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customization_id INTEGER REFERENCES customizations(id) ON DELETE SET NULL,
  template_slug TEXT NOT NULL,
  la_slug TEXT REFERENCES la_clients(slug),
  section_key TEXT NOT NULL,                  -- which leaflet section was rewritten
  mode TEXT NOT NULL CHECK (mode IN ('rewrite', 'translate')),
  target_language TEXT,                       -- ISO code, nullable when mode='rewrite'

  source_url TEXT,                            -- URL provided by the LA admin
  source_text TEXT,                           -- text fetched from URL OR pasted directly
  source_text_hash TEXT,                      -- sha256 — kept after PII purge for audit

  prompt TEXT NOT NULL,                       -- full prompt sent to the model
  model TEXT NOT NULL,                        -- e.g. claude-sonnet-4-6
  output TEXT NOT NULL,

  -- Structured fact-check result from the verify pass. Array of:
  -- { contradicted_phrase, fact_key, rationale }
  warnings_json TEXT NOT NULL DEFAULT '[]',

  accepted INTEGER NOT NULL DEFAULT 0,        -- 0/1
  accepted_with_warnings INTEGER NOT NULL DEFAULT 0,

  input_tokens INTEGER,
  output_tokens INTEGER,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  purge_after TEXT                            -- ISO timestamp; nullable means "keep"
);

CREATE INDEX idx_ai_rewrites_customization ON ai_rewrites (customization_id);
CREATE INDEX idx_ai_rewrites_la ON ai_rewrites (la_slug);
CREATE INDEX idx_ai_rewrites_purge ON ai_rewrites (purge_after);
