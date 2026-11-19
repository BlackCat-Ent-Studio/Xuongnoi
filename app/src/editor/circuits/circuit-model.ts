import {
  INSTANCE_CIRCUIT,
  MAX_CIRCUIT_DEPTH,
  UNWIRED_PIN,
  circuitLookup,
  exposedIdOfKey,
  instanceParams,
  instanceValueKey,
  isInstance,
  isPinWired,
  portsOfNode,
  type CircuitLookup,
} from '../../circuits/instance';
import { expandBoard } from '../../circuits/expand';
import { validateCircuits } from '../../circuits/validate';
import { compileGraph } from '../../engine/compile';
import { getNodeDef } from '../../engine/registry';
import {
  CIRCUIT_KIND,
  type Board,
  type Circuit,
  type CircuitExposed,
  type CircuitPin,
  type Graph,
  type GraphNode,
  type ParamDef,
  type PortRef,
  type PortType,
  type Wire,
} from '../../engine/types';
import { removeNode } from '../../engine/wiring';
import { pruneGraphKnots } from '../graph/board-knots';
import { nextNodeId } from '../node-ids';

/**
 * Pure helpers for "Bảng mạch" in the editor: every function takes a board and returns a new one (or the same object when
 * there is nothing to do). A circuit is a board type; each `circuit` node naming it is one copy, so editing the circuit
 * changes every copy.
 */

/** One level the canvas went into: the circuit, and the copy it was opened through (absent when opened from the library). */
export interface CircuitStep {
  circuit: string;
  via?: string;
}
export type CircuitPath = readonly CircuitStep[];

export const CIRCUIT_NAME_MAX = 40;
export const PIN_NAME_MAX = 28;

export const circuitsOf = (board: Pick<Board, 'circuits'>): readonly Circuit[] => board.circuits ?? [];
export const lookupOf = (board: Pick<Board, 'circuits'>): CircuitLookup => circuitLookup(board.circuits);
export const findCircuit = (board: Pick<Board, 'circuits'>, id: string): Circuit | undefined => board.circuits?.find((c) => c.id === id);
export const circuitIdOf = (node: GraphNode): string => String(node.params[INSTANCE_CIRCUIT] ?? '');

/** Board with these circuits; the field is dropped when empty so boards without circuits save exactly as before. */
export function withCircuits(board: Board, circuits: readonly Circuit[]): Board {
  const { circuits: _old, ...rest } = board;
  return circuits.length > 0 ? { ...rest, circuits: [...circuits] } : rest;
}

export function patchCircuit(board: Board, id: string, change: (c: Circuit) => Circuit): Board {
  let touched = false;
  const circuits = circuitsOf(board).map((c) => {
    if (c.id !== id) return c;
    const next = change(c);
    if (next !== c) touched = true;
    return next;
  });
  return touched ? withCircuits(board, circuits) : board;
}

// ---------- what the canvas has open ----------

export const openCircuit = (board: Board, path: CircuitPath): Circuit | undefined => {
  const last = path[path.length - 1];
  return last ? findCircuit(board, last.circuit) : undefined;
};

/** The graph the canvas shows and edits: the main board's, or the entered circuit's. */
export function openGraph(board: Board, path: CircuitPath): Graph {
  return openCircuit(board, path)?.graph ?? board.graph;
}

export function withOpenGraph(board: Board, path: CircuitPath, graph: Graph): Board {
  const last = path[path.length - 1];
  if (!last) return graph === board.graph ? board : { ...board, graph };
  return patchCircuit(board, last.circuit, (c) => (c.graph === graph ? c : { ...c, graph }));
}

/** The path cut where a circuit no longer exists (after an undo or a delete). The same array when nothing was cut. */
export function cleanPath(board: Board, path: CircuitPath): CircuitPath {
  const at = path.findIndex((step) => !findCircuit(board, step.circuit));
  return at < 0 ? path : path.slice(0, at);
}

// ---------- names and ids ----------

export const cleanCircuitName = (name: string): string => name.replace(/\s+/g, ' ').trim().slice(0, CIRCUIT_NAME_MAX);
export const cleanPinName = (name: string): string => name.replace(/\s+/g, ' ').trim().slice(0, PIN_NAME_MAX);

function freshId(used: ReadonlySet<string>, prefix: string): string {
  let i = used.size + 1;
  while (used.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

/** `base`, or `base 2`, `base 3`... the first one nobody in `taken` has. */
function freshName(taken: ReadonlySet<string>, base: string, max: number): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const tail = ` ${i}`;
    const name = `${base.slice(0, max - tail.length)}${tail}`;
    if (!taken.has(name)) return name;
  }
}

const circuitNames = (board: Board, except?: string): Set<string> => new Set(circuitsOf(board).filter((c) => c.id !== except).map((c) => c.name));

