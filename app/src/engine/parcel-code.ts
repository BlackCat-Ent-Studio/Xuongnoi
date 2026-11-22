import type { PortValue } from './types';

/**
 * The code number a parcel carries ("Mã"): a whole number from 1 to 99.
 *
 * It lives in the item's goods type ("Loại hàng") as plain digits, so every piece that already filters by goods type
 * also works with codes, and "Đọc mã" reads it back as a number. A carton look also carries the code after a `#`
 * (`parcel-carton#7`), which is how the drawing learns which number to print; a look without the suffix is drawn
 * exactly as before.
 */
export const PARCEL_CODE_MIN = 1;
export const PARCEL_CODE_MAX = 99;

const DIGITS = /^\d{1,2}$/;
const LOOK_CODE = /^(.*)#(\d{1,2})$/;

/** The code written in a goods type: 0 when it is empty, not a whole number, or outside 1..99. */
export function parcelCodeOfTag(tag: string): number {
  const text = tag.trim();
  if (!DIGITS.test(text)) return 0;
  const n = Number(text);
  return n >= PARCEL_CODE_MIN && n <= PARCEL_CODE_MAX ? n : 0;
}

/** The code a wire carries: the number rounded, or 0 when it is not a number or outside 1..99. */
export function parcelCodeOfValue(v: PortValue | undefined): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  const n = Math.round(v);
  return n >= PARCEL_CODE_MIN && n <= PARCEL_CODE_MAX ? n : 0;
}

/** Goods type of a parcel with this code ('' for none). */
export const parcelCodeTag = (code: number): string => (code > 0 ? String(code) : '');

/** The carton is the only parcel look that prints the code. */
const PRINTS_CODE = 'parcel-carton';

/** Adds the code to a look that can print it; any other look, and code 0, come back untouched. */
export function lookWithCode(spec: { look?: string }, code: number): { look?: string } {
  return code > 0 && spec.look === PRINTS_CODE ? { look: `${PRINTS_CODE}#${code}` } : spec;
}

/** Splits a look into its plain name and the code it carries (0 for none). */
export function splitLookCode(look: string): { look: string; code: number } {
  const m = LOOK_CODE.exec(look);
  if (!m || m[1] !== PRINTS_CODE) return { look, code: 0 };
  const code = parcelCodeOfTag(m[2] ?? '');
  return code > 0 ? { look: PRINTS_CODE, code } : { look, code: 0 };
}

/**
 * Whether the printed number needs a line under it: it reads as a different number when the carton is turned half
 * round (6 and 9, 16 and 91, 18 and 81...). Numbers that read the same either way (8, 11, 69) need none.
 */
export function codeNeedsUnderline(code: number): boolean {
  const turned: Record<string, string> = { '0': '0', '1': '1', '6': '9', '8': '8', '9': '6' };
  const text = String(code);
  let other = '';
  for (const d of text) {
    const t = turned[d];
    if (t === undefined) return false;
    other = t + other;
  }
  return other !== text;
}
