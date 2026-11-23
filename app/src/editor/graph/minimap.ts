import { h } from '../dom';
import { unionBox, type Box, type Point } from './graph-geometry';
import { GRAPH_TEXT } from './graph-text-vi';

const W = 176;
const H = 96;
const PAD = 12;

export interface Minimap {
  el: HTMLElement;
  redraw(): void;
}

interface Deps {
  /** Boxes of every node and note, in world coordinates. */
  items: () => Box[];
  /** Visible part of the world. */
  viewport: () => Box;
  /** Move the view so this world point is centred. */
  centerOn: (p: Point) => void;
}

const cssVar = (el: Element, name: string, fallback: string): string => getComputedStyle(el).getPropertyValue(name).trim() || fallback;

/** Clickable, draggable overview of the whole graph. */
export function createMinimap({ items, viewport, centerOn }: Deps): Minimap {
  const el = h('div', 'wc-minimap wc-ui');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', GRAPH_TEXT.minimap);
  const canvas = h('canvas');
  const ratio = window.devicePixelRatio || 1;
  canvas.width = W * ratio;
  canvas.height = H * ratio;
  el.append(canvas);
  let map = { s: 1, ox: 0, oy: 0, bx: 0, by: 0 };

  function redraw(): void {
    if (el.hidden) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const its = items();
    const vp = viewport();
    const all = unionBox([...its, vp]) ?? vp;
    const s = Math.min((W - PAD) / all.w, (H - PAD) / all.h);
    map = { s, ox: (W - all.w * s) / 2, oy: (H - all.h * s) / 2, bx: all.x, by: all.y };
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = cssVar(el, '--text3', '#8f98a4');
    for (const b of its) ctx.fillRect(map.ox + (b.x - map.bx) * s, map.oy + (b.y - map.by) * s, Math.max(2, b.w * s), Math.max(2, b.h * s));
    ctx.strokeStyle = cssVar(el, '--accent', '#3ecf8e');
    ctx.lineWidth = 1.5;
    ctx.strokeRect(map.ox + (vp.x - map.bx) * s, map.oy + (vp.y - map.by) * s, vp.w * s, vp.h * s);
  }

  function go(e: PointerEvent): void {
    const r = canvas.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W;
    const my = ((e.clientY - r.top) / r.height) * H;
    centerOn({ x: (mx - map.ox) / map.s + map.bx, y: (my - map.oy) / map.s + map.by });
  }

  let dragging = false;
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    el.setPointerCapture(e.pointerId);
    go(e);
  });
  el.addEventListener('pointermove', (e) => {
    if (dragging) go(e);
  });
  const stop = (e: PointerEvent): void => {
    dragging = false;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  return { el, redraw };
}