// ---------- copies ----------

/** Every graph of the board: the main one (`owner` null) and each circuit's. */
export function allGraphs(board: Board): { owner: string | null; graph: Graph }[] {
  return [{ owner: null, graph: board.graph }, ...circuitsOf(board).map((c) => ({ owner: c.id, graph: c.graph }))];
}

export const instancesIn = (graph: Graph, circuitId: string): GraphNode[] => graph.nodes.filter((n) => isInstance(n) && circuitIdOf(n) === circuitId);

/** How many copies of the circuit are drawn anywhere (on the main board and inside other circuits). */
export function countInstances(board: Board, circuitId: string): number {
  return allGraphs(board).reduce((n, g) => n + instancesIn(g.graph, circuitId).length, 0);
}

/**
 * An id for a new card on the open graph. On the main board it also stays clear of note and group ids: the canvas tells its
 * items apart by id, and shipped boards have notes named like cards ("n1").
 */
function freshCardId(board: Board, path: CircuitPath, graph: Graph): string {
  const taken = new Set(graph.nodes.map((n) => n.id));
  if (path.length === 0) {
    for (const n of board.notes ?? []) taken.add(n.id);
    for (const g of graph.groups ?? []) taken.add(g.id);
  }
  const first = nextNodeId(graph);
  if (!taken.has(first)) return first;
  let i = Number(first.slice(1)) + 1;
  while (taken.has(`n${i}`)) i++;
  return `n${i}`;
}

export type PlaceFail = 'unknown-circuit' | 'cycle' | 'too-deep';

const NESTING_CODES: ReadonlySet<string> = new Set(['cycle', 'too-deep']);

/** Why the board would stop working with this change, or null: a circuit that ends up inside itself, or nesting that got too deep. */
function nestingFail(before: Board, after: Board): PlaceFail | null {
  const had = new Set(validateCircuits(before).filter((i) => NESTING_CODES.has(i.code)).map((i) => JSON.stringify(i)));
  const fresh = validateCircuits(after).find((i) => NESTING_CODES.has(i.code) && !had.has(JSON.stringify(i)));
  return fresh ? (fresh.code as PlaceFail) : null;
}

export type AddInstanceResult = { ok: true; board: Board; nodeId: string } | { ok: false; reason: PlaceFail };

/** Puts one more copy of a circuit on the open graph. */
export function addInstance(board: Board, path: CircuitPath, circuitId: string, pos: { x: number; y: number }): AddInstanceResult {
  if (!findCircuit(board, circuitId)) return { ok: false, reason: 'unknown-circuit' };
  const graph = openGraph(board, path);
  const node: GraphNode = { id: freshCardId(board, path, graph), kind: CIRCUIT_KIND, params: instanceParams(circuitId), pos: { x: Math.round(pos.x), y: Math.round(pos.y) } };
  const next = withOpenGraph(board, path, { ...graph, nodes: [...graph.nodes, node] });
  const fail = nestingFail(board, next);
  return fail ? { ok: false, reason: fail } : { ok: true, board: next, nodeId: node.id };
}

/** Nodes of a clip that may be pasted into the open graph: copies of circuits that are gone, or that would nest a circuit in itself, are left out. */
export function pasteableGraph(board: Board, path: CircuitPath, clip: Graph): Graph {
  const host = openGraph(board, path);
  const keep = clip.nodes.filter((n) => {
    if (!isInstance(n)) return true;
    if (!findCircuit(board, circuitIdOf(n))) return false;
    const probe: GraphNode = { ...n, id: nextNodeId(host) };
    return nestingFail(board, withOpenGraph(board, path, { ...host, nodes: [...host.nodes, probe] })) === null;
  });
  if (keep.length === clip.nodes.length) return clip;
  const ids = new Set(keep.map((n) => n.id));
  return { ...clip, nodes: keep, wires: clip.wires.filter((w) => ids.has(w.from.node) && ids.has(w.to.node)) };
}

// ---------- stacks ("Xe AGV ×8") ----------

export const STACK_PREFIX = '@stack:';
export const stackCardId = (circuitId: string): string => `${STACK_PREFIX}${circuitId}`;
export const circuitOfStackCard = (id: string): string | null => (id.startsWith(STACK_PREFIX) ? id.slice(STACK_PREFIX.length) : null);

function withStacks(graph: Graph, stacks: readonly string[]): Graph {
  const { stacks: _old, ...rest } = graph;
  return stacks.length > 0 ? { ...rest, stacks: [...stacks] } : rest;
}

/** Circuits drawn as one stacked block on this graph, with their copies: only those that really have two or more. */
export function stacksOf(graph: Graph): Map<string, GraphNode[]> {
  const out = new Map<string, GraphNode[]>();
  for (const id of graph.stacks ?? []) {
    const members = instancesIn(graph, id);
    if (members.length >= 2) out.set(id, members);
  }
  return out;
}

