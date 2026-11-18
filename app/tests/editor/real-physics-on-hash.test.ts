import { beforeAll, describe, expect, it } from 'vitest';
import type { Board } from '../../src/engine/types';
import { tryCrateTipping } from '../../src/handbook/boards-real-physics';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import baseline from './real-physics-on-baseline.json';
import { allBoards, runBoard } from './solid-helpers';

/**
 * Companion of the "off keeps the old behaviour" guard: the same 15 simulated seconds, but with "Vật lý thật" on and the
 * crate engine loaded, for every shipped board that has loose items (the only boards the engine changes). The hash covers
 * the whole entity state, rotation included, so a changed engine setting, a changed engine version or a changed order of
 * bodies shows up here. Same board, same numbers on every run is also checked directly.
 * The baseline file was recorded once with the engine pinned in package.json; re-record only for a deliberate change.
 */
const expected = baseline as Record<string, string>;
const hasLooseItems = (b: Board): boolean => b.graph.nodes.some((n) => n.kind === 'item' || n.kind === 'spawner');
const boards = [
  // Boards with loose items, plus every board that ships with the switch on (robots have no crates but drive by traction).
  ...allBoards().filter((b) => hasLooseItems(b.board) || b.board.graph.settings?.realPhysics === true),
  { id: 'topic:real-physics', group: 'handbook' as const, board: tryCrateTipping() },
];

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const onOptions = (b: Board) => ({ ...(worldOptionsForGraph({ ...b.graph, settings: { ...b.graph.settings, realPhysics: true } }) ?? {}), rapier });

describe('Vật lý thật on: boards with loose items play the same way every time', () => {
  it('covers every board with loose items that was recorded', () => {
    expect(boards.map((b) => b.id).sort()).toEqual(Object.keys(expected).sort());
  });

  for (const b of boards) {
    it(`${b.id}: same trajectory hash`, { timeout: 120_000 }, () => {
      const res = runBoard(b.board, onOptions(b.board), { seconds: 15 });
      res.world?.dispose?.();
      expect(res.error).toBeNull();
      expect(`${res.hash}:${res.ticks}`).toBe(expected[b.id]);
    });
  }

  it('two runs of the same board in one process give the same hash, and a new world does not remember the old one', () => {
    const b = boards.find((x) => x.id === 'topic:real-physics')!;
    const first = runBoard(b.board, onOptions(b.board), { seconds: 8 });
    const second = runBoard(b.board, onOptions(b.board), { seconds: 8 });
    expect(first.error).toBeNull();
    expect(second.hash).toBe(first.hash);
    first.world?.dispose?.();
    second.world?.dispose?.();
  });
});
