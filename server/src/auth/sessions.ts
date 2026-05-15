/* Session helpers — read/write the `sessions` table.
 *
 * A session row grants edit access scoped to a specific customization (school
 * or LA flow). Cookie name is fsm_sid; HttpOnly + SameSite=Lax. */

import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import { generateSessionId, sessionExpiry } from './tokens.js';

export const SESSION_COOKIE = 'fsm_sid';

export type SessionScope = 'school' | 'la' | 'platform-admin';

export type Session = {
  id: string;
  email: string;
  scope: SessionScope;
  customization_id: number | null;
  school_urn: string | null;
  la_slug: string | null;
  expires_at: string;
};

export function createSession(input: {
  email: string;
  scope: SessionScope;
  customization_id?: number | null;
  school_urn?: string | null;
  la_slug?: string | null;
}): Session {
  const id = generateSessionId();
  const expires_at = sessionExpiry();
  db.prepare(`
    INSERT INTO sessions (id, email, scope, customization_id, school_urn, la_slug, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.email,
    input.scope,
    input.customization_id ?? null,
    input.school_urn ?? null,
    input.la_slug ?? null,
    expires_at
  );
  return {
    id,
    email: input.email,
    scope: input.scope,
    customization_id: input.customization_id ?? null,
    school_urn: input.school_urn ?? null,
    la_slug: input.la_slug ?? null,
    expires_at,
  };
}

export function loadSession(id: string): Session | null {
  const row = db
    .prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')")
    .get(id) as Session | undefined;
  return row ?? null;
}

export function deleteSession(id: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function setSessionCookie(res: Response, session: Session): void {
  res.cookie(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(session.expires_at),
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

declare module 'express-serve-static-core' {
  interface Request {
    session?: Session;
  }
}

export function attachSession(req: Request, _res: Response, next: () => void): void {
  const id = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
  if (id) {
    const s = loadSession(id);
    if (s) req.session = s;
  }
  next();
}

export function requireSession(scope: SessionScope) {
  return (req: Request, res: Response, next: () => void) => {
    if (!req.session || req.session.scope !== scope) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    next();
  };
}
