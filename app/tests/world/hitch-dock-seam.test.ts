import { beforeAll, describe, expect, it } from 'vitest';
import type { EntityId, EntityView, ParamValue } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { measuredCage } from '../nodes/container-rig';
import { readCage } from '../perf/cage-rig';
import { hitchRig, type HitchRig } from './hitch-rig';

/**
 * A dock: the floor ends at x = 2 and a "Bệ di chuyển" of the same height starts there (a truck bed level with the dock).
 * A tug carries a full cage across the seam, sets it down on the bed and drives back; then the bed drives off.
 * Measured, not assumed: what the seam does to tug and cartons, and whether the bed takes the cage along.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const MM = 0.001;
const PILE = [
  { x: -0.2, z: -0.15, count: 3 },
  { x: 0.2, z: 0.15, count: 3 },
];
/** The bed: 4 m square, middle at x = 4, it drives 8 m along x. */
const BED = { x: 4, travel: 8, speed: 1 };

function dock(bedHitch: Record<string, ParamValue> | null): { r: HitchRig; cartons: EntityId[]; bed: () => EntityView } {
  const r = hitchRig({
    rapier,
    noFloor: true,
    drops: PILE,
    nodes: [
      ['floor', 'block', { position: { x: -9, y: -0.5, z: 0 }, size: { x: 22, y: 1, z: 20 } }],
      ['bed', 'moving-platform', { position: { x: BED.x, y: -0.25, z: 0 }, to: { x: BED.x + BED.travel, y: -0.25, z: 0 }, size: { x: 4, y: 0.5, z: 4 }, speed: BED.speed, loop: 'once' }],
      ['leave', 'const', { value: 0 }],
      ['leave-on', 'compare', { op: 'gt' }],
      ...(bedHitch ? ([['bed-switch', 'const', { value: 0 }], ['bed-switch-on', 'compare', { op: 'gt' }], ['bed-hitch', 'hitch', bedHitch]] as const).map((n) => [...n] as [string, string, Record<string, ParamValue>]) : []),
    ],
    wires: [
      ['leave', 'value', 'leave-on', 'a'],
      ['half', 'value', 'leave-on', 'b'],
      ['leave-on', 'out', 'bed', 'run'],
      ...(bedHitch
        ? ([
            ['bed-switch', 'value', 'bed-switch-on', 'a'],
            ['half', 'value', 'bed-switch-on', 'b'],
            ['bed-switch-on', 'out', 'bed-hitch', 'on'],
            ['bed', 'self', 'bed-hitch', 'carrier'],
          ] as [string, string, string, string][])
        : []),
    ],
  });
  r.play(10);
  expect(r.out('cage', 'count')).toBe(6);
  r.send(0, 0);
  expect(r.drive(20)).toBe(true);
  r.latch(true);
  r.play(1);
  expect(r.holding()).toBe(true);
  return { r, cartons: r.cartons().map((c) => c.id), bed: () => r.world.getEntity(r.out('bed', 'self') as EntityId)! };
}

interface Seen {
  inFloor: number;
  inWall: number;
  fewestInside: number;
  tugLowest: number;
  tugHighest: number;
}

const seeing = (r: HitchRig, cartons: EntityId[]): { seen: Seen; each: () => void } => {
  const seen: Seen = { inFloor: 0, inWall: 0, fewestInside: 6, tugLowest: Infinity, tugHighest: -Infinity };
  return {
    seen,
    each: () => {
      const m = readCage(r.world, measuredCage(r.world, r.cage().id), cartons);
      seen.inFloor = Math.max(seen.inFloor, m.inFloor);
      seen.inWall = Math.max(seen.inWall, m.inWall);
      seen.fewestInside = Math.min(seen.fewestInside, m.inside);
      seen.tugLowest = Math.min(seen.tugLowest, r.tug().position.y);
      seen.tugHighest = Math.max(seen.tugHighest, r.tug().position.y);
    },
  };
};

