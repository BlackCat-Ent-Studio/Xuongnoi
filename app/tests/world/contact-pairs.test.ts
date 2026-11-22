import { describe, expect, it } from 'vitest';
import { touchingPairs } from '../../src/world/contact-pairs';
import type { Entity } from '../../src/world/entity';
import { touching } from '../../src/world/physics';
import { createRobotBody } from '../../src/world/robot-drive';

/**
 * The grid may only save questions, never change an answer: on any scene it must report exactly the pairs the plain double
 * loop reports, with the earlier entity first.
 */

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

function entity(id: string, kind: Entity['kind'], over: Partial<Entity>): Entity {
  return {
    id,
    kind,
    ownerNodeId: id,
    pos: { x: 0, y: 0, z: 0 },
    size: { x: 1, y: 1, z: 1 },
    vel: { x: 0, y: 0, z: 0 },
    color: '#fff',
    solid: kind === 'block',
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

const plain = (list: readonly Entity[]): string[] => {
  const out: string[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      if (a.kind === 'block' && b.kind === 'block') continue;
      if (touching(a, b)) out.push(`${a.id}>${b.id}`);
    }
  }
  return out.sort();
};

const viaGrid = (list: readonly Entity[]): string[] => {
  const out: string[] = [];
  touchingPairs(list, (a, b) => out.push(`${a.id}>${b.id}`));
  // Each pair once.
  expect(new Set(out).size).toBe(out.length);
  return out.sort();
};

/** A scene of `n` bodies packed so that many touch: plain ones, turned crates, spinning blocks, off-centre collision boxes, wide floors. */
function scene(next: () => number, n: number, spread: number): Entity[] {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!;
  const at = (s: number): number => (next() - 0.5) * s;
  const list: Entity[] = [];
  for (let k = 0; k < n; k++) {
    const kind = pick(['block', 'block', 'item', 'item', 'item', 'robot', 'character'] as const);
    const roll = next();
    const size = roll < 0.08 ? { x: 20 + next() * 150, y: 0.2 + next(), z: 20 + next() * 150 } : { x: 0.05 + next() * 1.5, y: 0.05 + next() * 1.5, z: 0.05 + next() * 1.5 };
    const e = entity(`e${k}`, kind, { pos: { x: at(spread), y: at(3), z: at(spread) }, size });
    if (next() < 0.15) e.collider = { size: { x: next() < 0.5 ? 0 : next() * 2, y: next() * 2, z: next() < 0.5 ? 0 : next() * 2 }, offset: { x: at(2), y: at(2), z: at(2) } };
    if (kind === 'item' && next() < 0.6) {
      // Any turn, from rounding noise to upside down; a ball's turn does not count.
      const q = { x: at(2), y: at(2), z: at(2), w: at(2) };
      const tiny = next() < 0.15 ? 1e-7 : 1;
      const len = Math.hypot(q.x * tiny, q.y * tiny, q.z * tiny, q.w) || 1;
      e.rot = { x: (q.x * tiny) / len, y: (q.y * tiny) / len, z: (q.z * tiny) / len, w: q.w / len };
      e.rigid = true;
      if (next() < 0.1) e.shape = 'ball';
    }
    if (kind === 'block' && next() < 0.3) {
      e.solid = false;
      e.turn = { base: { ...e.size }, quarter: 0, offset: 0, spin: at(7), spinning: next() < 0.8, plane: next() < 0.5 ? 'xy' : 'xz' };
    }
    if (kind === 'robot' && next() < 0.7) {
      // A chassis on wheel traction touches other bodies by its length and width turned to its heading, whatever its box is.
      const heading = pick([0, Math.PI / 4, at(7), at(7)]);
      e.robot = createRobotBody({ length: 0.2 + next() * 3, width: 0.2 + next() * 3, mass: 2, friction: 0.8 }, heading, true);
      e.facing = { x: Math.cos(heading), y: 0, z: Math.sin(heading) };
    }
    if (kind === 'block' && e.solid && e.collider && next() < 0.5) e.turn = { base: { ...e.size }, quarter: 1, offset: 0, spin: 0, spinning: false, plane: 'xz' };
    list.push(e);
  }
  return list;
}

describe('touchingPairs gives the pairs of the plain double loop', () => {
  it('on crowded, loose and far-flung random scenes', () => {
    const next = rng(4711);
    let pairs = 0;
    for (let round = 0; round < 400; round++) {
      const list = scene(next, 2 + Math.floor(next() * 60), [3, 12, 60, 4000][round % 4]!);
      const want = plain(list);
      expect(viaGrid(list)).toEqual(want);
      pairs += want.length;
    }
    // The scenes do touch: the comparison is not between two empty lists.
    expect(pairs).toBeGreaterThan(5000);
  });

  it('with bodies exactly a tolerance apart, on cell borders and on the far side of the grid', () => {
    const list: Entity[] = [];
    let k = 0;
    for (const x of [0, 4, -4, 8, 1e6, 3e6, -3e6]) {
      for (const gap of [0, 0.01, 0.0100001, 0.02, 0.5]) {
        list.push(entity(`a${k}`, 'item', { pos: { x: x - 0.5, y: k * 5, z: 4 }, size: { x: 1, y: 1, z: 1 } }));
        list.push(entity(`b${k}`, 'character', { pos: { x: x + 0.5 + gap, y: k * 5, z: 4 }, size: { x: 1, y: 1, z: 1 } }));
        k++;
      }
    }
    const want = plain(list);
    expect(want.length).toBeGreaterThan(10);
    expect(viaGrid(list)).toEqual(want);
  });

  it('with places and sizes that are not numbers', () => {
    const list = scene(rng(99), 30, 6);
    list[3]!.pos.x = NaN;
    list[7]!.size.z = NaN;
    list[11]!.pos.y = Infinity;
    list[12]!.size.x = Infinity;
    list[13]!.rot = { x: NaN, y: 0, z: 0, w: 1 };
    list[14]!.size.x = -list[14]!.size.x;
    list[15]!.pos.z = 1e200;
    list[16]!.pos.x = -Infinity;
    expect(viaGrid(list)).toEqual(plain(list));
  });

  it('asks far fewer pairs than there are when the bodies are spread out', () => {
    // 20 x 20 bodies two apart: every body has at most 8 neighbours whose box could reach it.
    const list: Entity[] = [];
    for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) list.push(entity(`g${i}-${j}`, 'item', { pos: { x: i * 2, y: 0, z: j * 2 }, size: { x: 1.995, y: 1, z: 1.995 } }));
    let asked = 0;
    const counted = list.map((e) => new Proxy(e, { get: (t, key, r) => (key === 'collider' ? (asked++, undefined) : Reflect.get(t, key, r)) }));
    const found: string[] = [];
    touchingPairs(counted, (a, b) => found.push(`${a.id}>${b.id}`));
    expect(found.length).toBe(plain(list).length);
    expect(found.length).toBeGreaterThan(700);
    // `touching` reads `collider` twice per pair (once per body); making the boxes reads it once per body.
    const pairsAsked = (asked - list.length) / 2;
    expect(pairsAsked).toBeLessThan(list.length * 8);
    expect(pairsAsked).toBeLessThan((list.length * (list.length - 1)) / 2 / 20);
  });
});
