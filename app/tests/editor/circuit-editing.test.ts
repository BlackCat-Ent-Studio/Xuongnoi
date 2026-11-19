import { beforeAll, describe, expect, it } from 'vitest';
import { expandBoard } from '../../src/circuits/expand';
import { instanceValueKey, isPinWired } from '../../src/circuits/instance';
import { validateCircuits } from '../../src/circuits/validate';
import { boardIssues } from '../../src/editor/circuits/circuit-issues';
import {
  addInstance,
  addPin,
  createCircuit,
  createCircuitFromSelection,
  deleteCircuit,
  deletePin,
  duplicateCircuit,
  exposedView,
  movePin,
  renameCircuit,
  renamePin,
  setExposed,
  setInstanceName,
  setStacked,
  stackCardId,
  wirePin,
} from '../../src/editor/circuits/circuit-model';
import { PIN_PORT, pinCardId, sceneWires } from '../../src/editor/circuits/circuit-wiring';
import { createEditorState, type EditorState } from '../../src/editor/editor-state';
import type { Board, Circuit } from '../../src/engine/types';
import { parseBoard, serializeBoard } from '../../src/io/save-format';
import { registerAllNodes } from '../../src/nodes';
import { circuit, copyOf, node, wire } from '../circuits/circuit-helpers';

beforeAll(() => registerAllNodes());

/** A counter with a pin for its tick, pins for its count and "reached", and its target opened to the copies. */
const tally = (): Circuit =>
  circuit(
    'tally',
    { nodes: [node('count', 'counter', { start: 0, target: 3 })], wires: [] },
    {
      name: 'Bộ đếm kiện',
      pins: [
        { id: 'tick', label: 'Nhịp', dir: 'in', type: 'bool', inner: { node: 'count', port: 'up' } },
        { id: 'count', label: 'Số đếm', dir: 'out', type: 'number', inner: { node: 'count', port: 'value' } },
        { id: 'done', label: 'Xong', dir: 'out', type: 'bool', inner: { node: 'count', port: 'reached' } },
      ],
      exposed: [{ id: 'goal', label: 'Mục tiêu', inner: { node: 'count', param: 'target' } }],
    },
  );

/** A key feeds two copies of the tally; the first copy's count goes to a number display. */
const factory = (): Board => ({
  name: 'Xưởng',
  mode: '3d',
  graph: {
    nodes: [node('k', 'key'), copyOf('a', 'tally'), copyOf('b', 'tally'), node('show', 'show-number')],
    wires: [wire('w1', 'k.pressed', 'a.tick'), wire('w2', 'k.pressed', 'b.tick'), wire('w3', 'a.count', 'show.value')],
  },
  circuits: [tally()],
});

const stateOf = (b: Board = factory()): EditorState => createEditorState(b);
const circuitOf = (s: EditorState, id = 'tally'): Circuit => s.getBoard().circuits!.find((c) => c.id === id)!;
const text = (s: EditorState): string => serializeBoard(s.getBoard());
const reload = (b: Board): Board => {
  const res = parseBoard(serializeBoard(b));
  if (!res.ok) throw new Error(res.error);
  return res.board;
};

