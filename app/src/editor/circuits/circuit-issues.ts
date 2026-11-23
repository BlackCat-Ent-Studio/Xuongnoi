import { MAX_CIRCUIT_DEPTH, isInstance, isPinWired } from '../../circuits/instance';
import { validateCircuits } from '../../circuits/validate';
import { getNodeDef } from '../../engine/registry';
import { runnableGraph } from '../../circuits/runnable';
import type { Board, Circuit, CircuitPin, Graph, ViewMode } from '../../engine/types';
import { circuitIssueText } from '../../io/circuits-format';
import { CONSOLE_TEXT } from '../console/console-text-vi';
import { computeIssues, type Issue } from '../console/issues';
import { listMissingWires, type MissingWire } from '../graph/missing-wires';
import { cardLabel, circuitIdOf, circuitsOf, findCircuit, lookupOf, openCircuit, openGraph, type CircuitPath } from './circuit-model';
import { CIRCUIT_VI as T } from './circuit-text-vi';
import { holdWiringIssues } from './hold-issues';

/** Does this 'in' pin lead (through nested copies) to an input that must have a wire? */
function pinIsRequired(board: Pick<Board, 'circuits'>, circuit: Circuit, pin: CircuitPin, depth = 1): boolean {
  if (pin.dir !== 'in' || !isPinWired(pin) || depth > MAX_CIRCUIT_DEPTH) return false;
  const node = circuit.graph.nodes.find((n) => n.id === pin.inner.node);
  if (!node || circuit.benchIds.includes(node.id)) return false;
  if (!isInstance(node)) return getNodeDef(node.kind)?.inputs.find((p) => p.id === pin.inner.port)?.required === true;
  const inner = findCircuit(board, circuitIdOf(node));
  const innerPin = inner?.pins.find((p) => p.id === pin.inner.port);
  return inner !== undefined && innerPin !== undefined && pinIsRequired(board, inner, innerPin, depth + 1);
}

/**
 * Inputs of a graph that must have a wire and have none, copies of circuits included: a copy needs a wire on every pin that
 * leads to such an input. `circuit`: the circuit this graph belongs to; an input one of its 'in' pins feeds gets its wire
 * from outside, so it is not missing here.
 */
export function missingWiresOf(board: Pick<Board, 'circuits'>, graph: Graph, circuit?: Circuit): MissingWire[] {
  const fed = new Set((circuit?.pins ?? []).filter((p) => p.dir === 'in' && isPinWired(p)).map((p) => `${p.inner.node}|${p.inner.port}`));
  const bench = new Set(circuit?.benchIds ?? []);
  const out = listMissingWires(graph).filter((m) => !fed.has(`${m.nodeId}|${m.portId}`) && !bench.has(m.nodeId));
  const wired = new Set(graph.wires.map((w) => `${w.to.node}|${w.to.port}`));
  for (const node of graph.nodes) {
    if (!isInstance(node) || bench.has(node.id)) continue;
    const inner = findCircuit(board, circuitIdOf(node));
    for (const pin of inner?.pins ?? []) {
      if (wired.has(`${node.id}|${pin.id}`) || fed.has(`${node.id}|${pin.id}`)) continue;
      if (inner && pinIsRequired(board, inner, pin)) out.push({ nodeId: node.id, portId: pin.id, label: pin.label });
    }
  }
  return out;
}

/** Missing wires of what the canvas shows, per card. */
export function missingByCard(board: Board, path: CircuitPath): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const m of missingWiresOf(board, openGraph(board, path), openCircuit(board, path))) {
    const set = out.get(m.nodeId) ?? new Set<string>();
    set.add(m.portId);
    out.set(m.nodeId, set);
  }
  return out;
}

/** An entry of "Việc cần sửa" that lives in a circuit: `circuitId` is where to go, `nodeId` the card to select there. */
export type CircuitListIssue = Issue & { circuitId?: string };

/**
 * What the circuits add to "Việc cần sửa": copies on the main board with an unwired required pin, then per circuit its
 * unfinished pins, missing wires inside and anything `validateCircuits` finds. Empty for a board without circuits.
 */
