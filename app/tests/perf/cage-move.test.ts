import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type Vec3 } from '../../src/engine/types';
import { block, crateWorld, floor } from '../world/crate-helpers';
import { CAGE, CUBE, FACTORY_CARTON, MASSES, buildCage, cageTear, carton, f3, readCage, seeded, stillWatch } from './cage-rig';

/**
 * A cage of five plain solid blocks (floor plate and four walls) with six cartons in it, moved 5 m along x the way the engine
 * moves blocks today: every tick each block is sent to its place round the new middle with `moveBlock`. "Vật lý thật" on.
 * A recorded run: it prints one row per carton, speed and way of starting, and asserts what the runs showed.
 *
 *   npx vitest run tests/perf/cage-move --testTimeout 900000 --silent=false
 *
 * Speeds: 1.0 m/s and 1.9 m/s (the lane speed and the cruise speed of the cage carrier in the design mock-up). "ramp" speeds up
 * and brakes at 3.5 m/s² (the mock-up's braking); "at once" jumps to full speed in one tick and stops dead, the hardest case.
 *
 * What it shows today: the floor plate carries the cartons and the walls across the way push them, but a wall that runs along
 * the way refuses to move as soon as a carton leans on it (see the note at the test that is expected to fail), so the cage
 * comes apart in most runs.
 */

const SEEDS = [1, 2, 3, 4, 5, 6];
const TRAVEL = 5;
const BRAKE = 3.5;
const NAMES = ['floor plate', 'wall behind', 'wall ahead', 'side wall -z', 'side wall +z'] as const;

interface Run {
  /** Cartons inside before the move, at its end, and the fewest at any tick. */
  before: number;
  after: number;
  fewest: number;
  /** Ticks on which each of the five blocks did not get where it was sent. */
  refused: number[];
  /** Furthest a wall stood off its place against the floor plate (m). */
  tear: number;
  inFloor: number;
  inWall: number;
  /** Seconds after the cage stopped until nothing moved any more. */
  restS: number;
}

async function move(size: Vec3, inside: number, speed: number, ramp: boolean, seed: number): Promise<Run> {
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
    if (k % 60 === 0 && ids.length < 6) {
      const side = rnd() < 0.5 ? -1 : 1;
      ids.push(carton(w, { x: side * 0.71, y: 2.6 + size.y / 2 + 0.002, z: (rnd() - 0.5) * 0.16 }, { size, kg: MASSES[ids.length % MASSES.length]! }));
    }
    w.step(TICK_DT);
  }
  const run: Run = { before: readCage(w, cage, ids).inside, after: 0, fewest: 6, refused: [0, 0, 0, 0, 0], tear: 0, inFloor: 0, inWall: 0, restS: 0 };
  const watch = stillWatch(w, ids);
  let x = 0;
  let v = 0;
  let stopTick = -1;
  let lastMove = 0;
  for (let k = 0; stopTick < 0 || k <= stopTick + 5 * 60; k++) {
    if (stopTick < 0) {
      v = ramp ? Math.min(speed, v + BRAKE * TICK_DT, Math.sqrt(2 * BRAKE * Math.max(TRAVEL - x, 0)) + 0.02) : speed;
      x = Math.min(TRAVEL, x + v * TICK_DT);
      cage.ids.forEach((id, i) => {
        const o = cage.offsets[i]!;
        if (!w.moveBlock(id, { x: x + o.x, y: o.y, z: o.z })) run.refused[i]!++;
      });
      if (x >= TRAVEL) stopTick = k;
    }
    w.step(TICK_DT);
    const r = readCage(w, cage, ids);
    run.fewest = Math.min(run.fewest, r.inside);
    run.inFloor = Math.max(run.inFloor, r.inFloor);
    run.inWall = Math.max(run.inWall, r.inWall);
    run.tear = Math.max(run.tear, cageTear(w, cage));
    if (!watch.tick()) lastMove = k;
  }
  run.after = readCage(w, cage, ids).inside;
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

const whole = (r: Run): boolean => r.refused.every((n) => n === 0);
const max = (runs: readonly Run[], pick: (r: Run) => number): number => (runs.length > 0 ? Math.max(...runs.map(pick)) : NaN);

