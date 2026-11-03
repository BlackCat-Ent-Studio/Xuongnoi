import { getNodeDef } from '../../engine/registry';
import type { Board, Graph, GraphNode, NodeGroup, Wire } from '../../engine/types';
import { beltOf } from '../../nodes/block';
import { estimateNodeSize } from './graph-geometry';

/**
 * The "every action needs its own wire" rule. Before it, some inputs counted as ON when nothing was wired to them
 * (a bot walked, a timer ran, a portal worked with no wire at all). Now they are OFF until a signal arrives.
 *
 * Boards saved before the rule carry no `settings.wireRule` mark. Loading one adds a visible "Khi bắt đầu" card per
 * scope (the main board, or one group) and wires its held "Đã bắt đầu" output into every one of those inputs that was
 * left empty, so the old board plays exactly as it did. The mark is then set, so the board is migrated only once and
 * a new board (which has the mark from the start) never gets any wire it did not ask for.
 */

interface OnByDefault {
  kind: string;
  port: string;
  /** Only some nodes of the kind use the input (a conveyor belt, not every Vật thể). */
  applies?: (node: GraphNode, board: { mode: Board['mode'] }) => boolean;
}

/** Inputs that used to be ON with nothing wired, plus the two brains that had no start input at all. */
export const FORMERLY_ON_BY_DEFAULT: readonly OnByDefault[] = [
  { kind: 'go-to', port: 'go' },
  { kind: 'patrol', port: 'on' },
  { kind: 'route-follow', port: 'on' },
  { kind: 'chase', port: 'go' },
  { kind: 'fight', port: 'go' },
  { kind: 'timer', port: 'run' },
  { kind: 'moving-platform', port: 'run' },
  { kind: 'rotating-platform', port: 'run' },
  {
    kind: 'block',
    port: 'run',
    applies: (n, b) => {
      const size = n.params.size;
      return typeof size === 'object' && beltOf(n.params, size, b.mode) !== null;
    },
  },
  { kind: 'portal', port: 'on' },
  { kind: 'camera', port: 'on' },
  { kind: 'show-text', port: 'show' },
  { kind: 'guide-arrow', port: 'show' },
  { kind: 'ui-button', port: 'show' },
  { kind: 'ui-meter', port: 'show' },
];

const START_KIND = 'on-start';
const START_PORT = 'started';
const START_GAP = 80;

export const hasWireRuleMark = (graph: Graph): boolean => graph.settings?.wireRule === true;

interface Pending {
  scope: string;
  node: string;
  port: string;
}

const wireKey = (node: string, port: string): string => `${node}|${port}`;

/** An id that sorts before every other id, so the start card is evaluated first and nothing else changes order. */
function firstId(ids: ReadonlySet<string>, taken: ReadonlySet<string>): string {
  let id = '-start';
  while (taken.has(id) || [...ids].some((other) => other < id)) id = `-${id}`;
  return id;
}

/** A "Khi bắt đầu" card standing left of `mates`, in line with the topmost of them, so it covers nothing. */
function startCardBeside(id: string, mates: readonly GraphNode[]): GraphNode {
  const left = mates.length > 0 ? Math.min(...mates.map((n) => n.pos.x)) : 0;
  const top = mates.length > 0 ? Math.min(...mates.map((n) => n.pos.y)) : 0;
  const start: GraphNode = { id, kind: START_KIND, params: {}, pos: { x: 0, y: top } };
  start.pos.x = Math.round(left - (mates.length > 0 ? estimateNodeSize(start).w + START_GAP : 0));
  return start;
}

/** Forecast pieces used to read the guard's patrol and the target's route out of thin air; now they are wired. */
function forecastWires(graph: Graph, wired: Set<string>): Wire[] {
  const out: Wire[] = [];
  const source = (node: string, port: string): string | undefined => {
    const w = graph.wires.find((x) => x.to.node === node && x.to.port === port);
    return w ? wireKey(w.from.node, w.from.port) : undefined;
  };
  const used = new Set(graph.wires.map((w) => w.id));
  let n = 0;
  const freshId = (): string => {
    for (;;) {
      const id = `wr-route-${++n}`;
      if (!used.has(id)) {
        used.add(id);
        return id;
      }
    }
  };
  for (const f of graph.nodes) {
    if (f.kind !== 'sight-forecast') continue;
    const pairs: [string, string, string, string][] = [
      ['viewer', 'patrol', 'patrol', 'route'],
      ['target', 'route', 'route-follow', 'route'],
    ];
    for (const [watched, inPort, kind, outPort] of pairs) {
      if (wired.has(wireKey(f.id, inPort))) continue;
      const who = source(f.id, watched);
      if (!who) continue;
      const walker = graph.nodes.find((x) => x.kind === kind && source(x.id, 'self') === who);
      if (!walker) continue;
      out.push({ id: freshId(), from: { node: walker.id, port: outPort }, to: { node: f.id, port: inPort } });
      wired.add(wireKey(f.id, inPort));
    }
  }
  return out;
}

