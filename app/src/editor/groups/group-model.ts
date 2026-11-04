import { getNodeDef, knownInputs, knownOutputs } from '../../engine/registry';
import type { Graph, GraphNode, NodeGroup, PortType, Wire } from '../../engine/types';

/**
 * Pure helpers for "Nhóm mảnh ghép". A group is editor-only organisation: `graph.nodes` and `graph.wires`
 * stay flat so the engine never sees groups. A node is in at most one group; groups never nest.
 */

export const GROUP_NAME_MAX = 40;
export const GROUP_COLORS = ['#3ecf8e', '#5aa9ff', '#a894ff', '#f27ad0', '#f0965a', '#f7d046', '#ff7f7f'] as const;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const isGroupColor = (v: unknown): v is string => typeof v === 'string' && COLOR_RE.test(v);

export const groupsOf = (graph: Graph): readonly NodeGroup[] => graph.groups ?? [];

export function findGroup(graph: Graph, id: string): NodeGroup | undefined {
  return graph.groups?.find((g) => g.id === id);
}

export function groupOfNode(graph: Graph, nodeId: string): NodeGroup | undefined {
  return graph.groups?.find((g) => g.nodeIds.includes(nodeId));
}

/** Graph with these groups; the field is dropped when empty so boards without groups stay byte-identical. */
export function withGroups(graph: Graph, groups: NodeGroup[]): Graph {
  const { groups: _old, ...rest } = graph;
  return groups.length > 0 ? { ...rest, groups } : rest;
}

export function nextGroupId(graph: Graph): string {
  const used = new Set(groupsOf(graph).map((g) => g.id));
  let i = used.size + 1;
  while (used.has(`grp${i}`)) i++;
  return `grp${i}`;
}

/** "Nhóm 1", "Nhóm 2"... the first number no group uses yet. */
export function defaultGroupName(graph: Graph): string {
  const names = new Set(groupsOf(graph).map((g) => g.name));
  let i = 1;
  while (names.has(`Nhóm ${i}`)) i++;
  return `Nhóm ${i}`;
}

export function cleanGroupName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, GROUP_NAME_MAX);
}

/**
 * Drops node ids that no longer exist, repeated memberships (first group wins) and empty groups.
 * Returns the same graph object when nothing needed fixing.
 */
export function pruneGroups(graph: Graph): Graph {
  if (!graph.groups) return graph;
  const alive = new Set(graph.nodes.map((n) => n.id));
  const taken = new Set<string>();
  let changed = false;
  const out: NodeGroup[] = [];
  for (const g of graph.groups) {
    const ids = g.nodeIds.filter((id) => alive.has(id) && !taken.has(id));
    for (const id of ids) taken.add(id);
    if (ids.length !== g.nodeIds.length) changed = true;
    if (ids.length === 0) {
      changed = true;
      continue;
    }
    out.push(ids.length === g.nodeIds.length ? g : { ...g, nodeIds: ids });
  }
  return changed ? withGroups(graph, out) : graph;
}

/** Nodes the canvas shows: the ungrouped ones at the top level, or the members of the entered group. */
export function nodesInScope(graph: Graph, scope: string | null): GraphNode[] {
  if (scope === null) {
    const grouped = new Set(groupsOf(graph).flatMap((g) => g.nodeIds));
    return grouped.size === 0 ? graph.nodes : graph.nodes.filter((n) => !grouped.has(n.id));
  }
  const ids = new Set(findGroup(graph, scope)?.nodeIds ?? []);
  return graph.nodes.filter((n) => ids.has(n.id));
}

export type GroupFail = 'too-few' | 'has-group';

export type CreateGroupResult = { ok: true; graph: Graph; groupId: string } | { ok: false; reason: GroupFail };

/** Groups the given ungrouped nodes. The block lands at the top-left of their bounding box. */
export function createGroup(graph: Graph, nodeIds: readonly string[], opts?: { name?: string; color?: string }): CreateGroupResult {
  const want = new Set(nodeIds);
  const nodes = graph.nodes.filter((n) => want.has(n.id));
  if (nodes.some((n) => groupOfNode(graph, n.id))) return { ok: false, reason: 'has-group' };
  if (nodes.length < 2) return { ok: false, reason: 'too-few' };
  const id = nextGroupId(graph);
  const group: NodeGroup = {
    id,
    name: cleanGroupName(opts?.name ?? '') || defaultGroupName(graph),
    nodeIds: nodes.map((n) => n.id),
    x: Math.min(...nodes.map((n) => n.pos.x)),
    y: Math.min(...nodes.map((n) => n.pos.y)),
  };
  if (isGroupColor(opts?.color)) group.color = opts.color;
  return { ok: true, graph: withGroups(graph, [...groupsOf(graph), group]), groupId: id };
}

