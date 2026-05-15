/* Magic-link tokens.
 *
 * The token sent in the email link is a URL-safe random string. We never store
 * it directly — only sha256(token), so a DB leak doesn't reveal active links.
 * Single-use, 15-minute expiry, enforced at verify time. */

import { randomBytes, createHash } from 'node:crypto';

export type MagicLinkScope = 'school' | 'la' | 'platform-admin';

export function generateToken(): string {
  // 32 bytes = 256 bits. Base64url so it's safe to drop in a URL without
  // percent-encoding.
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateSessionId(): string {
  // 32-byte hex. Distinct from the magic-link token format so logs/DB rows
  // are easy to tell apart at a glance.
  return randomBytes(32).toString('hex');
}

export const MAGIC_LINK_TTL_MINUTES = 15;
export const SESSION_TTL_HOURS = 8;

export function magicLinkExpiry(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + MAGIC_LINK_TTL_MINUTES);
  return now.toISOString();
}

export function sessionExpiry(): string {
  const now = new Date();
  now.setHours(now.getHours() + SESSION_TTL_HOURS);
  return now.toISOString();
}
