import { describe, expect, it } from 'vitest';
import { boxOverlap, colliderBox, isTurnedBody, orientedBox } from '../../src/world/collider';
import type { Entity } from '../../src/world/entity';
import type { Pt } from '../../src/world/footprint-2d';
import { DEFAULT_MASS_KG, massOn, weighSceneOf } from '../../src/world/material';
import { footprintsOverlap, obbCorners, obbOf, type Obb } from '../../src/world/oriented-box';
import { createRobotBody } from '../../src/world/robot-drive';
import { leverShares, shapeOf, supportPoint, type Shape } from '../../src/world/weighing';

/**
 * Weighing passes over pairs that cannot rest on each other before it works out their outlines. That may only save work: the
 * weight on a body must be, to the last bit, what the rule gives when every pair is asked in full. The rule is written out
 * here the long way and held against `massOn` on random machines.
 */

const REST_GAP = 0.05;

/**
 * A chassis on wheel traction (with no collision box of its own) is its length by its width, turned to where it points. Written
 * out here from the numbers, not asked of the code under test.
 */
function chassisObb(e: Entity): Obb | null {
  if (!e.robot || !e.robot.traction || e.collider) return null;
  const half = Math.atan2(-e.facing.z, e.facing.x) / 2;
  return obbOf(e.pos, { x: e.robot.spec.length, y: e.size.y, z: e.robot.spec.width }, { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });
}

function restsPlain(top: Entity, base: Entity): boolean {
  // Other bodies meet such a chassis by that outline; blocks meet its upright square.
  const withBlock = top.kind === 'block' || base.kind === 'block';
  const outT = withBlock ? null : chassisObb(top);
  const outB = withBlock ? null : chassisObb(base);
  if (outT || outB || isTurnedBody(top) || isTurnedBody(base)) {
    const lowT = obbCorners(outT ?? orientedBox(top));
    const highB = obbCorners(outB ?? orientedBox(base));
    const bottom = Math.min(...lowT.map((c) => c.y));
    const ceiling = Math.max(...highB.map((c) => c.y));
    if (Math.abs(bottom - ceiling) > REST_GAP) return false;
    return footprintsOverlap(lowT.filter((c) => c.y <= bottom + REST_GAP), highB.filter((c) => c.y >= ceiling - REST_GAP));
  }
  const t = colliderBox(top);
  const b = colliderBox(base);
  if (Math.abs(t.pos.y - t.size.y / 2 - (b.pos.y + b.size.y / 2)) > REST_GAP) return false;
  return boxOverlap(top, base, 'x') > 0 && boxOverlap(top, base, 'z') > 0;
}

/** A chassis on wheel traction weighs the mass on its card; every other body its own mass, else the default of its kind. */
const massKgOf = (e: Entity): number => (e.robot?.traction ? e.robot.spec.mass : (e.mass ?? DEFAULT_MASS_KG[e.kind]));
const isFreeCrate = (e: Entity): boolean => e.rigid === true && e.kind === 'item' && e.heldBy === null && !e.inHand && !e.bullet;