describe('going into a circuit', () => {
  it('shows the circuit graph, edits it for every copy, and one undo step takes the edit back', () => {
    const s = stateOf();
    const kinds: string[] = [];
    s.subscribe((k) => kinds.push(k));
    expect(s.enterCircuit({ circuit: 'tally', via: 'a' })).toBe(true);
    expect(kinds).toContain('scope');
    expect(s.getCircuitPath()).toEqual([{ circuit: 'tally', via: 'a' }]);
    expect(s.getGraph().nodes.map((n) => n.id)).toEqual(['count']);
    const mainBefore = s.getBoard().graph;

    s.setParam('count', 'target', 7);
    const added = s.addNode('const', { x: 10, y: 10 })!;
    expect(circuitOf(s).graph.nodes.map((n) => n.id)).toEqual(['count', added]);
    expect(s.getBoard().graph).toBe(mainBefore);
    // Both copies run the changed circuit.
    const flat = expandBoard(s.getBoard()).graph;
    expect(flat.nodes.find((n) => n.id === 'a/count')!.params.target).toBe(7);
    expect(flat.nodes.find((n) => n.id === 'b/count')!.params.target).toBe(7);
    expect(flat.nodes.some((n) => n.id === `b/${added}`)).toBe(true);

    expect(s.undo()).toBe(true);
    expect(circuitOf(s).graph.nodes.map((n) => n.id)).toEqual(['count']);
    expect(s.getCircuitPath()).toHaveLength(1);
    s.exitCircuit();
    expect(s.getCircuitPath()).toEqual([]);
    expect(s.getGraph()).toBe(s.getBoard().graph);
  });

  it('goes through nested circuits by a path and steps out when a circuit on the path disappears', () => {
    let b = factory();
    const outer = createCircuit(b, 'Trạm');
    b = outer.board;
    const placed = addInstance(b, [{ circuit: outer.circuitId }], 'tally', { x: 0, y: 0 });
    if (!placed.ok) throw new Error(placed.reason);
    const s = stateOf(placed.board);
    expect(s.enterCircuit({ circuit: outer.circuitId })).toBe(true);
    expect(s.enterCircuit({ circuit: 'tally', via: placed.nodeId })).toBe(true);
    expect(s.getCircuitPath().map((p) => p.circuit)).toEqual([outer.circuitId, 'tally']);
    // A circuit already on the path cannot be entered again, an unknown one not at all.
    expect(s.enterCircuit({ circuit: 'tally' })).toBe(false);
    expect(s.enterCircuit({ circuit: 'ghost' })).toBe(false);
    s.exitCircuit(1);
    expect(s.getCircuitPath().map((p) => p.circuit)).toEqual([outer.circuitId]);
    s.exitCircuit(0);
    s.edit((board) => deleteCircuit(board, outer.circuitId, { withCopies: true }));
    s.undo();
    s.enterCircuit({ circuit: outer.circuitId });
    s.exitCircuit(0);
    s.redo();
    expect(s.getBoard().circuits!.map((c) => c.id)).toEqual(['tally']);
    // Entered, then removed by a redo from elsewhere: the canvas cannot stay inside it.
    s.undo();
    s.enterCircuit({ circuit: outer.circuitId });
    s.setCircuitEditing(true);
    s.redo();
    expect(s.getCircuitPath()).toEqual([]);
  });

  it('refuses a copy that would put a circuit inside itself or nest too deep', () => {
    const b = factory();
    expect(addInstance(b, [{ circuit: 'tally' }], 'tally', { x: 0, y: 0 })).toEqual({ ok: false, reason: 'cycle' });
    let deep = b;
    let inner = 'tally';
    for (let i = 0; i < 3; i++) {
      const made = createCircuit(deep, `Tầng ${i}`);
      const res = addInstance(made.board, [{ circuit: made.circuitId }], inner, { x: 0, y: 0 });
      if (!res.ok) throw new Error(res.reason);
      deep = res.board;
      inner = made.circuitId;
    }
    const top = createCircuit(deep, 'Quá sâu');
    expect(addInstance(top.board, [{ circuit: top.circuitId }], inner, { x: 0, y: 0 })).toEqual({ ok: false, reason: 'too-deep' });
    expect(addInstance(b, [], 'ghost', { x: 0, y: 0 })).toEqual({ ok: false, reason: 'unknown-circuit' });
  });

  it('a locked circuit can be looked at but not changed', () => {
    const s = stateOf();
    s.enterCircuit({ circuit: 'tally', via: 'a' });
    s.setCircuitEditing(false);
    const before = text(s);
    expect(s.isReadOnly()).toBe(true);
    expect(s.addNode('const', { x: 0, y: 0 })).toBeNull();
    s.setParam('count', 'target', 9);
    s.select({ kind: 'node', id: 'count' });
    expect(s.deleteSelection()).toBe(false);
    expect(s.edit((b) => renameCircuit(b, 'tally', 'Khác'))).toBe(false);
    expect(text(s)).toBe(before);
    s.setCircuitEditing(true);
    expect(s.addNode('const', { x: 0, y: 0 })).not.toBeNull();
    s.exitCircuit();
    // Back on the main board there is no lock to carry over.
    expect(s.isCircuitEditing()).toBe(true);
  });
});

