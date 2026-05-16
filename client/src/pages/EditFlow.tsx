/* /edit/:slug — the "edit URL" the user receives at publish time.
 *
 * If the user has a valid session scoped to this customization → load
 * overrides into an editor.
 * Otherwise → show a "request magic link" form. The link does NOT auth on its
 * own; possessing it just lets you trigger a fresh magic-link cycle to the
 * verified email. */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { api } from '../api';

type Customization = {
  id: number;
  template_id: number;
  template_version_at_publish: number;
  current_template_version: number;
  template_changelog: string;
  school_urn: string | null;
  la_slug: string | null;
  overrides_json: string;
  public_slug: string;
};

export function EditFlow() {
  const { slug = '' } = useParams();
  const [customization, setCustomization] = useState<Customization | null>(null);
  const [templateDrift, setTemplateDrift] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState('');
  const [requested, setRequested] = useState<{ sent_to: string; warning?: string; dev_link?: string } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function reload() {
    const [meRes, cRes] = await Promise.all([
      api.me(),
      fetch(`/api/customizations/${slug}`).then((r) => r.json()),
    ]);
    const c = cRes.customization as Customization;
    setCustomization(c);
    setTemplateDrift(!!cRes.template_drift);
    setOverrides(JSON.parse(c.overrides_json || '{}'));
    const session = meRes.session;
    if (session && session.customization_id === c.id) setAuthorized(true);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { if (!cancelled) await reload(); }
      catch (e) { if (!cancelled) setError((e as Error).message); }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  async function adoptTemplateVersion() {
    if (!customization) return;
    try {
      const res = await fetch(`/api/customizations/${slug}/adopt-template-version`, { method: 'POST' });
      if (!res.ok) throw new Error('adopt_failed');
      await reload();
    } catch (e) { setError((e as Error).message); }
  }

  async function requestLink() {
    if (!customization) return;
    setError(null);
    try {
      const scope: 'school' | 'la' = customization.la_slug ? 'la' : 'school';
      const result = await api.requestMagicLink({
        scope,
        email,
        customization_id: customization.id,
      });
      setRequested({ sent_to: result.sent_to, warning: result.warning, dev_link: result.dev_link });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save() {
    if (!customization) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateCustomization(customization.public_slug, overrides);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !customization) {
    return (
      <>
        <Header />
        <main className="page page--narrow">
          <div className="alert alert--error">Error loading this leaflet: {error}</div>
        </main>
      </>
    );
  }

  if (!customization) {
    return (
      <>
        <Header />
        <main className="page page--narrow"><p>Loading…</p></main>
      </>
    );
  }

  if (!authorized) {
    return (
      <>
        <Header />
        <main className="page page--narrow">
          <h2>Re-open your leaflet</h2>
          <p className="muted">
            For security, this edit URL doesn't grant access on its own.
            Enter the email you used when you published the leaflet —
            we'll send a one-time magic link that opens the editor.
          </p>

          {requested ? (
            <div className="alert alert--success">
              <strong>Magic link sent.</strong> Check {requested.sent_to} —
              the link expires in 15 minutes.
              {requested.warning && (
                <p style={{ margin: '0.5rem 0 0' }}>
                  <small>{requested.warning}</small>
                </p>
              )}
              {requested.dev_link && (
                <p style={{ margin: '0.5rem 0 0' }}>
                  <a className="btn" href={requested.dev_link}>Open magic link (dev shortcut)</a>
                </p>
              )}
            </div>
          ) : (
            <>
              {error && <div className="alert alert--error">Error: {error}</div>}
              <div className="form-row">
                <label htmlFor="edit-email">Email</label>
                <input
                  id="edit-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={customization.la_slug ? 'you@council.gov.uk' : 'you@school.example'}
                />
              </div>
              <button className="btn" onClick={requestLink} disabled={!email}>
                Send magic link
              </button>
            </>
          )}
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="page page--narrow">
        <h2>Edit your leaflet</h2>
        <p className="muted">
          You're signed in. Changes update the same public URL — no new slug.
        </p>

        {error && <div className="alert alert--error">Error: {error}</div>}
        {saved && (
          <div className="alert alert--success">
            Saved. <a href={`/c/${customization.public_slug}`}>Open the public URL</a>.
          </div>
        )}

        {templateDrift && (
          <div className="alert alert--template-drift">
            <strong>Template updated since you published.</strong>
            <p style={{ margin: '0.4rem 0 0' }}>
              You published against v{customization.template_version_at_publish}. The current template is now v{customization.current_template_version}.
              Your existing wording and branding stay in place; only template-level changes (default copy, palette, facts) move forward.
            </p>
            {customization.template_changelog && (
              <details style={{ marginTop: '0.5rem' }}>
                <summary>What changed</summary>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', margin: '0.4rem 0 0' }}>{customization.template_changelog}</pre>
              </details>
            )}
            <button className="btn" style={{ marginTop: '0.5rem' }} onClick={adoptTemplateVersion}>
              Adopt v{customization.current_template_version}
            </button>
          </div>
        )}

        {Object.keys(overrides).length === 0 ? (
          <p className="muted">This customization has no overrides yet — open it from one of the customize flows first.</p>
        ) : (
          <>
            {Object.entries(overrides).map(([key, value]) => (
              <div className="form-row" key={key}>
                <label htmlFor={`edit-${key}`}>{key}</label>
                <textarea
                  id={`edit-${key}`}
                  rows={value.length > 80 ? 4 : 2}
                  value={value}
                  onChange={(e) => setOverrides({ ...overrides, [key]: e.target.value })}
                />
              </div>
            ))}
            <button className="btn" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </>
        )}
      </main>
    </>
  );
}
