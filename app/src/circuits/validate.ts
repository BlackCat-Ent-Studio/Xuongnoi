import { getNodeDef } from '../engine/registry';
import type { Board, Circuit, Graph, GraphNode, ParamValue } from '../engine/types';
import {
  INSTANCE_CIRCUIT,
  INSTANCE_HEADING,
  INSTANCE_POSITION,
  MAX_CIRCUIT_DEPTH,
  circuitLookup,
  exposedIdOfKey,
  isInstance,
  isPinWired,
  isVec3,
  portsOfNode,
  type CircuitLookup,
} from './instance';

/**
 * What is wrong with the circuits of a board, for edit time and for loading a file. `circuit` is the circuit the problem is
 * in (absent = the main board).
 */
export type CircuitIssue =
  | { code: 'duplicate-circuit'; circuit: string }
  /** A copy names a circuit the board does not have. */
  | { code: 'unknown-circuit'; circuit?: string; node: string; wanted: string }
  /** `chain`: circuit ids, each containing the next, the last one equal to the first. */
  | { code: 'cycle'; circuit: string; chain: string[] }
  /** Copies nested deeper than MAX_CIRCUIT_DEPTH below the main board; `chain` is the nesting that is too long. */
  | { code: 'too-deep'; circuit: string; chain: string[] }
  /** A pin whose id is used twice, or whose inner port is missing, of the wrong direction or type, on a bench node, or already used by another pin. */
  | { code: 'bad-pin'; circuit: string; pin: string }
  /** A pin that is not wired to anything inside yet. The board still loads and runs; wires on the pin lead nowhere. */
  | { code: 'pin-unwired'; circuit: string; pin: string }
  /** An 'in' pin whose inner port already gets a wire from a card that is part of every copy. */
  | { code: 'pin-input-wired'; circuit: string; pin: string }
  /** An exposed setting whose id is used twice, or whose inner node or setting does not exist. */
  | { code: 'bad-exposed'; circuit: string; exposed: string }
  | { code: 'bad-bench'; circuit: string; node: string }
  /** A copy gives a value of the wrong shape for an exposed setting. */
  | { code: 'bad-value'; circuit?: string; node: string; exposed: string };

type Shape = 'number' | 'string' | 'vec3';
const shapeOf = (v: ParamValue): Shape => (typeof v === 'number' ? 'number' : typeof v === 'string' ? 'string' : 'vec3');
const fits = (shape: Shape, v: unknown): boolean =>
  shape === 'number' ? typeof v === 'number' && Number.isFinite(v) : shape === 'string' ? typeof v === 'string' : isVec3(v);

/** The shape a setting of an inner node takes, followed through nested copies. Null = no such setting (or one that cannot be exposed). */
function paramShape(node: GraphNode, param: string, circuits: CircuitLookup, depth: number): Shape | null {
  if (!isInstance(node)) {
    const pd = getNodeDef(node.kind)?.params.find((p) => p.id === param);
    return pd ? shapeOf(pd.default) : null;
  }
  if (param === INSTANCE_POSITION) return 'vec3';
  if (param === INSTANCE_HEADING) return 'number';
  const exposedId = exposedIdOfKey(param);
  const circuit = circuits.get(String(node.params[INSTANCE_CIRCUIT] ?? ''));
  const exposed = exposedId === null ? undefined : circuit?.exposed.find((e) => e.id === exposedId);
  const target = exposed && circuit!.graph.nodes.find((n) => n.id === exposed.inner.node);
  if (!target || depth > MAX_CIRCUIT_DEPTH) return null;
  return paramShape(target, exposed.inner.param, circuits, depth + 1);
}

function instanceIssues(graph: Graph, owner: string | undefined, circuits: CircuitLookup, issues: CircuitIssue[]): void {
  const where = owner === undefined ? {} : { circuit: owner };
  for (const node of graph.nodes) {
    if (!isInstance(node)) continue;
    const wanted = String(node.params[INSTANCE_CIRCUIT] ?? '');
    const circuit = circuits.get(wanted);
    if (!circuit) {
      issues.push({ code: 'unknown-circuit', ...where, node: node.id, wanted });
      continue;
    }
    for (const [key, value] of Object.entries(node.params)) {
      const exposedId = exposedIdOfKey(key);
      // A value for a setting the circuit no longer exposes is harmless: it is simply not used.
      if (exposedId === null || !circuit.exposed.some((e) => e.id === exposedId)) continue;
      const shape = paramShape(node, key, circuits, 1);
      if (shape !== null && !fits(shape, value)) issues.push({ code: 'bad-value', ...where, node: node.id, exposed: exposedId });
    }
  }
}

