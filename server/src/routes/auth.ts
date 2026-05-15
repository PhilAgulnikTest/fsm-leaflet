/* Auth routes — magic-link request/verify for the school and LA tiers, plus
 * a session introspection + logout endpoint. Platform-admin password login is
 * a separate route (auth-platform.ts) — kept apart so they can't be confused. */

import { Router } from 'express';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { generateToken, hashToken, magicLinkExpiry } from '../auth/tokens.js';
import { checkSchoolDomain, checkLaDomain } from '../auth/domains.js';
import { sendMagicLink } from '../auth/email.js';
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
} from '../auth/sessions.js';

export const authRouter = Router();

type RequestBody = {
  scope: 'school' | 'la';
  email: string;
  customization_id?: number;
  school_urn?: string;
  la_slug?: string;
};

authRouter.post('/request', async (req, res) => {
  const { scope, email, customization_id, school_urn, la_slug } = (req.body ?? {}) as RequestBody;
  if (!email || !scope) return res.status(400).json({ error: 'email_and_scope_required' });
  if (scope === 'school' && !school_urn && !customization_id) {
    return res.status(400).json({ error: 'school_urn_or_customization_id_required' });
  }
  if (scope === 'la' && !la_slug && !customization_id) {
    return res.status(400).json({ error: 'la_slug_or_customization_id_required' });
  }

  // Resolve school_urn / la_slug from customization_id if needed (the "edit URL"
  // path passes only customization_id).
  let resolvedSchoolUrn = school_urn ?? null;
  let resolvedLaSlug = la_slug ?? null;
  if (customization_id) {
    const c = db
      .prepare('SELECT school_urn, la_slug FROM customizations WHERE id = ?')
      .get(customization_id) as { school_urn: string | null; la_slug: string | null } | undefined;
    if (!c) return res.status(404).json({ error: 'customization_not_found' });
    resolvedSchoolUrn = resolvedSchoolUrn ?? c.school_urn;
    resolvedLaSlug = resolvedLaSlug ?? c.la_slug;
  }

  let warning: string | undefined;
  if (scope === 'school') {
    if (!resolvedSchoolUrn) return res.status(400).json({ error: 'school_urn_required' });
    const check = checkSchoolDomain(resolvedSchoolUrn, email);
    if (!check.ok) {
      // Surface the suggested allowlist domain so the client can offer the
      // request-allowlist flow rather than silently failing.
      return res.status(403).json({
        error: 'domain_mismatch',
        expected: check.expected,
        requestable_domain: check.requestable_domain,
      });
    }
  } else if (scope === 'la') {
    const check = checkLaDomain(email);
    if ('warning' in check) warning = check.warning;
  }

  const token = generateToken();
  db.prepare(`
    INSERT INTO magic_links (token_hash, email, scope, customization_id, school_urn, la_slug, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    hashToken(token),
    email.toLowerCase(),
    scope,
    customization_id ?? null,
    resolvedSchoolUrn,
    resolvedLaSlug,
    magicLinkExpiry()
  );

  const link = `${config.publicBaseUrl}/api/auth/verify?token=${token}`;
  await sendMagicLink({
    to: email,
    link,
    scope,
    context: resolvedLaSlug ?? resolvedSchoolUrn ?? undefined,
  });

  // In dev (no email provider) we surface the link in the JSON response so the
  // client can show a one-click button — saves the user grep-ing server logs.
  // Strictly gated on NODE_ENV so it can never leak in production.
  const dev_link = config.nodeEnv !== 'production' && config.emailProvider === 'none' ? link : undefined;

  res.json({ ok: true, sent_to: email, ttl_minutes: 15, warning, dev_link });
});

/* Consume the magic link. On success, sets the session cookie and redirects
 * the user to the appropriate flow. */
authRouter.get('/verify', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) return res.status(400).type('text/plain').send('Missing token.');

  const link = db
    .prepare(
      `SELECT id, email, scope, customization_id, school_urn, la_slug, expires_at, used_at
         FROM magic_links WHERE token_hash = ?`
    )
    .get(hashToken(token)) as
    | {
        id: number;
        email: string;
        scope: 'school' | 'la' | 'platform-admin';
        customization_id: number | null;
        school_urn: string | null;
        la_slug: string | null;
        expires_at: string;
        used_at: string | null;
      }
    | undefined;

  if (!link) return res.status(400).type('text/plain').send('Invalid magic link.');
  if (link.used_at) return res.status(400).type('text/plain').send('This magic link has already been used.');
  if (new Date(link.expires_at) < new Date()) {
    return res.status(400).type('text/plain').send('This magic link has expired. Request a new one.');
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE magic_links SET used_at = datetime('now') WHERE id = ?").run(link.id);
    return createSession({
      email: link.email,
      scope: link.scope,
      customization_id: link.customization_id,
      school_urn: link.school_urn,
      la_slug: link.la_slug,
    });
  });
  const session = tx();
  setSessionCookie(res, session);

  // Where do we land them?
  //   - If the link is keyed to a customization → land on /edit/{public_slug}
  //   - Else (initial customize) → land on the customize flow for the scope
  if (link.customization_id) {
    const c = db
      .prepare('SELECT public_slug FROM customizations WHERE id = ?')
      .get(link.customization_id) as { public_slug: string } | undefined;
    if (c) return res.redirect(`/edit/${c.public_slug}`);
  }
  if (link.scope === 'school') return res.redirect('/customize/school?verified=1');
  if (link.scope === 'la') return res.redirect('/customize/la?verified=1');
  res.redirect('/');
});

authRouter.get('/me', (req, res) => {
  if (!req.session) return res.json({ session: null });
  res.json({
    session: {
      email: req.session.email,
      scope: req.session.scope,
      customization_id: req.session.customization_id,
      school_urn: req.session.school_urn,
      la_slug: req.session.la_slug,
      expires_at: req.session.expires_at,
    },
  });
});

authRouter.post('/logout', (req, res) => {
  if (req.session) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.session.id);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

/* Request-allowlist flow — a school admin whose email domain doesn't match
 * GIAS records can ask a platform admin to add their trust domain. */
authRouter.post('/request-trust-allowlist', (req, res) => {
  const { domain, email, school_urn, notes } = (req.body ?? {}) as {
    domain?: string;
    email?: string;
    school_urn?: string;
    notes?: string;
  };
  if (!domain || !email) return res.status(400).json({ error: 'domain_and_email_required' });

  db.prepare(`
    INSERT INTO trust_domain_requests (domain, requested_email, requested_for_urn, notes)
    VALUES (?, ?, ?, ?)
  `).run(domain.toLowerCase(), email.toLowerCase(), school_urn ?? null, notes ?? '');

  // Pass B follow-on: email platform admins so they can approve quickly.
  console.log(
    `🔔 New trust-domain request: ${domain} (requested by ${email}` +
      (school_urn ? `, URN ${school_urn}` : '') +
      ')'
  );

  res.json({ ok: true });
});
