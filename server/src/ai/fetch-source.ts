/* SSRF-safe URL fetcher for AI re-write source URLs.
 *
 * Constraints from the brief ("URL-fetch safety controls"):
 *   - HTTPS only
 *   - Block private/internal address ranges (RFC1918, link-local 169.254.0.0/16,
 *     IPv6 ULA fc00::/7, localhost, 0.0.0.0) — resolve hostnames first
 *   - Hard timeout (10s) and size cap (1 MB)
 *   - Set a clear User-Agent
 *   - Strip HTML to text before returning
 *
 * Out of scope for v1 (note for future): robots.txt enforcement and follow-up
 * redirects need their own SSRF check at each hop. We disable redirects entirely
 * here — safer default. */

import dns from 'node:dns/promises';
import net from 'node:net';
import { request } from 'undici';

const USER_AGENT = 'entitledto-fsm-leaflet-bot/1.0 (https://fsm-leaflet.onrender.com)';
const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 10_000;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === undefined || b === undefined) return true;
  if (a === 10) return true;                                  // 10.0.0.0/8
  if (a === 127) return true;                                 // loopback
  if (a === 0) return true;                                   // 0.0.0.0/8
  if (a === 169 && b === 254) return true;                    // link-local
  if (a === 172 && b >= 16 && b <= 31) return true;           // 172.16.0.0/12
  if (a === 192 && b === 168) return true;                    // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true;          // 100.64.0.0/10 (CGNAT)
  if (a >= 224) return true;                                  // multicast / reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  // fc00::/7 — ULA
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  // fe80::/10 — link-local
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
  // IPv4-mapped (::ffff:a.b.c.d)
  const m = lower.match(/^::ffff:([0-9.]+)$/);
  if (m && m[1]) return isPrivateIPv4(m[1]);
  return false;
}

function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // unknown family — refuse
}

export class SsrfError extends Error {
  constructor(msg: string) { super(msg); this.name = 'SsrfError'; }
}

async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try { url = new URL(rawUrl); }
  catch { throw new SsrfError('Invalid URL.'); }

  if (url.protocol !== 'https:') {
    throw new SsrfError('Only https:// URLs are allowed.');
  }
  if (!url.hostname || url.hostname === 'localhost') {
    throw new SsrfError('Localhost is not allowed.');
  }

  // Reject literal IPs in the hostname only if they're private.
  if (net.isIP(url.hostname) && isPrivateAddress(url.hostname)) {
    throw new SsrfError('Private IP literals are not allowed.');
  }

  // Resolve and check each A/AAAA record.
  const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (records.length === 0) {
    throw new SsrfError('Could not resolve hostname.');
  }
  for (const r of records) {
    if (isPrivateAddress(r.address)) {
      throw new SsrfError(`Refusing to fetch — ${url.hostname} resolves to a private/internal address (${r.address}).`);
    }
  }

  return url;
}

/* Crude HTML → text. Strips scripts/styles entirely, decodes a handful of common
 * entities, collapses whitespace. Not a full implementation — we're not running
 * a DOM parser server-side — but enough to send a clean, attribute-free body to
 * the model. Bad input is bounded by the size cap so we don't blow context. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?(p|div|br|h[1-6]|li|tr|td|th)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export type FetchedSource = {
  url: string;
  text: string;
  byte_count: number;
};

export async function fetchSourceUrl(rawUrl: string): Promise<FetchedSource> {
  const url = await assertSafeUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await request(url.toString(), {
      method: 'GET',
      headers: { 'user-agent': USER_AGENT, accept: 'text/html, text/plain' },
      signal: controller.signal,
    });
    if (res.statusCode >= 400) {
      throw new SsrfError(`Source URL returned HTTP ${res.statusCode}.`);
    }

    // Read up to MAX_BYTES then stop. The cap protects context budget AND
    // limits resource exhaustion attacks via huge response bodies.
    const reader = res.body;
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of reader) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      total += buf.length;
      if (total > MAX_BYTES) {
        try { reader.destroy?.(); } catch { /* ignore */ }
        break;
      }
      chunks.push(buf);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    const text = htmlToText(raw);
    return { url: url.toString(), text, byte_count: total };
  } finally {
    clearTimeout(timer);
  }
}
