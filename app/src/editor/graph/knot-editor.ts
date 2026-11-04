import type { PortType } from '../../engine/types';
import { TIDY_TEXT } from '../../puzzle/ui/wire-tidy-text';
import { legIndexAt, type Pt, type WireRoute } from '../../puzzle/ui/wire-geometry';
import { addKnot, isSharedKnot, mergeKnots, moveKnot, removeKnot, wiresOfKnot, type KnotBook } from '../../puzzle/ui/wire-knots';
import type { EditorState } from '../editor-state';
import { knotsOf } from './board-knots';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Two presses on a wire (or knot) this close in time (ms) and place (screen px) make a double tap. */
export const DOUBLE_MS = 320;
const DOUBLE_PX = 30;
/** A press that moves less than this (screen px) is a tap, not a drag. */
export const TAP_SLOP = 6;
/** Knots snap to this grid (world px). */
const KNOT_GRID = 8;
/** A knot dropped this close (world px) to another knot joins it. */
const MERGE_PX = 18;

interface Deps {
  state: EditorState;
  layer: SVGElement;
  zoom: () => number;
  toWorld: (clientX: number, clientY: number) => Pt;
  /** Key of a wire in the knot book (the same wire has a different key on the main board and inside a group). */
  keyOf: (wireId: string) => string;
  /** The drawn route of a wire (needed to know which stretch a new knot belongs to), or null when it is not drawn. */
  routeOf: (wireId: string) => WireRoute | null;
  /** Pin (`node|port`) the wire with this key leaves; only wires from the same pin may share a knot. */
  sourceOf: (key: string) => string | undefined;
  /** Draw the wires with these keys again with `book()`; null = all of them. Cheap enough to call on every pointer move. */
  redraw: (keys: ReadonlySet<string> | null) => void;
  /** Draw the knot dots again from `book()` (a knot appeared or went). */
  refreshDots: () => void;
  notify: (text: string, kind?: 'info' | 'error') => void;
}

export interface KnotEditor {
  /** The knots to draw right now: the board's, or the gesture in progress. */
  book(): KnotBook;
  /** `types`: wire key to port type, for the wires drawn now; knots of other keys (another board) are skipped. */
  draw(types: ReadonlyMap<string, PortType>): void;
  /** Fades knots whose wires (keys) are not lit (null = nothing faded). */
  fade(lit: ReadonlySet<string> | null): void;
  /** A press on a wire. True when it was the second tap of a double tap and a knot is now being dragged. */
  wireDown(e: PointerEvent, wireId: string): boolean;
  /** A press on a knot. True when a drag started (a quick second press removes the knot instead and returns false). */
  knotDown(e: PointerEvent, knotId: string): boolean;
  move(e: PointerEvent): void;
  up(): void;
  cancel(): void;
}

const snap = (p: Pt): Pt => ({ x: Math.round(p.x / KNOT_GRID) * KNOT_GRID, y: Math.round(p.y / KNOT_GRID) * KNOT_GRID });

/**
 * Wire knots on the wiring canvas: double tap a wire to bend it through a knot, drag a knot to move it, drop it on
 * another knot of a wire from the same pin to join them, double tap a knot to take it off. A whole gesture is one undo step.
 */