/** Where a stacked block stands: on its first copy. Dragging the block moves every copy by the same amount. */
export const stackAnchor = (members: readonly GraphNode[]): { x: number; y: number } => ({ x: members[0]?.pos.x ?? 0, y: members[0]?.pos.y ?? 0 });

/** Card ids with every stacked block replaced by the copies it stands for. */
export function spreadStackIds(graph: Graph, ids: Iterable<string>): Set<string> {
  const stacks = graph.stacks ? stacksOf(graph) : null;
  const out = new Set<string>();
  for (const id of ids) {
    const members = stacks?.get(circuitOfStackCard(id) ?? '');
    if (members) for (const m of members) out.add(m.id);
    else out.add(id);
  }
  return out;
}

/**
 * The graph as the canvas lays it out when copies are stacked: one pretend node per stacked block stands in for its copies
 * and their wires are re-pointed at it. The same graph when nothing is stacked.
 */
export function stackScene(graph: Graph): Graph {
  const stacks = graph.stacks ? stacksOf(graph) : null;
  if (!stacks || stacks.size === 0) return graph;
  const owner = new Map<string, string>();
  const blocks: GraphNode[] = [];
  for (const [circuitId, members] of stacks) {
    for (const m of members) owner.set(m.id, stackCardId(circuitId));
    blocks.push({ id: stackCardId(circuitId), kind: CIRCUIT_KIND, params: members[0]!.params, pos: stackAnchor(members) });
  }
  return {
    nodes: [...graph.nodes.filter((n) => !owner.has(n.id)), ...blocks],
    wires: graph.wires.map((w) => ({ id: w.id, from: { node: owner.get(w.from.node) ?? w.from.node, port: w.from.port }, to: { node: owner.get(w.to.node) ?? w.to.node, port: w.to.port } })),
  };
}

/** Draw the copies of one circuit on the open graph as one stacked block (`on`), or each on its own again. */
export function setStacked(board: Board, path: CircuitPath, circuitId: string, on: boolean): Board {
  const graph = openGraph(board, path);
  const have = graph.stacks ?? [];
  if (have.includes(circuitId) === on) return board;
  return withOpenGraph(board, path, withStacks(graph, on ? [...have, circuitId] : have.filter((id) => id !== circuitId)));
}

// ---------- pins ----------

export const PIN_TEXT = {
  in: 'Chân vào',
  out: 'Chân ra',
} as const;

function freshPinLabel(circuit: Circuit, base: string, except?: string): string {
  return freshName(new Set(circuit.pins.filter((p) => p.id !== except).map((p) => p.label)), base, PIN_NAME_MAX);
}

export function addPin(board: Board, circuitId: string, dir: 'in' | 'out'): { board: Board; pinId: string } | null {
  const circuit = findCircuit(board, circuitId);
  if (!circuit) return null;
  const id = freshId(new Set(circuit.pins.map((p) => p.id)), 'p');
  const count = circuit.pins.filter((p) => p.dir === dir).length;
  const pin: CircuitPin = { id, label: freshPinLabel(circuit, `${PIN_TEXT[dir]} ${count + 1}`), dir, type: 'bool', inner: { ...UNWIRED_PIN } };
  return { board: patchCircuit(board, circuitId, (c) => ({ ...c, pins: [...c.pins, pin] })), pinId: id };
}

export function renamePin(board: Board, circuitId: string, pinId: string, label: string): Board {
  const clean = cleanPinName(label);
  return patchCircuit(board, circuitId, (c) => {
    const pin = c.pins.find((p) => p.id === pinId);
    if (!pin || !clean || clean === pin.label) return c;
    return { ...c, pins: c.pins.map((p) => (p.id === pinId ? { ...p, label: clean } : p)) };
  });
}

/** Moves a pin one place up (-1) or down (+1) among the pins of its own side; the copies list their ports in the same order. */
export function movePin(board: Board, circuitId: string, pinId: string, delta: -1 | 1): Board {
  return patchCircuit(board, circuitId, (c) => {
    const pin = c.pins.find((p) => p.id === pinId);
    if (!pin) return c;
    const side = c.pins.filter((p) => p.dir === pin.dir);
    const other = side[side.indexOf(pin) + delta];
    if (!other) return c;
    return { ...c, pins: c.pins.map((p) => (p === pin ? other : p === other ? pin : p)) };
  });
}

/**
 * Takes every outside wire off one pin, on every copy of the circuit, and lets go of the pins of other circuits that only
 * passed it on. `dropped` counts the wires removed.
 */
