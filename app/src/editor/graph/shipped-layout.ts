import type { Board } from '../../engine/types';
import { spreadOverlaps, type CardMetrics } from './graph-geometry';

/** The card size of "Học sinh", the biggest one: a board clean at this size is clean in "Giáo viên" too. */
export const STUDENT_CARD_METRICS: CardMetrics = { head: 52, row: 34, fontScale: 15 / 13 };

/** Width a collapsed group block needs in "Học sinh" (header text + port labels), with a gap. */
const GROUP_BLOCK_W = 300;

/** Collapsed group blocks that sit side by side closer than a block is wide are moved apart (left to right). */
function spreadGroupBlocks(graph: Board['graph']): Board['graph'] {
  const groups = graph.groups;
  if (!groups || groups.length < 2) return graph;
  const sorted = [...groups].sort((a, b) => a.x - b.x);
  const moved = new Map<string, number>();
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const prevX = moved.get(prev.id) ?? prev.x;
    if (Math.abs(cur.y - prev.y) < 600 && cur.x < prevX + GROUP_BLOCK_W) moved.set(cur.id, prevX + GROUP_BLOCK_W);
  }
  if (moved.size === 0) return graph;
  return { ...graph, groups: groups.map((g) => (moved.has(g.id) ? { ...g, x: moved.get(g.id)! } : g)) };
}

/**
 * Positions of a board that ships with the app (samples, lesson boards, handbook try-boards), spread so no two cards
 * touch at the biggest card size. Only positions change: no node, parameter or wire is touched. A sticky note moves
 * down with the card it sits nearest to, so it stays next to what it explains.
 */
export function relayoutShipped(board: Board): Board {
  const spread = spreadOverlaps(board.graph, STUDENT_CARD_METRICS, 24);
  const graph = spreadGroupBlocks(spread);
  if (graph === board.graph) return board;
  const dy = new Map(board.graph.nodes.map((n, i) => [n.id, graph.nodes[i]!.pos.y - n.pos.y]));
  const notes = board.notes?.map((note) => {
    const cx = note.pos.x + note.size.w / 2;
    const cy = note.pos.y + note.size.h / 2;
    let best: { d: number; dy: number } | null = null;
    for (const n of board.graph.nodes) {
      const d = Math.hypot(n.pos.x + 90 - cx, n.pos.y + 60 - cy);
      if (!best || d < best.d) best = { d, dy: dy.get(n.id) ?? 0 };
    }
    return best && best.dy !== 0 ? { ...note, pos: { x: note.pos.x, y: note.pos.y + best.dy } } : note;
  });
  return { ...board, graph, ...(notes ? { notes } : {}) };
}
