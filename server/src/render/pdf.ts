/* Playwright-backed PDF rendering.
 *
 * Strategy: load the leaflet by URL (page.goto), not by setContent. The
 * leaflet HTML references its stylesheet with a server-relative href, so
 * setContent + about:blank origin gave us an unstyled render in the PDF.
 * Hitting the server's own URL via Playwright runs the page exactly as a
 * browser would, CSS and all.
 *
 * Chromium binary: Render's Docker image installs alpine chromium at
 * /usr/bin/chromium-browser and sets PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to
 * point Playwright at it (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 means
 * Playwright's bundled chromium-headless-shell isn't downloaded). Locally
 * Playwright's bundled chromium is used. */

import { chromium, type Browser } from 'playwright';

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      // Alpine chromium needs --no-sandbox when running as root inside a container.
      args: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? ['--no-sandbox'] : undefined,
    });
    browserPromise.catch(() => { browserPromise = null; });
  }
  const b = await browserPromise;
  if (!b.isConnected()) {
    browserPromise = null;
    return getBrowser();
  }
  return b;
}

/** Load the given URL in headless Chromium and return a PDF buffer. */
export async function urlToPdf(url: string): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
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

/** Back-compat shim so callers that still pass raw HTML don't break. New code
 *  should use urlToPdf — the URL path resolves stylesheets and inline assets
 *  the way a real browser would. */
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
