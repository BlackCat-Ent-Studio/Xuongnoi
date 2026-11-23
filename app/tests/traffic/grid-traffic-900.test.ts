import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { TUNED_DRIVE, buildFloor, line, runFloor, type FloorResult } from '../helpers/grid-floor';
import { say } from './traffic-log';

/**
 * The main table: 2 / 4 / 6 / 8 robots for 900 simulated seconds on the 7 x 7 one-way floor (cell 1.4 m, holes as no-go
 * cells), "Vật lý thật" on. Every robot is a copy of ONE circuit of real pieces, wired to one "Bảng giữ ô" card; a
 * test-only card plays the stations and the tipping stops. Measured on every tick from the entity views.
 */
let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const SEED = 20261122;
/** Deliveries per minute the measuring prototype reached with the same drive, floor and seed (early asking, no detour). */
const MEASURED: Record<number, number> = { 2: 5.0, 4: 9.53, 6: 12.53, 8: 13.53 };
const seen = new Map<number, FloorResult>();
const floor = (robots: number, seed = SEED): FloorResult => runFloor(buildFloor({ robots, pitch: 1.4, seed, drive: TUNED_DRIVE }, rapier), 900);

describe('one-way grid floor, 900 s', () => {
  it.each([2, 4, 6, 8])('%s robots: no standstill of the whole floor, nobody near anybody, nobody off the lane', { timeout: 900_000 }, (robots) => {
    const x = floor(robots);
    seen.set(robots, x);
    say(line(`RUN900 x${robots}`, x));
    expect(x.deadlocks).toEqual([]);
    expect(x.minGap).toBeGreaterThan(0.3);
    expect(x.sharedCellTicks).toBe(0);
    expect(x.middleInHoleTicks).toBe(0);
    expect(x.cornerOverHoleTicks).toBe(0);
    expect(x.maxOffLane).toBeLessThan(0.1);
    expect(x.stops).toBeGreaterThan(robots * 10);
    expect(x.stopErrorMax).toBeLessThanOrEqual(0.03);
    expect(Math.abs(x.perMinute - MEASURED[robots]!) / MEASURED[robots]!).toBeLessThanOrEqual(0.1);
    // Nobody is passed over for good: every robot keeps delivering.
    expect(Math.min(...x.perRobot)).toBeGreaterThan(x.delivered / robots / 2);
  });

  it('the same seed twice gives the same state on every tick of 900 s; another seed does not', { timeout: 1_800_000 }, () => {
    const a = seen.get(6) ?? floor(6);
    const b = floor(6);
    const c = floor(6, SEED + 1);
    say(`DETERMINISM x6: ${a.hash.toString(16)} / ${b.hash.toString(16)}; other seed ${c.hash.toString(16)}; delivered ${a.delivered} / ${b.delivered} / ${c.delivered}`);
    say(line(`SEED900 x6 seed ${SEED + 1}`, c));
    expect(b.hash).toBe(a.hash);
    expect(b.delivered).toBe(a.delivered);
    expect(c.hash).not.toBe(a.hash);
    expect(c.deadlocks).toEqual([]);
    expect(c.minGap).toBeGreaterThan(0.3);
  });
});
