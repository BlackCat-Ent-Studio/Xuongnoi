import { CONNECT_FAIL_TEXT } from '../../engine/text-vi';
import { getNodeDef } from '../../engine/registry';
import type { Graph, PortRef, PortType } from '../../engine/types';
import { canConnect } from '../../engine/wiring';
import { typeMismatchText } from './graph-text-vi';

export type PortDir = 'in' | 'out';

export type Compat = { ok: true } | { ok: false; message: string };

function portInfo(graph: Graph, ref: PortRef, dir: PortDir): { label: string; type: PortType } | null {
  const node = graph.nodes.find((n) => n.id === ref.node);
  const def = node ? getNodeDef(node.kind) : undefined;
  const p = (dir === 'in' ? def?.inputs : def?.outputs)?.find((x) => x.id === ref.port);
  return p ? { label: p.label, type: p.type } : null;
}

/**
 * Can a wire be dragged between these two ports (either way round)?
 * An already wired input counts as fine: dropping there replaces the old wire.
 */
export function checkPortPair(graph: Graph, a: PortRef, aDir: PortDir, b: PortRef, bDir: PortDir): Compat {
  if (aDir === bDir) return { ok: false, message: CONNECT_FAIL_TEXT['wrong-direction'] };
  const [from, to] = aDir === 'out' ? [a, b] : [b, a];
  const res = canConnect(graph, from, to);
  if (res.ok || res.reason === 'input-taken') return { ok: true };
  if (res.reason === 'type-mismatch') {
    const f = portInfo(graph, from, 'out');
    const t = portInfo(graph, to, 'in');
    if (f && t) return { ok: false, message: typeMismatchText(f.label, f.type, t.label, t.type) };
  }
  return { ok: false, message: CONNECT_FAIL_TEXT[res.reason] };
}
