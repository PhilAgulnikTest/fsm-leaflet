-- Pass B auth tables.
--
-- Edit-URL model (brief, "Edit-URL auth model" section):
--   * `magic_links` is the request/verify primitive. Each link is single-use,
--     15-min expiry, stored as a sha256 hash of the random token.
--   * On verify we create a `sessions` row that grants edit access to a single
--     customization for 8 hours, via an HttpOnly cookie holding the session id.
--   * The "edit URL" given to the user at publish time is NOT a bearer-token
--     URL — it's a magic-link-issuing URL keyed on `customization_id`, which
--     triggers a fresh magic-link cycle to the original verified email.

CREATE TABLE platform_admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE magic_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,         -- sha256(token) hex
  email TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('school', 'la', 'platform-admin')),
  customization_id INTEGER REFERENCES customizations(id) ON DELETE CASCADE,
  school_urn TEXT REFERENCES schools(urn),
  la_slug TEXT REFERENCES la_clients(slug),
  expires_at TEXT NOT NULL,                -- ISO timestamp
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_magic_links_email ON magic_links (email);
CREATE INDEX idx_magic_links_expires ON magic_links (expires_at);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                     -- 32-byte hex
  email TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('school', 'la', 'platform-admin')),
  customization_id INTEGER REFERENCES customizations(id) ON DELETE CASCADE,
  school_urn TEXT REFERENCES schools(urn),
  la_slug TEXT REFERENCES la_clients(slug),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sessions_email ON sessions (email);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

-- Trust-domain allowlist — academy-trust domains approved out-of-band by
-- platform admins (so e.g. ark.org.uk passes the school auth domain check
-- even though it isn't *.sch.uk).
CREATE TABLE trust_domain_allowlist (
  domain TEXT PRIMARY KEY,
  approved_by TEXT NOT NULL,                -- platform admin email
  approved_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT NOT NULL DEFAULT ''
);

-- Audit log for trust-domain allowlist REQUESTS that came in via the
-- request-allowlist flow but haven't been approved yet.
CREATE TABLE trust_domain_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL,
  requested_email TEXT NOT NULL,
  requested_for_urn TEXT REFERENCES schools(urn),
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_trust_domain_requests_status ON trust_domain_requests (status);
