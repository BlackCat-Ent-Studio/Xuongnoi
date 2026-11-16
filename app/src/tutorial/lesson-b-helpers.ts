import type { Graph, GraphNode } from '../engine/types';
import { nodesOfKind } from './graph-checks';
import type { Snapshot, Step, TargetList } from './types';

/** Step-building helpers shared by the lessons of course pack B (resolve nodes by role, require several wires at once). */

type Pick2 = Pick<Step, 'id' | 'target' | 'check'>;

export type NodeFilterFn = (n: GraphNode) => boolean;
/** Finds the node that plays a role on the current board; undefined while it is not there yet. */
export type Resolve = (g: Graph) => GraphNode | undefined;

/** The top-bar button that leaves play mode (the Chạy button turns into a restart button while playing). */
export const STOP_BUTTON = '.play .pbtn.stop';

export const paramSel = (id: string): string => `.prop-row[data-param="${id}"]`;

export function first(graph: Graph, kind: string, where?: NodeFilterFn): GraphNode | undefined {
  return nodesOfKind(graph, kind, where)[0];
}

/** The node of `kind` added last, so a hint never points at one that was already on the starter board. */
export function newest(graph: Graph, kind: string, where?: NodeFilterFn): GraphNode | undefined {
  const all = nodesOfKind(graph, kind, where);
  return all[all.length - 1];
}

export function wired(graph: Graph, from: GraphNode | undefined, fromPort: string, to: GraphNode | undefined, toPort: string): boolean {
  if (!from || !to) return false;
  return graph.wires.some((w) => w.from.node === from.id && w.from.port === fromPort && w.to.node === to.id && w.to.port === toPort);
}

export interface Link {
  ends(graph: Graph): { from?: GraphNode; fromPort: string; to?: GraphNode; toPort: string };
}

export const link = (from: Resolve, fromPort: string, to: Resolve, toPort: string): Link => ({
  ends: (g) => ({ from: from(g), fromPort, to: to(g), toPort }),
});

function linkDone(graph: Graph, l: Link): boolean {
  const e = l.ends(graph);
  return wired(graph, e.from, e.fromPort, e.to, e.toPort);
}

/** Done when every listed wire exists; the hint shows the ports of the first wire still missing. */
export function wiresStep(id: string, links: Link[]): Pick2 {
  return {
    id,
    target: (snap: Snapshot): TargetList => {
      const missing = links.find((l) => !linkDone(snap.graph, l)) ?? links[0]!;
      const e = missing.ends(snap.graph);
      const out: string[] = [];
      if (e.from) out.push(`.wc-port[data-node="${e.from.id}"][data-port="${e.fromPort}"][data-dir="out"]`);
      if (e.to) out.push(`.wc-port[data-node="${e.to.id}"][data-port="${e.toPort}"][data-dir="in"]`);
      return out;
    },
    check: (snap) => links.every((l) => linkDone(snap.graph, l)),
  };
}

/** Done when the node found by `who` satisfies `ok`; the hint points at the property row (or the node while unselected). */
export function paramStep(id: string, who: Resolve, paramId: string, ok: (n: GraphNode, g: Graph) => boolean): Pick2 {
  return {
    id,
    target: (snap: Snapshot): TargetList => {
      const n = who(snap.graph);
      return [n ? [paramSel(paramId), `.wc-node[data-id="${n.id}"]`] : paramSel(paramId)];
    },
    check: (snap) => {
      const n = who(snap.graph);
      return n !== undefined && ok(n, snap.graph);
    },
  };
}
