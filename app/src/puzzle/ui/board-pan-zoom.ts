import type { FitView } from './board-arrange';
import type { Pt } from './wire-geometry';

/** A press that moves less than this (screen px) is a tap, not a drag. */
const TAP_SLOP = 6;

export interface PanZoomHost {
  /** Gestures only act while this is true (the tidy layout is on and the game is not running). */
  enabled(): boolean;
  /** Does a press on this element start a pan? (empty board only: not a card, a wire, a knot or a button) */
  startsOn(target: Element): boolean;
  /** Wheel zoom works over cards too, but not over these (the tray, an open editor). */
  wheelBlocked(target: Element): boolean;
  /** Client position of the board's origin (where view x = 0, y = 0). */
  origin(): Pt;
  view(): FitView;
  /** `done` is false while the gesture is still going (cheap redraw), true at its end. */
  setView(v: FitView, done: boolean): void;
  minK: number;
  maxK: number;
}

export interface PanZoom {
  /** True right after a drag, so the click that follows it can be ignored. */
  wasDrag(): boolean;
  dispose(): void;
}

const clampK = (k: number, host: PanZoomHost): number => Math.min(host.maxK, Math.max(host.minK, k));

/** The view after zooming to `k` while the board point under client position `c` stays under it. */
export function zoomAbout(v: FitView, k: number, c: Pt): FitView {
  const wx = (c.x - v.x) / v.k;
  const wy = (c.y - v.y) / v.k;
  return { k, x: c.x - wx * k, y: c.y - wy * k };
}

/** Drag on empty board to pan; wheel or two fingers to zoom. */
export function attachPanZoom(el: HTMLElement, host: PanZoomHost): PanZoom {
  const ptrs = new Map<number, Pt>();
  let pan: { id: number; sx: number; sy: number; v: FitView; moved: boolean } | null = null;
  let pinch: { d: number; v: FitView } | null = null;
  let dragged = false;

  const local = (p: Pt): Pt => {
    const o = host.origin();
    return { x: p.x - o.x, y: p.y - o.y };
  };

  const onDown = (e: PointerEvent): void => {
    if (!host.enabled() || e.button > 0 || !(e.target instanceof Element)) return;
    if (ptrs.size === 0 && !host.startsOn(e.target)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const [p, q] = [...ptrs.values()] as [Pt, Pt];
      pinch = { d: Math.max(1, Math.hypot(p.x - q.x, p.y - q.y)), v: host.view() };
      pan = null;
    } else if (ptrs.size === 1) {
      pan = { id: e.pointerId, sx: e.clientX, sy: e.clientY, v: host.view(), moved: false };
    }
  };

  const onMove = (e: PointerEvent): void => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {
      const [p, q] = [...ptrs.values()] as [Pt, Pt];
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      const k = clampK(pinch.v.k * (d / pinch.d), host);
      host.setView(zoomAbout(pinch.v, k, local({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })), false);
      dragged = true;
      return;
    }
    if (pan && pan.id === e.pointerId) {
      const dx = e.clientX - pan.sx;
      const dy = e.clientY - pan.sy;
      if (!pan.moved && Math.hypot(dx, dy) > TAP_SLOP) {
        pan.moved = true;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // The pointer may already be gone; the pan then just ends.
        }
      }
      if (pan.moved) {
        host.setView({ k: pan.v.k, x: pan.v.x + dx, y: pan.v.y + dy }, false);
        dragged = true;
      }
    }
  };

  const onUp = (e: PointerEvent): void => {
    if (!ptrs.delete(e.pointerId)) return;
    if (pinch && ptrs.size < 2) {
      pinch = null;
      host.setView(host.view(), true);
    }
    if (pan && pan.id === e.pointerId) {
      if (pan.moved) host.setView(host.view(), true);
      pan = null;
    }
    if (dragged) window.setTimeout(() => (dragged = false), 0);
  };

  const onWheel = (e: WheelEvent): void => {
    if (!host.enabled() || e.defaultPrevented || !(e.target instanceof Element) || host.wheelBlocked(e.target)) return;
    e.preventDefault();
    const v = host.view();
    const k = clampK(v.k * Math.exp(-e.deltaY * 0.0016), host);
    host.setView(zoomAbout(v, k, local({ x: e.clientX, y: e.clientY })), true);
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });
  return {
    wasDrag: () => dragged,
    dispose() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
    },
  };
}
