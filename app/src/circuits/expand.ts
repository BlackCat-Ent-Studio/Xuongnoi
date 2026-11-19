import { getNodeDef } from '../engine/registry';
import type { Board, Circuit, Graph, GraphNode, NodeDef, ParamValue, Params, PortRef, Vec3, Wire } from '../engine/types';
import {
  INSTANCE_CIRCUIT,
  MAX_CIRCUIT_DEPTH,
  circuitLookup,
  instanceValueKey,
  isInstance,
  isPinWired,
  isVec3,
  placeOfParams,
  type CircuitLookup,
  type InstancePlace,
} from './instance';

/**
 * Turns a board that uses circuits into the one flat graph the engine runs. Pure and deterministic: the same board always
 * gives the same nodes and wires in the same order, and the board itself is never changed.
 *
 * - A copy `c` of a circuit is replaced by the circuit's nodes with ids `c/<inner id>` (a copy inside a copy: `c/d/<inner id>`);
 *   inner wires get the same prefix on their ids. Wires of the main board keep their ids.
 * - A wire on a pin of a copy is moved onto the inner port the pin stands for, through as many levels as it takes. It lands on
 *   the real card, so that card's own port rules (`feedback`) apply unchanged. A pin without a wire leaves the inner port
 *   unwired; a pin that leads nowhere drops the wire.
 * - A value the copy gives for an exposed setting replaces the inner card's own value; a value of the wrong shape is ignored.
 * - Settings marked `place` are turned about the vertical axis by the copy's heading and then moved by its position; headings
 *   add up; a copy inside a copy is placed inside the outer copy's frame.
 * - Settings marked `instanceScoped` (a pair code) get the path of the copy in front, so two copies never share one. A value
 *   that came in through an exposed setting belongs to the board that gave it and gets that board's path instead.
 * - A circuit's bench nodes and their wires are left out of every copy; `expandCircuitAlone` keeps them.
 */

export type CircuitErrorCode = 'unknown-circuit' | 'cycle' | 'too-deep' | 'duplicate-id' | 'duplicate-circuit';

export class CircuitError extends Error {
  constructor(
    readonly code: CircuitErrorCode,
    /** `circuit`: the circuit id involved. `node`: the node id (expanded form) involved. `chain`: circuit ids from the outermost one to the one that closes the loop. */
    readonly detail: { circuit?: string; node?: string; chain?: string[] } = {},
  ) {
    super(`circuit: ${code} ${JSON.stringify(detail)}`);
    this.name = 'CircuitError';
  }
}

/** Where a node of the flat graph comes from: the copies it sits in, outermost first (empty = the main board), and its id there. */
export interface ExpandedOrigin {
  path: readonly string[];
  inner: string;
}

export interface CircuitIdMap {
  /** Every node id of the flat graph and where it comes from. */
  readonly origins: ReadonlyMap<string, ExpandedOrigin>;
  /** The flat node id of inner node `inner` of the copy at `path`; undefined when no such node runs (unknown, or a bench node). */
  expandedId(path: readonly string[], inner: string): string | undefined;
  /** The real port (flat node id + port) a pin of the copy at `path` leads to; undefined for an unknown pin or one that leads nowhere. */
  pinPort(path: readonly string[], pinId: string): PortRef | undefined;
}

export interface Expansion {
  graph: Graph;
  idMap: CircuitIdMap;
}

const SEP = '/';
const joinPath = (path: readonly string[]): string => path.join(SEP);
const flatId = (path: readonly string[], inner: string): string => (path.length === 0 ? inner : `${joinPath(path)}${SEP}${inner}`);

// ---------- placement ----------

/** Turn about the vertical axis (degrees), then shift. */
interface Transform {
  heading: number;
  shift: Vec3;
}

const IDENTITY: Transform = { heading: 0, shift: { x: 0, y: 0, z: 0 } };
const isIdentity = (t: Transform): boolean => t.heading === 0 && t.shift.x === 0 && t.shift.y === 0 && t.shift.z === 0;

