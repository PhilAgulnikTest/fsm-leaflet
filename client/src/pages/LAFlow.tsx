import { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/Header';
import { api, type LAClient } from '../api';
import { AIRewriteDialog } from '../components/AIRewriteDialog';

type SaveResult = { public_url: string; edit_url: string; public_slug: string } | null;
type Step = 'pick_la' | 'editor' | 'published';

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

  const selected = useMemo(() => clients.find((c) => c.slug === slug), [clients, slug]);

  function applyDefaults(la: LAClient) {
    setOverrides({
      hero_title: `Free school meals: ${la.name}'s expanded offer`,
      contact_name: `${la.name} Welfare and Benefits Team`,
      calculator_url: `https://${la.calculator_subdomain}`,
      calculator_url_display: la.calculator_subdomain,
    });
  }

  async function publish() {
    if (!slug) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.createCustomization({ template_slug: 'entitledto-la', la_slug: slug, overrides });
      // Save every translation we collected against the new customization.
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
    const fullUrl = window.location.origin + saveResult.public_url;
    const publishedTranslations = Object.entries(translations).filter(([, m]) => Object.keys(m).length > 0);
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
            <h3>Share your leaflet</h3>
            <p className="muted">Send this link to schools, share on your website, or print and hand out.</p>
            <div className="copy-row">
              <input readOnly value={fullUrl} onFocus={(e) => e.currentTarget.select()} />
              <button className="btn btn--secondary" onClick={() => navigator.clipboard?.writeText(fullUrl)}>
                Copy link
              </button>
            </div>
          </div>

          {publishedTranslations.length > 0 && (
            <p style={{ marginTop: '1.5rem' }}>
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

          <p className="muted" style={{ marginTop: '2rem' }}>
            Need to change the wording? <a href={saveResult.edit_url}>Edit your leaflet</a>.
          </p>
          {error && <div className="alert">{error}</div>}
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
          Pick your LA, edit the body sections, and publish — your bespoke print-ready
          leaflet is ready immediately. Use the AI buttons next to each section to
          re-write copy from your existing FSM page or translate into other languages.
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
              setStep('editor');
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
              <button className="btn btn--large btn--primary" onClick={publish} disabled={busy}>
                {busy ? 'Publishing…' : 'Publish leaflet'}
              </button>
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
