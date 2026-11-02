import { describe, expect, it } from 'vitest';
import type { BodySnapshot, EntityView } from '../../src/engine/types';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { runLevel } from '../../src/puzzle/run-level';
import { stageRoleOf } from '../../src/puzzle/stage/cozy-stage';
import {
  SLOT_COLOR,
  SLOT_SIZE,
  nextEmptySlot,
  readSlotParams,
  slotCentres,
  slotIsTaken,
  slotRects,
  type SlotRect,
} from '../../src/puzzle/store-slots';
import { parkingSpot } from '../../src/puzzle/slot-patrol';
import type { PuzzleLevel } from '../../src/puzzle/types';

/** Levels with a store pad, how many slots each has and how many crates the reference solution delivers. */
const STORES = [
  { order: 5, slots: 3, delivered: 3 },
  { order: 7, slots: 3, delivered: 3 },
  { order: 8, slots: 2, delivered: 2 },
] as const;

const levelOf = (order: number): PuzzleLevel => PUZZLE_LEVELS.find((l) => l.order === order)!;

/** The level with nothing able to end it, so the reference answer can play on until every crate has settled. */
function endless(level: PuzzleLevel): PuzzleLevel {
  return { ...level, base: { ...level.base, wires: level.base.wires.filter((w) => w.to.node !== 'end') } };
}

