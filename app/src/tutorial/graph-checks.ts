import { getNodeDef } from '../engine/registry';
import type { Graph, GraphNode, ParamValue, Vec3 } from '../engine/types';

export type NodeFilter = (node: GraphNode) => boolean;

export function nodesOfKind(graph: Graph, kind: string, where?: NodeFilter): GraphNode[] {
  return graph.nodes.filter((n) => n.kind === kind && (!where || where(n)));
}

export function hasNode(graph: Graph, kind: string, where?: NodeFilter): boolean {
  return nodesOfKind(graph, kind, where).length > 0;
}

/** Param value with the node definition's default as fallback. */
export function paramOf(node: GraphNode, id: string): ParamValue | undefined {
  const v = node.params[id];
  if (v !== undefined) return v;
  return getNodeDef(node.kind)?.params.find((p) => p.id === id)?.default;
}

export function numParam(node: GraphNode, id: string): number | null {
  const v = paramOf(node, id);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function vecParam(node: GraphNode, id: string): Vec3 | null {
  const v = paramOf(node, id);
  if (v && typeof v === 'object') return v;
  return null;
}

export interface Endpoint {
  kind: string;
  port: string;
  where?: NodeFilter;
}

/** True when some wire joins a matching output port to a matching input port. */
export function hasWire(graph: Graph, from: Endpoint, to: Endpoint): boolean {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  return graph.wires.some((w) => {
    const a = byId.get(w.from.node);
    const b = byId.get(w.to.node);
    if (!a || !b) return false;
    return (
      a.kind === from.kind &&
      w.from.port === from.port &&
      (!from.where || from.where(a)) &&
      b.kind === to.kind &&
      w.to.port === to.port &&
      (!to.where || to.where(b))
    );
  });
}

// ---------- shared node filters ----------

export const isPickup: NodeFilter = (n) => paramOf(n, 'type') === 'pickup';

/** A wide solid block: the floor of the first lesson (tolerant: any block at least 5 wide). */
export const isFloor: NodeFilter = (n) => {
  if (paramOf(n, 'type') === 'pickup') return false;
  const size = vecParam(n, 'size');
  return size !== null && size.x >= 5;
};
