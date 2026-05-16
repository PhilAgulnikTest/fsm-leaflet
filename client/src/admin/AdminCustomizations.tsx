import { useEffect, useState } from 'react';
import { adminApi } from './adminApi';

type Row = {
  id: number;
  public_slug: string;
  school_urn: string | null;
  la_slug: string | null;
  owner_email: string | null;
  template_slug: string;
  template_name: string;
  template_version_at_publish: number;
  current_template_version: number;
  template_drift: boolean;
  translation_count: number;
  published_at: string | null;
  updated_at: string;
  school_name: string | null;
  la_name: string | null;
};

export function AdminCustomizations() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try { setRows((await adminApi.listCustomizations()).customizations); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { refresh(); }, []);

  async function remove(slug: string) {
    if (!confirm(`Delete the published customization "${slug}"? Its public URL stops working immediately.`)) return;
    setBusy(true);
    try { await adminApi.deleteCustomization(slug); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const filtered = filter
    ? rows.filter((r) =>
        (r.public_slug + ' ' + (r.school_name ?? '') + ' ' + (r.la_name ?? '') + ' ' + (r.owner_email ?? ''))
          .toLowerCase()
          .includes(filter.toLowerCase())
      )
    : rows;

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Published customizations ({rows.length})</h2>
        <input
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ maxWidth: '20rem', flex: 1 }}
        />
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {rows.length === 0 ? (
        <p className="muted">Nobody's published a customization yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>For</th>
              <th>Template</th>
              <th>Translations</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <a href={`/c/${r.public_slug}`} target="_blank" rel="noopener"><code>{r.public_slug}</code></a>
                  {r.owner_email && <div><small className="muted">{r.owner_email}</small></div>}
                </td>
                <td>
                  {r.school_name && <span>🏫 {r.school_name}</span>}
                  {r.la_name && <span>🏛 {r.la_name}</span>}
                  {!r.school_name && !r.la_name && <span className="muted">—</span>}
                </td>
                <td>
                  <span>{r.template_name}</span>
                  <div><small className="muted">
                    v{r.template_version_at_publish}
                    {r.template_drift && (
                      <span style={{ color: 'var(--brand-bright)', fontWeight: 600 }}> · update to v{r.current_template_version} available</span>
                    )}
                  </small></div>
                </td>
                <td>{r.translation_count > 0 ? <span className="lang-chip">{r.translation_count}</span> : <span className="muted">—</span>}</td>
                <td><small>{r.updated_at}</small></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <a className="btn btn--secondary" href={`/c/${r.public_slug}`} target="_blank" rel="noopener">View</a>
                  <button className="btn btn--secondary" onClick={() => remove(r.public_slug)} disabled={busy} style={{ marginLeft: '0.25rem' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