/** Turns a vector by `deg` about the vertical axis (90 takes +x onto +z, as a robot heading does). Quarter turns are exact. */
function turned(v: Vec3, deg: number): Vec3 {
  const q = ((deg % 360) + 360) % 360;
  if (q === 0) return { x: v.x, y: v.y, z: v.z };
  const rad = (q * Math.PI) / 180;
  const [c, s] = q === 90 ? [0, 1] : q === 180 ? [-1, 0] : q === 270 ? [0, -1] : [Math.cos(rad), Math.sin(rad)];
  return { x: v.x * c - v.z * s, y: v.y, z: v.x * s + v.z * c };
}

function placed(v: Vec3, t: Transform): Vec3 {
  const r = turned(v, t.heading);
  return { x: r.x + t.shift.x, y: r.y + t.shift.y, z: r.z + t.shift.z };
}

/** The frame of a copy that stands at `place` inside a frame `outer`. */
function compose(outer: Transform, place: InstancePlace): Transform {
  return { heading: outer.heading + place.heading, shift: placed(place.position, outer) };
}

// ---------- expansion ----------

/** A value and the board that wrote it (path of copies; empty = the main board). */
interface Given {
  value: ParamValue;
  owner: readonly string[];
}

interface Work {
  circuits: CircuitLookup;
  nodes: GraphNode[];
  /** Flat wires with how deep the board that drew them sits (0 = the main board). */
  wires: { wire: Wire; depth: number }[];
  origins: Map<string, ExpandedOrigin>;
  pins: Map<string, PortRef>;
  /** Nodes that stand in a moved or turned frame: index in `nodes`, their def and the frame. */
  placeJobs: { index: number; def: NodeDef<unknown>; frame: Transform }[];
}

const EMPTY_SET: ReadonlySet<string> = new Set();
const NO_OVERRIDES: ReadonlyMap<string, ReadonlyMap<string, Given>> = new Map();

const cloneValue = (v: ParamValue): ParamValue => (typeof v === 'object' ? { x: v.x, y: v.y, z: v.z } : v);

/** Same shape as the setting's default: a finite number, a string or a vec3. */
function fitsParam(def: ParamValue, v: ParamValue): boolean {
  if (typeof def === 'number') return typeof v === 'number' && Number.isFinite(v);
  if (typeof def === 'string') return typeof v === 'string';
  return isVec3(v);
}

function circuitOf(work: Work, node: GraphNode, path: readonly string[]): Circuit {
  const id = node.params[INSTANCE_CIRCUIT];
  const circuit = typeof id === 'string' ? work.circuits.get(id) : undefined;
  if (!circuit) throw new CircuitError('unknown-circuit', { circuit: String(id ?? ''), node: flatId(path, node.id) });
  return circuit;
}

/**
 * The real port a wire end drawn in `graph` (which sits at `path`) lands on, or null when it leads nowhere
 * (an unknown pin, a pin of the wrong direction, a bench node of a copy).
 */
function landing(work: Work, graph: Graph, path: readonly string[], ref: PortRef, dir: 'in' | 'out', skip: ReadonlySet<string>): PortRef | null {
  if (skip.has(ref.node)) return null;
  const node = graph.nodes.find((n) => n.id === ref.node);
  // A wire to a node that is not there stays as it is: the engine ignores it, as it does on a board without circuits.
  if (!node || !isInstance(node)) return { node: flatId(path, ref.node), port: ref.port };
  const circuit = circuitOf(work, node, path);
  const pin = circuit.pins.find((p) => p.id === ref.port && p.dir === dir);
  if (!pin || !isPinWired(pin)) return null;
  return landing(work, circuit.graph, [...path, node.id], pin.inner, dir, new Set(circuit.benchIds));
}

function addNode(work: Work, node: GraphNode, path: readonly string[], inner: string): number {
  if (work.origins.has(node.id)) throw new CircuitError('duplicate-id', { node: node.id });
  work.origins.set(node.id, { path, inner });
  return work.nodes.push(node) - 1;
}

