import { appendFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT, type ParamValue } from '../../src/engine/types';
import { TABLE_MAX_ROWS } from '../../src/nodes/value-table';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import type { NodeSpec, WireSpec } from '../helpers/arm-rig';
import { navBot, navRig } from '../helpers/nav-rig';
import { cellNumber, cellOf, exitsOf, isLane, routeOnGrid } from './experimental-nodes';
import { CHASSIS, GRID, HOLE, markerRows } from './grid-rig';

/**
 * Measuring spike, EXISTING pieces only: one robot is given its route as a "Bảng giá trị" of marker numbers, stepped by a
 * "Bộ đếm" on every "Khi tới nơi" ("chia lấy dư" wraps it), through "Tìm mốc sàn" into "Đi tới điểm". The route is the
 * one-way ring of 8 cells round hole 1. Measured: seconds per cell, where it stops, how far it leaves the lane middle.
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

const P = 1.4;
const n = (r: number, c: number): number => cellNumber(GRID, r, c);
const RING = [n(0, 1), n(0, 2), n(1, 2), n(2, 2), n(2, 1), n(2, 0), n(1, 0), n(0, 0)];
const CORNERS = [n(0, 2), n(2, 2), n(2, 0), n(0, 0)];

function tour(route: number[], drive: Record<string, ParamValue>, seconds: number) {
  const bot = navBot({ id: 'r', x: 0, z: 0, heading: 0, length: CHASSIS.length, width: CHASSIS.width, drive });
  const table: Record<string, ParamValue> = { rows: route.length, ...Object.fromEntries(route.map((v, k) => [`v${k + 1}`, v])) };
  const nodes: NodeSpec[] = [...markerRows(P), ...bot.nodes, ['start', 'on-start', {}], ['step', 'counter', { start: 0, target: 1e9 }], ['len', 'const', { value: route.length }], ['wrap', 'math', { op: 'mod' }], ['one', 'const', { value: 1 }], ['row', 'math', { op: 'add' }], ['table', 'value-table', table], ['find', 'floor-marker-find', {}]];
  const wires: WireSpec[] = [...bot.wires, ['r-go', 'arrivedPulse', 'step', 'up'], ['step', 'value', 'wrap', 'a'], ['len', 'value', 'wrap', 'b'], ['wrap', 'out', 'row', 'a'], ['one', 'value', 'row', 'b'], ['row', 'out', 'table', 'index'], ['table', 'value', 'find', 'number'], ['find', 'marker', 'r-go', 'target'], ['start', 'started', 'r-go', 'go']];
  const rig = navRig(nodes, wires, rapier);
  let legs = 0;
  let worstStop = 0;
  let offLane = 0;
  let cornerOverHole = 0;
  let worstAngle = 0;
  for (let k = 0; k < Math.round(seconds / TICK_DT); k++) {
    const target = Number(rig.out('table', 'value'));
    rig.tick();
    const v = rig.entity('r')!;
    const row = Math.round(v.position.z / P);
    const col = Math.round(v.position.x / P);
    const dz = Math.abs(v.position.z - row * P);
    const dx = Math.abs(v.position.x - col * P);
    offLane = Math.max(offLane, !isLane(GRID, row, col) ? P : row % 2 === 0 && col % 2 === 0 ? Math.min(dx, dz) : row % 2 === 0 ? dz : dx);
    const h = v.robot!.heading;
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        const qx = v.position.x + (a * Math.cos(h) * CHASSIS.length) / 2 - (b * Math.sin(h) * CHASSIS.width) / 2;
        const qz = v.position.z + (a * Math.sin(h) * CHASSIS.length) / 2 + (b * Math.cos(h) * CHASSIS.width) / 2;
        if (Math.abs(qx - P) < HOLE / 2 && Math.abs(qz - P) < HOLE / 2) cornerOverHole += 1;
      }
    }
    if (rig.out('r-go', 'arrivedPulse') === true) {
      legs += 1;
      const [tr, tc] = cellOf(GRID, target);
      worstStop = Math.max(worstStop, Math.hypot(v.position.x - tc * P, v.position.z - tr * P));
      const deg = ((((h * 180) / Math.PI) % 90) + 90) % 90;
      worstAngle = Math.max(worstAngle, Math.min(deg, 90 - deg));
    }
  }
  return { legs, worstStop, offLane, cornerOverHole, worstAngle };
}

describe('existing pieces only: a given route, one robot', () => {
  it.each([
    ['every cell, default drive', RING, {}],
    ['every cell, power 0.8 slow 0.6', RING, { power: 0.8, slowDistance: 0.6 }],
    ['every cell, power 1 slow 0.5', RING, { power: 1, slowDistance: 0.5 }],
    ['every cell, power 1 slow 0.3 tolerance 0.3', RING, { power: 1, slowDistance: 0.3, tolerance: 0.3 }],
    ['corners only, default drive', CORNERS, {}],
    ['corners only, power 0.8 slow 0.6', CORNERS, { power: 0.8, slowDistance: 0.6 }],
  ] as [string, number[], Record<string, ParamValue>][])('%s', (name, route, drive) => {
    const t = tour(route, drive, 240);
    const cells = route === RING ? t.legs : t.legs * 2;
    say(`PIECES ${name}: ${t.legs} legs in 240 s = ${(240 / cells).toFixed(2)} s per cell (${((cells * P) / 240).toFixed(2)} m/s average), worst stop ${(t.worstStop * 1000).toFixed(0)} mm, worst angle at a stop ${t.worstAngle.toFixed(1)} deg, off lane max ${(t.offLane * 1000).toFixed(0)} mm, ticks with a corner over the hole ${t.cornerOverHole}`);
    expect(t.legs).toBeGreaterThan(8);
  });

  it('routing with tables only: how many typed numbers a next-cell table would need', () => {
    const lanes: number[] = [];
    for (let r = 0; r < GRID.rows; r++) for (let c = 0; c < GRID.cols; c++) if (isLane(GRID, r, c)) lanes.push(n(r, c));
    const goals = [n(1, 0), n(5, 0)];
    for (let r = 1; r < GRID.rows; r += 2) for (let c = 1; c < GRID.cols; c += 2) goals.push(n(r - 1, c), n(r + 1, c));
    const distinct = new Set(goals);
    let reachable = 0;
    let longest = 0;
    for (const from of lanes) {
      for (const goal of distinct) {
        const path = routeOnGrid(GRID, from, goal);
        if (from === goal || path.length > 0) reachable += 1;
        longest = Math.max(longest, path.length);
      }
    }
    const twoExit = lanes.filter((c) => exitsOf(GRID, c).length === 2).length;
    say(`PIECES routing table: ${lanes.length} lane cells x ${distinct.size} goal cells = ${lanes.length * distinct.size} next-cell numbers per robot (every pair reachable: ${reachable === lanes.length * distinct.size}); a value table holds ${TABLE_MAX_ROWS} rows; cells with a real choice (two exits): ${twoExit}; longest shortest route ${longest} cells`);
    expect(TABLE_MAX_ROWS).toBeLessThan(lanes.length);
  });
});
