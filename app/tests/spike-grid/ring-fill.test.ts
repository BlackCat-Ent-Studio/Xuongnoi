import { appendFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import type { NodeSpec, WireSpec } from '../helpers/arm-rig';
import { navBot, navRig } from '../helpers/nav-rig';
import { cellNumber, cellOf } from './experimental-nodes';
import { CHASSIS, GRID, headingBetween, markerRows } from './grid-rig';

/**
 * Measuring spike: the one way "Giữ ô" can lock up on a one-way floor. The shortest closed loop has 8 cells. Robots are
 * put on that loop (round hole 1), each sent to the cell just behind it, so every one must go 7 cells round the loop.
 * With 7 robots one cell is free and they all get there; with 8 the loop is full and nobody can ever move, unless the
 * route piece is told to go round held cells after a wait.
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
const RING = [n(0, 0), n(0, 1), n(0, 2), n(1, 2), n(2, 2), n(2, 1), n(2, 0), n(1, 0)];

function fill(count: number, detourAfter: number, seconds: number, detourRule = 0) {
  const nodes: NodeSpec[] = [...markerRows(P), ['start', 'on-start', {}]];
  const wires: WireSpec[] = [];
  const ids: string[] = [];
  for (let k = 0; k < count; k++) {
    const id = `r${k + 1}`;
    ids.push(id);
    const cell = RING[k]!;
    const [r, c] = cellOf(GRID, cell);
    const bot = navBot({ id, x: c * P, z: r * P, heading: headingBetween(cell, RING[(k + 1) % 8]!), length: CHASSIS.length, width: CHASSIS.width, drive: { power: 0.8, slowDistance: 0.6 } });
    nodes.push(...bot.nodes, [`${id}-goal`, 'const', { value: RING[(k + 7) % 8]! }], [`${id}-route`, 'x-grid-route', { ...GRID, detour: detourRule }], [`${id}-hold`, 'x-cell-hold', { flow: 1 }]);
    wires.push(...bot.wires, [id, 'self', `${id}-hold`, 'who'], [id, 'self', `${id}-route`, 'who'], [`${id}-goal`, 'value', `${id}-route`, 'goal'], [`${id}-hold`, 'held', `${id}-route`, 'at'], [`${id}-route`, 'next', `${id}-hold`, 'want'], [`${id}-hold`, 'marker', `${id}-go`, 'target'], ['start', 'started', `${id}-go`, 'go'], ['start', 'started', `${id}-hold`, 'ask']);
    if (detourAfter > 0) {
      nodes.push([`${id}-patience`, 'timer', { seconds: detourAfter }], [`${id}-calm`, 'not', {}]);
      wires.push([`${id}-hold`, 'waiting', `${id}-patience`, 'run'], [`${id}-hold`, 'waiting', `${id}-calm`, 'in'], [`${id}-calm`, 'out', `${id}-patience`, 'reset'], [`${id}-patience`, 'done', `${id}-route`, 'avoid']);
    }
  }
  const rig = navRig(nodes, wires, rapier);
  const start = ids.map((id) => ({ ...rig.entity(id)!.position }));
  let moved = 0;
  for (let k = 0; k < Math.round(seconds / TICK_DT); k++) rig.tick();
  let home = 0;
  ids.forEach((id, k) => {
    const v = rig.entity(id)!;
    if (Math.hypot(v.position.x - start[k]!.x, v.position.z - start[k]!.z) > 0.05) moved += 1;
    const [gr, gc] = cellOf(GRID, RING[(k + 7) % 8]!);
    if (Math.hypot(v.position.x - gc * P, v.position.z - gr * P) < 0.1) home += 1;
  });
  return { moved, home };
}

describe('"Giữ ô" on the shortest loop (8 cells)', () => {
  it('7 robots: one cell is free, all of them get round', () => {
    const x = fill(7, 0, 180);
    say(`RING 7 robots, no detour, 180 s: ${x.moved} moved, ${x.home} at their goal`);
    expect(x.home).toBe(7);
  });

  it('8 robots: the loop is full, nobody ever moves', () => {
    const x = fill(8, 0, 180);
    say(`RING 8 robots, no detour, 180 s: ${x.moved} moved, ${x.home} at their goal`);
    expect(x.moved).toBe(0);
  });

  it('8 robots, "a whole way clear of held cells" after 1 s of waiting: still locked (every goal lies behind a held cell)', () => {
    const x = fill(8, 1, 180);
    say(`RING 8 robots, detour rule "whole path" after 1 s, 180 s: ${x.moved} moved, ${x.home} at their goal`);
    expect(x.moved).toBe(0);
  });

  it('8 robots, "take the other exit when the next cell is held" after 1 s of waiting: the loop opens', () => {
    const x = fill(8, 1, 300, 1);
    say(`RING 8 robots, detour rule "next cell" after 1 s, 300 s: ${x.moved} moved, ${x.home} at their goal`);
    expect(x.moved).toBeGreaterThan(0);
  });
});
