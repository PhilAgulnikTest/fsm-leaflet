/* Domain-check logic for the three auth tiers.
 *
 * SCHOOL — derive the expected email domain from the GIAS row for the URN
 * (SchoolEmail + SchoolWebsite), accept exact match or subdomain match.
 *   - falls back to the trust_domain_allowlist for academy-trust domains
 *     approved out-of-band by platform admins
 *   - if no match, returns ok=false plus a `requestable_domain` so the
 *     client can offer the request-allowlist flow
 *
 * LA — soft warning if the requested email isn't on a *.gov.uk domain.
 *   No blocking, no allowlist — *.gov.uk is the convention, not a hard rule.
 *
 * PLATFORM-ADMIN — always allowed if the email matches an existing
 *   platform_admins row (the password check happens elsewhere). */

import { db } from '../db/index.js';

export type SchoolDomainCheck =
  | { ok: true; matched: string; via: 'gias-email' | 'gias-website' | 'trust-allowlist' }
  | { ok: false; reason: 'no_gias_data' | 'domain_mismatch'; expected: string[]; requestable_domain: string | null };

function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase();
}

function websiteDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isSubdomainOf(candidate: string, root: string): boolean {
  if (candidate === root) return true;
  return candidate.endsWith('.' + root);
}

function registrableRoot(domain: string): string {
  // Quick-and-dirty effective TLD heuristic. Enough for UK school/trust
  // domains; would need the Public Suffix List for non-UK robustness later.
  const parts = domain.split('.');
  // .sch.uk and .ac.uk: take last 3 parts.
  if (parts.length >= 3 && /^(sch|ac|gov|co|org|net)\.uk$/i.test(parts.slice(-2).join('.'))) {
    return parts.slice(-3).join('.');
  }
  if (parts.length >= 2) return parts.slice(-2).join('.');
  return domain;
}

export function checkSchoolDomain(urn: string, email: string): SchoolDomainCheck {
  const domain = emailDomain(email);
  if (!domain) {
    return { ok: false, reason: 'domain_mismatch', expected: [], requestable_domain: null };
  }

  const school = db
    .prepare('SELECT email, website FROM schools WHERE urn = ?')
    .get(urn) as { email: string | null; website: string | null } | undefined;

  if (!school) {
    return { ok: false, reason: 'no_gias_data', expected: [], requestable_domain: domain };
  }

  const expected: string[] = [];
  const giasEmailDomain = school.email ? emailDomain(school.email) : null;
  const giasWebsiteDomain = websiteDomain(school.website);
  if (giasEmailDomain) expected.push(giasEmailDomain);
  if (giasWebsiteDomain && giasWebsiteDomain !== giasEmailDomain) expected.push(giasWebsiteDomain);

  for (const exp of expected) {
    if (isSubdomainOf(domain, exp)) {
      return { ok: true, matched: exp, via: exp === giasEmailDomain ? 'gias-email' : 'gias-website' };
    }
  }

  // Trust-domain allowlist — approved academy-trust domains route around the GIAS check.
  const root = registrableRoot(domain);
  const trustHit = db
    .prepare('SELECT domain FROM trust_domain_allowlist WHERE domain = ? OR domain = ?')
    .get(domain, root) as { domain: string } | undefined;
  if (trustHit) {
    return { ok: true, matched: trustHit.domain, via: 'trust-allowlist' };
  }

  return {
    ok: false,
    reason: 'domain_mismatch',
    expected,
    // Suggest the registrable root (e.g. "ark.org.uk" from "head@school.ark.org.uk")
    // so platform admins approve the trust at the right level.
    requestable_domain: root,
  };
}

export type LaDomainCheck = { ok: true } | { ok: true; warning: string };

export function checkLaDomain(email: string): LaDomainCheck {
  const domain = emailDomain(email);
  if (!domain || !domain.endsWith('.gov.uk')) {
    return {
      ok: true,
      warning:
        'This email is not on a *.gov.uk domain. We will still send the link, ' +
        'but most UK councils use *.gov.uk addresses — double-check this is correct.',
    } as LaDomainCheck;
  }
  return { ok: true };
}
