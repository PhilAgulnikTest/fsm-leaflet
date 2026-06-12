# Template snapshot — before 12 June 2026 CAB text updates

**Date taken:** 12/06/2026
**Reason:** Snapshot of all templates and customisations taken *before* the
June 2026 converged-text updates to the **CAB** template (adds a third
scenario box and a closing section, removes Wokingham references, refits to
one A4 page). Kept so the pre-change content of every template can be
restored or compared.

## Source

Exported from the development SQLite database at `server/data/fsm.db` using
`scripts/export-templates.ts` (kept in the repo). That DB mirrors the seed
values in `server/src/db/seed.ts`.

This was **verified against the live production site**
(https://freeschoolmeals.entitledto.co.uk/) on 12/06/2026: the deployed CAB
leaflet matched the seed/dev-DB content exactly (hero "Free school meals are
changing", `box3_eyebrow`, "Citizens Advice Wokingham" contact), confirming
**no admin-time drift** between production and the committed seed at the time
of the snapshot. The dev-DB export is therefore a faithful backup of the live
content.

## Contents

One JSON file per template slug, plus one per published customisation:

| File | What |
|------|------|
| `nawra.json` | NAWRA generic template (school) |
| `entitledto-la.json` | entitledto LA-bespoke template (la) |
| `housing-association.json` | Housing association stub template (draft) |
| `cab.json` | Citizens Advice (CAB) template — **the one being changed** |
| `customization-lambeth-demo.json` | Lambeth demo customisation |
| `customization-leeds-demo.json` | Leeds demo customisation |
| `customization-oxfordshire-demo.json` | Oxfordshire demo customisation |
| `customization-lambeth-78vt.json`, `…-pi7w.json` | Earlier Lambeth test publishes |

Each template file holds: `slug`, `name`, `description`, `audience`, `status`,
`body_path`, `version`, `changelog`, `palette` (brand/accent/cta colours),
`body` (all body slots), `facts`, and timestamps. Each customisation file
holds its `overrides` and linkage (`template_slug`, `la_slug`/`school_urn`).

**Do not modify or delete this folder** — it is a point-in-time backup.
