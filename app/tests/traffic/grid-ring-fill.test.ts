import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT, type Board, type GraphNode } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { LAYOUT_A, TUNED_DRIVE, botCircuit, botCopy, cellNumber, cellOf, cutOnMain, holdWires, laneMarkers, node, play, wiresOf } from '../helpers/grid-floor';
import { FLOOR } from '../helpers/nav-rig';
import { say } from './traffic-log';

/**
 * The one way "Bảng giữ ô" can lock up on a one-way floor. The shortest closed loop has 8 cells. Robots (copies of the
 * robot circuit) are put on that loop round the first hole, each sent to the cell just behind it, so every one must go 7
 * cells round. With 7 robots one cell is free and all get there; with 8 the loop is full and nobody can ever move, unless
 * a robot that has waited long enough takes the other exit of its cell ("Tìm đường trên lưới").
 */
let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const G = LAYOUT_A;
const P = 1.4;
const n = (r: number, c: number): number => cellNumber(G, r, c);
const RING = [n(0, 0), n(0, 1), n(0, 2), n(1, 2), n(2, 2), n(2, 1), n(2, 0), n(1, 0)];

function headingBetween(from: number, to: number): number {
  const [fr, fc] = cellOf(G, from);
  const [tr, tc] = cellOf(G, to);
  return tc > fc ? 0 : tc < fc ? 180 : tr > fr ? 90 : -90;
}

function ringBoard(count: number, detourAfter: number): Board {
  const nodes: GraphNode[] = [node('floor', FLOOR[1], FLOOR[2]), ...laneMarkers(G, P), node('giu-o', 'cell-hold', { robots: count })];
  const wires: string[] = [];
  for (let k = 0; k < count; k++) {
    const id = `r${k + 1}`;
    const [r, c] = cellOf(G, RING[k]!);
    nodes.push(botCopy(id, c * P, r * P, headingBetween(RING[k]!, RING[(k + 1) % 8]!)), node(`${id}-goal`, 'const', { value: RING[(k + 7) % 8]! }));
    wires.push(...holdWires(id, k + 1), `${id}-goal.value>${id}.o-dich`);
  }
  return { name: 'Vòng 8 ô', mode: '3d', graph: { nodes, wires: wiresOf(wires), settings: { wireRule: true, realPhysics: true } }, circuits: [botCircuit(TUNED_DRIVE, detourAfter)] };
}

function fill(board: Board, count: number, seconds: number): { moved: number; home: number } {
  const run = play(board, rapier);
  const ids = Array.from({ length: count }, (_, k) => `r${k + 1}`);
  const start = ids.map((id) => ({ ...run.robot(id).position }));
  const moved = ids.map(() => false);
  for (let k = 0; k < Math.round(seconds / TICK_DT); k++) {
    run.tick();
    ids.forEach((id, i) => {
      const v = run.robot(id);
      if (Math.hypot(v.position.x - start[i]!.x, v.position.z - start[i]!.z) > P / 2) moved[i] = true;
    });
  }
  let home = 0;
  ids.forEach((id, k) => {
    const v = run.robot(id);
    const [gr, gc] = cellOf(G, RING[(k + 7) % 8]!);
    if (Math.hypot(v.position.x - gc * P, v.position.z - gr * P) < 0.1) home += 1;
  });
  return { moved: moved.filter(Boolean).length, home };
}

describe('"Bảng giữ ô" on the shortest loop (8 cells)', () => {
  it('7 robots: one cell is free, all of them get round to their goal', () => {
    const x = fill(ringBoard(7, 0), 7, 180);
    say(`RING 7 robots, no detour, 180 s: ${x.moved} left their cell, ${x.home} at their goal`);
    expect(x.home).toBe(7);
  });

  it('8 robots, detour switched off: the loop is full, nobody ever leaves its cell', () => {
    const x = fill(ringBoard(8, 0), 8, 180);
    say(`RING 8 robots, no detour, 180 s: ${x.moved} left their cell, ${x.home} at their goal`);
    expect(x.moved).toBe(0);
  });

  it('8 robots, "take the other exit after 3 s of waiting": the loop opens and every robot moves', () => {
    const x = fill(ringBoard(8, 3), 8, 300);
    say(`RING 8 robots, detour after 3 s, 300 s: ${x.moved} left their cell, ${x.home} at their goal`);
    expect(x.moved).toBe(8);
  });

  it('the detour needs its wire: with every "Robot k đang chờ ô" wire cut the full loop stays locked', () => {
    let board = ringBoard(8, 3);
    for (let k = 1; k <= 8; k++) board = cutOnMain(board, `giu-o.wait${k}>r${k}.dang-cho`);
    const x = fill(board, 8, 180);
    say(`RING 8 robots, detour after 3 s but the waiting wires cut, 180 s: ${x.moved} left their cell`);
    expect(x.moved).toBe(0);
  });
});
