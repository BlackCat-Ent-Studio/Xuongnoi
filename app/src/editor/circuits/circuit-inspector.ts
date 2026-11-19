import { instanceNameOf, instancePorts, instanceValueKey, isInstance, isPinWired } from '../../circuits/instance';
import type { Circuit, GraphNode, ParamDef } from '../../engine/types';
import { INSTANCE_NAME_MAX } from '../../io/circuits-format';
import { h } from '../dom';
import type { EditorState } from '../editor-state';
import { PORT_TYPE_LABELS } from '../text-vi';
import { circuitFromSelection, openInstance, stackCopies, type Notify } from './circuit-actions';
import {
  CIRCUIT_NAME_MAX,
  cardLabel,
  circuitIdOf,
  circuitOfStackCard,
  countInstances,
  exposableParams,
  exposedView,
  findCircuit,
  instancesIn,
  isExposed,
  lookupOf,
  openCircuit,
  renameCircuit,
  setExposed,
  setInstanceName,
  stacksOf,
} from './circuit-model';
import { CIRCUIT_VI as T } from './circuit-text-vi';
import { buildInstanceView, circuitIcon, circuitTile, instanceTitle } from './circuit-views';
import { pinIdOfCard } from './circuit-wiring';

/** What the properties panel lends: its own setting row (so every editor looks the same) and its buttons. */
export interface InspectorKit {
  paramRow(def: ParamDef, node: GraphNode, playing: boolean): HTMLElement;
  notify: Notify;
}

const POSITION: ParamDef = { id: 'position', label: T.position, kind: 'vec3', default: { x: 0, y: 0, z: 0 }, step: 0.5 };
const HEADING: ParamDef = { id: 'heading', label: T.heading, kind: 'number', default: 0, min: -360, max: 360, step: 15 };

function button(label: string, className: string, disabled: boolean, onClick: () => void, title = ''): HTMLButtonElement {
  const b = h('button', `btn pn-btn${className}`, label);
  b.type = 'button';
  if (title) b.title = title;
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}

function head(circuit: Circuit | undefined, name: string, sub: string): HTMLElement {
  const box = h('div', 'pn-ihead ck-ihead');
  const names = h('div', 'pn-inames');
  names.append(h('div', 'prop-node-name pn-iname', name), h('div', 'pn-icat', sub));
  box.append(circuitTile(circuit, 'ck-itile'), names);
  return box;
}

function section(title: string, count?: number): HTMLElement {
  const sec = h('div', 'pn-sec');
  const hd = h('div', 'pn-sec-h', title);
  if (count !== undefined) hd.append(h('span', 'pn-sec-n', String(count)));
  sec.append(hd);
  return sec;
}

function infoNote(text: string, glyph: 'info' | 'lock' = 'info'): HTMLElement {
  const note = h('div', 'ck-note');
  note.append(circuitIcon(glyph), h('span', '', text));
  return note;
}

function pinList(circuit: Circuit): HTMLElement {
  const list = h('ul', 'ck-pins');
  for (const pin of circuit.pins) {
    const li = h('li');
    li.append(h('i', `pn-shape ${isPinWired(pin) ? `t-${pin.type}` : 'ck-none'}`), h('span', '', pin.label), h('em', '', isPinWired(pin) ? T.pinMeta(pin.dir, PORT_TYPE_LABELS[pin.type]) : T.pinUnwired));
    list.append(li);
  }
  return list;
}

function textField(label: string, value: string, placeholder: string, max: number, disabled: boolean, commit: (text: string) => void): HTMLElement {
  const row = h('label', 'prop-row pn-field pn-col');
  row.append(h('div', 'prop-label pn-label', label));
  const input = h('input', 'prop-input pn-text');
  input.type = 'text';
  input.value = value;
  input.placeholder = placeholder;
  input.maxLength = max;
  input.disabled = disabled;
  input.addEventListener('input', () => commit(input.value));
  row.append(input);
  return row;
}

// ---------- one copy ----------

