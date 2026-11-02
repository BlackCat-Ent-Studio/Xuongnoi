import type { GameView } from '../../app-contracts';

/**
 * Touch, mouse and wheel gestures for the player camera of the big stage view: drag pans, wheel / ctrl+wheel (a
 * trackpad pinch) / two-finger pinch zooms, a double tap returns to the default framing. It only moves the
 * camera, so the level's rules never see it.
 */

const TAP_MOVE_PX = 7;
const TAP_MAX_MS = 380;
const DOUBLE_TAP_MS = 330;
const DOUBLE_TAP_PX = 34;

/** Zoom factor of one wheel event; `ctrlKey` (trackpad pinch) is steeper because its deltas are small. */
export function wheelZoomFactor(deltaY: number, ctrlKey: boolean): number {
  const d = ctrlKey ? Math.max(-60, Math.min(60, deltaY)) * 0.009 : Math.max(-150, Math.min(150, deltaY)) * 0.0016;
  return Math.exp(-d);
}

export interface StageCameraInput {
  dispose(): void;
}

interface Pt {
  x: number;
  y: number;
}

export function attachStageCameraInput(
  el: HTMLElement,
  view: GameView,
  /** Gestures only count while the stage is the big view. */
  isActive: () => boolean,
  /** Called after every camera change so the chip and buttons can follow. */
  onChange: () => void,
): StageCameraInput {
  const pointers = new Map<number, Pt>();
  let down: { t: number; x: number; y: number; moved: boolean } | null = null;
  let lastTap = { t: 0, x: 0, y: 0 };
  let pinch: { d: number; m: Pt } | null = null;

  const spread = (): number => {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const middle = (): Pt => {
    const [a, b] = [...pointers.values()];
    return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : { x: 0, y: 0 };
  };
  const interactive = (t: EventTarget | null): boolean => !(t instanceof Element) || t.closest('button') === null;

  function onDown(e: PointerEvent): void {
    if (!isActive() || !interactive(e.target)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      down = { t: performance.now(), x: e.clientX, y: e.clientY, moved: false };
    } else {
      if (down) down.moved = true;
      pinch = { d: spread(), m: middle() };
    }
  }

  function onMove(e: PointerEvent): void {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_MOVE_PX) down.moved = true;
    if (!isActive()) return;
    if (pointers.size === 1) {
      if (down?.moved) {
        view.panCamera(dx, dy);
        onChange();
      }
    } else if (pointers.size === 2 && pinch) {
      const d = spread();
      const m = middle();
      view.panCamera(m.x - pinch.m.x, m.y - pinch.m.y);
      if (pinch.d > 0 && d > 0) view.zoomCamera(d / pinch.d, m.x, m.y);
      pinch = { d, m };
      onChange();
    }
  }

  function onUp(e: PointerEvent): void {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    pinch = null;
    if (pointers.size === 0) {
      const tap = down !== null && !down.moved && performance.now() - down.t < TAP_MAX_MS && e.type === 'pointerup';
      down = null;
      if (tap && isActive()) onTap(e.clientX, e.clientY);
    } else if (pointers.size === 1) {
      const [only] = [...pointers.values()];
      if (down && only) {
        down.x = only.x;
        down.y = only.y;
      }
    }
  }

  function onTap(x: number, y: number): void {
    const now = performance.now();
    if (now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(x - lastTap.x, y - lastTap.y) < DOUBLE_TAP_PX) {
      lastTap.t = 0;
      view.resetStageCamera(true);
      onChange();
      return;
    }
    lastTap = { t: now, x, y };
  }

  function onWheel(e: WheelEvent): void {
    if (!isActive() || !interactive(e.target)) return;
    e.preventDefault();
    view.zoomCamera(wheelZoomFactor(e.deltaY, e.ctrlKey), e.clientX, e.clientY);
    onChange();
  }

  // Capture phase: the game view's own canvas handlers capture the pointer, and the gestures must still see every event.
  el.addEventListener('pointerdown', onDown, true);
  el.addEventListener('pointermove', onMove, true);
  el.addEventListener('pointerup', onUp, true);
  el.addEventListener('pointercancel', onUp, true);
  el.addEventListener('wheel', onWheel, { passive: false, capture: true });

  return {
    dispose() {
      el.removeEventListener('pointerdown', onDown, true);
      el.removeEventListener('pointermove', onMove, true);
      el.removeEventListener('pointerup', onUp, true);
      el.removeEventListener('pointercancel', onUp, true);
      el.removeEventListener('wheel', onWheel, true);
    },
  };
}
