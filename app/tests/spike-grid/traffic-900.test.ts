import { appendFileSync } from 'node:fs';
import os from 'node:os';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ParamValue } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { buildFloor, line, runFloor, type Approach } from './grid-rig';

/**
 * Measuring spike, the main table: 2 / 4 / 6 / 8 robots for 900 simulated seconds on the 7 x 7 one-way floor, cell 1.4 m,
 * "Vật lý thật" on. SPIKE_APPROACH picks one robot circuit so the runs can be timed one at a time.
 */
let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const LOG = process.env.SPIKE_LOG ?? 'tests/spike-grid/spike-log.txt';
const say = (text: string): void => {
  console.log(text);
  appendFileSync(LOG, `${text}\n`);
};

export const TUNED: Record<string, ParamValue> = { power: 0.8, slowDistance: 0.6 };
const SEED = 20261122;
const only = process.env.SPIKE_APPROACH;
const ROWS: [Approach, string, Record<string, ParamValue>][] = [
  ['hold-flow', 'tuned', TUNED],
  ['hold', 'tuned', TUNED],
  ['hold-flow', 'default', {}],
  ['eyes-turn', 'default', {}],
];

describe.each(ROWS.filter(([a, d]) => !only || only === `${a}:${d}`))('%s, drive %s, 900 s', (approach, driveName, drive) => {
  it.each([2, 4, 6, 8])('%s robots', (robots) => {
    const x = runFloor(buildFloor({ robots, pitch: 1.4, approach, seed: SEED, drive }, rapier), 900);
    say(line(`RUN900 ${approach} ${driveName} x${robots} (cpus ${os.cpus().length}, free mem ${(os.freemem() / 2 ** 30).toFixed(1)} GB)`, x));
    if (approach !== 'eyes-turn') {
      expect(x.minGap).toBeGreaterThan(0);
      expect(x.middleInHoleTicks).toBe(0);
    }
  });
});

describe.runIf(!only || only === 'seeds')('other seeds, 6 robots, hold-flow tuned, 900 s', () => {
  it.each([1, 2, 3, 4])('seed %s', (seed) => {
    const x = runFloor(buildFloor({ robots: 6, pitch: 1.4, approach: 'hold-flow', seed, drive: TUNED }, rapier), 900);
    say(line(`SEED900 hold-flow tuned x6 seed ${seed}`, x));
    expect(x.minGap).toBeGreaterThan(0);
    expect(x.deadlocks).toEqual([]);
  });
});

describe.runIf(only === 'seeds8')('other seeds, 8 robots (one more than a ring of 8 cells can never hold), hold-flow tuned, 900 s', () => {
  it.each([1, 2, 3, 4])('seed %s', (seed) => {
    const x = runFloor(buildFloor({ robots: 8, pitch: 1.4, approach: 'hold-flow', seed, drive: TUNED }, rapier), 900);
    say(line(`SEED900 hold-flow tuned x8 seed ${seed}`, x));
    expect(x.minGap).toBeGreaterThan(0);
  });
});

describe.runIf(!only || only === 'determinism')('determinism', () => {
  it.each([['hold-flow', 6], ['hold-flow', 8], ['eyes-turn', 4]] as [Approach, number][])('%s with %s robots: the same seed twice gives the same state on every tick of 900 s', (approach, robots) => {
    const a = runFloor(buildFloor({ robots, pitch: 1.4, approach, seed: SEED, drive: TUNED }, rapier), 900);
    const b = runFloor(buildFloor({ robots, pitch: 1.4, approach, seed: SEED, drive: TUNED }, rapier), 900);
    const c = runFloor(buildFloor({ robots, pitch: 1.4, approach, seed: SEED + 1, drive: TUNED }, rapier), 900);
    say(`DETERMINISM ${approach} x${robots}: ${a.hash.toString(16)} / ${b.hash.toString(16)}; other seed ${c.hash.toString(16)}; delivered ${a.delivered} / ${b.delivered} / ${c.delivered}`);
    expect(a.hash).toBe(b.hash);
    expect(c.hash).not.toBe(a.hash);
  });
});
