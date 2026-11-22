import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { STATIONS, TUNED_DRIVE, buildFloor, line, runFloor, type Stress } from '../helpers/grid-floor';
import { say } from './traffic-log';

/**
 * Trouble on the floor: a robot that stays on a lane cell beside a hole for 30 s, and a station that hands over nothing
 * for 60 s. 6 robots, 600 s, cell 1.4 m, trouble from 200 s. The floor must come back to its usual rate, with nobody
 * touching and without a standstill of everybody.
 */
let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const CASES: [string, Stress, number][] = [
  ['no trouble', {}, 200],
  ['robot 2 stays 30 s beside a hole', { freeze: { robot: 1, from: 200, seconds: 30 } }, 260],
  ['station A silent 60 s', { outage: { station: STATIONS[0], from: 200, to: 260 } }, 260],
  ['station B silent 60 s', { outage: { station: STATIONS[1], from: 200, to: 260 } }, 260],
  ['station A silent 60 s and robot 2 stays 30 s', { outage: { station: STATIONS[0], from: 200, to: 260 }, freeze: { robot: 1, from: 200, seconds: 30 } }, 260],
];

describe('one-way grid floor under trouble, 6 robots, 600 s', () => {
  it.each(CASES)('%s: the floor recovers', (name, stress, to) => {
    const marks = { before: 0, during: 0, after: 0 };
    const f = buildFloor({ robots: 6, pitch: 1.4, seed: 20261122, drive: TUNED_DRIVE, stress: structuredClone(stress) }, rapier);
    const delivered = (): number => f.ids.reduce((sum, id) => sum + Number(f.run.out(`${id}-jobs`, 'delivered')), 0);
    const x = runFloor(f, 600, (t) => {
      if (Math.abs(t - 200) < 1e-6) marks.before = delivered();
      if (Math.abs(t - (to + 40)) < 1e-6) marks.during = delivered();
      if (Math.abs(t - 600) < 1e-6) marks.after = delivered();
    });
    const before = marks.before / (200 / 60);
    const during = (marks.during - marks.before) / ((to + 40 - 200) / 60);
    const after = (marks.after - marks.during) / ((600 - to - 40) / 60);
    say(line(`STRESS [${name}]`, x));
    say(`   per minute: before ${before.toFixed(1)}, from the start of the trouble to 40 s after it ${during.toFixed(1)}, afterwards ${after.toFixed(1)}`);
    expect(x.minGap).toBeGreaterThan(0.3);
    expect(x.middleInHoleTicks).toBe(0);
    expect(x.sharedCellTicks).toBe(0);
    expect(x.deadlocks).toEqual([]);
    expect(x.stuckAtEnd).toBe(false);
    expect(after).toBeGreaterThanOrEqual(before * 0.9);
  });
});
