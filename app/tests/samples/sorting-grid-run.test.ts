import { beforeAll, describe, expect, it } from 'vitest';
import { registerAllNodes } from '../../src/nodes';
import { cageLabel } from '../../src/samples/sorting-grid-floor';
import { CAGE, CARTON, GRID, LOCK_WAIT_S, ROBOT } from '../../src/samples/sorting-grid-plan';
import { loadRapier } from '../../src/world/rapier-loader';
import { say } from '../traffic/traffic-log';
import { onlyRoute } from '../helpers/grid-sample-cuts';
import { ROBOTS, ROUTE_CODES, envFlag, gridLine, runGrid, shippedGrid, type GridResult } from '../helpers/grid-sample-run';

/**
 * The grid-floor sorting sample played as it ships, "Vật lý thật" on, for 300 simulated seconds. Nothing is added to the
 * board and nothing is taken away; every number is measured from the entity views and the outputs of the board's cards.
 * The only hand on the board is the script's finger on the button "Đổi lồng": one press whenever a hole has been locked
 * for PRESS_AFTER_S seconds. A second run never presses. Run with --silent=false to read the result lines. GRID_900=1
 * adds 900 s runs that are reported, not asserted.
 */

beforeAll(async () => {
  registerAllNodes();
  await loadRapier();
});

/** Seconds a hole stays locked before the script presses "Đổi lồng". */
const PRESS_AFTER_S = 45;

const sum = (list: readonly number[]): number => list.reduce((a, b) => a + b, 0);
let reference: GridResult | undefined;
const run300 = (): GridResult => (reference ??= runGrid(shippedGrid(), 300, { pressAfterLockedS: PRESS_AFTER_S }));
let unpressed: GridResult | undefined;
const runNoPress = (): GridResult => (unpressed ??= runGrid(shippedGrid(), 300));

/**
 * What holds on every tick of every run, pressed or not. `longLaps` is for runs in which robots drive lap after lap with
 * the same carton: a carton creeps a few centimetres on the flat tray at every stop and start, and after many laps one can
 * leave the tray (measured: 1 in 300 s). Those runs do not assert "none on the floor"; they print what happened.
 */
function expectNothingSpills(x: GridResult, longLaps = false): void {
  expect(x.sortedWrong).toBe(0);
  if (!longLaps) {
    expect(x.onDeck).toEqual([]);
    expect(x.onGround).toEqual([]);
    expect(x.carriedSlip).toBeLessThan(0.2);
  }
  // Every carton that fell through hole k came to lie in cage k, and none stayed between the deck and a cage.
  expect(x.strayed).toEqual([]);
  expect(x.hung).toEqual([]);
  // No tray was told to tip while the hole of its carton was locked, and no carton ever lay on a cover.
  expect(x.tipsWhileLocked).toBe(0);
  expect(x.onCover).toEqual([]);
  // A cage never holds more than its capacity: the sixth carton locks the hole.
  expect(x.mostInCage).toBeLessThanOrEqual(CAGE.capacity);
  // Nothing is lost, on any tick: every carton made is on the deck level, falling, in a cage, or was taken back.
  expect(x.lostTicks).toBe(0);
  expect(x.made).toBe(x.goneRight + x.goneWrong + x.goneElsewhere + x.alive);
  // "Thu hồi" only ever took a carton out of a cage.
  expect(x.goneElsewhere).toBe(0);
  // On every tick each lamp shows the colour for its cage's number, the two plates of each hole follow its lock, and a
  // cage's number is what lay in it; a lock opens only over an empty cage.
  expect(x.lampWrongTicks).toBe(0);
  expect(x.coverWrongTicks).toBe(0);
  expect(x.countWrongTicks).toBe(0);
  expect(x.lockDropsFull).toBe(0);
  expect(x.waitTicksOpen).toBe(0);
  expect(x.cageSays.slice(1)).toEqual(x.inCage.slice(1));
  // The robots: nobody on a hole, nobody fallen, nobody near anybody, nobody inside a plate, a post, a belt or a cover.
  expect(x.fallen).toEqual([]);
  expect(x.holeTicks).toBe(0);
  expect(x.overHoleTicks).toBe(0);
  expect(x.lowest).toBeGreaterThan(GRID.top + ROBOT.height / 2 - 0.005);
  expect(x.deepestInSolid).toBeLessThan(0.001);
  expect(x.minGap).toBeGreaterThan(0.3);
  expect(x.deadlocks).toEqual([]);
  expect(x.stuckAtEnd).toBe(false);
  expect(x.maxAlive).toBeLessThanOrEqual(GRID.routes * CAGE.capacity + GRID.robots + 2);
  expect(x.maxAlive).toBeLessThanOrEqual(CARTON.maxAlive);
}

