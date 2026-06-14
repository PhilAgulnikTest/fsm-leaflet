/* /edit/:slug — the editor for a previously-published customization.
 * Magic-link gating intentionally removed per Phil: no fraud concern, just
 * let anyone with the URL edit and re-publish. The same edit URL is returned
 * at publish time as a "save this somewhere" link. */

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

// Friendly labels for the raw override keys stored on a customization. Anything
// not listed falls back to a prettified version of the key (see prettifyKey).
const FIELD_LABELS: Record<string, string> = {
  hero_title: 'Headline',
  hero_subtitle: 'Subtitle',
  hero_date: 'Hero date line',
  intro_html: 'Intro paragraph',
  cta_primary_title: 'Primary CTA title',
  cta_primary_body_html: 'Primary CTA body',
  box1_title: 'Box 1 title',
  box1_body_html: 'Box 1 body',
  box2_title: 'Box 2 title',
  box2_body_html: 'Box 2 body',
  box3_title: 'Box 3 title',
  box3_body_html: 'Box 3 body',
  cta_secondary_title: 'Yellow box title',
  cta_secondary_body_html: 'Yellow box body',
  how_to_steps_html: 'How to claim — steps',
  contact_name: 'Contact name',
  contact_phone: 'Contact phone',
  contact_email: 'Contact email',
  contact_website: 'Contact website',
  calculator_url: 'Benefit calculator address',
  calculator_url_display: 'Calculator link text',
  show_logo: 'Show logo',
  logo_url: 'Logo image URL',
};

function prettifyKey(key: string): string {
  const s = key.replace(/_html$/, '').replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? prettifyKey(key);
}

export function EditFlow() {
  const { slug = '' } = useParams();
  const [customization, setCustomization] = useState<Customization | null>(null);
  const [templateDrift, setTemplateDrift] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function reload() {
    const cRes = await fetch(`/api/customizations/${slug}`).then((r) => r.json());
    const c = cRes.customization as Customization;
    setCustomization(c);
    setTemplateDrift(!!cRes.template_drift);
    setOverrides(JSON.parse(c.overrides_json || '{}'));
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

  async function save() {
    if (!customization) return;
    setSaving(true);
    setError(null);
    setSaved(false);
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

  const fullUrl = window.location.origin + `/c/${customization.public_slug}`;

  return (
    <>
      <Header />
      <main className="page page--narrow">
        <h2>Edit your leaflet</h2>
        <p className="muted">
          Changes update the same public URL. View or download anytime using the buttons below.
        </p>

        <div className="published-actions" style={{ marginBottom: '1.5rem' }}>
          <a className="btn btn--large btn--primary" href={`/c/${customization.public_slug}`} target="_blank" rel="noopener">
            👁 View your leaflet
          </a>
          <a className="btn btn--large btn--accent" href={`/c/${customization.public_slug}.pdf`} download>
            ⬇ Download PDF
          </a>
        </div>

        <div className="published-share" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Share link</h3>
          <div className="copy-row">
            <input readOnly value={fullUrl} onFocus={(e) => e.currentTarget.select()} />
            <button className="btn btn--secondary" onClick={() => navigator.clipboard?.writeText(fullUrl)}>
              Copy link
            </button>
          </div>
        </div>

        {error && <div className="alert alert--error">Error: {error}</div>}
        {saved && (
          <div className="alert alert--success">Saved.</div>
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
          <p className="muted">This customization has no overrides yet.</p>
        ) : (
          <>
            <h3>Sections</h3>
            <p className="muted">Clear a field and save to remove that text from the leaflet completely — it won't revert to the default wording.</p>
            {Object.entries(overrides).map(([key, value]) => (
              <div className="form-row" key={key}>
                <label htmlFor={`edit-${key}`}>{fieldLabel(key)}</label>
                <textarea
                  id={`edit-${key}`}
                  rows={value.length > 80 ? 4 : 2}
                  value={value}
                  onChange={(e) => setOverrides({ ...overrides, [key]: e.target.value })}
                />
              </div>
            ))}
            <button className="btn btn--large btn--primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </>
        )}
      </main>
    </>
  );
}