describe('pins', () => {
  it('adds, renames, reorders and deletes; deleting takes the outside wires off every copy', () => {
    let b = factory();
    const added = addPin(b, 'tally', 'in')!;
    b = added.board;
    const pin = b.circuits![0]!.pins.at(-1)!;
    expect(pin).toMatchObject({ id: added.pinId, dir: 'in', label: 'Chân vào 2' });
    expect(isPinWired(pin)).toBe(false);
    // An unfinished pin is listed, saved and loaded; it is not damage.
    expect(validateCircuits(b)).toEqual([{ code: 'pin-unwired', circuit: 'tally', pin: added.pinId }]);
    expect(reload(b).circuits![0]!.pins.at(-1)).toEqual(pin);

    b = renamePin(b, 'tally', added.pinId, '  Đặt lại  ');
    expect(b.circuits![0]!.pins.at(-1)!.label).toBe('Đặt lại');
    b = movePin(b, 'tally', added.pinId, -1);
    expect(b.circuits![0]!.pins.filter((p) => p.dir === 'in').map((p) => p.id)).toEqual([added.pinId, 'tick']);
    // The outputs between them keep their own order.
    expect(b.circuits![0]!.pins.filter((p) => p.dir === 'out').map((p) => p.id)).toEqual(['count', 'done']);
    expect(movePin(b, 'tally', added.pinId, -1)).toBe(b);

    const gone = deletePin(b, 'tally', 'tick');
    expect(gone.dropped).toBe(2);
    expect(gone.board.graph.wires.map((w) => w.id)).toEqual(['w3']);
    expect(gone.board.circuits![0]!.pins.some((p) => p.id === 'tick')).toBe(false);
    expect(reload(gone.board).graph.wires).toHaveLength(1);
  });

  it('a pin takes the type of the inner port it is wired to and drops outside wires that no longer fit', () => {
    const b = factory();
    // "Số đếm" (number) is re-pointed at the bool output: the wire to the number display cannot stay.
    const res = wirePin(b, 'tally', 'count', { node: 'count', port: 'reached' });
    if (!res.ok) throw new Error(res.reason);
    expect(res.dropped).toBe(1);
    expect(res.board.circuits![0]!.pins.find((p) => p.id === 'count')).toMatchObject({ type: 'bool', inner: { node: 'count', port: 'reached' } });
    expect(res.board.graph.wires.map((w) => w.id)).toEqual(['w1', 'w2']);
    expect(validateCircuits(res.board)).toEqual([]);
    expect(reload(res.board).graph.wires).toHaveLength(2);
    // Same type: the outside wires stay.
    const same = wirePin(b, 'tally', 'tick', { node: 'count', port: 'reset' });
    if (!same.ok) throw new Error(same.reason);
    expect(same.dropped).toBe(0);
    expect(same.board.graph.wires).toHaveLength(3);
    expect(wirePin(b, 'tally', 'tick', { node: 'count', port: 'value' })).toEqual({ ok: false, reason: 'wrong-direction' });
    expect(wirePin(b, 'tally', 'tick', { node: 'nobody', port: 'up' })).toEqual({ ok: false, reason: 'unknown-node' });
  });

  it('inside the circuit a pin card wires like a card: drag to an inner port, replace, select the wire and delete it', () => {
    const s = stateOf();
    s.enterCircuit({ circuit: 'tally', via: 'a' });
    expect(sceneWires(s.getBoard(), s.getCircuitPath()).map((w) => w.id)).toEqual([pinCardId('tick'), pinCardId('count'), pinCardId('done')]);

    // A new 'in' pin wired onto the input "tick" already feeds takes it over.
    s.edit((b) => addPin(b, 'tally', 'in')!.board);
    const fresh = circuitOf(s).pins.at(-1)!.id;
    expect(s.connect({ node: pinCardId(fresh), port: PIN_PORT }, { node: 'count', port: 'up' })).toEqual({ ok: true });
    expect(isPinWired(circuitOf(s).pins.find((p) => p.id === 'tick')!)).toBe(false);
    expect(circuitOf(s).pins.find((p) => p.id === fresh)!.inner).toEqual({ node: 'count', port: 'up' });
    s.undo();
    expect(isPinWired(circuitOf(s).pins.find((p) => p.id === 'tick')!)).toBe(true);

    // A plain inner wire onto the same input makes the pin let go, so no copy has two sources for it.
    const c = s.addNode('const', { x: 0, y: 0 })!;
    s.edit((b) => addPin(b, 'tally', 'in')!.board);
    const numberPin = circuitOf(s).pins.at(-1)!.id;
    expect(s.connect({ node: pinCardId(numberPin), port: PIN_PORT }, { node: 'count', port: 'setAmount' }).ok).toBe(true);
    expect(circuitOf(s).pins.find((p) => p.id === numberPin)!.type).toBe('number');
    expect(s.connect({ node: c, port: 'value' }, { node: 'count', port: 'setAmount' }, { replace: true }).ok).toBe(true);
    expect(isPinWired(circuitOf(s).pins.find((p) => p.id === numberPin)!)).toBe(false);
    expect(validateCircuits(s.getBoard()).filter((i) => i.code !== 'pin-unwired')).toEqual([]);

    // The link of a pin is selected and deleted like a wire.
    s.select({ kind: 'wire', id: pinCardId('done') });
    expect(s.deleteSelection()).toBe(true);
    expect(isPinWired(circuitOf(s).pins.find((p) => p.id === 'done')!)).toBe(false);
    expect(s.getSelection()).toBeNull();
    // Two pin cards cannot be wired to each other.
    expect(s.connect({ node: pinCardId('tick'), port: PIN_PORT }, { node: pinCardId('count'), port: PIN_PORT }).ok).toBe(false);
  });

  it('deleting an inner card leaves its pins unwired and drops its exposed setting, in the same undo step', () => {
    const s = stateOf();
    s.enterCircuit({ circuit: 'tally', via: 'a' });
    s.select({ kind: 'node', id: 'count' });
    expect(s.deleteSelection()).toBe(true);
    expect(circuitOf(s).pins.map(isPinWired)).toEqual([false, false, false]);
    expect(circuitOf(s).exposed).toEqual([]);
    // Still a board that saves, loads and expands; the outside wires simply lead nowhere.
    expect(expandBoard(reload(s.getBoard())).graph.wires).toEqual([]);
    s.undo();
    expect(circuitOf(s)).toEqual(tally());
  });

  it('wires on the main board go to and from the pins of a copy', () => {
    const s = stateOf();
    s.select({ kind: 'wire', id: 'w3' });
    s.deleteSelection();
    expect(s.connect({ node: 'b', port: 'count' }, { node: 'show', port: 'value' }).ok).toBe(true);
    expect(s.connect({ node: 'a', port: 'count' }, { node: 'show', port: 'value' })).toEqual({ ok: false, reason: 'input-taken' });
    expect(s.connect({ node: 'a', port: 'done' }, { node: 'show', port: 'value' }, { replace: true })).toEqual({ ok: false, reason: 'type-mismatch' });
    expect(s.connect({ node: 'a', port: 'tick' }, { node: 'show', port: 'value' }).ok).toBe(false);
    expect(reload(s.getBoard()).graph.wires).toHaveLength(3);
  });
});