const crate = (x: number, z: number, over: Partial<EntityView> = {}): EntityView =>
  ({ id: 'c', kind: 'item', ownerNodeId: 'c', position: { x, y: 0.3, z }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#b45309', visible: true, ...over }) as EntityView;

describe('store slots: level data', () => {
  it.each(STORES)('level $order has $slots slot marks, all on the pad and inside the counting zone', ({ order, slots }) => {
    const level = levelOf(order);
    const def = level.storeSlots!;
    expect(def.count).toBe(slots);
    const marks = level.base.nodes.filter((n) => n.params.color === SLOT_COLOR);
    expect(marks).toHaveLength(slots);
    const centres = slotCentres(def);
    marks.forEach((m, i) => {
      const p = m.params.position as { x: number; z: number };
      expect(p).toMatchObject(centres[i]!);
    });
    // Neighbouring slots do not touch.
    for (let i = 1; i < centres.length; i++) {
      const gap = Math.hypot(centres[i]!.x - centres[i - 1]!.x, centres[i]!.z - centres[i - 1]!.z);
      expect(gap).toBeGreaterThan(SLOT_SIZE);
    }
    const inside = (box: { x: number; z: number; sx: number; sz: number }, c: { x: number; z: number }): boolean =>
      Math.abs(c.x - box.x) + SLOT_SIZE / 2 <= box.sx / 2 && Math.abs(c.z - box.z) + SLOT_SIZE / 2 <= box.sz / 2;
    const pad = level.base.nodes.find((n) => n.id === 'store-pad' || n.id === 'store-mark')!;
    const pp = pad.params.position as { x: number; z: number };
    const ps = pad.params.size as { x: number; z: number };
    const zones = [...level.base.nodes, ...level.tray.map((t, i) => ({ id: `t${i}`, kind: t.kind, params: t.params ?? {} }))].filter((n) => n.kind === 'zone' && n.params.filter === 'item');
    expect(zones.length).toBeGreaterThan(0);
    for (const c of centres) {
      expect(inside({ x: pp.x, z: pp.z, sx: ps.x, sz: ps.z }, c)).toBe(true);
      for (const z of zones) {
        const zc = z.params.center as { x: number; z: number };
        const zs = z.params.size as { x: number; z: number };
        expect(inside({ x: zc.x, z: zc.z, sx: zs.x, sz: zs.z }, c)).toBe(true);
      }
    }
  });

  it.each(STORES)('level $order: the brain reads back the same slots the marks are drawn at', ({ order }) => {
    const level = levelOf(order);
    const brain = level.base.nodes.find((n) => n.kind === 'slot-patrol' || n.kind === 'pad-patrol' || n.kind === 'fetch-store')!;
    expect(brain).toBeDefined();
    expect(readSlotParams(brain.params).slots).toEqual(slotRects(level.storeSlots!));
  });

  it('the stage draws slot blocks as slots and nothing else on the levels as one', () => {
    for (const { order } of STORES) {
      const level = levelOf(order);
      for (const n of level.base.nodes.filter((x) => x.kind === 'block')) {
        const view = {
          kind: 'block',
          size: n.params.size,
          color: n.params.color,
          position: n.params.position,
        } as unknown as EntityView;
        expect(stageRoleOf(view, '3d') === 'slot', n.id).toBe(n.params.color === SLOT_COLOR);
      }
    }
  });
});

describe('store slots: which slot is next', () => {
  const slots: SlotRect[] = [
    { x: 10, z: 0, size: SLOT_SIZE },
    { x: 8, z: 0, size: SLOT_SIZE },
    { x: 6, z: 0, size: SLOT_SIZE },
  ];

  it('is the first slot while the store is empty and moves on as slots fill', () => {
    expect(nextEmptySlot(slots, [])).toBe(slots[0]);
    expect(nextEmptySlot(slots, [crate(10.02, 0.03)])).toBe(slots[1]);
    expect(nextEmptySlot(slots, [crate(10, 0), crate(8, 0)])).toBe(slots[2]);
  });

  it('is null when every slot holds a crate', () => {
    expect(nextEmptySlot(slots, [crate(10, 0), crate(8, 0), crate(6, 0)])).toBeNull();
  });

  it('ignores a crate in the hands, a hidden crate and a crate lying elsewhere', () => {
    const away = [crate(10, 0, { carried: true }), crate(8, 0, { inHand: true }), crate(10, 0, { visible: false }), crate(10, 2)];
    expect(slotIsTaken(slots[0]!, away)).toBe(false);
    expect(nextEmptySlot(slots, away)).toBe(slots[0]);
  });

  it('parks the robot one hand-reach short of the slot, on the side it walks in from', () => {
    const spot = parkingSpot(slots[0]!, { x: -8, y: 0.5, z: 0 }, { x: 0.6, y: 0.6, z: 0.6 }, 0.5);
    expect(spot.z).toBeCloseTo(0);
    expect(slots[0]!.x - spot.x).toBeGreaterThan(0.9);
    expect(slots[0]!.x - spot.x).toBeLessThan(1.2);
    const back = parkingSpot({ x: -12, z: 0, size: SLOT_SIZE }, { x: 11, y: 0.5, z: 0 }, { x: 0.7, y: 0.7, z: 0.7 }, 0.5);
    expect(back.x - -12).toBeGreaterThan(0.9);
  });
});

describe('store slots: delivered crates', () => {
  /** Plays the reference answer for `seconds` and returns the bodies of the last tick plus the robot's last two seconds of travel. */
  function settle(level: PuzzleLevel, seconds: number): { bodies: BodySnapshot[]; before: BodySnapshot[] } {
    let bodies: BodySnapshot[] = [];
    let before: BodySnapshot[] = [];
    const lastTick = Math.floor(seconds * 60) - 1;
    runLevel(endless(level), { ...level.solution, wires: level.solution.wires.filter((w) => w.to.node !== 'end') }, seconds, (world, tick) => {
      if (tick === lastTick - 120) before = [...(world.debugBodies?.() ?? [])];
      if (tick === lastTick) bodies = [...(world.debugBodies?.() ?? [])];
    });
    return { bodies, before };
  }

  describe.each(STORES)('level $order', ({ order, slots, delivered }) => {
    const level = levelOf(order);
    const rects = slotRects(level.storeSlots!);
    const { bodies, before } = settle(level, 45);
    const crates = bodies.filter((b) => b.kind === 'item' && b.visible && !b.carried);
    const fits = (b: BodySnapshot, s: SlotRect): boolean =>
      Math.abs(b.pos.x - s.x) + b.size.x / 2 <= s.size / 2 + 1e-6 && Math.abs(b.pos.z - s.z) + b.size.z / 2 <= s.size / 2 + 1e-6;
    const inStore = crates.filter((b) => rects.some((s) => Math.abs(b.pos.x - s.x) <= s.size && Math.abs(b.pos.z - s.z) <= s.size));

    it('every delivered crate rests fully inside exactly one slot', () => {
      expect(inStore).toHaveLength(delivered);
      for (const b of inStore) {
        expect(rects.filter((s) => fits(b, s)).map((s) => s.x), `${b.owner} ${b.pos.x.toFixed(3)}`).toHaveLength(1);
      }
    });

    it('no two crates share a slot, and the slots fill in order from the first', () => {
      const owners = rects.map((s) => inStore.filter((b) => fits(b, s)).map((b) => b.owner));
      for (const o of owners) expect(o.length).toBeLessThanOrEqual(1);
      expect(owners.slice(0, delivered).every((o) => o.length === 1)).toBe(true);
      expect(owners.slice(delivered).every((o) => o.length === 0)).toBe(true);
      expect(delivered).toBeLessThanOrEqual(slots);
    });

    it('crates are set down on the floor, never stacked or left hanging', () => {
      for (const b of inStore) {
        expect(b.pos.y - b.size.y / 2, `${b.owner} bottom`).toBeGreaterThan(-0.02);
        expect(b.pos.y - b.size.y / 2, `${b.owner} bottom`).toBeLessThan(0.02);
      }
    });

    it('sits in the middle of the slot', () => {
      for (const b of inStore) {
        const s = rects.find((r) => fits(b, r))!;
        expect(Math.abs(b.pos.x - s.x)).toBeLessThan(0.1);
        expect(Math.abs(b.pos.z - s.z)).toBeLessThan(0.1);
      }
    });

    it('once the store is full the robot stays put instead of shuffling crates', () => {
      for (const b of inStore) {
        const was = before.find((x) => x.id === b.id)!;
        expect(Math.hypot(b.pos.x - was.pos.x, b.pos.z - was.pos.z)).toBeLessThan(1e-6);
      }
    });
  });
});
