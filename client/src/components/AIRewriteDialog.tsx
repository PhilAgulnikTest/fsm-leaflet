/* AI rewrite dialog — opens from a section's "Re-write with AI" or "Translate"
 * button on the LA customize flow. Two-pane layout: current text on the left,
 * source/result on the right. The fact-check warnings surface ABOVE the
 * suggested copy with the contradicted phrases highlighted — so the LA admin
 * can see issues before accepting.
 *
 * Translate mode swaps "source URL/text" for a target-language picker. */

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { api } from '../api';

type Warning = { contradicted_phrase: string; fact_key: string; rationale: string };
type RewriteResult = {
  rewrite_id: number;
  output: string;
  warnings: Warning[];
  source_url_used: string | null;
  source_byte_count: number;
};

export type AIRewriteProps = {
  open: boolean;
  onClose: () => void;
  /** When mode='translate', the language ISO code accompanies the accepted text
   *  so the caller can route it into a per-language translation store rather
   *  than overwriting the English override. */
  onAccept: (rewrittenText: string, language?: string) => void;
  mode: 'rewrite' | 'translate';
  templateSlug: string;
  sectionKey: string;
  sectionLabel: string;
  currentText: string;
  customizationId?: number;
  laSlug?: string;
  laDefaultSourceUrl?: string | null;
};

const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'pl', label: 'Polish' },
  { code: 'ur', label: 'Urdu' },
  { code: 'bn', label: 'Bengali' },
  { code: 'ro', label: 'Romanian' },
  { code: 'so', label: 'Somali' },
  { code: 'ar', label: 'Arabic' },
];