function dropPinWires(board: Board, circuitId: string, pinId: string, dir: 'in' | 'out'): { board: Board; dropped: number } {
  let dropped = 0;
  const clean = (graph: Graph): Graph => {
    const copies = new Set(instancesIn(graph, circuitId).map((n) => n.id));
    if (copies.size === 0) return graph;
    const wires = graph.wires.filter((w) => {
      const end = dir === 'in' ? w.to : w.from;
      return !(copies.has(end.node) && end.port === pinId);
    });
    if (wires.length === graph.wires.length) return graph;
    dropped += graph.wires.length - wires.length;
    return { ...graph, wires };
  };
  let next: Board = board;
  const main = clean(board.graph);
  if (main !== board.graph) next = { ...next, graph: main };
  const circuits = circuitsOf(board).map((c) => {
    const graph = clean(c.graph);
    const copies = new Set(instancesIn(c.graph, circuitId).map((n) => n.id));
    const pins = c.pins.map((p) => (p.dir === dir && copies.has(p.inner.node) && p.inner.port === pinId ? { ...p, inner: { ...UNWIRED_PIN } } : p));
    const pinsChanged = pins.some((p, i) => p !== c.pins[i]);
    return graph === c.graph && !pinsChanged ? c : { ...c, graph, pins: pinsChanged ? pins : c.pins };
  });
  if (circuits.some((c, i) => c !== circuitsOf(board)[i])) next = withCircuits(next, circuits);
  return { board: next, dropped };
}

/** Removes a pin and every outside wire that was on it. */
export function deletePin(board: Board, circuitId: string, pinId: string): { board: Board; dropped: number } {
  const pin = findCircuit(board, circuitId)?.pins.find((p) => p.id === pinId);
  if (!pin) return { board, dropped: 0 };
  const res = dropPinWires(board, circuitId, pinId, pin.dir);
  return { board: patchCircuit(res.board, circuitId, (c) => ({ ...c, pins: c.pins.filter((p) => p.id !== pinId) })), dropped: res.dropped };
}

export function unwirePin(board: Board, circuitId: string, pinId: string): Board {
  return patchCircuit(board, circuitId, (c) => {
    const pin = c.pins.find((p) => p.id === pinId);
    if (!pin || !isPinWired(pin)) return c;
    return { ...c, pins: c.pins.map((p) => (p.id === pinId ? { ...p, inner: { ...UNWIRED_PIN } } : p)) };
  });
}

export type WirePinFail = 'unknown-node' | 'unknown-port' | 'wrong-direction';
export type WirePinResult = { ok: true; board: Board; dropped: number } | { ok: false; reason: WirePinFail };

/**
 * Points a pin at one inner port. The pin takes the type of that port; when the type changes, the outside wires that were
 * on the pin no longer fit and are removed (`dropped`). An 'in' pin takes the port over: a wire or another 'in' pin that fed
 * the same input lets go.
 */
export function wirePin(board: Board, circuitId: string, pinId: string, inner: PortRef): WirePinResult {
  const circuit = findCircuit(board, circuitId);
  const pin = circuit?.pins.find((p) => p.id === pinId);
  const node = circuit?.graph.nodes.find((n) => n.id === inner.node);
  if (!circuit || !pin || !node || circuit.benchIds.includes(node.id)) return { ok: false, reason: 'unknown-node' };
  const ports = portsOfNode(node, lookupOf(board));
  const port = (pin.dir === 'in' ? ports?.inputs : ports?.outputs)?.find((p) => p.id === inner.port);
  if (!port) {
    const opposite = (pin.dir === 'in' ? ports?.outputs : ports?.inputs)?.some((p) => p.id === inner.port);
    return { ok: false, reason: opposite ? 'wrong-direction' : 'unknown-port' };
  }
  let next = board;
  let dropped = 0;
  if (port.type !== pin.type) {
    const res = dropPinWires(board, circuitId, pinId, pin.dir);
    next = res.board;
    dropped = res.dropped;
  }
  next = patchCircuit(next, circuitId, (c) => {
    const takesOver = (p: CircuitPin): boolean => pin.dir === 'in' && p.dir === 'in' && p.id !== pinId && p.inner.node === inner.node && p.inner.port === inner.port;
    const pins = c.pins.map((p) => (p.id === pinId ? { ...p, type: port.type, inner: { node: inner.node, port: inner.port } } : takesOver(p) ? { ...p, inner: { ...UNWIRED_PIN } } : p));
    const wires = pin.dir === 'in' ? c.graph.wires.filter((w) => !(w.to.node === inner.node && w.to.port === inner.port)) : c.graph.wires;
    return { ...c, pins, graph: wires.length === c.graph.wires.length ? c.graph : { ...c.graph, wires } };
  });
  return { ok: true, board: next, dropped };
}

