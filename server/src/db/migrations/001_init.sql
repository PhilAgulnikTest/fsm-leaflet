-- Pass A schema. Auth-related tables (platform_admins, magic_links, trust_domain_allowlist,
-- ai_rewrites, customization_translations) are deferred to Pass B but stubbed here where
-- doing so costs nothing.

CREATE TABLE templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL CHECK (audience IN ('school', 'la', 'housing-association')),
  body_path TEXT NOT NULL,                -- relative path under /templates/{slug}/leaflet.html
  default_palette_json TEXT NOT NULL DEFAULT '{}',
  facts_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  changelog TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE la_clients (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  calculator_subdomain TEXT NOT NULL,
  default_brand_colour TEXT NOT NULL,     -- hex, e.g. #1F4F5C
  default_accent_colour TEXT NOT NULL,
  logo_url TEXT,
  default_source_url TEXT,
  enabled_languages TEXT NOT NULL DEFAULT '["en"]',  -- JSON array of ISO codes
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE schools (
  urn TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  postcode TEXT,
  street TEXT,
  town TEXT,
  phone TEXT,
  website TEXT,
  email TEXT,
  phase TEXT,
  la TEXT,
  status TEXT,
  last_refreshed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_schools_name ON schools (name COLLATE NOCASE);
CREATE INDEX idx_schools_postcode ON schools (postcode);
CREATE INDEX idx_schools_la ON schools (la);

CREATE TABLE customizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES templates(id),
  template_version_at_publish INTEGER NOT NULL,
  school_urn TEXT REFERENCES schools(urn),
  la_slug TEXT REFERENCES la_clients(slug),
  overrides_json TEXT NOT NULL DEFAULT '{}',
  public_slug TEXT NOT NULL UNIQUE,
  owner_email TEXT,                       -- captured at customize-time; Pass B verifies via magic link
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (school_urn IS NOT NULL AND la_slug IS NULL) OR
    (school_urn IS NULL AND la_slug IS NOT NULL) OR
    (school_urn IS NULL AND la_slug IS NULL)
  )
);

CREATE INDEX idx_customizations_template ON customizations (template_id);
CREATE INDEX idx_customizations_school ON customizations (school_urn);
CREATE INDEX idx_customizations_la ON customizations (la_slug);

-- Pass B placeholder. Stays empty until magic-link auth lands.
CREATE TABLE customization_translations (
  customization_id INTEGER NOT NULL REFERENCES customizations(id) ON DELETE CASCADE,
  language TEXT NOT NULL,                 -- ISO code (pl, ur, bn, ro, so, ar)
  overrides_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (customization_id, language)
);

-- Tracks which migrations have run. Created lazily in the runner if missing.
CREATE TABLE IF NOT EXISTS _migrations (
  filename TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