export function createKnotEditor({ state, layer, zoom, toWorld, keyOf, routeOf, sourceOf, redraw, refreshDots, notify }: Deps): KnotEditor {
  /** The knots while a gesture runs (the board is only changed when it ends). */
  let live: KnotBook | null = null;
  let drag: { id: string; sx: number; sy: number; moved: boolean; added: boolean } | null = null;
  let lastWireTap: { id: string; t: number; x: number; y: number } | null = null;
  let lastKnotTap: { id: string; t: number } | null = null;
  /** Keys of the wires drawn now: a knot can only join knots that are on screen. */
  let visible: ReadonlySet<string> = new Set();

  const book = (): KnotBook => live ?? knotsOf(state.getGraph());

  function begin(id: string, e: PointerEvent, added: boolean): void {
    drag = { id, sx: e.clientX, sy: e.clientY, moved: false, added };
  }

  function draw(types: ReadonlyMap<string, PortType>): void {
    layer.replaceChildren();
    visible = new Set(types.keys());
    const b = book();
    for (const [id, p] of Object.entries(b.pos)) {
      const type = wiresOfKnot(b, id)
        .map((w) => types.get(w))
        .find((t) => t !== undefined);
      if (!type) continue;
      const shared = isSharedKnot(b, id);
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', `wc-knot type-${type}${shared ? ' shared' : ''}`);
      g.setAttribute('transform', `translate(${p.x} ${p.y})`);
      g.dataset.knot = id;
      const circle = (r: number, cls: string): SVGCircleElement => {
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('r', String(r));
        c.setAttribute('class', cls);
        return c;
      };
      g.append(circle(14, 'wc-knot-hit'), circle(shared ? 8.5 : 6.5, 'wc-knot-ring'), circle(shared ? 3.5 : 2.5, 'wc-knot-core'));
      layer.append(g);
    }
  }

  function commit(next: KnotBook): void {
    live = null;
    state.setKnots(next);
    redraw(null);
  }

  function finish(): void {
    const d = drag;
    drag = null;
    if (!d || !live) {
      live = null;
      return;
    }
    let next = live;
    if (d.moved) {
      const here = next.pos[d.id];
      const near = here && Object.keys(next.pos).find((k) => {
        const q = next.pos[k];
        return k !== d.id && !!q && wiresOfKnot(next, k).some((w) => visible.has(w)) && Math.hypot(q.x - here.x, q.y - here.y) * zoom() <= MERGE_PX;
      });
      if (near) {
        const merged = mergeKnots(next, near, d.id, sourceOf);
        if (merged) {
          next = merged;
          notify(TIDY_TEXT.knotMerged);
        } else notify(TIDY_TEXT.knotSameSource);
      }
    } else if (!d.added) {
      live = null;
      return;
    }
    commit(next);
  }

  return {
    book,
    draw,
    fade(lit) {
      for (const el of layer.children) {
        const id = (el as SVGElement).dataset.knot ?? '';
        el.classList.toggle('faded', lit !== null && !wiresOfKnot(book(), id).some((w) => lit.has(w)));
      }
    },
    wireDown(e, wireId) {
      const now = performance.now();
      const prev = lastWireTap;
      if (!(prev && prev.id === wireId && now - prev.t < DOUBLE_MS && Math.hypot(prev.x - e.clientX, prev.y - e.clientY) < DOUBLE_PX)) {
        lastWireTap = { id: wireId, t: now, x: e.clientX, y: e.clientY };
        return false;
      }
      lastWireTap = null;
      const route = routeOf(wireId);
      if (!route) return false;
      const at = toWorld(e.clientX, e.clientY);
      const key = keyOf(wireId);
      const res = addKnot(book(), key, snap(at), legIndexAt(route, at));
      live = res.book;
      begin(res.id, e, true);
      redraw(new Set([key]));
      refreshDots();
      return true;
    },
    knotDown(e, knotId) {
      const now = performance.now();
      if (lastKnotTap && lastKnotTap.id === knotId && now - lastKnotTap.t < DOUBLE_MS) {
        lastKnotTap = null;
        commit(removeKnot(book(), knotId));
        return false;
      }
      lastKnotTap = { id: knotId, t: now };
      live = book();
      begin(knotId, e, false);
      return true;
    },
    move(e) {
      if (!drag || !live) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) <= TAP_SLOP) return;
      drag.moved = true;
      live = moveKnot(live, drag.id, snap(toWorld(e.clientX, e.clientY)));
      redraw(new Set(wiresOfKnot(live, drag.id)));
      const at = live.pos[drag.id];
      const el = at && [...layer.children].find((c) => (c as SVGElement).dataset.knot === drag?.id);
      if (at && el) el.setAttribute('transform', `translate(${at.x} ${at.y})`);
    },
    up: finish,
    cancel() {
      const had = live !== null;
      drag = null;
      live = null;
      if (had) redraw(null);
    },
  };
}
