/* LA customise flow — pen-only inline editing.
 *
 * The editable leaflet renders in an iframe. The server's preview-render
 * endpoint, when given `with_pens: true`, injects a small inline script
 * that places a pen icon next to every `[data-edit-key]` element and
 * postMessages back to this page when one is clicked. We listen, look up
 * the section, open a modal with a textarea — save updates state and
 * re-renders the iframe. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Header } from '../components/Header';
import { api, type LAClient } from '../api';

type SaveResult = { public_url: string; edit_url: string; public_slug: string } | null;

type EditableSection = { key: string; label: string; multiline?: boolean };

const EDITABLE_SECTIONS: EditableSection[] = [
  { key: 'hero_title', label: 'Headline' },
  { key: 'hero_subtitle', label: 'Subtitle' },
  { key: 'hero_date', label: 'Hero date line' },
  { key: 'intro_html', label: 'Intro paragraph', multiline: true },
  { key: 'cta_primary_title', label: 'Primary CTA title' },
  { key: 'cta_primary_body_html', label: 'Primary CTA body', multiline: true },
  { key: 'box1_title', label: 'Box 1 title' },
  { key: 'box1_body_html', label: 'Box 1 body', multiline: true },
  { key: 'box2_title', label: 'Box 2 title' },
  { key: 'box2_body_html', label: 'Box 2 body', multiline: true },
  { key: 'cta_secondary_title', label: 'Yellow box title' },
  { key: 'cta_secondary_body_html', label: 'Yellow box body', multiline: true },
  { key: 'contact_name', label: 'Contact team name' },
  { key: 'contact_phone', label: 'Contact phone' },
  { key: 'contact_email', label: 'Contact email' },
  { key: 'contact_website', label: 'Contact website' },
  { key: 'how_to_steps_html', label: 'How-to-claim steps', multiline: true },
];

export function LAFlow() {
  const [clients, setClients] = useState<LAClient[]>([]);
  const [slug, setSlug] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [showLogo, setShowLogo] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');

  const [editing, setEditing] = useState<EditableSection | null>(null);
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

  const effectiveOverrides = useMemo(() => {
    const o = { ...overrides };
    if (showLogo && selected?.logo_url) {
      o.show_logo = 'true';
      o.logo_url = selected.logo_url;
    }
    return o;
  }, [overrides, showLogo, selected]);

  // Re-fetch the leaflet HTML whenever the slug, overrides, or logo flag changes.
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
            with_pens: true,
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

  // Listen for pen clicks bubbling up from inside the iframe.
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as { type?: string; key?: string } | null;
      if (data?.type !== 'leaflet-edit' || !data.key) return;
      const section = EDITABLE_SECTIONS.find((s) => s.key === data.key);
      if (!section) return;
      setEditing(section);
      setDraft(overrides[section.key] ?? '');
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [overrides]);

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

        <div className="la-customer-note" role="note">
          <strong>For entitledto LA customers only.</strong>
          <span> This page customises the bespoke version of the leaflet for local authorities
            that subscribe to the entitledto benefit calculator. Schools can use the
            {' '}<a href="/customize/school">schools customise flow</a> instead; everyone
            else can download the
            {' '}<a href="/view/entitledto-la" target="_blank" rel="noopener">generic entitledto edition</a>.
          </span>
        </div>

        <p className="muted la-examples-line">
          For help in producing a leaflet for your local authority please contact your
          client manager or email <a href="mailto:fiona@entitledto.co.uk">fiona@entitledto.co.uk</a>.
        </p>

        {error && <div className="alert alert--error">{error}</div>}

        <div className="form-row" style={{ maxWidth: '32rem' }}>
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

        {selected && (
          <>
            <label className="la-logo-toggle">
              <input
                type="checkbox"
                checked={showLogo}
                onChange={(e) => setShowLogo(e.target.checked)}
                disabled={!selected.logo_url}
              />
              <span>
                Show LA logo on the leaflet
                {!selected.logo_url && (
                  <span className="muted"> &nbsp;— no logo URL on file for {selected.name}; add one in /admin/la-clients</span>
                )}
              </span>
            </label>

            <p className="muted" style={{ margin: '0.5rem 0 1rem' }}>
              Hover over any section of the leaflet below and click the
              <strong> ✏️ pen</strong> to edit that text. Changes appear as you save.
            </p>

            <iframe
              ref={iframeRef}
              title="Leaflet live preview — click pen icons to edit"
              srcDoc={previewHtml}
              className="preview-frame preview-frame--xtall"
            />

            <div style={{ marginTop: '1rem' }}>
              <button className="btn btn--large btn--primary" onClick={publish} disabled={busy}>
                {busy ? 'Publishing…' : 'Publish leaflet'}
              </button>
            </div>
          </>
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
                  (<code>&lt;strong&gt;</code>, <code>&lt;u&gt;</code>). Save updates the leaflet preview.
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
