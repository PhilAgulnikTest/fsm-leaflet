/* Server-side QR generation.
 * Brief constraints: error correction M, ≥4-module quiet zone, ≥25 mm printed size,
 * short-URL fallback printed below the QR. Returned as an inline data URI so the
 * caller can embed directly in the rendered leaflet HTML without a second request. */

import QRCode from 'qrcode';

export type QrOptions = {
  /** Whether the QR block is included in the print output. Defaults to false
   *  per the brief — QR sits in the editor view only unless explicitly enabled. */
  printable?: boolean;
};

export type QrBlock = {
  dataUri: string;
  shortUrl: string;
  url: string;
};

export async function generateQr(url: string): Promise<QrBlock> {
  const dataUri = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 4,                // 4-module quiet zone (brief)
    width: 240,
    color: { dark: '#0F172A', light: '#FFFFFF' },
  });
  return { dataUri, shortUrl: humanShort(url), url };
}

/** Strip the protocol/leading www. for display as a printed fallback under the QR. */
function humanShort(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

export function renderQrBlockHtml(qr: QrBlock, opts: QrOptions = {}): string {
  const adminOnly = opts.printable ? '' : ' leaflet__qr--admin-only';
  return `
    <aside class="leaflet__qr${adminOnly}" aria-label="QR code linking to the platform">
      <img src="${qr.dataUri}" alt="QR code">
      <div class="leaflet__qr-caption">
        Scan to customise this leaflet for your school or local authority.
        <span class="leaflet__qr-shorturl">${escapeHtml(qr.shortUrl)}</span>
      </div>
    </aside>
  `.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]!);
}