// ---------- exposed settings ("Thông số mở") ----------

export interface ExposedView {
  /** The inner setting, to draw the right editor; its `default` is the value the circuit itself holds. */
  def: ParamDef;
  /** Label of the inner card the setting belongs to. */
  nodeLabel: string;
}

const HEADING_DEF: ParamDef = { id: 'heading', label: 'Hướng quay (độ)', kind: 'number', default: 0, min: -360, max: 360, step: 15 };
const POSITION_DEF: ParamDef = { id: 'position', label: 'Vị trí đặt', kind: 'vec3', default: { x: 0, y: 0, z: 0 }, step: 0.5 };

/** Card title: the name typed for it, else its kind's label (a copy: its circuit's name). */
export function cardLabel(board: Pick<Board, 'circuits'>, node: GraphNode): string {
  const named = node.params.name;
  if (typeof named === 'string' && named.trim()) return named.trim();
  if (isInstance(node)) return findCircuit(board, circuitIdOf(node))?.name ?? node.id;
  return getNodeDef(node.kind)?.label ?? node.kind;
}

/** The settings of one inner card that can be opened to the copies, with the value the circuit holds for each. */
export function exposableParams(board: Pick<Board, 'circuits'>, node: GraphNode, depth = 1): ParamDef[] {
  if (!isInstance(node)) {
    const def = getNodeDef(node.kind);
    return (def?.params ?? []).map((p) => ({ ...p, default: node.params[p.id] ?? p.legacyDefault ?? p.default, legacyDefault: undefined, shownWhen: undefined, advanced: undefined }));
  }
  const circuit = findCircuit(board, circuitIdOf(node));
  if (!circuit || depth > MAX_CIRCUIT_DEPTH + 1) return [];
  const own: ParamDef[] = [
    { ...POSITION_DEF, default: node.params.position ?? POSITION_DEF.default },
    { ...HEADING_DEF, default: node.params.heading ?? HEADING_DEF.default },
  ];
  for (const e of circuit.exposed) {
    const view = exposedView(board, circuit, e, depth + 1);
    if (!view) continue;
    const key = instanceValueKey(e.id);
    own.push({ ...view.def, id: key, label: e.label, default: node.params[key] ?? view.def.default });
  }
  return own;
}

/** How one exposed setting of a circuit is edited on a copy; null when it leads nowhere. */
export function exposedView(board: Pick<Board, 'circuits'>, circuit: Circuit, exposed: CircuitExposed, depth = 1): ExposedView | null {
  const node = circuit.graph.nodes.find((n) => n.id === exposed.inner.node);
  const def = node && exposableParams(board, node, depth).find((p) => p.id === exposed.inner.param);
  return node && def ? { def, nodeLabel: cardLabel(board, node) } : null;
}

export const isExposed = (circuit: Circuit, nodeId: string, param: string): boolean => circuit.exposed.some((e) => e.inner.node === nodeId && e.inner.param === param);

/** Opens one inner setting to the copies (`on`), or closes it again. Values the copies already gave stay in their params unused. */
export function setExposed(board: Board, circuitId: string, nodeId: string, param: string, on: boolean): Board {
  return patchCircuit(board, circuitId, (c) => {
    if (isExposed(c, nodeId, param) === on) return c;
    if (!on) return { ...c, exposed: c.exposed.filter((e) => !(e.inner.node === nodeId && e.inner.param === param)) };
    const node = c.graph.nodes.find((n) => n.id === nodeId);
    const def = node && exposableParams(board, node).find((p) => p.id === param);
    if (!node || !def) return c;
    const id = freshId(new Set(c.exposed.map((e) => e.id)), 'e');
    const label = freshName(new Set(c.exposed.map((e) => e.label)), def.label.slice(0, PIN_NAME_MAX), PIN_NAME_MAX);
    return { ...c, exposed: [...c.exposed, { id, label, inner: { node: nodeId, param } }] };
  });
}

export function renameExposed(board: Board, circuitId: string, exposedId: string, label: string): Board {
  const clean = cleanPinName(label);
  return patchCircuit(board, circuitId, (c) => {
    const cur = c.exposed.find((e) => e.id === exposedId);
    if (!cur || !clean || clean === cur.label) return c;
    return { ...c, exposed: c.exposed.map((e) => (e.id === exposedId ? { ...e, label: clean } : e)) };
  });
}

export function removeExposed(board: Board, circuitId: string, exposedId: string): Board {
  return patchCircuit(board, circuitId, (c) => (c.exposed.some((e) => e.id === exposedId) ? { ...c, exposed: c.exposed.filter((e) => e.id !== exposedId) } : c));
}

// ---------- circuits ----------

