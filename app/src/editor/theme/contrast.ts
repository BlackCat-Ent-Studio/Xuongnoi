/** WCAG contrast helpers used to pick readable ink for a coloured card header. Pure, no DOM. */

export const INK_LIGHT = '#ffffff';
export const INK_DARK = '#10151b';
/** Minimum contrast of body text against its background (WCAG AA). */
export const MIN_TEXT_CONTRAST = 4.5;

/** Parses `#rgb` or `#rrggbb`; null for anything else. */
export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let v = m[1]!;
  if (v.length === 3) v = [...v].map((c) => c + c).join('');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

const linear = (v: number): number => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Relative luminance (0 black .. 1 white). */
export function luminance(rgb: readonly [number, number, number]): number {
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}

/** Contrast ratio of two hex colours (1 .. 21); NaN when either is not a hex colour. */
export function contrastRatio(a: string, b: string): number {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return Number.NaN;
  const la = luminance(x);
  const lb = luminance(y);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** White when it reads on `background` (>= 4.5), otherwise the near-black ink. Unknown colours get the dark ink. */
export function inkOn(background: string): string {
  return contrastRatio(INK_LIGHT, background) >= MIN_TEXT_CONTRAST ? INK_LIGHT : INK_DARK;
}
