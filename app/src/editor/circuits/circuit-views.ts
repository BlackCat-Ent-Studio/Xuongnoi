import { instanceNameOf, isPinWired, type NodePorts } from '../../circuits/instance';
import type { Circuit, CircuitExposed, CircuitPin, GraphNode, PortDef } from '../../engine/types';
import { h } from '../dom';
import { GRAPH_TEXT, missingBadge } from '../graph/graph-text-vi';
import type { NodeViewResult } from '../graph/node-view';
import { inkOn } from '../theme/contrast';
import { PORT_TYPE_LABELS } from '../text-vi';
import { CIRCUIT_NAME_MAX, PIN_NAME_MAX } from './circuit-model';
import { CIRCUIT_VI as T } from './circuit-text-vi';
import { PIN_PORT, pinCardDir, pinCardId } from './circuit-wiring';

const SVG_NS = 'http://www.w3.org/2000/svg';

const GLYPHS = {
  /** A small board with two parts and a trace. */
  circuit: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="1.5"/><circle cx="16" cy="14" r="1.5"/><path d="M9.5 10H13v4h1.5M6.5 15h3"/>',
  chev: '<path d="M9.5 6l6 6-6 6"/>',
  back: '<path d="M14.5 6l-6 6 6 6"/>',
  up: '<path d="M6 14.5l6-6 6 6"/>',
  down: '<path d="M6 9.5l6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.01"/>',
  pencil: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
  enter: '<path d="M4 5v14M9 12h11M15.5 7.5L20 12l-4.5 4.5"/>',
  stack: '<rect x="4" y="9" width="13" height="10" rx="2"/><path d="M7.5 9V7a2 2 0 0 1 2-2H18a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-1"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  /** A test bench: a table with a part standing on it. */
  bench: '<path d="M3 13h18M6 13v7M18 13v7"/><rect x="8" y="5" width="8" height="8" rx="1.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4.5 5v4.2h4.2"/>',
  download: '<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 20h14"/>',
  upload: '<path d="M12 16V5M7.5 9L12 4.5 16.5 9M5 20h14"/>',
  star: '<path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.8 5.4-.7z"/>',
  drop: '<path d="M12 3.5c3 3.6 6 6.6 6 10a6 6 0 0 1-12 0c0-3.4 3-6.4 6-10z"/>',
} as const;

export type CircuitGlyph = keyof typeof GLYPHS;

/** Outline icon on a 24px grid, drawn in the text colour of where it sits. */
export function circuitIcon(name: CircuitGlyph): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'ck-ic');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = GLYPHS[name];
  return svg;
}

/** Square icon button with a tooltip that is also its spoken name. */
export function iconButton(glyph: CircuitGlyph, label: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = h('button', className);
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.append(circuitIcon(glyph));
  b.addEventListener('click', onClick);
  return b;
}

/** The rounded-square icon of a circuit, with a dot in the circuit's own colour when it has one. */
export function circuitTile(circuit: Pick<Circuit, 'color'> | undefined, className = 'wc-inst-ic'): HTMLElement {
  const tile = h('span', className);
  tile.append(circuitIcon('circuit'));
  if (circuit?.color) {
    const dot = h('i', 'wc-inst-col');
    dot.style.background = circuit.color;
    dot.style.color = inkOn(circuit.color);
    tile.append(dot);
  }
  return tile;
}

// ---------- the block of one copy (or of a stack of copies) ----------

export interface InstanceViewOpts {
  /** The card id on the canvas: the copy's node id, or the stack card id. */
  id: string;
  pos: { x: number; y: number };
  circuit: Circuit | undefined;
  /** Ports of the copy, from its circuit's pins. */
  ports: NodePorts;
  /** Name on the block: the copy's own, else the circuit's. */
  name: string;
  playing: boolean;
  /** Input pins that need a wire and have none. */
  missing?: ReadonlySet<string>;
  /** Present for a stack: how many copies it stands for. Its ports cannot be wired until it is spread out. */
  stack?: { count: number; onSpread: () => void };
  /** Node the port rows wire to; absent for a stack and for the preview in the side panel. */
  wireNode?: string;
  onOpen?: () => void;
}