describe('a tug carries a full cage across the seam onto a bed of the same height', () => {
  it('the seam is not felt: the tug keeps its height, the six cartons stay in, the cage is set down on the bed and the tug drives back', () => {
    const { r, cartons } = dock(null);
    const { seen, each } = seeing(r, cartons);
    r.send(BED.x, 0);
    expect(r.drive(20, each)).toBe(true);
    expect(seen.tugHighest - seen.tugLowest).toBeLessThan(0.01 * MM);
    expect(seen.fewestInside).toBe(6);
    expect(seen.inFloor).toBeLessThan(5 * MM);
    expect(seen.inWall).toBeLessThan(5 * MM);
    expect(r.payload()).toBeCloseTo(26, 6);
    r.latch(false);
    r.play(0.5, each);
    const set = { ...r.cage().position };
    expect(Math.abs(set.x - BED.x)).toBeLessThan(0.15);
    r.send(0, 0);
    expect(r.drive(20, each)).toBe(true);
    expect(r.cage().position).toEqual(set);
    expect(seen.fewestInside).toBe(6);
    console.info(`seam: tug height changed by ${((seen.tugHighest - seen.tugLowest) / MM).toFixed(4)} mm, corner in plate ${(seen.inFloor / MM).toFixed(2)} mm, in wall ${(seen.inWall / MM).toFixed(2)} mm, inside ${seen.fewestInside}/6`);
  });

  // FINDING. A cage is solid blocks that stand on drawn legs: nothing of it touches the bed, and a moving block carries
  // characters, items, vehicles and robots, never other blocks. So the bed leaves and the cage hangs where it was set down.
  it('a bed that drives away does NOT take a cage that was only set down on it: the cage stays where it was, in the air', () => {
    const { r, cartons, bed } = dock(null);
    r.send(BED.x, 0);
    r.drive(20);
    r.latch(false);
    r.play(0.5);
    r.send(0, 0);
    r.drive(20);
    const set = { ...r.cage().position };
    r.set('leave', { value: 1 });
    r.play(BED.travel / BED.speed + 1);
    expect(bed().position.x).toBeCloseTo(BED.x + BED.travel, 6);
    expect(r.cage().position).toEqual(set);
    // The cartons lie on the plate of the cage, so they stay too: over nothing.
    expect(readCage(r.world, measuredCage(r.world, r.cage().id), cartons).inside).toBe(6);
  });

  it('a hitch whose "Xe" is the bed does take it: the cage with its six cartons rides the 8 m with the bed, in its place on every tick', () => {
    const { r, cartons, bed } = dock({ reach: 2.5, offset: { x: 0.8, y: 0, z: -0.6 } });
    r.send(BED.x + 0.5, -0.3);
    r.drive(20);
    r.latch(false);
    r.play(0.5);
    r.send(0, 0);
    r.drive(20);
    const { seen, each } = seeing(r, cartons);
    r.set('bed-switch', { value: 1 });
    // Drawn from where the tug left it to its slot on the bed.
    r.play(2, each);
    expect(r.out('bed-hitch', 'holding')).toBe(true);
    expect(r.cage().position.x).toBeCloseTo(BED.x + 0.8, 9);
    expect(r.cage().position.z).toBeCloseTo(-0.6, 9);
    let worst = 0;
    r.set('leave', { value: 1 });
    r.play(BED.travel / BED.speed + 1, () => {
      each();
      worst = Math.max(worst, Math.hypot(r.cage().position.x - bed().position.x - 0.8, r.cage().position.z - bed().position.z + 0.6));
    });
    expect(bed().position.x).toBeCloseTo(BED.x + BED.travel, 6);
    expect(worst).toBeLessThan(1 * MM);
    expect(seen.fewestInside).toBe(6);
    expect(seen.inFloor).toBeLessThan(20 * MM);
    expect(seen.inWall).toBeLessThan(20 * MM);
    console.info(`bed with its own hitch: cage off its slot by at most ${(worst / MM).toFixed(4)} mm, corner in plate ${(seen.inFloor / MM).toFixed(2)} mm, in wall ${(seen.inWall / MM).toFixed(2)} mm, inside ${seen.fewestInside}/6`);
  });
});
