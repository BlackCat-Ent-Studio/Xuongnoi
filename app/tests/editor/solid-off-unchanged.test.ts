import { describe, expect, it } from 'vitest';
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
/** Boards that ship with "Vật lý thật" on on purpose; their hash is recorded with that physics. One id per line. */
const SHIPS_REAL_PHYSICS = new Set([
  'sample:robot-avoid',
  'sample:robot-line-follow',
  'sample:robot-square',
]);

describe('Va chạm thật off keeps the old behaviour', () => {
  it('covers every sample, lesson and handbook board that was recorded', () => {
    expect(boards.map((b) => b.id).sort()).toEqual(Object.keys(expected).sort());
  });

  it('no shipped board turns "Va chạm thật" on, and only the listed ones turn "Vật lý thật" on', () => {
    for (const b of boards) {
      const options = worldOptionsForGraph(b.board.graph);
      if (SHIPS_REAL_PHYSICS.has(b.id)) expect(options, b.id).toEqual({ realPhysics: true });
      else expect(options, b.id).toBeUndefined();
    }
  });

  for (const b of boards) {
    it(`${b.id}: same trajectory hash`, { timeout: 120_000 }, () => {
      const res = runBoard(b.board, worldOptionsForGraph(b.board.graph), { seconds: 15 });
      expect(`${res.hash}:${res.ticks}${res.error ? ':ERR' : ''}`).toBe(expected[b.id]);
    });
  }
});