export function defaultCircuitName(board: Board): string {
  const names = circuitNames(board);
  let i = 1;
  while (names.has(`Bảng mạch ${i}`)) i++;
  return `Bảng mạch ${i}`;
}

export function createCircuit(board: Board, name = ''): { board: Board; circuitId: string } {
  const id = freshId(new Set(circuitsOf(board).map((c) => c.id)), 'c');
  const circuit: Circuit = { id, name: cleanCircuitName(name) || defaultCircuitName(board), graph: { nodes: [], wires: [] }, pins: [], exposed: [], benchIds: [] };
  return { board: withCircuits(board, [...circuitsOf(board), circuit]), circuitId: id };
}

export function renameCircuit(board: Board, id: string, name: string): Board {
  const clean = cleanCircuitName(name);
  return patchCircuit(board, id, (c) => (!clean || clean === c.name ? c : { ...c, name: clean }));
}

/** A second circuit with the same inside; its copies are placed separately. */
export function duplicateCircuit(board: Board, id: string): { board: Board; circuitId: string } | null {
  const source = findCircuit(board, id);
  if (!source) return null;
  const newId = freshId(new Set(circuitsOf(board).map((c) => c.id)), 'c');
  const tail = ' (bản sao)';
  const name = freshName(circuitNames(board), `${source.name.slice(0, CIRCUIT_NAME_MAX - tail.length)}${tail}`, CIRCUIT_NAME_MAX);
  const copy: Circuit = { ...structuredClone(source), id: newId, name };
  const list = [...circuitsOf(board)];
  list.splice(list.indexOf(source) + 1, 0, copy);
  return { board: withCircuits(board, list), circuitId: newId };
}

/**
 * Removes a circuit. With copies still drawn somewhere it does nothing unless `withCopies` is set; then every copy goes too,
 * with the wires that were on it.
 */
export function deleteCircuit(board: Board, id: string, opts: { withCopies?: boolean } = {}): Board {
  if (!findCircuit(board, id)) return board;
  if (countInstances(board, id) > 0 && !opts.withCopies) return board;
  const strip = (graph: Graph): Graph => instancesIn(graph, id).reduce((g, n) => removeNode(g, n.id), graph);
  const circuits = circuitsOf(board)
    .filter((c) => c.id !== id)
    .map((c) => {
      const graph = strip(c.graph);
      return graph === c.graph ? c : { ...c, graph };
    });
  const main = strip(board.graph);
  return pruneCircuits(withCircuits(main === board.graph ? board : { ...board, graph: main }, circuits));
}

// ---------- keeping the circuits whole after any edit ----------

function pruneCircuit(c: Circuit, circuits: CircuitLookup): Circuit {
  const nodes = new Map(c.graph.nodes.map((n) => [n.id, n]));
  const alive = (ref: { node: string }): GraphNode | undefined => nodes.get(ref.node);
  const leadsSomewhere = (pin: CircuitPin): boolean => {
    const node = alive(pin.inner);
    if (!node) return false;
    if (!isInstance(node)) return true;
    return circuits.get(circuitIdOf(node))?.pins.some((p) => p.id === pin.inner.port && p.dir === pin.dir) ?? false;
  };
  let pinsChanged = false;
  const pins = c.pins.map((p) => {
    if (!isPinWired(p) || leadsSomewhere(p)) return p;
    pinsChanged = true;
    return { ...p, inner: { ...UNWIRED_PIN } };
  });
  const exposed = c.exposed.filter((e) => {
    const node = alive(e.inner);
    if (!node) return false;
    if (!isInstance(node)) return true;
    const inner = exposedIdOfKey(e.inner.param);
    return inner === null || (circuits.get(circuitIdOf(node))?.exposed.some((x) => x.id === inner) ?? false);
  });
  const benchIds = c.benchIds.filter((id) => nodes.has(id));
  const graph = pruneStacks(pruneGraphKnots(c.graph), circuits);
  if (!pinsChanged && exposed.length === c.exposed.length && benchIds.length === c.benchIds.length && graph === c.graph) return c;
  return { ...c, pins: pinsChanged ? pins : c.pins, exposed: exposed.length === c.exposed.length ? c.exposed : exposed, benchIds: benchIds.length === c.benchIds.length ? c.benchIds : benchIds, graph };
}

function pruneStacks(graph: Graph, circuits: CircuitLookup): Graph {
  if (!graph.stacks) return graph;
  const keep = graph.stacks.filter((id) => circuits.has(id));
  return keep.length === graph.stacks.length ? graph : withStacks(graph, keep);
}

/**
 * After an edit: a pin whose inner card is gone lets go (it stays, unwired), an exposed setting of a card that is gone is
 * dropped, bend points of wires that are gone are forgotten. Returns the same board when nothing needed fixing.
 */