function pinRow(port: PortDef, dir: 'in' | 'out', wireNode: string | undefined, missing: boolean, stacked: boolean): { row: HTMLElement; dot: HTMLElement } {
  const row = h('div', `wc-port ${dir}${missing ? ' missing' : ''}${wireNode ? '' : ' wc-port-fixed'}`);
  if (wireNode) {
    row.dataset.node = wireNode;
    row.dataset.port = port.id;
    row.dataset.dir = dir;
  }
  row.dataset.type = port.type;
  const dot = h('span', `wc-dot type-${port.type}`);
  row.append(dot, h('span', 'wc-pl', port.label));
  if (missing) row.append(h('span', 'wc-need', GRAPH_TEXT.needWire));
  row.title = stacked ? T.stackPortTip : `${port.label} · ${PORT_TYPE_LABELS[port.type]}`;
  return { row, dot };
}

/**
 * One copy of a circuit on the board, in the "Thẻ thiết bị" look: tinted header with the circuit icon, the name, a status
 * light with its word, the "Mở" button, then the pins: inputs left, outputs right, side by side.
 */
export function buildInstanceView(o: InstanceViewOpts): NodeViewResult {
  const box = h('div', `wc-node wc-inst${o.stack ? ' wc-inst-stack' : ''}`);
  box.dataset.id = o.id;
  box.dataset.kind = 'circuit';
  box.style.left = `${o.pos.x}px`;
  box.style.top = `${o.pos.y}px`;

  const head = h('div', 'wc-inst-head');
  head.title = o.circuit ? T.copyOf(o.circuit.name) : T.lost;
  const title = h('span', 'wc-title');
  const status = h('small', 'wc-sub wc-inst-status');
  status.append(h('i', `wc-led${o.playing ? ' on' : ''}`), h('span', '', o.stack ? T.stackSub(o.stack.count) : o.playing ? T.running : T.stopped));
  title.append(h('b', 'wc-name', o.name), status);
  head.append(circuitTile(o.circuit), title);
  const missing = o.missing?.size ?? 0;
  if (missing > 0) {
    head.append(h('span', 'wc-miss-badge', missingBadge(missing)));
    box.classList.add('wc-err');
  }
  if (o.stack) {
    const spread = o.stack.onSpread;
    const count = h('button', 'wc-inst-count wc-ui', T.stackCount(o.stack.count));
    count.type = 'button';
    count.title = T.stackOpenTip(o.stack.count);
    count.addEventListener('click', spread);
    head.append(count);
  }
  if (o.onOpen && o.circuit) {
    const onOpen = o.onOpen;
    const open = h('button', 'wc-inst-open wc-ui');
    open.type = 'button';
    open.title = T.openTip;
    open.append(h('span', '', T.open), circuitIcon('chev'));
    open.addEventListener('click', onOpen);
    head.append(open);
  }
  box.append(head);

  const dots = new Map<string, HTMLElement>();
  const { inputs, outputs } = o.ports;
  if (inputs.length + outputs.length === 0) {
    box.append(h('div', 'wc-inst-none', o.circuit ? T.noPins : T.lost));
    return { box, dots };
  }
  const body = h('div', 'wc-inst-ports');
  const sides: ['in' | 'out', PortDef[]][] = [
    ['in', inputs],
    ['out', outputs],
  ];
  for (const [dir, ports] of sides) {
    const list = h('div', `wc-ports ${dir}s`);
    for (const p of ports) {
      const { row, dot } = pinRow(p, dir, o.wireNode, dir === 'in' && (o.missing?.has(p.id) ?? false), o.stack !== undefined);
      dots.set(`${dir}|${p.id}`, dot);
      list.append(row);
    }
    body.append(list);
  }
  box.append(body);
  return { box, dots };
}

/** Name a copy shows on its block. */
export function instanceTitle(node: GraphNode, circuit: Circuit | undefined): string {
  return instanceNameOf(node) || circuit?.name || T.lost;
}

// ---------- pin cards and "Thông số mở" cards at the edge of an entered circuit ----------

export interface PinCardHandlers {
  rename(pinId: string, label: string): void;
  move(pinId: string, delta: -1 | 1): void;
  remove(pinId: string): void;
}

