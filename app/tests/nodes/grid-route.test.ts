import { describe, expect, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { listMarkers } from '../../src/nodes/floor-marker';
import { detourOnLanes, laneGraph, routeOnLanes, type LaneGraph } from '../../src/nodes/grid-lanes';
import { LAYOUT_A, cellNumber, cellOf, flatBoard, isLane, laneMarkers, node, play } from '../helpers/grid-floor';

/**
 * "Tìm đường trên lưới" reads one-way lanes off the arrows painted on floor markers. First the lanes of the 7 x 7 floor
 * with holes on (odd row, odd column): the facts the no-lock argument rests on. Then the card itself.
 */

const G = LAYOUT_A;
const P = 1.4;
const n = (r: number, c: number): number => cellNumber(G, r, c);

function lanesOf(nodes = laneMarkers(G, P)): LaneGraph {
  const run = play(flatBoard(nodes));
  run.tick();
  return laneGraph(listMarkers(run.world));
}

describe('lanes read off the arrows of the 7 x 7 floor', () => {
  const lanes = lanesOf();
  const cells = [...lanes.keys()].sort((a, b) => a - b);

  it('has the 40 lane cells; an arrow leads to the neighbour it points at, and an arrow that points off the floor leads nowhere', () => {
    expect(cells).toHaveLength(40);
    for (const a of cells) {
      const [r, c] = cellOf(G, a);
      const want: number[] = [];
      if (r % 2 === 0) {
        const k = c + ((r / 2) % 2 === 0 ? 1 : -1);
        if (isLane(G, r, k)) want.push(n(r, k));
      }
      if (c % 2 === 0) {
        const k = r + ((c / 2) % 2 === 1 ? 1 : -1);
        if (isLane(G, k, c)) want.push(n(k, c));
      }
      expect(lanes.get(a), `cell ${a}`).toEqual(want);
    }
    expect(cells.filter((c) => lanes.get(c)!.length === 2)).toHaveLength(8);
    expect(cells.filter((c) => lanes.get(c)!.length === 0)).toHaveLength(0);
  });

  it('no two cells point at each other, so two robots can never want each other\'s cell (no head-on)', () => {
    for (const a of cells) for (const b of lanes.get(a)!) expect(lanes.get(b), `${a} <-> ${b}`).not.toContain(a);
  });

  it('every lane cell reaches every other one, each step along an arrow', () => {
    for (const a of cells) {
      for (const b of cells) {
        if (a === b) continue;
        const path = routeOnLanes(lanes, a, b);
        expect(path.length, `${a} -> ${b}`).toBeGreaterThan(0);
        expect(path.at(-1)).toBe(b);
        let at = a;
        for (const step of path) {
          expect(lanes.get(at)).toContain(step);
          at = step;
        }
      }
    }
  });

  it('the shortest closed loop has 8 cells and there are 5 of them: fewer than 8 robots cannot fill one', () => {
    let shortest = Infinity;
    const rings = new Set<string>();
    for (const a of cells) {
      for (const b of lanes.get(a)!) {
        const back = routeOnLanes(lanes, b, a);
        if (back.length === 0) continue;
        const loop = [a, b, ...back.slice(0, -1)];
        if (loop.length < shortest) {
          shortest = loop.length;
          rings.clear();
        }
        if (loop.length === shortest) rings.add([...loop].sort((x, y) => x - y).join(','));
      }
    }
    expect(shortest).toBe(8);
    expect(rings.size).toBe(5);
  });

  it('the other way round a crossing: the detour starts with the other exit and still ends at the goal; a cell with one exit has none', () => {
    for (const a of cells) {
      for (const b of cells) {
        if (a === b) continue;
        const usual = routeOnLanes(lanes, a, b);
        const other = detourOnLanes(lanes, a, b);
        if (lanes.get(a)!.length < 2) expect(other).toEqual([]);
        else {
          expect(other[0]).not.toBe(usual[0]);
          expect(other.at(-1)).toBe(b);
          expect(other.length).toBeGreaterThanOrEqual(usual.length);
        }
      }
    }
  });
});

describe('lanes of any marker layout', () => {
  const m = (number: number, x: number, z: number, exits: string, extra: Record<string, number> = {}) => node(`m${number}`, 'floor-marker', { number, position: { x, y: extra.y ?? 0, z }, size: extra.size ?? 1, exits });

  it('an arrow leads to the nearest marker ahead within the width of the tile, also across a gap; markers without arrows are dead ends', () => {
    // 1 -> (gap) -> 2 -> 3; marker 9 lies ahead of 1 but off to the side; marker 4 has no arrow.
    const lanes = lanesOf([m(1, 0, 0, 'E'), m(2, 3, 0, 'E'), m(3, 4, 0, 'S'), m(4, 4, 5, 'none'), m(9, 2, 0.8, 'W')]);
    expect(lanes.get(1)).toEqual([2]);
    expect(lanes.get(2)).toEqual([3]);
    expect(lanes.get(3)).toEqual([4]);
    expect(lanes.get(4)).toEqual([]);
    expect(lanes.get(9)).toEqual([]);
    expect(routeOnLanes(lanes, 1, 4)).toEqual([2, 3, 4]);
    expect(routeOnLanes(lanes, 4, 1)).toEqual([]);
    expect(routeOnLanes(lanes, 1, 1)).toEqual([]);
    expect(routeOnLanes(lanes, 1, 77)).toEqual([]);
  });

  it('arrows never lead to another floor, and of two markers with one number the first made counts', () => {
    const lanes = lanesOf([m(1, 0, 0, 'E'), m(2, 1, 0, 'E', { y: 2.6 }), m(3, 2, 0, 'none'), node('m3b', 'floor-marker', { number: 3, position: { x: 1, y: 0, z: 0 }, exits: 'none' })]);
    // Sorted by id the cards are m1, m2, m3, m3b: the nearer tile 3 was made later, so the arrow of 1 skips it.
    expect(lanes.get(1)).toEqual([3]);
    expect(lanes.get(2)).toEqual([]);
  });
});

describe('Tìm đường trên lưới', () => {
  function card(detourAfter = 3) {
    const run = play(flatBoard([...laneMarkers(G, P), node('at', 'const', { value: n(0, 1) }), node('goal', 'const', { value: n(0, 5) }), node('held', 'const', { value: 0 }), node('is', 'compare', { op: 'gt' }), node('zero', 'const', { value: 0 }), node('route', 'grid-route', { detourAfter })], ['at.value>route.at', 'goal.value>route.goal', 'held.value>is.a', 'zero.value>is.b', 'is.out>route.avoid']));
    const read = (): [number, boolean, number] => [run.out('route', 'next') as number, run.out('route', 'hasNext') as boolean, run.out('route', 'steps') as number];
    const set = (id: string, value: number): void => {
      expect(run.rt.applyNodeParams(id, { value })).toBe(true);
    };
    return { run, read, set };
  }

  it('names the next cell of the shortest way, how many cells are left, and stays put at the goal', () => {
    const { run, read, set } = card();
    run.tick();
    expect(read()).toEqual([n(0, 2), true, 4]);
    set('at', n(0, 4));
    run.tick();
    expect(read()).toEqual([n(0, 5), true, 1]);
    set('at', n(0, 5));
    run.tick();
    expect(read()).toEqual([n(0, 5), false, 0]);
    // Against the arrow of row 0 the way goes round a hole.
    set('goal', n(0, 4));
    run.tick();
    expect(read()).toEqual([n(0, 6), true, 7]);
  });

  it('every cell to every goal: the next cell is always one the arrows of the current cell allow', () => {
    const { run, read, set } = card();
    run.tick();
    const lanes = laneGraph(listMarkers(run.world));
    for (const a of lanes.keys()) {
      for (const b of lanes.keys()) {
        set('at', a);
        set('goal', b);
        run.tick();
        const [next, hasNext, steps] = read();
        if (a === b) expect([next, hasNext, steps]).toEqual([a, false, 0]);
        else {
          expect(lanes.get(a), `${a} -> ${b}`).toContain(next);
          expect(hasNext).toBe(true);
          expect(steps).toBe(routeOnLanes(lanes, a, b).length);
        }
      }
    }
  });

  it('no goal, a goal that is no cell, a start that is no cell: the robot is told to stay where it is', () => {
    const { run, read, set } = card();
    set('goal', 0);
    run.tick();
    expect(read()).toEqual([n(0, 1), false, 0]);
    set('goal', n(1, 1)); // a hole
    run.tick();
    expect(read()).toEqual([n(0, 1), true, 0]);
    set('goal', n(0, 5));
    set('at', 0);
    run.tick();
    expect(read()).toEqual([0, true, 0]);
  });

  it('"Tránh ô bị giữ" on for the set time sends the robot through the other exit, back again after the same time, and a new cell forgets it', () => {
    const { run, read, set } = card(3);
    // From crossing (2,2) to (2,0): the usual way is west along row 2, the other exit is south down column 2.
    set('at', n(2, 2));
    set('goal', n(2, 0));
    run.tick();
    expect(read()).toEqual([n(2, 1), true, 2]);
    set('held', 1);
    run.tick(Math.round(2.9 / TICK_DT));
    expect(read()[0]).toBe(n(2, 1));
    run.tick(Math.round(0.2 / TICK_DT));
    expect(read()[0]).toBe(n(3, 2));
    expect(read()[2]).toBeGreaterThan(2);
    // Still held: after another 3 s it asks for the usual exit again.
    run.tick(Math.round(3 / TICK_DT));
    expect(read()[0]).toBe(n(2, 1));
    run.tick(Math.round(3 / TICK_DT));
    expect(read()[0]).toBe(n(3, 2));
    // Let through: the detour stays chosen until the robot is on another cell.
    set('held', 0);
    run.tick(60);
    expect(read()[0]).toBe(n(3, 2));
    set('at', n(3, 2));
    run.tick();
    expect(read()[0]).toBe(n(4, 2));
  });

  it('a wait shorter than the set time changes nothing, a cell with one exit never detours, and 0 seconds switches the detour off', () => {
    const a = card(3);
    a.set('at', n(2, 2));
    a.set('goal', n(2, 0));
    for (let k = 0; k < 5; k++) {
      a.set('held', 1);
      a.run.tick(Math.round(2.5 / TICK_DT));
      a.set('held', 0);
      a.run.tick(2);
      expect(a.read()[0]).toBe(n(2, 1));
    }
    a.set('at', n(2, 1));
    a.set('held', 1);
    a.run.tick(Math.round(10 / TICK_DT));
    expect(a.read()[0]).toBe(n(2, 0));

    const b = card(0);
    b.set('at', n(2, 2));
    b.set('goal', n(2, 0));
    b.set('held', 1);
    b.run.tick(Math.round(20 / TICK_DT));
    expect(b.read()[0]).toBe(n(2, 1));
  });
});
