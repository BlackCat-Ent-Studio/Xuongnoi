import { beforeAll, describe, expect, it } from 'vitest';
import { benchPlan } from '../../src/circuits/bench';
import { runnableGraph } from '../../src/circuits/runnable';
import { validateCircuits } from '../../src/circuits/validate';
import { findCircuit, setBenchCard, setExposed, wirePin } from '../../src/editor/circuits/circuit-model';
import { connectIn } from '../../src/editor/circuits/circuit-wiring';
import type { Board } from '../../src/engine/types';
import { parseBoard, serializeBoard } from '../../src/io/save-format';
import { registerAllNodes } from '../../src/nodes';
import { circuit, copyOf, node } from '../circuits/circuit-helpers';

beforeAll(() => registerAllNodes());

/** "So sánh" with pin `b` on its B input, and a loose "Số cố định" that is to become the bench card. */
function board(): Board {
  const c = circuit(
    'c',
    { nodes: [node('cmp', 'compare', { op: 'gt' }), node('five', 'const', { value: 5 })], wires: [] },
    { pins: [{ id: 'b', label: 'B', dir: 'in', type: 'number', inner: { node: 'cmp', port: 'b' } }] },
  );
  return { name: 't', mode: '3d', graph: { nodes: [copyOf('k', 'c')], wires: [] }, circuits: [c] };
}
const path = [{ circuit: 'c', via: 'k' }];
const ok = <T extends { ok: boolean }>(res: T): Extract<T, { ok: true }> => {
  expect(res.ok).toBe(true);
  return res as Extract<T, { ok: true }>;
};

describe('bench cards of a circuit ("Chỉ để chạy thử")', () => {
  it('a bench card may feed an input that a pin feeds: the pin keeps the port, and no problem is reported', () => {
    let b = ok(setBenchCard(board(), 'c', 'five', true)).board;
    expect(findCircuit(b, 'c')!.benchIds).toEqual(['five']);
    b = ok(connectIn(b, path, { node: 'five', port: 'value' }, { node: 'cmp', port: 'b' })).board;
    const c = findCircuit(b, 'c')!;
    expect(c.pins[0]!.inner).toEqual({ node: 'cmp', port: 'b' });
    expect(c.graph.wires).toHaveLength(1);
    expect(validateCircuits(b)).toEqual([]);
    // On the bench the card feeds the port; in the real board neither the card nor its wire exists.
    expect(benchPlan(b, 'c').inputs[0]!.drive).toEqual({ by: 'card', from: { node: 'five', port: 'value' } });
    const flat = runnableGraph(b);
    expect(flat.nodes.map((n) => n.id)).toEqual(['k/cmp']);
    expect(flat.wires).toEqual([]);
    // Pointing the pin at the port again leaves the bench wire alone.
    const again = ok(wirePin(b, 'c', 'b', { node: 'cmp', port: 'b' })).board;
    expect(findCircuit(again, 'c')!.graph.wires).toHaveLength(1);
    // Saved and loaded, the bench list is still there.
    const loaded = parseBoard(serializeBoard(b));
    expect(loaded.ok && loaded.board.circuits![0]!.benchIds).toEqual(['five']);
  });

  it('a normal card wired onto the same input makes the pin let go, as before', () => {
    const b = ok(connectIn(board(), path, { node: 'five', port: 'value' }, { node: 'cmp', port: 'b' })).board;
    expect(findCircuit(b, 'c')!.pins[0]!.inner).toEqual({ node: '', port: '' });
  });

  it('a card that holds a pin or an opened setting cannot become a bench card', () => {
    expect(setBenchCard(board(), 'c', 'cmp', true)).toEqual({ ok: false, reason: 'has-pin' });
    const exposed = setExposed(board(), 'c', 'five', 'value', true);
    expect(setBenchCard(exposed, 'c', 'five', true)).toEqual({ ok: false, reason: 'has-exposed' });
  });

  it('back to a normal card, the pin it was feeding lets go (the card now feeds every copy)', () => {
    let b = ok(setBenchCard(board(), 'c', 'five', true)).board;
    b = ok(connectIn(b, path, { node: 'five', port: 'value' }, { node: 'cmp', port: 'b' })).board;
    b = ok(setBenchCard(b, 'c', 'five', false)).board;
    const c = findCircuit(b, 'c')!;
    expect(c.benchIds).toEqual([]);
    expect(c.pins[0]!.inner).toEqual({ node: '', port: '' });
    expect(validateCircuits(b).map((i) => i.code)).toEqual(['pin-unwired']);
    expect(runnableGraph(b).wires).toHaveLength(1);
  });
});