/** Dissolves a group. Members keep their place, shifted by however far the block was dragged. */
export function ungroup(graph: Graph, groupId: string): Graph {
  const g = findGroup(graph, groupId);
  if (!g) return graph;
  const members = graph.nodes.filter((n) => g.nodeIds.includes(n.id));
  const dx = members.length > 0 ? g.x - Math.min(...members.map((n) => n.pos.x)) : 0;
  const dy = members.length > 0 ? g.y - Math.min(...members.map((n) => n.pos.y)) : 0;
  const nodes =
    dx === 0 && dy === 0
      ? graph.nodes
      : graph.nodes.map((n) => (g.nodeIds.includes(n.id) ? { ...n, pos: { x: n.pos.x + dx, y: n.pos.y + dy } } : n));
  return withGroups({ ...graph, nodes }, groupsOf(graph).filter((x) => x.id !== groupId));
}

export function patchGroup(graph: Graph, groupId: string, patch: Partial<Pick<NodeGroup, 'name' | 'color' | 'x' | 'y'>>): Graph {
  const groups = groupsOf(graph).map((g) => {
    if (g.id !== groupId) return g;
    const next: NodeGroup = { ...g, ...patch };
    if (patch.color === undefined && 'color' in patch) delete next.color;
    return next;
  });
  return withGroups(graph, groups);
}

// ---------- boundary ports ----------

export interface GroupPort {
  /** `${node}|${port}|${dir}` of the inner port; unique per group. */
  key: string;
  /** The inner port this boundary port stands for. */
  node: string;
  port: string;
  /** `in`: an inner input fed from outside. `out`: an inner output feeding something outside. */
  dir: 'in' | 'out';
  type: PortType;
  /** "<node label> · <port label>" */
  label: string;
  /** Wires crossing the boundary through this port. */
  wires: Wire[];
}

function nodeTitle(node: GraphNode): string {
  const named = node.params.name;
  if (typeof named === 'string' && named.trim()) return named.trim();
  return getNodeDef(node.kind)?.label ?? node.kind;
}

/**
 * Boundary ports of a group: every wire with exactly one end inside becomes a port on the inner port it touches.
 * Several outside wires on the same inner port share one group port.
 */
export function deriveGroupPorts(graph: Graph, group: NodeGroup): GroupPort[] {
  const inside = new Set(group.nodeIds);
  const byKey = new Map<string, GroupPort>();
  const touch = (w: Wire, ref: { node: string; port: string }, dir: 'in' | 'out'): void => {
    const node = graph.nodes.find((n) => n.id === ref.node);
    const def = node && getNodeDef(node.kind);
    const pd = (dir === 'in' ? (def ? knownInputs(def) : undefined) : (def ? knownOutputs(def) : undefined))?.find((p) => p.id === ref.port);
    if (!node || !pd) return;
    const key = `${ref.node}|${ref.port}|${dir}`;
    const have = byKey.get(key);
    if (have) have.wires.push(w);
    else byKey.set(key, { key, node: ref.node, port: ref.port, dir, type: pd.type, label: `${nodeTitle(node)} · ${pd.label}`, wires: [w] });
  };
  for (const w of graph.wires) {
    const a = inside.has(w.from.node);
    const b = inside.has(w.to.node);
    if (a && !b) touch(w, w.from, 'out');
    else if (b && !a) touch(w, w.to, 'in');
  }
  const ports = [...byKey.values()];
  // Same label twice (e.g. six "Đồ vật · Ẩn đi"): number them so the stubs and block rows can be told apart.
  const total = new Map<string, number>();
  for (const p of ports) total.set(p.label, (total.get(p.label) ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const p of ports) {
    if ((total.get(p.label) ?? 0) < 2) continue;
    const n = (seen.get(p.label) ?? 0) + 1;
    seen.set(p.label, n);
    p.label = `${p.label} (${n})`;
  }
  return ports;
}

/**
 * The graph as the canvas lays it out: group blocks stand in for their members (as pseudo nodes of kind `group`)
 * and wires are re-pointed at them; wires inside one group disappear. Inside a group it is just that group's nodes and wires.
 */
export function sceneGraph(graph: Graph, scope: string | null): Graph {
  if (scope !== null) {
    const nodes = nodesInScope(graph, scope);
    const ids = new Set(nodes.map((n) => n.id));
    return { nodes, wires: graph.wires.filter((w) => ids.has(w.from.node) && ids.has(w.to.node)) };
  }
  const groups = groupsOf(graph);
  if (groups.length === 0) return graph;
  const owner = new Map<string, string>();
  for (const g of groups) for (const id of g.nodeIds) owner.set(id, g.id);
  const nodes: GraphNode[] = [
    ...nodesInScope(graph, null),
    ...groups.map((g) => ({ id: g.id, kind: 'group', params: {}, pos: { x: g.x, y: g.y } })),
  ];
  const wires: Wire[] = [];
  const seen = new Set<string>();
  for (const w of graph.wires) {
    const from = owner.get(w.from.node) ?? w.from.node;
    const to = owner.get(w.to.node) ?? w.to.node;
    if (from === to && owner.has(w.from.node)) continue;
    const sig = `${from}>${to}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    wires.push({ id: w.id, from: { node: from, port: w.from.port }, to: { node: to, port: w.to.port } });
  }
  return { nodes, wires };
}
