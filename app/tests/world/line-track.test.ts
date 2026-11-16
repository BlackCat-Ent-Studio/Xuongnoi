import { describe, expect, it } from 'vitest';
import type { LineTrackSpec } from '../../src/engine/types';
import { distanceToPath, distanceToTrack, onTrack, presetPath, smoothPath, trackCoverage } from '../../src/world/line-track';

/** A straight track along u at v = 0, 0.2 m wide. */
const straight: LineTrackSpec = { path: [{ u: -10, v: 0 }, { u: 10, v: 0 }], closed: false, width: 0.2 };

describe('distance to the centre line', () => {
  it('is the straight distance to a piece, and to its end beyond it', () => {
    expect(distanceToTrack(straight, { u: 3, v: 0.5 })).toBeCloseTo(0.5, 9);
    expect(distanceToTrack(straight, { u: 3, v: -0.5 })).toBeCloseTo(0.5, 9);
    expect(distanceToTrack(straight, { u: 13, v: 4 })).toBeCloseTo(5, 9);
  });

  it('a closed path also measures the closing piece, an open one does not', () => {
    const tri = [{ u: 0, v: 0 }, { u: 4, v: 0 }, { u: 4, v: 4 }];
    expect(distanceToPath(tri, true, { u: 1, v: 2 })).toBeCloseTo(Math.abs(1 - 2) / Math.SQRT2, 9);
    expect(distanceToPath(tri, false, { u: 1, v: 2 })).toBeCloseTo(Math.hypot(3, 2) > 2 ? 2 : 0, 9);
  });

  it('no points is infinitely far, one point is a plain distance', () => {
    expect(distanceToPath([], false, { u: 0, v: 0 })).toBe(Infinity);
    expect(distanceToPath([{ u: 1, v: 1 }], false, { u: 4, v: 5 })).toBeCloseTo(5, 9);
  });
});

describe('on the band', () => {
  it('is inside up to half the width from the centre line', () => {
    expect(onTrack(straight, { u: 0, v: 0.09 })).toBe(true);
    expect(onTrack(straight, { u: 0, v: -0.1 })).toBe(true);
    expect(onTrack(straight, { u: 0, v: 0.11 })).toBe(false);
  });
});

describe('coverage of a sensing spot', () => {
  it('is 0 well off the line, 1 when the whole spot is inside the band, between at an edge', () => {
    const wide: LineTrackSpec = { ...straight, width: 1 };
    expect(trackCoverage([wide], { u: 0, v: 3 }, 0.3)).toBe(0);
    expect(trackCoverage([wide], { u: 0, v: 0 }, 0.3)).toBe(1);
    const edge = trackCoverage([wide], { u: 0, v: 0.5 }, 0.3);
    expect(edge).toBeGreaterThan(0.4);
    expect(edge).toBeLessThan(0.6);
  });

  it('across a line edge only grows while the spot moves onto the line and only shrinks while it leaves, so a threshold never flickers', () => {
    const wide: LineTrackSpec = { ...straight, width: 2 };
    const levels: number[] = [];
    for (let k = 0; k <= 400; k++) levels.push(trackCoverage([wide], { u: 0, v: 2 - k * 0.005 }, 0.3));
    expect(levels[0]).toBe(0);
    expect(levels.at(-1)).toBe(1);
    for (let k = 1; k < levels.length; k++) expect(levels[k]!, `in ${k}`).toBeGreaterThanOrEqual(levels[k - 1]!);
    // and back out through the other edge (the mirror image: the band is symmetric)
    const out = levels.map((_, k) => trackCoverage([wide], { u: 0, v: -2 + k * 0.005 }, 0.3));
    const away = levels.map((_, k) => trackCoverage([wide], { u: 0, v: k * 0.005 }, 0.3));
    for (let k = 1; k < away.length; k++) expect(away[k]!, `away ${k}`).toBeLessThanOrEqual(away[k - 1]!);
    for (let k = 1; k < out.length; k++) expect(out[k]!, `across ${k}`).toBeGreaterThanOrEqual(out[k - 1]! - 0);
    // one full pass over a thin line rises, peaks and falls (a wobble of a few samples, about 2 percent, at the peak is allowed)
    const pass: number[] = [];
    for (let k = 0; k <= 300; k++) pass.push(trackCoverage([straight], { u: 0, v: 1 - k * 0.005 }, 0.3));
    const peak = pass.indexOf(Math.max(...pass));
    for (let k = 1; k <= peak; k++) expect(pass[k]!, `thin in ${k}`).toBeGreaterThanOrEqual(pass[k - 1]! - 3 / 128);
    expect(Math.max(...pass)).toBeGreaterThan(0.5);
  });

  it('a spot wider than the band never reaches 1, a zero-size spot reads a single point', () => {
    expect(trackCoverage([straight], { u: 0, v: 0 }, 1)).toBeLessThan(0.4);
    expect(trackCoverage([straight], { u: 0, v: 0.05 }, 0)).toBe(1);
    expect(trackCoverage([straight], { u: 0, v: 0.5 }, 0)).toBe(0);
  });

  it('several tracks count as one painted area, and none gives 0', () => {
    const second: LineTrackSpec = { path: [{ u: 0, v: -5 }, { u: 0, v: 5 }], closed: false, width: 0.2 };
    expect(trackCoverage([], { u: 0, v: 0 }, 0.3)).toBe(0);
    expect(trackCoverage([straight, second], { u: 0, v: 3 }, 0.3)).toBeGreaterThan(0);
    expect(trackCoverage([straight, second], { u: 0, v: 3 }, 0.3)).toBe(trackCoverage([second], { u: 0, v: 3 }, 0.3));
  });

  it('flat mode (side view) reads along the floor and ignores height', () => {
    const strip: LineTrackSpec = { path: [{ u: 2, v: 0.5 }, { u: 6, v: 0.5 }], closed: false, width: 0.2 };
    expect(trackCoverage([strip], { u: 4, v: 123 }, 0.3, true)).toBe(1);
    expect(trackCoverage([strip], { u: 0, v: 0.5 }, 0.3, true)).toBe(0);
    const half = trackCoverage([strip], { u: 1.9, v: 0.5 }, 0.5, true);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
  });
});

