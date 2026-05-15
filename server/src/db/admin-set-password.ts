/* CLI: bootstrap or reset a platform admin password.
 *   npm run admin:set-password -w server -- --email=phil@entitledto.co.uk --password='...'
 * The email must already be in PLATFORM_ADMIN_EMAILS (so a leaked CLI can't
 * silently grant admin to a new email). */

import bcrypt from 'bcryptjs';
import { db } from './index.js';
import { runMigrations } from './migrate.js';
import { config } from '../config.js';

runMigrations();

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

const email = arg('email')?.toLowerCase();
const password = arg('password');

if (!email || !password) {
  console.error('Usage: npm run admin:set-password -w server -- --email=<addr> --password=<pw>');
  process.exit(1);
}

if (!config.platformAdminEmails.includes(email)) {
  console.error(
    `Refusing to add ${email}: not in PLATFORM_ADMIN_EMAILS (${config.platformAdminEmails.join(', ') || '(empty)'}).`
  );
  console.error('Add the email to .env first, then re-run.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
db.prepare(`
  INSERT INTO platform_admins (email, password_hash)
  VALUES (?, ?)
  ON CONFLICT(email) DO UPDATE SET
    password_hash = excluded.password_hash,
    failed_login_count = 0,
    locked_until = NULL
`).run(email, hash);

console.log(`Set password for platform admin ${email}.`);
