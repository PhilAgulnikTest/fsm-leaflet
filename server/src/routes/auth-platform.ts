/* Platform-admin password login.
 *
 * Brief constraints: bcrypt, 12 rounds minimum, lockout after 5 failed
 * attempts, no public registration — admins added via env var or CLI.
 * The env-var bootstrap creates entries on first login if the email is in
 * PLATFORM_ADMIN_EMAILS and a password is supplied (set-on-first-login flow
 * is for a later iteration; for now the bootstrap CLI seeds a known
 * password). */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { createSession, setSessionCookie } from '../auth/sessions.js';

export const platformAuthRouter = Router();

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

platformAuthRouter.post('/login', async (req, res) => {
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: 'email_and_password_required' });

  const normalizedEmail = email.toLowerCase();
  if (!config.platformAdminEmails.includes(normalizedEmail)) {
    return res.status(403).json({ error: 'not_an_admin' });
  }

  const admin = db
    .prepare(
      `SELECT id, email, password_hash, failed_login_count, locked_until
         FROM platform_admins WHERE email = ?`
    )
    .get(normalizedEmail) as
    | { id: number; email: string; password_hash: string; failed_login_count: number; locked_until: string | null }
    | undefined;

  if (!admin) {
    return res.status(403).json({ error: 'not_initialized', hint: 'Run `npm run admin:set-password -w server` to bootstrap.' });
  }

  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    return res.status(429).json({ error: 'locked_out', until: admin.locked_until });
  }

  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) {
    const failed = admin.failed_login_count + 1;
    const locked = failed >= LOCKOUT_THRESHOLD;
    db.prepare(`
      UPDATE platform_admins
         SET failed_login_count = ?, locked_until = ?
       WHERE id = ?
    `).run(
      locked ? 0 : failed,
      locked ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null,
      admin.id
    );
    return res.status(401).json({ error: locked ? 'locked_out' : 'wrong_password' });
  }

  db.prepare(`
    UPDATE platform_admins
       SET failed_login_count = 0, locked_until = NULL, last_login_at = datetime('now')
     WHERE id = ?
  `).run(admin.id);

  const session = createSession({ email: admin.email, scope: 'platform-admin' });
  setSessionCookie(res, session);
  res.json({ ok: true, email: admin.email });
});
