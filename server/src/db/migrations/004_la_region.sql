-- Add a region tag to la_clients so we can filter the public-facing dropdown
-- to England (Pass v1 scope per the brief), without deleting the rows that
-- already represent real entitledto calculator clients.
--
-- Region values: 'england' | 'scotland' | 'wales' | 'northern-ireland' | 'unknown'.
-- Defaulting to 'england' is safe because (a) the platform is England-targeted,
-- (b) most of the imported LAs are English, (c) the boot-time tagger below
-- corrects known non-England rows.

ALTER TABLE la_clients ADD COLUMN region TEXT NOT NULL DEFAULT 'england';

CREATE INDEX idx_la_clients_region ON la_clients (region);
