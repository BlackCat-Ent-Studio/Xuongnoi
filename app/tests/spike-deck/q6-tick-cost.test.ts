import { beforeAll, describe, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import type { NodeSpec, WireSpec } from '../helpers/arm-rig';
import { bot, crateBottom, deckRig, f, holeDeck, join, marker, seconds } from './deck-rig';

/**
 * SPIKE ONLY. Question 6: what a tick costs for 6 tray robots on a deck with 3 x 3 holes (16 blocks), against the same robots on
 * the ground, and with 9 cages and 6 more robots driving on the ground under the deck. A measuring tool: it asserts nothing.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const TOP = 2.6;
const HOLES = [-2, 0, 2];
const WALL = 0.05;

function cage(n: number, x: number, z: number): NodeSpec[] {
  const h = 0.4 + WALL / 2;
  const wall = (k: string, dx: number, dz: number, sx: number, sz: number): NodeSpec => [`cage${n}${k}`, 'block', { position: { x: x + dx, y: 0.5, z: z + dz }, size: { x: sx, y: 1, z: sz } }];
  return [wall('a', h, 0, WALL, 0.9), wall('b', -h, 0, WALL, 0.9), wall('c', 0, h, 0.8, WALL), wall('d', 0, -h, 0.8, WALL)];
}

type What = 'ground' | 'deck' | 'deck+cages+6 under';

function board(what: What): { nodes: NodeSpec[]; wires: WireSpec[] } {
  const floor = what === 'ground' ? 0 : TOP;
  const parts: { nodes: NodeSpec[]; wires: WireSpec[] }[] = [];
  const scene: NodeSpec[] = what === 'ground' ? [] : holeDeck(TOP, 7, HOLES, HOLES, 0.7);
  let n = 0;
  for (const zh of HOLES) {
    // One robot from the left that stops beside the left hole of this row, one from the right beside the right hole.
    n++;
    scene.push(marker(n, -2, zh - 0.7, floor, 0.4));
    parts.push(bot({ id: `r${n}`, x: -6, z: zh - 0.7, floor, heading: 0, side: 1, goal: n, face: 0, crateKg: 2 }));
    n++;
    scene.push(marker(n, 2, zh - 0.7, floor, 0.4));
    parts.push(bot({ id: `r${n}`, x: 6, z: zh - 0.7, floor, heading: 180, side: -1, goal: n, face: 180, crateKg: 2 }));
  }
  if (what === 'deck+cages+6 under') {
    let c = 0;
    for (const x of HOLES) for (const z of HOLES) scene.push(...cage(c++, x, z));
    // Six bare robots on the ground, on the lanes between the cage rows and columns.
    const lanes: [number, number, number, number, number][] = [[-6, -1, 6, -1, 0], [6, 1, -6, 1, 180], [-6, 3.2, 6, 3.2, 0], [6, -3.2, -6, -3.2, 180], [-1, -6, -1, 6, 90], [1, 6, 1, -6, 270]];
    lanes.forEach(([x0, z0, x1, z1, heading], k) => {
      scene.push(marker(20 + k, x1, z1, 0, 0.4));
      parts.push(bot({ id: `t${k}`, x: x0, z: z0, floor: 0, heading, goal: 20 + k, bare: true }));
    });
  }
  return join({ nodes: scene, wires: [] }, ...parts);
}

describe('SPIKE q6: cost of one tick, 6 tray robots on a holed deck against the same on the ground', () => {
  it('prints one row per board', () => {
    const rows = ['| board | cards | entities | blocks | mean ms/tick | p50 | p95 | p99 | max after 1 s | arrived | cartons on the ground floor |', '|---|---|---|---|---|---|---|---|---|---|---|'];
    const measure = (what: What, note = ''): void => {
      const { nodes, wires } = board(what);
      const r = deckRig(nodes, wires, rapier);
      const ms: number[] = [];
      for (let k = 0; k < seconds(20); k++) {
        const t = performance.now();
        r.tick();
        ms.push(performance.now() - t);
      }
      const sorted = [...ms].sort((a, b) => a - b);
      const q = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
      const views = r.world.entities();
      const arrived = [1, 2, 3, 4, 5, 6].filter((k) => r.out(`r${k}-go`, 'arrived') === true).length;
      const down = [1, 2, 3, 4, 5, 6].filter((k) => crateBottom(r.entity(`r${k}-crate`)!) < 0.05).length;
      rows.push(`| ${what}${note} | ${nodes.length + 1} | ${views.length} | ${views.filter((v) => v.kind === 'block').length} | ${f(ms.reduce((a, c) => a + c, 0) / ms.length)} | ${f(q(0.5))} | ${f(q(0.95))} | ${f(q(0.99))} | ${f(Math.max(...ms.slice(60)))} | ${arrived}/6 | ${down}/6 |`);
      r.world.dispose?.();
    };
    // Warm-up, not printed.
    {
      const { nodes, wires } = board('deck');
      const r = deckRig(nodes, wires, rapier);
      for (let k = 0; k < 600; k++) r.tick();
      r.world.dispose?.();
      rows.length = 2;
    }
    for (let pass = 1; pass <= 3; pass++) for (const what of ['ground', 'deck', 'deck+cages+6 under'] as const) measure(what, ` (pass ${pass})`);
    console.log(rows.join('\n'));
    console.log(`tick budget at 60 Hz: ${f(TICK_DT * 1000, 2)} ms`);
  });
});
