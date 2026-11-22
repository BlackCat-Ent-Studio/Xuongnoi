import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cellNumber, cellOf, exitsOf, isLane, routeOnGrid, type GridShape } from './experimental-nodes';

/**
 * Measuring spike: facts about the one-way lane graph of layout A (7 x 7 cells) that the deadlock argument rests on.
 * No physics here.
 */
const LOG = process.env.SPIKE_LOG ?? 'tests/spike-grid/spike-log.txt';
const say = (text: string): void => {
  console.log(text);
  appendFileSync(LOG, `${text}\n`);
};

const G: GridShape = { rows: 7, cols: 7 };
const lanes: number[] = [];
for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) if (isLane(G, r, c)) lanes.push(cellNumber(G, r, c));

describe('the lane graph of the 7 x 7 one-way floor', () => {
  it('no two cells point at each other, so two robots can never want each other\'s cell (no head-on)', () => {
    for (const a of lanes) for (const b of exitsOf(G, a)) expect(exitsOf(G, b)).not.toContain(a);
  });

  it('every lane cell can reach every other one', () => {
    for (const a of lanes) for (const b of lanes) if (a !== b) expect(routeOnGrid(G, a, b).length).toBeGreaterThan(0);
  });

  it('the shortest closed loop has 8 cells: fewer than 8 robots cannot fill one', () => {
    let shortest = Infinity;
    const rings = new Set<string>();
    for (const a of lanes) {
      for (const b of exitsOf(G, a)) {
        const back = routeOnGrid(G, b, a);
        const loop = [a, b, ...back.slice(0, -1)];
        if (back.length === 0) continue;
        if (loop.length < shortest) {
          shortest = loop.length;
          rings.clear();
        }
        if (loop.length === shortest) rings.add([...loop].sort((x, y) => x - y).join(','));
      }
    }
    say(`GRAPH lane cells ${lanes.length}, cells with two exits ${lanes.filter((c) => exitsOf(G, c).length === 2).length}, cells with no exit ${lanes.filter((c) => exitsOf(G, c).length === 0).length}, shortest closed loop ${shortest} cells, loops of that length ${rings.size}: ${[...rings].map((ring) => `[${ring.split(',').map((n) => `(${cellOf(G, Number(n)).join(',')})`).join(' ')}]`).join('; ')}`);
    expect(shortest).toBe(8);
  });
});
