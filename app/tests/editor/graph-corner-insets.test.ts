import { describe, expect, it } from 'vitest';
import { boxesOverlap, fitView, screenRectToWorld, type Box, type CornerInsets } from '../../src/editor/graph/graph-geometry';
import { findFreeNodeSpot } from '../../src/editor/graph/node-placement';
import { COACH_KEY, dismissCoach, isCoachDismissed } from '../../src/editor/graph/graph-toolbar';

const VIEWPORT = { w: 1000, h: 600 };
const content: Box = { x: 0, y: 0, w: 900, h: 480 };

/** Screen rect a fitted view gives to the content. */
function screenBox(view: { panX: number; panY: number; zoom: number }, b: Box): Box {
  return { x: view.panX + b.x * view.zoom, y: view.panY + b.y * view.zoom, w: b.w * view.zoom, h: b.h * view.zoom };
}

describe('fitView with corner insets', () => {
  it('matches the old framing when nothing is reserved', () => {
    expect(fitView(content, VIEWPORT)).toEqual({ zoom: Math.min(1, 920 / 900, 520 / 480), panX: 40, panY: 40 });
  });

  it('keeps content clear of the bottom-left cluster', () => {
    const insets: CornerInsets = { bl: { w: 260, h: 180 }, br: { w: 0, h: 0 } };
    const view = fitView(content, VIEWPORT, insets);
    const cluster: Box = { x: 0, y: VIEWPORT.h - insets.bl.h, w: insets.bl.w, h: insets.bl.h };
    expect(boxesOverlap(screenBox(view, content), cluster)).toBe(false);
    expect(view.zoom).toBeLessThan(1);
  });

  it('keeps content clear of both corners at once', () => {
    const insets: CornerInsets = { bl: { w: 260, h: 180 }, br: { w: 320, h: 240 } };
    const view = fitView(content, VIEWPORT, insets);
    const shown = screenBox(view, content);
    expect(boxesOverlap(shown, { x: 0, y: VIEWPORT.h - 180, w: 260, h: 180 })).toBe(false);
    expect(boxesOverlap(shown, { x: VIEWPORT.w - 320, y: VIEWPORT.h - 240, w: 320, h: 240 })).toBe(false);
  });

  it('prefers the side column when that keeps more zoom', () => {
    const wide: Box = { x: 0, y: 0, w: 400, h: 500 };
    const view = fitView(wide, VIEWPORT, { bl: { w: 100, h: 300 }, br: { w: 0, h: 0 } });
    expect(view.panX).toBeGreaterThan(40); // gave up a left column, not the bottom strip
  });

  it('ignores a zero-sized inset', () => {
    expect(fitView(content, VIEWPORT, { bl: { w: 0, h: 0 }, br: { w: 0, h: 0 } })).toEqual(fitView(content, VIEWPORT));
  });
});

describe('overlay-aware placement', () => {
  it('converts a screen rect to a grown world box', () => {
    const w = screenRectToWorld({ panX: 100, panY: 50, zoom: 2 }, { x: 120, y: 90, w: 40, h: 20 }, 10);
    expect(w).toEqual({ x: 5, y: 15, w: 30, h: 20 });
  });

  it('moves a node off a blocked corner region', () => {
    const blocked: Box = { x: 0, y: 400, w: 260, h: 180 };
    const size = { w: 168, h: 90 };
    const spot = findFreeNodeSpot({ x: 20, y: 420 }, size, [blocked]);
    expect(boxesOverlap({ ...spot, ...size }, blocked)).toBe(false);
  });

  it('five nodes added in a row never land on the blocked region', () => {
    const blocked: Box = { x: 0, y: 400, w: 260, h: 180 };
    const size = { w: 168, h: 90 };
    const taken: Box[] = [blocked];
    for (let i = 0; i < 5; i++) {
      const spot = findFreeNodeSpot({ x: 30, y: 430 }, size, taken);
      const box = { ...spot, ...size };
      expect(boxesOverlap(box, blocked)).toBe(false);
      taken.push(box);
    }
  });
});

describe('coach dismissal', () => {
  const memory = (): Pick<Storage, 'getItem' | 'setItem'> => {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
  };

  it('stays dismissed once stored', () => {
    const store = memory();
    expect(isCoachDismissed(store)).toBe(false);
    dismissCoach(store);
    expect(store.getItem(COACH_KEY)).toBe('1');
    expect(isCoachDismissed(store)).toBe(true);
  });

  it('survives a storage that throws', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(isCoachDismissed(broken)).toBe(false);
    expect(() => dismissCoach(broken)).not.toThrow();
  });
});
