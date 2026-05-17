import { useEffect, useState } from 'react';
import { adminApi, type AdminLAClient } from './adminApi';

const EMPTY_NEW: Omit<AdminLAClient, 'slug' | 'created_at' | 'updated_at'> & { slug: string } = {
  slug: '',
  name: '',
  calculator_subdomain: '',
  default_brand_colour: '#1B2A6B',
  default_accent_colour: '#E64A3C',
  logo_url: null,
  default_source_url: null,
  enabled_languages: ['en'],
  notes: '',
};

export function AdminLAClients() {
  const [clients, setClients] = useState<AdminLAClient[]>([]);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<typeof EMPTY_NEW | null>(null);
  const [csv, setCsv] = useState('');
  const [uploadResult, setUploadResult] = useState<{ imported: number; errors: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try { setClients((await adminApi.listLAClients()).clients); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { refresh(); }, []);

  const filtered = filter
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.slug.toLowerCase().includes(filter.toLowerCase())
      )
    : clients;

  function startNew() {
    setEditing({ ...EMPTY_NEW });
    setError(null);
  }

  function startEdit(c: AdminLAClient) {
    setEditing({
      slug: c.slug,
      name: c.name,
      calculator_subdomain: c.calculator_subdomain,
      default_brand_colour: c.default_brand_colour,
      default_accent_colour: c.default_accent_colour,
      logo_url: c.logo_url,
      default_source_url: c.default_source_url,
      enabled_languages: c.enabled_languages,
      notes: c.notes,
    });
    setError(null);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const { slug, ...rest } = editing;
      if (!slug) throw new Error('slug_required');
      await adminApi.upsertLAClient(slug, rest);
      await refresh();
      setEditing(null);
    } catch (e) {
      const err = e as Error & { extra?: { brand?: { notes: string[] }; accent?: { notes: string[] } } };
      if (err.message === 'contrast_fail' && err.extra) {
        const notes = [...(err.extra.brand?.notes ?? []), ...(err.extra.accent?.notes ?? [])];
        setError(`Contrast check failed: ${notes.join(' ')}`);
      } else setError(err.message);
    } finally { setBusy(false); }
  }

  async function remove(slug: string) {
    if (!confirm(`Delete LA client "${slug}"?`)) return;
    setBusy(true);
    try { await adminApi.deleteLAClient(slug); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function uploadCsv() {
    setBusy(true);
    setError(null);
    setUploadResult(null);
    try {
      const r = await adminApi.uploadLAClientsCSV(csv);
      setUploadResult(r);
      await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  if (editing) {
    return (
      <section>
        <h2>{editing.slug && clients.some((c) => c.slug === editing.slug) ? 'Edit' : 'Add'} LA client</h2>
        {error && <div className="alert alert--error">{error}</div>}

        <div className="form-row">
          <label>Slug (URL-safe; e.g. lambeth)</label>
          <input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} disabled={clients.some((c) => c.slug === editing.slug)} />
        </div>
        <div className="form-row">
          <label>Name</label>
          <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
        </div>
        <div className="form-row">
          <label>Calculator subdomain (e.g. lambeth.entitledto.co.uk)</label>
          <input value={editing.calculator_subdomain} onChange={(e) => setEditing({ ...editing, calculator_subdomain: e.target.value })} />
        </div>
        <div className="split" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="form-row">
            <label>Brand colour</label>
            <input type="color" value={editing.default_brand_colour} onChange={(e) => setEditing({ ...editing, default_brand_colour: e.target.value })} />
            <span className="muted"><small>{editing.default_brand_colour}</small></span>
          </div>
          <div className="form-row">
            <label>Accent colour</label>
            <input type="color" value={editing.default_accent_colour} onChange={(e) => setEditing({ ...editing, default_accent_colour: e.target.value })} />
            <span className="muted"><small>{editing.default_accent_colour}</small></span>
          </div>
        </div>
        <div className="form-row">
          <label>Logo URL (optional)</label>
          <input value={editing.logo_url ?? ''} onChange={(e) => setEditing({ ...editing, logo_url: e.target.value || null })} />
        </div>
        <div className="form-row">
          <label>Default source URL (used to pre-fill AI re-write dialog)</label>
          <input value={editing.default_source_url ?? ''} onChange={(e) => setEditing({ ...editing, default_source_url: e.target.value || null })} />
        </div>
        <div className="form-row">
          <label>Enabled languages (comma-separated ISO codes)</label>
          <input value={editing.enabled_languages.join(', ')} onChange={(e) => setEditing({ ...editing, enabled_languages: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
        </div>
        <div className="form-row">
          <label>Notes</label>
          <textarea rows={3} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
        </div>

        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button className="btn btn--secondary" onClick={() => setEditing(null)} style={{ marginLeft: '0.5rem' }}>Cancel</button>
      </section>
    );
  }

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>LA clients ({clients.length})</h2>
        <input
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: '1', maxWidth: '20rem' }}
        />
        <button className="btn" onClick={startNew}>+ Add LA</button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <section className="la-examples">
        <h3>See an example before you build your own</h3>
        <p className="muted">
          Three published bespoke leaflets — open one to see the layout, branding, and copy
          in context. Use the Download PDF buttons to grab a print-ready copy.
        </p>
        <div className="la-examples__grid">
          {[
            { slug: 'lambeth-demo', name: 'Lambeth', brand: '#0F6E5B', accent: '#C2185B' },
            { slug: 'leeds-demo', name: 'Leeds', brand: '#0F2A52', accent: '#F0B92E' },
            { slug: 'oxfordshire-demo', name: 'Oxfordshire', brand: '#8B1F1F', accent: '#F0B92E' },
          ].map((ex) => (
            <article key={ex.slug} className="la-example-card" style={{ borderTop: `5px solid ${ex.brand}` }}>
              <h4 style={{ margin: '0.5rem 0 0.25rem', color: ex.brand }}>{ex.name}</h4>
              <p className="muted" style={{ margin: '0 0 0.75rem', fontSize: '0.85rem' }}>
                Bespoke leaflet for {ex.name} parents and carers.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a className="btn btn--secondary" href={`/c/${ex.slug}`} target="_blank" rel="noopener">
                  👁 View
                </a>
                <a className="btn btn--secondary" href={`/c/${ex.slug}.pdf`} download>
                  ⬇ PDF
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <details style={{ marginBottom: '1rem' }}>
        <summary><strong>Bulk upload (CSV)</strong></summary>
        <p className="muted">
          Required columns: <code>slug, name, calculator_subdomain, default_brand_colour, default_accent_colour</code>.
          Optional: <code>logo_url, default_source_url, enabled_languages, notes</code>.
          Brand-colour contrast is checked against white (≥4.5:1 WCAG AA); rows that fail are rejected with a clear reason.
        </p>
        <textarea
          rows={8}
          placeholder="slug,name,calculator_subdomain,default_brand_colour,default_accent_colour&#10;hounslow,Hounslow,hounslow.entitledto.co.uk,#1F4F5C,#2563EB"
          style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%' }}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <button className="btn" onClick={uploadCsv} disabled={!csv || busy}>
          {busy ? 'Uploading…' : 'Upload CSV'}
        </button>
        {uploadResult && (
          <div className="alert alert--success">
            Imported {uploadResult.imported}.
            {uploadResult.errors.length > 0 && (
              <ul>
                {uploadResult.errors.map((e, i) => (
                  <li key={i}>row {e.row} ({e.slug}): {e.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </details>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Slug</th><th>Name</th><th>Subdomain</th><th>Brand</th><th>Languages</th><th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <tr key={c.slug}>
              <td><code>{c.slug}</code></td>
              <td>{c.name}</td>
              <td><small>{c.calculator_subdomain}</small></td>
              <td>
                <span className="brand-swatch" style={{ background: c.default_brand_colour }}>{c.default_brand_colour}</span>
                <span className="brand-swatch" style={{ background: c.default_accent_colour, marginLeft: '0.25rem' }}>{c.default_accent_colour}</span>
              </td>
              <td><small>{c.enabled_languages.join(', ')}</small></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn btn--secondary" onClick={() => startEdit(c)}>Edit</button>
                <button className="btn btn--secondary" onClick={() => remove(c.slug)} style={{ marginLeft: '0.25rem' }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
