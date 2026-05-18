/* Dev-mode panel surfacing what's done, what's blocking, and what needs Phil's
 * input. Lives at /admin/dev-notes. */

type Item = { title: string; body: string };

// ---------------------------------------------------------------------------

const WORKING: Item[] = [
  {
    title: 'Public landing + entitledto branding',
    body: 'entitledto wordmark in the header, clickable leaflet preview opens /view/entitledto-la with a coral Download PDF button. Three CTAs: Download the entitledto edition (default), Bespoke for my LA, Customised for my school. Tagline "independent | accurate | reliable" under the hero.',
  },
  {
    title: 'School flow — search, edit, publish (no auth)',
    body: '/customize/school: type a name or postcode → pick from real DfE-registered schools → fill four footer fields (telephone, email is optional, website, school name) plus the two "How to claim" steps (step 1 auto-links to the school website). Click Publish — done. School search hits the GIAS data auto-imported on first boot (~25k state-funded England schools).',
  },
  {
    title: 'LA flow — inline pen editing, no auth',
    body: '/customize/la: top banner makes clear this is for entitledto LA customers only, with links to the schools flow and the generic download for others. Pick an LA → optionally toggle "Show LA logo on the leaflet" (defaults off, disabled if the LA has no logo on file). Live preview iframe shows the leaflet immediately. Hover any text section → click the blue ✏️ pen → edit in a modal → Save updates the preview. AI re-write and translate buttons are not wired into this flow.',
  },
  {
    title: 'Re-edit anytime via /edit/{slug}',
    body: 'After publishing, you get a permanent edit URL. Anyone with the URL can re-open the editor — no email verification. Big View / Download PDF buttons at the top of the edit screen.',
  },
  {
    title: 'Three demo customisations',
    body: '/c/lambeth-demo, /c/leeds-demo, /c/oxfordshire-demo are pre-published reference leaflets. Lambeth and Oxfordshire have their council logos and FSM URLs woven into the body and contact details. Visible on the landing page CTAs and from the Examples panel on /admin/la-clients.',
  },
  {
    title: 'Admin area, password-protected',
    body: '/admin/login takes the password (ADMIN_PASSWORD env var on Render, default "3ntitledto"). Five tabs: Templates (edit metadata + version bump with required changelog), LA clients (149 LAs, examples panel, edit + CSV upload with WCAG AA contrast check), Trust domains, Customizations (every published leaflet), AI usage (currently empty — see Dormant below). Plus this Dev notes tab.',
  },
  {
    title: 'England-only LA filter',
    body: 'Public /api/la-clients defaults to ?region=england. The boot-time region tagger marks the ~30 known non-England councils from the sites CSV. Admin sees all 149.',
  },
  {
    title: 'PDF export with screen-vs-print separation',
    body: 'Click Download PDF anywhere → fetch+blob with visible "Generating PDF…" progress. The PDF strips the on-screen-only chrome (no "PRINT-READY · A4" badge, no footer credit strip), so it\'s ready to print as-is. ~65–80 KB A4 outputs.',
  },
  {
    title: 'Template versioning banner',
    body: 'Bump a template version in /admin/templates with a mandatory ≥10-char changelog. On next visit to /edit/{slug} the owner sees a blue "Template updated since you published" banner with an Adopt button. Adopting bumps template_version_at_publish; pinned overrides are preserved.',
  },
  {
    title: 'Sentry + hourly maintenance cron',
    body: 'Sentry no-op until SENTRY_DSN env set. Hourly job clears expired sessions, stale magic_links, and source PII on ai_rewrites past 30 days.',
  },
  {
    title: '🌐 Other languages dropdown on the public leaflet',
    body: 'A "🌐 Other languages" pill appears top-right of /c/{slug} when at least one translation row exists for the template. Dropdown lists English plus all 10 target languages with their native + English names. Clicking sets ?lang=xx; the renderer overlays the template translation as a base layer under any English customisation overrides under any per-customisation translation. Right-to-left (Urdu) gets dir="rtl" automatically. Hidden in print so PDFs stay clean.',
  },
];

// ---------------------------------------------------------------------------

const NEEDS_INPUT: Item[] = [
  {
    title: '⚠️ Translations are AI-generated — native-speaker review required',
    body: 'All 10 language files at server/data/translations/ have first-pass translations I produced from English. European languages (Polish, Romanian, Spanish, Italian, Portuguese, Welsh) are reasonable starting points but should still be eyeballed. Urdu, Punjabi, Bengali, Gujarati: my proficiency is meaningfully lower — accuracy is not guaranteed, errors in eligibility wording or grammar are likely. Native review essential before any leaflet is printed and distributed. Edit the JSON files in the repo (or via GitHub web editor) and redeploy.',
  },
  {
    title: 'LA brand colours — 146 of 149 are still placeholder navy',
    body: 'Lambeth, Leeds and Oxfordshire have real brand palettes. Every other LA imported from your sites CSV is on the default entitledto teal. Use /admin/la-clients to colour-correct the top ~10 you actually expect to use, or paste a CSV with brand columns to bulk-update.',
  },
  {
    title: 'CC BY 4.0 attribution removed from PDF — confirm with NAWRA',
    body: 'Per your call, the "Free to copy, adapt and share · CC BY 4.0" line + the "Powered by entitledto" credit only render on the on-screen leaflet now, not on the downloaded PDF. Strictly the licence wants attribution on every derivative. Worth a quick check with NAWRA before mass-printing.',
  },
  {
    title: 'CSS print fonts on bespoke renders — eyeball the spacing',
    body: 'The leaflet template was sized to fit A4 with the original v11 NAWRA copy. The entitledto-LA template and Lambeth/Oxfordshire bespoke renders use slightly more text in places. PDFs are hard-capped to one page, so worst-case content clips at the bottom rather than spilling. Open /c/lambeth-demo.pdf and /c/oxfordshire-demo.pdf and let me know if anything\'s tight.',
  },
];

