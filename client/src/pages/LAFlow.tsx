import { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/Header';
import { api, type LAClient } from '../api';
import { AIRewriteDialog } from '../components/AIRewriteDialog';

type SaveResult = { public_url: string; edit_url: string; public_slug: string } | null;
type Step = 'pick_la' | 'editor' | 'request_link' | 'link_sent' | 'published';

const EDITABLE_SECTIONS: Array<{ key: string; label: string; multiline?: boolean }> = [
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
  { key: 'contact_name', label: 'Contact block — team name' },
  { key: 'contact_email', label: 'Contact email' },
  { key: 'contact_website', label: 'Contact website' },
];

export function LAFlow() {
  const [clients, setClients] = useState<LAClient[]>([]);
  const [slug, setSlug] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  /** Per-language overlay of overrides. Saved after the English customisation
   *  is published so each row in customization_translations has a customization_id. */
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});

  const [authEmail, setAuthEmail] = useState('');
  const [verified, setVerified] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('pick_la');
  const [busy, setBusy] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult>(null);
  const [error, setError] = useState<string | null>(null);

  // AI dialog state
  const [aiDialog, setAiDialog] = useState<{ mode: 'rewrite' | 'translate'; key: string; label: string } | null>(null);

  useEffect(() => {
    api.listLAs()
      .then(({ clients }) => setClients(clients))
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('verified') === '1') {
      api.me().then((r) => {
        if (r.session?.scope === 'la' && r.session.la_slug) {
          setSlug(r.session.la_slug);
          setVerified(true);
        }
      });
    }
  }, []);

  const selected = useMemo(() => clients.find((c) => c.slug === slug), [clients, slug]);

  function applyDefaults(la: LAClient) {
    setOverrides({
      hero_title: `Free school meals: ${la.name}'s expanded offer`,
      contact_name: `${la.name} Welfare and Benefits Team`,
      calculator_url: `https://${la.calculator_subdomain}`,
      calculator_url_display: la.calculator_subdomain,
    });
  }

  async function requestLink() {
    if (!slug) return;
    setError(null);
    setWarning(null);
    setBusy(true);
    try {
      const result = await api.requestMagicLink({ scope: 'la', email: authEmail, la_slug: slug });
      if (result.warning) setWarning(result.warning);
      setDevLink(result.dev_link ?? null);
      setStep('link_sent');
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  async function publish() {
    if (!slug) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.createCustomization({ template_slug: 'entitledto-la', la_slug: slug, overrides });
      // Save every translation we collected against the new customization.
      // Failures here are non-fatal — the English customization is already
      // saved; we surface translation errors in the success screen instead.
      const translationLanguages = Object.keys(translations);
      const translationErrors: string[] = [];
      for (const lang of translationLanguages) {
        const trOverrides = translations[lang];
        if (!trOverrides || Object.keys(trOverrides).length === 0) continue;
        try {
          await api.saveTranslation(result.public_slug, lang, trOverrides);
        } catch (e) {
          translationErrors.push(`${lang}: ${(e as Error).message}`);
        }
      }
      if (translationErrors.length > 0) {
        setError('Customisation published, but some translations failed to save: ' + translationErrors.join('; '));
      }
      setSaveResult(result);
      setStep('published');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (step === 'published' && saveResult) {
    const publishedTranslations = Object.entries(translations).filter(([, m]) => Object.keys(m).length > 0);
    return (
      <>
        <Header />
        <main className="page page--narrow">
          <div className="alert alert--success">
            <strong>Published.</strong> Your LA-bespoke leaflet is live.
          </div>
          <p>Public URL: <a href={saveResult.public_url}>{saveResult.public_url}</a></p>
          {publishedTranslations.length > 0 && (
            <p>
              Translations saved:{' '}
              {publishedTranslations.map(([lang, m]) => (
                <span key={lang} className="lang-chip">
                  {lang.toUpperCase()} <small>({Object.keys(m).length} sections)</small>
                </span>
              ))}
              <br />
              <small className="muted">The public URL shows a language switcher above the leaflet so visitors can pick.</small>
            </p>
          )}
          <p>
            Edit URL (keep this — re-opening sends a fresh magic link to your verified email):
            <br /><a href={saveResult.edit_url}>{saveResult.edit_url}</a>
          </p>
          <p><a className="btn" href={saveResult.public_url}>Open your leaflet</a></p>
          {error && <div className="alert">{error}</div>}
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
            We sent a magic link to <strong>{authEmail}</strong>. Open it within 15 minutes
            to return here and publish.
          </div>
          {warning && <div className="alert">{warning}</div>}
          {devLink && (
            <div className="alert">
              <strong>Dev mode shortcut.</strong> Click below to consume the link directly
              (production users click the link in their inbox).
              <p style={{ marginTop: '0.5rem' }}>
                <a className="btn" href={devLink}>Open magic link</a>
              </p>
            </div>
          )}
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
          Pick your LA, then edit the body sections. In a future iteration, the
          "Re-write with AI" button will sit alongside each field.
        </p>

        {error && <div className="alert alert--error">Error: {error}</div>}

        <div className="form-row" style={{ maxWidth: '24rem' }}>
          <label htmlFor="la-select">Local authority</label>
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
            <option value="">Choose an LA…</option>
            {clients.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>

        {selected && (
          <div className="split">
            <div>
              <h3 style={{ marginTop: 0 }}>Sections</h3>
              {Object.entries(translations).some(([, m]) => Object.keys(m).length > 0) && (
                <div className="translations-strip" aria-label="Translations in progress">
                  Translations queued for save on publish:{' '}
                  {Object.entries(translations)
                    .filter(([, m]) => Object.keys(m).length > 0)
                    .map(([lang, m]) => (
                      <span key={lang} className="lang-chip">
                        {lang.toUpperCase()} <small>({Object.keys(m).length})</small>
                      </span>
                    ))}
                </div>
              )}
              {EDITABLE_SECTIONS.map((s) => (
                <div className="form-row form-row--with-ai" key={s.key}>
                  <label htmlFor={`fld-${s.key}`}>{s.label}</label>
                  {s.multiline ? (
                    <textarea
                      id={`fld-${s.key}`}
                      rows={3}
                      value={overrides[s.key] ?? ''}
                      onChange={(e) => setOverrides({ ...overrides, [s.key]: e.target.value })}
                    />
                  ) : (
                    <input
                      id={`fld-${s.key}`}
                      value={overrides[s.key] ?? ''}
                      onChange={(e) => setOverrides({ ...overrides, [s.key]: e.target.value })}
                    />
                  )}
                  <div className="form-row__ai-actions">
                    <button
                      type="button"
                      className="btn-mini"
                      onClick={() => setAiDialog({ mode: 'rewrite', key: s.key, label: s.label })}
                      disabled={!overrides[s.key]}
                      title={overrides[s.key] ? 'Re-write this section using AI against your LA\'s source URL' : 'Add some text first'}
                    >
                      ✨ Re-write with AI
                    </button>
                    <button
                      type="button"
                      className="btn-mini"
                      onClick={() => setAiDialog({ mode: 'translate', key: s.key, label: s.label })}
                      disabled={!overrides[s.key]}
                      title="Translate this section to another language"
                    >
                      🌐 Translate
                    </button>
                  </div>
                </div>
              ))}

              {verified ? (
                <button className="btn" onClick={publish} disabled={busy}>
                  {busy ? 'Publishing…' : 'Publish leaflet'}
                </button>
              ) : (
                <>
                  <h3 style={{ marginTop: '1.5rem' }}>Verify ownership</h3>
                  <p className="muted">
                    We'll send a one-time magic link to your council email
                    (*.gov.uk is the convention but not enforced).
                  </p>
                  <div className="form-row">
                    <label htmlFor="auth-email">Your work email</label>
                    <input
                      id="auth-email"
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="you@council.gov.uk"
                    />
                  </div>
                  <button className="btn" onClick={requestLink} disabled={!authEmail || busy}>
                    {busy ? 'Sending…' : 'Send me a magic link'}
                  </button>
                </>
              )}
            </div>

            <div>
              <h3 style={{ marginTop: 0 }}>Live preview</h3>
              <p className="muted">
                Renders the entitledto-LA template with the LA's brand colours.
                The preview reflects defaults; your edits are reflected after publish.
              </p>
              <iframe
                title="Leaflet preview"
                src={`/generic/entitledto-la?preview=1`}
                className="preview-frame"
              />
            </div>
          </div>
        )}
      </main>

      {aiDialog && selected && (
        <AIRewriteDialog
          open={true}
          mode={aiDialog.mode}
          templateSlug="entitledto-la"
          sectionKey={aiDialog.key}
          sectionLabel={aiDialog.label}
          currentText={overrides[aiDialog.key] ?? ''}
          laSlug={selected.slug}
          laDefaultSourceUrl={selected.default_source_url}
          onClose={() => setAiDialog(null)}
          onAccept={(newText, lang) => {
            if (lang && lang !== 'en') {
              // Translation: route into the per-language map, not the English override.
              setTranslations((prev) => ({
                ...prev,
                [lang]: { ...(prev[lang] ?? {}), [aiDialog.key]: newText },
              }));
            } else {
              setOverrides({ ...overrides, [aiDialog.key]: newText });
            }
          }}
        />
      )}
    </>
  );
}
