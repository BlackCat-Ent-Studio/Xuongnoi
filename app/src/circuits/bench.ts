import { getNodeDef, knownInputs } from '../engine/registry';
import type { Board, CircuitPin, Graph, GraphNode, PortRef, Wire } from '../engine/types';
import { expandCircuitAlone, type CircuitIdMap } from './expand';

/**
 * One circuit on the test bench: the flat graph of `expandCircuitAlone` plus one ordinary source card per 'in' pin, so the
 * pin can be driven by hand while the circuit runs on its own.
 *
 * - A Đúng/Sai pin gets a "Phím bấm" card whose key is a made-up code (`benchKey`); the bench puts that code among the
 *   keys held down to switch the pin on.
 * - A Số pin gets a "Số cố định" card; its `value` setting is the pin's value and can change while the run goes on.
 * - A Vật thể pin gets nothing: an object has to come from a card, so the pin stays as it is with no wire outside, unless a
 *   bench card of the circuit is wired to the same inner port.
 *
 * Nothing here ever reaches the real board: these cards exist only in the graph this function returns.
 */

export const BENCH_PREFIX = '@bench:';
/** Id of the source card that feeds a pin on the bench; for a Đúng/Sai pin it is also the key code that switches it on. */
export const benchKey = (pinId: string): string => `${BENCH_PREFIX}${pinId}`;

export type BenchDrive =
  /** Fed by the bench's own source card: `node` is its id. */
  | { by: 'switch'; node: string }
  | { by: 'number'; node: string; value: number }
  /** A card of the circuit (a bench card) already feeds the inner port: `from` is that output. */
  | { by: 'card'; from: PortRef }
  /** Nothing feeds it: the pin is not wired inside, or it carries an object. */
  | { by: 'nothing'; why: 'unwired' | 'object' };

export interface BenchInput {
  pin: CircuitPin;
  /** The real input the pin leads to in the bench graph; null when it leads nowhere. */
  port: PortRef | null;
  drive: BenchDrive;
}

export interface BenchOutput {
  pin: CircuitPin;
  /** The real output to read the pin's value from; null when the pin leads nowhere. */
  port: PortRef | null;
}

export interface BenchPlan {
  graph: Graph;
  idMap: CircuitIdMap;
  inputs: BenchInput[];
  outputs: BenchOutput[];
}

/** What an input reads when no wire is on it: the port's own default, else 0. */
function restingNumber(nodes: readonly GraphNode[], port: PortRef): number {
  const node = nodes.find((n) => n.id === port.node);
  const def = node && getNodeDef(node.kind);
  const value = def ? knownInputs(def).find((p) => p.id === port.port)?.default : undefined;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * The graph to run for a bench test of one circuit. `numbers`: the value typed for each Số pin (by pin id); a pin without
 * one starts at what its inner port reads with no wire. Throws a `CircuitError` like `expandCircuitAlone`.
 */
export function benchPlan(board: Pick<Board, 'graph' | 'circuits'>, circuitId: string, numbers: ReadonlyMap<string, number> = new Map()): BenchPlan {
  const { graph, idMap } = expandCircuitAlone(board, circuitId);
  const circuit = (board.circuits ?? []).find((c) => c.id === circuitId)!;
  const taken = new Set(graph.nodes.map((n) => n.id));
  const nodes: GraphNode[] = [];
  const wires: Wire[] = [];
  const inputs: BenchInput[] = [];
  const outputs: BenchOutput[] = [];

  for (const pin of circuit.pins) {
    const port = idMap.pinPort([], pin.id) ?? null;
    if (pin.dir === 'out') {
      outputs.push({ pin, port });
      continue;
    }
    if (!port) {
      inputs.push({ pin, port, drive: { by: 'nothing', why: 'unwired' } });
      continue;
    }
    const fed = graph.wires.find((w) => w.to.node === port.node && w.to.port === port.port);
    if (fed) {
      inputs.push({ pin, port, drive: { by: 'card', from: fed.from } });
      continue;
    }
    const id = benchKey(pin.id);
    if (pin.type === 'object' || taken.has(id)) {
      inputs.push({ pin, port, drive: { by: 'nothing', why: 'object' } });
      continue;
    }
    if (pin.type === 'bool') {
      nodes.push({ id, kind: 'key', params: { key: id }, pos: { x: 0, y: 0 } });
      wires.push({ id, from: { node: id, port: 'held' }, to: port });
      inputs.push({ pin, port, drive: { by: 'switch', node: id } });
    } else {
      const value = numbers.get(pin.id) ?? restingNumber(graph.nodes, port);
      nodes.push({ id, kind: 'const', params: { value }, pos: { x: 0, y: 0 } });
      wires.push({ id, from: { node: id, port: 'value' }, to: port });
      inputs.push({ pin, port, drive: { by: 'number', node: id, value } });
    }
  }
  // The source cards go first; their ids also sort ahead of every card they feed.
  return { graph: { ...graph, nodes: [...nodes, ...graph.nodes], wires: [...graph.wires, ...wires] }, idMap, inputs, outputs };
}
