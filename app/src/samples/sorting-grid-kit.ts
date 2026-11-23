import { STUDENT_CARD_METRICS } from '../editor/graph/shipped-layout';
import { estimateNodeSize } from '../editor/graph/graph-geometry';
import { getNodeDef } from '../engine/registry';
import { CIRCUIT_KIND, type CircuitExposed, type CircuitPin, type GraphNode, type ParamValue, type Params, type PortType, type Wire } from '../engine/types';

/**
 * Small builders shared by the circuits of the grid-floor sorting sample: a card as the palette makes it, wires written as
 * `card.port`, pins, opened settings, and a column layout that leaves no two cards on each other at the biggest card size.
 */

export type CardSpec = [id: string, kind: string, col: number, params?: Record<string, ParamValue>];
/** A wire as `from card.port`, `to card.port`. */
export type Link = readonly [from: string, to: string];

export const MARGIN = 30;
export const COL_W = 330;
export const GAP_Y = 24;

/** A card as the palette would make it (every setting at its default), with the given settings on top. */
export function card(id: string, kind: string, given: Record<string, ParamValue> = {}): GraphNode {
  const def = getNodeDef(kind);
  if (!def) throw new Error(`sorting grid sample: unknown piece ${kind}`);
  const params: Params = {};
  for (const p of def.params) params[p.id] = typeof p.default === 'object' ? { ...p.default } : p.default;
  for (const [key, value] of Object.entries(given)) params[key] = typeof value === 'object' ? { ...value } : value;
  return { id, kind, params, pos: { x: 0, y: 0 } };
}

/** Height of a card at the biggest card size; a copy of a circuit shows its in pins and its out pins side by side. */
export function heightOf(node: GraphNode, pinRows: number): number {
  return node.kind === CIRCUIT_KIND ? 60 + 34 * Math.max(1, pinRows) : estimateNodeSize(node, STUDENT_CARD_METRICS).h;
}

/** Stacks the cards of each column downwards in the order given, so no two overlap. Returns the lowest edge. */
export function layOut(nodes: GraphNode[], cols: readonly number[], pinRows: (node: GraphNode) => number = () => 4, top = MARGIN, colX: (col: number) => number = (col) => col * COL_W): number {
  const bottoms = new Map<number, number>();
  nodes.forEach((n, i) => {
    const col = cols[i] ?? 0;
    const y = bottoms.get(col) ?? top;
    n.pos = { x: MARGIN + colX(col), y };
    bottoms.set(col, y + heightOf(n, pinRows(n)) + GAP_Y);
  });
  return Math.max(top, ...bottoms.values());
}

export function cards(specs: readonly CardSpec[]): GraphNode[] {
  const nodes = specs.map(([id, kind, , params]) => card(id, kind, params));
  layOut(nodes, specs.map((s) => s[2]));
  return nodes;
}

const ref = (text: string): { node: string; port: string } => {
  const [node, port] = text.split('.') as [string, string];
  return { node, port };
};

export const wires = (links: readonly Link[]): Wire[] => links.map(([from, to], i) => ({ id: `w${i + 1}`, from: ref(from), to: ref(to) }));

export const pin = (id: string, label: string, dir: 'in' | 'out', type: PortType, inner: string): CircuitPin => ({ id, label, dir, type, inner: ref(inner) });

export const open = (id: string, label: string, inner: string): CircuitExposed => {
  const [node, param] = inner.split('.') as [string, string];
  return { id, label, inner: { node, param } };
};

/** Settings of one "Bảng giá trị": row k holds `values[k - 1]`. */
export const table = (values: readonly number[], outside: 'hold' | 'zero' = 'hold'): Record<string, ParamValue> => ({ rows: values.length, outside, ...Object.fromEntries(values.map((v, k) => [`v${k + 1}`, v])) });
