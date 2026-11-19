import { beforeAll, describe, expect, it } from 'vitest';
import { flatNodeLabel, locateFlatNode, pickOnCanvas, revealFlatNode, sceneRoots, stageOwners } from '../../src/editor/circuits/circuit-scene';
import { createEditorState } from '../../src/editor/editor-state';
import { buildSceneModel } from '../../src/editor/scene/scene-model';
import { getNodeDef } from '../../src/engine/registry';
import type { Board } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { circuit, copyOf, node } from '../circuits/circuit-helpers';

beforeAll(() => registerAllNodes());

/** Main board: a floor, two copies of "Xe AGV" (one named "Xe AGV 3") and one "Trạm" that holds a copy of "Xe AGV" itself. */
function factory(): Board {
  const cart = circuit('xe', { nodes: [node('than', 'robot-body'), node('dc', 'motor'), node('hop', 'block')], wires: [] }, { name: 'Xe AGV' });
  const station = circuit('tram', { nodes: [copyOf('x', 'xe'), node('den', 'block')], wires: [] }, { name: 'Trạm' });
  const named = copyOf('k1', 'xe');
  named.params.name = 'Xe AGV 3';
  return { name: 'f', mode: '3d', graph: { nodes: [node('san', 'block'), named, copyOf('k2', 'xe'), copyOf('t1', 'tram')], wires: [] }, circuits: [cart, station] };
}
const plain = (): Board => ({ name: 'p', mode: '3d', graph: { nodes: [node('san', 'block'), node('vat', 'item')], wires: [] } });
const labels = (roots: ReturnType<typeof sceneRoots>): string[] => roots.flatMap((r) => r.groups.flatMap((g) => g.items.map((i) => `${i.nodeId}=${i.label}`)));

describe('cards inside copies, as the stage and the scene tree know them', () => {
  it('names a running card by the copies it sits in', () => {
    const b = factory();
    expect(flatNodeLabel(b, 'k1/dc')).toBe('Xe AGV 3 › Động cơ');
    expect(flatNodeLabel(b, 'k2/than')).toBe('Xe AGV › Thân robot');
    expect(flatNodeLabel(b, 't1/x/dc')).toBe('Trạm › Xe AGV › Động cơ');
    expect(flatNodeLabel(b, 'san')).toBe('Vật thể');
    expect(flatNodeLabel(b, 'nope/x')).toBe('nope/x');
  });

  it('finds where a running card is drawn', () => {
    const b = factory();
    expect(locateFlatNode(b, 'san')).toEqual({ steps: [], inner: 'san' });
    expect(locateFlatNode(b, 't1/x/hop')).toEqual({ steps: [{ circuit: 'tram', via: 't1' }, { circuit: 'xe', via: 'x' }], inner: 'hop' });
    expect(locateFlatNode(b, 'gone')).toBeNull();
    expect(locateFlatNode(plain(), 'vat')).toEqual({ steps: [], inner: 'vat' });
  });

  it('the scene tree lists the objects inside every copy under the name of the copy', () => {
    expect(labels(sceneRoots(factory(), [], false, getNodeDef))).toEqual([
      'san=Vật thể #1',
      'k1/hop=Xe AGV 3 › Vật thể #2',
      'k2/hop=Xe AGV › Vật thể #3',
      't1/x/hop=Trạm › Xe AGV › Vật thể #4',
      't1/den=Trạm › Vật thể #5',
    ]);
    // While the bench runs one circuit alone the tree lists that circuit, under the ids the canvas uses.
    expect(labels(sceneRoots(factory(), [{ circuit: 'xe', via: 'k1' }], true, getNodeDef))).toEqual(['hop=Vật thể']);
  });

  it('a board without circuits gets exactly the tree it always got', () => {
    const b = plain();
    expect(sceneRoots(b, [], false, getNodeDef)).toEqual(buildSceneModel(b.graph, getNodeDef));
  });

  it('a row of the tree leads into the copy and selects the card there', () => {
    const state = createEditorState(factory());
    expect(revealFlatNode(state, 't1/x/hop')).toBe(true);
    expect(state.getCircuitPath()).toEqual([{ circuit: 'tram', via: 't1' }, { circuit: 'xe', via: 'x' }]);
    expect(state.getSelection()).toEqual({ kind: 'node', id: 'hop' });
    expect(revealFlatNode(state, 'san')).toBe(true);
    expect(state.getCircuitPath()).toEqual([]);
    expect(state.getSelection()).toEqual({ kind: 'node', id: 'san' });
    expect(revealFlatNode(state, 'gone')).toBe(false);
  });

  it('a click on the stage: a card on the canvas is taken as it is, an object inside a copy selects that copy on the main board', () => {
    const state = createEditorState(factory());
    expect(pickOnCanvas(state, 'san')).toBe('san');
    expect(pickOnCanvas(state, 't1/x/than')).toBeNull();
    expect(state.getSelection()).toEqual({ kind: 'node', id: 't1' });
    // From inside a circuit, an object of the main board takes the canvas back out.
    state.enterCircuit({ circuit: 'xe', via: 'k1' });
    expect(pickOnCanvas(state, 'san')).toBeNull();
    expect(state.getCircuitPath()).toEqual([]);
    expect(state.getSelection()).toEqual({ kind: 'node', id: 'san' });
    expect(pickOnCanvas(state, 'nothing')).toBeNull();
  });

  it('what is selected on the canvas stands for its running cards on the stage', () => {
    const b = factory();
    const ids = (path: Parameters<typeof stageOwners>[1], selected: string[], bench = false): string[] => [...stageOwners(b, path, bench, new Set(selected))].sort();
    expect(ids([], ['san'])).toEqual(['san']);
    expect(ids([], ['k1'])).toEqual(['k1/dc', 'k1/hop', 'k1/than']);
    expect(ids([], ['t1'])).toEqual(['t1/den', 't1/x/dc', 't1/x/hop', 't1/x/than']);
    // Inside an entered copy a card stands for that copy only.
    expect(ids([{ circuit: 'xe', via: 'k2' }], ['than'])).toEqual(['k2/than']);
    expect(ids([{ circuit: 'tram', via: 't1' }], ['x'])).toEqual(['t1/x/dc', 't1/x/hop', 't1/x/than']);
    // Opened from the list: no copy is meant.
    expect(ids([{ circuit: 'xe' }], ['than'])).toEqual([]);
    // On the bench the canvas ids are the running ids.
    expect(ids([{ circuit: 'xe', via: 'k2' }], ['than'], true)).toEqual(['than']);
    // No circuits: the very same set.
    const sel = new Set(['san']);
    expect(stageOwners(plain(), [], false, sel)).toBe(sel);
  });
});
