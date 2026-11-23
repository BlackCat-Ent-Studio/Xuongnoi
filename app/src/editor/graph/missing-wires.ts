import { getNodeDef } from '../../engine/registry';
import type { Graph } from '../../engine/types';

export interface MissingWire {
  nodeId: string;
  portId: string;
  /** Vietnamese label of the unconnected input. */
  label: string;
}

/** Required input ports that have no wire, in node order then port order. */
export function listMissingWires(graph: Graph): MissingWire[] {
  const wired = new Set(graph.wires.map((w) => `${w.to.node}|${w.to.port}`));
  const out: MissingWire[] = [];
  for (const node of graph.nodes) {
    const def = getNodeDef(node.kind);
    if (!def) continue;
    for (const port of def.inputs) {
      if (port.required && !wired.has(`${node.id}|${port.id}`)) out.push({ nodeId: node.id, portId: port.id, label: port.label });
    }
  }
  return out;
}
