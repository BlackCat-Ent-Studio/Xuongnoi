import { beforeAll, describe, expect, it } from 'vitest';
import { buildClip, pasteClip } from '../../src/editor/clipboard';
import { createEditorState } from '../../src/editor/editor-state';
import { createHistory } from '../../src/editor/history';
import { parseBoard, serializeBoard } from '../../src/io';
import type { Board } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';

const emptyBoard = (): Board => ({ name: 't', mode: '2d-side', graph: { nodes: [], wires: [] } });

beforeAll(() => registerAllNodes());

/** stick -> character.moveX and key -> character.jump, plus one unrelated node. */
function wiredState() {
  const s = createEditorState(emptyBoard());
  const stick = s.addNode('stick', { x: 0, y: 0 })!;
  const key = s.addNode('key', { x: 0, y: 100 })!;
  const ch = s.addNode('character', { x: 300, y: 0 })!;
  const other = s.addNode('key', { x: 600, y: 600 })!;
  expect(s.connect({ node: stick, port: 'x' }, { node: ch, port: 'moveX' }).ok).toBe(true);
  expect(s.connect({ node: key, port: 'held' }, { node: ch, port: 'jump' }).ok).toBe(true);
  return { s, stick, key, ch, other };
}

describe('history', () => {
  it('undoes, redoes and drops redo on a new edit', () => {
    const h = createHistory<number>();
    h.record(1);
    h.record(2);
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBe(1);
    expect(h.undo(1)).toBeNull();
    expect(h.redo(1)).toBe(2);
    h.record(9);
    expect(h.canRedo()).toBe(false);
  });

  it('coalesces same-key edits inside the window only', () => {
    const h = createHistory<number>(100, 500);
    h.record(1, 'k', 0);
    h.record(2, 'k', 100);
    h.record(3, 'k', 200);
    h.record(4, 'k', 2000);
    expect(h.undo(5)).toBe(4);
    expect(h.undo(4)).toBe(1);
    expect(h.undo(1)).toBeNull();
  });

  it('caps the number of entries', () => {
    const h = createHistory<number>(3);
    for (let i = 0; i < 10; i++) h.record(i);
    expect(h.undo(10)).toBe(9);
    expect(h.undo(9)).toBe(8);
    expect(h.undo(8)).toBe(7);
    expect(h.undo(7)).toBeNull();
  });
});

describe('editor undo/redo', () => {
  it('undoes and redoes add, wire and delete', () => {
    const { s, stick } = wiredState();
    expect(s.getGraph().wires).toHaveLength(2);
    s.undo();
    expect(s.getGraph().wires).toHaveLength(1);
    s.undo();
    expect(s.getGraph().wires).toHaveLength(0);
    s.redo();
    expect(s.getGraph().wires).toHaveLength(1);
    s.select({ kind: 'node', id: stick });
    s.deleteSelection();
    expect(s.getGraph().nodes).toHaveLength(3);
    s.undo();
    expect(s.getGraph().nodes).toHaveLength(4);
  });

  it('records one entry per moveItems call', () => {
    const { s, ch, other } = wiredState();
    s.moveItems([
      { id: ch, pos: { x: 1, y: 1 } },
      { id: other, pos: { x: 2, y: 2 } },
    ]);
    s.undo();
    expect(s.getGraph().nodes.find((n) => n.id === ch)?.pos).toEqual({ x: 300, y: 0 });
    expect(s.getGraph().nodes.find((n) => n.id === other)?.pos).toEqual({ x: 600, y: 600 });
  });

  it('collapses rapid param edits and restores mode/name', () => {
    const s = createEditorState(emptyBoard());
    const id = s.addNode('character', { x: 0, y: 0 })!;
    const before = s.getGraph().nodes[0]!.params;
    s.setParam(id, 'speed', 1);
    s.setParam(id, 'speed', 2);
    s.setParam(id, 'speed', 3);
    s.undo();
    expect(s.getGraph().nodes[0]!.params).toEqual(before);
    s.setMode('3d');
    s.setName('abc');
    s.undo();
    expect(s.getBoard().name).toBe('t');
    s.undo();
    expect(s.getMode()).toBe('2d-side');
  });

  it('is disabled while playing and cleared when a board loads', () => {
    const { s } = wiredState();
    s.setPlaying(true);
    expect(s.canUndo()).toBe(false);
    expect(s.undo()).toBe(false);
    s.setPlaying(false);
    expect(s.canUndo()).toBe(true);
    s.loadBoard(emptyBoard());
    expect(s.canUndo()).toBe(false);
  });
});

