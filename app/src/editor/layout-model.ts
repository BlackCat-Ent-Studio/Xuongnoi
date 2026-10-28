/** Pure sizing + persistence rules for the resizable editor layout. */

export interface LayoutSizes {
  /** Width of the right column (game view + properties), px. */
  rightW: number;
  /** Height of the game view, px. */
  gameH: number;
}

export interface LayoutBounds {
  /** Width available to palette + canvas + splitter + right column. */
  mainW: number;
  /** Height of the right column. */
  rightH: number;
}

export const LAYOUT_KEY = 'xuong-noi:layout';
export const DEFAULT_SIZES: LayoutSizes = { rightW: 420, gameH: 300 };

export const MIN_CANVAS_W = 240;
export const MIN_RIGHT_W = 280;
export const MIN_PROPS_H = 120;
export const MIN_GAME_H = 160;
export const PALETTE_W = 200;
export const SPLITTER_PX = 8;

function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

/** Keeps `v` in [min, max]; when the window is too small for the range, min wins. */
function clampRange(v: number, min: number, max: number): number {
  return Math.round(Math.min(Math.max(v, min), Math.max(min, max)));
}

export function clampRightW(v: number, b: LayoutBounds): number {
  const max = b.mainW - PALETTE_W - MIN_CANVAS_W - SPLITTER_PX;
  return clampRange(finiteOr(v, DEFAULT_SIZES.rightW), MIN_RIGHT_W, max);
}

export function clampGameH(v: number, b: LayoutBounds): number {
  const max = b.rightH - MIN_PROPS_H - SPLITTER_PX;
  return clampRange(finiteOr(v, DEFAULT_SIZES.gameH), MIN_GAME_H, max);
}

export function clampSizes(s: LayoutSizes, b: LayoutBounds): LayoutSizes {
  return { rightW: clampRightW(s.rightW, b), gameH: clampGameH(s.gameH, b) };
}

/** Reads saved sizes; anything missing or malformed falls back to defaults. */
export function parseSizes(raw: string | null): LayoutSizes {
  if (!raw) return { ...DEFAULT_SIZES };
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return { ...DEFAULT_SIZES };
    const o = data as Record<string, unknown>;
    return {
      rightW: typeof o.rightW === 'number' && Number.isFinite(o.rightW) ? o.rightW : DEFAULT_SIZES.rightW,
      gameH: typeof o.gameH === 'number' && Number.isFinite(o.gameH) ? o.gameH : DEFAULT_SIZES.gameH,
    };
  } catch {
    return { ...DEFAULT_SIZES };
  }
}

export function serializeSizes(s: LayoutSizes): string {
  return JSON.stringify({ rightW: Math.round(s.rightW), gameH: Math.round(s.gameH) });
}

export function loadSizes(storage: Pick<Storage, 'getItem'> = localStorage): LayoutSizes {
  try {
    return parseSizes(storage.getItem(LAYOUT_KEY));
  } catch {
    return { ...DEFAULT_SIZES };
  }
}

/** Storage may be full or blocked; losing a layout preference is harmless. */
export function saveSizes(s: LayoutSizes, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(LAYOUT_KEY, serializeSizes(s));
  } catch {
    /* preference only */
  }
}
