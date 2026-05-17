/* Platform-admin password login.
 *
 * Simplified to env-var auth per Phil's "just put a password on it" request.
 * Compare submitted password to process.env.ADMIN_PASSWORD (default
 * '3ntitledto'). Any email accepted; the email is recorded on the session
 * for audit. The earlier bcrypt+lockout+platform_admins approach is still
 * in the schema (platform_admins table, admin:set-password CLI) and can be
 * re-enabled later — this route is the one the login form actually hits. */

import { Router } from 'express';
import { createSession, setSessionCookie } from '../auth/sessions.js';

export const platformAuthRouter = Router();

function expectedPassword(): string {
  return process.env.ADMIN_PASSWORD ?? '3ntitledto';
}

platformAuthRouter.post('/login', (req, res) => {
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  if (!password) return res.status(400).json({ error: 'password_required' });

  if (password !== expectedPassword()) {
    return res.status(401).json({ error: 'wrong_password' });
  }

  const sessionEmail = email?.toLowerCase().trim() || 'admin@unknown';
  const session = createSession({ email: sessionEmail, scope: 'platform-admin' });
  setSessionCookie(res, session);
  res.json({ ok: true, email: sessionEmail });
});
