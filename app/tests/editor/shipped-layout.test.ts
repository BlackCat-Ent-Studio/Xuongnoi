import { describe, expect, it } from 'vitest';
import { estimateNodeSize, boxesOverlap } from '../../src/editor/graph/graph-geometry';
import { STUDENT_CARD_METRICS, relayoutShipped } from '../../src/editor/graph/shipped-layout';
import { HANDBOOK } from '../../src/handbook';
import { listAllSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { LESSONS } from '../../src/tutorial/lessons';
import type { Board } from '../../src/engine/types';

registerAllNodes();

/** Everything but positions: what must not change when a shipped board is spread. */
const withoutPositions = (b: Board) => ({
  ...b,
  graph: { ...b.graph, nodes: b.graph.nodes.map(({ pos: _pos, ...n }) => n), groups: b.graph.groups?.map(({ x: _x, y: _y, ...g }) => g) },
  notes: b.notes?.map(({ pos: _pos, ...n }) => n),
});

function overlaps(b: Board): number {
  const boxes = b.graph.nodes.map((n) => ({ x: n.pos.x, y: n.pos.y, ...estimateNodeSize(n, STUDENT_CARD_METRICS) }));
  let count = 0;
  const group = new Map<string, string>();
  for (const g of b.graph.groups ?? []) for (const id of g.nodeIds) group.set(id, g.id);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if ((group.get(b.graph.nodes[i]!.id) ?? '') === (group.get(b.graph.nodes[j]!.id) ?? '') && boxesOverlap(boxes[i]!, boxes[j]!)) count++;
    }
  }
  return count;
}

const shipped: Array<[string, Board]> = [
  ...listAllSamples().map((s): [string, Board] => [`sample ${s.label}`, s.board]),
  ...LESSONS.map((l): [string, Board] => [`lesson ${l.id}`, l.createBoard()]),
  ...HANDBOOK.flatMap((e) => (e.tryBoard ? [[`handbook ${e.kind}`, e.tryBoard()] as [string, Board]] : [])),
];

describe('shipped boards at the Học sinh card size', () => {
  it('finds the boards', () => expect(shipped.length).toBeGreaterThan(50));

  it.each(shipped)('%s: only positions change, and no cards overlap afterwards', (_name, board) => {
    const out = relayoutShipped(structuredClone(board));
    expect(withoutPositions(out)).toEqual(withoutPositions(board));
    expect(overlaps(out)).toBe(0);
  });
});
