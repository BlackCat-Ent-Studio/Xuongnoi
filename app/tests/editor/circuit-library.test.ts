import { beforeAll, describe, expect, it } from 'vitest';
import { expandBoard } from '../../src/circuits/expand';
import { validateCircuits } from '../../src/circuits/validate';
import { circuitFromGroup } from '../../src/editor/circuits/circuit-actions';
import { createCircuit, createCircuitFromGroup, findCircuit, setCircuitColor } from '../../src/editor/circuits/circuit-model';
import { createEditorState } from '../../src/editor/editor-state';
import { createGroup } from '../../src/editor/groups/group-model';
import type { Board } from '../../src/engine/types';
import { parseBoard, serializeBoard } from '../../src/io/save-format';
import { registerAllNodes } from '../../src/nodes';
import { node, wire } from '../circuits/circuit-helpers';

beforeAll(() => registerAllNodes());

describe('the colour of a circuit', () => {
  it('is set, saved with the board, and dropped again for the default; a board that never set one saves as before', () => {
    const made = createCircuit({ name: 't', mode: '3d', graph: { nodes: [], wires: [] } }, 'Máy');
    const plain = serializeBoard(made.board);
    expect(plain).not.toContain('"color"');
    const blue = setCircuitColor(made.board, made.circuitId, '#5aa9ff');
    expect(findCircuit(blue, made.circuitId)!.color).toBe('#5aa9ff');
    const loaded = parseBoard(serializeBoard(blue));
    expect(loaded.ok && loaded.board.circuits![0]!.color).toBe('#5aa9ff');
    expect(setCircuitColor(blue, made.circuitId, '#5aa9ff')).toBe(blue);
    expect(serializeBoard(setCircuitColor(blue, made.circuitId, null))).toBe(plain);
    // Not a colour: nothing happens.
    expect(setCircuitColor(blue, made.circuitId, 'red')).toBe(blue);
  });

  it('is one undo step in the editor', () => {
    const made = createCircuit({ name: 't', mode: '3d', graph: { nodes: [], wires: [] } }, 'Máy');
    const state = createEditorState(made.board);
    expect(state.edit((b) => setCircuitColor(b, made.circuitId, '#f27ad0'))).toBe(true);
    expect(findCircuit(state.getBoard(), made.circuitId)!.color).toBe('#f27ad0');
    state.undo();
    expect(findCircuit(state.getBoard(), made.circuitId)!.color).toBeUndefined();
  });
});

/** Số cố định → So sánh → Đảo ngược → Đảo ngược; the two in the middle are grouped as "Bộ kiểm". */
function groupedBoard(): Board {
  const graph = {
    nodes: [node('so', 'const', { value: 7 }), node('cmp', 'compare', { op: 'gt' }), node('dao', 'not'), node('ra', 'not')],
    wires: [wire('w1', 'so.value', 'cmp.a'), wire('w2', 'cmp.out', 'dao.in'), wire('w3', 'dao.out', 'ra.in')],
  };
  const grouped = createGroup(graph, ['cmp', 'dao'], { name: 'Bộ kiểm', color: '#f0965a' });
  if (!grouped.ok) throw new Error(grouped.reason);
  return { name: 't', mode: '3d', graph: grouped.graph };
}

describe('"Chuyển nhóm thành bảng mạch"', () => {
  it('turns the group into a circuit with one copy where the block stood: its name, its colour, crossing wires as pins', () => {
    const board = groupedBoard();
    const group = board.graph.groups![0]!;
    const res = createCircuitFromGroup(board, group.id);
    if (!res.ok) throw new Error(res.reason);
    expect(res.board.graph.groups).toBeUndefined();
    const circuit = findCircuit(res.board, res.circuitId)!;
    expect(circuit).toMatchObject({ name: 'Bộ kiểm', color: '#f0965a' });
    expect(circuit.graph.nodes.map((n) => n.id).sort()).toEqual(['cmp', 'dao']);
    expect(circuit.pins.map((p) => `${p.dir}:${p.inner.node}.${p.inner.port}`)).toEqual(['in:cmp.a', 'out:dao.out']);
    const copy = res.board.graph.nodes.find((n) => n.id === res.instanceId)!;
    expect(copy.pos).toEqual({ x: Math.round(group.x), y: Math.round(group.y) });
    expect(res.board.graph.nodes.map((n) => n.kind).sort()).toEqual(['circuit', 'const', 'not']);
    expect(validateCircuits(res.board)).toEqual([]);
    // What runs is the same machine: the same cards (now under the copy) and the same three connections.
    const flat = expandBoard(res.board).graph;
    const plain = (id: string): string => id.slice(id.lastIndexOf('/') + 1);
    expect(flat.nodes.map((n) => plain(n.id)).sort()).toEqual(['cmp', 'dao', 'ra', 'so']);
    expect(flat.wires.map((w) => `${plain(w.from.node)}.${w.from.port}>${plain(w.to.node)}.${w.to.port}`).sort()).toEqual(['cmp.out>dao.in', 'dao.out>ra.in', 'so.value>cmp.a']);
    const loaded = parseBoard(serializeBoard(res.board));
    expect(loaded.ok).toBe(true);
  });

  it('in the editor it is one undo step that brings the group back, and it says what it did', () => {
    const state = createEditorState(groupedBoard());
    const groupId = state.getBoard().graph.groups![0]!.id;
    const said: string[] = [];
    const copyId = circuitFromGroup(state, groupId, (text) => void said.push(text));
    expect(copyId).not.toBeNull();
    expect(state.getSelection()).toEqual({ kind: 'node', id: copyId });
    expect(said).toEqual(['Đã chuyển nhóm thành bảng mạch "Bộ kiểm" với 2 chân']);
    expect(state.getBoard().circuits).toHaveLength(1);
    state.undo();
    expect(state.getBoard().circuits).toBeUndefined();
    expect(state.getBoard().graph.groups).toHaveLength(1);
    // Unknown group: refused with a message, nothing changes.
    const before = state.getBoard();
    expect(circuitFromGroup(state, 'nope', (text) => void said.push(text))).toBeNull();
    expect(state.getBoard()).toBe(before);
  });
});
