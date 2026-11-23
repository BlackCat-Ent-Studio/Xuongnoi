import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type Vec3, type World } from '../../src/engine/types';
import { block, crateWorld, floor } from '../world/crate-helpers';
import { CAGE, CUBE, FACTORY_CARTON, MASSES, buildCage, carton, f3, readCage, seeded, stillWatch } from './cage-rig';

/**
 * Cartons piling up in an open-top cage of plain solid blocks, "Vật lý thật" on: a recorded run that prints one row per cage
 * size, carton and count (8 repeatable drops each), and asserts only what held in every one of them.
 *
 *   npx vitest run tests/perf/cage-pile --testTimeout 900000 --silent=false
 *
 * The cage floor stands 0.40 m above the ground (0.35 m of room under it), its rim 1 m higher; cartons of 1 / 2 / 5 kg in turn
 * start at the height of a deck 2.6 m up. Two ways in:
 *  - "straight": let go above the cage, up to 0.15 m off its middle;
 *  - "tipped": carried over the edge of a belt at deck height at 0.93 m/s from one of two opposite sides, so that the carton
 *    passes the underside of the deck (2.4 m) near the middle of the cage: the speed and place a carton tipped off a robot tray
 *    was measured to have.
 */

type Way = 'straight' | 'tipped';
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const DECK_TOP = 2.6;
const BELT_SPEED = 0.93;
/** The belts end this far from the middle of the cage (m). */
const BELT_END = 0.26;
const WATCH_S = 8;

interface Run {
  inside: number;
  aboveRim: number;
  onGround: number;
  /** Seconds after the last carton was let go until nothing moved any more (the run watches for WATCH_S). */
  restS: number;
  topOverRim: number;
  inFloor: number;
  inWall: number;
}

function belts(w: World): void {
  for (const side of [-1, 1]) {
    const id = block(w, side * (BELT_END + 0.6), DECK_TOP - 0.1, 0, 1.2, 0.2, 0.5, { belt: { axis: 'x', walls: false } });
    w.setBeltSpeed(id, -side * BELT_SPEED);
  }
}

async function pile(way: Way, size: Vec3, inside: number, count: number, everyS: number, seed: number): Promise<Run> {
  const w = await crateWorld();
  floor(w);
  const cage = buildCage(w, { ...CAGE, inside });
  if (way === 'tipped') belts(w);
  const rnd = seeded(seed);
  const ids: EntityId[] = [];
  const every = Math.round(everyS / TICK_DT);
  const lastDrop = (count - 1) * every;
  const ticks = lastDrop + Math.round(WATCH_S / TICK_DT);
  let watch = stillWatch(w, ids);
  let lastMove = 0;
  let inFloor = 0;
  let inWall = 0;
  for (let k = 0; k < ticks; k++) {
    if (k % every === 0 && ids.length < count) {
      const y = DECK_TOP + size.y / 2 + 0.002;
      // Faster than one a second, the two belts take turns, so that two cartons never start on top of each other.
      const pick = rnd() < 0.5 ? -1 : 1;
      const side = everyS < 1 ? (ids.length % 2 === 0 ? -1 : 1) : pick;
      const at = way === 'straight' ? { x: (rnd() - 0.5) * 0.3, y, z: (rnd() - 0.5) * 0.3 } : { x: side * (BELT_END + 0.45), y, z: (rnd() - 0.5) * 0.16 };
      ids.push(carton(w, at, { size, kg: MASSES[ids.length % MASSES.length]! }));
      watch = stillWatch(w, ids);
    }
    w.step(TICK_DT);
    if (!watch.tick()) lastMove = k;
    const r = readCage(w, cage, ids);
    inFloor = Math.max(inFloor, r.inFloor);
    inWall = Math.max(inWall, r.inWall);
  }
  const r = readCage(w, cage, ids);
  const onGround = ids.filter((id) => w.getEntity(id)!.position.y < CAGE.clearance).length;
  w.dispose?.();
  return { inside: r.inside, aboveRim: r.aboveRim, onGround, restS: (lastMove + 1 - lastDrop) * TICK_DT, topOverRim: r.topOverRim, inFloor, inWall };
}

