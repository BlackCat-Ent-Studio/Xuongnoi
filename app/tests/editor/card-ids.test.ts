import { beforeAll, describe, expect, it } from 'vitest';
import { addInstance, createCircuit } from '../../src/editor/circuits/circuit-model';
import { createEditorState } from '../../src/editor/editor-state';
import { nextNodeId } from '../../src/editor/node-ids';
import type { Board } from '../../src/engine/types';
import { listAllSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';

beforeAll(() => registerAllNodes());

/** Every id the canvas draws something for on the main board. */
const idsInUse = (b: Board): string[] => [...b.graph.nodes.map((n) => n.id), ...(b.notes ?? []).map((n) => n.id), ...(b.graph.groups ?? []).map((g) => g.id)];

/** A board whose cards have no `n<number>` ids but whose notes and one group do, as the shipped robot boards have. */
function namedBoard(): Board {
  const note = (id: string, x: number) => ({ id, text: id, color: 'yellow' as const, pos: { x, y: 0 }, size: { w: 180, h: 110 } });
  return {
    name: 'ids',
    mode: '3d',
    graph: {
      nodes: [
        { id: 'so', kind: 'const', params: { value: 1 }, pos: { x: 0, y: 0 } },
        { id: 'hien', kind: 'show-number', params: {}, pos: { x: 300, y: 0 } },
      ],
      wires: [],
      groups: [{ id: 'n2', name: 'Nhóm', nodeIds: ['hien'], x: 300, y: 0 }],
    },
    notes: [note('n1', 0), note('n3', 200)],
  };
}

describe('ids of new cards stay clear of every id in use', () => {
  it('at least one shipped board has a note whose id looks like a card id (the case this guards)', () => {
    const hit = listAllSamples().filter((s) => (s.board.notes ?? []).some((n) => /^n\d+$/.test(n.id)));
    expect(hit.length).toBeGreaterThan(0);
  });

  it('a card added from the palette on every shipped board gets an id nothing else has', () => {
    for (const sample of listAllSamples()) {
      const state = createEditorState(structuredClone(sample.board));
      const before = new Set(idsInUse(state.getBoard()));
      const id = state.addNode('const', { x: 0, y: 0 });
      expect(id, sample.id).not.toBeNull();
      expect(before.has(id!), `${sample.id}: ${id}`).toBe(false);
      // The canvas must see a card, not a note.
      expect(state.getSelection(), sample.id).toEqual({ kind: 'node', id });
    }
  });

  it('skips notes and groups: cards, pasted cards and copies of circuits', () => {
    const state = createEditorState(namedBoard());
    const first = state.addNode('const', { x: 0, y: 0 });
    expect(first).toBe('n4'); // n1 and n3 are notes, n2 is a group
    state.select({ kind: 'node', id: 'so' });
    expect(state.duplicate()).toBe(1);
    const pasted = [...state.getMulti()][0]!;
    expect(pasted).toBe('n5');
    const made = createCircuit(state.getBoard(), 'Máy');
    const placed = addInstance(made.board, [], made.circuitId, { x: 0, y: 0 });
    expect(placed.ok && placed.nodeId).toBe('n6');
    const all = idsInUse(state.getBoard());
    expect(new Set(all).size).toBe(all.length);
  });

  it('inside a circuit the notes of the main board do not matter (nothing there is drawn)', () => {
    const made = createCircuit(namedBoard(), 'Máy');
    const state = createEditorState(made.board);
    expect(state.enterCircuit({ circuit: made.circuitId })).toBe(true);
    expect(state.addNode('const', { x: 0, y: 0 })).toBe('n1');
  });

  it('a board where nothing collides numbers its cards exactly as before', () => {
    const graph = { nodes: [{ id: 'n4', kind: 'const', params: {}, pos: { x: 0, y: 0 } }, { id: 'abc', kind: 'const', params: {}, pos: { x: 0, y: 0 } }], wires: [] };
    expect(nextNodeId(graph)).toBe('n5');
    expect(nextNodeId(graph, ['note1', 'grp1'])).toBe('n5');
    expect(nextNodeId({ nodes: [], wires: [] })).toBe('n1');
  });
});
