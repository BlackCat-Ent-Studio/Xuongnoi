import { describe, expect, it } from 'vitest';
import {
  COLLAPSED_LEFT_W,
  DEFAULT_SIZES,
  LAYOUT_KEY,
  MIN_BOTTOM_H,
  clampSizes,
  defaultPrefs,
  isNarrowWindow,
  loadPrefs,
  parsePrefs,
  savePrefs,
  serializePrefs,
  sizesForPreset,
} from '../../src/editor/layout-model';

const big = { mainW: 1600, mainH: 900 };
const small = { mainW: 600, mainH: 300 };

describe('layout-model clamping', () => {
  it('keeps in-range values', () => {
    expect(clampSizes({ leftW: 300, rightW: 320, bottomH: 200 }, big)).toEqual({ leftW: 300, rightW: 320, bottomH: 200 });
  });
  it('enforces minimums', () => {
    expect(clampSizes({ leftW: 10, rightW: 10, bottomH: 1 }, big)).toEqual({ leftW: 180, rightW: 236, bottomH: 32 });
  });
  it('enforces maximums', () => {
    expect(clampSizes({ leftW: 9999, rightW: 9999, bottomH: 9999 }, big)).toEqual({ leftW: 440, rightW: 460, bottomH: 440 });
  });
  it('keeps room for the centre', () => {
    const s = clampSizes({ leftW: 440, rightW: 460, bottomH: 440 }, { mainW: 1000, mainH: 400 });
    expect(1000 - s.leftW - s.rightW - 10).toBeGreaterThanOrEqual(360 - 40);
    expect(s.bottomH).toBe(400 - 160 - 5);
  });
  it('minimum wins when the window is too small', () => {
    expect(clampSizes({ leftW: 300, rightW: 300, bottomH: 300 }, small)).toEqual({ leftW: 180, rightW: 236, bottomH: 135 });
  });
  it('a collapsed left dock frees width for the right dock', () => {
    const open = clampSizes({ leftW: 300, rightW: 460, bottomH: 100 }, { mainW: 1000, mainH: 800 }, false);
    const folded = clampSizes({ leftW: 300, rightW: 460, bottomH: 100 }, { mainW: 1000, mainH: 800 }, true);
    expect(folded.rightW).toBeGreaterThan(open.rightW);
    expect(1000 - COLLAPSED_LEFT_W - folded.rightW - 10).toBeGreaterThanOrEqual(360);
  });
  it('replaces non-finite values with defaults', () => {
    expect(clampSizes({ leftW: Number.NaN, rightW: Infinity, bottomH: Number.NaN }, big)).toEqual(DEFAULT_SIZES);
  });
});

describe('layout-model presets', () => {
  it('wide folds the bottom dock to its tab bar', () => {
    expect(sizesForPreset('wide', DEFAULT_SIZES).bottomH).toBe(MIN_BOTTOM_H);
  });
  it('default and split reopen a folded bottom dock but keep a chosen height', () => {
    expect(sizesForPreset('default', { ...DEFAULT_SIZES, bottomH: MIN_BOTTOM_H }).bottomH).toBe(DEFAULT_SIZES.bottomH);
    expect(sizesForPreset('split', { ...DEFAULT_SIZES, bottomH: 260 }).bottomH).toBe(260);
  });
  it('narrow windows are 1366 wide or less', () => {
    expect(isNarrowWindow(1366)).toBe(true);
    expect(isNarrowWindow(1280)).toBe(true);
    expect(isNarrowWindow(1367)).toBe(false);
    expect(isNarrowWindow(1440)).toBe(false);
  });
});

describe('layout-model persistence', () => {
  it('round-trips sizes, preset and collapsed choice', () => {
    const p = { sizes: { leftW: 250.4, rightW: 300, bottomH: 120 }, preset: 'split' as const, leftCollapsed: true };
    expect(parsePrefs(serializePrefs(p))).toEqual({ ...p, sizes: { leftW: 250, rightW: 300, bottomH: 120 } });
  });
  it('falls back to defaults on bad input', () => {
    expect(parsePrefs(null)).toEqual(defaultPrefs());
    expect(parsePrefs('not json')).toEqual(defaultPrefs());
    expect(parsePrefs('42')).toEqual(defaultPrefs());
    expect(parsePrefs('{"rightW":"x","preset":"nope","leftCollapsed":"yes"}')).toEqual(defaultPrefs());
  });
  it('keeps the right width from the older saved shape', () => {
    expect(parsePrefs('{"rightW":400,"gameH":300}').sizes.rightW).toBe(400);
  });
  it('uses the agreed storage key and survives storage failures', () => {
    const store = new Map<string, string>();
    const p = { sizes: { leftW: 200, rightW: 300, bottomH: 100 }, preset: 'wide' as const, leftCollapsed: null };
    savePrefs(p, { setItem: (k: string, v: string) => void store.set(k, v) });
    expect(store.has(LAYOUT_KEY)).toBe(true);
    expect(loadPrefs({ getItem: (k: string) => store.get(k) ?? null })).toEqual(p);
    const boom = (): never => {
      throw new Error('blocked');
    };
    expect(() => savePrefs(p, { setItem: boom })).not.toThrow();
    expect(loadPrefs({ getItem: boom })).toEqual(defaultPrefs());
  });
});
