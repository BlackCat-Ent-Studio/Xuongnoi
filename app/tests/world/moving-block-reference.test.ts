import { describe, expect, it } from 'vitest';
import type { Vec3, ViewMode } from '../../src/engine/types';
import { boundsBox, boxOverlap, colliderBox, colliderOffset } from '../../src/world/collider';
import type { Entity } from '../../src/world/entity';
import { movable, moveBlockIn, moveBlockTo, moveSceneOf, standsOn } from '../../src/world/platforms';

/**
 * A moving solid block sorts the world out beforehand (once for many blocks) and looks only at the bodies on its way. That may
 * only save work. Here the rule is written the long way, every list made anew from the whole world for every block, and held
 * against `moveBlockTo` and against one scene shared by several blocks.
 */

type Axis = 'x' | 'y' | 'z';
const OVERLAP_MIN = 1e-6;
const MAX_STEP = 0.25;
const CRUSH_DEPTH = 0.02;
const AXES = ['x', 'y', 'z'] as const;

const overlapsBox = (a: Entity, b: Entity): boolean => AXES.every((k) => boxOverlap(a, b, k) > OVERLAP_MIN);

function crushesPlain(p: Entity, crate: Entity, axis: Axis, d: number, solids: readonly Entity[]): boolean {
  if (!AXES.every((k) => boxOverlap(crate, p, k) > OVERLAP_MIN)) return false;
  const pb = colliderBox(p);
  const reach = (pb.size[axis] + boundsBox(crate).size[axis]) / 2;
  const pushed: Entity = { ...crate, pos: { ...crate.pos } };
  pushed.pos[axis] = (d > 0 ? pb.pos[axis] + reach : pb.pos[axis] - reach) - colliderOffset(crate, axis);
  return solids.some((s) => AXES.every((k) => boxOverlap(pushed, s, k) > CRUSH_DEPTH));
}

function movePlain(whole: readonly Entity[], p: Entity, to: Vec3, mode: ViewMode, apart: readonly Entity[] = []): boolean {
  const moving: Axis[] = mode === '2d-side' ? ['x', 'y'] : mode === '2d-top' ? ['x', 'z'] : ['x', 'y', 'z'];
  const fin = (n: number, fallback: number): number => (Number.isFinite(n) ? n : fallback);
  if (!p.solid) {
    for (const axis of moving) p.pos[axis] = fin(to[axis], p.pos[axis]);
    return true;
  }
  const list = whole.filter((e) => !apart.includes(e));
  const solids = list.filter((e) => e !== p && e.visible && e.solid && e.kind === 'block');
  const bodies = list.filter(movable);
  const crates = list.filter((e) => e.rigid === true && e.visible && e.heldBy === null && !e.bullet);
  let reached = true;
  for (const axis of moving) {
    const d = fin(to[axis], p.pos[axis]) - p.pos[axis];
    if (Math.abs(d) < 1e-9) continue;
    const n = Math.ceil(Math.abs(d) / MAX_STEP);
    for (let i = 0; i < n; i++) {
      const step = d / n;
      const riders = bodies.filter((e) => standsOn(e, p, mode));
      const undo: { e: Entity; from: number }[] = [{ e: p, from: p.pos[axis] }];
      p.pos[axis] += step;
      for (const r of riders) {
        undo.push({ e: r, from: r.pos[axis] });
        r.pos[axis] += step;
      }
      for (const e of bodies) {
        if (riders.includes(e) || !AXES.every((k) => boxOverlap(e, p, k) > OVERLAP_MIN)) continue;
        undo.push({ e, from: e.pos[axis] });
        const pb = colliderBox(p);
        const reach = (pb.size[axis] + colliderBox(e).size[axis]) / 2;
        e.pos[axis] = (step > 0 ? pb.pos[axis] + reach : pb.pos[axis] - reach) - colliderOffset(e, axis);
      }
      const stuck = undo.some((u) => u.e !== p && solids.some((s) => overlapsBox(u.e, s))) || crates.some((c) => !standsOn(c, p, mode) && crushesPlain(p, c, axis, step, solids));
      if (stuck) {
        for (const u of undo) u.e.pos[axis] = u.from;
        reached = false;
        break;
      }
    }
  }
  return reached;
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

/** A few platforms among people, loose items, chassis, rigid crates (some leaning) and walls, crowded enough that they meet. */
function world(next: () => number, flatZ: boolean): { list: Entity[]; platforms: Entity[] } {
  const at = (s: number): number => (next() - 0.5) * s;
  const z = (s: number): number => (flatZ ? 0 : at(s));
  const list: Entity[] = [entity('floor', 'block', { pos: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 40 } })];
  const platforms: Entity[] = [];
  for (let k = 0; k < 3; k++) {
    const p = entity(`p${k}`, 'block', { pos: { x: at(5), y: 0.25 + next() * 0.5, z: z(5) }, size: { x: 0.4 + next() * 1.5, y: 0.3 + next() * 0.4, z: 0.4 + next() * 1.5 }, solid: next() < 0.9 });
    if (next() < 0.2) p.collider = { size: { x: 0, y: 0, z: 0.3 }, offset: { x: at(0.2), y: 0, z: 0 } };
    platforms.push(p);
    list.push(p);
    // Riders and neighbours of this platform.
    for (let j = 0; j < Math.floor(next() * 4); j++) {
      const size = { x: 0.3 + next() * 0.4, y: 0.3 + next() * 1.2, z: 0.3 + next() * 0.4 };
      const onTop = next() < 0.5;
      const pos = onTop ? { x: p.pos.x + at(p.size.x), y: p.pos.y + p.size.y / 2 + size.y / 2 + [0, 0.03, 0.059, 0.07][Math.floor(next() * 4)]!, z: flatZ ? 0 : p.pos.z + at(p.size.z) } : { x: p.pos.x + at(p.size.x + 1.2), y: p.pos.y + at(0.4), z: flatZ ? 0 : p.pos.z + at(p.size.z + 1.2) };
      const kind = (['character', 'item', 'robot', 'vehicle'] as const)[Math.floor(next() * 4)]!;
      const e = entity(`b${k}-${j}`, kind, { pos, size });
      if (next() < 0.15) e.heldBy = 'someone';
      if (next() < 0.1) e.visible = false;
      if (next() < 0.15) e.collider = { size: { x: size.x * 0.6, y: 0, z: 0 }, offset: { x: at(0.1), y: 0, z: 0 } };
      list.push(e);
    }
    for (let j = 0; j < Math.floor(next() * 3); j++) {
      const size = { x: 0.2 + next() * 0.4, y: 0.2 + next() * 0.4, z: 0.2 + next() * 0.4 };
      const c = entity(`c${k}-${j}`, 'item', { rigid: true, pos: { x: p.pos.x + at(p.size.x + 0.8), y: p.pos.y + at(0.8), z: flatZ ? 0 : p.pos.z + at(p.size.z + 0.8) }, size });
      if (next() < 0.5) {
        const half = at(1.5) / 2;
        c.rot = { x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) };
      }
      list.push(c);
    }
  }
  for (let k = 0; k < 5; k++) list.push(entity(`w${k}`, 'block', { pos: { x: at(7), y: 0.5 + at(0.6), z: z(7) }, size: { x: 0.2 + next(), y: 1, z: 0.2 + next() } }));
  return { list, platforms };
}