/** A plain card of the board at `path`: exposed values written in, pair codes made private to their board. */
function plainNode(node: GraphNode, path: readonly string[], given: ReadonlyMap<string, Given> | undefined, def: NodeDef<unknown> | undefined): GraphNode {
  let params = node.params;
  const write = (key: string, value: ParamValue): void => {
    if (params === node.params) params = { ...node.params };
    params[key] = value;
  };
  const applied = new Map<string, Given>();
  if (def && given) {
    for (const [key, g] of given) {
      const pd = def.params.find((p) => p.id === key);
      if (!pd || !fitsParam(pd.default, g.value)) continue;
      write(key, cloneValue(g.value));
      applied.set(key, g);
    }
  }
  for (const pd of def?.params ?? []) {
    if (!pd.instanceScoped) continue;
    const value = params[pd.id];
    const owner = applied.get(pd.id)?.owner ?? path;
    if (typeof value === 'string' && value !== '' && owner.length > 0) write(pd.id, `${joinPath(owner)}${SEP}${value}`);
  }
  return path.length === 0 && params === node.params ? node : { ...node, id: flatId(path, node.id), params };
}

/**
 * Adds the nodes and wires of `graph`, which sits at `path` in frame `frame`. `overrides`: values given from outside per
 * inner node; `skip`: nodes left out; `stack`: circuit ids being expanded right now (outermost first).
 */
function expandLevel(
  work: Work,
  graph: Graph,
  path: readonly string[],
  frame: Transform,
  overrides: ReadonlyMap<string, ReadonlyMap<string, Given>>,
  skip: ReadonlySet<string>,
  stack: readonly string[],
): void {
  for (const node of graph.nodes) {
    if (skip.has(node.id)) continue;
    const given = overrides.get(node.id);
    if (!isInstance(node)) {
      const def = getNodeDef(node.kind) as NodeDef<unknown> | undefined;
      const index = addNode(work, plainNode(node, path, given, def), path, node.id);
      if (def && !isIdentity(frame) && def.params.some((p) => p.place)) work.placeJobs.push({ index, def, frame });
      continue;
    }

    const circuit = circuitOf(work, node, path);
    const childPath = [...path, node.id];
    if (stack.includes(circuit.id)) throw new CircuitError('cycle', { circuit: circuit.id, node: flatId(path, node.id), chain: [...stack, circuit.id] });
    if (childPath.length > MAX_CIRCUIT_DEPTH) throw new CircuitError('too-deep', { circuit: circuit.id, node: flatId(path, node.id) });

    // What this copy holds: its own params, unless the board above set them through an exposed setting.
    const held = (key: string): Given | undefined => {
      const g = given?.get(key);
      if (g) return g;
      const own = node.params[key];
      return own === undefined ? undefined : { value: own, owner: path };
    };
    const place = placeOfParams({ position: held('position')?.value ?? 0, heading: held('heading')?.value ?? 0 });

    const inner = new Map<string, Map<string, Given>>();
    for (const e of circuit.exposed) {
      const g = held(instanceValueKey(e.id));
      // Which circuit a nested copy uses is part of the circuit, never a per-copy value.
      if (!g || e.inner.param === INSTANCE_CIRCUIT) continue;
      const forNode = inner.get(e.inner.node) ?? new Map<string, Given>();
      forNode.set(e.inner.param, g);
      inner.set(e.inner.node, forNode);
    }

    const bench = new Set(circuit.benchIds);
    expandLevel(work, circuit.graph, childPath, compose(frame, place), inner, bench, [...stack, circuit.id]);
    for (const pin of circuit.pins) {
      const port = landing(work, circuit.graph, childPath, pin.inner, pin.dir, bench);
      if (port) work.pins.set(`${joinPath(childPath)}|${pin.id}`, port);
    }
  }

  for (const w of graph.wires) {
    const from = landing(work, graph, path, w.from, 'out', skip);
    const to = from && landing(work, graph, path, w.to, 'in', skip);
    if (!from || !to) continue;
    const same = path.length === 0 && from.node === w.from.node && to.node === w.to.node;
    work.wires.push({ wire: same ? w : { id: flatId(path, w.id), from, to }, depth: path.length });
  }
}