interface Row {
  way: Way;
  carton: string;
  inside: number;
  count: number;
  everyS: number;
  runs: Run[];
}

const worst = (row: Row, pick: (r: Run) => number): number => Math.max(...row.runs.map(pick));
const allIn = (row: Row): number => row.runs.filter((r) => r.inside === row.count).length;
const belowRim = (row: Row): number => row.runs.filter((r) => r.topOverRim < 0).length;

function line(row: Row): string {
  const got = row.runs.reduce((a, r) => a + r.inside, 0);
  const above = row.runs.reduce((a, r) => a + r.aboveRim, 0);
  const ground = row.runs.reduce((a, r) => a + r.onGround, 0);
  const total = row.count * row.runs.length;
  return `| ${row.way} | ${row.carton} | ${row.inside} | ${row.count} | ${row.everyS} | ${allIn(row)}/${row.runs.length} | ${got}/${total} | ${above} | ${ground} | ${total - got - above - ground} | ${belowRim(row)}/${row.runs.length} | ${f3(CAGE.wall + worst(row, (r) => r.topOverRim))} | ${f3(worst(row, (r) => r.restS))} | ${f3(worst(row, (r) => r.inFloor) * 1000)} | ${f3(worst(row, (r) => r.inWall) * 1000)} |`;
}

const HEAD =
  '| way in | carton (m) | inside (m) | cartons | one every (s) | runs with all inside | cartons inside | on the pile above the rim | on the ground | elsewhere (a wall top, a belt) | runs with the pile below the rim | highest pile above the cage floor (m) | longest time to rest (s) | deepest in the floor plate (mm) | deepest in a wall (mm) |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|';

describe('cartons piling up in a cage of plain blocks (recorded run)', () => {
  it('prints the table and holds what every run showed', async () => {
    const rows: Row[] = [];
    const cartons: [string, Vec3][] = [['0.26 cube', CUBE], ['0.32 x 0.26 x 0.28', FACTORY_CARTON]];
    for (const way of ['straight', 'tipped'] as const) {
      for (const [name, size] of cartons) {
        for (const inside of [0.8, 0.9, 1.0]) {
          for (const count of [6, 8, 12]) {
            for (const everyS of count === 6 && way === 'tipped' ? [1, 0.3] : [1]) {
              const runs: Run[] = [];
              for (const seed of SEEDS) runs.push(await pile(way, size, inside, count, everyS, seed));
              rows.push({ way, carton: name, inside, count, everyS, runs });
            }
          }
        }
      }
    }
    console.log([HEAD, ...rows.map(line)].join('\n'));
    for (const row of rows) {
      const label = `${row.way}, ${row.carton}, inside ${row.inside}, ${row.count} cartons`;
      // No carton ever went through the floor plate or a wall (both 50 mm thick): the deepest corner stayed in the outer skin.
      expect(worst(row, (r) => r.inFloor), label).toBeLessThan(0.02);
      expect(worst(row, (r) => r.inWall), label).toBeLessThan(0.02);
      // Six cartons, one a second: everything lies still within 4 s of the last one.
      if (row.count === 6 && row.everyS === 1) expect(worst(row, (r) => r.restS), label).toBeLessThanOrEqual(4);
    }
    const find = (way: Way, carton: string, inside: number, count: number): Row => rows.find((r) => r.way === way && r.carton === carton && r.inside === inside && r.count === count && r.everyS === 1)!;
    // The 0.26 m cube: a 0.8 m cage held six of them in every run, both ways in, with the pile below the rim.
    for (const way of ['straight', 'tipped'] as const) {
      const row = find(way, '0.26 cube', 0.8, 6);
      expect(allIn(row)).toBe(SEEDS.length);
      expect(belowRim(row)).toBe(SEEDS.length);
    }
    // The carton the stations make is bigger: tipped in, a 1.0 m cage held six and eight of them in every run, below the rim.
    for (const count of [6, 8]) {
      const row = find('tipped', '0.32 x 0.26 x 0.28', 1.0, count);
      expect(allIn(row)).toBe(SEEDS.length);
      expect(belowRim(row)).toBe(SEEDS.length);
    }
  });
});
