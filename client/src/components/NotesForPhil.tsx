/* Dev-mode panel surfacing what's done, what's blocking, and what needs Phil's
 * input. Shown unconditionally for now — once the platform goes near a public
 * environment, gate this on `import.meta.env.DEV` so it disappears in prod. */

type Item = { title: string; body: string };

const WORKING: Item[] = [
  {
    title: '🆕 AI re-write with fact-check warning',
    body: 'On /customize/la, each editable section now has "✨ Re-write with AI" and "🌐 Translate" buttons. The dialog shows current text on the left, source-URL input + result on the right. Two-pass pipeline: generate → verify against facts_json. Contradicted phrases highlighted in coral with rationale; you can still Accept (recorded as accepted_with_warnings). Needs ANTHROPIC_API_KEY in Render env vars to actually fire — without it the call errors with a clear message.',
  },
  {
    title: '🆕 One-click leaflet download',
    body: 'Click the entitledto leaflet preview on the landing page → opens /view/entitledto-la in a new tab with a sticky coral "Download PDF" button at the top. Same wrapper works for any template (/view/nawra, /view/housing-association).',
  },
  {
    title: 'LA dropdown populated from your sites CSV (149 LAs)',
    body: 'Run-once import via `npm run la:import-sites -w server -- --file=...`. Lambeth\'s original branding (magenta accent, multilingual setup, Lambeth-specific notes) preserved across the upsert. Open /customize/la to see the dropdown.',
  },
  {
    title: 'Platform-admin area — /admin (UNGATED for demo)',
    body: 'Password protection disabled per request. Three tabs: Templates (edit metadata + version-bump with required changelog), LA clients (filter, edit, +Add, CSV upload with WCAG AA contrast check), Trust domains (review pending requests + revoke approved entries). The bcrypt+lockout login is still wired underneath — flip two lines to turn it back on (see "Before deploy" below).',
  },
  {
    title: 'School flow (3 demo schools seeded)',
    body: '"For schools" → search Sudbourne / Bonneville / St Helen\'s → fill the four footer fields → magic-link verify → publish. The full ~25k GIAS list lands here once Phil downloads the CSV (see "One-off setup").',
  },
  {
    title: 'LA-bespoke flow with magic-link auth',
    body: '"For local authorities" → pick any LA → edit body sections → enter a *.gov.uk email → magic link → publish. The link-sent screen shows a one-click "Open magic link" button in dev mode.',
  },
  {
    title: '"Edit URL" with magic-link-issuing route',
    body: 'After publish you get an /edit/{slug} URL. Possessing the URL alone doesn\'t grant edit access — it asks you to verify via magic link to the original email. Re-edits update the same public URL.',
  },
  {
    title: 'Trust-domain allowlist request flow',
    body: 'School flow: if the email domain doesn\'t match the school\'s GIAS record (academy trust scenario), a one-click "request approval" flow routes to platform admins. The Trust domains tab in /admin lets you approve or reject and shows the current allowlist.',
  },
  {
    title: 'PDF export',
    body: '/generic/nawra?format=pdf and /c/{slug}.pdf both render via headless Chromium. ~65 KB A4 outputs.',
  },
];

const NEEDS_INPUT: Item[] = [
  {
    title: 'LA dropdown: many non-England councils included',
    body: 'The sites CSV has 149 LAs including Scotland/Wales/NI (Aberdeen, Angus, South Ayrshire, etc). Brief says v1 is England-only. Decide: filter the dropdown to England in the customize/la flow, or delete the others from the admin LA-clients tab? Recommend the former since the calculator clients are legit.',
  },
  {
    title: 'LA brand colours: 148 of 149 are placeholders',
    body: 'Only Lambeth has real branding. All others got the entitledto teal as a default. Admin LA-clients tab now lets you edit colours one-by-one. Worth a batch pass for the top ~10 LAs you actually expect to use.',
  },
  {
    title: 'v11 HTML reconstructed from PNG — sanity-check it',
    body: 'Open /generic/nawra?preview=1 and compare against reference/FSM_leaflet_for_parents_and_carers_v11.png. Tell me what to nudge (sizes, colours, spacing).',
  },
  {
    title: 'Entitledto-generic PNG still missing',
    body: 'README handoff notes flag this. Easiest path: open FSM_leaflet_for_parents_and_carers_v11.pptx, swap NAWRA branding for entitledto, add "Powered by entitledto" credit, export PNG, drop it in /reference.',
  },
  {
    title: 'Canonical landing URL for QR codes',
    body: 'Currently QR codes encode http://localhost:4000. Set PUBLIC_BASE_URL in .env before any leaflet is printed.',
  },
];