describe('exposed settings', () => {
  it('opens a setting, each copy holds its own value, and closing it leaves the board valid', () => {
    let b = factory();
    b = setExposed(b, 'tally', 'count', 'start', true);
    const made = b.circuits![0]!.exposed.at(-1)!;
    expect(made.inner).toEqual({ node: 'count', param: 'start' });
    expect(exposedView(b, b.circuits![0]!, made)!.def).toMatchObject({ kind: 'number', default: 0 });
    const s = stateOf(b);
    s.setParam('a', instanceValueKey(made.id), 5);
    s.setParam('b', instanceValueKey('goal'), 9);
    const flat = expandBoard(s.getBoard()).graph;
    expect(flat.nodes.find((n) => n.id === 'a/count')!.params).toMatchObject({ start: 5, target: 3 });
    expect(flat.nodes.find((n) => n.id === 'b/count')!.params).toMatchObject({ start: 0, target: 9 });
    expect(validateCircuits(s.getBoard())).toEqual([]);
    s.edit((board) => setExposed(board, 'tally', 'count', 'start', false));
    expect(validateCircuits(s.getBoard())).toEqual([]);
    expect(expandBoard(s.getBoard()).graph.nodes.find((n) => n.id === 'a/count')!.params.start).toBe(0);
    expect(reload(s.getBoard()).circuits![0]!.exposed.map((e) => e.id)).toEqual(['goal']);
  });
});

