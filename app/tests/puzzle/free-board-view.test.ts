import { describe, expect, it } from 'vitest';
import { FIT_MAX_K, FIT_MIN_K, fitFree, freeSpotNear, panToShow, screenToWorld, worldToScreen } from '../../src/puzzle/ui/board-arrange';
import { zoomAbout } from '../../src/puzzle/ui/board-pan-zoom';

const area = { w: 1200, h: 600 };

describe('fitFree: the opening view', () => {
  it('shows small content at zoom 1, centred', () => {
    const v = fitFree({ x: 100, y: 50, w: 400, h: 200 }, area, null, 14);
    expect(v.k).toBe(FIT_MAX_K);
    expect(v.x + 100 * v.k).toBeCloseTo((area.w - 400) / 2, 5);
    expect(v.y + 50 * v.k).toBeCloseTo((area.h - 200) / 2, 5);
  });

  it('zooms out to fit, between the floor and 1', () => {
    const v = fitFree({ x: 0, y: 0, w: 1500, h: 400 }, area, null, 14);
    expect(v.k).toBeCloseTo((1200 - 28) / 1500, 5);
    expect(v.k).toBeGreaterThan(FIT_MIN_K);
    expect(v.k).toBeLessThan(1);
  });

  it('never goes below 0.70 and then keeps the top-left of the cards in view', () => {
    const v = fitFree({ x: 300, y: 200, w: 4000, h: 2500 }, area, null, 14);
    expect(v.k).toBe(FIT_MIN_K);
    expect(v.x + 300 * v.k).toBeCloseTo(14, 5);
    expect(v.y + 200 * v.k).toBeCloseTo(14, 5);
  });

  it('top-left only on the axis that does not fit; the other axis is centred', () => {
    const v = fitFree({ x: 0, y: 0, w: 4000, h: 200 }, area, null, 14);
    expect(v.k).toBe(FIT_MIN_K);
    expect(v.x).toBeCloseTo(14, 5);
    expect(v.y + 0).toBeCloseTo((area.h - 200 * v.k) / 2, 5);
  });

  it('fits beside or above the corner window, whichever leaves the bigger zoom', () => {
    const avoid = { x: 900, y: 400, w: 300, h: 200 };
    const v = fitFree({ x: 0, y: 0, w: 850, h: 300 }, area, avoid, 14);
    expect(v.k).toBe(1);
    // It sits left of the window or above it, never under it.
    const leftOf = v.x + 850 * v.k <= avoid.x;
    const above = v.y + 300 * v.k <= avoid.y;
    expect(leftOf || above).toBe(true);
  });

  it('has a sane view for no cards', () => {
    expect(fitFree({ x: 0, y: 0, w: 0, h: 0 }, area, null, 14)).toEqual({ k: 1, x: 14, y: 14 });
  });
});

describe('zoomAbout and world <-> screen', () => {
  it('keeps the world point under the pointer fixed', () => {
    const v = { k: 0.8, x: 40, y: -30 };
    const c = { x: 500, y: 250 };
    const before = screenToWorld(v, c);
    const next = zoomAbout(v, 1.6, c);
    expect(next.k).toBe(1.6);
    const after = screenToWorld(next, c);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('round-trips', () => {
    const v = { k: 0.55, x: -120, y: 75 };
    const p = { x: 321, y: 654 };
    const back = screenToWorld(v, worldToScreen(v, p));
    expect(back.x).toBeCloseTo(p.x, 8);
    expect(back.y).toBeCloseTo(p.y, 8);
  });
});

describe('freeSpotNear: where a tray piece lands', () => {
  const size = { w: 100, h: 60 };

  it('lands centred on the target when it is free', () => {
    expect(freeSpotNear([], size, { x: 500, y: 300 }, null)).toEqual({ x: 450, y: 270 });
  });

  it('moves to the nearest free place when the target is taken, without touching any card', () => {
    const taken = [{ x: 400, y: 250, w: 200, h: 100 }];
    const p = freeSpotNear(taken, size, { x: 500, y: 300 }, null, 14, 20);
    const box = { x: p.x, y: p.y, w: size.w, h: size.h };
    const touching = box.x < 600 + 14 && box.x + box.w + 14 > 400 && box.y < 350 + 14 && box.y + box.h + 14 > 250;
    expect(touching).toBe(false);
    expect(Math.hypot(p.x + 50 - 500, p.y + 30 - 300)).toBeLessThan(160);
  });

  it('prefers a spot fully inside the visible part of the world', () => {
    const within = { x: 0, y: 0, w: 600, h: 400 };
    const taken = [{ x: 150, y: 100, w: 300, h: 200 }];
    const p = freeSpotNear(taken, size, { x: 300, y: 200 }, within, 14, 20);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + size.w).toBeLessThanOrEqual(600);
    expect(p.y + size.h).toBeLessThanOrEqual(400);
  });

  it('goes outside the visible part when it is completely full', () => {
    const within = { x: 0, y: 0, w: 200, h: 100 };
    const taken = [{ x: 0, y: 0, w: 200, h: 100 }];
    const p = freeSpotNear(taken, size, { x: 100, y: 50 }, within, 14, 20);
    const inside = p.x >= 0 && p.y >= 0 && p.x + size.w <= 200 && p.y + size.h <= 100;
    expect(inside).toBe(false);
  });
});

describe('panToShow: bring a pin on screen', () => {
  const v = { k: 1, x: 0, y: 0 };
  it('does not move the view when the box is already inside', () => {
    expect(panToShow(v, { x: 300, y: 200, w: 20, h: 20 }, area, 24)).toEqual(v);
  });
  it('pans right / down for a box left of / above the area, keeping the zoom', () => {
    const n = panToShow(v, { x: -500, y: -300, w: 20, h: 20 }, area, 24);
    expect(n.k).toBe(1);
    expect(n.x).toBeCloseTo(524, 5);
    expect(n.y).toBeCloseTo(324, 5);
  });
  it('pans left / up for a box beyond the far edge', () => {
    const n = panToShow(v, { x: 2000, y: 900, w: 20, h: 20 }, area, 24);
    expect(2000 + n.x + 20).toBeCloseTo(area.w - 24, 5);
    expect(900 + n.y + 20).toBeCloseTo(area.h - 24, 5);
  });
});
