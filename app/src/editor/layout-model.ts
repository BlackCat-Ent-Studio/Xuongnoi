/** Pure sizing + persistence rules for the docked editor layout. */

export type LayoutPreset = 'default' | 'split' | 'wide';
export const LAYOUT_PRESETS: readonly LayoutPreset[] = ['default', 'split', 'wide'];

export interface LayoutSizes {
  /** Width of the left dock, px. */
  leftW: number;
  /** Width of the right dock, px. */
  rightW: number;
  /** Height of the bottom dock, px (its minimum shows only the tab bar). */
  bottomH: number;
}

export interface LayoutBounds {
  /** Width of the whole dock area. */
  mainW: number;
  /** Height of the whole dock area. */
  mainH: number;
}

export interface LayoutPrefs {
  sizes: LayoutSizes;
  preset: LayoutPreset;
  /** true/false once the user chose; null means "decide from the window width". */
  leftCollapsed: boolean | null;
}

export const LAYOUT_KEY = 'xuong-noi:layout';
export const DEFAULT_SIZES: LayoutSizes = { leftW: 236, rightW: 280, bottomH: 188 };

export const MIN_LEFT_W = 180;
export const MAX_LEFT_W = 440;
export const MIN_RIGHT_W = 236;
export const MAX_RIGHT_W = 460;
/** Just the tab bar. */
export const MIN_BOTTOM_H = 32;
export const MAX_BOTTOM_H = 440;
export const MIN_CENTER_W = 360;
export const MIN_CENTER_H = 160;
export const SPLITTER_PX = 5;
/** Width of the left dock when collapsed to its tab rail. */
export const COLLAPSED_LEFT_W = 40;
/** Windows at most this wide start with the left dock collapsed. */
export const NARROW_WIDTH = 1366;
/** Below this the bottom dock counts as folded away. */
export const BOTTOM_OPEN_H = 80;

function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

/** Keeps `v` in [min, max]; when the window is too small for the range, min wins. */
function clampRange(v: number, min: number, max: number): number {
  return Math.round(Math.min(Math.max(v, min), Math.max(min, max)));
}

/** Left dock width actually used: the collapsed rail or the preferred width. */
export function effectiveLeftW(s: LayoutSizes, collapsed: boolean): number {
  return collapsed ? COLLAPSED_LEFT_W : s.leftW;
}

export function clampSizes(s: LayoutSizes, b: LayoutBounds, leftCollapsed = false): LayoutSizes {
  const gaps = 2 * SPLITTER_PX;
  const leftW = clampRange(
    finiteOr(s.leftW, DEFAULT_SIZES.leftW),
    MIN_LEFT_W,
    leftCollapsed ? MAX_LEFT_W : Math.min(MAX_LEFT_W, b.mainW - MIN_RIGHT_W - MIN_CENTER_W - gaps),
  );
  const rightW = clampRange(
    finiteOr(s.rightW, DEFAULT_SIZES.rightW),
    MIN_RIGHT_W,
    Math.min(MAX_RIGHT_W, b.mainW - effectiveLeftW({ ...s, leftW }, leftCollapsed) - MIN_CENTER_W - gaps),
  );
  const bottomH = clampRange(
    finiteOr(s.bottomH, DEFAULT_SIZES.bottomH),
    MIN_BOTTOM_H,
    Math.min(MAX_BOTTOM_H, b.mainH - MIN_CENTER_H - SPLITTER_PX),
  );
  return { leftW, rightW, bottomH };
}

/** Sizes a preset implies: "wide" folds the bottom dock; the others make sure it is open. */
export function sizesForPreset(preset: LayoutPreset, sizes: LayoutSizes): LayoutSizes {
  if (preset === 'wide') return { ...sizes, bottomH: MIN_BOTTOM_H };
  if (sizes.bottomH < BOTTOM_OPEN_H) return { ...sizes, bottomH: DEFAULT_SIZES.bottomH };
  return sizes;
}

export function isNarrowWindow(width: number): boolean {
  return width <= NARROW_WIDTH;
}

export function defaultPrefs(): LayoutPrefs {
  return { sizes: { ...DEFAULT_SIZES }, preset: 'default', leftCollapsed: null };
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Reads saved prefs; anything missing or malformed falls back to defaults. */
export function parsePrefs(raw: string | null): LayoutPrefs {
  if (!raw) return defaultPrefs();
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return defaultPrefs();
    const o = data as Record<string, unknown>;
    const preset = LAYOUT_PRESETS.find((p) => p === o.preset) ?? 'default';
    return {
      sizes: {
        leftW: numOr(o.leftW, DEFAULT_SIZES.leftW),
        rightW: numOr(o.rightW, DEFAULT_SIZES.rightW),
        bottomH: numOr(o.bottomH, DEFAULT_SIZES.bottomH),
      },
      preset,
      leftCollapsed: typeof o.leftCollapsed === 'boolean' ? o.leftCollapsed : null,
    };
  } catch {
    return defaultPrefs();
  }
}

export function serializePrefs(p: LayoutPrefs): string {
  return JSON.stringify({
    leftW: Math.round(p.sizes.leftW),
    rightW: Math.round(p.sizes.rightW),
    bottomH: Math.round(p.sizes.bottomH),
    preset: p.preset,
    leftCollapsed: p.leftCollapsed,
  });
}

export function loadPrefs(storage: Pick<Storage, 'getItem'> = localStorage): LayoutPrefs {
  try {
    return parsePrefs(storage.getItem(LAYOUT_KEY));
  } catch {
    return defaultPrefs();
  }
}

/** Storage may be full or blocked; losing a layout preference is harmless. */
export function savePrefs(p: LayoutPrefs, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(LAYOUT_KEY, serializePrefs(p));
  } catch {
    /* preference only */
  }
}
