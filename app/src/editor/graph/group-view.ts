import type { GraphNode, NodeGroup } from '../../engine/types';
import { h } from '../dom';
import type { GroupPort } from '../groups/group-model';
import { inkOn } from '../theme/contrast';
import { estimateNodeSize, type Box, type Size } from './graph-geometry';
import { GRAPH_TEXT, missingBadge } from './graph-text-vi';
import type { PortDir } from './port-compat';

export const GROUP_TEXT = {
  members: (n: number): string => `${n} mảnh ghép bên trong`,
  openHint: 'Bấm đúp để mở ra',
  noPorts: 'Chưa nối ra ngoài',
} as const;

export interface GroupDot {
  node: string;
  port: string;
  dir: PortDir;
  dot: HTMLElement;
}

export interface GroupViewResult {
  box: HTMLElement;
  /** One dot per boundary port, keyed by the inner port it stands for. */
  dots: GroupDot[];
}

const FOLDER_GLYPH = 'M2 4.5h4l1.5 1.5H14v6.5H2z';

function portRow(port: GroupPort, missing: boolean): { row: HTMLElement; dot: HTMLElement } {
  const row = h('div', `wc-port ${port.dir}${missing ? ' missing' : ''}`);
  // The row speaks for the inner port, so wiring to it wires to the inner node.
  row.dataset.node = port.node;
  row.dataset.port = port.port;
  row.dataset.dir = port.dir;
  row.dataset.type = port.type;
  row.dataset.group = '1';
  const dot = h('span', `wc-dot type-${port.type}`);
  row.append(dot, h('span', 'wc-pl', port.label));
  row.title = port.label;
  return { row, dot };
}

/** One collapsed group: a named block with the boundary ports derived from wires that cross it. */
export function buildGroupView(group: NodeGroup, ports: readonly GroupPort[], missingInside: number): GroupViewResult {
  const box = h('div', 'wc-node wc-group');
  box.dataset.id = group.id;
  box.dataset.kind = 'group';
  box.style.left = `${group.x}px`;
  box.style.top = `${group.y}px`;
  if (group.color) {
    box.style.setProperty('--gc', group.color);
    box.style.setProperty('--ci', inkOn(group.color)); // header text that reads on the group's own colour
  }

  const head = h('div', 'wc-node-head');
  const tile = h('span', 'wc-tile wc-group-tile');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', FOLDER_GLYPH);
  svg.append(path);
  tile.append(svg);
  const title = h('span', 'wc-title');
  title.append(h('b', 'wc-name', group.name), h('small', 'wc-sub', GROUP_TEXT.members(group.nodeIds.length)));
  head.append(tile, title);
  if (missingInside > 0) head.append(h('span', 'wc-miss-badge', missingBadge(missingInside)));
  box.append(head);

  const dots: GroupDot[] = [];
  if (ports.length > 0) {
    const body = h('div', 'wc-ports-body');
    for (const dir of ['in', 'out'] as const) {
      const list = h('div', `wc-ports ${dir}s`);
      for (const p of ports.filter((x) => x.dir === dir)) {
        const { row, dot } = portRow(p, false);
        dots.push({ node: p.node, port: p.port, dir, dot });
        list.append(row);
      }
      body.append(list);
    }
    box.append(body);
  }
  if (ports.length === 0) box.append(h('div', 'wc-group-hint', GROUP_TEXT.noPorts));
  box.append(h('div', 'wc-group-hint', GROUP_TEXT.openHint));
  return { box, dots };
}

// ---------- stubs shown inside an entered group ----------

const STUB_H = 30;
const STUB_GAP = 8;
const STUB_W = 210;
const STUB_MARGIN = 70;

export interface StubSpot {
  port: GroupPort;
  x: number;
  y: number;
}

/** Where each boundary stub sits: inputs left of the members, outputs right, level with the inner port they feed. */
export function layoutStubs(ports: readonly GroupPort[], members: readonly GraphNode[], sizeOf?: (id: string) => Size | undefined): StubSpot[] {
  if (ports.length === 0 || members.length === 0) return [];
  const boxes = members.map((n) => ({ x: n.pos.x, y: n.pos.y, ...(sizeOf?.(n.id) ?? estimateNodeSize(n)) }));
  const minX = Math.min(...boxes.map((b) => b.x));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const spots: StubSpot[] = [];
  for (const dir of ['in', 'out'] as const) {
    const mine = ports
      .filter((p) => p.dir === dir)
      .map((port) => ({ port, y: (members.find((n) => n.id === port.node)?.pos.y ?? 0) + 14 }))
      .sort((a, b) => a.y - b.y);
    let floor = Number.NEGATIVE_INFINITY;
    for (const m of mine) {
      const y = Math.max(m.y, floor);
      floor = y + STUB_H + STUB_GAP;
      spots.push({ port: m.port, x: dir === 'in' ? minX - STUB_W - STUB_MARGIN : maxX + STUB_MARGIN, y: Math.round(y) });
    }
  }
  return spots;
}

export const stubBox = (s: StubSpot): Box => ({ x: s.x, y: s.y, w: STUB_W, h: STUB_H });

/** A port stub at the edge of an entered group. Its dot stands in for the outside end of every wire crossing there. */
export function buildStub(spot: StubSpot): { el: HTMLElement; dot: HTMLElement } {
  const { port } = spot;
  const el = h('div', `wc-stub ${port.dir}`);
  el.style.left = `${spot.x}px`;
  el.style.top = `${spot.y}px`;
  el.style.width = `${STUB_W}px`;
  el.title = GRAPH_TEXT.typeName[port.type];
  const dot = h('span', `wc-dot type-${port.type}`);
  const label = h('span', 'wc-pl', port.label);
  // Inputs flow in from the left edge into the group, so their dot is on the right; outputs mirror it.
  if (port.dir === 'in') el.append(label, dot);
  else el.append(dot, label);
  return { el, dot };
}