export function circuitIssues(board: Board): CircuitListIssue[] {
  const circuits = circuitsOf(board);
  if (circuits.length === 0) return [];
  const lookup = lookupOf(board);
  const issues: CircuitListIssue[] = [];
  const copyGaps = (graph: Graph, circuit?: Circuit): void => {
    for (const m of missingWiresOf(board, graph, circuit)) {
      const node = graph.nodes.find((n) => n.id === m.nodeId);
      if (!node) continue;
      const copy = isInstance(node);
      // Plain cards of the main board are already listed by the board's own check.
      if (!copy && !circuit) continue;
      const text = copy ? T.issueMissingPin(cardLabel(board, node), m.label) : CONSOLE_TEXT.missingWire(cardLabel(board, node), m.label);
      issues.push({ key: `cw:${circuit?.id ?? ''}:${m.nodeId}:${m.portId}`, nodeId: m.nodeId, text: circuit ? T.issueIn(circuit.name, text) : text, ...(circuit ? { circuitId: circuit.id } : {}) });
    }
  };
  copyGaps(board.graph);
  for (const c of circuits) copyGaps(c.graph, c);

  for (const [i, issue] of validateCircuits(board).entries()) {
    const circuit = 'circuit' in issue && issue.circuit !== undefined ? lookup.get(issue.circuit) : undefined;
    const pinLabel = (id: string): string => circuit?.pins.find((p) => p.id === id)?.label ?? id;
    const exposedLabel = (c: Circuit | undefined, id: string): string => c?.exposed.find((e) => e.id === id)?.label ?? id;
    const where = circuit ? { circuitId: circuit.id } : {};
    const inside = (text: string): string => (circuit ? T.issueIn(circuit.name, text) : text);
    const key = `cv:${i}:${issue.code}`;
    switch (issue.code) {
      case 'pin-unwired':
        issues.push({ key, text: inside(T.issuePinUnwired(pinLabel(issue.pin))), ...where });
        break;
      case 'bad-pin':
        issues.push({ key, text: inside(T.issueBadPin(pinLabel(issue.pin))), ...where });
        break;
      case 'pin-input-wired':
        issues.push({ key, text: inside(T.issuePinInputWired(pinLabel(issue.pin))), ...where });
        break;
      case 'bad-exposed':
        issues.push({ key, text: inside(T.issueBadExposed(exposedLabel(circuit, issue.exposed))), ...where });
        break;
      case 'bad-value': {
        const graph = circuit?.graph ?? board.graph;
        const node = graph.nodes.find((n) => n.id === issue.node);
        const used = node ? findCircuit(board, circuitIdOf(node)) : undefined;
        issues.push({ key, nodeId: issue.node, text: inside(T.issueBadValue(node ? cardLabel(board, node) : issue.node, exposedLabel(used, issue.exposed))), ...where });
        break;
      }
      default:
        // Damage the editor itself never makes (a file edited by hand): the load message says it best.
        issues.push({ key, text: circuitIssueText(issue, lookup), ...where });
    }
  }
  return issues;
}

/**
 * The whole "Việc cần sửa" list of a board: the main board's own entries (robots half wired to "Bảng giữ ô" included), then what its circuits add. Something to play
 * (a character, a robot) may sit inside a circuit, so that check looks at the board as it runs.
 */
export function boardIssues(board: Board, mode: ViewMode): CircuitListIssue[] {
  const own = [...computeIssues(board.graph, mode), ...holdWiringIssues(board, board.graph)];
  if (circuitsOf(board).length === 0) return own;
  let nothingToPlay = true;
  try {
    nothingToPlay = computeIssues(runnableGraph(board), mode).some((i) => i.key === 'no-character');
  } catch {
    // The board does not expand; the circuit entries below say why.
    nothingToPlay = false;
  }
  return [...own.filter((i) => i.key !== 'no-character' || nothingToPlay), ...circuitIssues(board), ...circuitsOf(board).flatMap((c) => holdWiringIssues(board, c.graph, c))];
}