describe('the circuits of a board', () => {
  it('renames, duplicates and deletes; a circuit with copies is only deleted together with them', () => {
    let b = factory();
    b = renameCircuit(b, 'tally', 'Đếm hàng');
    expect(b.circuits![0]!.name).toBe('Đếm hàng');
    const dup = duplicateCircuit(b, 'tally')!;
    expect(dup.board.circuits!.map((c) => c.name)).toEqual(['Đếm hàng', 'Đếm hàng (bản sao)']);
    expect(dup.board.circuits![1]!.graph).toEqual(b.circuits![0]!.graph);
    expect(deleteCircuit(dup.board, dup.circuitId).circuits).toHaveLength(1);

    // Two copies in use: nothing happens without the explicit choice.
    expect(deleteCircuit(b, 'tally')).toBe(b);
    const cleared = deleteCircuit(b, 'tally', { withCopies: true });
    expect(cleared.circuits).toBeUndefined();
    expect(cleared.graph.nodes.map((n) => n.id)).toEqual(['k', 'show']);
    expect(cleared.graph.wires).toEqual([]);
    expect(serializeBoard(cleared)).not.toContain('circuits');
    expect(reload(cleared).graph.nodes).toHaveLength(2);
  });

  it('makes a circuit from the selection inside another circuit and keeps its pins and exposed settings working', () => {
    const s = stateOf();
    s.enterCircuit({ circuit: 'tally', via: 'a' });
    const before = expandBoard(s.getBoard()).graph;
    s.edit((b) => {
      const res = createCircuitFromSelection(b, s.getCircuitPath(), new Set(['count']), 'Lõi đếm');
      return res.ok ? res.board : null;
    });
    const inner = s.getBoard().circuits!.find((c) => c.name === 'Lõi đếm')!;
    expect(inner.graph.nodes.map((n) => n.id)).toEqual(['count']);
    expect(inner.pins.map((p) => `${p.dir}:${p.inner.port}`)).toEqual(['in:up', 'out:value', 'out:reached']);
    expect(validateCircuits(s.getBoard())).toEqual([]);
    // The same cards run with the same wires and values, one level deeper.
    const after = expandBoard(s.getBoard()).graph;
    const tail = (id: string): string => id.slice(id.lastIndexOf('/') + 1);
    expect(after.nodes.map((n) => `${tail(n.id)}:${JSON.stringify(n.params)}`)).toEqual(before.nodes.map((n) => `${tail(n.id)}:${JSON.stringify(n.params)}`));
    expect(after.wires.map((w) => `${tail(w.from.node)}.${w.from.port}>${tail(w.to.node)}.${w.to.port}`).sort()).toEqual(
      before.wires.map((w) => `${tail(w.from.node)}.${w.from.port}>${tail(w.to.node)}.${w.to.port}`).sort(),
    );
    s.exitCircuit(0);
    s.setParam('b', instanceValueKey('goal'), 11);
    expect(expandBoard(s.getBoard()).graph.nodes.find((n) => tail(n.id) === 'count' && n.id.startsWith('b/'))!.params.target).toBe(11);
    expect(reload(s.getBoard()).circuits).toHaveLength(2);
    expect(s.undo()).toBe(true);
    expect(s.undo()).toBe(true);
    expect(text(s)).toBe(serializeBoard(factory()));
  });

  it('says why a selection cannot become a circuit', () => {
    const b = factory();
    expect(createCircuitFromSelection(b, [], new Set())).toEqual({ ok: false, reason: 'empty' });
    const grouped: Board = { ...b, graph: { ...b.graph, groups: [{ id: 'g1', name: 'N', nodeIds: ['k', 'show'], x: 0, y: 0 }] } };
    expect(createCircuitFromSelection(grouped, [], new Set(['k']))).toEqual({ ok: false, reason: 'has-group' });
  });
});

