import { describe, expect, it } from 'vitest';
import { badgeSize, placeBadge } from '../../src/editor/graph/badge-placement';
import type { Box } from '../../src/editor/graph/graph-geometry';

/** A straight wire from (0, 0) to (1000, 0). */
const wire = (f: number) => ({ x: 1000 * f, y: 0 });
const size = badgeSize('number');
const overlap = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const boxOf = (p: { x: number; y: number }): Box => ({ x: p.x - size.w / 2, y: p.y - size.h / 2, w: size.w, h: size.h });

describe('where the value badge of a wire goes', () => {
  it('sits at the middle of the wire when nothing is there', () => {
    const taken: Box[] = [];
    expect(placeBadge(wire, size, [], taken)).toEqual({ x: 500, y: 0 });
    expect(taken).toHaveLength(1);
  });

  it('slides along the wire off a card it runs behind, to the nearest clear place', () => {
    const card: Box = { x: 380, y: -100, w: 240, h: 200 };
    const spot = placeBadge(wire, size, [card], [])!;
    expect(overlap(boxOf(spot), card)).toBe(false);
    expect(spot.y).toBe(0);
    // The nearest clear place to the middle, not the far end of the wire.
    expect(Math.abs(spot.x - 500)).toBeLessThan(200);
  });

  it('keeps clear of the badges placed before it, so two wires on the same line show two badges', () => {
    const taken: Box[] = [];
    const first = placeBadge(wire, size, [], taken)!;
    const second = placeBadge(wire, size, [], taken)!;
    expect(overlap(boxOf(first), boxOf(second))).toBe(false);
    expect(taken).toHaveLength(2);
  });

  it('is left out when the whole wire runs behind cards (never drawn over a name)', () => {
    const taken: Box[] = [];
    expect(placeBadge(wire, size, [{ x: -50, y: -50, w: 1100, h: 100 }], taken)).toBeNull();
    expect(taken).toEqual([]);
  });

  it('an object badge takes more room than a number badge', () => {
    expect(badgeSize('object').w).toBeGreaterThan(badgeSize('number').w);
    expect(badgeSize('bool')).toEqual(badgeSize('number'));
  });
});
