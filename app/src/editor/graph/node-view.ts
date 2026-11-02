import { getNodeDef } from '../../engine/registry';
import { NODE_CATEGORY_LABELS } from '../../nodes';
import type { GraphNode, NodeCategory, NodeDef, PortDef } from '../../engine/types';
import { h } from '../dom';
import { GRAPH_TEXT, missingBadge } from './graph-text-vi';
import type { PortDir } from './port-compat';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Tiny 16x16 outline glyphs, one per category. Coloured by the tile, nothing else on the node is. */
const CATEGORY_GLYPH: Record<NodeCategory, string> = {
  input: 'M2 8h7M6.5 4.5L10 8l-3.5 3.5M13 3v10',
  logic: 'M3 3h5v5H3zM8 8h5v5H8z',
  math: 'M8 3v10M3 8h10',
  object: 'M8 2l5.5 3v6L8 14l-5.5-3V5z',
  action: 'M9.5 2L4 9h4l-1 5 5.5-7H8.5z',
  brain: 'M8 2.5a4 4 0 00-4 4c0 1.6 1 2.4 1 3.9v1.1h6v-1.1c0-1.5 1-2.3 1-3.9a4 4 0 00-4-4zM6.5 13.5h3',
  output: 'M4 2v12M4 3h8l-2 3 2 3H4',
};

function glyph(category: NodeCategory | undefined): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', CATEGORY_GLYPH[category ?? 'logic']);
  svg.append(path);
  return svg;
}

/** Optional per-instance name typed by the user in the inspector; stored as the `name` param. */
export function instanceName(node: GraphNode): string {
  const v = node.params.name;
  return typeof v === 'string' ? v.trim() : '';
}

export interface NodeViewResult {
  box: HTMLElement;
  /** Dot element of each port, keyed by `${dir}|${portId}`. */
  dots: Map<string, HTMLElement>;
}

function portRow(node: GraphNode, dir: PortDir, port: PortDef, missing: boolean): { row: HTMLElement; dot: HTMLElement } {
  const row = h('div', `wc-port ${dir}${missing ? ' missing' : ''}`);
  row.dataset.node = node.id;
  row.dataset.port = port.id;
  row.dataset.dir = dir;
  row.dataset.type = port.type;
  const dot = h('span', `wc-dot type-${port.type}`);
  row.append(dot, h('span', 'wc-pl', port.label));
  if (missing) row.append(h('span', 'wc-need', GRAPH_TEXT.needWire));
  row.title = port.labelEn ? `${port.label} · ${port.labelEn}` : port.label;
  return { row, dot };
}

/**
 * Small line under the card title (the same line the card always had, so the footprint is unchanged):
 * the name typed for this piece, else its English term, else its category.
 */
export function cardSubtitle(node: GraphNode, def: NodeDef | undefined): string {
  return instanceName(node) || def?.labelEn || (def ? NODE_CATEGORY_LABELS[def.category] : '');
}

/** Builds one node: neutral header with a category tile, then stacked single-column port rows. */
export function buildNodeView(node: GraphNode, missingPorts: ReadonlySet<string>): NodeViewResult {
  const def = getNodeDef(node.kind);
  const box = h('div', 'wc-node');
  box.dataset.id = node.id;
  box.dataset.kind = node.kind;
  if (def) box.classList.add(`cat-${def.category}`);
  box.style.left = `${node.pos.x}px`;
  box.style.top = `${node.pos.y}px`;

  const head = h('div', 'wc-node-head');
  if (def) head.title = def.labelEn ? `${def.label} · ${def.labelEn}. ${def.description}` : def.description;
  const tile = h('span', `wc-tile cat-${def?.category ?? 'unknown'}`);
  tile.append(glyph(def?.category));
  const title = h('span', 'wc-title');
  title.append(h('b', 'wc-name', def?.label ?? GRAPH_TEXT.unknownNode));
  const sub = cardSubtitle(node, def);
  if (sub) title.append(h('small', 'wc-sub', sub));
  head.append(tile, title);
  const missing = def ? def.inputs.filter((p) => missingPorts.has(p.id)).length : 0;
  if (missing > 0) head.append(h('span', 'wc-miss-badge', missingBadge(missing)));
  box.append(head);

  const dots = new Map<string, HTMLElement>();
  if (def && def.inputs.length + def.outputs.length > 0) {
    // Inputs left, outputs right; both columns always exist so outputs never slide left.
    const body = h('div', 'wc-ports-body');
    const sections: [PortDir, PortDef[]][] = [
      ['in', def.inputs],
      ['out', def.outputs],
    ];
    for (const [dir, ports] of sections) {
      const list = h('div', `wc-ports ${dir}s`);
      for (const p of ports) {
        const { row, dot } = portRow(node, dir, p, dir === 'in' && missingPorts.has(p.id));
        dots.set(`${dir}|${p.id}`, dot);
        list.append(row);
      }
      body.append(list);
    }
    box.append(body);
  }
  return { box, dots };
}
