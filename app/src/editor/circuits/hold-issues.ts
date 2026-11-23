import { MAX_CIRCUIT_DEPTH, isInstance, isPinWired } from '../../circuits/instance';
import { getNodeDef, knownInputs, knownOutputs } from '../../engine/registry';
import type { Board, Circuit, Graph, GraphNode } from '../../engine/types';
import { holdRobotCount } from '../../nodes/cell-hold';
import { CONSOLE_TEXT } from '../console/console-text-vi';
import type { Issue } from '../console/issues';
import { cardLabel, circuitIdOf, findCircuit } from './circuit-model';
import { CIRCUIT_VI as T } from './circuit-text-vi';

const HOLD_KIND = 'cell-hold';
const ROBOT_KIND = 'robot-body';

/** True for a chassis card and for a copy of a circuit that has a chassis somewhere inside. */
function isRobot(board: Pick<Board, 'circuits'>, node: GraphNode, depth = 1): boolean {
  if (!isInstance(node)) return node.kind === ROBOT_KIND;
  if (depth > MAX_CIRCUIT_DEPTH) return false;
  const inner = findCircuit(board, circuitIdOf(node));
  return inner !== undefined && inner.graph.nodes.some((n) => !inner.benchIds.includes(n.id) && isRobot(board, n, depth + 1));
}

/**
 * What "Bảng giữ ô" adds to "Việc cần sửa" for one canvas (the main board, or the inside of `circuit`):
 * - a robot row of the card that is wired in part: a row in use needs "Robot k", "Ô robot k muốn tới" and somewhere for
 *   "Ô robot k được đi" to go ("đang chờ ô" and "đứng giữa ô" are optional). A row with no wire at all is a spare row.
 * - a robot (a chassis card, or a copy of a circuit with a chassis inside) on a canvas that has such a card, with no
 *   wire into any "Robot k" of it: the other robots cannot know where it is.
 * A pin of `circuit` counts as a wire, since the wire then comes from outside.
 */
export function holdWiringIssues(board: Pick<Board, 'circuits'>, graph: Graph, circuit?: Circuit): (Issue & { circuitId?: string })[] {
  const bench = new Set(circuit?.benchIds ?? []);
  const holds = graph.nodes.filter((n) => n.kind === HOLD_KIND && !bench.has(n.id));
  if (holds.length === 0) return [];
  const pins = (circuit?.pins ?? []).filter(isPinWired);
  const fed = new Set([...graph.wires.map((w) => `${w.to.node}|${w.to.port}`), ...pins.filter((p) => p.dir === 'in').map((p) => `${p.inner.node}|${p.inner.port}`)]);
  const read = new Set([...graph.wires.map((w) => `${w.from.node}|${w.from.port}`), ...pins.filter((p) => p.dir === 'out').map((p) => `${p.inner.node}|${p.inner.port}`)]);
  const where = circuit ? { circuitId: circuit.id } : {};
  const inside = (text: string): string => (circuit ? T.issueIn(circuit.name, text) : text);
  const issues: (Issue & { circuitId?: string })[] = [];
  const def = getNodeDef(HOLD_KIND);
  const ports = def ? [...knownInputs(def), ...knownOutputs(def)] : [];
  const labelOf = (port: string): string => ports.find((p) => p.id === port)?.label ?? port;
  /** `hold id|robotK` of every row that exists on its card. */
  const robotInputs = new Set<string>();

  for (const hold of holds) {
    const name = cardLabel(board, hold);
    for (let k = 1; k <= holdRobotCount(hold.params); k++) {
      robotInputs.add(`${hold.id}|robot${k}`);
      const has = (port: string, set: ReadonlySet<string>): boolean => set.has(`${hold.id}|${port}${k}`);
      const used = has('robot', fed) || has('want', fed) || has('cell', read) || has('wait', read) || has('stood', read);
      if (!used) continue;
      const add = (port: string, text: (card: string, row: number, label: string) => string): void => {
        issues.push({ key: `hold:${circuit?.id ?? ''}:${hold.id}:${port}${k}`, nodeId: hold.id, text: inside(text(name, k, labelOf(`${port}${k}`))), ...where });
      };
      if (!has('robot', fed)) add('robot', CONSOLE_TEXT.holdRowInput);
      if (!has('want', fed)) add('want', CONSOLE_TEXT.holdRowInput);
      if (!has('cell', read)) add('cell', CONSOLE_TEXT.holdRowOutput);
    }
  }

  for (const node of graph.nodes) {
    if (bench.has(node.id) || !isRobot(board, node)) continue;
    if (graph.wires.some((w) => w.from.node === node.id && robotInputs.has(`${w.to.node}|${w.to.port}`))) continue;
    issues.push({ key: `hold-robot:${circuit?.id ?? ''}:${node.id}`, nodeId: node.id, text: inside(CONSOLE_TEXT.holdRobotLoose(cardLabel(board, node), cardLabel(board, holds[0]!))), ...where });
  }
  return issues;
}