const snapshot = (list: readonly Entity[]): string => JSON.stringify(list.map((e) => [e.id, e.pos.x, e.pos.y, e.pos.z]));
const copy = (list: readonly Entity[]): Entity[] => list.map((e) => ({ ...e, pos: { ...e.pos }, size: { ...e.size }, ...(e.collider ? { collider: { size: { ...e.collider.size }, offset: { ...e.collider.offset } } } : {}) }));

describe('a moving block does what the rule written the long way does', () => {
  for (const mode of ['3d', '2d-side', '2d-top'] as const) {
    it(`${mode}: block after block, with a fresh look at the world each time and with one scene for all`, () => {
      const next = rng(mode.length * 1000 + 17);
      let stopped = 0;
      let carried = 0;
      for (let round = 0; round < 500; round++) {
        const made = world(next, mode === '2d-side');
        const plain = copy(made.list);
        const fresh = copy(made.list);
        const shared = copy(made.list);
        const scene = moveSceneOf(shared);
        const before = snapshot(plain);
        for (let turn = 0; turn < 6; turn++) {
          const k = made.list.indexOf(made.platforms[turn % 3]!);
          const far = [0.05, 0.3, 1.2][Math.floor(next() * 3)]!;
          const to = { x: plain[k]!.pos.x + (next() - 0.5) * far * 2, y: plain[k]!.pos.y + (next() - 0.5) * far, z: plain[k]!.pos.z + (mode === '2d-side' ? 0 : (next() - 0.5) * far * 2) };
          if (next() < 0.05) to.x = NaN;
          // Now and then the block is bolted onto a neighbour, which it then neither pushes nor is stopped by.
          const base = next() < 0.2 ? made.list.indexOf(made.list.find((e) => e.id.startsWith(`b${turn % 3}-`) || e.id === `w${turn % 5}`)!) : -1;
          const want = movePlain(plain, plain[k]!, to, mode, base >= 0 ? [plain[base]!] : []);
          if (base < 0) expect(moveBlockTo(fresh, fresh[k]!, to, mode)).toBe(want);
          else expect(moveBlockIn(moveSceneOf(fresh), fresh[k]!, to, mode, [fresh[base]!])).toBe(want);
          expect(moveBlockIn(scene, shared[k]!, to, mode, base >= 0 ? [shared[base]!] : [])).toBe(want);
          expect(snapshot(fresh)).toBe(snapshot(plain));
          expect(snapshot(shared)).toBe(snapshot(plain));
          if (!want) stopped++;
        }
        const moved = JSON.parse(snapshot(plain)) as [string, number, number, number][];
        const was = JSON.parse(before) as [string, number, number, number][];
        if (moved.some((m, i) => !m[0].startsWith('p') && (m[1] !== was[i]![1] || m[2] !== was[i]![2] || m[3] !== was[i]![3]))) carried++;
      }
      // Blocks are stopped often, and often take bodies along (nothing rides in the top view, but bodies are pushed there too).
      expect(stopped).toBeGreaterThan(100);
      expect(carried).toBeGreaterThan(50);
    });
  }
});
