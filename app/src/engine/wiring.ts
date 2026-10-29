import { getNodeDef } from './registry';
import type { ConnectResult, Graph, PortRef, Wire } from './types';

type ConnectFailure = Extract<ConnectResult, { ok: false }>;

/** Check whether a wire from an output port to an input port is allowed. */
export function canConnect(graph: Graph, from: PortRef, to: PortRef): ConnectResult {
  const fromNode = graph.nodes.find((n) => n.id === from.node);
  const toNode = graph.nodes.find((n) => n.id === to.node);
  if (!fromNode || !toNode) return { ok: false, reason: 'unknown-node' };
  const fromDef = getNodeDef(fromNode.kind);
  const toDef = getNodeDef(toNode.kind);
  if (!fromDef || !toDef) return { ok: false, reason: 'unknown-node' };

  const fromOut = fromDef.outputs.find((p) => p.id === from.port);
  const toIn = toDef.inputs.find((p) => p.id === to.port);
  if (!fromOut || !toIn) {
    // A port that exists on the opposite side is a direction error; otherwise it is missing.
    const fromIsInput = !fromOut && fromDef.inputs.some((p) => p.id === from.port);
    const toIsOutput = !toIn && toDef.outputs.some((p) => p.id === to.port);
    return { ok: false, reason: fromIsInput || toIsOutput ? 'wrong-direction' : 'unknown-port' };
  }

  if (from.node === to.node) return { ok: false, reason: 'same-node' };
  if (fromOut.type !== toIn.type) return { ok: false, reason: 'type-mismatch' };
  if (graph.wires.some((w) => w.to.node === to.node && w.to.port === to.port)) {
    return { ok: false, reason: 'input-taken' };
  }
  return { ok: true };
}

function freshWireId(graph: Graph): string {
  const used = new Set(graph.wires.map((w) => w.id));
  let i = graph.wires.length + 1;
  while (used.has(`w${i}`)) i++;
  return `w${i}`;
}

/** Returns a new graph with the wire added, or the failure from canConnect. */
export function addWire(graph: Graph, from: PortRef, to: PortRef, id?: string): Graph | ConnectFailure {
  const res = canConnect(graph, from, to);
  if (!res.ok) return res;
  const wire: Wire = { id: id ?? freshWireId(graph), from: { ...from }, to: { ...to } };
  return { ...graph, wires: [...graph.wires, wire] };
}

export function removeWire(graph: Graph, wireId: string): Graph {
  return { ...graph, wires: graph.wires.filter((w) => w.id !== wireId) };
}

/** Removes a node and every wire attached to it. */
export function removeNode(graph: Graph, nodeId: string): Graph {
  return {
    ...graph,
    nodes: graph.nodes.filter((n) => n.id !== nodeId),
    wires: graph.wires.filter((w) => w.from.node !== nodeId && w.to.node !== nodeId),
  };
}