function renderInstance(el: HTMLElement, state: EditorState, node: GraphNode, kit: InspectorKit): void {
  const board = state.getBoard();
  const graph = state.getGraph();
  const circuit = findCircuit(board, circuitIdOf(node));
  const playing = state.isPlaying();
  const locked = state.isReadOnly();
  const siblings = circuit ? instancesIn(graph, circuit.id) : [node];
  const name = instanceTitle(node, circuit);
  el.append(head(circuit, name, circuit ? T.instanceOf(siblings.indexOf(node) + 1, siblings.length, circuit.name) : T.lost));
  if (!circuit) return;

  const form = h('div', 'pn-sec');
  form.append(
    textField(T.ownName, instanceNameOf(node), T.ownNameHint(circuit.name), INSTANCE_NAME_MAX, locked, (text) => {
      void state.edit((b) => setInstanceName(b, state.getCircuitPath(), node.id, text), ['params'], `p:${node.id}:name`);
    }),
  );
  el.append(form);

  const values = section(T.ownValues(name));
  const rows = h('div', 'prop-form pn-form');
  for (const e of circuit.exposed) {
    const view = exposedView(board, circuit, e);
    if (!view) continue;
    rows.append(kit.paramRow({ ...view.def, id: instanceValueKey(e.id), label: e.label }, node, playing));
  }
  if (rows.childElementCount === 0) values.append(h('p', 'pn-desc pn-dim ck-flat', T.noExposed));
  else values.append(rows);
  el.append(values);

  const place = section(T.placeTitle);
  const placeForm = h('div', 'prop-form pn-form');
  placeForm.append(kit.paramRow(POSITION, node, playing), kit.paramRow(HEADING, node, playing));
  place.append(placeForm, h('p', 'pn-desc pn-dim ck-flat', T.placeHint));
  el.append(place);

  if (circuit.pins.length > 0) {
    const pins = section(T.pinsTitle, circuit.pins.length);
    pins.append(pinList(circuit));
    el.append(pins);
  }
  el.append(infoNote(T.changesAll(circuit.name, countInstances(board, circuit.id))));

  const actions = h('div', 'pn-actions');
  const open = button(T.openCircuit, ' ck-primary', false, () => void openInstance(state, node.id), T.openTip);
  open.append(circuitIcon('chev'));
  actions.append(open, button('Nhân đôi', '', locked, () => state.duplicate()));
  if (siblings.length >= 2) actions.append(button(T.stack(siblings.length), '', locked, () => stackCopies(state, circuit.id, true), T.stackTip));
  const danger = h('div', 'pn-danger');
  danger.append(button(T.deleteCopy, ' danger', locked, () => void state.deleteSelection()));
  el.append(actions, danger);
}

// ---------- a stacked block ----------

function renderStack(el: HTMLElement, state: EditorState, circuit: Circuit, members: readonly GraphNode[]): void {
  const locked = state.isReadOnly();
  el.append(head(circuit, T.stackTitle(circuit.name, members.length), T.stackSub(members.length)), h('p', 'pn-desc', T.stackBody));
  const sec = section(T.stackMembers, members.length);
  const list = h('ul', 'pn-members');
  for (const m of members) {
    const li = h('li');
    const b = h('button', 'pn-member');
    b.type = 'button';
    b.disabled = locked;
    b.append(circuitTile(circuit, 'ck-pal-ic small'), h('span', '', instanceTitle(m, circuit)));
    b.addEventListener('click', () => {
      stackCopies(state, circuit.id, false);
      state.select({ kind: 'node', id: m.id });
    });
    li.append(b);
    list.append(li);
  }
  sec.append(list);
  el.append(sec, infoNote(T.changesAll(circuit.name, countInstances(state.getBoard(), circuit.id))));
  const actions = h('div', 'pn-actions');
  const open = button(T.openCircuit, ' ck-primary', false, () => void state.enterCircuit({ circuit: circuit.id }), T.openTip);
  open.append(circuitIcon('chev'));
  actions.append(open, button(T.unstack, '', locked, () => stackCopies(state, circuit.id, false)));
  const danger = h('div', 'pn-danger');
  danger.append(button(T.deleteStack(members.length), ' danger', locked, () => void state.deleteSelection()));
  el.append(actions, danger);
}

// ---------- the entered circuit itself (nothing selected) ----------

function renderCircuit(el: HTMLElement, state: EditorState, circuit: Circuit): void {
  const board = state.getBoard();
  const locked = state.isReadOnly();
  el.append(head(circuit, T.circuitTitle(circuit.name), T.usedAt(countInstances(board, circuit.id))));
  const form = h('div', 'pn-sec');
  form.append(textField(T.nameLabel, circuit.name, '', CIRCUIT_NAME_MAX, locked, (text) => void state.edit((b) => renameCircuit(b, circuit.id, text), ['graph'], `cname:${circuit.id}`)));
  el.append(form);

  const look = section(T.outsideLook);
  const stage = h('div', 'ck-preview wc');
  const { box } = buildInstanceView({ id: 'preview', pos: { x: 0, y: 0 }, circuit, ports: instancePorts(circuit, lookupOf(board)), name: circuit.name, playing: state.isPlaying() });
  box.classList.add('ck-static');
  stage.append(box);
  look.append(stage, h('p', 'pn-desc pn-dim ck-flat', T.outsideHint));
  el.append(look);

  const pins = section(T.pinsTitle, circuit.pins.length);
  pins.append(circuit.pins.length > 0 ? pinList(circuit) : h('p', 'pn-desc pn-dim ck-flat', T.noPinsYet));
  el.append(pins);

  const exposed = section(T.exposedTitle, circuit.exposed.length);
  if (circuit.exposed.length === 0) exposed.append(h('p', 'pn-desc pn-dim ck-flat', T.noExposedYet));
  else {
    const list = h('ul', 'ck-pins');
    for (const e of circuit.exposed) {
      const view = exposedView(board, circuit, e);
      const li = h('li');
      li.append(h('i', 'pn-shape ck-param'), h('span', '', e.label), h('em', '', view ? T.exposedOf(view.nodeLabel, view.def.label) : ''));
      list.append(li);
    }
    exposed.append(list);
  }
  el.append(exposed);
}