function line(row: Row): string {
  const full = row.runs.filter((r) => r.before === 6);
  const ok = full.filter(whole);
  const torn = full.filter((r) => !whole(r));
  const refusals = NAMES.map((n, i) => `${n} ${torn.reduce((a, r) => a + r.refused[i]!, 0)}`).join(', ');
  return `| ${row.carton} | ${row.inside} | ${row.speed} | ${row.ramp ? 'ramp' : 'at once'} | ${full.length}/${row.runs.length} | ${ok.length} | ${ok.filter((r) => r.after === 6 && r.fewest === 6).length}/${ok.length} | ${f3(max(ok, (r) => r.tear) * 1000)} | ${f3(max(ok, (r) => r.inFloor) * 1000)} | ${f3(max(ok, (r) => r.inWall) * 1000)} | ${f3(max(ok, (r) => r.restS))} | ${torn.length} | ${f3(max(torn, (r) => r.tear))} | ${torn.filter((r) => r.after < 6).length} | ${torn.length > 0 ? refusals : ''} |`;
}

const HEAD =
  '| carton | inside (m) | speed (m/s) | start and stop | runs that began with 6 inside | of those: cage stayed whole | whole: 6/6 inside every tick | whole: walls off their place (mm) | whole: deepest in the floor plate (mm) | whole: deepest in a wall (mm) | whole: rest after the stop (s) | cage came apart | apart: a wall left behind by (m) | apart: runs that lost a carton | apart: ticks each block refused to move (all runs) |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|';

let rows: Row[] = [];
async function measure(): Promise<Row[]> {
  if (rows.length > 0) return rows;
  const out: Row[] = [];
  const cartons: [string, Vec3, number][] = [['0.26 cube', CUBE, 0.8], ['0.32 x 0.26 x 0.28', FACTORY_CARTON, 1.0]];
  for (const [name, size, inside] of cartons) {
    for (const speed of [1.0, 1.9]) {
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

describe('a cage of plain blocks moved with six cartons in it (recorded run)', () => {
  it('prints the table; the floor plate and the walls across the way always move, and a cage that stays whole keeps its cartons', async () => {
    const all = (await measure()).flatMap((row) => row.runs.filter((r) => r.before === 6).map((r) => ({ row, r })));
    expect(all.length).toBeGreaterThan(0);
    for (const { row, r } of all) {
      const label = `${row.carton}, ${row.speed} m/s, ${row.ramp ? 'ramp' : 'at once'}`;
      // The floor plate carries what stands on it; the wall behind pushes and the wall ahead holds back: none of them ever refuses.
      expect(r.refused.slice(0, 3), label).toEqual([0, 0, 0]);
      if (!whole(r)) continue;
      // With no wall left behind, carrying and pushing rigid cartons works as it is: all six stay inside and nothing goes through.
      expect(r.tear, label).toBeLessThan(1e-4);
      expect(r.after, label).toBe(6);
      expect(r.fewest, label).toBe(6);
      expect(r.inFloor, label).toBeLessThan(0.02);
      expect(r.inWall, label).toBeLessThan(0.02);
      expect(r.restS, label).toBeLessThanOrEqual(2);
    }
  });

  /**
   * Expected to fail today. A side wall slides along the cartons that lean on it. `stepAxis` (src/world/platforms.ts) takes
   * every rigid crate whose upright bounds reach into the moving block, by however little and on whichever axis, for a crate
   * that is pushed ahead of the block: `crushesCrate` then puts it flush against the block's face on the axis of the move
   * (here: past the END of the side wall, inside the wall ahead), finds it squeezed into that wall and makes the block refuse
   * the step. A carton resting against a side wall sits a few hundredths of a millimetre inside it, which is enough. The
   * engine has no way to say that five blocks are one body. When the rule is there this test passes and `.fails` comes off.
   */
  it.fails('the five blocks stay together in every run', async () => {
    for (const row of await measure()) for (const r of row.runs) expect(r.tear).toBeLessThan(1e-4);
  });
});