describe('copy, paste and undo', () => {
  it('copies and pastes a copy of a circuit with its values, name and the wires between the pasted cards', () => {
    const s = stateOf();
    s.setParam('a', instanceValueKey('goal'), 6);
    s.edit((b) => setInstanceName(b, [], 'a', 'Đếm cửa 1'), ['params']);
    s.selectMany(['k', 'a']);
    expect(s.copy()).toBe(2);
    expect(s.paste()).toBe(2);
    const fresh = s.getGraph().nodes.slice(-2);
    expect(fresh.map((n) => n.kind)).toEqual(['key', 'circuit']);
    expect(fresh[1]!.params).toMatchObject({ circuit: 'tally', name: 'Đếm cửa 1', [instanceValueKey('goal')]: 6 });
    expect(s.getGraph().wires.at(-1)).toMatchObject({ from: { node: fresh[0]!.id, port: 'pressed' }, to: { node: fresh[1]!.id, port: 'tick' } });
    expect(validateCircuits(s.getBoard())).toEqual([]);
    expect(reload(s.getBoard()).graph.nodes).toHaveLength(6);
    s.undo();
    expect(s.getGraph().nodes).toHaveLength(4);
  });

  it('copies and pastes cards inside a circuit, and never pastes a circuit into itself', () => {
    const s = stateOf();
    s.selectMany(['a']);
    s.copy();
    s.enterCircuit({ circuit: 'tally', via: 'a' });
    // The clip holds a copy of the very circuit that is open.
    expect(s.paste()).toBe(0);
    expect(circuitOf(s).graph.nodes).toHaveLength(1);

    const c = s.addNode('const', { x: 0, y: 0 })!;
    s.connect({ node: c, port: 'value' }, { node: 'count', port: 'setAmount' });
    s.selectMany(['count', c]);
    expect(s.duplicate()).toBe(2);
    const inner = circuitOf(s).graph;
    expect(inner.nodes).toHaveLength(4);
    expect(inner.wires).toHaveLength(2);
    expect(s.getBoard().graph.nodes).toHaveLength(4);
    // Pins point at the cards they pointed at; the pasted cards are loose.
    expect(circuitOf(s).pins.map((p) => p.inner.node)).toEqual(['count', 'count', 'count']);
    expect(validateCircuits(s.getBoard())).toEqual([]);
    s.undo();
    expect(circuitOf(s).graph.nodes).toHaveLength(2);
  });

  it('a clip with a copy of a circuit that was deleted since pastes without it', () => {
    const s = stateOf();
    s.selectMany(['k', 'a']);
    s.copy();
    s.edit((b) => deleteCircuit(b, 'tally', { withCopies: true }));
    expect(s.paste()).toBe(1);
    expect(s.getGraph().nodes.map((n) => n.kind)).toEqual(['key', 'show-number', 'key']);
  });
});

describe('stacked copies', () => {
  it('a stacked block moves, copies and deletes all its copies, and the stack is saved with the board', () => {
    const s = stateOf({ ...factory(), graph: { ...factory().graph, nodes: factory().graph.nodes.map((n, i) => ({ ...n, pos: { x: i * 100, y: 50 } })) } });
    s.edit((b) => setStacked(b, [], 'tally', true));
    expect(s.getGraph().stacks).toEqual(['tally']);
    expect(reload(s.getBoard()).graph.stacks).toEqual(['tally']);
    const card = stackCardId('tally');
    s.select({ kind: 'node', id: card });
    s.moveItems([{ id: card, pos: { x: 130, y: 70 } }]);
    expect(s.getGraph().nodes.filter((n) => n.kind === 'circuit').map((n) => n.pos)).toEqual([{ x: 130, y: 70 }, { x: 230, y: 70 }]);
    expect(s.getSelection()).toEqual({ kind: 'node', id: card });
    expect(s.duplicate()).toBe(2);
    expect(s.getGraph().nodes.filter((n) => n.kind === 'circuit')).toHaveLength(4);
    s.undo();
    s.select({ kind: 'node', id: card });
    expect(s.deleteSelection()).toBe(true);
    expect(s.getGraph().nodes.map((n) => n.id)).toEqual(['k', 'show']);
    s.undo();
    s.edit((b) => setStacked(b, [], 'tally', false));
    expect('stacks' in s.getGraph()).toBe(false);
  });
});

