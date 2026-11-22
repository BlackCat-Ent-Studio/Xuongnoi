import { appendFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import type { Stress } from './experimental-nodes';
import { STATIONS, buildFloor, line, runFloor, type Approach } from './grid-rig';

/**
 * Measuring spike: a robot that stays on a lane cell beside a hole for 30 s, and a station that hands over nothing for
 * 60 s. 6 robots, 600 s, cell 1.4 m. Does the floor come back to its usual rate without a standstill of everybody?
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

const DRIVE = { power: 0.8, slowDistance: 0.6 };
const CASES: [string, Stress, number, number][] = [
  ['no stress', {}, 200, 200],
  ['robot 2 stays 30 s beside a hole', { freeze: { robot: 1, from: 200, seconds: 30 } }, 200, 260],
  ['robot 5 stays 30 s beside a hole', { freeze: { robot: 4, from: 200, seconds: 30 } }, 200, 260],
  ['station A silent 60 s', { outage: { station: STATIONS[0], from: 200, to: 260 } }, 200, 260],
  ['station B silent 60 s', { outage: { station: STATIONS[1], from: 200, to: 260 } }, 200, 260],
  ['both: station A silent 60 s and robot 2 stays 30 s', { outage: { station: STATIONS[0], from: 200, to: 260 }, freeze: { robot: 1, from: 200, seconds: 30 } }, 200, 260],
];

const ROWS: [Approach, number, number][] = process.env.SPIKE_STRESS === 'step' ? [['hold-flow', 1, 1], ['hold-flow', 3, 1]] : [['hold-flow', 0, 0], ['hold-flow', 1, 0], ['eyes-turn', 0, 0]];

describe.each(ROWS)('%s, detour after %s s, detour rule %s', (approach, detourAfter, detourRule) => {
  it.each(CASES)('%s', (name, stress, from, to) => {
    const marks = { before: 0, during: 0, after: 0 };
    const f = buildFloor({ robots: 6, pitch: 1.4, approach, seed: 20261122, drive: approach === 'eyes-turn' ? {} : DRIVE, detourAfter, detourRule, stress: structuredClone(stress) }, rapier);
    const delivered = (): number => f.ids.reduce((sum, id) => sum + Number(f.rig.out(`${id}-jobs`, 'delivered')), 0);
    const x = runFloor(f, 600, (t) => {
      if (Math.abs(t - from) < 1e-6) marks.before = delivered();
      if (Math.abs(t - (to + 40)) < 1e-6) marks.during = delivered();
      if (Math.abs(t - 600) < 1e-6) marks.after = delivered();
    });
    const rate = (count: number, seconds: number): string => (count / (seconds / 60)).toFixed(1);
    say(line(`STRESS ${approach} detour ${detourAfter}${detourRule ? ' rule next-cell' : ''} [${name}]`, x));
    say(`   per minute: before ${rate(marks.before, from)}, from the start of the trouble to 40 s after it ${rate(marks.during - marks.before, to + 40 - from)}, afterwards ${rate(marks.after - marks.during, 600 - to - 40)}`);
    if (approach !== 'eyes-turn') {
      expect(x.minGap).toBeGreaterThan(0);
      expect(x.stuckAtEnd).toBe(false);
    }
  });
});
