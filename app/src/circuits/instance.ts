import { getNodeDef, knownInputs, knownOutputs } from '../engine/registry';
import { canConnect } from '../engine/wiring';
import {
  CIRCUIT_KIND,
  type Circuit,
  type CircuitPin,
  type ConnectResult,
  type Graph,
  type GraphNode,
  type ParamValue,
  type Params,
  type PortDef,
  type PortRef,
  type Vec3,
} from '../engine/types';

/**
 * A copy ("instance") of a circuit is a graph node of kind `circuit`. Its params are flat so they stay plain `Params`
 * (the editor, undo and the save format treat them like any other card):
 *   circuit          id of the circuit it copies
 *   position         where the copy stands (vec3, added to every world point inside)
 *   heading          how far it is turned about the vertical axis, degrees (0 = as drawn, 90 turns +x onto +z)
 *   value:<exposed>  this copy's own value of one exposed setting; absent = the circuit's own value
 */
export const INSTANCE_CIRCUIT = 'circuit';
export const INSTANCE_POSITION = 'position';
export const INSTANCE_HEADING = 'heading';
const VALUE_PREFIX = 'value:';

/** Nesting levels allowed below the main board (a copy inside a copy inside ...). */
export const MAX_CIRCUIT_DEPTH = 4;

export const instanceValueKey = (exposedId: string): string => `${VALUE_PREFIX}${exposedId}`;
/** The exposed id a param key of a copy stands for, or null for its other keys. */
export const exposedIdOfKey = (key: string): string | null => (key.startsWith(VALUE_PREFIX) ? key.slice(VALUE_PREFIX.length) : null);

export interface InstancePlace {
  position: Vec3;
  /** Degrees. */
  heading: number;
}

/** What a copy holds, read out of its flat params. */
export interface CircuitInstance {
  circuit: string;
  values: Record<string, ParamValue>;
  place: InstancePlace;
}

export const isInstance = (node: Pick<GraphNode, 'kind'>): boolean => node.kind === CIRCUIT_KIND;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function isVec3(v: unknown): v is Vec3 {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return finite(o.x) && finite(o.y) && finite(o.z);
}

/** Placement held in a copy's params; anything unusable reads as "not moved, not turned". */
export function placeOfParams(params: Params): InstancePlace {
  const p = params[INSTANCE_POSITION];
  const h = params[INSTANCE_HEADING];
  return { position: isVec3(p) ? { x: p.x, y: p.y, z: p.z } : { x: 0, y: 0, z: 0 }, heading: finite(h) ? h : 0 };
}

export function readInstance(node: GraphNode): CircuitInstance {
  const values: Record<string, ParamValue> = {};
  for (const [key, value] of Object.entries(node.params)) {
    const id = exposedIdOfKey(key);
    if (id !== null) values[id] = value;
  }
  const circuit = node.params[INSTANCE_CIRCUIT];
  return { circuit: typeof circuit === 'string' ? circuit : '', values, place: placeOfParams(node.params) };
}

/** Flat params of a copy. Left-out parts read as: no own values, standing at the origin, not turned. */
export function instanceParams(circuit: string, opts: { values?: Record<string, ParamValue>; place?: Partial<InstancePlace> } = {}): Params {
  const position = opts.place?.position ?? { x: 0, y: 0, z: 0 };
  const params: Params = {
    [INSTANCE_CIRCUIT]: circuit,
    [INSTANCE_POSITION]: { x: position.x, y: position.y, z: position.z },
    [INSTANCE_HEADING]: opts.place?.heading ?? 0,
  };
  for (const [id, value] of Object.entries(opts.values ?? {})) params[instanceValueKey(id)] = typeof value === 'object' ? { ...value } : value;
  return params;
}

export type CircuitLookup = ReadonlyMap<string, Circuit>;

export function circuitLookup(circuits: readonly Circuit[] | undefined): Map<string, Circuit> {
  return new Map((circuits ?? []).map((c) => [c.id, c]));
}

export interface NodePorts {
  inputs: PortDef[];
  outputs: PortDef[];
}

/** The inner port a pin stands for, followed through nested copies down to a real card. Undefined when it leads nowhere. */
function pinPortDef(circuit: Circuit, pin: CircuitPin, circuits: CircuitLookup, depth: number): PortDef | undefined {
  if (depth > MAX_CIRCUIT_DEPTH) return undefined;
  const inner = circuit.graph.nodes.find((n) => n.id === pin.inner.node);
  if (!inner) return undefined;
  const ports = portsOfNode(inner, circuits, depth + 1);
  return (pin.dir === 'in' ? ports?.inputs : ports?.outputs)?.find((p) => p.id === pin.inner.port);
}

/**
 * Ports of one copy, in pin order: an 'in' pin is an input, an 'out' pin an output, the port id is the pin id.
 * An input keeps the `feedback` mark of the inner port it leads to, so the editor can show it the same way.
 */
export function instancePorts(circuit: Circuit, circuits: CircuitLookup, depth = 1): NodePorts {
  const ports: NodePorts = { inputs: [], outputs: [] };
  for (const pin of circuit.pins) {
    const port: PortDef = { id: pin.id, type: pin.type, label: pin.label };
    if (pin.dir === 'in' && pinPortDef(circuit, pin, circuits, depth)?.feedback) port.feedback = true;
    (pin.dir === 'in' ? ports.inputs : ports.outputs).push(port);
  }
  return ports;
}

/** Every port a wire may name on this node: from its NodeDef, or from the pins of the circuit it copies. Null = unknown kind or circuit. */
export function portsOfNode(node: GraphNode, circuits: CircuitLookup, depth = 1): NodePorts | null {
  if (isInstance(node)) {
    const circuit = circuits.get(String(node.params[INSTANCE_CIRCUIT] ?? ''));
    return circuit ? instancePorts(circuit, circuits, depth) : null;
  }
  const def = getNodeDef(node.kind);
  return def ? { inputs: knownInputs(def), outputs: knownOutputs(def) } : null;
}

/** `canConnect` for a graph that may hold copies of circuits: the same answers, with a copy's pins as its ports. */
export function canConnectIn(graph: Graph, from: PortRef, to: PortRef, circuits: CircuitLookup): ConnectResult {
  const fromNode = graph.nodes.find((n) => n.id === from.node);
  const toNode = graph.nodes.find((n) => n.id === to.node);
  if (!fromNode || !toNode) return { ok: false, reason: 'unknown-node' };
  if (!isInstance(fromNode) && !isInstance(toNode)) return canConnect(graph, from, to);
  const fromPorts = portsOfNode(fromNode, circuits);
  const toPorts = portsOfNode(toNode, circuits);
  if (!fromPorts || !toPorts) return { ok: false, reason: 'unknown-node' };

  const fromOut = fromPorts.outputs.find((p) => p.id === from.port);
  const toIn = toPorts.inputs.find((p) => p.id === to.port);
  if (!fromOut || !toIn) {
    const fromIsInput = !fromOut && fromPorts.inputs.some((p) => p.id === from.port);
    const toIsOutput = !toIn && toPorts.outputs.some((p) => p.id === to.port);
    return { ok: false, reason: fromIsInput || toIsOutput ? 'wrong-direction' : 'unknown-port' };
  }
  if (from.node === to.node) return { ok: false, reason: 'same-node' };
  if (fromOut.type !== toIn.type) return { ok: false, reason: 'type-mismatch' };
  if (graph.wires.some((w) => w.to.node === to.node && w.to.port === to.port)) return { ok: false, reason: 'input-taken' };
  return { ok: true };
}