describe('saving', () => {
  it('a board edited with circuits reads back as the same text', () => {
    const s = stateOf();
    s.edit((b) => addPin(b, 'tally', 'out')!.board);
    s.edit((b) => setStacked(b, [], 'tally', true));
    s.edit((b) => setInstanceName(b, [], 'b', 'Đếm cửa 2'), ['params']);
    s.edit((b) => setExposed(b, 'tally', 'count', 'start', true));
    // The first load fills in what the short test board left out (default settings of the plain cards); from then on the text is stable.
    const loaded = reload(s.getBoard());
    const saved = serializeBoard(loaded);
    expect(serializeBoard(reload(loaded))).toBe(saved);
    expect(loaded.circuits).toEqual(s.getBoard().circuits);
    expect(loaded.graph.stacks).toEqual(['tally']);
    expect(loaded.graph.nodes.find((n) => n.id === 'b')!.params).toEqual(s.getGraph().nodes.find((n) => n.id === 'b')!.params);
    // An empty name is not written at all.
    s.edit((b) => setInstanceName(b, [], 'b', ''), ['params']);
    expect(text(s)).not.toContain('Đếm cửa 2');
    expect(s.getGraph().nodes.find((n) => n.id === 'b')!.params).not.toHaveProperty('name');
  });

  it('a board without circuits saves the same text after going through the editor state', () => {
    const plain: Board = { name: 't', mode: '3d', graph: { nodes: [node('k', 'key'), node('show', 'show-number')], wires: [] } };
    const s = stateOf(structuredClone(plain));
    const before = text(s);
    const id = s.addNode('const', { x: 5, y: 5 })!;
    s.connect({ node: id, port: 'value' }, { node: 'show', port: 'value' });
    s.select({ kind: 'node', id });
    s.deleteSelection();
    expect(text(s)).toBe(before);
    expect(text(s)).not.toMatch(/circuits|stacks/);
    expect(s.getCircuitPath()).toEqual([]);
    expect(s.isReadOnly()).toBe(false);
  });
});

describe('"Việc cần sửa"', () => {
  it('lists what the circuits still need, in plain words, with where to go', () => {
    let b = factory();
    b = addPin(b, 'tally', 'in')!.board;
    b = renamePin(b, 'tally', b.circuits![0]!.pins.at(-1)!.id, 'Đặt lại');
    const issues = boardIssues(b, '3d');
    expect(issues.map((i) => i.text)).toContain('Bảng mạch "Bộ đếm kiện": chân "Đặt lại" chưa nối vào mảnh ghép nào ở bên trong');
    expect(issues.find((i) => i.text.includes('Đặt lại'))).toMatchObject({ circuitId: 'tally' });
    // A board without circuits gets exactly the list it always got.
    const plain: Board = { name: 't', mode: '3d', graph: { nodes: [node('k', 'key')], wires: [] } };
    expect(boardIssues(plain, '3d').map((i) => i.key)).toEqual(['no-character']);
    // Something to play that sits inside a circuit counts.
    const robot = circuit('bot', { nodes: [node('than', 'robot-body')], wires: [] });
    const hidden: Board = { name: 't', mode: '3d', graph: { nodes: [copyOf('r', 'bot')], wires: [] }, circuits: [robot] };
    expect(boardIssues(hidden, '3d').map((i) => i.key)).not.toContain('no-character');
  });
});
