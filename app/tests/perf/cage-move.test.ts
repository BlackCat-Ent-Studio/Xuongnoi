import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type Vec3 } from '../../src/engine/types';
import { block, crateWorld, floor } from '../world/crate-helpers';
import { CAGE, CUBE, FACTORY_CARTON, MASSES, buildCage, cageMiddle, cageTear, carton, f3, moveCage, moveCageBlockByBlock, readCage, seeded, stillWatch } from './cage-rig';

/**
 * A cage of five plain solid blocks (floor plate and four walls) with six cartons in it, moved 5 m along x as one body: every
 * tick the five blocks are sent on together with `moveBlocks`. "Vật lý thật" on. A recorded run: it prints one row per carton,
 * speed and way of starting, and asserts what the runs showed.
 *
 * By default a few runs only (the fastest speed, two drops each). All 48 take about a minute and a half and run when asked:
 *
 *   VITE_CAGE_RUNS=all npx vitest run tests/perf/cage-move --testTimeout 900000 --silent=false
 *
 * Speeds: 1.0 m/s and 1.9 m/s (the lane speed and the cruise speed of the cage carrier in the design mock-up). "ramp" speeds up
 * and brakes at 3.5 m/s² (the mock-up's braking); "at once" jumps to full speed in one tick and stops dead, the hardest case.
 */

const ALL = (import.meta.env.VITE_CAGE_RUNS as string | undefined) === 'all';
const SEEDS = ALL ? [1, 2, 3, 4, 5, 6] : [1, 2];
const SPEEDS = ALL ? [1.0, 1.9] : [1.9];
const TRAVEL = 5;
const BRAKE = 3.5;

interface Run {
  /** Cartons inside before the move, at its end, and the fewest at any tick. */
  before: number;
  after: number;
  fewest: number;
  /** Ticks on which the cage (or, sent block by block, any of its five blocks) did not get where it was sent. */
  refused: number;
  /** Furthest a wall stood off its place against the floor plate (m). */
  tear: number;
  inFloor: number;
  inWall: number;
  /** Furthest a carton corner stood beyond the inner face of a wall (m), and on how many ticks that was more than 10 mm. */
  pastInnerFace: number;
  deepTicks: number;
  /** Seconds after the cage stopped until nothing moved any more. */
  restS: number;
  /** Where the middle of the cage stood at the end (m along the way). */
  endX: number;
}

async function move(size: Vec3, inside: number, speed: number, ramp: boolean, seed: number, count = 6, how: 'as one body' | 'block by block' = 'as one body'): Promise<Run> {
  const w = await crateWorld();
  floor(w);
  const cage = buildCage(w, { ...CAGE, inside });
  // Six cartons tipped in from belts at deck height (as in the pile run), then 5 s to lie still.
  for (const side of [-1, 1]) {
    const id = block(w, side * 0.86, 2.5, 0, 1.2, 0.2, 0.5, { belt: { axis: 'x', walls: false } });
    w.setBeltSpeed(id, -side * 0.93);
  }
  const rnd = seeded(seed);
  const ids: EntityId[] = [];
  for (let k = 0; k < 6 * 60 + 300; k++) {
    if (k % 60 === 0 && ids.length < count) {
      const side = rnd() < 0.5 ? -1 : 1;
      ids.push(carton(w, { x: side * 0.71, y: 2.6 + size.y / 2 + 0.002, z: (rnd() - 0.5) * 0.16 }, { size, kg: MASSES[ids.length % MASSES.length]! }));
    }
    w.step(TICK_DT);
  }
  const run: Run = { before: readCage(w, cage, ids).inside, after: 0, fewest: count, refused: 0, tear: 0, inFloor: 0, inWall: 0, pastInnerFace: 0, deepTicks: 0, restS: 0, endX: 0 };
  const watch = stillWatch(w, ids);
  let x = 0;
  let v = 0;
  let stopTick = -1;
  let lastMove = 0;
  for (let k = 0; stopTick < 0 || k <= stopTick + 5 * 60; k++) {
    if (stopTick < 0) {
      v = ramp ? Math.min(speed, v + BRAKE * TICK_DT, Math.sqrt(2 * BRAKE * Math.max(TRAVEL - x, 0)) + 0.02) : speed;
      x = Math.min(TRAVEL, x + v * TICK_DT);
      if (how === 'block by block' ? moveCageBlockByBlock(w, cage, x, 0) > 0 : !moveCage(w, cage, x, 0)) run.refused++;
      if (x >= TRAVEL) stopTick = k;
    }
    w.step(TICK_DT);
    const r = readCage(w, cage, ids);
    run.fewest = Math.min(run.fewest, r.inside);
    run.inFloor = Math.max(run.inFloor, r.inFloor);
    run.inWall = Math.max(run.inWall, r.inWall);
    run.pastInnerFace = Math.max(run.pastInnerFace, r.pastInnerFace);
    if (r.pastInnerFace > 0.01) run.deepTicks++;
    run.tear = Math.max(run.tear, cageTear(w, cage));
    if (!watch.tick()) lastMove = k;
  }
  run.after = readCage(w, cage, ids).inside;
  run.endX = cageMiddle(w, cage).x;
  run.restS = Math.max(0, (lastMove + 1 - stopTick) * TICK_DT);
  w.dispose?.();
  return run;
}

