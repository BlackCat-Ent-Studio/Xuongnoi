import { describe, expect, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import type { Entity } from '../../src/world/entity';
import { massOn } from '../../src/world/material';
import { leverShares } from '../../src/world/weighing';
import { block, crate, crateWorld, floor, run } from './crate-helpers';

/**
 * A loose crate loads each thing it rests on with its share of the weight: the pushes add up to the weight and balance about the crate's
 * centre of mass (lever rule). Hand numbers are worked out beside each case.
 */

function ent(over: Partial<Entity> & Pick<Entity, 'id' | 'kind' | 'pos' | 'size'>): Entity {
  return {
    ownerNodeId: 't',
    vel: { x: 0, y: 0, z: 0 },
    color: '#fff',
    solid: false,
    visible: true,
    onGround: false,
    intent: null,
    facing: { x: 1, y: 0, z: 0 },
    holding: null,
    handHolding: null,
    swingTime: -1,
    heldBy: null,
    inHand: false,
    carryable: true,
    holdStyle: 'head',
    seatedIn: null,
    ...over,
  };
}

describe('lever rule', () => {
  it('one support carries it all; two split by the distances to the centre of mass', () => {
    expect(leverShares([{ x: 3, z: 1 }], { x: 0, z: 0 }, 10)).toEqual([10]);
    // Supports at x = -1 and x = +3, centre of mass at 0: the near one carries 3/4.
    const two = leverShares([{ x: -1, z: 0 }, { x: 3, z: 0 }], { x: 0, z: 0 }, 8);
    expect(two[0]).toBeCloseTo(6, 9);
    expect(two[1]).toBeCloseTo(2, 9);
  });

  it('three supports: the one balance that is possible, and the nearest ones when the centre lies outside', () => {
    // Corners (0,0), (1,0), (0,1) and the centre at (0.25, 0.25): F = (0.5, 0.25, 0.25) W.
    const f = leverShares([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }], { x: 0.25, z: 0.25 }, 20);
    expect(f[0]).toBeCloseTo(10, 9);
    expect(f[1]).toBeCloseTo(5, 9);
    expect(f[2]).toBeCloseTo(5, 9);
    // Centre beyond the (1,0)-(0,1) side: nothing can balance it with all three, so the two near ones share it.
    const g = leverShares([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }], { x: 0.8, z: 0.8 }, 20);
    expect(g[0]).toBe(0);
    expect(g[1]! + g[2]!).toBeCloseTo(20, 9);
  });
});

describe('scale: a crate loads the scale with its share (real engine)', () => {
  const SCALE_X = -0.5;
  async function setup(crateX: number, extra: { top?: { mass: number } } = {}) {
    const w = await crateWorld();
    floor(w);
    // Scale: x -1..0, floor block of the same height: x 0..1, both 0.2 high.
    const scale = block(w, SCALE_X, 0.1, 0, 1, 0.2, 1);
    const side = block(w, 0.5, 0.1, 0, 1, 0.2, 1);
    const c = crate(w, crateX, 0.4, 0, { x: 0.4, y: 0.4, z: 0.4 }, { mass: 10, mu: 0.5 });
    if (extra.top) crate(w, crateX, 0.8, 0, { x: 0.4, y: 0.4, z: 0.4 }, { mass: extra.top.mass, mu: 0.5 });
    run(w, 2);
    return { w, scale, side, c };
  }

  it('half on the scale, half on a block of the same height: 5 kg each, and together the whole 10 kg', async () => {
    // Crate x -0.2..0.2 with the seam at 0: each patch is 0.2 x 0.4, centres at -0.1 and +0.1, centre of mass at 0 -> 5 / 5.
    // Tolerance 0.05 kg (0.5 %): the crate settles a few millimetres, which moves the patch middles by as much.
    const { w, scale, side } = await setup(0);
    expect(w.massOn(scale)).toBeCloseTo(5, 1);
    expect(w.massOn(side)).toBeCloseTo(5, 1);
    expect(w.massOn(scale) + w.massOn(side)).toBeCloseTo(10, 1);
  });

  it('fully on the scale: all 10 kg', async () => {
    const { w, scale, side } = await setup(-0.5);
    expect(w.massOn(scale)).toBeCloseTo(10, 6);
    expect(w.massOn(side)).toBe(0);
  });

  it('a quarter on the scale: its centre of mass is over the block, which carries 3/4', async () => {
    // Crate x -0.05..0.35 (centre 0.15): patch on the scale 0.05 wide (middle -0.025), on the block 0.35 wide (middle 0.175).
    // Lever: scale share = (0.175 - 0.15) / (0.175 + 0.025) = 0.125 -> 1.25 kg, block 8.75 kg.
    const { w, scale, side } = await setup(0.15);
    expect(w.massOn(scale)).toBeCloseTo(1.25, 1);
    expect(w.massOn(side)).toBeCloseTo(8.75, 1);
  });

  it('two crates stacked on the scale: the scale reads both, and a half-on pair passes the top one on through the lower', async () => {
    const full = await setup(-0.5, { top: { mass: 4 } });
    expect(full.w.massOn(full.scale)).toBeCloseTo(14, 1);
    // Lower crate half on each block, 4 kg on top of its middle: 5 + 2 each.
    const half = await setup(0, { top: { mass: 4 } });
    expect(half.w.massOn(half.scale)).toBeCloseTo(7, 1);
    expect(half.w.massOn(half.side)).toBeCloseTo(7, 1);
  });

  it('the read-out at rest does not move: under 1 % over 2 s, for a half-on crate and for a stack', async () => {
    for (const setupArgs of [[0, {}], [0.15, { top: { mass: 4 } }]] as const) {
      const { w, scale } = await setup(setupArgs[0], setupArgs[1]);
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < Math.round(2 / TICK_DT); i++) {
        w.step(TICK_DT);
        const kg = w.massOn(scale);
        lo = Math.min(lo, kg);
        hi = Math.max(hi, kg);
      }
      expect((hi - lo) / ((hi + lo) / 2)).toBeLessThan(0.01);
    }
  });
});