// ---------- public hooks used by the properties panel ----------

/**
 * Draws the panel when the selection belongs to the circuit UI: a copy of a circuit, a stacked block, the wire of a pin, or
 * (inside a circuit with nothing selected) the circuit itself. Returns false when the normal panel should draw.
 */
export function renderCircuitInspector(el: HTMLElement, state: EditorState, kit: InspectorKit): boolean {
  const sel = state.getSelection();
  const board = state.getBoard();
  const graph = state.getGraph();
  const locked = state.isReadOnly() && !state.isPlaying();
  const lockNote = (): void => {
    if (locked) el.append(infoNote(T.lockedNote, 'lock'));
  };

  if (sel?.kind === 'node') {
    const stacked = circuitOfStackCard(sel.id);
    const circuit = stacked === null ? undefined : findCircuit(board, stacked);
    const members = stacked === null ? undefined : stacksOf(graph).get(stacked);
    if (circuit && members) {
      lockNote();
      renderStack(el, state, circuit, members);
      return true;
    }
    const node = graph.nodes.find((n) => n.id === sel.id);
    if (node && isInstance(node)) {
      lockNote();
      renderInstance(el, state, node, kit);
      return true;
    }
    return false;
  }
  const open = openCircuit(board, state.getCircuitPath());
  if (sel?.kind === 'wire') {
    const pin = open?.pins.find((p) => p.id === pinIdOfCard(sel.id));
    if (!open || !pin) return false;
    const node = open.graph.nodes.find((n) => n.id === pin.inner.node);
    lockNote();
    el.append(h('div', 'prop-node-name pn-iname pn-wire-name', T.pinWireTitle), h('p', 'pn-desc', T.pinWireBody(pin.label, node ? cardLabel(board, node) : '')));
    const danger = h('div', 'pn-danger');
    danger.append(button(T.pinWireDelete, ' danger', state.isReadOnly(), () => void state.deleteSelection()));
    el.append(danger);
    return true;
  }
  if (!sel && open && state.getMulti().size < 2) {
    lockNote();
    renderCircuit(el, state, open);
    return true;
  }
  return false;
}

/** "Mở ra ngoài": for a card inside the entered circuit, one switch per setting that the copies may then set for themselves. */
export function renderExposeSection(el: HTMLElement, state: EditorState, node: GraphNode): void {
  const circuit = openCircuit(state.getBoard(), state.getCircuitPath());
  if (!circuit) return;
  const params = exposableParams(state.getBoard(), node);
  if (params.length === 0) return;
  const locked = state.isReadOnly();
  const sec = section(T.exposeSection);
  for (const p of params) {
    const row = h('div', 'prop-row pn-field ck-expose');
    const on = isExposed(circuit, node.id, p.id);
    const sw = h('button', 'pn-switch');
    sw.type = 'button';
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', String(on));
    sw.setAttribute('aria-label', T.exposeSwitch(p.label));
    sw.disabled = locked;
    sw.addEventListener('click', () => void state.edit((b) => setExposed(b, circuit.id, node.id, p.id, !on)));
    row.append(h('div', 'prop-label pn-label', p.label), sw);
    sec.append(row);
  }
  sec.append(h('p', 'pn-desc pn-dim ck-flat', T.exposeHint));
  el.append(sec);
}

/** Adds "Tạo bảng mạch" to the panel shown for several selected cards. */
export function appendCreateCircuit(el: HTMLElement, state: EditorState, notify: Notify): void {
  const actions = el.querySelector('.pn-empty-state .pn-actions') ?? el;
  actions.append(button(T.multiCreate, '', state.isReadOnly(), () => void circuitFromSelection(state, notify), T.fromSelectionTip));
}

/** While a circuit is open view-only: says so and greys every control of the normal panel (jump links still work). */
export function applyCircuitLock(el: HTMLElement, state: EditorState): void {
  if (!state.isReadOnly() || state.isPlaying()) return;
  if (!el.querySelector('.ck-note')) el.querySelector('.pn-title')?.after(infoNote(T.lockedNote, 'lock'));
  for (const c of el.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>('input,button,select,textarea')) {
    if (c.closest('.pn-jump, .hb-help, .ck-primary') || c.classList.contains('pn-jump') || c.classList.contains('hb-help')) continue;
    c.disabled = true;
  }
}