interface Row {
  carton: string;
  inside: number;
  speed: number;
  ramp: boolean;
  runs: Run[];
}

const whole = (r: Run): boolean => r.refused === 0 && r.tear < 1e-4;
const max = (runs: readonly Run[], pick: (r: Run) => number): number => (runs.length > 0 ? Math.max(...runs.map(pick)) : NaN);

function line(row: Row): string {
  const full = row.runs.filter((r) => r.before === 6);
  const ok = full.filter(whole);
  return `| ${row.carton} | ${row.inside} | ${row.speed} | ${row.ramp ? 'ramp' : 'at once'} | ${full.length}/${row.runs.length} | ${ok.length}/${full.length} | ${full.filter((r) => r.after === 6 && r.fewest === 6).length}/${full.length} | ${f3(max(full, (r) => r.tear) * 1000)} | ${full.reduce((a, r) => a + r.refused, 0)} | ${f3(max(full, (r) => r.inFloor) * 1000)} | ${f3(max(full, (r) => r.inWall) * 1000)} | ${f3(max(full, (r) => r.pastInnerFace) * 1000)} | ${max(full, (r) => r.deepTicks)} | ${f3(max(full, (r) => r.restS))} |`;
}

const HEAD =
  '| carton | inside (m) | speed (m/s) | start and stop | runs that began with 6 inside | cage stayed whole | 6/6 inside every tick | walls off their place at most (mm) | ticks the cage refused to move | deepest in the floor plate (mm) | deepest in a wall, from its nearest face (mm) | furthest beyond the inner face of a wall (mm) | most ticks in one run with a corner more than 10 mm beyond it | longest rest after the stop (s) |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|';

let rows: Row[] = [];
async function measure(): Promise<Row[]> {
  if (rows.length > 0) return rows;
  const out: Row[] = [];
  const cartons: [string, Vec3, number][] = [['0.26 cube', CUBE, 0.8], ['0.32 x 0.26 x 0.28', FACTORY_CARTON, 1.0]];
  for (const [name, size, inside] of cartons) {
    for (const speed of SPEEDS) {
      for (const ramp of [true, false]) {
        const runs: Run[] = [];
        for (const seed of SEEDS) runs.push(await move(size, inside, speed, ramp, seed));
        out.push({ carton: name, inside, speed, ramp, runs });
      }
    }
  }
  console.log([HEAD, ...out.map(line)].join('\n'));
  rows = out;
  return out;
}

describe(`a cage of plain blocks moved as one body with six cartons in it (recorded run, ${ALL ? 'all 48' : 'the short set'})`, () => {
  it('prints the table; the cage stays whole in every run, keeps its six cartons on every tick and lies still soon after the stop', async () => {
    const all = (await measure()).flatMap((row) => row.runs.map((r) => ({ row, r })));
    expect(all.length).toBe(SEEDS.length * SPEEDS.length * 4);
    for (const { row, r } of all) {
      const label = `${row.carton}, ${row.speed} m/s, ${row.ramp ? 'ramp' : 'at once'}`;
      expect(r.before, label).toBe(6);
      // The five blocks go as one body: it never refuses a step here, and no wall ever stands off its place by 0.1 mm.
      expect(r.refused, label).toBe(0);
      expect(r.tear, label).toBeLessThan(1e-4);
      expect(r.endX, label).toBeCloseTo(TRAVEL, 6);
      expect(r.after, label).toBe(6);
      expect(r.fewest, label).toBe(6);
      // No carton goes through the 50 mm plates. In the floor plate a corner sits at most as deep as when cartons land on it.
      expect(r.inFloor, label).toBeLessThan(0.02);
      if (row.ramp) {
        // Speeding up and braking gently, no corner goes deeper into a wall than a touch.
        expect(r.pastInnerFace, label).toBeLessThan(0.01);
      } else {
        // Started and stopped dead, a wall jumps up to 32 mm in one tick onto the cartons (or they slam into it): for a few
        // ticks a corner stands up to 30 mm inside the wall, and never comes out on the other side.
        expect(r.pastInnerFace, label).toBeLessThan(0.04);
        expect(r.deepTicks, label).toBeLessThanOrEqual(30);
      }
      expect(r.restS, label).toBeLessThanOrEqual(2);
    }
  });

  it('an empty cage goes the same way: whole, and all the way', async () => {
    for (const ramp of [true, false]) {
      const r = await move(CUBE, 0.8, 1.9, ramp, 1, 0);
      expect([r.before, r.after, r.refused]).toEqual([0, 0, 0]);
      expect(r.tear).toBeLessThan(1e-4);
      expect(r.endX).toBeCloseTo(TRAVEL, 6);
    }
  });

  it('sent block by block the cage stays whole too, now that a wall slides along the cartons that lean on it', async () => {
    // The way that used to come apart (40 of 48 runs): the two walls along the way refused to move.
    for (const [size, inside] of [[CUBE, 0.8], [FACTORY_CARTON, 1.0]] as const) {
      const r = await move(size, inside, 1.9, false, 1, 6, 'block by block');
      expect([r.before, r.after, r.fewest, r.refused]).toEqual([6, 6, 6, 0]);
      expect(r.tear).toBeLessThan(1e-4);
    }
  });
});