describe('scale: a crate leaning on the scale edge (static pose)', () => {
  // Crate 2 x 0.4 x 0.4, 10 kg, long side along its x, turned 30 degrees about z: its lowest end corner rests on the floor, its
  // underside rests on the edge of a 0.8 m high scale whose top is above the crate's middle.
  // Centre c = (0, 0.5 + 0.2 cos30) = (0, 0.6732). Floor corner at x = -cos30 + 0.2 sin30 = -0.7660.
  // Underside through the edge (xe, 0.8): n = (-sin30, cos30); n.(p - c) = -0.2  ->  xe = (cos30 (0.8 - 0.6732) + 0.2) / sin30 = 0.6196.
  // Lever: scale share = (0 - (-0.7660)) / (0.6196 + 0.7660) = 0.5528 -> 5.53 kg, floor block 4.47 kg.
  const S30 = Math.sin(Math.PI / 12);
  const C30 = Math.cos(Math.PI / 12);
  const rot = { x: 0, y: 0, z: S30, w: C30 };
  // The plates weigh nothing themselves, so what each reads is the crate's share alone.
  const scale = ent({ id: 's', kind: 'block', pos: { x: 0.6196 + 0.5, y: 0.4, z: 0 }, size: { x: 1, y: 0.8, z: 1 }, solid: true, mass: 0 });
  const ground = ent({ id: 'g', kind: 'block', pos: { x: 0, y: -0.5, z: 0 }, size: { x: 20, y: 1, z: 20 }, solid: true });
  const leaning = ent({ id: 'c', kind: 'item', pos: { x: 0, y: 0.5 + 0.2 * Math.cos(Math.PI / 6), z: 0 }, size: { x: 2, y: 0.4, z: 0.4 }, rot, rigid: true, mass: 10 });

  it('reads its share on the scale, the rest on the floor block, and the two add up to the weight', () => {
    const list = [ground, scale, leaning];
    const onScale = massOn(list, scale);
    // The ground carries the crate's floor share and, through the scale, the rest: the whole 10 kg.
    const onGround = massOn(list, ground) - onScale;
    // The patches are taken within 2 cm of the supports' top, so their middles are up to about 2 cm / tan30 = 3.5 cm off the hand points
    // (a lever arm of 1.4 m): tolerance 0.15 kg (1.5 % of the weight).
    expect(onScale).toBeGreaterThan(5.53 - 0.15);
    expect(onScale).toBeLessThan(5.53 + 0.15);
    // Floor block alone: what the ground reads minus what came down through the scale. Hand value 4.47, measured 4.58.
    expect(onGround).toBeGreaterThan(4.47 - 0.15);
    expect(onGround).toBeLessThan(4.47 + 0.15);
    expect(onScale + onGround).toBeCloseTo(10, 9);
  });

  it('a crate pressed against the side of the scale (standing on the floor beside it) loads nothing', () => {
    const beside = ent({ id: 'b', kind: 'item', pos: { x: 0.5 - 0.2 + 0.01, y: 0.2, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, rot: { x: 0, y: 0, z: 0, w: 1 }, rigid: true, mass: 7 });
    const low = ent({ id: 'l', kind: 'block', pos: { x: 1, y: 0.1, z: 0 }, size: { x: 1, y: 0.2, z: 1 }, solid: true, mass: 0 });
    // Crate x 0.11..0.51, 1 cm into the low block (x 0.5..1.5, top 0.2), standing on the floor: it is beside it, not on it.
    expect(massOn([ground, low, beside], low)).toBe(0);
    expect(massOn([ground, low, beside], ground)).toBe(7);
  });
});