const SETUP: Item[] = [
  {
    title: '🔑 Set ANTHROPIC_API_KEY on Render to enable AI re-write',
    body: 'In Render dashboard → fsm-leaflet → Environment → Add Environment Variable → ANTHROPIC_API_KEY = sk-ant-... The key is read server-side only, never exposed to the client. Once set, the Re-write / Translate buttons on the LA flow start working.',
  },
  {
    title: 'GIAS bulk-CSV — manual download workaround',
    body: 'The unauthenticated bulk endpoints I tried all return HTTP 500/404. Workaround: visit https://get-information-schools.service.gov.uk/Downloads → tick "Establishment fields" → CSV → Download, then: npm run gias:import -w server -- --file="C:\\path\\to\\edubasealldata.csv". 3 demo schools cover the flow until then.',
  },
  {
    title: 'Transactional email (Postmark or SES)',
    body: 'Currently magic links print to the server console AND the link-sent screens show a "Dev mode shortcut" button. Set EMAIL_PROVIDER=postmark|ses in .env to wire real send (branch in server/src/auth/email.ts).',
  },
];

const PASS_B_REMAINING: Item[] = [
  { title: '🔒 Re-enable admin password before sharing widely', body: 'The /admin area is currently ungated (yellow banner on every admin page makes this obvious). When ready, uncomment 2 lines — see admin.ts and AdminDashboard.tsx.' },
  { title: 'Filter LA dropdown to England-only', body: 'The 149 imported LAs include Scotland (Aberdeen, Angus, South Ayrshire) and others. Brief says v1 is England-only. Either delete via /admin/la-clients or add a region tag + filter.' },
  { title: 'Template versioning UI on customize/edit flows', body: 'Schema records template_version_at_publish; need to surface the "Template updated — review changes" banner with a diff/adopt path. Admin can already bump versions in /admin/templates.' },
  { title: 'Rich-text body editor in the admin Templates tab', body: 'Currently you edit default_palette JSON directly. A WYSIWYG for the "content" sub-object would be cleaner.' },
  { title: 'Translation publishing in the public render', body: 'AI translation is wired (the dialog produces translated text), but customization_translations rows + a language switcher on the public landing page aren\'t built yet.' },
  { title: 'Ops: Sentry, nightly backup, AI cost dashboard', body: 'Per-LA AI cost tracking data is captured (input_tokens, output_tokens on ai_rewrites); just needs a dashboard view. Plus Render-native logs are fine for now but Sentry would catch errors more reliably.' },
];

function Section({ title, items, tone }: { title: string; items: Item[]; tone: 'good' | 'warn' | 'setup' | 'todo' }) {
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

export function NotesForPhil() {
  return (
    <aside className="notes-wrap" aria-label="Notes for Phil">
      <header>
        <span className="notes__chip">Dev panel</span>
        <h2>Notes for Phil — what's done, what's next</h2>
        <p className="muted">
          This panel is dev-only. Pass A complete (foundation + render). Pass B:
          magic-link auth + platform-admin UI + sites-CSV import done. AI re-write up next.
        </p>
      </header>

      <Section title="Working now" items={WORKING} tone="good" />
      <Section title="Needs your input / decision" items={NEEDS_INPUT} tone="warn" />
      <Section title="One-off setup still to run" items={SETUP} tone="setup" />
      <Section title="Pass B remaining" items={PASS_B_REMAINING} tone="todo" />
    </aside>
  );
}
