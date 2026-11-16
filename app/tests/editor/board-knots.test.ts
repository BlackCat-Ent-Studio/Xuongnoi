import { describe, expect, it } from 'vitest';
import { knotKey, pruneGraphKnots, sanitizeKnots, wireIdOfKnotKey, withKnots } from '../../src/editor/graph/board-knots';
import { settleDrop } from '../../src/editor/graph/drop-settle';
import { createEditorState } from '../../src/editor/editor-state';
import type { Board } from '../../src/engine/types';
import { listAllSamples, parseBoard, serializeBoard } from '../../src/io';
import { addKnot, emptyKnots } from '../../src/puzzle/ui/wire-knots';
import { fixture } from './groups-fixture';

function load(text: string): Board {
  const res = parseBoard(text);
  if (!res.ok) throw new Error(res.error);
  return res.board;
}

const withOneKnot = (): Board => {
  const graph = withKnots(fixture(), addKnot(emptyKnots(), 'w1', { x: 160, y: 24 }, 0).book);
  return { name: 'k', mode: '3d', graph };
};

describe('knots in save files', () => {
  it('round-trips knots with the board', () => {
    const b = withOneKnot();
    const loaded = load(serializeBoard(b));
    expect(loaded.graph.knots).toEqual(b.graph.knots);
    // Loading adds the usual migrations; after that the text is stable and keeps the knots.
    expect(serializeBoard(load(serializeBoard(loaded)))).toBe(serializeBoard(loaded));
  });

  it('writes no knots key for a board without knots, so old files stay byte-identical', () => {
    const plain: Board = { name: 'p', mode: '3d', graph: fixture() };
    expect(serializeBoard(plain)).not.toContain('knots');
    const emptied = withKnots(withOneKnot().graph, emptyKnots());
    expect('knots' in emptied).toBe(false);
    expect(serializeBoard({ ...plain, graph: emptied })).toBe(serializeBoard(plain));
  });

  it('every sample loads and saves exactly as before: no knots key appears', () => {
    for (const s of listAllSamples()) {
      const text = serializeBoard(s.board);
      expect(text).not.toContain('"knots"');
      expect(serializeBoard(load(text))).toBe(text);
    }
  });

  it('drops knots that point at unknown wires or knots instead of failing the load', () => {
    const raw = JSON.parse(serializeBoard(withOneKnot()));
    raw.graph.knots.chain.ghost = ['k1'];
    raw.graph.knots.chain.w2 = ['nope', 7];
    raw.graph.knots.pos.bad = { x: 'a', y: 1 };
    raw.graph.knots.pos.far = { x: 1e12, y: 0 };
    const loaded = load(JSON.stringify(raw));
    expect(Object.keys(loaded.graph.knots!.chain)).toEqual(['w1']);
    expect(Object.keys(loaded.graph.knots!.pos)).toEqual(['k1']);
  });

  it('ignores a knots field of the wrong shape', () => {
    for (const junk of [null, 5, 'x', [], { pos: 1, chain: {} }, { pos: {}, chain: [] }]) {
      expect(sanitizeKnots(junk, new Set(['w1']))).toBeUndefined();
    }
    const raw = JSON.parse(serializeBoard(withOneKnot()));
    raw.graph.knots = 'junk';
    expect(load(JSON.stringify(raw)).graph.knots).toBeUndefined();
  });

  it('keeps knots through groups', () => {
    const state = createEditorState(withOneKnot());
    state.select({ kind: 'node', id: 'c1' });
    state.selectMany(['c1', 'c2']);
    expect(state.groupSelection().ok).toBe(true);
    expect(state.getGraph().knots?.chain.w1).toEqual(['k1']);
    expect(load(serializeBoard(state.getBoard())).graph.knots).toEqual(state.getGraph().knots);
  });
});

