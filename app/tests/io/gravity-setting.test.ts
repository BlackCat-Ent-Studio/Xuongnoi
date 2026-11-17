import { describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { DEFAULT_GRAVITY, MAX_GRAVITY, cleanGravity } from '../../src/engine/types';
import { createEmptyBoard, parseBoard, serializeBoard } from '../../src/io';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { REAL_PHYSICS_PAGE } from '../../src/handbook/topic-real-physics';
import { tryCrateTipping } from '../../src/handbook/boards-real-physics';

const file = (settings: Record<string, unknown>): string =>
  JSON.stringify({ format_version: 1, name: 'G', mode: '3d', graph: { nodes: [], wires: [], settings } });

describe('gravity setting: save, load, the editor row and the world options', () => {
  it('9.81 by default; an old file without the field reads as 9.81 and is written back without it', () => {
    expect(DEFAULT_GRAVITY).toBe(9.81);
    const res = parseBoard(file({ realPhysics: true }));
    if (!res.ok) throw new Error('file must load');
    expect(res.board.graph.settings).toEqual({ realPhysics: true, wireRule: true });
    expect(worldOptionsForGraph(res.board.graph)).toEqual({ realPhysics: true });
    expect(serializeBoard(res.board)).not.toContain('gravity');
    const state = createEditorState(res.board);
    expect(state.getGravity()).toBe(9.81);
  });

  it('a number the maker set survives save and load and reaches the world options', () => {
    const res = parseBoard(file({ realPhysics: true, gravity: 1.62 }));
    if (!res.ok) throw new Error('file must load');
    expect(res.board.graph.settings).toEqual({ realPhysics: true, gravity: 1.62, wireRule: true });
    expect(worldOptionsForGraph(res.board.graph)).toEqual({ realPhysics: true, gravity: 1.62 });
    const back = parseBoard(serializeBoard(res.board));
    expect(back.ok && back.board.graph.settings?.gravity).toBe(1.62);
  });

  it('zero is a real value (floating), and a bad value reads as 9.81', () => {
    const zero = parseBoard(file({ realPhysics: true, gravity: 0 }));
    expect(zero.ok && zero.board.graph.settings?.gravity).toBe(0);
    for (const bad of [-1, 101, 'strong', null, Number.NaN, true]) {
      const res = parseBoard(file({ realPhysics: true, gravity: bad }));
      expect(res.ok && res.board.graph.settings, String(bad)).toEqual({ realPhysics: true, wireRule: true });
    }
    expect(cleanGravity(MAX_GRAVITY)).toBe(MAX_GRAVITY);
    expect(cleanGravity(MAX_GRAVITY + 0.01)).toBeUndefined();
  });

  it('the gravity only goes to the world while the switch is on', () => {
    const res = parseBoard(file({ gravity: 3, solidBodies: true }));
    if (!res.ok) throw new Error('file must load');
    expect(worldOptionsForGraph(res.board.graph)).toEqual({ solidBodies: true, frontCarryAll: true });
  });

  it('the editor sets it, undoes it, refuses while playing and drops the field at 9.81', () => {
    const s = createEditorState(createEmptyBoard('3d'));
    s.setRealPhysics(true);
    s.setGravity(1.62);
    expect(s.getGravity()).toBe(1.62);
    expect(s.getGraph().settings).toEqual({ solidBodies: true, realPhysics: true, gravity: 1.62, wireRule: true });
    s.undo();
    expect(s.getGravity()).toBe(9.81);
    s.redo();
    s.setGravity(Number.NaN);
    s.setGravity(500);
    s.setGravity(-2);
    expect(s.getGravity()).toBe(1.62);
    s.setPlaying(true);
    s.setGravity(3);
    expect(s.getGravity()).toBe(1.62);
    s.setPlaying(false);
    s.setGravity(9.81);
    expect(s.getGraph().settings).toEqual({ solidBodies: true, realPhysics: true, wireRule: true });
    expect(worldOptionsForGraph(s.getGraph())).toEqual({ solidBodies: true, frontCarryAll: true, realPhysics: true });
  });

  it('the handbook explains the crates, the gravity row and the ready-made board', () => {
    const text = REAL_PHYSICS_PAGE.blocks.flatMap((b) => [b.heading, ...b.items]).join(' ');
    for (const needle of ['Trọng lực (m/s²)', '9,81', '1,62', '17,8 N', '130,8 N', '49,05 N', 't = căn(2 × h ÷ g)', '2,46 giây', 'Thử ngay', 'ô "Độ trượt" không dùng nữa']) {
      expect(text, needle).toContain(needle);
    }
    for (const b of REAL_PHYSICS_PAGE.blocks) for (const i of b.items) expect(i.trim()).not.toBe('');
    expect(REAL_PHYSICS_PAGE.tryBoard).toBe(tryCrateTipping);
    const board = tryCrateTipping();
    expect(board.graph.settings?.realPhysics).toBe(true);
    expect(board.graph.nodes.filter((n) => n.kind === 'item')).toHaveLength(2);
  });
});
