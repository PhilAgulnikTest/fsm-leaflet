-- Per-template translations of the standard leaflet copy into the top 10
-- non-English UK languages (incl. Welsh). Generated once via the dormant
-- Anthropic SDK using `npm run translate:templates -w server` and committed
-- to the repo — the running server doesn't call any AI at request time.

CREATE TABLE template_translations (
  template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  language TEXT NOT NULL,                  -- ISO 639-1 code
  content_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (template_id, language)
);
