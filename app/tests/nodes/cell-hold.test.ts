import { beforeAll, describe, expect, it } from 'vitest';
import type { EntityView, GraphNode, ParamValue } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { CHASSIS, TUNED_DRIVE, flatBoard, node, play, type Played } from '../helpers/grid-floor';
import { CHASSIS_Y, FLOOR } from '../helpers/nav-rig';

/**
 * "Bảng giữ ô": one robot per floor cell. Small floors of plain cards (no circuit), "Vật lý thật" on, every claim checked
 * on every tick from the entity views and the card's own outputs.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const P = 1.4;
const OWN = '#f59e0b';
const HELD = '#ef4444';
const floor = (): GraphNode => node('floor', FLOOR[1], FLOOR[2]);
const cell = (number: number, x: number, z: number, exits = 'none', y = 0): GraphNode => node(`m${number}`, 'floor-marker', { number, position: { x: x * P, y, z: z * P }, size: P, exits, color: OWN });

/** A robot of plain cards on row `k` of the hold card: chassis, two motors, the driver and the marker lookup. `want` names the card whose output is the cell it asks for. */
function bot(id: string, k: number, x: number, z: number, heading: number, want: string, y = 0): { nodes: GraphNode[]; wires: string[] } {
  const half = CHASSIS.width / 2 - 0.05;
  return {
    nodes: [
      node(id, 'robot-body', { position: { x: x * P, y: y + CHASSIS_Y, z: z * P }, heading, length: CHASSIS.length, width: CHASSIS.width, height: 0.3, mass: 5, friction: 0.8 }),
      node(`${id}-l`, 'motor', { side: -half }),
      node(`${id}-r`, 'motor', { side: half }),
      node(`${id}-go`, 'robot-goto', TUNED_DRIVE),
      node(`${id}-find`, 'floor-marker-find'),
    ],
    wires: [`${id}.self>${id}-l.body`, `${id}.self>${id}-r.body`, `${id}.self>${id}-go.robot`, `${id}-go.left>${id}-l.power`, `${id}-go.right>${id}-r.power`, 'start.started>' + `${id}-go.go`, `${id}.self>hold.robot${k}`, `${want}>hold.want${k}`, `hold.cell${k}>${id}-find.number`, `${id}-find.marker>${id}-go.target`],
  };
}

const hold = (params: Record<string, ParamValue> = {}): GraphNode => node('hold', 'cell-hold', { robots: 2, ...params });
const set = (run: Played, id: string, value: number): void => {
  expect(run.rt.applyNodeParams(id, { value })).toBe(true);
};
const colourOf = (run: Played, number: number): string => run.entity(`m${number}`)!.color;
/** True when the upright box round the turned chassis reaches over the tile of cell (x, z). */
function bodyOn(v: EntityView, x: number, z: number): boolean {
  const r = v.robot!;
  const c = Math.abs(Math.cos(r.heading));
  const s = Math.abs(Math.sin(r.heading));
  const hx = (r.length / 2) * c + (r.width / 2) * s;
  const hz = (r.length / 2) * s + (r.width / 2) * c;
  return Math.abs(v.position.x - x * P) < P / 2 + hx && Math.abs(v.position.z - z * P) < P / 2 + hz;
}

