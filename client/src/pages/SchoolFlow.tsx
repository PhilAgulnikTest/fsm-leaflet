import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { api, type School } from '../api';

type SaveResult = { public_url: string; edit_url: string; public_slug: string } | null;
type Step = 'search' | 'fill' | 'request_link' | 'link_sent' | 'allowlist' | 'allowlist_sent' | 'editor' | 'published';

export function SchoolFlow() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<School[]>([]);
  const [selected, setSelected] = useState<School | null>(null);

  const [schoolName, setSchoolName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');

  // Auth state
  const [authEmail, setAuthEmail] = useState('');
  const [verified, setVerified] = useState(false);
  const [expectedDomains, setExpectedDomains] = useState<string[]>([]);
  const [requestableDomain, setRequestableDomain] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('search');
  const [saveResult, setSaveResult] = useState<SaveResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // On mount, check if we're returning from a magic-link verify
  // (the redirect lands here with ?verified=1 and a session cookie).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('verified') === '1') {
      api.me().then((r) => {
        if (r.session?.scope === 'school' && r.session.school_urn) {
          setVerified(true);
          // We don't auto-load the customization here; the user is mid-flow
          // and will publish through the same form they already filled in.
          setStep('editor');
        }
      });
    }
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const handle = setTimeout(async () => {
      try {
        const { results } = await api.searchSchools(query.trim());
        setResults(results);
      } catch (e) {
        setError((e as Error).message);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  function selectSchool(s: School) {
    setSelected(s);
    setResults([]);
    setQuery(s.name);
    setSchoolName(s.name);
    setPhone(s.phone ?? '');
    setEmail(s.email ?? '');
    setWebsite(s.website ?? '');
    setAuthEmail(s.email ?? '');
    setStep('fill');
  }

  async function requestLink() {
    if (!selected) return;
    setError(null);
    setBusy(true);
    try {
      const r = await api.requestMagicLink({ scope: 'school', email: authEmail, school_urn: selected.urn });
      setDevLink(r.dev_link ?? null);
      setStep('link_sent');
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'domain_mismatch') {
        // The server attached expected + requestable_domain on the 403, but our
        // tiny api wrapper drops the body. Re-fetch with the raw fetch to recover.
        try {
          const r = await fetch('/api/auth/request', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ scope: 'school', email: authEmail, school_urn: selected.urn }),
          });
          const body = await r.json();
          setExpectedDomains(body.expected ?? []);
          setRequestableDomain(body.requestable_domain ?? null);
          setStep('allowlist');
        } catch {
          setError(msg);
        }
      } else {
        setError(msg);
      }
    } finally { setBusy(false); }
  }

  async function requestAllowlist() {
    if (!selected || !requestableDomain) return;
    setBusy(true);
    setError(null);
    try {
      await api.requestTrustAllowlist({
        domain: requestableDomain,
        email: authEmail,
        school_urn: selected.urn,
        notes: `Requested via school customize flow for ${selected.name}.`,
      });
      setStep('allowlist_sent');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function publish() {
    if (!selected) return;
    setError(null);
    setBusy(true);
    try {
      const result = await api.createCustomization({
        template_slug: 'nawra',
        school_urn: selected.urn,
        overrides: {
          contact_name: schoolName,
          contact_phone: phone,
          contact_email: email,
          contact_website: website,
        },
      });
      setSaveResult(result);
      setStep('published');
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  // ---------------------------- views ----------------------------

  if (step === 'published' && saveResult) {
    return (
      <>
        <Header />
        <main className="page page--narrow">
          <div className="alert alert--success">
            <strong>Published.</strong> Your leaflet is live.
          </div>
          <p>Public URL: <a href={saveResult.public_url}>{saveResult.public_url}</a></p>
          <p>
            Edit URL (keep this somewhere safe — re-opening it sends a fresh magic link to your email):
            <br /><a href={saveResult.edit_url}>{saveResult.edit_url}</a>
          </p>
          <p><a className="btn" href={saveResult.public_url}>Open your leaflet</a></p>
        </main>
      </>
    );
  }

  if (step === 'link_sent') {
    return (
      <>
        <Header />
        <main className="page page--narrow">
          <h2>Check your inbox</h2>
          <div className="alert alert--success">
            We sent a magic link to <strong>{authEmail}</strong>.
            Open it within 15 minutes. The link returns you to this flow and lets you publish.
          </div>
          {devLink && (
            <div className="alert">
              <strong>Dev mode shortcut.</strong> Email isn't wired up yet, so click below
              to consume the link directly (production users would click it in their email).
              <p style={{ marginTop: '0.5rem' }}>
                <a className="btn" href={devLink}>Open magic link</a>
              </p>
            </div>
          )}
        </main>
      </>
    );
  }

  if (step === 'allowlist_sent') {
    return (
      <>
        <Header />
        <main className="page page--narrow">
          <h2>Request submitted</h2>
          <div className="alert alert--success">
            We've asked a platform admin to approve <strong>{requestableDomain}</strong>.
            Once approved, your magic-link request will work — typically within a working day.
          </div>
        </main>
      </>
    );
  }

  if (step === 'allowlist') {
    return (
      <>
        <Header />
        <main className="page page--narrow">
          <h2>Domain not recognised</h2>
          <p>
            We couldn't match <strong>{authEmail}</strong> against the official
            email/website domain for <strong>{selected?.name}</strong>
            {expectedDomains.length > 0 && (
              <> (we expected one of: {expectedDomains.map((d) => <code key={d}>{d}</code>).reduce((a, b) => <>{a}, {b}</>)})</>
            )}.
          </p>
          <p>
            If <strong>{authEmail}</strong> is genuinely a school email — common for
            academy trusts — you can request that a platform admin approves the domain
            <strong> {requestableDomain}</strong>. Usually takes a working day.
          </p>
          <button className="btn" onClick={requestAllowlist} disabled={busy}>
            Request approval for {requestableDomain}
          </button>
          <button className="btn btn--secondary" onClick={() => setStep('fill')} style={{ marginLeft: '0.5rem' }}>
            Use a different email
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="page page--narrow">
        <h2>Customise the leaflet for your school</h2>
        <p className="muted">
          Search the DfE register for your school, then add the four footer fields
          parents will see. The rest of the leaflet is the NAWRA standard text.
        </p>

        {error && <div className="alert alert--error">Error: {error}</div>}

        <div className="form-row">
          <label htmlFor="school-search">Find your school</label>
          <input
            id="school-search"
            type="text"
            placeholder="Name or postcode (e.g. SE11 5DP)"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); setStep('search'); }}
            autoComplete="off"
          />
        </div>

        {!selected && results.length > 0 && (
          <ul className="school-list" role="listbox">
            {results.map((s) => (
              <li key={s.urn} role="option" onClick={() => selectSchool(s)}>
                <div>{s.name}</div>
                <div className="school-list__meta">
                  {[s.town, s.postcode, s.la].filter(Boolean).join(' · ')}
                </div>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <>
            <div className="alert">
              Selected <strong>{selected.name}</strong> (URN {selected.urn}).
            </div>

            <div className="form-row">
              <label htmlFor="school-name">School name (as shown on the leaflet)</label>
              <input id="school-name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
            </div>
            <div className="form-row">
              <label htmlFor="school-phone">Telephone</label>
              <input id="school-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="form-row">
              <label htmlFor="school-email">Email (shown on the leaflet)</label>
              <input id="school-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="form-row">
              <label htmlFor="school-website">Website</label>
              <input id="school-website" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            {verified ? (
              <button className="btn" onClick={publish} disabled={busy}>
                {busy ? 'Publishing…' : 'Publish leaflet'}
              </button>
            ) : (
              <>
                <h3 style={{ marginTop: '1.5rem' }}>Verify ownership</h3>
                <p className="muted">
                  We'll send a one-time magic link to a school email address.
                  The domain must match the school's GIAS record (or be an
                  approved academy-trust domain).
                </p>
                <div className="form-row">
                  <label htmlFor="auth-email">Your school email</label>
                  <input id="auth-email" type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
                </div>
                <button className="btn" onClick={requestLink} disabled={!authEmail || busy}>
                  {busy ? 'Sending…' : 'Send me a magic link'}
                </button>
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
