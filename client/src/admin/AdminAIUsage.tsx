import { useEffect, useState } from 'react';
import { adminApi } from './adminApi';

type Totals = { total_calls: number; accepted_calls: number; accepted_with_warnings: number; total_warnings: number; input_tokens: number; output_tokens: number };
type PerLA = { la_slug: string; calls: number; input_tokens: number; output_tokens: number };
type DayRow = { day: string; calls: number; tokens: number };
type Recent = {
  id: number; customization_id: number | null; la_slug: string | null; section_key: string;
  mode: 'rewrite' | 'translate'; target_language: string | null;
  output_preview: string; warning_count: number;
  accepted: number; accepted_with_warnings: number;
  input_tokens: number | null; output_tokens: number | null;
  created_at: string;
};

// Rough cost estimate for Claude Sonnet 4.6 (Mar 2026 public list price). Tokens
// add input + output; cost per million quoted in USD. Adjust if pricing shifts.
const SONNET_INPUT_PER_M = 3;
const SONNET_OUTPUT_PER_M = 15;
function estimateUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * SONNET_INPUT_PER_M + (outputTokens / 1_000_000) * SONNET_OUTPUT_PER_M;
}
const fmtUsd = (n: number) => '$' + (n < 0.01 ? n.toFixed(4) : n.toFixed(2));
const fmtNum = (n: number | null | undefined) => n == null ? '—' : n.toLocaleString();

export function AdminAIUsage() {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [perLa, setPerLa] = useState<PerLA[]>([]);
  const [last30, setLast30] = useState<DayRow[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([adminApi.aiUsage(), adminApi.aiUsageRecent()])
      .then(([u, r]) => {
        setTotals(u.totals);
        setPerLa(u.per_la);
        setLast30(u.last_30_days);
        setRecent(r.recent);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <div className="alert alert--error">{error}</div>;
  if (!totals) return <p className="muted">Loading…</p>;

  const totalTokens = (totals.input_tokens ?? 0) + (totals.output_tokens ?? 0);
  const totalCost = estimateUsd(totals.input_tokens ?? 0, totals.output_tokens ?? 0);

  return (
    <section>
      <h2>AI usage & cost</h2>
      <p className="muted">
        Captured per call in <code>ai_rewrites</code>. Cost estimates use Claude Sonnet 4.6 list pricing
        (${SONNET_INPUT_PER_M}/M input, ${SONNET_OUTPUT_PER_M}/M output) — actual invoice may differ.
      </p>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat__label">Total calls</div>
          <div className="stat__value">{fmtNum(totals.total_calls)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Accepted</div>
          <div className="stat__value">{fmtNum(totals.accepted_calls)}</div>
          <div className="stat__sub">{fmtNum(totals.accepted_with_warnings)} with warnings</div>
        </div>
        <div className="stat">
          <div className="stat__label">Total tokens</div>
          <div className="stat__value">{fmtNum(totalTokens)}</div>
          <div className="stat__sub">in {fmtNum(totals.input_tokens)} / out {fmtNum(totals.output_tokens)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Estimated cost</div>
          <div className="stat__value">{fmtUsd(totalCost)}</div>
        </div>
      </div>

      <h3 style={{ marginTop: '2rem' }}>Per LA</h3>
      {perLa.length === 0 ? (
        <p className="muted">No AI calls yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr><th>LA</th><th>Calls</th><th>Input tokens</th><th>Output tokens</th><th>Est. cost</th></tr>
          </thead>
          <tbody>
            {perLa.map((row) => (
              <tr key={row.la_slug}>
                <td><code>{row.la_slug}</code></td>
                <td>{fmtNum(row.calls)}</td>
                <td>{fmtNum(row.input_tokens)}</td>
                <td>{fmtNum(row.output_tokens)}</td>
                <td>{fmtUsd(estimateUsd(row.input_tokens ?? 0, row.output_tokens ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ marginTop: '2rem' }}>Last 30 days</h3>
      {last30.length === 0 ? (
        <p className="muted">No activity in the last 30 days.</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>Day</th><th>Calls</th><th>Tokens</th></tr></thead>
          <tbody>
            {last30.map((row) => (
              <tr key={row.day}>
                <td>{row.day}</td>
                <td>{fmtNum(row.calls)}</td>
                <td>{fmtNum(row.tokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ marginTop: '2rem' }}>Recent calls</h3>
      {recent.length === 0 ? (
        <p className="muted">No calls logged yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr><th>When</th><th>LA</th><th>Section</th><th>Mode</th><th>Warnings</th><th>Accepted</th><th>Output preview</th></tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td><small>{r.created_at}</small></td>
                <td><small>{r.la_slug ?? '—'}</small></td>
                <td><small>{r.section_key}</small></td>
                <td>{r.mode === 'translate' ? `🌐 ${r.target_language ?? ''}` : '✨'}</td>
                <td>{r.warning_count > 0 ? <span style={{ color: 'var(--accent)' }}>⚠ {r.warning_count}</span> : '0'}</td>
                <td>{r.accepted ? (r.accepted_with_warnings ? '✓ (w/ warnings)' : '✓') : '—'}</td>
                <td style={{ maxWidth: '20rem' }}><small>{r.output_preview}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
