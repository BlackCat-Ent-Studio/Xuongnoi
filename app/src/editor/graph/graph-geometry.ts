import { getNodeDef } from '../../engine/registry';
import type { GraphNode } from '../../engine/types';

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

/** Rough on-canvas size of a node before it has been measured in the DOM. */
export function estimateNodeSize(node: GraphNode): Size {
  const def = getNodeDef(node.kind);
  if (!def) return { w: 168, h: 70 };
  const longest = Math.max(def.label.length, ...def.inputs.map((p) => p.label.length), ...def.outputs.map((p) => p.label.length));
  const rows = def.inputs.length + def.outputs.length;
  return { w: Math.max(168, 60 + longest * 7.4), h: 40 + rows * 26 + 8 };
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

/** View that shows `content` inside a viewport of the given size, never below the fit floor. */
export function fitView(content: Box | null, viewport: Size): View {
  if (!content) return { panX: 40, panY: 40, zoom: 1 };
  const raw = Math.min((viewport.w - 80) / content.w, (viewport.h - 80) / content.h);
  const zoom = Math.min(1, Math.max(FIT_FLOOR, raw));
  return { zoom, panX: 40 - content.x * zoom, panY: 40 - content.y * zoom };
}