/**
 * Brings a graph from before the wire rule up to it (see the file comment). Returns the same object when the mark is
 * already there. `mode` is the board's view mode (a belt's direction depends on it).
 */
export function migrateWireRule(graph: Graph, mode: Board['mode']): Graph {
  if (hasWireRuleMark(graph)) return graph;
  const marked: Graph['settings'] = { ...graph.settings, wireRule: true };

  const wired = new Set(graph.wires.map((w) => wireKey(w.to.node, w.to.port)));
  const scopeOf = new Map<string, string>();
  for (const g of graph.groups ?? []) for (const id of g.nodeIds) scopeOf.set(id, g.id);

  const pending: Pending[] = [];
  for (const node of graph.nodes) {
    for (const rule of FORMERLY_ON_BY_DEFAULT) {
      if (node.kind !== rule.kind || wired.has(wireKey(node.id, rule.port))) continue;
      if (!getNodeDef(node.kind)?.inputs.some((p) => p.id === rule.port)) continue;
      if (rule.applies && !rule.applies(node, { mode })) continue;
      pending.push({ scope: scopeOf.get(node.id) ?? '', node: node.id, port: rule.port });
    }
  }
  const extraWires = forecastWires(graph, wired);

  if (pending.length === 0 && extraWires.length === 0) return { ...graph, settings: marked };

  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const wireIds = new Set(graph.wires.map((w) => w.id));
  const newNodes: GraphNode[] = [];
  const newWires: Wire[] = [...extraWires];
  const memberships = new Map<string, string[]>();
  const scopes = [...new Set(pending.map((p) => p.scope))];

  for (const scope of scopes) {
    const id = firstId(nodeIds, new Set(newNodes.map((n) => n.id)));
    const start = startCardBeside(id, graph.nodes.filter((n) => (scopeOf.get(n.id) ?? '') === scope));
    newNodes.push(start);
    if (scope !== '') memberships.set(scope, [id]);
    let n = 0;
    for (const p of pending.filter((x) => x.scope === scope)) {
      let wid: string;
      do wid = `wr-start-${++n}`;
      while (wireIds.has(wid));
      wireIds.add(wid);
      newWires.push({ id: wid, from: { node: id, port: START_PORT }, to: { node: p.node, port: p.port } });
    }
  }

  const groups: NodeGroup[] | undefined = graph.groups?.map((g) => {
    const extra = memberships.get(g.id);
    return extra ? { ...g, nodeIds: [...g.nodeIds, ...extra] } : g;
  });
  return {
    ...graph,
    nodes: [...newNodes, ...graph.nodes],
    wires: [...graph.wires, ...newWires],
    ...(groups ? { groups } : {}),
    settings: marked,
  };
}

/**
 * A board with a "Khi bắt đầu" card on its main board for the learner to wire (the lessons use it). A board that already
 * has one is left alone.
 */
export function addStartCard(board: Board): Board {
  const { graph } = board;
  if (graph.nodes.some((n) => n.kind === START_KIND)) return board;
  const grouped = new Set((graph.groups ?? []).flatMap((g) => g.nodeIds));
  const id = 'start-card';
  const taken = new Set(graph.nodes.map((n) => n.id));
  const unique = taken.has(id) ? firstId(taken, new Set()) : id;
  const card = startCardBeside(unique, graph.nodes.filter((n) => !grouped.has(n.id)));
  return { ...board, graph: { ...graph, nodes: [card, ...graph.nodes] } };
}

/** The same for a whole board. */
export function migrateBoardWireRule(board: Board): Board {
  const graph = migrateWireRule(board.graph, board.mode);
  return graph === board.graph ? board : { ...board, graph };
}
