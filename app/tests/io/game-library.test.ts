import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTOSAVE_KEY,
  clearAutosave,
  flushAutosave,
  scheduleAutosave,
  takeAutosaveProblem,
} from '../../src/io/autosave';
import {
  LIBRARY_CURRENT_KEY,
  LIBRARY_GAME_PREFIX,
  LIBRARY_INDEX_KEY,
  deleteGame,
  duplicateGame,
  ensureLibrary,
  getCurrentGameId,
  listGames,
  loadGame,
  renameGame,
  saveCurrentGame,
  setCurrentGameId,
} from '../../src/io/game-library';
import { createEmptyBoard, serializeBoard } from '../../src/io';
import { STASH_KEY, takeStash, writeStash } from '../../src/tutorial/storage';
import type { Board } from '../../src/engine/types';

function fakeStorage(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

/** A board with one node so it counts as touched. */
function game(name: string): Board {
  const b = createEmptyBoard('2d-side');
  return { ...b, name, graph: { nodes: [{ id: 'n1', kind: 'counter', params: {}, pos: { x: 0, y: 0 } }], wires: [] } };
}

describe('game library', () => {
  let storage: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T10:00:00Z'));
    storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    clearAutosave();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const tick = (ms = 1000): void => void vi.advanceTimersByTime(ms);

  describe('create, update, read', () => {
    it('creates an entry for a touched board and makes it current', () => {
      const res = saveCurrentGame(game('A'));
      expect(res?.ok).toBe(true);
      const list = listGames();
      expect(list).toHaveLength(1);
      expect(list[0]?.name).toBe('A');
      expect(getCurrentGameId()).toBe(list[0]?.id);
      const loaded = loadGame(list[0]!.id);
      expect(loaded.ok && loaded.board.name).toBe('A');
    });

    it('stores each game under its own key in the normal save format', () => {
      const board = game('A');
      saveCurrentGame(board);
      const id = listGames()[0]!.id;
      expect(storage.data.get(LIBRARY_GAME_PREFIX + id)).toBe(serializeBoard(board));
    });

    it('updates the current entry instead of adding another', () => {
      saveCurrentGame(game('A'));
      tick();
      saveCurrentGame(game('A2'));
      const list = listGames();
      expect(list).toHaveLength(1);
      expect(list[0]?.name).toBe('A2');
    });

    it('does not create an entry for an untouched empty board', () => {
      expect(saveCurrentGame(createEmptyBoard('3d'))).toBeNull();
      expect(listGames()).toEqual([]);
    });

    it('creates an entry for an empty board that was renamed', () => {
      expect(saveCurrentGame({ ...createEmptyBoard('3d'), name: 'Của tôi' })?.ok).toBe(true);
      expect(listGames()).toHaveLength(1);
    });

    it('starts a new entry after the current id was cleared (new game)', () => {
      saveCurrentGame(game('A'));
      setCurrentGameId(null);
      tick();
      saveCurrentGame(game('B'));
      expect(listGames().map((e) => e.name)).toEqual(['B', 'A']);
      expect(getCurrentGameId()).toBe(listGames()[0]?.id);
    });

    it('treats a current id that no longer exists as no current game', () => {
      storage.setItem(LIBRARY_CURRENT_KEY, 'ghost');
      expect(getCurrentGameId()).toBeNull();
      saveCurrentGame(game('A'));
      expect(listGames()).toHaveLength(1);
    });

    it('reports a missing game', () => {
      const res = loadGame('nope');
      expect(res.ok).toBe(false);
    });

    it('reports a corrupt stored game and keeps the others usable', () => {
      saveCurrentGame(game('A'));
      const id = listGames()[0]!.id;
      storage.setItem(LIBRARY_GAME_PREFIX + id, '{broken');
      expect(loadGame(id).ok).toBe(false);
    });

    it('is a no-op without localStorage', () => {
      vi.unstubAllGlobals();
      expect(saveCurrentGame(game('A'))).toBeNull();
      expect(listGames()).toEqual([]);
      expect(getCurrentGameId()).toBeNull();
      expect(loadGame('x').ok).toBe(false);
      expect(deleteGame('x').ok).toBe(false);
    });
  });

  describe('ordering', () => {
    it('lists the most recently changed first', () => {
      saveCurrentGame(game('A'));
      tick(5000);
      setCurrentGameId(null);
      saveCurrentGame(game('B'));
      tick(5000);
      setCurrentGameId(null);
      saveCurrentGame(game('C'));
      expect(listGames().map((e) => e.name)).toEqual(['C', 'B', 'A']);
      tick(5000);
      const a = listGames().find((e) => e.name === 'A')!;
      renameGame(a.id, 'A bis');
      expect(listGames().map((e) => e.name)).toEqual(['A bis', 'C', 'B']);
    });

    it('breaks ties by putting the latest write first', () => {
      saveCurrentGame(game('A'));
      setCurrentGameId(null);
      saveCurrentGame(game('B'));
      expect(listGames().map((e) => e.name)).toEqual(['B', 'A']);
    });
  });

  describe('rename, duplicate, delete', () => {
    it('renames the stored game and its index entry', () => {
      saveCurrentGame(game('A'));
      const id = listGames()[0]!.id;
      expect(renameGame(id, '  Game mới của tôi  ').ok).toBe(true);
      expect(listGames()[0]?.name).toBe('Game mới của tôi');
      const loaded = loadGame(id);
      expect(loaded.ok && loaded.board.name).toBe('Game mới của tôi');
    });

    it('rejects an empty name', () => {
      saveCurrentGame(game('A'));
      const res = renameGame(listGames()[0]!.id, '   ');
      expect(res.ok).toBe(false);
      expect(listGames()[0]?.name).toBe('A');
    });

    it('duplicates into a separate entry that is not current', () => {
      saveCurrentGame(game('A'));
      const id = listGames()[0]!.id;
      tick();
      const res = duplicateGame(id);
      expect(res.ok).toBe(true);
      const list = listGames();
      expect(list).toHaveLength(2);
      expect(list[0]?.name).toBe('A (bản sao)');
      expect(getCurrentGameId()).toBe(id);
      // The copy is independent of the original.
      renameGame(id, 'Gốc');
      expect(listGames().map((e) => e.name).sort()).toEqual(['A (bản sao)', 'Gốc']);
    });

    it('deletes an entry and its data', () => {
      saveCurrentGame(game('A'));
      const id = listGames()[0]!.id;
      expect(deleteGame(id).ok).toBe(true);
      expect(listGames()).toEqual([]);
      expect(storage.data.has(LIBRARY_GAME_PREFIX + id)).toBe(false);
    });

    it('clears the current id when the current game is deleted, and the next edit makes a new entry', () => {
      saveCurrentGame(game('A'));
      const id = listGames()[0]!.id;
      deleteGame(id);
      expect(getCurrentGameId()).toBeNull();
      saveCurrentGame(game('A'));
      expect(listGames()).toHaveLength(1);
      expect(listGames()[0]?.id).not.toBe(id);
    });

    it('keeps the current id when another game is deleted', () => {
      saveCurrentGame(game('A'));
      const a = listGames()[0]!.id;
      setCurrentGameId(null);
      saveCurrentGame(game('B'));
      const b = getCurrentGameId();
      deleteGame(a);
      expect(getCurrentGameId()).toBe(b);
    });
  });

  describe('migration of the old autosave', () => {
    it('turns the existing autosave into one current entry on first run', () => {
      const board = game('Cũ');
      storage.setItem(AUTOSAVE_KEY, serializeBoard(board));
      ensureLibrary(board);
      const list = listGames();
      expect(list.map((e) => e.name)).toEqual(['Cũ']);
      expect(getCurrentGameId()).toBe(list[0]?.id);
      // The old key stays for backward compatibility.
      expect(storage.data.get(AUTOSAVE_KEY)).toBe(serializeBoard(board));
    });

    it('runs only once', () => {
      ensureLibrary(game('Cũ'));
      deleteGame(listGames()[0]!.id);
      ensureLibrary(game('Cũ'));
      expect(listGames()).toEqual([]);
    });

    it('creates no entry for a first run without an autosave or with an untouched board', () => {
      ensureLibrary(null);
      expect(listGames()).toEqual([]);
      expect(storage.data.get(LIBRARY_INDEX_KEY)).toBe('[]');
      storage.clear();
      ensureLibrary(createEmptyBoard('2d-side'));
      expect(listGames()).toEqual([]);
    });
  });

  describe('damaged index', () => {
    it('rebuilds the list from the game keys', () => {
      saveCurrentGame(game('A'));
      setCurrentGameId(null);
      saveCurrentGame(game('B'));
      storage.setItem(LIBRARY_INDEX_KEY, 'not json');
      expect(listGames().map((e) => e.name).sort()).toEqual(['A', 'B']);
    });

    it('drops index rows with a wrong shape', () => {
      storage.setItem(LIBRARY_INDEX_KEY, JSON.stringify([{ id: 'x' }, { id: 'y', name: 'Y', updatedAt: 5 }]));
      expect(listGames().map((e) => e.id)).toEqual(['y']);
    });
  });

  describe('storage quota', () => {
    it('returns a Vietnamese error and leaves no half-created entry', () => {
      saveCurrentGame(game('A'));
      setCurrentGameId(null);
      const before = new Map(storage.data);
      storage.setItem = () => {
        throw new Error('QuotaExceededError');
      };
      const res = saveCurrentGame(game('B'));
      expect(res && !res.ok && res.error).toContain('Kho mô phỏng');
      expect([...storage.data.keys()].sort()).toEqual([...before.keys()].sort());
      expect(listGames().map((e) => e.name)).toEqual(['A']);
    });

    it('fails duplicate and rename with a message instead of throwing', () => {
      saveCurrentGame(game('A'));
      const id = listGames()[0]!.id;
      storage.setItem = () => {
        throw new Error('QuotaExceededError');
      };
      const dup = duplicateGame(id);
      expect(dup.ok).toBe(false);
      const ren = renameGame(id, 'B');
      expect(ren.ok).toBe(false);
      expect(listGames()).toHaveLength(1);
    });
  });

  describe('autosave integration', () => {
    it('writes the old key and the current library entry', () => {
      scheduleAutosave(game('A'));
      tick();
      expect(storage.data.has(AUTOSAVE_KEY)).toBe(true);
      expect(listGames().map((e) => e.name)).toEqual(['A']);
      tick(2000);
      scheduleAutosave(game('A edited'));
      tick();
      expect(listGames().map((e) => e.name)).toEqual(['A edited']);
      expect(storage.data.get(AUTOSAVE_KEY)).toBe(serializeBoard(game('A edited')));
    });

    it('keeps one entry per game across a new game', () => {
      scheduleAutosave(game('A'));
      flushAutosave();
      setCurrentGameId(null); // "Tạo game mới"
      scheduleAutosave(createEmptyBoard('2d-side'), { library: false });
      flushAutosave();
      expect(listGames().map((e) => e.name)).toEqual(['A']);
      scheduleAutosave(game('B'));
      flushAutosave();
      expect(listGames().map((e) => e.name).sort()).toEqual(['A', 'B']);
    });

    it('does not create or re-stamp an entry for a freshly loaded board', () => {
      scheduleAutosave(game('A'));
      flushAutosave();
      const stamp = listGames()[0]!.updatedAt;
      tick(60_000);
      setCurrentGameId(listGames()[0]!.id);
      scheduleAutosave(game('A'), { library: false });
      flushAutosave();
      expect(listGames()[0]?.updatedAt).toBe(stamp);
      setCurrentGameId(null);
      scheduleAutosave(game('Mẫu'), { library: false });
      flushAutosave();
      expect(listGames().map((e) => e.name)).toEqual(['A']);
    });

    it('does not create an entry for an untouched new game', () => {
      scheduleAutosave(createEmptyBoard('3d'));
      flushAutosave();
      expect(listGames()).toEqual([]);
      expect(storage.data.has(AUTOSAVE_KEY)).toBe(true);
    });

    it('reports a quota failure of the library through the autosave problem', () => {
      const realSet = storage.setItem;
      storage.setItem = (k, v) => {
        if (k.startsWith('xuong-noi:library')) throw new Error('QuotaExceededError');
        realSet(k, v);
      };
      scheduleAutosave(game('A'));
      expect(() => tick()).not.toThrow();
      expect(takeAutosaveProblem()).toContain('Kho mô phỏng');
      expect(storage.data.has(AUTOSAVE_KEY)).toBe(true);
    });

    it('clearAutosave drops the old key and any write still waiting', () => {
      scheduleAutosave(game('A'));
      clearAutosave();
      tick();
      expect(storage.data.has(AUTOSAVE_KEY)).toBe(false);
      expect(listGames()).toEqual([]);
    });
  });

  describe('lesson boards stay out of the library', () => {
    it('stashing the learner board and restoring it leaves the library untouched', () => {
      scheduleAutosave(game('Của học viên'));
      flushAutosave();
      const before = new Map(storage.data);
      writeStash(game('Của học viên'));
      expect(storage.data.has(STASH_KEY)).toBe(true);
      expect(takeStash()?.name).toBe('Của học viên');
      expect(listGames().map((e) => e.name)).toEqual(['Của học viên']);
      expect([...storage.data.keys()].sort()).toEqual([...before.keys()].sort());
    });
  });
});
