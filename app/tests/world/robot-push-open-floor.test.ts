import { describe, expect, it } from 'vitest';
import type { ViewMode } from '../../src/engine/types';
import { boundsBox, colliderBox } from '../../src/world/collider';
import type { Entity } from '../../src/world/entity';
import { planWhole, type PushBody } from '../../src/world/linear-actuator';
import { somethingOnTheWay } from '../../src/world/robot-push';

/**
 * A chassis that says "nothing is on my way" skips planning its push. It may only say so when the plan, made against every
 * loose item and every other chassis of the world, would move nothing.
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

describe('a chassis with nothing on its way', () => {
  for (const mode of ['3d', '2d-side', '2d-top'] as const satisfies readonly ViewMode[]) {
    it(`${mode}: would move nothing if it planned its push anyway`, () => {
      const next = rng(mode.length * 77 + 3);
      const at = (s: number): number => (next() - 0.5) * s;
      const flat = mode === '2d-top' ? 'y' : mode === '2d-side' ? 'z' : null;
      let open = 0;
      let met = 0;
      for (let round = 0; round < 4000; round++) {
        const r = entity('r', 'robot', { pos: { x: at(2), y: 0.15, z: mode === '2d-side' ? 0 : at(2) }, size: { x: 0.6 + next(), y: 0.3, z: 0.5 + next() } });
        if (next() < 0.2) r.collider = { size: { x: 0, y: 0, z: 0.4 }, offset: { x: at(0.2), y: 0, z: at(0.2) } };
        const spread = [1.5, 3, 8][round % 3]!;
        const items: Entity[] = [];
        for (let k = 0; k < 1 + Math.floor(next() * 5); k++) {
          const e = entity(`i${k}`, 'item', { pos: { x: r.pos.x + at(spread), y: 0.15 + at(0.5), z: mode === '2d-side' ? 0 : r.pos.z + at(spread) }, size: { x: 0.15 + next() * 0.5, y: 0.15 + next() * 0.5, z: 0.15 + next() * 0.5 } });
          if (next() < 0.5) {
            const q = { x: at(2), y: at(2), z: at(2), w: at(2) };
            const len = Math.hypot(q.x, q.y, q.z, q.w) || 1;
            e.rigid = true;
            e.rot = { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
          }
          if (next() < 0.15) e.collider = { size: { x: 0.2, y: 0, z: 0 }, offset: { x: at(0.3), y: at(0.3), z: at(0.3) } };
          items.push(e);
        }
        const others = next() < 0.4 ? [entity('o', 'robot', { pos: { x: r.pos.x + at(spread), y: 0.15, z: mode === '2d-side' ? 0 : r.pos.z + at(spread) }, size: { x: 0.8, y: 0.3, z: 0.6 } })] : [];
        const heading = next() * Math.PI * 2;
        const far = [0.002, 0.03, 0.2][Math.floor(next() * 3)]!;
        const move = { x: Math.cos(heading) * far, z: mode === '2d-side' ? 0 : Math.sin(heading) * far };
        const len = Math.hypot(move.x, move.z);
        if (somethingOnTheWay(r, [r, ...others, ...items], others, move, mode)) {
          met++;
          continue;
        }
        open++;
        const bodies: PushBody[] = [...items, ...others].map((e) => ({ id: e.id, box: e.kind === 'robot' ? colliderBox(e) : boundsBox(e), massKg: 1, mu: 0.5 }));
        const plan = planWhole({ head: colliderBox(r), dir: { x: move.x / len, y: 0, z: move.z / len }, step: len, bodies, solids: [], flat });
        expect(plan.moves).toEqual([]);
        expect(plan.loadIds).toEqual([]);
      }
      // Both answers are common, so the claim is really put to the test.
      expect(open).toBeGreaterThan(500);
      expect(met).toBeGreaterThan(500);
    });
  }

  it('never says so when a number is not finite', () => {
    const r = entity('r', 'robot', { pos: { x: 0, y: 0.15, z: 0 }, size: { x: 1, y: 0.3, z: 1 } });
    const far = entity('i', 'item', { pos: { x: 50, y: 0.15, z: 50 }, size: { x: 0.3, y: 0.3, z: 0.3 } });
    expect(somethingOnTheWay(r, [r, far], [], { x: 0.03, z: 0 }, '3d')).toBe(false);
    expect(somethingOnTheWay(r, [r, { ...far, pos: { x: NaN, y: 0, z: 0 } }], [], { x: 0.03, z: 0 }, '3d')).toBe(true);
    expect(somethingOnTheWay(r, [r, { ...far, size: { x: Infinity, y: 1, z: 1 } }], [], { x: 0.03, z: 0 }, '3d')).toBe(true);
    expect(somethingOnTheWay({ ...r, pos: { x: NaN, y: 0, z: 0 } }, [far], [], { x: 0.03, z: 0 }, '3d')).toBe(true);
  });
});
