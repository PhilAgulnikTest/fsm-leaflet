# FSM leaflet platform — handoff bundle

Everything needed to start the build of the multi-template Free School Meals leaflet customization platform.

## What's in this bundle

- **`STAGE2_brief_school_admin_system_v2.md`** — the full build brief (spec). Read this first. It contains the confirmed decisions, the data model, the AI re-write design with fact-check warning system, the launch plan, and an "Open questions and choices" section with 23 numbered decisions (4 already decided, 19 with recommended defaults).
- **`FSM_leaflet_for_parents_and_carers_v11.png`** — the NAWRA generic leaflet, current version (v11). This is the canonical visual target for the school-customizable render. The brief refers to it as `FSM_leaflet_v11.png`.
- **`FSM_leaflet_v11_oxfordshire_bespoke.png`** — LA-bespoke render for Oxfordshire. Visual target for the AI re-write output against the Oxfordshire FSM page.
- **`FSM_leaflet_v11_lambeth_bespoke.png`** — LA-bespoke render for Lambeth. The seed LA for the MVP.
- **`FSM_leaflet_v11_leeds_bespoke.png`** — LA-bespoke render for Leeds. Third LA reference to prove the approach generalises.

## What's missing (still to be created)

Two items the developer or Phil needs to produce; not blockers but worth being aware of:

1. **`FSM_leaflet_v11.html`** — the brief assumes an HTML source for the v11 template exists. The bundle only contains the PNG. The developer will need to either:
   - Reconstruct the HTML/CSS from the PNG (the simplest path — it's a one-page A4 layout).
   - Or be sent the source separately if it exists elsewhere (Phil to check the original NAWRA-supplied artwork).

2. **`FSM_leaflet_v11_entitledto_generic.png`** — an entitledto-branded generic version of the leaflet, showing what LA admins see as their starting point before they customise. **Not yet created.** Easiest path: Phil opens `FSM_leaflet_for_parents_and_carers_v11.pptx` (in his Downloads), swaps the NAWRA branding for entitledto colours/logo, adds a "Powered by entitledto" credit alongside the existing NAWRA attribution, exports to PNG, and adds it to the bundle. Alternatively the developer generates this in Pass A by rendering the entitledto template variant once the platform is up.

## Shareable URL

This brief is also available as a Claude Code onboarding link:

https://claude.ai/claude-code/onboard/kmneD3RELvOL

Open it in Claude Code to start a build session pre-loaded with the brief.

## Quick handoff message to a developer

> Hi — sending you the brief for an FSM leaflet customization platform we're building with NAWRA. Open the link above in Claude Code and the spec loads automatically; the local files in this bundle are the reference artwork.
>
> Stack and a few other decisions are already locked in (see "Confirmed decisions" at the top). The "Open questions and choices" section at the end has ~19 remaining decisions, most with a recommended default — adopt those unless you have a reason not to.
>
> Start with Pass A (foundation, no auth) in the milestones section. Hit me back with the open questions once you've sized the work.
