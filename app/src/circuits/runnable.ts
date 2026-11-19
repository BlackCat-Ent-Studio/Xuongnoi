import type { Board, Graph } from '../engine/types';
import { expandBoard } from './expand';

/**
 * The graph to hand to the engine for this board. A board without circuits gives its own graph, the very same object, so
 * nothing about how it runs can differ. A board with circuits gives the flat graph of `expandBoard` (which may throw a
 * `CircuitError`). Everything that runs a board goes through here.
 */
export function runnableGraph(board: Pick<Board, 'graph' | 'circuits'>): Graph {
  return board.circuits && board.circuits.length > 0 ? expandBoard(board).graph : board.graph;
}
