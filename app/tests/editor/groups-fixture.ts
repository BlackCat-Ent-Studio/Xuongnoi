import type { Graph, GraphNode } from '../../src/engine/types';

const node = (id: string, kind: string, x: number, y: number): GraphNode => ({ id, kind, params: {}, pos: { x, y } });

/** k1 (outside key) feeds both characters c1/c2; c1 feeds two outside carry nodes. */
export function fixture(): Graph {
  return {
    nodes: [
      node('k1', 'key', 0, 0),
      node('c1', 'character', 300, 40),
      node('c2', 'character', 300, 200),
      node('cr1', 'carry', 700, 0),
      node('cr2', 'carry', 700, 160),
      node('lone', 'key', 0, 400),
    ],
    wires: [
      { id: 'w1', from: { node: 'k1', port: 'held' }, to: { node: 'c1', port: 'jump' } },
      { id: 'w2', from: { node: 'k1', port: 'pressed' }, to: { node: 'c2', port: 'jump' } },
      { id: 'w3', from: { node: 'c1', port: 'self' }, to: { node: 'cr1', port: 'character' } },
      { id: 'w4', from: { node: 'c1', port: 'self' }, to: { node: 'cr2', port: 'character' } },
    ],
  };
}
