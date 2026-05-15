/* WCAG 2.1 contrast-ratio check.
 * Used on LA-client CSV upload and manual add/edit to reject brand colours
 * that would fail AA against the white and dark text the leaflet uses. */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  let v = m[1]!;
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(hexA: string, hexB: string): number | null {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return null;
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type ContrastReport = {
  ok: boolean;
  ratios: { vsWhite: number | null; vsBlack: number | null };
  notes: string[];
};

/** Check a brand colour against the backgrounds the leaflet places it on.
 *  The hero block uses brand-as-background with WHITE text → ratio vs white must hit AA.
 *  Headings use brand-as-text on WHITE background → ratio vs white again.
 *  Threshold: 4.5:1 (WCAG 2.1 AA for normal text). */
export function checkBrandColour(brandHex: string): ContrastReport {
  const vsWhite = contrastRatio(brandHex, '#ffffff');
  const vsBlack = contrastRatio(brandHex, '#000000');
  const notes: string[] = [];

  if (vsWhite == null) {
    return { ok: false, ratios: { vsWhite: null, vsBlack: null }, notes: ['Invalid hex colour.'] };
  }

  // Brand is used as a background with white text (hero block) AND as text on white
  // (headings, links). Both directions are the same ratio, so one check is enough.
  if (vsWhite < 4.5) {
    notes.push(
      `Brand colour ${brandHex} only achieves a ${vsWhite.toFixed(2)}:1 ratio against white — WCAG AA needs ≥4.5:1.`
    );
  }
  return {
    ok: vsWhite >= 4.5,
    ratios: { vsWhite, vsBlack },
    notes,
  };
}
