/* LA customise flow — pen-only editing.
 *
 * UX shape (per Phil's rework):
 *   - Pick a local authority from the dropdown
 *   - Optional: show the LA's logo on the leaflet (defaults to off)
 *   - The leaflet preview renders live in an iframe; every edit re-renders it
 *   - Each editable section sits in a tidy list; each row is just a pen icon
 *     that opens a modal with a textarea for that section
 *   - No AI re-write / translate buttons — Phil dropped that path here
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Header } from '../components/Header';
import { api, type LAClient } from '../api';

type SaveResult = { public_url: string; edit_url: string; public_slug: string } | null;

const EDITABLE_SECTIONS: Array<{ key: string; label: string; description?: string; multiline?: boolean }> = [
  { key: 'hero_title', label: 'Headline' },
  { key: 'hero_subtitle', label: 'Subtitle' },
  { key: 'hero_date', label: 'Hero date line' },
  { key: 'intro_html', label: 'Intro paragraph', multiline: true },
  { key: 'cta_primary_title', label: 'Primary CTA title' },
  { key: 'cta_primary_body_html', label: 'Primary CTA body', multiline: true },
  { key: 'box1_title', label: '"What this means" — Box 1 title' },
  { key: 'box1_body_html', label: 'Box 1 body', multiline: true },
  { key: 'box2_title', label: 'Box 2 title' },
  { key: 'box2_body_html', label: 'Box 2 body', multiline: true },
  { key: 'cta_secondary_title', label: 'Yellow box title' },
  { key: 'cta_secondary_body_html', label: 'Yellow box body', multiline: true },
  { key: 'contact_name', label: 'Contact block — team name' },
  { key: 'contact_email', label: 'Contact email' },
  { key: 'contact_website', label: 'Contact website' },
];

export function LAFlow() {
  const [clients, setClients] = useState<LAClient[]>([]);
  const [slug, setSlug] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [showLogo, setShowLogo] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');

  const [editing, setEditing] = useState<{ key: string; label: string; multiline?: boolean } | null>(null);
  const [draft, setDraft] = useState('');

  const [busy, setBusy] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult>(null);
  const [error, setError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    api.listLAs()
      .then(({ clients }) => setClients(clients))
      .catch((e) => setError((e as Error).message));
  }, []);

  const selected = useMemo(() => clients.find((c) => c.slug === slug), [clients, slug]);

  function applyDefaults(la: LAClient) {
    setOverrides({
      hero_title: `Free school meals: ${la.name}'s expanded offer`,
      contact_name: `${la.name} Welfare and Benefits Team`,
      calculator_url: `https://${la.calculator_subdomain}`,
      calculator_url_display: la.calculator_subdomain,
    });
    setShowLogo(false);
  }

  // Combined overrides include the logo flag + logo URL when the toggle is on.
  // Server-side render reads these from content.show_logo / content.logo_url.
  const effectiveOverrides = useMemo(() => {
    const o = { ...overrides };
    if (showLogo && selected?.logo_url) {
      o.show_logo = 'true';
      o.logo_url = selected.logo_url;
    }
    return o;
  }, [overrides, showLogo, selected]);

  // Live preview: POST overrides to /preview-render, set iframe srcDoc.
  useEffect(() => {
    if (!slug) { setPreviewHtml(''); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/customizations/preview-render', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            template_slug: 'entitledto-la',
            la_slug: slug,
            overrides: effectiveOverrides,
          }),
        });
        const html = await res.text();
        if (!cancelled) setPreviewHtml(html);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, effectiveOverrides]);

  function openEditor(section: typeof EDITABLE_SECTIONS[number]) {
    setEditing(section);
    setDraft(overrides[section.key] ?? '');
  }

  function saveEditor() {
    if (!editing) return;
    setOverrides({ ...overrides, [editing.key]: draft });
    setEditing(null);
  }

  function clearEditor() {
    if (!editing) return;
    const next = { ...overrides };
    delete next[editing.key];
    setOverrides(next);
    setEditing(null);
  }

  async function publish() {
    if (!slug) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.createCustomization({
        template_slug: 'entitledto-la',
        la_slug: slug,
        overrides: effectiveOverrides,
      });
      setSaveResult(result);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (saveResult) {
    const fullUrl = window.location.origin + saveResult.public_url;
    return (
      <>
        <Header />
        <main className="page page--narrow">
          <div className="alert alert--success">
            <strong>Your LA-bespoke leaflet is ready.</strong>
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
            <h3 style={{ marginTop: 0 }}>Share your leaflet</h3>
            <div className="copy-row">
              <input readOnly value={fullUrl} onFocus={(e) => e.currentTarget.select()} />
              <button className="btn btn--secondary" onClick={() => navigator.clipboard?.writeText(fullUrl)}>
                Copy link
              </button>
            </div>
          </div>
          <p className="muted" style={{ marginTop: '2rem' }}>
            Need to change the wording? <a href={saveResult.edit_url}>Edit your leaflet</a>.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="page">
        <h2>Customise the leaflet for your local authority</h2>
        <p className="muted">
          Pick your LA, then use the pen icons to edit any section. The leaflet
          on the right updates as you go.
        </p>

        {error && <div className="alert alert--error">{error}</div>}

        <div className="la-controls">
          <div className="form-row" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="la-select">Choose a local authority</label>
            <select
              id="la-select"
              value={slug}
              onChange={(e) => {
                const next = e.target.value;
                setSlug(next);
                const la = clients.find((c) => c.slug === next);
                if (la) applyDefaults(la);
              }}
            >
              <option value="">— pick one —</option>
              {clients.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>

          <label className="la-logo-toggle">
            <input
              type="checkbox"
              checked={showLogo}
              onChange={(e) => setShowLogo(e.target.checked)}
              disabled={!selected?.logo_url}
            />
            <span>
              Show LA logo on the leaflet
              {selected && !selected.logo_url && (
                <span className="muted"> &nbsp;— no logo URL on file for {selected.name}; add one in /admin/la-clients</span>
              )}
            </span>
          </label>
        </div>

        {selected && (
          <div className="split la-editor-split">
            <div>
              <h3 style={{ marginTop: 0 }}>Edit sections</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                Click ✏️ on any row to edit. Blank rows show the template default.
              </p>
              <ul className="pen-list">
                {EDITABLE_SECTIONS.map((s) => {
                  const hasOverride = overrides[s.key] != null && overrides[s.key] !== '';
                  return (
                    <li key={s.key} className={hasOverride ? 'pen-list__item pen-list__item--edited' : 'pen-list__item'}>
                      <button type="button" className="pen-list__row" onClick={() => openEditor(s)}>
                        <span className="pen-list__label">{s.label}</span>
                        {hasOverride && <span className="pen-list__edited-chip">edited</span>}
                        <span className="pen-list__pen" aria-label={`Edit ${s.label}`}>✏️</span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <button className="btn btn--large btn--primary" onClick={publish} disabled={busy} style={{ marginTop: '1rem' }}>
                {busy ? 'Publishing…' : 'Publish leaflet'}
              </button>
            </div>

            <div>
              <h3 style={{ marginTop: 0 }}>Live preview</h3>
              <iframe
                ref={iframeRef}
                title="Leaflet live preview"
                srcDoc={previewHtml}
                className="preview-frame preview-frame--tall"
              />
            </div>
          </div>
        )}
      </main>

      {editing && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <header className="modal__header">
              <h3>Edit — <span className="modal__section-label">{editing.label}</span></h3>
              <button className="modal__close" onClick={() => setEditing(null)} aria-label="Close">×</button>
            </header>
            <div className="modal__body" style={{ gridTemplateColumns: '1fr' }}>
              <div className="modal__pane">
                <p className="muted" style={{ marginTop: 0 }}>
                  Edit the text below. Simple HTML works for emphasis
                  (<code>&lt;strong&gt;</code>, <code>&lt;u&gt;</code>); plain
                  text is fine too. The leaflet preview updates when you save.
                </p>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={editing.multiline ? 8 : 3}
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: '0.95rem' }}
                  autoFocus
                />
              </div>
            </div>
            <footer className="modal__footer">
              <button className="btn btn--primary" onClick={saveEditor}>Save</button>
              <button className="btn btn--secondary" onClick={clearEditor}>Reset to default</button>
              <button className="btn btn--secondary" onClick={() => setEditing(null)}>Cancel</button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
