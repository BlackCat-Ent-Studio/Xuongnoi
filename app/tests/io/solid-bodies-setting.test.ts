import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createEmptyBoard, parseBoard, serializeBoard } from '../../src/io';
import { clearAutosave, flushAutosave, loadAutosave, scheduleAutosave } from '../../src/io/autosave';
import { duplicateGame, getCurrentGameId, loadGame, saveCurrentGame } from '../../src/io/game-library';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import type { Board } from '../../src/engine/types';

function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
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

const touched = (b: Board): Board => ({ ...b, name: 'Game', graph: { ...b.graph, nodes: [{ id: 'n1', kind: 'counter', params: {}, pos: { x: 0, y: 0 } }] } });
const oldFile = (extraGraph: Record<string, unknown> = {}): string =>
  JSON.stringify({ format_version: 1, name: 'Cũ', mode: '3d', graph: { nodes: [], wires: [], ...extraGraph } });

describe('Va chạm thật setting: save and load', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', fakeStorage());
  });
  afterEach(() => {
    clearAutosave();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('a new empty board is on, in every mode', () => {
    for (const mode of ['2d-side', '2d-top', '3d'] as const) {
      expect(createEmptyBoard(mode).graph.settings).toEqual({ solidBodies: true });
      expect(worldOptionsForGraph(createEmptyBoard(mode).graph)).toMatchObject({ solidBodies: true });
    }
  });

  it('a file without the field loads off and gives the plain world rules', () => {
    const res = parseBoard(oldFile());
    expect(res.ok && res.board.graph.settings).toBeUndefined();
    expect(res.ok && worldOptionsForGraph(res.board.graph)).toBeUndefined();
  });

  it('anything but an explicit true loads off', () => {
    for (const settings of [{}, { solidBodies: false }, { solidBodies: 'true' }, { solidBodies: 1 }, 'on', null, []]) {
      const res = parseBoard(oldFile({ settings }));
      expect(res.ok && res.board.graph.settings, JSON.stringify(settings)).toBeUndefined();
    }
  });

  it('on survives serialize and parse; off writes nothing, so old files stay byte-identical', () => {
    const on = createEmptyBoard('3d');
    const back = parseBoard(serializeBoard(on));
    expect(back.ok && back.board.graph.settings).toEqual({ solidBodies: true });
    expect(serializeBoard(on)).toContain('"solidBodies": true');

    const off = parseBoard(oldFile());
    if (!off.ok) throw new Error('old file must load');
    expect(serializeBoard(off.board)).not.toContain('settings');
  });

  it('the editor toggles it, marks the board changed, undoes it and refuses while playing', () => {
    const off = parseBoard(oldFile());
    if (!off.ok) throw new Error('old file must load');
    const s = createEditorState(touched(off.board));
    const seen: string[] = [];
    s.subscribe((k) => seen.push(k));
    expect(s.getSolidBodies()).toBe(false);
    s.setSolidBodies(true);
    expect(s.getSolidBodies()).toBe(true);
    expect(seen).toContain('graph');
    expect(s.getGraph().settings).toEqual({ solidBodies: true });
    s.setSolidBodies(true);
    s.undo();
    expect(s.getSolidBodies()).toBe(false);
    expect(s.getGraph().settings).toBeUndefined();
    s.redo();
    expect(s.getSolidBodies()).toBe(true);
    s.setPlaying(true);
    s.setSolidBodies(false);
    expect(s.getSolidBodies()).toBe(true);
    s.setPlaying(false);
    s.setSolidBodies(false);
    expect(s.getGraph().settings).toBeUndefined();
  });

  it('other edits keep the setting', () => {
    const s = createEditorState(touched(createEmptyBoard('3d')));
    const id = s.addNode('counter', { x: 10, y: 10 });
    expect(id).not.toBeNull();
    s.setParam(id!, 'start', 3);
    s.setNodePos(id!, { x: 50, y: 50 });
    s.setMode('2d-top');
    s.select({ kind: 'node', id: id! });
    s.deleteSelection();
    expect(s.getSolidBodies()).toBe(true);
  });

  it('the autosave and the game library keep it, and a copy keeps it', () => {
    const board = touched(createEmptyBoard('3d'));
    scheduleAutosave(board);
    flushAutosave();
    expect(loadAutosave()?.graph.settings).toEqual({ solidBodies: true });
    const saved = saveCurrentGame(board);
    expect(saved?.ok).toBe(true);
    const id = getCurrentGameId()!;
    const loaded = loadGame(id);
    expect(loaded.ok && loaded.board.graph.settings).toEqual({ solidBodies: true });
    const copy = duplicateGame(id);
    expect(copy.ok).toBe(true);
    const copied = copy.ok ? loadGame(copy.id) : null;
    expect(copied?.ok && copied.board.graph.settings).toEqual({ solidBodies: true });
  });

  it('a game saved with it off stays off through the library', () => {
    const off = parseBoard(oldFile());
    if (!off.ok) throw new Error('old file must load');
    const board = touched(off.board);
    expect(saveCurrentGame(board)?.ok).toBe(true);
    const loaded = loadGame(getCurrentGameId()!);
    expect(loaded.ok && loaded.board.graph.settings).toBeUndefined();
  });
});
