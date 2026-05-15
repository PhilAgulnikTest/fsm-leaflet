import { useEffect, useState } from 'react';
import { adminApi, type TrustDomainRequest, type TrustDomainEntry } from './adminApi';

export function AdminTrustDomains() {
  const [pending, setPending] = useState<TrustDomainRequest[]>([]);
  const [allowlist, setAllowlist] = useState<TrustDomainEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [p, a] = await Promise.all([
        adminApi.listTrustRequests('pending'),
        adminApi.listTrustAllowlist(),
      ]);
      setPending(p.requests);
      setAllowlist(a.entries);
    } catch (e) { setError((e as Error).message); }
  }

  useEffect(() => { refresh(); }, []);

  async function approve(id: number) {
    setBusy(true);
    try { await adminApi.approveTrustRequest(id); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function reject(id: number) {
    if (!confirm('Reject this trust-domain request?')) return;
    setBusy(true);
    try { await adminApi.rejectTrustRequest(id); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function revoke(domain: string) {
    if (!confirm(`Revoke trust-allowlist entry for "${domain}"? Schools using that domain will no longer be able to verify.`)) return;
    setBusy(true);
    try { await adminApi.revokeTrustEntry(domain); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section>
      <h2>Trust-domain allowlist</h2>
      <p className="muted">
        When a school admin tries to verify with an email that doesn't match the
        school's GIAS-registered domain (common for academy trusts), we route the
        request here instead of silently blocking. Approving an entry adds the
        domain to the allowlist so future verifications succeed automatically.
      </p>

      {error && <div className="alert alert--error">{error}</div>}

      <h3 style={{ marginTop: '1.5rem' }}>Pending requests ({pending.length})</h3>
      {pending.length === 0 ? (
        <p className="muted">Nothing pending.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr><th>Domain</th><th>Requested by</th><th>For school</th><th>Notes</th><th>Created</th><th></th></tr>
          </thead>
          <tbody>
            {pending.map((r) => (
              <tr key={r.id}>
                <td><code>{r.domain}</code></td>
                <td>{r.requested_email}</td>
                <td>{r.requested_for_urn ?? '—'}</td>
                <td><small>{r.notes}</small></td>
                <td><small>{r.created_at}</small></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn" onClick={() => approve(r.id)} disabled={busy}>Approve</button>
                  <button className="btn btn--secondary" onClick={() => reject(r.id)} disabled={busy} style={{ marginLeft: '0.25rem' }}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ marginTop: '2rem' }}>Approved allowlist ({allowlist.length})</h3>
      {allowlist.length === 0 ? (
        <p className="muted">No domains approved yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr><th>Domain</th><th>Approved by</th><th>Approved at</th><th>Notes</th><th></th></tr>
          </thead>
          <tbody>
            {allowlist.map((e) => (
              <tr key={e.domain}>
                <td><code>{e.domain}</code></td>
                <td><small>{e.approved_by}</small></td>
                <td><small>{e.approved_at}</small></td>
                <td><small>{e.notes}</small></td>
                <td><button className="btn btn--secondary" onClick={() => revoke(e.domain)} disabled={busy}>Revoke</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
