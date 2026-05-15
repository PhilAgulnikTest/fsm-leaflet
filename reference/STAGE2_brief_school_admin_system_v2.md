# Stage 2 (v2) — Build a multi-template leaflet customization platform

> **What changed in v2 vs v1.** Reworked school auth to handle academy-trust domains. Expanded AI re-write with SSRF/abuse controls and fact-pinning to stop hallucinated eligibility rules. Added template versioning so policy changes don't silently invalidate published leaflets. Added multilingual re-write, accessibility/contrast checks, print-spec guidance, email deliverability, GDPR posture, and operations notes. Tightened a couple of acceptance criteria. New "Open questions and choices" section at the end consolidates everything that needs a decision before build.

## Confirmed decisions (locked in before build)

- **Backend stack**: Node.js + Express.
- **Frontend**: React (the editor warrants the richer UI).
- **AI model**: Claude Sonnet (latest available at build time) for re-write and translation.
- **AI re-write scope**: any section of the leaflet can be rewritten by AI. No fixed/locked sections. Accuracy is enforced by a **fact-check warning system** (see "AI re-write feature"), not by restricting which sections can be edited.
- **Sending domain for magic-link emails**: existing `entitledto.co.uk` domain — reuse the SPF/DKIM/DMARC setup already in place. Send from a dedicated mailbox like `fsm-leaflet@entitledto.co.uk` (or `noreply@entitledto.co.uk` if there's an existing pattern). No new subdomain, no new DNS work. Public launch happens via a blog post on the entitledto site rather than a dedicated platform subdomain — see "Launch plan".
- **Hosting**: deferred — small audience for v1 (~1 user initially). A free-tier default subdomain on Cloudflare Pages / Vercel / Railway (e.g. `fsm-leaflet.vercel.app`) is fine. No custom domain or paid plan needed until circulation grows.

Everything else in "Open questions and choices" still stands.

## Context

We have a printable A4 information leaflet template ("Free school meals are changing — important news for parents and carers"). The platform should let three distinct groups customize and publish it:

1. **Schools** — replace four footer fields (school name, telephone, email, website), publish to a unique URL.
2. **Local authorities** — replace LA-level branding and contact details, swap calculator URL to a bespoke LA-specific entitledto calculator, optionally use **AI re-write** to adapt copy from a source URL.
3. **Platform admins (NAWRA / entitledto staff)** — manage which templates exist, create new ones (e.g. a housing-association variant for tenants), maintain the LA client list.

The leaflet template (HTML/CSS) and reference renders (NAWRA v11, plus three LA demos for Oxfordshire, Lambeth and Leeds) will be provided alongside this brief. Treat them as the canonical rendering targets.

## Three audiences for the website

1. **School admins** — customize and publish their school's version (magic-link auth).
2. **LA admins** — customize and publish their authority's bespoke version (magic-link auth with LA-domain check).
3. **Platform admins** — create and edit templates, manage LA client list (**password-protected**).
4. Plus the public: advisers, NAWRA members, anyone scanning the QR — can download any generic version without auth.

## Three auth tiers

| Tier | Who | How | What they can do |
|---|---|---|---|
| **Platform admin** | NAWRA / entitledto staff | **Password login** (env-configured allowlist + bcrypt) | Create / edit templates, manage LA client list, edit any record, refresh GIAS, manage translations |
| **LA admin** | Council FSM team | Magic link to LA-domain email | Customize their LA's version using AI re-write, edit fields, publish, request translations |
| **School admin** | School staff | Magic link to a domain that matches the school's GIAS `SchoolEmail` / `SchoolWebsite` (see "School auth domain check") | Customize the school footer (name, phone, email, website), publish |

### School auth domain check

A blanket `*.sch.uk` suffix rule locks out most academies and multi-academy trusts, which commonly use `*.org.uk` or trust-specific domains (e.g. `ark.org.uk`, `oasiscommunity.org.uk`). Instead:

1. When a school admin searches GIAS and picks their school, derive the **expected email domain** from GIAS `SchoolEmail` and `SchoolWebsite` for that URN.
2. The magic link is sent to the address the admin types, **only if** its domain matches the expected domain (or a parent of it — `head@school.ark.org.uk` matches expected `ark.org.uk`).
3. If no match, surface a soft warning and offer a **request-allowlist** flow: the email goes to platform admins for one-click approval, adding the trust domain to a per-trust allowlist.

The end result: official school emails authenticate frictionlessly, unusual cases route through platform admins instead of being silently blocked.

### Edit-URL auth model

The brief uses both `magic_links` and a per-customization `edit_token`. Pick one explicit model — recommended:

- Magic link grants a **short-lived session cookie** (e.g. 8h) scoped to `customization_id`.
- The "edit URL" returned at publish time is a magic-link-issuing URL: anyone with it can request a fresh magic link to the original verified email, but cannot edit just by holding the URL.
- This stops shared edit URLs (forwarded in WhatsApp, leaked via Referer) from granting silent write access.

## Template management (platform-admin only)

Three starter templates seeded at first run:

- **NAWRA** (current v11 leaflet) — the generic adviser-focused version, school-customizable.
- **entitledto** — LA-customizable version, focused on auto-enrolment messaging, calculator URL points to the LA-specific entitledto subdomain.
- **Housing association** (stub for now) — placeholder showing the platform supports more than schools/LAs (e.g. tenants).

Platform admins can:

- Create a new template (form: name, description, body sections, default colour palette, contact-block label, calculator URL pattern).
- Clone an existing template and modify.
- Mark templates as `published` / `draft` so school/LA admins only see published ones.
- Set which audience tier (school / LA / housing association) a template targets.
- Bump a template's `version` (see "Template versioning and policy drift").

## LA admin journey

1. LA admin lands on `/customize`, picks template **"entitledto — LA bespoke"**.
2. **Dropdown of entitledto LA clients** appears (seeded from the platform-admin-maintained list; see "LA client list" below). Initial seed: Lambeth.
3. LA admin selects their LA → form pre-populates with LA name, contact placeholders, and the LA-specific entitledto calculator URL (`{slug}.entitledto.co.uk`).
4. LA admin can edit any body section. Each editable section has three controls:
   - **Edit manually** — inline rich-text editor.
   - **Re-write with AI** — opens a dialog (see "AI re-write" below).
   - **Translate** — opens the same AI dialog in translation mode (see "Multilingual support").
5. LA admin enters an email at their LA domain (`*.gov.uk`); magic link sent.
6. After verifying, they preview the leaflet, click **Publish** → unique public URL returned, plus an edit URL.
7. Returning to the edit URL re-triggers magic-link auth and allows further updates anytime.

## LA client list

A platform-admin-managed list of entitledto LA clients eligible for the bespoke template. Each row: `{la_slug, la_name, calculator_subdomain, default_brand_colour, default_accent_colour, default_logo_url, default_source_url, notes}`.

Two ways for platform admins to populate:

- **Upload CSV** — drag-and-drop. Validates columns, dedupes by `la_slug`, runs the brand-colour contrast check (see "Accessibility"). CSV format documented in admin UI.
- **Manual add/edit** — form in the platform-admin area.

Seed example for MVP: **Lambeth** (`lambeth.entitledto.co.uk`, dark teal, magenta accent). Demos for Oxfordshire and Leeds are also provided as reference renders; treat them as illustrative content the platform should be able to produce, not as confirmed entitledto clients.

## AI re-write feature

For LA admins editing any body section, the **"Re-write with AI"** button opens a dialog:

1. Dialog shows the current section text on the left.
2. On the right, an input: *"Paste a URL or text the AI should base the re-write on"*. Below it, a **dropdown of entitledto LA clients** — selecting one pre-fills with that LA's known FSM page (configured by platform admin, e.g. Oxfordshire → `https://schools.oxfordshire.gov.uk/schools-news/2026/free-school-meal-eligibility-and-checking-processes`).
3. LA admin clicks **Re-write** → server fetches the URL (or uses pasted text), sends it to the model with the constrained prompt template (see below).
4. Suggestion appears alongside the current text; LA admin can **Accept**, **Edit and accept**, or **Discard**.

Use a small/cheap model for cost (Claude Sonnet or similar). Rate-limit per LA. Never auto-apply — always require explicit accept.

### URL-fetch safety controls

URL fetching is a classic SSRF and abuse vector. The server-side fetcher must:

- **HTTPS only**, with a strict allowlist of schemes.
- **Block private/internal address ranges** (RFC1918, link-local 169.254.0.0/16, IPv6 ULA `fc00::/7`, `localhost`, `0.0.0.0`) — resolve hostnames first and check the resulting IP, not just the hostname.
- **Hard timeout** (e.g. 10 s) and **size cap** (e.g. 1 MB).
- **Respect `robots.txt`** and set a clear `User-Agent` identifying the platform.
- **Strip HTML to text** before sending to the model; do not pass scripts, styles, or attribute payloads.

### Fact-check warning system

Any section of the leaflet can be AI-rewritten — there are no hard-locked sections. Accuracy is enforced by a two-pass pipeline that warns the LA admin when the generated copy appears to contradict the facts pinned for the template.

Each template carries a `facts_json` block holding the factual claims (eligibility criteria, key dates, how to apply, auto-enrolment status) drawn from current DfE guidance. The pipeline:

1. **Generate** — model produces re-written copy for the section, given the source URL/text from the dialog *and* the `facts_json` block as context. Prompt constraints: parent-friendly tone, plain English, reading age ~9, length cap per section.
2. **Verify** — a second, cheaper model call cross-checks the generated copy against `facts_json` and returns either `ok` or a structured list of suspected contradictions, each with the contradicted phrase, the fact it appears to contradict, and a short rationale ("rewrite says claims close 31 May; facts_json says 1 June").

If verification flags anything, the dialog shows the suspected inaccuracies **above** the suggested copy with the contradicted phrases highlighted in red, before the **Accept / Edit and accept / Discard** buttons. The LA admin can still accept (there may be a legitimate local difference — e.g. the LA runs an earlier internal deadline) but the warning state, rationale, and admin decision are persisted on `ai_rewrites` for audit.

Translations run the same pipeline — verify confirms dates, numbers, and named facts carry through unchanged from the accepted English source.

Cost note: the verify call adds roughly 30% to per-rewrite token spend. Worth it for accuracy.

### PII and source-text retention

`ai_rewrites.source_text` and `source_url` may contain incidental PII if an LA admin pastes from an internal document. Apply a short retention window (default **30 days**), then either delete or replace with a hash of the original. Platform admins can extend retention per-record for QA purposes via an explicit "preserve" flag.

The Oxfordshire and Leeds demos shipped alongside this brief were generated using this approach against their respective FSM pages — they are the visual target for what an AI-rewrite-driven LA bespoke leaflet should look like.

## Multilingual support

FSM take-up gains are largest among households where English is not the first language. The platform should let LA admins (and platform admins, on the generic template) publish translated variants alongside the English version.

**Shortlist for MVP** — Polish, Urdu, Bengali, Romanian, Somali, Arabic. Each LA can opt into the languages it needs.

**How it works**

- The same AI dialog supports a **Translate** mode: choose a target language, the model translates the accepted English section while preserving the FACTS block.
- Translated sections live as additional rows on `customizations` keyed by `(customization_id, language)`.
- The public landing page for an LA shows a language switcher with whatever variants are published.
- Right-to-left languages (Arabic, Urdu) need the leaflet template to apply `dir="rtl"` to the body content area; CSS already supports this via logical properties — confirm before build.

Out of scope for v1: machine translation of UI chrome (admin pages remain English-only).

## Template versioning and policy drift

FSM policy is not static. v11 already encodes auto-enrolment status and the 1-June claim window. If those change, every published customization risks becoming wrong overnight.

- `templates` carries an integer `version`. Bumping the version is an explicit platform-admin action (with a required changelog note: "what changed and why").
- `customizations` records `template_version_at_publish`.
- When a school/LA admin opens a customization where their pinned version is behind the template's current version, surface a **"Template updated since you published — review changes"** banner with the template changelog and a one-click "adopt latest" path (re-runs any field-name migrations and shows a diff preview).
- The public render always uses the version pinned to the customization until the admin explicitly adopts the new one. This prevents silent drift.

## Accessibility

Public-facing council services in England are bound by PSBAR 2018 (WCAG 2.1 AA). Treat that as the floor.

- **Site**: WCAG 2.1 AA for the public landing, the customize flows, and the admin areas.
- **Brand colour contrast**: when a platform admin adds or edits an LA in the client list (CSV or manual), run a contrast check between `default_brand_colour`, `default_accent_colour`, and the white/black backgrounds the leaflet places them against. Reject (or warn loudly) if below WCAG AA for text use.
- **Printed leaflet**: PDF export tagged for screen readers (logical reading order, alt text on icons), not just rasterised. Playwright's PDF output supports this with the right HTML semantics.
- **QR code**: minimum 25 mm at print size, plus a printed short-URL fallback so users without a working camera can still reach the landing page.

## Print specifications

Playwright's PDF output is RGB and lacks bleed/crop marks — fine for office printers, not for professional print runs. Some LAs will want pro-printed leaflets.

**MVP**: ship the RGB PDF, document the limitation in the admin UI.

**Post-MVP option**: a "professional print pack" generator that exports CMYK with 3 mm bleed and crop marks (via `weasyprint` with a custom CSS print stylesheet, or Ghostscript post-processing of the Playwright output). Flag as a follow-on.

## Email deliverability

Magic links go to `*.gov.uk` and various school domains, which run aggressive spam filtering. The transactional email path must be solid from day one.

- **Provider**: Postmark or AWS SES (warmed sending domain). Avoid SMTP from the app server.
- **Auth**: SPF, DKIM, and DMARC (`p=reject` once warm) on the sending domain.
- **From-address**: a real, monitored mailbox at the sending domain — not `noreply@`.
- **Bounce handling**: parse bounces, surface to platform admins; on a hard bounce, mark the magic link unusable and prompt the user to re-enter.

## Data protection and GDPR

The platform processes personal data (admin email addresses) and may incidentally process more via pasted source text. Before launch:

- **Lawful basis** for storing school/LA admin emails: legitimate interest (publishing a leaflet they requested). Documented in the privacy notice.
- **Retention policy** — defaults:
  - `magic_links`: delete after `used_at` or expiry, whichever first.
  - `ai_rewrites.source_text`/`source_url`: 30 days (as above).
  - `customizations`: indefinite (until owner deletes).
  - Server access logs: 90 days.
- **DPIA** drafted before processing any non-Lambeth LA's data — light-touch, two pages, but on file.
- **DSAR route**: documented at `/privacy`. Admin emails are the main personal data point.
- **Data processor agreement** with Anthropic (for the AI re-write API) on file; confirm Anthropic processes UK/EU data appropriately.
- **Cookie banner**: only if non-essential cookies (e.g. analytics) are used. Prefer a privacy-friendly analytics tool (Plausible / Fathom / GoatCounter) that doesn't require consent.

## Operations and reliability

- **GIAS refresh failure**: monthly cron alerts platform admins (email + in-app banner) on failure or stale data >35 days. Schools data remains usable from the prior snapshot.
- **Backups**: nightly DB snapshot retained 30 days. Restore drill documented (one tested restore before launch).
- **Error tracking**: Sentry (or equivalent) on the server.
- **Health endpoint**: `/healthz` returning 200 + JSON status (DB reachable, last GIAS refresh, queue depth).
- **Observability for AI calls**: log per-LA token usage and cost daily; alert if a single LA exceeds a configured monthly cap.

## QR code on the leaflet

- Every rendered leaflet (NAWRA generic, school-customized, or LA-bespoke) carries a small QR code in the admin/footer area of the editor view (omitted from the printable output unless explicitly enabled).
- The QR encodes the public landing-page URL (e.g. `https://nawra.org.uk/fsm-leaflet`).
- Server-side generation, error-correction level **M**, ≥4-module quiet zone, ≥25 mm printed size, **short-URL fallback printed below the QR**.
- For LA-bespoke versions, the QR may deep-link to a pre-filled customize page for that LA (`/customize?la={slug}`).

## Public landing page

`/` (and `/customize` as alias). Public, no auth. Must:

- Explain the platform in plain language.
- Offer three CTAs, depending on user type:
  - **"I'm a school"** → school search flow (GIAS).
  - **"I'm a local authority"** → LA-client dropdown.
  - **"I just want the generic PDF"** → instant download.
- Be set to `noindex` for unpublished/draft URLs; allow indexing of published public renders.

## Data source for schools

DfE "Get Information about Schools" (GIAS), free, monthly refresh. See <https://get-information-schools.service.gov.uk/Downloads>. Fields used: `URN`, `EstablishmentName`, `Postcode`, `Street`, `Town`, `TelephoneNum`, `SchoolWebsite`, `SchoolEmail`, `PhaseOfEducation`, `LA`, `Status`. Filter to England, state-funded, status `Open`.

A refresh failure must alert platform admins (see "Operations and reliability") and must not touch existing `customizations`.

## Data model (suggested)

**`platform_admins`** — `id`, `email`, `password_hash`, `created_at`, `last_login_at`.

**`templates`** — `id`, `slug` (e.g. `nawra`, `entitledto-la`, `housing-association`), `name`, `description`, `audience` (`school`/`la`/`housing-association`), `body_html`, `default_palette_json`, `facts_json` (the immutable eligibility/date facts used for AI fact-pinning), `version`, `changelog`, `status` (`draft`/`published`), `created_by`, `created_at`, `updated_at`.

**`la_clients`** — `slug`, `name`, `calculator_subdomain`, `default_brand_colour`, `default_accent_colour`, `logo_url` (nullable), `default_source_url`, `enabled_languages` (array), `notes`. Maintained by platform admins.

**`schools`** (seeded from GIAS, refreshed monthly) — `urn`, `name`, `postcode`, `street`, `town`, `phone`, `website`, `email`, `phase`, `la`, `status`, `last_refreshed_at`.

**`trust_domain_allowlist`** — `domain`, `approved_by`, `approved_at`, `notes`. For academy-trust domains approved out-of-band by platform admins.

**`customizations`** — `id`, `template_id`, `template_version_at_publish`, `school_urn` (nullable), `la_slug` (nullable), `overrides_json`, `public_slug`, `published_at`, `updated_at`. (Note: `edit_token` removed in favour of magic-link-issuing edit URL — see "Edit-URL auth model".)

**`customization_translations`** — `customization_id`, `language` (ISO code), `overrides_json`, `updated_at`. One row per language variant.

**`ai_rewrites`** — `id`, `customization_id`, `section_key`, `mode` (`rewrite`/`translate`), `target_language` (nullable), `source_url`, `source_text`, `prompt`, `model`, `output`, `warnings_json` (structured list of fact-check contradictions surfaced by the verify pass, or `null` if none), `accepted`, `accepted_with_warnings` (boolean), `created_at`, `purge_after`. For audit + cost tracking; `purge_after` defaults to created_at + 30 days unless flagged.

**`magic_links`** — `token` (hashed), `email`, `customization_id` *or* `(template_audience, target_id)`, `expires_at`, `used_at`.

## Stack suggestion (open to alternatives)

- **Backend:** Node.js + Express, or Python + FastAPI.
- **DB:** SQLite for MVP, Postgres post-launch.
- **Frontend:** Server-rendered HTML with htmx for interactivity *or* React/Next.js if the editor warrants it. Reuse the v11 template's CSS untouched.
- **PNG/PDF export:** Playwright (headless Chromium).
- **QR generation:** `qrcode` library, server-side, inline data-URI in HTML.
- **AI re-write:** Anthropic API, Claude Sonnet, small max-tokens. Server-side only.
- **Email:** Postmark or AWS SES.
- **Hosting:** Cloudflare Pages / Vercel / Railway. Workers / serverless functions fine, provided cold-start latency stays under 1 s for the landing page.
- **Error tracking:** Sentry.
- **Analytics:** Plausible / Fathom / GoatCounter (cookieless).

## Authentication implementation notes

- **Magic links:** single-use, 15-min expiry, hashed at rest. Domain check enforced per "School auth domain check" above (GIAS-derived match, plus trust-domain allowlist). LA `*.gov.uk` check stays as a soft warning.
- **Platform admin password:** bcrypt, 12 rounds minimum. Account lockout after 5 failed attempts. No public registration — admins added via env var or CLI.
- **No session sharing across tiers** — a school admin can't access LA admin features and vice versa.
- **Edit URL** triggers a fresh magic-link cycle to the original verified email — possession of the URL alone does not grant edit access.

## Out of scope for MVP

- Multiple users per school / LA
- SSO
- Detailed analytics beyond a download counter
- Custom logo upload (use brand colour + LA name text-block; logo upload comes later)
- Real-time collaborative editing
- Versioning / undo history within a customization (only "last write wins", but template versioning is in scope)
- Non-England schools/LAs — **explicit**: no Scotland / Wales / Northern Ireland in v1 despite differing FSM rules
- Paid tiers
- Professional-print CMYK output with bleed and crop marks (RGB PDF only)
- Translated admin UI (the leaflet is translatable; the admin pages are English-only)

## First milestone — buildable in roughly two passes

**Pass A (foundation, no auth):**

1. Public landing page with three CTAs and generic-PDF download.
2. Template seeding (NAWRA + entitledto-LA as DB rows with `version=1` and `facts_json`; housing-association as a stub).
3. School search → GIAS pre-fill → save → public URL renders v11 NAWRA template with overrides.
4. LA dropdown → LA pre-fill (seeded with Lambeth only) → save → public URL renders entitledto-LA template.
5. QR codes generated at render time pointing to landing URL, with printed short-URL fallback.
6. Brand-colour contrast check on LA-client upload.

**Pass B (auth + AI + safety):**

7. Platform-admin password login + template CRUD + template version bumps + LA client list CSV upload.
8. Magic-link auth for school and LA admins, with GIAS-derived school domain check and trust-domain allowlist flow.
9. AI re-write dialog wired to Claude API, with URL-fetch safety controls, generate-then-verify two-pass pipeline, and the warning-surfacing UI. Oxfordshire and Leeds added as LA clients via the CSV upload to validate the loop.
10. Translation mode in the same dialog. Polish + Urdu enabled for the seed LA as a smoke test.
11. PNG and PDF export of customized leaflets (RGB).
12. Transactional email via Postmark/SES with SPF/DKIM/DMARC live.
13. Sentry, `/healthz`, nightly DB backup.

## Acceptance criteria for MVP

1. **Landing page** offers all three CTAs and the generic PDF downloads in <3 s.
2. **School customization** path matches the v11 NAWRA render (visual diff) when fields are populated.
3. **School auth** succeeds for a school whose GIAS `SchoolEmail` is at `*.org.uk` (academy-trust scenario), via the trust-domain allowlist flow, not just `*.sch.uk`.
4. **LA customization** path produces output matching the Lambeth bespoke render when "Lambeth" is selected and the seeded content is accepted.
5. **AI re-write** for a section, given the Oxfordshire URL, produces parent-friendly copy that an LA admin can accept and publish — the resulting render visually matches the Oxfordshire bespoke demo within tolerance (content close, not character-identical). The fact-check warning system fires correctly when given a deliberately contradictory source (e.g. an article quoting a wrong deadline) — the warning surfaces above the suggestion before the LA admin clicks Accept.
6. **Translation**: a Polish translation of an accepted English section is generated and renders correctly on the public URL.
7. **Platform admin** can upload a CSV adding a third LA (e.g. Leeds) and that LA appears in the LA dropdown within one minute.
8. **GIAS refresh** updates `schools` without touching `customizations`; a refresh failure alerts platform admins.
9. **Template version bump** on a published template surfaces the "Template updated — review changes" prompt to the customization owner on next login, with a working diff preview and adopt path.
10. **QR codes** encode the correct landing URL and scan reliably at print size; printed short-URL fallback is visible.
11. **All three auth tiers** are enforced — no cross-tier privilege escalation.
12. **Brand-colour contrast** check rejects a deliberately failing colour pair on CSV upload with a clear error.
13. **WCAG 2.1 AA** automated checks (axe-core) pass on the landing page, the customize flow, and the rendered leaflet HTML.

## Reference files (attached alongside this brief)

| File | What it shows |
|---|---|
| `FSM_leaflet_v11.html` / `.png` | The NAWRA generic template, school-customizable footer, with the **v11 text changes** (auto-enrolment note in Box 1; 1-June claim window in Box 2). |
| `FSM_leaflet_v11_entitledto_generic.png` | The entitledto-branded generic version (no LA chosen yet). Shows what the entitledto template looks like before LA-specific customization — entitledto colour palette, "Powered by entitledto" credit alongside the NAWRA attribution, calculator link pointing to `entitledto.co.uk` rather than an LA subdomain. Visual reference for what LA admins see as their starting point. |
| `FSM_leaflet_v11_oxfordshire_bespoke.png` | LA-bespoke render, content derived from the actual Oxfordshire FSM page (`schools.oxfordshire.gov.uk/.../free-school-meal-eligibility-and-checking-processes`). Demonstrates the AI re-write output target for an LA whose page emphasises auto-enrolment exploration and end-of-summer-term applications. |
| `FSM_leaflet_v11_lambeth_bespoke.png` | LA-bespoke render, content based on Lambeth's pioneering role in FSM auto-enrolment (LIFT platform, ~1,500 children auto-enrolled across Lambeth/Lewisham/Wandsworth). Suggested as the **seed LA** for the MVP. |
| `FSM_leaflet_v11_leeds_bespoke.png` | LA-bespoke render, content derived from Leeds' March 2026 schools guidance. Demonstrates the same flow applied to a third LA with very recent published material — proves the AI-rewrite approach generalises. |

## Attribution

Template by NAWRA (nawra.org.uk), licensed CC BY 4.0. Every rendered leaflet must retain the NAWRA credit strip and licence badge. LA-bespoke versions add a "Powered by entitledto.co.uk" credit alongside.

---

## Launch plan

### Approach

A dedicated subdomain (`leaflets.entitledto.co.uk`) was the original plan but is overkill for v1's audience (small initial circulation, a single user to start). Instead:

- The platform runs on a free-tier hosting URL (e.g. `fsm-leaflet.vercel.app`).
- Magic-link emails send from `fsm-leaflet@entitledto.co.uk` using entitledto's existing SPF/DKIM/DMARC setup — no new DNS work.
- The **public launch** happens via a blog post on the entitledto site, announcing the tool to existing clients and partners (NAWRA, LAs already using the calculator, benefits advisors). The blog post becomes the canonical "what is this and where do I go" page until traffic warrants a dedicated marketing page.

### Soft-launch sequence

1. **Build complete (Pass A + Pass B).**
2. **Internal smoke test** with the single initial LA (Lambeth) — Phil walks through the LA admin journey end-to-end, publishes one bespoke leaflet, scans the QR code, downloads the PDF.
3. **Publish the blog post** (draft below).
4. **Direct email to existing LA clients** with a personal note from Phil and a link to the blog. ~5–10 recipients for the first wave.
5. **Send to NAWRA contact** for inclusion in the next NAWRA newsletter / member email.
6. **Cross-post on LinkedIn** from Phil's account and entitledto's company page.
7. **Wait a week**, gather any feedback, then a second wave: broader LA list, advisor mailing lists, social.

### Draft blog post

Phil will publish this himself; below is a starting draft to edit. Keep the entitledto site's existing tone and house style.

---

**Title (pick one)**

- "A new tool to help families claim the free school meals they're entitled to"
- "Free school meals are changing — and we've built something to help"
- "Helping schools and councils reach the families missing out on free school meals"

**Body**

Free school meals (FSM) eligibility is expanding. Under the changes coming in from the autumn term, more children in low-income families will qualify than ever before. But historically a significant share of eligible families have missed out — usually because they didn't know they qualified, or didn't know how to apply.

To help schools and councils close that gap, we've worked with NAWRA — the National Association of Welfare Rights Advisors — to build a simple tool that publishes a clear, parent-friendly FSM information leaflet, tailored to your school or your local authority.

**Three ways to use it**

- **For schools.** Search for your school in the DfE's national register, add your contact details, and download a print-ready leaflet branded for your school. Takes under five minutes. No design skills required.

- **For local authorities.** Pick your LA, customise the messaging to reflect your local FSM application route, and publish a bespoke version that links to your LA-specific entitledto calculator. You can also use built-in AI to adapt your existing FSM web copy into a parent-friendly leaflet — with an accuracy check that flags any wording that contradicts the official guidance before you publish.

- **For everyone else.** Anyone — an advisor, a school office, a parent — can download a generic version without signing up.

Every leaflet uses the NAWRA template as its base, licensed under Creative Commons. LA versions carry an entitledto credit alongside the NAWRA attribution. Translated versions in Polish, Urdu, Bengali, Romanian, Somali and Arabic will be available alongside the English text.

**Why this matters**

The expanded eligibility means more eligible children, but unless schools and councils have the right communications tools, the take-up gap will widen rather than close. A well-targeted leaflet — personalised, local, in the family's own language where helpful — is one of the simplest and most effective ways to drive take-up.

**Try it**

[Link to the platform — fill in the actual URL once deployed, e.g. `https://fsm-leaflet.vercel.app`.]

If you're a council and would like to discuss a bespoke version for your area, get in touch at [contact email].

---

*Built by entitledto with the National Association of Welfare Rights Advisors. AI re-write powered by Claude (Anthropic).*

### Publishing instructions for Phil

1. **Where to publish.** Add this as a blog post on the entitledto website (whatever the existing blog/news section is — likely `entitledto.co.uk/blog` or similar). Keep the URL of the post short and memorable; you'll be linking to it from elsewhere.
2. **Image at the top.** Use the entitledto-branded leaflet PNG (`FSM_leaflet_v11_entitledto_generic.png`) as the hero image. It's both attractive and informative — readers see exactly what the tool produces.
3. **Cross-post on LinkedIn.** Copy the lede + the "Three ways to use it" section into a LinkedIn post from your account and from the entitledto company page. Link back to the blog post for the full piece. Tag NAWRA. Anthropic also worth tagging given the AI angle.
4. **Direct email to LA clients.** Pull the list of LAs currently using the entitledto calculator. Send a short personal note to each contact — one or two sentences plus the blog link. Don't blast; the value is in it landing as a personal recommendation.
5. **NAWRA newsletter.** Send the blog link to your NAWRA contact and offer a 50-word version they can drop into the next member email.
6. **Hold back the broader push** for a week. Wait until Lambeth has actually used it and published one real leaflet. That gives you a concrete example to point to in the second wave ("Lambeth has just used this to publish their bespoke leaflet — here's what it looks like") which lands much harder than "we've built a thing".
7. **Track**: ask the developer to wire up the cookieless analytics (Plausible/Fathom — see Stack suggestion) so you can see referral sources from the blog vs LinkedIn vs direct.

## Open questions and choices

Decisions needed before build kicks off — grouped so they can be worked through in one short session.

### Stack and hosting

1. **Backend**: Node.js + Express. **DECIDED.**
2. **Hosting target**: deferred — small-circulation MVP, pick at deploy time.
3. **Database**: confirm SQLite for MVP → Postgres post-launch. Or jump straight to Postgres?
4. **Frontend**: React. **DECIDED.** (Next.js a reasonable default within that; the developer can pick CRA / Vite / Next based on their preference.)

### URLs and branding

5. **Canonical landing page URL** — baked into every QR at render time. `nawra.org.uk/fsm-leaflet`? Or an entitledto-owned domain? Needs DNS confirmation before any QR is printed in anger.
6. **Public slug format** for `customizations.public_slug`. Suggest `{la-slug}-{school-slug}-{4char}` for readability + uniqueness — confirm or counter.

### AI re-write

7. **Model**: Claude Sonnet. **DECIDED.**
8. **Per-LA rate limit**: suggest 20 re-write or translate calls per LA per day, with a platform-admin override.
9. **Which sections are AI-rewriteable vs fixed?** **DECIDED: all sections rewriteable.** Accuracy enforced by the fact-check warning system, not by locking sections.
10. **`facts_json` content** for the v11 template — what factual claims should the verify pass check against? Draft proposal: eligibility income threshold, auto-enrolment status statement, 1-June claim window, application route. Sign off before build. (No longer about "immutable" — these are the facts the warning system uses to detect contradictions.)

### Auth and trust domains

11. **Initial trust-domain allowlist** — any trust domains we know in advance to seed (e.g. via Lambeth-area academies)?
12. **Edit-URL model**: confirm magic-link-issuing edit URL (recommended) vs persistent bearer token in URL.

### Multilingual

13. **MVP language shortlist** — confirm Polish, Urdu, Bengali, Romanian, Somali, Arabic. Drop or add?
14. **Translation review** — should LA admins be able to publish translated variants without anyone reviewing them, given the AI is doing the translation? Suggest: yes for MVP, with a "this translation was AI-generated" footnote on the public render.

### Templates

15. **Housing-association template** — build in MVP or stub for later? Brief currently says stub; confirm.
16. **Template versioning policy** — who can bump a version (any platform admin? two-person review?). Suggest: any platform admin, with mandatory changelog note.

### Email and deliverability

17. **Transactional email provider**: Postmark, AWS SES, or other?
18. **Sending domain**: existing `entitledto.co.uk`, reusing the in-place SPF/DKIM/DMARC. Send from `fsm-leaflet@entitledto.co.uk` or similar. **DECIDED.** No new DNS work needed.

### Data protection

19. **DPO / data-protection contact** for the privacy notice — entitledto's existing DPO, or NAWRA's?
20. **Data processor agreement with Anthropic** — confirm in place (or kick off the request).
21. **Confirm 30-day retention** for `ai_rewrites` source text/URL. Shorter, longer, or as proposed?

### Out-of-scope confirmation

22. Confirm devolved nations (Scotland, Wales, NI) are explicitly out of scope for v1 despite differing FSM rules.
23. Confirm pro-print CMYK output is out of scope for v1 (RGB PDF only).

---

*This brief was generated alongside the v11 leaflet and the three LA demos. Treat the v11 HTML as the canonical structural template — keep markup and CSS untouched, just inject footer fields, body overrides, palette colours, the QR code, and the credit strip at render time.*