function highlightWarnings(text: string, warnings: Warning[]): ReactNode {
  if (warnings.length === 0) return <>{text}</>;
  // Greedy match the longest contradicted_phrase first so substrings don't
  // mask longer matches.
  const phrases = warnings
    .map((w) => w.contradicted_phrase)
    .filter((p) => p && p !== '(verify step did not return parsable JSON)' && p !== '(verify pass failed)')
    .sort((a, b) => b.length - a.length);
  if (phrases.length === 0) return <>{text}</>;

  const pattern = new RegExp('(' + phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        phrases.some((p) => p === part) ? (
          <mark key={i} className="ai-warning-highlight" title="Contradicts FACTS — check before accepting">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function AIRewriteDialog(props: AIRewriteProps) {
  const [sourceUrl, setSourceUrl] = useState(props.laDefaultSourceUrl ?? '');
  const [sourceText, setSourceText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState(LANGUAGES[0]?.code ?? 'pl');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RewriteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (props.open) {
      setSourceUrl(props.laDefaultSourceUrl ?? '');
      setSourceText('');
      setResult(null);
      setError(null);
    }
  }, [props.open, props.laDefaultSourceUrl]);

  if (!props.open) return null;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.aiRewrite({
        template_slug: props.templateSlug,
        section_key: props.sectionKey,
        current_text: props.currentText,
        mode: props.mode,
        target_language: props.mode === 'translate' ? targetLanguage : undefined,
        source_url: props.mode === 'rewrite' ? sourceUrl || undefined : undefined,
        source_text: props.mode === 'rewrite' && !sourceUrl ? sourceText || undefined : undefined,
        customization_id: props.customizationId,
        la_slug: props.laSlug,
      });
      setResult(r);
    } catch (e) {
      const err = e as Error & { extra?: { message?: string; hint?: string; used_today?: number; daily_limit?: number } };
      const code = err.message;
      let msg = code;
      if (code === 'rate_limited' && err.extra) {
        msg = `You've used ${err.extra.used_today} of today's ${err.extra.daily_limit} AI calls for this LA. ${err.extra.hint ?? ''}`;
      } else if (err.extra?.message) {
        msg = `${code}: ${err.extra.message}`;
      }
      setError(msg);
    } finally { setBusy(false); }
  }

  async function accept(text: string) {
    if (result) {
      try { await api.acceptRewrite(result.rewrite_id); } catch { /* non-fatal */ }
    }
    props.onAccept(text, props.mode === 'translate' ? targetLanguage : undefined);
    props.onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${props.mode === 'translate' ? 'Translate' : 'Re-write'} ${props.sectionLabel}`}>
      <div className="modal">
        <header className="modal__header">
          <h3>
            {props.mode === 'translate' ? 'Translate' : 'Re-write with AI'} —{' '}
            <span className="modal__section-label">{props.sectionLabel}</span>
          </h3>
          <button className="modal__close" onClick={props.onClose} aria-label="Close">×</button>
        </header>

        <div className="modal__body">
          <div className="modal__pane">
            <h4>Current text</h4>
            <div className="modal__text-current">{props.currentText}</div>
          </div>

          <div className="modal__pane">
            {!result ? (
              props.mode === 'translate' ? (
                <>
                  <h4>Translate to</h4>
                  <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} disabled={busy}>
                    {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                  <p className="muted" style={{ marginTop: '0.5rem' }}>
                    Critical facts (dates, deadlines, eligibility rules) are pinned and verified after translation.
                  </p>
                </>
              ) : (
                <>
                  <h4>Source material</h4>
                  <div className="form-row">
                    <label htmlFor="rewrite-url">Source URL (e.g. your LA's FSM page)</label>
                    <input
                      id="rewrite-url"
                      type="url"
                      placeholder="https://council.gov.uk/free-school-meals"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      disabled={busy}
                    />
                    {props.laDefaultSourceUrl && (
                      <small className="muted">Pre-filled from your LA's default source URL.</small>
                    )}
                  </div>
                  <div className="form-row">
                    <label htmlFor="rewrite-text">Or paste source text</label>
                    <textarea
                      id="rewrite-text"
                      rows={5}
                      placeholder="Paste the existing FSM copy you want to base the re-write on..."
                      value={sourceText}
                      onChange={(e) => setSourceText(e.target.value)}
                      disabled={busy || !!sourceUrl}
                    />
                  </div>
                </>
              )
            ) : (
              <>
                {result.warnings.length > 0 && (
                  <div className="ai-warnings">
                    <h4>⚠ Fact-check flagged {result.warnings.length} issue{result.warnings.length === 1 ? '' : 's'}</h4>
                    <ul>
                      {result.warnings.map((w, i) => (
                        <li key={i}>
                          <strong>"{w.contradicted_phrase}"</strong>
                          <span className="ai-warnings__rationale"> — {w.rationale}</span>
                          {w.fact_key !== '(unknown)' && <code className="ai-warnings__fact"> ({w.fact_key})</code>}
                        </li>
                      ))}
                    </ul>
                    <p className="muted"><small>You can still accept, but check these carefully — they appear to contradict the leaflet's pinned facts.</small></p>
                  </div>
                )}
                <h4>Suggested {props.mode === 'translate' ? 'translation' : 're-write'}</h4>
                <div className="modal__text-result">
                  {highlightWarnings(result.output, result.warnings)}
                </div>
                {result.source_url_used && (
                  <p className="muted"><small>Based on {result.source_url_used} ({Math.round(result.source_byte_count / 1024)} KB).</small></p>
                )}
              </>
            )}

            {error && <div className="alert alert--error" style={{ marginTop: '0.75rem' }}>{error}</div>}
          </div>
        </div>

        <footer className="modal__footer">
          {!result ? (
            <button className="btn" onClick={run} disabled={busy || (props.mode === 'rewrite' && !sourceUrl && !sourceText)}>
              {busy ? (props.mode === 'translate' ? 'Translating…' : 'Generating…') : (props.mode === 'translate' ? 'Translate' : 'Re-write')}
            </button>
          ) : (
            <>
              <button className="btn" onClick={() => accept(result.output)}>Accept</button>
              <button className="btn btn--secondary" onClick={() => {
                const edited = window.prompt('Edit before accepting:', result.output);
                if (edited != null) accept(edited);
              }}>Edit and accept</button>
              <button className="btn btn--secondary" onClick={() => { setResult(null); setError(null); }}>Discard</button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