/** Every pair asked in full, nothing passed over. */
function massOnPlain(list: readonly Entity[], target: Entity, parts: ReadonlySet<Entity>): number {
  const shapes = new Map<Entity, Shape>();
  const shapeFor = (e: Entity): Shape => {
    let s = shapes.get(e);
    if (!s) shapes.set(e, (s = shapeOf(chassisObb(e) ?? orientedBox(e))));
    return s;
  };
  const bears = (e: Entity): boolean => e.visible && !e.inHand && !e.zone;
  const counts = (e: Entity): boolean => bears(e) && !parts.has(e);
  const hands = new Set<string>();
  for (const p of parts) hands.add(p.ownerNodeId);
  const gripped = (e: Entity): boolean => e.grippedBy !== undefined && hands.has(e.grippedBy);
  const holds = (top: Entity, base: Entity): Pt | null => {
    if (isFreeCrate(top)) return supportPoint(shapeFor(top), shapeFor(base));
    return restsPlain(top, base) ? { x: top.pos.x, z: top.pos.z } : null;
  };
  const above: Entity[] = [];
  const seen = new Set<Entity>([target, ...parts]);
  const queue: Entity[] = [target, ...parts];
  if (hands.size > 0) {
    for (const e of list) {
      if (!counts(e) || !gripped(e)) continue;
      seen.add(e);
      above.push(e);
      queue.push(e);
    }
  }
  while (queue.length > 0) {
    const base = queue.pop()!;
    for (const e of list) {
      if (seen.has(e) || !counts(e) || !holds(e, base)) continue;
      seen.add(e);
      above.push(e);
      queue.push(e);
    }
  }
  const height = (e: Entity): number => shapeFor(e).obb.centre.y;
  above.sort((a, b) => height(b) - height(a) || (a.id < b.id ? -1 : 1));
  const carried = new Map<Entity, { kg: number; x: number; z: number }>();
  let total = 0;
  for (const e of above) {
    const got = carried.get(e);
    const own = shapeFor(e).obb.centre;
    const kg = massKgOf(e) + (got?.kg ?? 0);
    const centre = { x: (massKgOf(e) * own.x + (got?.x ?? 0)) / kg, z: (massKgOf(e) * own.z + (got?.z ?? 0)) / kg };
    if (gripped(e)) {
      total += kg;
      continue;
    }
    const bases: Entity[] = [];
    const spots: Pt[] = [];
    for (const b of list) {
      if (b === e || !bears(b)) continue;
      const at = holds(e, b);
      if (!at) continue;
      bases.push(b);
      spots.push(at);
    }
    const shares = isFreeCrate(e) ? leverShares(spots, centre, kg) : bases.map(() => kg / Math.max(1, bases.length));
    bases.forEach((b, k) => {
      const f = shares[k]!;
      if (b === target || parts.has(b)) total += f;
      const c = carried.get(b) ?? { kg: 0, x: 0, z: 0 };
      c.kg += f;
      c.x += f * spots[k]!.x;
      c.z += f * spots[k]!.z;
      carried.set(b, c);
    });
  }
  return total;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let serial = 0;
function entity(kind: Entity['kind'], over: Partial<Entity>): Entity {
  const id = `e${serial++}`;
  return {
    id,
    kind,
    ownerNodeId: id,
    pos: { x: 0, y: 0, z: 0 },
    size: { x: 1, y: 1, z: 1 },
    vel: { x: 0, y: 0, z: 0 },
    color: '#fff',
    solid: kind !== 'item',
    visible: true,
    onGround: false,
    intent: null,
    facing: { x: 1, y: 0, z: 0 },
    holding: null,
    handHolding: null,
    swingTime: -1,
    heldBy: null,
    inHand: false,
    carryable: kind === 'item',
    holdStyle: 'head',
    seatedIn: null,
    ...over,
  };
}

interface Machine {
  chassis: Entity;
  parts: Set<Entity>;
}

/** Points a chassis on wheel traction along `heading` (radians), as a step of the world does. */
function turnTo(chassis: Entity, heading: number): void {
  chassis.robot!.heading = heading;
  chassis.facing = { x: Math.cos(heading), y: 0, z: Math.sin(heading) };
}

/**
 * A yard of chassis with trays, crates on and around them (flat, leaning, stacked, on rims, in a hand), blocks and floors.
 * With `traction` the chassis drive on wheel traction: each has a length and a width of its own and stands at any heading.
 */
function yard(next: () => number, traction = false): { list: Entity[]; machines: Machine[] } {
  const at = (s: number): number => (next() - 0.5) * s;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!;
  const turn = (how: number): Entity['rot'] => {
    // 0: rounding noise, as a crate at rest has; 1: any turn; else a lean about a ground axis.
    if (how < 0.3) return { x: at(2e-7), y: at(2e-7), z: at(2e-7), w: 1 };
    if (how < 0.5) {
      const q = { x: at(2), y: at(2), z: at(2), w: at(2) };
      const len = Math.hypot(q.x, q.y, q.z, q.w) || 1;
      return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
    }
    const half = at(1.2) / 2;
    return next() < 0.5 ? { x: Math.sin(half), y: 0, z: 0, w: Math.cos(half) } : { x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) };
  };
  const crateOn = (x: number, top: number, z: number): Entity => {
    const size = { x: 0.15 + next() * 0.5, y: 0.15 + next() * 0.5, z: 0.15 + next() * 0.5 };
    const how = next();
    const e = entity('item', { rigid: true, pos: { x, y: top + size.y / 2 + pick([0, 0, 0.005, -0.01, 0.019, 0.03, -0.04, 0.2]), z }, size, mass: 0.5 + next() * 9 });
    if (how > 0.15) e.rot = turn(next());
    if (next() < 0.1) e.collider = { size: { x: 0, y: size.y * 0.8, z: 0 }, offset: { x: at(0.1), y: 0, z: at(0.1) } };
    return e;
  };
  const list: Entity[] = [];
  const machines: Machine[] = [];
  list.push(entity('block', { pos: { x: 0, y: -0.5, z: 0 }, size: { x: 80, y: 1, z: 80 } }));
  const count = 2 + Math.floor(next() * 5);
  const pitch = pick([0.9, 1.6, 2.5, 6]);
  for (let k = 0; k < count; k++) {
    const x = at(1);
    const z = (k - count / 2) * pitch;
    const chassis = entity('robot', { pos: { x, y: 0.15, z }, size: { x: 0.8 + next(), y: 0.3, z: 0.6 + next() * 0.6 } });
    if (traction) {
      // As the chassis card makes it: the box is the square round the longer side, the real length and width ride along.
      const length = chassis.size.x;
      const width = pick([chassis.size.z, 0.3, length]);
      const side = Math.max(length, width);
      chassis.size = { x: side, y: 0.3, z: side };
      chassis.robot = createRobotBody({ length, width, mass: 5, friction: 0.8 }, 0, true);
      turnTo(chassis, pick([0, Math.PI / 2, Math.PI / 4, at(7), at(7), 1e-12]));
      // Now and then one with a collision box of its own, which stays upright.
      if (next() < 0.1) chassis.collider = { size: { x: 0.5, y: 0, z: 0 }, offset: { x: 0.1, y: 0, z: 0 } };
    }
    const parts = new Set<Entity>();
    list.push(chassis);
    let top = 0.3;
    if (next() < 0.7) {
      // A tray bolted on: a slab, sometimes very thin one way.
      const slab = entity('block', { ownerNodeId: `tray${k}`, pos: { x: x + at(0.3), y: 0.4, z: z + at(0.2) }, size: { x: pick([0.8, 1.2, 0.0005]), y: 0.2, z: pick([0.6, 1, 0.0005]) } });
      parts.add(slab);
      list.push(slab);
      top = 0.5;
    }
    machines.push({ chassis, parts });
    const loads = Math.floor(next() * 4);
    let under = top;
    let cx = x + at(0.4);
    let cz = z + at(0.4);
    for (let j = 0; j < loads; j++) {
      // On the chassis, on the crate before it, or out at a rim.
      const c = crateOn(cx + (next() < 0.25 ? pick([-1, 1]) * (0.3 + next() * 0.9) : at(0.1)), under, cz + at(0.1));
      list.push(c);
      if (next() < 0.6) {
        under = c.pos.y + c.size.y / 2;
        cx = c.pos.x;
        cz = c.pos.z;
      }
    }
    if (next() < 0.15) list.push(entity('item', { rigid: true, grippedBy: `tray${k}`, pos: { x: x + 3, y: 2, z }, size: { x: 0.3, y: 0.3, z: 0.3 }, mass: 2 }));
    if (next() < 0.2) list.push(entity('character', { pos: { x: x + at(0.3), y: top + 0.9, z }, size: { x: 0.5, y: 1.8, z: 0.5 } }));
    if (traction) {
      // Things out where the square and the turned outline differ: a crate at a corner of the bare top, one that is not rigid, a block.
      const reach = chassis.size.x / 2;
      if (next() < 0.5) list.push(crateOn(x + pick([-1, 1]) * reach * (0.6 + next() * 0.5), 0.3, z + pick([-1, 1]) * reach * (0.6 + next() * 0.5)));
      if (next() < 0.3) list.push(entity('item', { pos: { x: x + at(2 * reach), y: 0.3 + 0.1, z: z + at(2 * reach) }, size: { x: 0.2, y: 0.2, z: 0.2 }, mass: 3 }));
      if (next() < 0.2) list.push(entity('block', { pos: { x: x + at(2 * reach), y: 0.3 + 0.05, z: z + at(2 * reach) }, size: { x: 0.2, y: 0.1, z: 0.2 }, mass: 4 }));
      // And another chassis parked on top of this one, askew.
      if (next() < 0.1) {
        const rider = entity('robot', { pos: { x: x + at(1.5), y: 0.3 + 0.1, z: z + at(1.5) }, size: { x: 0.5, y: 0.2, z: 0.5 } });
        rider.robot = createRobotBody({ length: 0.5, width: 0.25, mass: 2, friction: 0.8 }, 0, true);
        turnTo(rider, at(7));
        list.push(rider);
      }
    }
  }
  // Loose things about the yard: crates on the floor, blocks, a second floor piece, something hidden, a zone.
  for (let k = 0; k < 6 + Math.floor(next() * 10); k++) list.push(crateOn(at(12), 0, at(12)));
  for (let k = 0; k < 4; k++) list.push(entity('block', { pos: { x: at(12), y: 0.25, z: at(12) }, size: { x: 0.5 + next(), y: 0.5, z: 0.5 + next() } }));
  list.push(entity('block', { pos: { x: 60, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 80 } }));
  list.push(entity('item', { rigid: true, visible: false, pos: { x: 0, y: 0.5, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 } }));
  list.push(entity('block', { zone: true, solid: false, pos: { x: 0, y: 0.5, z: 0 }, size: { x: 3, y: 1, z: 3 } }));
  // Shuffled: what rests on what must not depend on who was made first.
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return { list, machines };
}

