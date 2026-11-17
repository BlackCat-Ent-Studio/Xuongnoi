import { describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createEmptyBoard, parseBoard, serializeBoard } from '../../src/io';
import { REAL_PHYSICS_PAGE, REAL_PHYSICS_TOPIC } from '../../src/handbook/topic-real-physics';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';

const oldFile = (extraGraph: Record<string, unknown> = {}): string =>
  JSON.stringify({ format_version: 1, name: 'Cũ', mode: '3d', graph: { nodes: [], wires: [], ...extraGraph } });

describe('Vật lý thật setting: save, load and the editor switch', () => {
  it('a new board and an old file both start with it off', () => {
    expect(createEmptyBoard('3d').graph.settings).toEqual({ solidBodies: true, wireRule: true });
    const res = parseBoard(oldFile());
    expect(res.ok && res.board.graph.settings).toEqual({ wireRule: true });
    expect(res.ok && worldOptionsForGraph(res.board.graph)).toBeUndefined();
  });

  it('anything but an explicit true loads off', () => {
    for (const settings of [{ realPhysics: false }, { realPhysics: 'true' }, { realPhysics: 1 }]) {
      const res = parseBoard(oldFile({ settings }));
      expect(res.ok && res.board.graph.settings, JSON.stringify(settings)).toEqual({ wireRule: true });
    }
  });

  it('on survives serialize and parse and reaches the world options; off never writes the field', () => {
    const res = parseBoard(oldFile({ settings: { realPhysics: true } }));
    if (!res.ok) throw new Error('file must load');
    expect(res.board.graph.settings).toEqual({ realPhysics: true, wireRule: true });
    expect(worldOptionsForGraph(res.board.graph)).toEqual({ realPhysics: true });
    const back = parseBoard(serializeBoard(res.board));
    expect(back.ok && back.board.graph.settings).toEqual({ realPhysics: true, wireRule: true });
    const plain = parseBoard(oldFile());
    if (!plain.ok) throw new Error('old file must load');
    expect(serializeBoard(plain.board)).not.toContain('realPhysics');
  });

  it('the editor toggles it independently of Va chạm thật, undoes it and refuses while playing', () => {
    const s = createEditorState(createEmptyBoard('3d'));
    expect(s.getRealPhysics()).toBe(false);
    s.setRealPhysics(true);
    expect(s.getRealPhysics()).toBe(true);
    expect(s.getSolidBodies()).toBe(true);
    expect(s.getGraph().settings).toEqual({ solidBodies: true, realPhysics: true, wireRule: true });
    s.undo();
    expect(s.getRealPhysics()).toBe(false);
    s.redo();
    s.setPlaying(true);
    s.setRealPhysics(false);
    expect(s.getRealPhysics()).toBe(true);
    s.setPlaying(false);
    s.setSolidBodies(false);
    expect(s.getRealPhysics()).toBe(true);
    expect(worldOptionsForGraph(s.getGraph())).toEqual({ realPhysics: true });
    s.setRealPhysics(false);
    expect(s.getGraph().settings).toEqual({ wireRule: true });
  });

  it('has a handbook page with plain text and the three worked examples', () => {
    expect(REAL_PHYSICS_TOPIC).toBe(REAL_PHYSICS_PAGE.id);
    const text = REAL_PHYSICS_PAGE.blocks.flatMap((b) => [b.heading, ...b.items]).join(' ');
    for (const needle of ['a = 12 ÷ 2 = 6', 'a = 12 ÷ 3 = 4', '16,9 rad/s²', '0,064 m', '0,625 m']) expect(text).toContain(needle);
    for (const b of REAL_PHYSICS_PAGE.blocks) for (const i of b.items) expect(i.trim()).not.toBe('');
  });
});
