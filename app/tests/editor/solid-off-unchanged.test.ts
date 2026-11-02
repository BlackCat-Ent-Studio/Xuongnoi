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

describe('Va chạm thật off keeps the old behaviour', () => {
  it('covers every sample, lesson and handbook board that was recorded', () => {
    expect(boards.map((b) => b.id).sort()).toEqual(Object.keys(expected).sort());
  });

  it('none of the shipped boards turns the switch on', () => {
    for (const b of boards) expect(worldOptionsForGraph(b.board.graph), b.id).toBeUndefined();
  });

  for (const b of boards) {
    it(`${b.id}: same trajectory hash`, { timeout: 120_000 }, () => {
      const res = runBoard(b.board, worldOptionsForGraph(b.board.graph), { seconds: 15 });
      expect(`${res.hash}:${res.ticks}${res.error ? ':ERR' : ''}`).toBe(expected[b.id]);
    });
  }
});
