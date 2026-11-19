import { canConnectIn, isInstance, isPinWired, portsOfNode } from '../../circuits/instance';
import { CONNECT_FAIL_TEXT } from '../../engine/text-vi';
import type { Board, Circuit, CircuitPin, ConnectResult, Graph, PortDef, PortRef, PortType, Wire } from '../../engine/types';
import { addWire, removeWire } from '../../engine/wiring';
import { typeMismatchText } from '../graph/graph-text-vi';
import type { Compat, PortDir } from '../graph/port-compat';
import { lookupOf, openCircuit, openGraph, unwirePin, wirePin, withOpenGraph, type CircuitPath } from './circuit-model';

/**
 * Wiring on the open graph when it may hold copies of circuits and, inside a circuit, its pin cards.
 *
 * Inside a circuit each pin is drawn as a card at the edge of the board. For the canvas that card is a pretend node
 * `@pin:<id>` with one port `pin`: an 'in' pin gives a value to the inside, so its port is an output there; an 'out' pin takes
 * one, so its port is an input. The pretend wire `@pin:<id>` between the card and the inner port is the pin's `inner`.
 */

type ConnectFailure = Extract<ConnectResult, { ok: false }>;

export const PIN_PREFIX = '@pin:';
export const PIN_PORT = 'pin';
export const pinCardId = (pinId: string): string => `${PIN_PREFIX}${pinId}`;
export const pinIdOfCard = (id: string): string | null => (id.startsWith(PIN_PREFIX) ? id.slice(PIN_PREFIX.length) : null);
/** Which way a pin card's own port faces on the canvas inside the circuit. */
export const pinCardDir = (pin: Pick<CircuitPin, 'dir'>): PortDir => (pin.dir === 'in' ? 'out' : 'in');

/** The pretend wire from a pin card to the inner port it stands for; null while the pin is not wired. */
export function pinWire(pin: CircuitPin): Wire | null {
  if (!isPinWired(pin)) return null;
  const card: PortRef = { node: pinCardId(pin.id), port: PIN_PORT };
  const inner: PortRef = { node: pin.inner.node, port: pin.inner.port };
  return pin.dir === 'in' ? { id: pinCardId(pin.id), from: card, to: inner } : { id: pinCardId(pin.id), from: inner, to: card };
}

/** Every wire the canvas draws for the open graph: its own, then the pin wires of the entered circuit. */
export function sceneWires(board: Board, path: CircuitPath): Wire[] {
  const circuit = openCircuit(board, path);
  const graph = circuit?.graph ?? board.graph;
  if (!circuit || circuit.pins.length === 0) return graph.wires;
  return [...graph.wires, ...circuit.pins.flatMap((p) => pinWire(p) ?? [])];
}

/** One port of a card on the open graph (a plain card, a copy, or a pin card), or null when there is no such port. */
export function portOf(board: Board, path: CircuitPath, ref: PortRef, dir: PortDir): PortDef | null {
  const pinId = pinIdOfCard(ref.node);
  if (pinId !== null) {
    const pin = openCircuit(board, path)?.pins.find((p) => p.id === pinId);
    return pin && ref.port === PIN_PORT && pinCardDir(pin) === dir ? { id: PIN_PORT, type: pin.type, label: pin.label } : null;
  }
  const node = openGraph(board, path).nodes.find((n) => n.id === ref.node);
  const ports = node && portsOfNode(node, lookupOf(board));
  return (dir === 'in' ? ports?.inputs : ports?.outputs)?.find((p) => p.id === ref.port) ?? null;
}

/** Type of the value a drawn wire carries, or null when its source port does not exist. */
export function wireTypeIn(board: Board, path: CircuitPath, wire: Wire): PortType | null {
  return portOf(board, path, wire.from, 'out')?.type ?? null;
}

function pinEnd(circuit: Circuit | undefined, from: PortRef, to: PortRef): { pin: CircuitPin; inner: PortRef } | 'two-pins' | null {
  const a = pinIdOfCard(from.node);
  const b = pinIdOfCard(to.node);
  if (a === null && b === null) return null;
  if (a !== null && b !== null) return 'two-pins';
  const pin = circuit?.pins.find((p) => p.id === (a ?? b));
  // An 'in' pin feeds an inner input, so it can only be the source; an 'out' pin only the target.
  if (!pin || (a !== null) !== (pin.dir === 'in')) return 'two-pins';
  return { pin, inner: a !== null ? to : from };
}

/**
 * Can a wire be dragged between these two ports of the open graph (either way round)? An input that already has a wire
 * counts as fine: dropping there replaces the old wire. A pin card takes any inner port of the right direction.
 */
