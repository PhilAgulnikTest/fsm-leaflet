import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { api, type School } from '../api';

type SaveResult = { public_url: string; edit_url: string; public_slug: string } | null;
type Step = 'search' | 'fill' | 'published';

export function SchoolFlow() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<School[]>([]);
  const [selected, setSelected] = useState<School | null>(null);

  const [schoolName, setSchoolName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [howToStep1, setHowToStep1] = useState('Download the form from your school\'s website');
  const [howToStep2, setHowToStep2] = useState('Or pick up a paper copy from the school office');

  const [step, setStep] = useState<Step>('search');
  const [saveResult, setSaveResult] = useState<SaveResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setStep('fill');
  }

  function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>
    )[c]!);
  }

  function buildHowToStepsHtml(): string {
    // Step 1 wraps the user's text in an <a> pointing at the school website
    // when one is set, so the leaflet's "Download the form..." step links
    // directly to the school's site. Step 2 stays plain text.
    const safe1 = escapeHtml(howToStep1.trim() || 'Download the form from your school\'s website');
    const safe2 = escapeHtml(howToStep2.trim() || 'Or pick up a paper copy from the school office');
    const url = website.trim();
    const isHttpUrl = /^https?:\/\//i.test(url);
    const step1 = isHttpUrl
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${safe1}</a>`
      : safe1;
    return `<li>${step1}</li><li>${safe2}</li>`;
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
          how_to_steps_html: buildHowToStepsHtml(),
        },
      });
      setSaveResult(result);
      setStep('published');
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  if (step === 'published' && saveResult) {
    const fullUrl = window.location.origin + saveResult.public_url;
    return (
      <>
        <Header />
        <main className="page page--narrow">
          <div className="alert alert--success">
            <strong>Your leaflet is ready.</strong>
          </div>

          <div className="published-actions">
            <a className="btn btn--large btn--primary" href={saveResult.public_url} target="_blank" rel="noopener">
              👁 View your leaflet
            </a>
            <a className="btn btn--large btn--accent" href={`${saveResult.public_url}.pdf`} download>
              ⬇ Download PDF
            </a>
          </div>

          <div className="published-share">
            <h3>Share your leaflet</h3>
            <p className="muted">Send this link to staff, share on your website, or print and hand out.</p>
            <div className="copy-row">
              <input readOnly value={fullUrl} onFocus={(e) => e.currentTarget.select()} />
              <button className="btn btn--secondary" onClick={() => navigator.clipboard?.writeText(fullUrl)}>
                Copy link
              </button>
            </div>
          </div>

          <p className="muted" style={{ marginTop: '2rem' }}>
            Need to change the wording or contact details? <a href={saveResult.edit_url}>Edit your leaflet</a>.
          </p>
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
          Search the DfE register for your school, add the four footer fields parents
          will see, and publish — your print-ready leaflet is ready immediately.
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
              <input
                id="school-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourschool.example.uk"
              />
              <small className="muted">
                Used as the link target for "{howToStep1.trim() || 'Download the form…'}" below.
              </small>
            </div>

            <h3 style={{ marginTop: '1.5rem' }}>How to claim — two lines parents see</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              These appear under "HOW TO CLAIM" on the leaflet. Edit the wording to match
              how your school distributes the form.
            </p>

            <div className="form-row">
              <label htmlFor="school-step1">Step 1 — download or online route</label>
              <input
                id="school-step1"
                value={howToStep1}
                onChange={(e) => setHowToStep1(e.target.value)}
                placeholder="Download the form from your school's website"
              />
              <small className="muted">
                {website.trim() && /^https?:\/\//i.test(website.trim())
                  ? <>This text will link to <code>{website.trim()}</code> in the leaflet.</>
                  : <>Add a website URL above to make this text clickable.</>}
              </small>
            </div>

            <div className="form-row">
              <label htmlFor="school-step2">Step 2 — in-person route</label>
              <input
                id="school-step2"
                value={howToStep2}
                onChange={(e) => setHowToStep2(e.target.value)}
                placeholder="Or pick up a paper copy from the school office"
              />
            </div>

            <button className="btn btn--large btn--primary" onClick={publish} disabled={busy}>
              {busy ? 'Publishing…' : 'Publish leaflet'}
            </button>
          </>
        )}
      </main>
    </>
  );
}