/** Moves and turns the `place` settings of every node that stands in a copy's frame. Needs the final wires (see ParamDef.placeAs). */
function applyPlacement(work: Work, wires: readonly Wire[]): void {
  if (work.placeJobs.length === 0) return;
  const wiredInputs = new Map<string, Set<string>>();
  for (const w of wires) {
    const set = wiredInputs.get(w.to.node) ?? new Set<string>();
    set.add(w.to.port);
    wiredInputs.set(w.to.node, set);
  }
  for (const { index, def, frame } of work.placeJobs) {
    const node = work.nodes[index]!;
    // What the engine will run the card with: a missing setting reads as its default.
    const full: Params = {};
    for (const p of def.params) full[p.id] = p.legacyDefault ?? p.default;
    Object.assign(full, node.params);
    const wired = wiredInputs.get(node.id) ?? EMPTY_SET;
    const params: Params = { ...node.params };
    for (const p of def.params) {
      if (!p.place) continue;
      const meaning = p.placeAs?.(full, wired) ?? 'world';
      if (meaning === 'local') continue;
      const value = full[p.id];
      if (p.place === 'heading') {
        if (typeof value === 'number') params[p.id] = value + frame.heading;
      } else if (isVec3(value)) {
        params[p.id] = meaning === 'offset' ? turned(value, frame.heading) : placed(value, frame);
      }
    }
    work.nodes[index] = { ...node, params };
  }
}

/** When a board further out wires a port that a board further in also wires, the outer wire is the one that counts. */
function outerWireWins(found: Work['wires']): Wire[] {
  const shallowest = new Map<string, number>();
  for (const { wire, depth } of found) {
    const key = `${wire.to.node}|${wire.to.port}`;
    shallowest.set(key, Math.min(shallowest.get(key) ?? depth, depth));
  }
  return found.filter(({ wire, depth }) => depth === shallowest.get(`${wire.to.node}|${wire.to.port}`)).map((f) => f.wire);
}

function lookupOf(board: Pick<Board, 'circuits'>): Map<string, Circuit> {
  const circuits = board.circuits ?? [];
  const lookup = circuitLookup(circuits);
  if (lookup.size !== circuits.length) {
    const seen = new Set<string>();
    for (const c of circuits) {
      if (seen.has(c.id)) throw new CircuitError('duplicate-circuit', { circuit: c.id });
      seen.add(c.id);
    }
  }
  return lookup;
}

function finish(work: Work, settings: Graph['settings']): Expansion {
  const wires = outerWireWins(work.wires);
  applyPlacement(work, wires);
  const graph: Graph = { nodes: work.nodes, wires };
  if (settings) graph.settings = settings;
  const { origins, pins } = work;
  return {
    graph,
    idMap: {
      origins,
      expandedId(path, inner) {
        const id = flatId(path, inner);
        const o = origins.get(id);
        // A main-board id may itself hold the separator, so the origin has to match too.
        return o && o.inner === inner && o.path.length === path.length && o.path.every((p, i) => p === path[i]) ? id : undefined;
      },
      pinPort: (path, pinId) => pins.get(`${joinPath(path)}|${pinId}`),
    },
  };
}

const newWork = (circuits: CircuitLookup): Work => ({ circuits, nodes: [], wires: [], origins: new Map(), pins: new Map(), placeJobs: [] });

/**
 * The flat graph of the whole board (see the file comment). Throws a `CircuitError` for a copy of an unknown circuit, a circuit
 * that contains itself, nesting deeper than `MAX_CIRCUIT_DEPTH`, or two nodes ending up with the same id.
 * The result keeps the main board's settings; groups and wire bend points are drawing only and are left out.
 */
export function expandBoard(board: Pick<Board, 'graph' | 'circuits'>): Expansion {
  const work = newWork(lookupOf(board));
  expandLevel(work, board.graph, [], IDENTITY, NO_OVERRIDES, EMPTY_SET, []);
  return finish(work, board.graph.settings);
}

/**
 * One circuit run on its own, as on a test bench: its bench nodes are kept, its nodes keep their plain ids, and the copies
 * it holds are expanded as usual. Runs under the main board's game settings.
 */
export function expandCircuitAlone(board: Pick<Board, 'graph' | 'circuits'>, circuitId: string): Expansion {
  const work = newWork(lookupOf(board));
  const circuit = work.circuits.get(circuitId);
  if (!circuit) throw new CircuitError('unknown-circuit', { circuit: circuitId });
  expandLevel(work, circuit.graph, [], IDENTITY, NO_OVERRIDES, EMPTY_SET, [circuit.id]);
  return finish(work, board.graph.settings);
}
