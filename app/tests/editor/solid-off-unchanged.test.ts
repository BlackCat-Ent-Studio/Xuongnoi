import { describe, expect, it } from 'vitest';
import type { Board } from '../../src/engine/types';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import baseline from './solid-off-baseline.json';
import { allBoards, runBoard } from './solid-helpers';

/**
 * Stability guard for the editor. With "Va chạm thật" off (every sample, lesson board and handbook try-board), the
 * whole entity state over 15 simulated seconds must hash exactly as it did before the switch existed.
 * The baseline file was recorded on the engine without the switch; do not re-record it to make this pass.
 */
const expected = baseline as Record<string, string>;
const boards = allBoards();
/** The shipped boards that are saved with "Vật lý thật" on (their machine is checked with the switch off here, and on in real-physics-on-hash). One id per line. */
export const SHIPS_WITH_REAL_PHYSICS = new Set([
  'handbook:container',
  'handbook:hitch',
  'sample:agv-shuttle',
  'sample:auto-arm',
  'sample:auto-door',
  'sample:robot-arm',
  'sample:robot-avoid',
  'sample:robot-line-follow',
  'sample:robot-square',
  'sample:sorting-factory',
  'sample:weight-sorter',
]);

/** The same board with the switch taken out: what it does under the plain rules. */
function plainRules(board: Board): Board {
  const { realPhysics: _on, ...others } = board.graph.settings ?? {};
  return { ...board, graph: { ...board.graph, settings: others } };
}

describe('Va chạm thật off keeps the old behaviour', () => {
  it('covers every sample, lesson and handbook board that was recorded', () => {
    expect(boards.map((b) => b.id).sort()).toEqual(Object.keys(expected).sort());
  });

  it('only the listed shipped boards turn "Vật lý thật" on, and none turns "Va chạm thật" on', () => {
    for (const b of boards) {
      expect(b.board.graph.settings?.solidBodies, b.id).not.toBe(true);
      expect(worldOptionsForGraph(b.board.graph) !== undefined, b.id).toBe(SHIPS_WITH_REAL_PHYSICS.has(b.id));
    }
  });

  for (const b of boards) {
    it(`${b.id}: same trajectory hash`, { timeout: 120_000 }, () => {
      const plain = plainRules(b.board);
      expect(worldOptionsForGraph(plain.graph), b.id).toBeUndefined();
      const res = runBoard(plain, undefined, { seconds: 15 });
      expect(`${res.hash}:${res.ticks}${res.error ? ':ERR' : ''}`).toBe(expected[b.id]);
    });
  }
});
