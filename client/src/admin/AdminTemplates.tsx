import { useEffect, useState } from 'react';
import { adminApi, type AdminTemplate, type AdminTemplateDetail } from './adminApi';

export function AdminTemplates() {
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminTemplateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Edit form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [audience, setAudience] = useState<'school' | 'la' | 'housing-association'>('school');
  const [factsText, setFactsText] = useState('');
  const [paletteText, setPaletteText] = useState('');

  // Version-bump form
  const [changelog, setChangelog] = useState('');

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const r = await adminApi.listTemplates();
      setTemplates(r.templates);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function selectTemplate(id: number) {
    setError(null);
    setBusy(true);
    try {
      const r = await adminApi.getTemplate(id);
      const t = r.template;
      setSelected(t);
      setName(t.name);
      setDescription(t.description);
      setStatus(t.status);
      setAudience(t.audience);
      setFactsText(JSON.stringify(t.facts, null, 2));
      setPaletteText(JSON.stringify(t.default_palette, null, 2));
      setChangelog('');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function saveMetadata() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      let facts: unknown;
      let palette: unknown;
      try {
        facts = JSON.parse(factsText);
        palette = JSON.parse(paletteText);
      } catch (e) {
        setError(`JSON parse failed: ${(e as Error).message}`);
        setBusy(false);
        return;
      }
      await adminApi.patchTemplate(selected.id, {
        name,
        description,
        status,
        audience,
        facts,
        default_palette: palette,
      });
      await refresh();
      await selectTemplate(selected.id);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function bumpVersion() {
    if (!selected) return;
    if (changelog.trim().length < 10) {
      setError('Changelog needs to describe what changed and why (min 10 chars).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminApi.bumpTemplateVersion(selected.id, changelog);
      await refresh();
      await selectTemplate(selected.id);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="split" style={{ gridTemplateColumns: '20rem 1fr' }}>
      <aside>
        <h2>Templates {!loading && <small style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>({templates.length})</small>}</h2>
        {error && <div className="alert alert--error">{error}</div>}
        {loading ? (
          <p className="muted" style={{ padding: '0.75rem 0' }}>Loading templates…</p>
        ) : templates.length === 0 ? (
          <div className="alert">
            <strong>No templates returned.</strong>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
              The API returned an empty list. If the database was just seeded, give it a few seconds and click <button className="btn-mini" onClick={refresh}>↻ Refresh</button>.
            </p>
          </div>
        ) : (
          <ul className="admin-list">
            {templates.map((t) => (
              <li key={t.id} className={selected?.id === t.id ? 'admin-list__item admin-list__item--active' : 'admin-list__item'}>
                <div className="admin-list__row">
                  <button className="admin-list__main" onClick={() => selectTemplate(t.id)} title="Edit template">
                    <strong>{t.name}</strong>
                    <span>v{t.version} · {t.audience} · {t.status}</span>
                  </button>
                  <div className="admin-list__actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => selectTemplate(t.id)}
                      title="Edit this template"
                      aria-label={`Edit ${t.name}`}
                    >
                      ✏️
                    </button>
                    <a
                      className="icon-btn"
                      href={`/view/${t.slug}`}
                      target="_blank"
                      rel="noopener"
                      title="Preview the rendered leaflet in a new tab"
                      aria-label={`Preview ${t.name}`}
                    >
                      👁
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section>
        {!selected ? (
          <p className="muted">Pick a template on the left to edit.</p>
        ) : (
          <>
            <h2>{selected.name} <small style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>v{selected.version}</small></h2>

            <div className="form-row">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Description</label>
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Audience</label>
              <select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
                <option value="school">school</option>
                <option value="la">la</option>
                <option value="housing-association">housing-association</option>
              </select>
            </div>
            <div className="form-row">
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="draft">draft</option>
                <option value="published">published</option>
              </select>
            </div>

            <details style={{ margin: '1rem 0' }}>
              <summary><strong>Default palette + body content (JSON)</strong></summary>
              <p className="muted"><small>The "content" key inside default_palette holds the template's default body strings (title, intro, box bodies, etc). Edits here flow into newly-created customisations as the starting point.</small></p>
              <textarea
                style={{ fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '14rem' }}
                value={paletteText}
                onChange={(e) => setPaletteText(e.target.value)}
              />
            </details>

            <details style={{ margin: '1rem 0' }}>
              <summary><strong>facts_json (used by AI fact-check warning)</strong></summary>
              <p className="muted"><small>The factual claims the AI verify-pass checks generated copy against. Keep these aligned with current DfE guidance.</small></p>
              <textarea
                style={{ fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '10rem' }}
                value={factsText}
                onChange={(e) => setFactsText(e.target.value)}
              />
            </details>

            <button className="btn" onClick={saveMetadata} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>

            <hr style={{ margin: '2rem 0' }} />

            <h3>Bump version</h3>
            <p className="muted">
              Bumping the version means published customisations will show a "Template updated"
              banner to their owners on next login. Describe what changed and why (min 10 chars).
            </p>
            <div className="form-row">
              <label>Changelog note</label>
              <textarea rows={3} value={changelog} onChange={(e) => setChangelog(e.target.value)} />
            </div>
            <button className="btn btn--secondary" onClick={bumpVersion} disabled={busy || changelog.trim().length < 10}>
              Bump to v{selected.version + 1}
            </button>

            {selected.changelog && (
              <details style={{ marginTop: '1.5rem' }}>
                <summary><strong>Changelog history</strong></summary>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>{selected.changelog}</pre>
              </details>
            )}
          </>
        )}
      </section>
    </div>
  );
}