export function checkPairIn(board: Board, path: CircuitPath, a: PortRef, aDir: PortDir, b: PortRef, bDir: PortDir): Compat {
  if (aDir === bDir) return { ok: false, message: CONNECT_FAIL_TEXT['wrong-direction'] };
  const [from, to] = aDir === 'out' ? [a, b] : [b, a];
  const circuit = openCircuit(board, path);
  const viaPin = pinEnd(circuit, from, to);
  if (viaPin === 'two-pins') return { ok: false, message: PIN_FAIL_TEXT.twoPins };
  if (viaPin) {
    const inner = portOf(board, path, viaPin.inner, viaPin.pin.dir === 'in' ? 'in' : 'out');
    if (!inner) return { ok: false, message: CONNECT_FAIL_TEXT['unknown-port'] };
    return circuit?.benchIds.includes(viaPin.inner.node) ? { ok: false, message: PIN_FAIL_TEXT.bench } : { ok: true };
  }
  const res = canConnectIn(openGraph(board, path), from, to, lookupOf(board));
  if (res.ok || res.reason === 'input-taken') return { ok: true };
  if (res.reason === 'type-mismatch') {
    const f = portOf(board, path, from, 'out');
    const t = portOf(board, path, to, 'in');
    if (f && t) return { ok: false, message: typeMismatchText(f.label, f.type, t.label, t.type) };
  }
  return { ok: false, message: CONNECT_FAIL_TEXT[res.reason] };
}

export const PIN_FAIL_TEXT = {
  twoPins: 'Chân chỉ nối vào mảnh ghép ở bên trong, không nối thẳng sang chân khác.',
  bench: 'Mảnh ghép này chỉ dùng để chạy thử nên không nối với chân được.',
} as const;

function freshWireId(graph: Graph): string {
  const used = new Set(graph.wires.map((w) => w.id));
  let i = graph.wires.length + 1;
  while (used.has(`w${i}`)) i++;
  return `w${i}`;
}

export type ConnectInResult = { ok: true; board: Board; dropped: number } | ConnectFailure;

/**
 * Adds a wire on the open graph. `replace`: an input that already has a wire lets the old one go first. Inside a circuit a
 * wire from or to a pin card points the pin at that inner port, and a plain wire onto an input that an 'in' pin fed makes the
 * pin let go. `dropped`: outside wires removed because a pin changed type.
 */
export function connectIn(board: Board, path: CircuitPath, from: PortRef, to: PortRef, opts: { replace?: boolean } = {}): ConnectInResult {
  const circuit = openCircuit(board, path);
  const viaPin = pinEnd(circuit, from, to);
  if (viaPin === 'two-pins') return { ok: false, reason: 'wrong-direction' };
  if (viaPin && circuit) {
    const res = wirePin(board, circuit.id, viaPin.pin.id, viaPin.inner);
    return res.ok ? res : { ok: false, reason: res.reason };
  }
  let graph = openGraph(board, path);
  if (opts.replace) {
    const old = graph.wires.find((w) => w.to.node === to.node && w.to.port === to.port);
    if (old) graph = removeWire(graph, old.id);
  }
  const fromNode = graph.nodes.find((n) => n.id === from.node);
  const toNode = graph.nodes.find((n) => n.id === to.node);
  let nextGraph: Graph;
  if ((fromNode && isInstance(fromNode)) || (toNode && isInstance(toNode))) {
    const res = canConnectIn(graph, from, to, lookupOf(board));
    if (!res.ok) return res;
    nextGraph = { ...graph, wires: [...graph.wires, { id: freshWireId(graph), from: { ...from }, to: { ...to } }] };
  } else {
    const res = addWire(graph, from, to);
    if ('ok' in res) return res;
    nextGraph = res;
  }
  let next = withOpenGraph(board, path, nextGraph);
  // The input now has a wire of the circuit's own: an 'in' pin that fed it would be overruled on every copy, so it lets go.
  // A wire from a bench card is different: it exists only on the bench, so the pin keeps the port in every copy.
  for (const pin of circuit?.pins ?? []) {
    if (pin.dir === 'in' && pin.inner.node === to.node && pin.inner.port === to.port && !circuit!.benchIds.includes(from.node)) next = unwirePin(next, circuit!.id, pin.id);
  }
  return { ok: true, board: next, dropped: 0 };
}

/** Removes a drawn wire: a wire of the open graph, or (inside a circuit) the link between a pin card and its inner port. */
export function removeWireIn(board: Board, path: CircuitPath, wireId: string): Board {
  const pinId = pinIdOfCard(wireId);
  const circuit = openCircuit(board, path);
  if (pinId !== null) return circuit ? unwirePin(board, circuit.id, pinId) : board;
  return withOpenGraph(board, path, removeWire(openGraph(board, path), wireId));
}

/** Does this drawn wire still exist on the open graph? */
export function hasWireIn(board: Board, path: CircuitPath, wireId: string): boolean {
  const pinId = pinIdOfCard(wireId);
  if (pinId === null) return openGraph(board, path).wires.some((w) => w.id === wireId);
  return openCircuit(board, path)?.pins.some((p) => p.id === pinId && isPinWired(p)) ?? false;
}
