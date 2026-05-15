import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '..');

// Load .env from the repo root first, then fall back to server/.env if present.
// This lets `npm run <script> -w server` (cwd = server/) and root scripts
// share a single .env file.
dotenv.config({ path: path.resolve(repoRoot, '.env') });
dotenv.config({ path: path.resolve(serverRoot, '.env') });

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databasePath: path.resolve(serverRoot, process.env.DATABASE_PATH ?? './data/fsm.db'),
  // Used to bake URLs into QR codes and magic-link emails. Prefer an explicit
  // PUBLIC_BASE_URL; on Render the platform sets RENDER_EXTERNAL_URL automatically.
  publicBaseUrl:
    process.env.PUBLIC_BASE_URL ??
    process.env.RENDER_EXTERNAL_URL ??
    'http://localhost:4000',
  platformAdminEmails: (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  emailProvider: process.env.EMAIL_PROVIDER ?? 'none',
  emailFrom: process.env.EMAIL_FROM ?? 'fsm-leaflet@entitledto.co.uk',
  sentryDsn: process.env.SENTRY_DSN ?? '',
  paths: {
    serverRoot,
    repoRoot,
    templates: path.resolve(repoRoot, 'templates'),
    giasData: path.resolve(serverRoot, 'data', 'gias'),
    migrations: path.resolve(serverRoot, 'src', 'db', 'migrations'),
  },
};