describe('clipboard', () => {
  it('copies a wired group with new ids and keeps only internal wires', () => {
    const { s, stick, key, ch, other } = wiredState();
    const clip = buildClip(s.getBoard(), new Set([stick, ch]))!;
    expect(clip.graph.nodes).toHaveLength(2);
    expect(clip.graph.wires).toHaveLength(1);
    const res = pasteClip(s.getGraph(), [], clip, { x: 30, y: 30 });
    expect(res.graph.nodes).toHaveLength(6);
    expect(res.graph.wires).toHaveLength(3);
    const ids = new Set(res.graph.nodes.map((n) => n.id));
    expect(ids.size).toBe(6);
    const w = res.graph.wires[2]!;
    expect(res.newIds).toContain(w.from.node);
    expect(res.newIds).toContain(w.to.node);
    expect([stick, key, ch, other]).not.toContain(w.from.node);
    expect(new Set(res.graph.wires.map((x) => x.id)).size).toBe(3);
    const pastedStick = res.graph.nodes.find((n) => n.id === w.from.node)!;
    expect(pastedStick.pos).toEqual({ x: 30, y: 30 });
  });

  it('copy/paste/duplicate through the state with selection and undo', () => {
    const { s, stick, key, ch } = wiredState();
    s.selectMany([stick, key, ch]);
    expect(s.copy()).toBe(3);
    expect(s.paste()).toBe(3);
    expect(s.getGraph().nodes).toHaveLength(7);
    expect(s.getGraph().wires).toHaveLength(4);
    expect(s.getMulti().size).toBe(3);
    expect(s.duplicate()).toBe(3);
    expect(s.getGraph().nodes).toHaveLength(10);
    expect(s.getGraph().wires).toHaveLength(6);
    s.undo();
    expect(s.getGraph().nodes).toHaveLength(7);
    s.selectMany(s.getGraph().nodes.slice(4).map((n) => n.id));
    expect(s.deleteSelection()).toBe(true);
    expect(s.getGraph().nodes).toHaveLength(4);
    expect(s.getGraph().wires).toHaveLength(2);
  });

  it('paste with an empty clipboard adds nothing', () => {
    const s = createEditorState(emptyBoard());
    expect(s.paste()).toBe(0);
  });
});

describe('selection', () => {
  it('toggles items and deletes the whole selection in one undo step', () => {
    const { s, stick, key, other } = wiredState();
    s.select({ kind: 'node', id: stick });
    s.toggleSelect(key);
    s.toggleSelect(other);
    s.toggleSelect(key);
    expect([...s.getMulti()].sort()).toEqual([stick, other].sort());
    expect(s.getSelection()).toBeNull();
    s.deleteSelection();
    expect(s.getGraph().nodes).toHaveLength(2);
    s.undo();
    expect(s.getGraph().nodes).toHaveLength(4);
  });
});

describe('sticky notes', () => {
  it('adds, edits, moves, resizes and deletes with undo', () => {
    const s = createEditorState(emptyBoard());
    const id = s.addNote({ x: 10, y: 20 })!;
    expect(s.getNotes()).toHaveLength(1);
    s.updateNote(id, { text: 'xin chào' });
    s.updateNote(id, { color: 'green' });
    s.updateNote(id, { size: { w: 5000, h: 10 } });
    expect(s.getNotes()[0]).toMatchObject({ text: 'xin chào', color: 'green', size: { w: 800, h: 70 } });
    s.moveItems([{ id, pos: { x: 50, y: 60 } }]);
    expect(s.getNotes()[0]!.pos).toEqual({ x: 50, y: 60 });
    s.undo();
    expect(s.getNotes()[0]!.pos).toEqual({ x: 10, y: 20 });
    s.select({ kind: 'note', id });
    s.deleteSelection();
    expect(s.getNotes()).toHaveLength(0);
    expect(s.getBoard().notes).toBeUndefined();
    s.undo();
    expect(s.getNotes()).toHaveLength(1);
  });

  it('is read-only while playing', () => {
    const s = createEditorState(emptyBoard());
    s.setPlaying(true);
    expect(s.addNote({ x: 0, y: 0 })).toBeNull();
  });

  it('round-trips through save/load and old files still load', () => {
    const s = createEditorState(emptyBoard());
    const id = s.addNote({ x: 10, y: 20 })!;
    s.updateNote(id, { text: 'ghi nhớ', color: 'pink' });
    const res = parseBoard(serializeBoard(s.getBoard()));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.board.notes).toEqual(s.getNotes());

    const old = parseBoard(serializeBoard(emptyBoard()));
    expect(old.ok && old.board.notes).toBeFalsy();
    expect(serializeBoard(emptyBoard())).not.toContain('notes');
  });

  it('rejects malformed notes and sanitises odd values', () => {
    const base = JSON.parse(serializeBoard(emptyBoard()));
    const bad = (notes: unknown) => parseBoard(JSON.stringify({ ...base, notes })).ok;
    expect(bad('x')).toBe(false);
    expect(bad([{ id: 'a' }])).toBe(false);
    const note = { id: 'a', text: 't', color: 'yellow', pos: { x: 0, y: 0 }, size: { w: 100, h: 100 } };
    expect(bad([note, note])).toBe(false);
    expect(bad([{ ...note, pos: { x: 'a', y: 0 } }])).toBe(false);
    const res = parseBoard(JSON.stringify({ ...base, notes: [{ ...note, color: 'neon', size: { w: 1, h: 99999 } }] }));
    expect(res.ok && res.board.notes?.[0]).toMatchObject({ color: 'yellow', size: { w: 120, h: 600 } });
  });

  it('copies notes along with nodes', () => {
    const s = createEditorState(emptyBoard());
    const id = s.addNote({ x: 0, y: 0 })!;
    s.updateNote(id, { text: 'hi' });
    s.select({ kind: 'note', id });
    expect(s.duplicate()).toBe(1);
    expect(s.getNotes()).toHaveLength(2);
    expect(s.getNotes()[1]).toMatchObject({ text: 'hi', pos: { x: 30, y: 30 } });
    expect(s.getNotes()[1]!.id).not.toBe(id);
  });
});
