import {
  INSTANCE_CIRCUIT,
  INSTANCE_HEADING,
  INSTANCE_NAME,
  INSTANCE_POSITION,
  MAX_CIRCUIT_DEPTH,
  exposedIdOfKey,
  isVec3,
  type CircuitLookup,
} from '../circuits/instance';
import type { CircuitIssue } from '../circuits/validate';
import type { Circuit, CircuitExposed, CircuitPin, Params, PortType } from '../engine/types';
import { isGroupColor } from '../editor/groups/group-model';
import { IO_TEXT } from './text-vi';

/** Longest name of a circuit or of one copy. */
export const INSTANCE_NAME_MAX = 40;

/**
 * Reads the optional `stacks` of a graph: ids of circuits drawn as one stacked block. Drawing only, so anything that does
 * not fit (unknown circuit, repeats) is dropped quietly; undefined when nothing is left.
 */
export function readStacks(raw: unknown, circuits: CircuitLookup): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = [...new Set(raw.filter((id): id is string => typeof id === 'string' && circuits.has(id)))];
  return out.length > 0 ? out : undefined;
}

/** How the `circuits` of a board are written to and read from a file. The graphs inside are read by save-format.ts. */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const PORT_TYPES: readonly PortType[] = ['bool', 'number', 'object'];

/** Circuits in a fixed key order, so a file read and written again is the same text. */
export function circuitsForFile(circuits: readonly Circuit[]): unknown[] {
  return circuits.map((c) => ({
    id: c.id,
    name: c.name,
    ...(c.color ? { color: c.color } : {}),
    graph: { nodes: c.graph.nodes, wires: c.graph.wires, ...(c.graph.knots ? { knots: c.graph.knots } : {}), ...(c.graph.stacks ? { stacks: c.graph.stacks } : {}) },
    pins: c.pins.map((p) => ({ id: p.id, label: p.label, dir: p.dir, type: p.type, inner: { node: p.inner.node, port: p.inner.port } })),
    exposed: c.exposed.map((e) => ({ id: e.id, label: e.label, inner: { node: e.inner.node, param: e.inner.param } })),
    benchIds: [...c.benchIds],
  }));
}

function readPin(raw: unknown): CircuitPin | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.label !== 'string' || !isRecord(raw.inner)) return null;
  if (raw.dir !== 'in' && raw.dir !== 'out') return null;
  if (!PORT_TYPES.includes(raw.type as PortType)) return null;
  if (typeof raw.inner.node !== 'string' || typeof raw.inner.port !== 'string') return null;
  return { id: raw.id, label: raw.label, dir: raw.dir, type: raw.type as PortType, inner: { node: raw.inner.node, port: raw.inner.port } };
}

function readExposed(raw: unknown): CircuitExposed | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.label !== 'string' || !isRecord(raw.inner)) return null;
  if (typeof raw.inner.node !== 'string' || typeof raw.inner.param !== 'string') return null;
  return { id: raw.id, label: raw.label, inner: { node: raw.inner.node, param: raw.inner.param } };
}

function readList<T>(raw: unknown, read: (item: unknown) => T | null): T[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;
  const out: T[] = [];
  for (const item of raw) {
    const value = read(item);
    if (value === null) return null;
    out.push(value);
  }
  return out;
}

/** A circuit read from the file with its graph still to come (`rawGraph`). */
export interface CircuitHeader {
  circuit: Circuit;
  rawGraph: Record<string, unknown>;
}

/**
 * Reads everything of each circuit except its graph: name, pins, exposed settings, bench list. The pins are needed first,
 * because the graphs (of the main board and of other circuits) hold wires onto copies. Returns a Vietnamese error on a bad shape.
 */
