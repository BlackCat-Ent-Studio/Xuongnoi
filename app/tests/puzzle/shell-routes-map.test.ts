import { describe, expect, it } from 'vitest';
import type { PuzzleLevel } from '../../src/puzzle/types';
import { allSolved, buildStops, MAP_HEIGHT, newlyUnlocked, starTotals, stopPoints, trailPath, unlockedCount } from '../../src/puzzle/ui/map-state';
import { hashOf, parentRoute, parseRoute, routeDepth } from '../../src/puzzle/ui/routes';

const lv = (id: string, order: number) => ({ id, order, title: `T${order}`, mode: '2d-side' }) as PuzzleLevel;
const levels = [lv('a', 1), lv('b', 2), lv('c', 3)];

describe('routes', () => {
  it('reads every screen address', () => {
    expect(parseRoute('')).toEqual({ name: 'title' });
    expect(parseRoute('#/')).toEqual({ name: 'title' });
    expect(parseRoute('#/map')).toEqual({ name: 'map' });
    expect(parseRoute('#/end')).toEqual({ name: 'end' });
    expect(parseRoute('#/level/cua-kho')).toEqual({ name: 'level', id: 'cua-kho' });
    expect(parseRoute('#/nonsense')).toEqual({ name: 'title' });
  });

  it('survives broken level addresses', () => {
    expect(parseRoute('#/level/')).toEqual({ name: 'map' });
    expect(parseRoute('#/level/%E0%A4%A')).toEqual({ name: 'map' });
  });

  it('round-trips through hashOf, including odd ids', () => {
    for (const hash of ['#/', '#/map', '#/end', '#/level/a%20b']) expect(hashOf(parseRoute(hash))).toBe(hash);
    expect(parseRoute(hashOf({ name: 'level', id: 'x/y' }))).toEqual({ name: 'level', id: 'x/y' });
  });

  it('goes one level up with back', () => {
    expect(parentRoute({ name: 'level', id: 'a' })).toEqual({ name: 'map' });
    expect(parentRoute({ name: 'end' })).toEqual({ name: 'map' });
    expect(parentRoute({ name: 'map' })).toEqual({ name: 'title' });
    expect(parentRoute({ name: 'title' })).toBeNull();
    expect(routeDepth({ name: 'title' })).toBeLessThan(routeDepth({ name: 'map' }));
    expect(routeDepth({ name: 'map' })).toBeLessThan(routeDepth({ name: 'level', id: 'a' }));
  });
});

describe('map state', () => {
  it('marks level 1 as next on a fresh game and the rest locked', () => {
    expect(buildStops(levels, {}).map((s) => s.state)).toEqual(['next', 'locked', 'locked']);
  });

  it('marks solved levels done and the first open unsolved one next', () => {
    const stops = buildStops(levels, { a: { stars: 3 }, b: { stars: 1 } });
    expect(stops.map((s) => s.state)).toEqual(['done', 'done', 'next']);
    expect(stops.map((s) => s.stars)).toEqual([3, 1, 0]);
  });

  it('has no next stop when everything is solved', () => {
    const all = { a: { stars: 1 }, b: { stars: 2 }, c: { stars: 3 } } as const;
    expect(buildStops(levels, all).some((s) => s.state === 'next')).toBe(false);
    expect(allSolved(levels, all)).toBe(true);
    expect(allSolved(levels, {})).toBe(false);
    expect(allSolved([], {})).toBe(false);
  });

  it('counts open levels and finds the ones that opened since the map was last seen', () => {
    expect(unlockedCount(levels, {})).toBe(1);
    expect(unlockedCount(levels, { a: { stars: 1 } })).toBe(2);
    expect(newlyUnlocked(levels, { a: { stars: 1 } }, 1)).toEqual([1]);
    expect(newlyUnlocked(levels, { a: { stars: 1 } }, 2)).toEqual([]);
    expect(newlyUnlocked(levels, { a: { stars: 1 }, b: { stars: 1 } }, 1)).toEqual([1, 2]);
    expect(newlyUnlocked(levels, {}, 5)).toEqual([]);
  });

  it('adds up the stars', () => {
    expect(starTotals(levels, { a: { stars: 3 }, c: { stars: 2 } })).toEqual({ got: 5, max: 9 });
  });
});

describe('map layout', () => {
  it('places every stop inside the scene, left to right, for any level count', () => {
    for (const n of [0, 1, 2, 8, 12]) {
      const pts = stopPoints(n);
      expect(pts).toHaveLength(n);
      for (const p of pts) {
        expect(p.x).toBeGreaterThan(5);
        expect(p.x).toBeLessThan(95);
        expect(p.y).toBeGreaterThan(10);
        expect(p.y).toBeLessThan(MAP_HEIGHT - 8);
      }
      for (let i = 1; i < n; i++) expect(pts[i]!.x).toBeGreaterThan(pts[i - 1]!.x);
    }
  });

  it('draws a curve through all stops', () => {
    expect(trailPath([])).toBe('');
    const d = trailPath(stopPoints(8));
    expect(d.startsWith('M')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(7);
    expect(d).not.toContain('NaN');
  });
});
