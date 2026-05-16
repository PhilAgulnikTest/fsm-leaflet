// Sentry must initialise before Express imports so its instrumentation patches
// the right modules. Side-effect import is intentional.
import { initSentry, sentry } from './observability.js';
initSentry();

import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';
import { db } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { templatesRouter } from './routes/templates.js';
import { laClientsRouter } from './routes/la-clients.js';
import { schoolsRouter } from './routes/schools.js';
import { customizationsRouter } from './routes/customizations.js';
import { renderRouter } from './routes/render.js';
import { authRouter } from './routes/auth.js';
import { platformAuthRouter } from './routes/auth-platform.js';
import { adminRouter } from './routes/admin.js';
import { aiRouter } from './routes/ai.js';
import { attachSession } from './auth/sessions.js';
import { startBackgroundJobs } from './jobs.js';

// Run pending migrations on boot. Cheap, idempotent, prevents the "forgot to migrate" footgun.
const migrationResult = runMigrations();
if (migrationResult.applied.length > 0) {
  console.log(`Applied migrations: ${migrationResult.applied.join(', ')}`);
}

// Self-seed on every boot. Independent checks per data type — so re-runs don't
// need to be "all or nothing". All upserts are idempotent.
async function autoSeed() {
  const templateCount = (db.prepare('SELECT COUNT(*) AS n FROM templates').get() as { n: number }).n;
  if (templateCount === 0) {
    console.log('Templates table empty — running seed.ts...');
    try { await import('./db/seed.js'); console.log('Templates + Lambeth seeded.'); }
    catch (err) { console.error('Template seed failed:', err); }
  }

  // Sites CSV: run when LA count is below the CSV's row count. Idempotent via
  // upsert-by-slug, so re-importing on every boot is safe — but checking lets
  // us skip when the DB already reflects the CSV (saves ~150 ms).
  const laCount = (db.prepare('SELECT COUNT(*) AS n FROM la_clients').get() as { n: number }).n;
  const SITES_CSV_EXPECTED = 149;
  if (laCount < SITES_CSV_EXPECTED) {
    const sitesPath = path.resolve(config.paths.repoRoot, 'reference', 'sites-csv.csv');
    if (fs.existsSync(sitesPath)) {
      try {
        const { importEntitledtoSites } = await import('./db/import-entitledto-sites.js');
        const result = importEntitledtoSites(sitesPath);
        console.log(`Sites CSV imported: ${result.imported} LAs (${result.placeholders} placeholders, ${result.skipped.length} skipped).`);
      } catch (err) {
        console.error('Sites import failed:', err);
      }
    } else {
      console.log(`Sites CSV not found at ${sitesPath} — skipping LA import.`);
    }
  }

  // Tag known non-England LAs so the customise dropdown can filter to England
  // (brief: v1 is England-only). Idempotent — only re-tags rows still on the
  // default 'england' value, so manual admin edits aren't trampled.
  try {
    const { tagLARegions } = await import('./db/tag-la-regions.js');
    const { updated } = tagLARegions();
    if (updated > 0) console.log(`Tagged ${updated} LAs as non-England.`);
  } catch (err) {
    console.error('LA region tagging failed:', err);
  }
}
await autoSeed();

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(attachSession);

// Static — leaflet template CSS lives in /templates and the rendered HTML
// references it directly. Anything else under /templates is also served as-is.
app.use('/templates', express.static(config.paths.templates, { maxAge: '1h', index: false }));

// Health check — used by hosting platforms and Pass B observability.
app.get('/healthz', (_req, res) => {
  const schoolCount = (db.prepare('SELECT COUNT(*) AS n FROM schools').get() as { n: number }).n;
  const templateCount = (db.prepare('SELECT COUNT(*) AS n FROM templates').get() as { n: number }).n;
  const laCount = (db.prepare('SELECT COUNT(*) AS n FROM la_clients').get() as { n: number }).n;
  res.json({
    status: 'ok',
    schools: schoolCount,
    templates: templateCount,
    la_clients: laCount,
    public_base_url: config.publicBaseUrl,
  });
});

// API
app.use('/api/templates', templatesRouter);
app.use('/api/la-clients', laClientsRouter);
app.use('/api/schools', schoolsRouter);
app.use('/api/customizations', customizationsRouter);
app.use('/api/auth', authRouter);
app.use('/api/auth/platform', platformAuthRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ai', aiRouter);

// Public renders + generic template renders
app.use('/', renderRouter);

// Client build (production) or a small in-prod fallback page (dev).
const clientDist = path.resolve(config.paths.repoRoot, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '5m', index: 'index.html' }));
  app.get(/^\/(?!api|templates|c\/|generic\/|healthz).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  // Dev mode: Vite serves the client on 5173 with /api proxied. The server's
  // root just points there so people don't get a confusing blank page if they
  // hit :4000 directly.
  app.get('/', (_req, res) => {
    res.type('html').send(`
      <!doctype html><html><head><title>FSM Leaflet — dev</title>
      <style>body{font-family:system-ui;max-width:36rem;margin:3rem auto;padding:0 1rem;color:#0f172a}
      code{background:#f1f5f9;padding:2px 6px;border-radius:4px}</style></head>
      <body>
        <h1>FSM Leaflet platform — dev server</h1>
        <p>API is running on <code>http://localhost:${config.port}</code>.</p>
        <p>Open the client dev server at <a href="http://localhost:5173">http://localhost:5173</a>
           (run <code>npm run dev</code> at the repo root).</p>
        <p>Health: <a href="/healthz">/healthz</a></p>
      </body></html>
    `);
  });
}

// Final error handler — keep stack traces server-side, JSON for API, plain text otherwise.
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (config.sentryDsn) {
    sentry.captureException(err);
  }
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ error: 'internal_error' });
  } else {
    res.status(500).type('text/plain').send('Server error.');
  }
});

startBackgroundJobs();

app.listen(config.port, () => {
  console.log(`FSM Leaflet server listening on http://localhost:${config.port}`);
});
