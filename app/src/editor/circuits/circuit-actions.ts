import { isInstance } from '../../circuits/instance';
import type { EditorState } from '../editor-state';
import {
  addInstance,
  addPin,
  circuitIdOf,
  circuitOfStackCard,
  createCircuit,
  createCircuitFromGroup,
  createCircuitFromSelection,
  deletePin,
  findCircuit,
  setStacked,
  stackCardId,
  stacksOf,
} from './circuit-model';
import { CIRCUIT_VI as T } from './circuit-text-vi';

/** What the user did through the circuit UI, as editor-state edits with the right message. Shared by the canvas, the palette and the inspector. */

export type Notify = (text: string, kind?: 'info' | 'error') => void;

/** Puts one more copy of a circuit on the open graph and selects it. Returns its node id, or null with a message. */
export function placeInstance(state: EditorState, circuitId: string, pos: { x: number; y: number }, notify: Notify): string | null {
  if (state.isReadOnly()) {
    notify(T.locked, 'error');
    return null;
  }
  const res = addInstance(state.getBoard(), state.getCircuitPath(), circuitId, pos);
  if (!res.ok) {
    notify(T.placeFail[res.reason], 'error');
    return null;
  }
  state.edit(() => res.board);
  state.select({ kind: 'node', id: res.nodeId });
  return res.nodeId;
}

/** Ids of the selected cards with stacked blocks spread into their copies. */
function selectedCards(state: EditorState): Set<string> {
  const stacks = stacksOf(state.getGraph());
  const out = new Set<string>();
  for (const id of state.getMulti()) {
    const members = stacks.get(circuitOfStackCard(id) ?? '');
    if (members) for (const m of members) out.add(m.id);
    else out.add(id);
  }
  return out;
}

/** "Tạo bảng mạch từ các thẻ đang chọn": the selection becomes a circuit with one copy in its place. Returns the copy's id. */
export function circuitFromSelection(state: EditorState, notify: Notify): string | null {
  if (state.isReadOnly()) {
    notify(T.locked, 'error');
    return null;
  }
  const res = createCircuitFromSelection(state.getBoard(), state.getCircuitPath(), selectedCards(state));
  if (!res.ok) {
    notify(T.fromSelectionFail[res.reason], 'error');
    return null;
  }
  state.edit(() => res.board);
  state.select({ kind: 'node', id: res.instanceId });
  const made = findCircuit(res.board, res.circuitId);
  notify(res.orderChanged ? T.madeOrderChanged(made?.name ?? '') : T.madeFromSelection(made?.name ?? '', made?.pins.length ?? 0));
  return res.instanceId;
}

/** "Chuyển nhóm thành bảng mạch": the group becomes a circuit with one copy in its place. Returns the id of that copy. */
export function circuitFromGroup(state: EditorState, groupId: string, notify: Notify): string | null {
  if (state.isReadOnly() || state.getCircuitPath().length > 0) {
    notify(T.locked, 'error');
    return null;
  }
  const res = createCircuitFromGroup(state.getBoard(), groupId);
  if (!res.ok) {
    notify(T.fromSelectionFail[res.reason], 'error');
    return null;
  }
  // The canvas may be showing the inside of the group, which is about to go.
  state.exitGroup();
  state.edit(() => res.board);
  state.select({ kind: 'node', id: res.instanceId });
  const made = findCircuit(res.board, res.circuitId);
  notify(res.orderChanged ? T.madeOrderChanged(made?.name ?? '') : T.madeFromGroup(made?.name ?? '', made?.pins.length ?? 0));
  return res.instanceId;
}

/** A new empty circuit, entered right away so it can be built. */
export function newEmptyCircuit(state: EditorState, notify: Notify): string | null {
  if (state.isPlaying()) {
    notify(T.locked, 'error');
    return null;
  }
  const res = createCircuit(state.getBoard());
  // The library belongs to the whole board, so making a circuit works from anywhere, even inside a locked one.
  state.exitCircuit(0);
  state.edit(() => res.board);
  state.enterCircuit({ circuit: res.circuitId });
  state.setCircuitEditing(true);
  notify(T.created(findCircuit(res.board, res.circuitId)?.name ?? ''));
  return res.circuitId;
}

/** Goes into the circuit of a copy on the open graph. */
export function openInstance(state: EditorState, nodeId: string): boolean {
  const node = state.getGraph().nodes.find((n) => n.id === nodeId);
  return node !== undefined && isInstance(node) && state.enterCircuit({ circuit: circuitIdOf(node), via: nodeId });
}

export function stackCopies(state: EditorState, circuitId: string, on: boolean): void {
  if (!state.edit((b) => setStacked(b, state.getCircuitPath(), circuitId, on), ['graph'])) return;
  // The copy that was selected is now part of the block (or the block is gone): select what is drawn in its place.
  if (on && stacksOf(state.getGraph()).has(circuitId)) state.select({ kind: 'node', id: stackCardId(circuitId) });
  else if (!on && circuitOfStackCard(state.getSelection()?.id ?? '') === circuitId) state.select(null);
}

export function addPinTo(state: EditorState, circuitId: string, dir: 'in' | 'out'): void {
  state.edit((b) => addPin(b, circuitId, dir)?.board ?? null);
}

export function removePin(state: EditorState, circuitId: string, pinId: string, notify: Notify): void {
  let dropped = 0;
  const done = state.edit((b) => {
    const res = deletePin(b, circuitId, pinId);
    dropped = res.dropped;
    return res.board;
  });
  if (done && dropped > 0) notify(T.pinWiresDropped(dropped));
}
