/* Playwright-backed PDF rendering.
 *
 * Browser launches are expensive (~500 ms cold). We keep a singleton Chromium
 * instance for the lifetime of the server process and create a fresh context
 * per request — that way the request path is sub-second after first use and
 * we avoid the per-launch race that triggers "browser has been closed" errors
 * when launches overlap. */

import { chromium, type Browser } from 'playwright';

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
    browserPromise.catch(() => { browserPromise = null; });
  }
  const b = await browserPromise;
  // Auto-recover if the browser exited (crash, OS killed it, etc).
  if (!b.isConnected()) {
    browserPromise = null;
    return getBrowser();
  }
  return b;
}

export async function htmlToPdf(html: string, baseUrl: string): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.newContext({ baseURL: baseUrl });
  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  } finally {
    await context.close();
  }
}

export async function shutdownBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    if (b) await b.close();
  }
}
