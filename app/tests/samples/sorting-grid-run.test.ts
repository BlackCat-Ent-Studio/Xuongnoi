import { beforeAll, describe, expect, it } from 'vitest';
import { registerAllNodes } from '../../src/nodes';
import { CARTON, GRID } from '../../src/samples/sorting-grid-plan';
import { loadRapier } from '../../src/world/rapier-loader';
import { say } from '../traffic/traffic-log';
import { ROBOTS, ROUTE_CODES, gridLine, runGrid, shippedGrid, type GridResult } from '../helpers/grid-sample-run';

/**
 * The grid-floor sorting sample played as it ships, "Vật lý thật" on, for 300 simulated seconds. Nothing is added to the
 * board and nothing is taken away; every number is measured from the entity views and the outputs of the board's cards.
 * Run with --silent=false to read the result lines. VITE_GRID_900=1 adds a 900 s run that is reported, not asserted.
 */

beforeAll(async () => {
  registerAllNodes();
  await loadRapier();
});

const sum = (list: readonly number[]): number => list.reduce((a, b) => a + b, 0);
let reference: GridResult | undefined;
const run300 = (): GridResult => (reference ??= runGrid(shippedGrid(), 300));

describe('the grid-floor sorting sample, 300 s', () => {
  it('every carton that leaves a tray ends in the catch box of its own route; none stays on the deck floor or lands outside a box', { timeout: 1_200_000 }, () => {
    const x = run300();
    say(gridLine('GRID300', x));
    // Sorted: a real number of cartons, each in the box of its route.
    expect(x.sortedRight).toBeGreaterThanOrEqual(40);
    expect(x.sortedWrong).toBe(0);
    expect(x.onDeck).toEqual([]);
    expect(x.onGround).toEqual([]);
    // "Thu hồi" only ever took a carton out of a catch box.
    expect(x.goneElsewhere).toBe(0);
    expect(x.goneRight).toBeGreaterThanOrEqual(x.sortedRight - GRID.routes);
    // Nothing is lost: every carton made is in a box, was taken back from one, or is still on a table or a tray.
    expect(x.made).toBe(x.goneRight + x.goneWrong + x.alive);
    expect(x.maxAlive).toBeLessThanOrEqual(2 * CARTON.maxAlive);
    expect(x.maxAlive).toBeLessThanOrEqual(40);
  });

  it('the counters of the nine catch boxes and the read-outs on the screen say what was measured', { timeout: 1_200_000 }, () => {
    const x = run300();
    expect(x.counts.slice(1)).toEqual(x.truth.slice(1));
    expect(x.wrongs.slice(1)).toEqual(ROUTE_CODES.map(() => 0));
    expect(x.shownTotal).toBe(sum(x.truth));
    expect(x.shownTotal).toBe(x.sortedRight);
    expect(x.shownWrong).toBe(0);
    expect(x.shownOnDeck).toBe(0);
    // Random codes 1..9: in 300 s every route gets cartons.
    for (const k of ROUTE_CODES) expect(x.truth[k], `route ${k}`).toBeGreaterThan(0);
    // Each tip of a tray put one carton into a box; each load of a station put one carton on a tray.
    expect(sum(x.tips)).toBeGreaterThanOrEqual(x.sortedRight);
    expect(sum(x.tips)).toBeLessThanOrEqual(x.sortedRight + GRID.robots);
    expect(sum(x.loads)).toBeGreaterThanOrEqual(sum(x.tips));
    expect(sum(x.loads)).toBeLessThanOrEqual(sum(x.tips) + GRID.robots);
  });

  it('the robots: nobody on a hole, nobody fallen, nobody near anybody, the floor never stands still, every robot and both stations work', { timeout: 1_200_000 }, () => {
    const x = run300();
    expect(x.fallen).toEqual([]);
    expect(x.holeTicks).toBe(0);
    expect(x.deadlocks).toEqual([]);
    expect(x.stuckAtEnd).toBe(false);
    expect(x.minGap).toBeGreaterThan(0.3);
    expect(x.moved).toEqual(ROBOTS);
    // Nobody is passed over for good: every robot keeps tipping, both stations keep loading.
    for (const k of ROBOTS) expect(x.tips[k], `robot ${k}`).toBeGreaterThan(sum(x.tips) / GRID.robots / 2);
    for (const s of [1, 2]) expect(x.loads[s], `station ${s}`).toBeGreaterThan(sum(x.loads) / 6);
    expect(x.longestStandstill).toBeLessThan(60);
  });

  it('the same board twice gives the same state on every tick', { timeout: 1_200_000 }, () => {
    const a = run300();
    const b = runGrid(shippedGrid(), 300);
    say(`GRID300 twice: hash ${a.hash.toString(16)} / ${b.hash.toString(16)}, sorted ${a.sortedRight} / ${b.sortedRight}`);
    expect(b.hash).toBe(a.hash);
    expect(b.counts).toEqual(a.counts);
    expect(b.made).toBe(a.made);
  });

  it.runIf((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GRID_900)('900 s, reported only', { timeout: 3_600_000 }, () => {
    say(gridLine('GRID900', runGrid(shippedGrid(), 900)));
  });
});