// ---------------------------------------------------------------------------

const NEW_TODO: Item[] = [
  {
    title: 'Finish the Lambeth + Oxfordshire (+ Leeds) demo leaflets',
    body: 'The three demo customisations under /admin/la-clients → "See an example" are still rough — Lambeth and Oxfordshire have brand colours, logos and FSM URLs, but the body copy is still mostly the default entitledto wording. Tighten each one so they read like the finished, polished bespoke leaflets a sales conversation can point to. Public LA flow now points prospects at fiona@entitledto.co.uk rather than these demos, so finishing them is internal-sales-tool work, not blocking.',
  },
  {
    title: 'Rich-text body editor on /admin/templates',
    body: 'Right now template default-text edits go through the default_palette JSON blob (textarea). The LA flow already has pen-based section editing; the same component could be reused for template-level defaults.',
  },
  {
    title: 'Off-Render nightly DB backup',
    body: 'render.yaml is now configured for Render Starter ($7/mo) with a 1 GB persistent disk mounted at /data — once that blueprint is applied (or the dashboard flipped to Starter + disk), /data/fsm.db survives deploys and restarts. Still worth adding a nightly off-host backup (WAL snapshot → S3 / R2 / Backblaze) so a single Render-side disk loss can\'t take all customisations with it. Tiny job — sqlite3 .backup once a day plus an upload step.',
  },
];

// ---------------------------------------------------------------------------

const SETUP: Item[] = [
  {
    title: 'Transactional email (Postmark or SES)',
    body: 'Only matters if you re-enable magic-link auth on the school/LA flows. Currently magic links log to the server console + show a dev-shortcut button (but nothing reaches that code path from the UI). Set EMAIL_PROVIDER=postmark|ses in Render env to wire the real send path.',
  },
];

// ---------------------------------------------------------------------------

const DORMANT: Item[] = [
  {
    title: 'AI re-write + translate + fact-check pipeline',
    body: 'Anthropic SDK + generate-then-verify pipeline + SSRF-safe URL fetcher + AIRewriteDialog + /admin/ai-usage tab are all still in the codebase, but no UI calls them. The /admin/ai-usage tab will show empty stats. Reaching the AI endpoints requires manual API calls now. Cheap to leave in place — re-wire by re-adding the buttons in LAFlow.tsx if you change your mind.',
  },
  {
    title: 'Magic-link auth for school + LA + edit flows',
    body: 'Server routes (/api/auth/request, /verify), sessions middleware, magic-link sender stub, magic_links / sessions tables — all still wired. Public flows stopped calling them per your "no fraud or anything to worry about" call. To turn back on: re-add the verify-ownership steps in SchoolFlow.tsx, LAFlow.tsx, EditFlow.tsx and the requireSession checks on the customisation PATCH endpoints.',
  },
  {
    title: 'Trust-domain allowlist request flow',
    body: '/admin/trust-domains tab still lets you approve domains, but nothing now writes to trust_domain_requests because the school magic-link flow that fed it has been removed.',
  },
  {
    title: 'Translation persistence + language switcher on /c/{slug}',
    body: 'Server-side support for per-language overrides is intact (customization_translations table, PUT /api/customizations/{slug}/translations/{lang}, public ?lang=xx renderer with language switcher bar). Will be reused when the "Other languages" header link lands above.',
  },
];

// ---------------------------------------------------------------------------

function Section({ title, items, tone }: { title: string; items: Item[]; tone: 'good' | 'warn' | 'todo' | 'setup' | 'dormant' }) {
  if (items.length === 0) return null;
  return (
    <section className={`notes notes--${tone}`}>
      <h3>{title}</h3>
      <ul>
        {items.map((i) => (
          <li key={i.title}>
            <strong>{i.title}</strong>
            <p>{i.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NotesForPhil({ hideOuterChrome = false }: { hideOuterChrome?: boolean } = {}) {
  const sections = (
    <>
      <Section title="Working now" items={WORKING} tone="good" />
      <Section title="Needs your input / decision" items={NEEDS_INPUT} tone="warn" />
      <Section title="On the roadmap" items={NEW_TODO} tone="todo" />
      <Section title="Optional setup" items={SETUP} tone="setup" />
      <Section title="Dormant code (in the repo, not wired up)" items={DORMANT} tone="dormant" />
    </>
  );

  if (hideOuterChrome) {
    return <div className="notes-wrap notes-wrap--bare">{sections}</div>;
  }

  return (
    <aside className="notes-wrap" aria-label="Notes for Phil">
      <header>
        <span className="notes__chip">Dev panel</span>
        <h2>Notes for Phil — what's done, what's next</h2>
        <p className="muted">
          Punch-list of what's working, decisions you need to make, and what's still pending.
        </p>
      </header>
      {sections}
    </aside>
  );
}
