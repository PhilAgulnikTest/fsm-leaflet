/* Sentry wiring. No-op when SENTRY_DSN is unset, so dev runs stay quiet.
 *
 * Init order matters: must run before Express is constructed so the SDK can
 * patch HTTP / Express layers. We call this at the very top of index.ts. */

import * as Sentry from '@sentry/node';
import { config } from './config.js';

let initialized = false;

export function initSentry(): boolean {
  if (initialized) return true;
  if (!config.sentryDsn) return false;
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: 0.1,           // 10% perf sampling — cheap
    sendDefaultPii: false,           // never auto-send PII; we explicitly capture what we need
    release: process.env.RENDER_GIT_COMMIT ?? undefined,
  });
  initialized = true;
  console.log('Sentry initialised.');
  return true;
}

export const sentry = Sentry;