describe('the grid-floor sorting sample, 300 s, "Đổi lồng" pressed 45 s after a hole locks', () => {
  it('every carton that leaves a tray ends in the cage of its own route; none stays on the deck floor, lands outside a cage or on a cover', { timeout: 1_200_000 }, () => {
    const x = run300();
    say(gridLine('GRID300', x));
    // Sorted: a real number of cartons, each in the cage of its route (measured 56 = 11.2 a minute; the margin is for
    // changes of the general physics rules, not for a floor that stands still).
    expect(x.sortedRight).toBeGreaterThanOrEqual(40);
    expectNothingSpills(x);
    // A hole did fill and lock, the script pressed, and the swap emptied the cages in a few seconds.
    expect(sum(x.locks)).toBeGreaterThanOrEqual(1);
    expect(x.presses.length).toBeGreaterThanOrEqual(1);
    expect(x.goneRight).toBeGreaterThanOrEqual(CAGE.capacity);
    expect(x.swapSecondsMax).toBeLessThan(10);
    expect(x.swapUnfinished).toBe(false);
    expect(x.lockedEmptyTicks).toBeLessThanOrEqual(sum(x.locks));
  });

  it('the counters of the nine holes and the read-outs on the screen say what was measured', { timeout: 1_200_000 }, () => {
    const x = run300();
    expect(x.counts.slice(1)).toEqual(x.truth.slice(1));
    expect(x.wrongs.slice(1)).toEqual(ROUTE_CODES.map(() => 0));
    expect(x.shownTotal).toBe(sum(x.truth));
    expect(x.shownTotal).toBe(x.sortedRight);
    expect(x.shownWrong).toBe(0);
    expect(x.shownOnDeck).toBe(0);
    // The numbers on the screen itself (the "Hiện số" cards), not only the wires that feed them.
    expect(x.hud['Tổng kiện đã phân loại']).toBe(x.sortedRight);
    expect(x.hud['Kiện vào sai ô']).toBe(0);
    expect(x.hud['Kiện nằm lại trên mặt sàn']).toBe(0);
    for (const k of ROUTE_CODES) expect(x.hud[cageLabel(k)], `screen, cage ${k}`).toBe(x.inCage[k]);
    expect(x.cameraHeld).toBe(true);
    // Random codes 1..9: in 300 s every route gets cartons.
    for (const k of ROUTE_CODES) expect(x.truth[k], `route ${k}`).toBeGreaterThan(0);
    // Each tip of a tray put one carton into a cage; each load of a station put one carton on a tray.
    expect(sum(x.tips)).toBeGreaterThanOrEqual(x.sortedRight);
    expect(sum(x.tips)).toBeLessThanOrEqual(x.sortedRight + GRID.robots);
    expect(sum(x.loads)).toBeGreaterThanOrEqual(sum(x.tips));
    expect(sum(x.loads)).toBeLessThanOrEqual(sum(x.tips) + GRID.robots);
    // A carton stays near the middle of its tray all the way: the tray reaches 370 mm from its middle to its end (measured 84 mm).
    expect(x.handOvers).toBeGreaterThanOrEqual(x.sortedRight);
    expect(x.carriedSlip).toBeLessThan(0.2);
  });

  it('the robots: the floor never stands still, every robot and both stations work', { timeout: 1_200_000 }, () => {
    const x = run300();
    expect(x.moved).toEqual(ROBOTS);
    // Nobody is passed over for good: every robot keeps tipping, both stations keep loading.
    for (const k of ROBOTS) expect(x.tips[k], `robot ${k}`).toBeGreaterThan(sum(x.tips) / GRID.robots / 2);
    for (const s of [1, 2]) expect(x.loads[s], `station ${s}`).toBeGreaterThan(sum(x.loads) / 6);
    expect(x.longestStandstill).toBeLessThan(60);
  });

  it('the same board twice gives the same state on every tick', { timeout: 1_200_000 }, () => {
    const a = run300();
    const b = runGrid(shippedGrid(), 300, { pressAfterLockedS: PRESS_AFTER_S });
    say(`GRID300 twice: hash ${a.hash.toString(16)} / ${b.hash.toString(16)}, sorted ${a.sortedRight} / ${b.sortedRight}`);
    expect(b.hash).toBe(a.hash);
    expect(b.counts).toEqual(a.counts);
    expect(b.made).toBe(a.made);
    expect(b.presses).toEqual(a.presses);
  });

  it.runIf(envFlag('GRID_900'))('900 s, reported only', { timeout: 3_600_000 }, () => {
    say(gridLine('GRID900', runGrid(shippedGrid(), 900, { pressAfterLockedS: PRESS_AFTER_S })));
    say(gridLine('GRID900 never pressed', runGrid(shippedGrid(), 900)));
  });
});