function ownIssues(c: Circuit, circuits: CircuitLookup, issues: CircuitIssue[]): void {
  const nodes = new Map(c.graph.nodes.map((n) => [n.id, n]));
  const bench = new Set(c.benchIds);
  for (const id of bench) if (!nodes.has(id)) issues.push({ code: 'bad-bench', circuit: c.id, node: id });

  const pinIds = new Set<string>();
  const innerTaken = new Set<string>();
  for (const pin of c.pins) {
    if (!isPinWired(pin) && !pinIds.has(pin.id)) {
      issues.push({ code: 'pin-unwired', circuit: c.id, pin: pin.id });
      pinIds.add(pin.id);
      continue;
    }
    const node = nodes.get(pin.inner.node);
    const ports = node && !bench.has(node.id) ? portsOfNode(node, circuits) : null;
    const port = (pin.dir === 'in' ? ports?.inputs : ports?.outputs)?.find((p) => p.id === pin.inner.port);
    const innerKey = `${pin.dir}|${pin.inner.node}|${pin.inner.port}`;
    // Two 'in' pins on one inner port would let two wires feed it; two 'out' pins on one output are fine.
    const clash = pin.dir === 'in' && innerTaken.has(innerKey);
    if (pinIds.has(pin.id) || !port || port.type !== pin.type || clash) {
      issues.push({ code: 'bad-pin', circuit: c.id, pin: pin.id });
    } else if (pin.dir === 'in' && c.graph.wires.some((w) => w.to.node === pin.inner.node && w.to.port === pin.inner.port && !bench.has(w.from.node))) {
      issues.push({ code: 'pin-input-wired', circuit: c.id, pin: pin.id });
    }
    pinIds.add(pin.id);
    innerTaken.add(innerKey);
  }

  const exposedIds = new Set<string>();
  for (const e of c.exposed) {
    const node = nodes.get(e.inner.node);
    if (exposedIds.has(e.id) || !node || paramShape(node, e.inner.param, circuits, 1) === null) {
      issues.push({ code: 'bad-exposed', circuit: c.id, exposed: e.id });
    }
    exposedIds.add(e.id);
  }
}

const usedCircuits = (graph: Graph, circuits: CircuitLookup): string[] => [
  ...new Set(graph.nodes.filter(isInstance).map((n) => String(n.params[INSTANCE_CIRCUIT] ?? '')).filter((id) => circuits.has(id))),
];

/** Circuits that contain themselves (directly or through others) and nesting that is too deep. */
function nestingIssues(board: Pick<Board, 'graph' | 'circuits'>, circuits: CircuitLookup, issues: CircuitIssue[]): void {
  const inLoop = new Set<string>();
  /** Longest chain of nested circuits starting at this one (itself included); null while it sits on a loop. */
  const longest = new Map<string, string[] | null>();
  const walk = (id: string, stack: string[]): string[] | null => {
    if (longest.has(id)) return longest.get(id)!;
    const at = stack.indexOf(id);
    if (at >= 0) {
      const loop = stack.slice(at);
      if (!loop.some((x) => inLoop.has(x))) issues.push({ code: 'cycle', circuit: loop[0]!, chain: [...loop, id] });
      for (const x of loop) inLoop.add(x);
      return null;
    }
    let best: string[] = [];
    let broken = false;
    for (const child of usedCircuits(circuits.get(id)!.graph, circuits)) {
      const chain = walk(child, [...stack, id]);
      if (chain === null) broken = true;
      else if (chain.length > best.length) best = chain;
    }
    const result = broken || inLoop.has(id) ? null : [id, ...best];
    longest.set(id, result);
    return result;
  };
  for (const id of circuits.keys()) walk(id, []);

  // Depth counts from the main board: a circuit used there may nest MAX_CIRCUIT_DEPTH levels including itself.
  // A circuit nobody uses yet is held to the same limit, so it can always be placed on the main board.
  const reported = new Set<string>();
  for (const id of [...usedCircuits(board.graph, circuits), ...circuits.keys()]) {
    const chain = longest.get(id);
    if (!chain || chain.length <= MAX_CIRCUIT_DEPTH || reported.has(id)) continue;
    reported.add(id);
    issues.push({ code: 'too-deep', circuit: id, chain });
  }
}

/** False for a problem a board can be saved, loaded and run with (work in progress, not damage). */
export const isBlockingIssue = (issue: CircuitIssue): boolean => issue.code !== 'pin-unwired';

/** Every problem with the board's circuits, in a stable order; none that `isBlockingIssue` = `expandBoard` will run; empty = every pin and exposed setting leads somewhere too. */
export function validateCircuits(board: Pick<Board, 'graph' | 'circuits'>): CircuitIssue[] {
  const issues: CircuitIssue[] = [];
  const list = board.circuits ?? [];
  const seen = new Set<string>();
  for (const c of list) {
    if (seen.has(c.id)) issues.push({ code: 'duplicate-circuit', circuit: c.id });
    seen.add(c.id);
  }
  const circuits = circuitLookup(list);
  instanceIssues(board.graph, undefined, circuits, issues);
  for (const c of circuits.values()) instanceIssues(c.graph, c.id, circuits, issues);
  nestingIssues(board, circuits, issues);
  // Pins and exposed settings are followed through nested copies, which only ends when no circuit contains itself.
  if (!issues.some((i) => i.code === 'cycle')) for (const c of circuits.values()) ownIssues(c, circuits, issues);
  return issues;
}