describe('Bảng giữ ô', () => {
  /** Cells 1, 2, 3 in a row; robot a on 1 and robot b on 3 both ask for 2. `aRow` = the row of the card a is wired to. */
  function meeting(aRow: 1 | 2) {
    const a = bot('a', aRow, 0, 0, 0, 'wantA.value');
    const b = bot('b', aRow === 1 ? 2 : 1, 2, 0, 180, 'wantB.value');
    const run = play(flatBoard([floor(), cell(1, 0, 0), cell(2, 1, 0), cell(3, 2, 0), node('start', 'on-start'), node('wantA', 'const', { value: 2 }), node('wantB', 'const', { value: 2 }), hold(), ...a.nodes, ...b.nodes], [...a.wires, ...b.wires]), rapier);
    const out = (port: string, id: 'a' | 'b'): unknown => run.out('hold', `${port}${id === 'a' ? aRow : 3 - aRow}`);
    return { run, out };
  }

  it('each robot starts cleared for the cell it stands on; the tiles it holds are painted and counted', () => {
    const { run, out } = meeting(1);
    run.rt.applyNodeParams('wantA', { value: 0 });
    run.rt.applyNodeParams('wantB', { value: 0 });
    run.tick(30);
    expect([out('cell', 'a'), out('cell', 'b')]).toEqual([1, 3]);
    expect([out('wait', 'a'), out('wait', 'b')]).toEqual([false, false]);
    expect([out('stood', 'a'), out('stood', 'b')]).toEqual([true, true]);
    expect(run.out('hold', 'held')).toBe(2);
    expect([1, 2, 3].map((c) => colourOf(run, c))).toEqual([HELD, OWN, HELD]);
  });

  it.each([1, 2] as const)('two robots ask for one cell on the same tick: the lower row gets it, the other waits where it is (robot a on row %s)', (aRow) => {
    const { run, out } = meeting(aRow);
    const winner = aRow === 1 ? 'a' : 'b';
    const loser = aRow === 1 ? 'b' : 'a';
    const from = { ...run.entity(loser)!.position };
    for (let k = 0; k < 8 * 60; k++) {
      run.tick();
      // Never two robots cleared for one cell.
      expect(out('cell', 'a')).not.toBe(out('cell', 'b'));
    }
    expect(out('cell', winner)).toBe(2);
    expect(out('stood', winner)).toBe(true);
    expect(Math.hypot(run.entity(winner)!.position.x - P, run.entity(winner)!.position.z)).toBeLessThan(0.03);
    expect(out('cell', loser)).toBe(loser === 'a' ? 1 : 3);
    expect(out('wait', loser)).toBe(true);
    expect(out('wait', winner)).toBe(false);
    expect(Math.hypot(run.entity(loser)!.position.x - from.x, run.entity(loser)!.position.z - from.z)).toBeLessThan(0.03);
  });

  it('a cell is let go only when the body is off it: the waiting robot is cleared the tick after, and tiles get their own colour back', () => {
    const { run, out } = meeting(1);
    run.tick(8 * 60);
    expect([1, 2, 3].map((c) => colourOf(run, c))).toEqual([OWN, HELD, HELD]);
    // Robot a goes back to cell 1; robot b still wants cell 2.
    set(run, 'wantA', 1);
    let clearedAt = -1;
    for (let k = 0; k < 10 * 60 && clearedAt < 0; k++) {
      run.tick();
      if (out('cell', 'b') === 2) clearedAt = k;
      else {
        expect(out('wait', 'b')).toBe(true);
        expect(run.entity('b')!.position.x).toBeGreaterThan(2 * P - 0.03);
      }
    }
    expect(clearedAt).toBeGreaterThan(0);
    // The card read the floor before this tick's move: robot a was already clear of tile 2 then, and is now.
    expect(bodyOn(run.entity('a')!, 1, 0)).toBe(false);
    run.tick(8 * 60);
    expect([out('cell', 'a'), out('cell', 'b')]).toEqual([1, 2]);
    expect([1, 2, 3].map((c) => colourOf(run, c))).toEqual([HELD, HELD, OWN]);
    expect(run.out('hold', 'held')).toBe(2);
  });

  it('"Robot k đứng giữa ô" is on only while the robot stands still on the middle of its cleared cell, and goes off the tick the cell changes', () => {
    const { run, out } = meeting(1);
    run.rt.applyNodeParams('wantA', { value: 0 });
    run.rt.applyNodeParams('wantB', { value: 0 });
    run.tick(30);
    expect(out('stood', 'a')).toBe(true);
    set(run, 'wantA', 2);
    let saw = false;
    for (let k = 0; k < 8 * 60; k++) {
      run.tick();
      const v = run.entity('a')!;
      if (out('cell', 'a') === 2 && !saw) {
        // The very tick the answer changes to cell 2 the robot still stands on the middle of cell 1.
        saw = true;
        expect(Math.hypot(v.position.x, v.position.z)).toBeLessThan(0.06);
        expect(out('stood', 'a')).toBe(false);
      }
      if (out('stood', 'a') === true) {
        expect(saw).toBe(true);
        expect(Math.hypot(v.position.x - P, v.position.z)).toBeLessThanOrEqual(0.06);
        expect(Math.abs(v.robot!.speed)).toBeLessThan(0.06);
      }
    }
    expect(saw).toBe(true);
    expect(out('stood', 'a')).toBe(true);
  });

  it('a row without a robot wire, and a robot that does not stand on any marker, are cleared for nothing and hold nothing', () => {
    const a = bot('a', 1, 0, 0, 0, 'wantA.value');
    const b = bot('b', 2, 5, 5, 0, 'wantB.value');
    const cut = a.wires.filter((w) => w !== 'a.self>hold.robot1');
    const run = play(flatBoard([floor(), cell(1, 0, 0), cell(2, 1, 0), node('start', 'on-start'), node('wantA', 'const', { value: 2 }), node('wantB', 'const', { value: 2 }), hold(), ...a.nodes, ...b.nodes], [...cut, ...b.wires]), rapier);
    const from = [run.entity('a')!.position.x, run.entity('b')!.position.x];
    run.tick(5 * 60);
    expect([run.out('hold', 'cell1'), run.out('hold', 'wait1'), run.out('hold', 'stood1')]).toEqual([0, false, false]);
    expect([run.out('hold', 'cell2'), run.out('hold', 'wait2'), run.out('hold', 'stood2')]).toEqual([0, false, false]);
    expect(run.out('hold', 'held')).toBe(0);
    expect([run.entity('a')!.position.x, run.entity('b')!.position.x]).toEqual(from);
    expect([colourOf(run, 1), colourOf(run, 2)]).toEqual([OWN, OWN]);
  });

  /** Five cells in a row with arrows east, then a turn south: 1 -> 2 -> 3 -> 4 -> 5, 5 -> 6 below it. One robot drives 1 to 6 by the route card. */
  function lane(flow: 'yes' | 'no') {
    const a = bot('a', 1, 0, 0, 0, 'route.next');
    const run = play(
      flatBoard(
        [floor(), ...[1, 2, 3, 4].map((c) => cell(c, c - 1, 0, 'E')), cell(5, 4, 0, 'S'), cell(6, 4, 1), node('start', 'on-start'), node('goal', 'const', { value: 6 }), node('read', 'floor-marker-sensor'), node('route', 'grid-route'), hold({ robots: 1, flow }), ...a.nodes],
        [...a.wires, 'a.self>read.who', 'read.number>route.at', 'goal.value>route.goal', 'hold.wait1>route.avoid'],
      ),
      rapier,
    );
    /** Slowest the robot was while its middle crossed the middle of each of the cells 2, 3, 4 and of the corner cell 5. */
    const slowest = [Infinity, Infinity, Infinity, Infinity];
    let seconds = 0;
    for (let k = 0; k < 60 * 60 && !(run.out('hold', 'stood1') === true && run.out('hold', 'cell1') === 6); k++) {
      run.tick();
      seconds = (k + 1) / 60;
      const v = run.entity('a')!;
      for (let c = 0; c < 4; c++) if (Math.hypot(v.position.x - (c + 1) * P, v.position.z) < 0.08) slowest[c] = Math.min(slowest[c]!, Math.abs(v.robot!.speed));
    }
    return { run, slowest, seconds };
  }

  it('going straight on the robot asks early and does not stop at each cell; before a turn it stops on the middle', () => {
    const early = lane('yes');
    const late = lane('no');
    expect(early.run.out('hold', 'cell1')).toBe(6);
    expect(late.run.out('hold', 'cell1')).toBe(6);
    // Cells 2, 3, 4 lie on the straight: crossed at speed with early asking; without, the robot brakes to a crawl on each middle.
    for (const c of [0, 1, 2]) {
      expect(early.slowest[c], `cell ${c + 2}, early`).toBeGreaterThan(0.3);
      expect(late.slowest[c], `cell ${c + 2}, late`).toBeLessThan(0.2);
    }
    // Cell 5 is the corner: both stop there.
    expect(early.slowest[3]).toBeLessThan(0.05);
    expect(late.slowest[3]).toBeLessThan(0.05);
    expect(early.seconds).toBeLessThan(late.seconds * 0.9);
    // Both end standing on the middle of cell 6.
    for (const x of [early, late]) expect(Math.hypot(x.run.entity('a')!.position.x - 4 * P, x.run.entity('a')!.position.z - P)).toBeLessThan(0.03);
  });

  it('two floors: a robot holds only tiles of the floor it stands on, so the robot above is cleared for the cell over its head', () => {
    // Ground cells 1, 2; a deck 2.6 m up with cells 101, 102 right above them. The ground robot stands on 2; the deck robot drives 101 -> 102.
    const low = bot('low', 1, 1, 0, 0, 'wantLow.value');
    const high = bot('high', 2, 0, 0, 0, 'wantHigh.value', 2.6);
    const run = play(
      flatBoard(
        [floor(), node('deck', 'block', { position: { x: P / 2, y: 2.5, z: 0 }, size: { x: 4 * P, y: 0.2, z: 2 * P } }), cell(1, 0, 0), cell(2, 1, 0), node('m101', 'floor-marker', { number: 101, position: { x: 0, y: 2.6, z: 0 }, size: P }), node('m102', 'floor-marker', { number: 102, position: { x: P, y: 2.6, z: 0 }, size: P }), node('start', 'on-start'), node('wantLow', 'const', { value: 0 }), node('wantHigh', 'const', { value: 102 }), hold(), ...low.nodes, ...high.nodes],
        [...low.wires, ...high.wires],
      ),
      rapier,
    );
    run.tick(10 * 60);
    expect(run.out('hold', 'cell1')).toBe(2);
    expect(run.out('hold', 'cell2')).toBe(102);
    expect(run.out('hold', 'wait2')).toBe(false);
    const v = run.entity('high')!;
    expect(v.position.y).toBeGreaterThan(2.6);
    expect(Math.hypot(v.position.x - P, v.position.z)).toBeLessThan(0.03);
    expect(run.out('hold', 'held')).toBe(2);
  });
});