describe('the grid-floor sorting sample, 300 s, "Đổi lồng" never pressed', () => {
  it('holes fill and stay locked; nothing spills, nothing is tipped onto a cover, the floor does not stand still', { timeout: 1_200_000 }, () => {
    const x = runNoPress();
    say(gridLine('GRID300 never pressed', x));
    expectNothingSpills(x, true);
    expect(x.presses).toEqual([]);
    expect(x.goneRight + x.goneWrong).toBe(0);
    // A hole that locked is still locked at the end, and its cage is full.
    expect(sum(x.locks)).toBeGreaterThanOrEqual(1);
    for (const k of ROUTE_CODES) {
      expect(x.locks[k], `hole ${k}`).toBeLessThanOrEqual(1);
      if (x.locks[k] === 1) {
        expect(x.lockedAtEnd[k], `hole ${k}`).toBeGreaterThan(0);
        expect(x.inCage[k], `cage ${k}`).toBe(CAGE.capacity);
      }
    }
    expect(x.lockedEmptyTicks).toBe(0);
    // No robot waits for good: after its 4 s it drives on (a wait is longer only while the next cell is taken).
    expect(x.waitSecondsMax).toBeGreaterThan(LOCK_WAIT_S - 0.1);
    expect(x.waitSecondsMax).toBeLessThan(20);
    // Every carton that reached a cage is still in it.
    expect(sum(x.inCage)).toBe(x.sortedRight);
  });
});

describe('the grid-floor sorting sample fed with route 1 only, 150 s: one cage fills', () => {
  it('never pressed: the hole locks at six, every robot ends up waiting 4 s and taking laps, nothing lands on the cover', { timeout: 1_200_000 }, () => {
    const x = runGrid(onlyRoute(1), 150);
    say(gridLine('ROUTE 1 never pressed', x));
    expectNothingSpills(x, true);
    expect(x.locks.slice(1)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(x.inCage[1]).toBe(CAGE.capacity);
    expect(x.sortedRight).toBe(CAGE.capacity);
    // Six robots carry a carton for the locked hole and both tables hold one: the stations have stopped making cartons.
    expect(x.heldUpAtEnd.length).toBeGreaterThanOrEqual(GRID.robots - 1);
    expect(x.alive).toBeGreaterThanOrEqual(CAGE.capacity + GRID.robots + 1);
    // Each wait is the 4 s of the timer, and each robot has been round at least once.
    expect(x.waits).toBeGreaterThanOrEqual(GRID.robots);
    expect(x.waitSecondsMax).toBeGreaterThan(LOCK_WAIT_S - 0.1);
    for (const k of ROBOTS) expect(x.laps[k], `robot ${k}`).toBeGreaterThanOrEqual(1);
    expect(x.longestStandstill).toBeLessThan(60);
  });

  it('pressed 30 s after the lock: the cage is emptied, the hole opens, the waiting robots tip, and the cage fills again', { timeout: 1_200_000 }, () => {
    const x = runGrid(onlyRoute(1), 150, { pressAfterLockedS: 30 });
    say(gridLine('ROUTE 1 pressed', x));
    expectNothingSpills(x);
    expect(x.presses.length).toBeGreaterThanOrEqual(1);
    expect(x.locks[1]).toBeGreaterThanOrEqual(2);
    expect(x.goneRight).toBeGreaterThanOrEqual(CAGE.capacity);
    expect(x.sortedRight).toBeGreaterThanOrEqual(2 * CAGE.capacity);
    expect(x.swapUnfinished).toBe(false);
    expect(sum(x.laps)).toBeGreaterThanOrEqual(1);
  });
});