export function readCircuitHeaders(raw: unknown): CircuitHeader[] | string {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return IO_TEXT.badCircuits;
  const seen = new Set<string>();
  const out: CircuitHeader[] = [];
  for (const [i, c] of raw.entries()) {
    if (!isRecord(c) || !isId(c.id) || typeof c.name !== 'string') return IO_TEXT.badCircuit(i);
    if (seen.has(c.id)) return IO_TEXT.dupCircuit(c.id);
    seen.add(c.id);
    const rawGraph = c.graph;
    if (!isRecord(rawGraph) || !Array.isArray(rawGraph.nodes) || !Array.isArray(rawGraph.wires)) return IO_TEXT.badCircuit(i);
    const pins = readList(c.pins, readPin);
    const exposed = readList(c.exposed, readExposed);
    const benchIds = readList(c.benchIds, (id) => (typeof id === 'string' ? id : null));
    if (!pins || !exposed || !benchIds) return IO_TEXT.badCircuit(i);
    const circuit: Circuit = { id: c.id, name: c.name, graph: { nodes: [], wires: [] }, pins, exposed, benchIds };
    if (isGroupColor(c.color)) circuit.color = c.color;
    out.push({ circuit, rawGraph });
  }
  return out;
}

/**
 * Params of a copy of a circuit read from a file: the circuit must exist, the placement must be well formed, each own value
 * must be a number, a text or a vec3 (whether it suits the setting it is for is checked once every circuit is read).
 */
export function readInstanceParams(id: string, given: Record<string, unknown>, circuits: CircuitLookup): Params | string {
  const circuit = given[INSTANCE_CIRCUIT];
  if (typeof circuit !== 'string' || !circuits.has(circuit)) return IO_TEXT.unknownCircuit(id, typeof circuit === 'string' ? circuit : '');
  const position = given[INSTANCE_POSITION] ?? { x: 0, y: 0, z: 0 };
  if (!isVec3(position)) return IO_TEXT.badParam(id, INSTANCE_POSITION);
  const heading = given[INSTANCE_HEADING] ?? 0;
  if (typeof heading !== 'number' || !Number.isFinite(heading)) return IO_TEXT.badParam(id, INSTANCE_HEADING);
  const params: Params = { [INSTANCE_CIRCUIT]: circuit, [INSTANCE_POSITION]: { x: position.x, y: position.y, z: position.z }, [INSTANCE_HEADING]: heading };
  const name = given[INSTANCE_NAME];
  if (typeof name === 'string' && name.trim() !== '') params[INSTANCE_NAME] = name.trim().slice(0, INSTANCE_NAME_MAX);
  for (const [key, value] of Object.entries(given)) {
    if (exposedIdOfKey(key) === null) continue;
    if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) params[key] = value;
    else if (isVec3(value)) params[key] = { x: value.x, y: value.y, z: value.z };
    else return IO_TEXT.badParam(id, key);
  }
  return params;
}

/** Vietnamese text for a problem found by `validateCircuits`. */
export function circuitIssueText(issue: CircuitIssue, circuits: CircuitLookup): string {
  const nameOf = (id: string): string => circuits.get(id)?.name || id;
  const inside = (text: string): string => ('circuit' in issue && issue.circuit !== undefined ? IO_TEXT.inCircuit(nameOf(issue.circuit), text) : text);
  switch (issue.code) {
    case 'duplicate-circuit':
      return IO_TEXT.dupCircuit(issue.circuit);
    case 'unknown-circuit':
      return inside(IO_TEXT.unknownCircuit(issue.node, issue.wanted));
    case 'cycle':
      return IO_TEXT.circuitCycle(issue.chain.map(nameOf).join(' › '));
    case 'too-deep':
      return IO_TEXT.circuitTooDeep(issue.chain.map(nameOf).join(' › '), MAX_CIRCUIT_DEPTH);
    case 'bad-pin':
      return inside(IO_TEXT.badPin(issue.pin));
    case 'pin-unwired':
      return inside(IO_TEXT.pinUnwired(issue.pin));
    case 'pin-input-wired':
      return inside(IO_TEXT.pinInputWired(issue.pin));
    case 'bad-exposed':
      return inside(IO_TEXT.badExposed(issue.exposed));
    case 'bad-bench':
      return inside(IO_TEXT.badBench(issue.node));
    case 'bad-value':
      return inside(IO_TEXT.badCircuitValue(issue.node, issue.exposed));
  }
}