describe('preset shapes', () => {
  it('oval and figure 8 are closed, straight and S are open', () => {
    expect(presetPath('oval', 0, 0, 12, 6).closed).toBe(true);
    expect(presetPath('eight', 0, 0, 12, 6).closed).toBe(true);
    expect(presetPath('straight', 0, 0, 12, 6).closed).toBe(false);
    expect(presetPath('s-curve', 0, 0, 12, 6).closed).toBe(false);
  });

  it('keeps to the length and breadth, around the centre', () => {
    const { path } = presetPath('oval', 3, -2, 12, 6);
    const us = path.map((p) => p.u);
    const vs = path.map((p) => p.v);
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(12, 5);
    expect(Math.max(...vs) - Math.min(...vs)).toBeGreaterThan(5.9);
    expect(Math.max(...vs) - Math.min(...vs)).toBeLessThanOrEqual(6 + 1e-9);
    expect((Math.max(...us) + Math.min(...us)) / 2).toBeCloseTo(3, 5);
  });

  it('the figure 8 crosses itself in the middle', () => {
    const { path } = presetPath('eight', 0, 0, 12, 6);
    expect(distanceToPath(path, true, { u: 0, v: 0 })).toBeLessThan(0.1);
  });
});

describe('rounded corners', () => {
  const square = [{ u: 0, v: 0 }, { u: 4, v: 0 }, { u: 4, v: 4 }, { u: 0, v: 4 }];

  it('radius 0 only tidies the points', () => {
    expect(smoothPath([...square, { u: 0, v: 4 }], true, 0)).toEqual(square);
  });

  it('cuts every corner of a closed path and keeps the ends of an open one', () => {
    const closed = smoothPath(square, true, 1);
    expect(distanceToPath(closed, true, { u: 0, v: 0 })).toBeGreaterThan(0.2);
    expect(distanceToPath(closed, true, { u: 2, v: 0 })).toBeLessThan(1e-9);
    const open = smoothPath(square, false, 1);
    expect(open[0]).toEqual({ u: 0, v: 0 });
    expect(open.at(-1)).toEqual({ u: 0, v: 4 });
  });

  it('never cuts deeper than half of the neighbouring piece', () => {
    const tiny = smoothPath([{ u: 0, v: 0 }, { u: 0.2, v: 0 }, { u: 0.2, v: 5 }], false, 3);
    for (const p of tiny) expect(p.u).toBeGreaterThanOrEqual(-1e-9);
    expect(tiny.every((p) => Number.isFinite(p.u) && Number.isFinite(p.v))).toBe(true);
  });
});
