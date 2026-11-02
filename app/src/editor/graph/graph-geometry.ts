import { getNodeDef } from '../../engine/registry';
import type { Graph, GraphNode } from '../../engine/types';

export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 2;
/** Fit never zooms out below this, so labels stay readable. */
export const FIT_FLOOR = 0.6;
/** Below this zoom the graph switches to titles only. */
export const LOW_ZOOM = 0.6;
/** A dragged wire snaps to a compatible port this close (screen px). */
export const SNAP_PX = 24;

export interface Point {
  x: number;
  y: number;
}
export interface Size {
  w: number;
  h: number;
}
export interface Box extends Point, Size {}
export interface View {
  panX: number;
  panY: number;
  zoom: number;
}

export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function wirePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(40, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/** New view after changing zoom so the point (mx, my) in canvas px stays under the cursor. */
export function zoomAround(view: View, nextZoom: number, mx: number, my: number): View {
  const zoom = clampZoom(nextZoom);
  const wx = (mx - view.panX) / view.zoom;
  const wy = (my - view.panY) / view.zoom;
  return { zoom, panX: mx - wx * zoom, panY: my - wy * zoom };
}

/** The candidate closest to `p` within `radius`, or null. */
export function nearestWithin<T extends Point>(candidates: readonly T[], p: Point, radius: number): T | null {
  let best: T | null = null;
  let bestD = radius;
  for (const c of candidates) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d <= bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

export const boxesOverlap = (a: Box, b: Box, margin = 0): boolean =>
  a.x < b.x + b.w + margin && a.x + a.w + margin > b.x && a.y < b.y + b.h + margin && a.y + a.h + margin > b.y;

/**
 * Longest label (characters) of these kinds before the nodes were renamed. The estimate below must give the same width
 * as before, or a board laid out earlier would be spread differently when it loads.
 */
const LEGACY_LONGEST_LABEL: Readonly<Record<string, number>> = {
  'ahead-sensor': 19,
  block: 21,
  camera: 27,
  carry: 12,
  chase: 20,
  item: 18,
  'moving-platform': 15,
  patrol: 11,
  spawner: 19,
  'speed-sensor': 16,
  'ui-button': 17,
  'ui-start': 16,
  'vision-sensor': 17,
};

/** Rough on-canvas size of a node before it has been measured in the DOM. */
export function estimateNodeSize(node: GraphNode): Size {
  const def = getNodeDef(node.kind);
  if (!def) return { w: 168, h: 70 };
  // Card metrics (node-cards.css): ~40px header band, then one 26px row per input and per output.
  const longest = LEGACY_LONGEST_LABEL[def.kind] ?? Math.max(def.label.length, ...def.inputs.map((p) => p.label.length), ...def.outputs.map((p) => p.label.length));
  const rows = def.inputs.length + def.outputs.length;
  return { w: Math.max(168, 60 + longest * 7.4), h: 40 + rows * 26 + 8 };
}

/** Gap left between a node pushed down and the node it overlapped. */
const SPREAD_GAP = 16;

/**
 * Pushes overlapping nodes down until no two node cards overlap, keeping each node's column.
 * Nodes are spread within their own scope: the main board, or the inside of one group.
 * Returns the same graph object when nothing overlapped.
 */
export function spreadOverlaps(graph: Graph): Graph {
  const groupOf = new Map<string, string>();
  for (const g of graph.groups ?? []) for (const id of g.nodeIds) groupOf.set(id, g.id);
  const moved = new Map<string, Point>();
  const scopes = new Map<string, GraphNode[]>();
  for (const n of graph.nodes) {
    const key = groupOf.get(n.id) ?? '';
    const list = scopes.get(key);
    if (list) list.push(n);
    else scopes.set(key, [n]);
  }
  for (const nodes of scopes.values()) {
    const placed: Box[] = [];
    for (const n of [...nodes].sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x)) {
      const box: Box = { x: n.pos.x, y: n.pos.y, ...estimateNodeSize(n) };
      for (let hit = placed.find((p) => boxesOverlap(box, p)); hit; hit = placed.find((p) => boxesOverlap(box, p))) {
        box.y = hit.y + hit.h + SPREAD_GAP;
      }
      if (box.y !== n.pos.y) moved.set(n.id, { x: n.pos.x, y: box.y });
      placed.push(box);
    }
  }
  if (moved.size === 0) return graph;
  return { ...graph, nodes: graph.nodes.map((n) => (moved.has(n.id) ? { ...n, pos: moved.get(n.id)! } : n)) };
}

/** Bounding box that holds every box, or null when there are none. */
export function unionBox(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
    h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
  };
}

/** Screen-space size of an overlay pinned to a bottom corner of the canvas. */
export interface CornerInset {
  w: number;
  h: number;
}
/** Overlays that sit on top of the canvas and must not hide content. */
export interface CornerInsets {
  bl: CornerInset;
  br: CornerInset;
}
export const NO_INSETS: CornerInsets = { bl: { w: 0, h: 0 }, br: { w: 0, h: 0 } };

const FIT_PAD = 40;
/** Breathing room kept between content and an overlay. */
export const CORNER_GAP = 16;

/**
 * View that shows `content` inside a viewport of the given size, never below the fit floor.
 * Corner overlays are avoided: each one is dodged by giving up either a side column or a bottom strip,
 * and the combination that leaves the biggest zoom wins.
 */
export function fitView(content: Box | null, viewport: Size, insets: CornerInsets = NO_INSETS): View {
  if (!content) return { panX: FIT_PAD, panY: FIT_PAD, zoom: 1 };
  const has = (c: CornerInset): boolean => c.w > 0 && c.h > 0;
  let best: View | null = null;
  let bestRaw = -Infinity;
  for (const blSide of [true, false]) {
    for (const brSide of [true, false]) {
      const left = FIT_PAD + (blSide && has(insets.bl) ? insets.bl.w + CORNER_GAP : 0);
      const right = FIT_PAD + (brSide && has(insets.br) ? insets.br.w + CORNER_GAP : 0);
      const bottom =
        FIT_PAD +
        Math.max(!blSide && has(insets.bl) ? insets.bl.h + CORNER_GAP : 0, !brSide && has(insets.br) ? insets.br.h + CORNER_GAP : 0);
      const raw = Math.min((viewport.w - left - right) / content.w, (viewport.h - FIT_PAD - bottom) / content.h);
      if (raw > bestRaw + 1e-9) {
        bestRaw = raw;
        const zoom = Math.min(1, Math.max(FIT_FLOOR, raw));
        best = { zoom, panX: left - content.x * zoom, panY: FIT_PAD - content.y * zoom };
      }
    }
  }
  return best as View;
}

/** A screen rectangle (canvas px) as a world-space box, grown by `margin` screen px. */
export function screenRectToWorld(view: View, r: Box, margin = 0): Box {
  return {
    x: (r.x - margin - view.panX) / view.zoom,
    y: (r.y - margin - view.panY) / view.zoom,
    w: (r.w + margin * 2) / view.zoom,
    h: (r.h + margin * 2) / view.zoom,
  };
}