/** Keeps a name box from triggering board shortcuts and commits on Enter / blur. */
function nameInput(value: string, max: number, label: string, disabled: boolean, commit: (text: string) => void): HTMLInputElement {
  const input = h('input', 'wc-pin-name wc-ui');
  input.type = 'text';
  input.value = value;
  input.maxLength = max;
  input.disabled = disabled;
  input.setAttribute('aria-label', label);
  input.addEventListener('change', () => commit(input.value));
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') input.blur();
    else if (e.key === 'Escape') {
      input.value = value;
      input.blur();
    }
  });
  return input;
}

/**
 * One pin of the entered circuit as a card at the edge of the board. Its round port is where the wire to an inner card
 * starts ('in') or ends ('out'); the type chip shows what the wired inner port carries.
 */
export function buildPinCard(pin: CircuitPin, index: number, count: number, readOnly: boolean, on: PinCardHandlers): { el: HTMLElement; dot: HTMLElement } {
  const el = h('div', `wc-pin ${pin.dir}`);
  el.dataset.pin = pin.id;
  const head = h('div', 'wc-pin-head');
  head.append(h('span', '', T.pinIndex(pin.dir, index + 1)));
  if (!readOnly) {
    const tools = h('span', 'wc-pin-tools wc-ui');
    const up = iconButton('up', T.pinUp, 'wc-pin-tool', () => on.move(pin.id, -1));
    up.disabled = index === 0;
    const down = iconButton('down', T.pinDown, 'wc-pin-tool', () => on.move(pin.id, 1));
    down.disabled = index === count - 1;
    tools.append(up, down, iconButton('close', T.pinDelete, 'wc-pin-tool', () => on.remove(pin.id)));
    head.append(tools);
  }

  const wired = isPinWired(pin);
  const body = h('div', 'wc-pin-body');
  const type = h('span', `wc-pin-type${wired ? ` type-${pin.type}` : ' none'}`, wired ? PORT_TYPE_LABELS[pin.type] : T.pinUnwired);
  type.title = wired ? PORT_TYPE_LABELS[pin.type] : T.pinUnwiredTip;
  const name = nameInput(pin.label, PIN_NAME_MAX, T.pinName, readOnly, (text) => on.rename(pin.id, text));
  const dir = pinCardDir(pin);
  const row = h('div', `wc-port ${dir} wc-pin-port${wired ? '' : ' missing'}`);
  row.dataset.node = pinCardId(pin.id);
  row.dataset.port = PIN_PORT;
  row.dataset.dir = dir;
  row.dataset.type = pin.type;
  row.title = T.pinDotTip(pin.dir);
  const dot = h('span', `wc-dot type-${pin.type}`);
  row.append(dot);
  if (pin.dir === 'in') body.append(type, name, row);
  else body.append(row, name, type);
  el.append(head, body);
  return { el, dot };
}

export interface ExposedCardHandlers {
  rename(exposedId: string, label: string): void;
  remove(exposedId: string): void;
  jump(nodeId: string): void;
}

/** One exposed setting of the entered circuit: its name on the copies, and the inner card and setting it opens. */
export function buildExposedCard(exposed: CircuitExposed, of: string, readOnly: boolean, on: ExposedCardHandlers): HTMLElement {
  const el = h('div', 'wc-pin param');
  el.dataset.exposed = exposed.id;
  const head = h('div', 'wc-pin-head');
  head.append(h('span', '', T.exposedTitle));
  if (!readOnly) {
    const tools = h('span', 'wc-pin-tools wc-ui');
    tools.append(iconButton('close', T.exposedDelete, 'wc-pin-tool', () => on.remove(exposed.id)));
    head.append(tools);
  }
  const body = h('div', 'wc-pin-body');
  body.append(nameInput(exposed.label, PIN_NAME_MAX, T.exposedName, readOnly, (text) => on.rename(exposed.id, text)));
  const from = h('button', 'wc-pin-of wc-ui', of);
  from.type = 'button';
  from.title = T.exposedJump;
  from.addEventListener('click', () => on.jump(exposed.inner.node));
  el.append(head, body, from);
  return el;
}

/** The dashed "Thêm chân vào / ra" button under a column of pin cards. */
export function buildAddPinButton(dir: 'in' | 'out', onClick: () => void): HTMLButtonElement {
  const b = h('button', 'wc-pin-add wc-ui');
  b.type = 'button';
  b.append(circuitIcon('plus'), h('span', '', dir === 'in' ? T.addPinIn : T.addPinOut));
  b.addEventListener('click', onClick);
  return b;
}

export { CIRCUIT_NAME_MAX };
