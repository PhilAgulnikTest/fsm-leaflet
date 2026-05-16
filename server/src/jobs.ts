/* Background jobs that run inside the server process.
 *
 * Render free tier doesn't have a separate cron primitive available, so we use
 * setInterval inside the long-running web service. For one tiny purge job
 * that's fine; if the job list grows we'd move to a proper scheduler. */

import { db } from './db/index.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

function purgeExpiredAiSource(): void {
  // Brief: source_text/source_url retain 30 days by default. We blank the
  // PII fields rather than deleting the row so the audit trail (mode, output,
  // warnings, accepted flag, token counts) stays intact. The hash is kept so
  // duplicate detection can still work.
  const result = db
    .prepare(
      `UPDATE ai_rewrites
          SET source_text = NULL,
              source_url = NULL
        WHERE purge_after IS NOT NULL
          AND purge_after < datetime('now')
          AND (source_text IS NOT NULL OR source_url IS NOT NULL)`
    )
    .run();
  if (result.changes > 0) {
    console.log(`PII purge: cleared source on ${result.changes} ai_rewrites rows past their retention window.`);
  }
}

function purgeExpiredMagicLinks(): void {
  // Magic links are short-lived (15min). Clear used + expired rows daily so
  // the table doesn't accumulate junk.
  const result = db
    .prepare(
      `DELETE FROM magic_links
        WHERE used_at IS NOT NULL
           OR expires_at < datetime('now', '-1 day')`
    )
    .run();
  if (result.changes > 0) {
    console.log(`Cleared ${result.changes} stale magic_links rows.`);
  }
}

function purgeExpiredSessions(): void {
  const result = db
    .prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`)
    .run();
  if (result.changes > 0) {
    console.log(`Cleared ${result.changes} expired sessions.`);
  }
}

export function startBackgroundJobs(): void {
  // Run once at boot (cheap), then hourly.
  const tick = () => {
    try { purgeExpiredAiSource(); } catch (err) { console.error('purgeExpiredAiSource failed:', err); }
    try { purgeExpiredMagicLinks(); } catch (err) { console.error('purgeExpiredMagicLinks failed:', err); }
    try { purgeExpiredSessions(); } catch (err) { console.error('purgeExpiredSessions failed:', err); }
  };
  tick();
  setInterval(tick, ONE_HOUR_MS).unref();
}