export function pruneCircuits(board: Board): Board {
  const main = board.graph.stacks ? pruneStacks(board.graph, lookupOf(board)) : board.graph;
  const base = main === board.graph ? board : { ...board, graph: main };
  if (!board.circuits) return base;
  // A pin of an outer circuit may pass on a pin of an inner one, so one pass can undo what the next circuit relies on.
  let circuits: readonly Circuit[] = board.circuits;
  for (let pass = 0; pass < circuits.length + 1; pass++) {
    const lookup = circuitLookup([...circuits]);
    const next = circuits.map((c) => pruneCircuit(c, lookup));
    if (next.every((c, i) => c === circuits[i])) break;
    circuits = next;
  }
  return circuits === board.circuits ? base : withCircuits(base, circuits);
}

// ---------- "Tạo bảng mạch từ các thẻ đang chọn" ----------

export type FromSelectionFail = 'empty' | 'has-group' | 'too-deep';
export type FromSelectionResult =
  /** `orderChanged`: no id for the copy keeps the cards running in the order they ran in before (see `createCircuitFromSelection`). */
  | { ok: true; board: Board; circuitId: string; instanceId: string; orderChanged: boolean }
  | { ok: false; reason: FromSelectionFail };

/**
 * Turns the chosen cards of the open graph into a new circuit and puts one copy in their place. Every wire that crossed the
 * selection becomes a pin, the copy stands at the origin, not turned, and the cards keep their ids inside it.
 *
 * The engine runs cards that do not wait for each other in the order of their ids, and a card inside a copy runs under
 * `<copy id>/<its id>`. So the id of the copy decides where the moved cards fall in that order. The id is picked so the whole
 * board runs its cards in exactly the order it did before (then it behaves the same, tick for tick); when no id can do that,
 * the circuit is still made and `orderChanged` says so.
 */
export function createCircuitFromSelection(board: Board, path: CircuitPath, ids: ReadonlySet<string>, name = ''): FromSelectionResult {
  const host = openGraph(board, path);
  const natural = freshCardId(board, path, host);
  const first = buildFromSelection(board, path, ids, name, natural);
  if (!first.ok) return first;
  const before = runOrder(board, null);
  if (before === null || before === runOrder(first.board, natural)) return first;
  const taken = new Set([...host.nodes.map((n) => n.id), ...(path.length === 0 ? [...(board.notes ?? []).map((n) => n.id), ...(host.groups ?? []).map((g) => g.id)] : [])]);
  // An id that sorts right after each card of the host in turn, and one that sorts before them all.
  const candidates = ['!', ...[...taken].sort().map((id) => `${id}!`)].filter((id) => !taken.has(id)).slice(0, ORDER_TRIES);
  for (const id of candidates) {
    const res = buildFromSelection(board, path, ids, name, id);
    if (res.ok && runOrder(res.board, id) === before) return res;
  }
  return { ...first, orderChanged: true };
}

const ORDER_TRIES = 400;

/**
 * The order the engine runs the cards of the whole board in, and the wires it reads one tick late, as one text. `copy`: the
 * id of a copy whose level is cut out of every id, so a board can be compared with itself before that copy existed.
 * Null when the board does not expand.
 */
function runOrder(board: Board, copy: string | null): string | null {
  let flat: Graph;
  try {
    flat = expandBoard(board).graph;
  } catch {
    return null;
  }
  const plain = (id: string): string => (copy === null ? id : id.split('/').filter((part) => part !== copy).join('/'));
  const { order, backEdges } = compileGraph(flat);
  return JSON.stringify([order.map(plain), [...backEdges].map(plain).sort()]);
}