describe('knots inside groups', () => {
  it('keeps the knots of the main board and of a group apart', () => {
    expect(knotKey(null, 'w1')).toBe('w1');
    expect(knotKey('g1', 'w1')).toBe('g1@w1');
    expect(wireIdOfKnotKey('g1@w1')).toBe('w1');
    expect(wireIdOfKnotKey('w1')).toBe('w1');
  });

  it('loads group knots, drops them for an unknown wire, and forgets them when the group goes', () => {
    const wires = new Set(['w1', 'w2']);
    const raw = { pos: { a: { x: 1, y: 2 }, b: { x: 3, y: 4 } }, chain: { 'g1@w1': ['a'], w2: ['b'], 'g1@nope': ['a'] } };
    const knots = sanitizeKnots(raw, wires)!;
    expect(Object.keys(knots.chain).sort()).toEqual(['g1@w1', 'w2']);
    const graph = { ...fixture(), knots };
    expect(pruneGraphKnots({ ...graph, groups: [{ id: 'g1', name: 'G', nodeIds: ['c1'], x: 0, y: 0 }] }).knots?.chain['g1@w1']).toEqual(['a']);
    const without = pruneGraphKnots(graph);
    expect(Object.keys(without.knots?.chain ?? {})).toEqual(['w2']);
  });
});

describe('knots in the editor state', () => {
  it('setKnots is one undo step and an empty set removes the field', () => {
    const state = createEditorState({ name: 'p', mode: '3d', graph: fixture() });
    const before = serializeBoard(state.getBoard());
    state.setKnots(addKnot(emptyKnots(), 'w1', { x: 8, y: 8 }, 0).book);
    expect(state.getGraph().knots?.pos.k1).toEqual({ x: 8, y: 8 });
    expect(state.undo()).toBe(true);
    expect(state.getGraph().knots).toBeUndefined();
    expect(serializeBoard(state.getBoard())).toBe(before);
    expect(state.redo()).toBe(true);
    expect(state.getGraph().knots?.chain.w1).toEqual(['k1']);
  });

  it('forgets the knots of a deleted wire', () => {
    const state = createEditorState({ name: 'p', mode: '3d', graph: fixture() });
    state.setKnots(addKnot(emptyKnots(), 'w1', { x: 8, y: 8 }, 0).book);
    state.select({ kind: 'wire', id: 'w1' });
    expect(state.deleteSelection()).toBe(true);
    expect(state.getGraph().knots).toBeUndefined();
  });

  it('pruneGraphKnots returns the same graph when nothing is dropped', () => {
    const g = withOneKnot().graph;
    expect(pruneGraphKnots(g)).toBe(g);
  });
});

describe('drop settle on editor coordinates', () => {
  const card = (x: number, y: number) => ({ x, y, w: 168, h: 90 });

  it('stays exactly where it was dropped on free space, even right next to a card', () => {
    expect(settleDrop([card(0, 0)], card(400, 300))).toEqual({ x: 400, y: 300 });
    expect(settleDrop([card(0, 0)], card(168, 0))).toEqual({ x: 168, y: 0 });
  });

  it('keeps negative coordinates (the editor world has no wall at 0)', () => {
    expect(settleDrop([card(0, 0)], card(-500, -200))).toEqual({ x: -500, y: -200 });
  });

  it('slides to the nearest free spot when dropped on a card', () => {
    const taken = [card(0, 0)];
    const at = settleDrop(taken, card(20, 10));
    expect(at).not.toEqual({ x: 20, y: 10 });
    const overlap = at.x < 168 + 12 && at.x + 168 + 12 > 0 && at.y < 90 + 12 && at.y + 90 + 12 > 0;
    expect(overlap).toBe(false);
    // close to the drop point, not thrown across the board
    expect(Math.hypot(at.x - 20, at.y - 10)).toBeLessThan(200);
  });

  it('works around several cards and never lands on one', () => {
    const taken = [card(0, 0), card(180, 0), card(0, 102), card(180, 102)];
    const at = settleDrop(taken, card(90, 50));
    for (const t of taken) {
      expect(at.x < t.x + t.w && at.x + 168 > t.x && at.y < t.y + t.h && at.y + 90 > t.y).toBe(false);
    }
  });
});
