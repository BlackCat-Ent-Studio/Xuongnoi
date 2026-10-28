import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIZES,
  LAYOUT_KEY,
  clampGameH,
  clampRightW,
  clampSizes,
  loadSizes,
  parseSizes,
  saveSizes,
  serializeSizes,
} from '../../src/editor/layout-model';

const big = { mainW: 1600, rightH: 900 };
const small = { mainW: 600, rightH: 300 };

describe('layout-model clamping', () => {
  it('keeps in-range values', () => {
    expect(clampRightW(500, big)).toBe(500);
    expect(clampGameH(400, big)).toBe(400);
  });
  it('enforces minimums', () => {
    expect(clampRightW(10, big)).toBe(280);
    expect(clampGameH(10, big)).toBe(160);
  });
  it('leaves the canvas at least 240px and props at least 120px', () => {
    expect(clampRightW(99999, big)).toBe(1600 - 200 - 240 - 8);
    expect(clampGameH(99999, big)).toBe(900 - 120 - 8);
  });
  it('minimum wins when the window is too small', () => {
    expect(clampRightW(500, small)).toBe(280);
    expect(clampGameH(500, { mainW: 600, rightH: 100 })).toBe(160);
  });
  it('replaces non-finite values with defaults', () => {
    expect(clampRightW(Number.NaN, big)).toBe(DEFAULT_SIZES.rightW);
    expect(clampSizes({ rightW: Infinity, gameH: Number.NaN }, big)).toEqual({
      rightW: DEFAULT_SIZES.rightW,
      gameH: DEFAULT_SIZES.gameH,
    });
  });
});

describe('layout-model persistence', () => {
  it('round-trips sizes', () => {
    expect(parseSizes(serializeSizes({ rightW: 612.4, gameH: 333 }))).toEqual({ rightW: 612, gameH: 333 });
  });
  it('falls back to defaults on bad input', () => {
    expect(parseSizes(null)).toEqual(DEFAULT_SIZES);
    expect(parseSizes('not json')).toEqual(DEFAULT_SIZES);
    expect(parseSizes('42')).toEqual(DEFAULT_SIZES);
    expect(parseSizes('{"rightW":"x","gameH":null}')).toEqual(DEFAULT_SIZES);
  });
  it('uses the agreed storage key and survives storage failures', () => {
    const store = new Map<string, string>();
    saveSizes({ rightW: 500, gameH: 250 }, { setItem: (k, v) => void store.set(k, v) });
    expect(store.get(LAYOUT_KEY)).toBe('{"rightW":500,"gameH":250}');
    expect(loadSizes({ getItem: (k) => store.get(k) ?? null })).toEqual({ rightW: 500, gameH: 250 });
    const boom = (): never => {
      throw new Error('blocked');
    };
    expect(() => saveSizes(DEFAULT_SIZES, { setItem: boom })).not.toThrow();
    expect(loadSizes({ getItem: boom })).toEqual(DEFAULT_SIZES);
  });
});