function buildFromSelection(board: Board, path: CircuitPath, ids: ReadonlySet<string>, name: string, instanceId: string): FromSelectionResult {
  const host = openGraph(board, path);
  if ((host.groups ?? []).some((g) => ids.has(g.id) || g.nodeIds.some((id) => ids.has(id)))) return { ok: false, reason: 'has-group' };
  const chosen = host.nodes.filter((n) => ids.has(n.id));
  if (chosen.length === 0) return { ok: false, reason: 'empty' };
  const inside = new Set(chosen.map((n) => n.id));
  const lookup = lookupOf(board);
  const hostCircuit = openCircuit(board, path);

  const pins: CircuitPin[] = [];
  const pinOf = new Map<string, CircuitPin>();
  const labels = new Set<string>();
  /** The pin that stands for one inner port, made on first use. */
  const pinFor = (ref: PortRef, dir: 'in' | 'out'): CircuitPin | null => {
    const key = `${dir}|${ref.node}|${ref.port}`;
    const have = pinOf.get(key);
    if (have) return have;
    const node = chosen.find((n) => n.id === ref.node);
    const ports = node && portsOfNode(node, lookup);
    const port = (dir === 'in' ? ports?.inputs : ports?.outputs)?.find((p) => p.id === ref.port);
    if (!node || !port) return null;
    const plain = cleanPinName(port.label) || PIN_TEXT[dir];
    const base = labels.has(plain) ? cleanPinName(`${cardLabel(board, node)} · ${port.label}`) : plain;
    const label = freshName(labels, base, PIN_NAME_MAX);
    labels.add(label);
    const pin: CircuitPin = { id: `p${pins.length + 1}`, label, dir, type: port.type as PortType, inner: { node: ref.node, port: ref.port } };
    pins.push(pin);
    pinOf.set(key, pin);
    return pin;
  };

  const circuitId = freshId(new Set(circuitsOf(board).map((c) => c.id)), 'c');
  const innerWires: Wire[] = [];
  const hostWires: Wire[] = [];
  for (const w of host.wires) {
    const a = inside.has(w.from.node);
    const b = inside.has(w.to.node);
    if (a && b) innerWires.push(w);
    else if (!a && !b) hostWires.push(w);
    else {
      const pin = a ? pinFor(w.from, 'out') : pinFor(w.to, 'in');
      // A wire onto a port its card does not have did nothing before and is left out.
      if (!pin) continue;
      hostWires.push(a ? { id: w.id, from: { node: instanceId, port: pin.id }, to: w.to } : { id: w.id, from: w.from, to: { node: instanceId, port: pin.id } });
    }
  }

  // Inside another circuit: its own pins and exposed settings that pointed at a moved card now go through the new copy.
  const exposed: CircuitExposed[] = [];
  let hostPins = hostCircuit?.pins;
  let hostExposed = hostCircuit?.exposed;
  if (hostCircuit) {
    hostPins = hostCircuit.pins.map((p) => {
      if (!inside.has(p.inner.node)) return p;
      const pin = pinFor(p.inner, p.dir);
      return pin ? { ...p, inner: { node: instanceId, port: pin.id } } : { ...p, inner: { ...UNWIRED_PIN } };
    });
    hostExposed = hostCircuit.exposed.map((e) => {
      if (!inside.has(e.inner.node)) return e;
      const moved: CircuitExposed = { id: `e${exposed.length + 1}`, label: e.label, inner: { ...e.inner } };
      exposed.push(moved);
      return { ...e, inner: { node: instanceId, param: instanceValueKey(moved.id) } };
    });
  }

  const circuit: Circuit = {
    id: circuitId,
    name: freshName(circuitNames(board), cleanCircuitName(name) || defaultCircuitName(board), CIRCUIT_NAME_MAX),
    graph: { nodes: chosen, wires: innerWires },
    pins,
    exposed,
    benchIds: [],
  };
  const instance: GraphNode = {
    id: instanceId,
    kind: CIRCUIT_KIND,
    params: instanceParams(circuitId),
    pos: { x: Math.min(...chosen.map((n) => n.pos.x)), y: Math.min(...chosen.map((n) => n.pos.y)) },
  };
  // The copy takes the place of the first chosen card in the list, so the cards keep their order when the board is flattened to run.
  const first = host.nodes.findIndex((n) => inside.has(n.id));
  const nodes = host.nodes.flatMap((n, i) => (i === first ? [instance] : inside.has(n.id) ? [] : [n]));
  const nextHost: Graph = { ...host, nodes, wires: hostWires };

  let next = withCircuits(board, [...circuitsOf(board), circuit]);
  next = withOpenGraph(next, path, nextHost);
  if (hostCircuit && hostPins && hostExposed) {
    const benchIds = hostCircuit.benchIds.filter((id) => !inside.has(id));
    next = patchCircuit(next, hostCircuit.id, (c) => ({ ...c, pins: hostPins, exposed: hostExposed, benchIds }));
  }
  next = pruneCircuits({ ...next, graph: pruneGraphKnots(next.graph) });
  if (nestingFail(board, next) !== null) return { ok: false, reason: 'too-deep' };
  return { ok: true, board: next, circuitId, instanceId, orderChanged: false };
}

/** Gives one copy on the open graph its own name; an empty name removes it, so the copy shows its circuit's name again. */
export function setInstanceName(board: Board, path: CircuitPath, nodeId: string, name: string): Board {
  const graph = openGraph(board, path);
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node || !isInstance(node)) return board;
  const clean = name.replace(/\s+/g, ' ').trimStart().slice(0, CIRCUIT_NAME_MAX);
  if ((typeof node.params.name === 'string' ? node.params.name : '') === clean) return board;
  const { name: _old, ...rest } = node.params;
  const params = clean.trim() === '' ? rest : { ...rest, name: clean };
  return withOpenGraph(board, path, { ...graph, nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, params } : n)) });
}