describe('massOn with its shortcuts gives the weight of the plain rule', () => {
  it('on random yards of chassis, trays and crates, to the last bit', () => {
    const next = rng(8128);
    let loaded = 0;
    let asked = 0;
    for (let round = 0; round < 400; round++) {
      const { list, machines } = yard(next);
      for (const m of machines) {
        const want = massOnPlain(list, m.chassis, m.parts);
        expect(massOn(list, m.chassis, m.parts)).toBe(want);
        asked++;
        if (want > 0) loaded++;
      }
      // A scale on the floor too: any block can be asked.
      const block = list.find((e) => e.kind === 'block' && !e.zone)!;
      expect(massOn(list, block)).toBe(massOnPlain(list, block, new Set()));
    }
    // Many of the chassis do carry something, and many carry nothing.
    expect(loaded).toBeGreaterThan(asked / 4);
    expect(asked - loaded).toBeGreaterThan(asked / 10);
  });

  it('with one scene for chassis after chassis, each driving off before the next is weighed', () => {
    const next = rng(31337);
    let loaded = 0;
    for (let round = 0; round < 200; round++) {
      const { list, machines } = yard(next);
      const scene = weighSceneOf(list);
      // Twice round the fleet: the second time every chassis stands somewhere else than when the scene was made.
      for (const m of [...machines, ...machines]) {
        const want = massOnPlain(list, m.chassis, m.parts);
        expect(massOn(list, m.chassis, m.parts, scene)).toBe(want);
        if (want > 0) loaded++;
        // As in a tick: the chassis moves (from under its load, or under a neighbour's), the crates stay where they are.
        m.chassis.pos.x += (next() - 0.5) * 1.5;
        m.chassis.pos.z += (next() - 0.5) * 1.5;
      }
    }
    expect(loaded).toBeGreaterThan(300);
  });

  it('chassis on wheel traction bear by their turned outline: random yards, to the last bit', () => {
    const next = rng(271828);
    let loaded = 0;
    let asked = 0;
    let differs = 0;
    for (let round = 0; round < 400; round++) {
      const { list, machines } = yard(next, true);
      for (const m of machines) {
        const want = massOnPlain(list, m.chassis, m.parts);
        expect(massOn(list, m.chassis, m.parts)).toBe(want);
        asked++;
        if (want > 0) loaded++;
        // The same chassis as an upright square (no traction) would weigh something else here: the outline matters.
        const body = m.chassis.robot!;
        m.chassis.robot = { ...body, traction: false };
        if (massOnPlain(list, m.chassis, m.parts) !== want) differs++;
        m.chassis.robot = body;
      }
      const block = list.find((e) => e.kind === 'block' && !e.zone)!;
      expect(massOn(list, block)).toBe(massOnPlain(list, block, new Set()));
    }
    expect(loaded).toBeGreaterThan(asked / 4);
    expect(asked - loaded).toBeGreaterThan(asked / 10);
    expect(differs).toBeGreaterThan(asked / 20);
  });

  it('chassis on wheel traction, one scene for chassis after chassis, each driving off and turning before the next is weighed', () => {
    const next = rng(161803);
    let loaded = 0;
    for (let round = 0; round < 200; round++) {
      const { list, machines } = yard(next, true);
      const scene = weighSceneOf(list);
      for (const m of [...machines, ...machines]) {
        const want = massOnPlain(list, m.chassis, m.parts);
        expect(massOn(list, m.chassis, m.parts, scene)).toBe(want);
        if (want > 0) loaded++;
        m.chassis.pos.x += (next() - 0.5) * 1.5;
        m.chassis.pos.z += (next() - 0.5) * 1.5;
        turnTo(m.chassis, m.chassis.robot!.heading + (next() - 0.5) * 3);
      }
    }
    expect(loaded).toBeGreaterThan(300);
  });

  it('with sizes and places that are not numbers', () => {
    const next = rng(5);
    for (let round = 0; round < 30; round++) {
      const { list, machines } = yard(next);
      const odd = list.filter((e) => e.kind !== 'robot');
      odd[round % odd.length]!.pos.x = [NaN, Infinity, -Infinity][round % 3]!;
      odd[(round * 7) % odd.length]!.size.z = [NaN, Infinity, 0][round % 3]!;
      for (const m of machines) expect(massOn(list, m.chassis, m.parts)).toBe(massOnPlain(list, m.chassis, m.parts));
    }
    for (let round = 0; round < 30; round++) {
      const { list, machines } = yard(next, true);
      const odd = list.filter((e) => !machines.some((m) => m.chassis === e));
      odd[round % odd.length]!.pos.x = [NaN, Infinity, -Infinity][round % 3]!;
      odd[(round * 7) % odd.length]!.size.z = [NaN, Infinity, 0][round % 3]!;
      for (const m of machines) expect(massOn(list, m.chassis, m.parts)).toBe(massOnPlain(list, m.chassis, m.parts));
    }
  });
});
