import { frameLit } from '../../puzzle/ui/step-light';
import type { Box, View } from '../graph/graph-geometry';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FRAME_MARGIN = 40;
const FRAME_MIN_ZOOM = 0.4;

/** What stays bright at a paused step. Everything else on the board fades. */
export interface StepLightSet {
  cards: ReadonlySet<string>;
  wires: ReadonlySet<string>;
  /** Fired output pins as `${node}|${port}`. */
  pins: ReadonlySet<string>;
}

interface Deps {
  root: HTMLElement;
  wireLayer: SVGElement;
  nodeEls: ReadonlyMap<string, HTMLElement>;
  portEls: ReadonlyMap<string, HTMLElement>;
  wirePaths: ReadonlyMap<string, SVGPathElement>;
  getView(): View;
  setView(view: View): void;
}

/**
 * Draws the "what ran" light on the wiring board: fired pins pulse, lit cards and wires stay clear, the rest fades.
 * Lit wires are copied into an overlay on top of the (faded) wire layer so the wire-current effects never need to know.
 */
export function createStepLightLayer(deps: Deps): { set(light: StepLightSet | null): void } {
  const { root, nodeEls, portEls, wirePaths } = deps;
  const overlay = document.createElementNS(SVG_NS, 'svg');
  overlay.setAttribute('class', 'wc-wires wc-step-wires');
  let lastPins: HTMLElement[] = [];
  let lastCards: HTMLElement[] = [];

  function clear(): void {
    root.classList.remove('step-on');
    overlay.replaceChildren();
    overlay.remove();
    for (const el of lastPins) el.classList.remove('step-pin');
    for (const el of lastCards) el.classList.remove('step-lit');
    lastPins = [];
    lastCards = [];
  }

  function boxOf(cards: HTMLElement[], rect: DOMRect): Box | null {
    let box: Box | null = null;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const x = r.left - rect.left;
      const y = r.top - rect.top;
      box = box
        ? { x: Math.min(box.x, x), y: Math.min(box.y, y), w: Math.max(box.x + box.w, x + r.width) - Math.min(box.x, x), h: Math.max(box.y + box.h, y + r.height) - Math.min(box.y, y) }
        : { x, y, w: r.width, h: r.height };
    }
    return box;
  }

  /** The view that shows `box` (screen px): panned the least, or zoomed out; null when even the lowest zoom cannot hold it. */
  function viewFor(box: Box, rect: DOMRect): View | null {
    const view = deps.getView();
    const area = { w: rect.width, h: rect.height };
    const next = frameLit({ k: view.zoom, x: view.panX, y: view.panY }, box, area, FRAME_MARGIN, FRAME_MIN_ZOOM);
    const s = next.k / view.zoom;
    const fits = box.w * s <= area.w - 2 * FRAME_MARGIN + 1 && box.h * s <= area.h - 2 * FRAME_MARGIN + 1;
    return fits ? { zoom: next.k, panX: next.x, panY: next.y } : null;
  }

  /**
   * Brings the lit cards on screen. When they are spread wider than the board can show, the cards that fired come first
   * (zoomed out about their corner, never below the lowest zoom); the rest stays wherever it falls.
   */
  function frame(lit: HTMLElement[], fired: HTMLElement[]): void {
    const rect = root.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    for (const group of [lit, fired]) {
      const box = group.length > 0 ? boxOf(group, rect) : null;
      if (!box) continue;
      const next = viewFor(box, rect);
      if (!next) continue;
      const view = deps.getView();
      if (next.zoom !== view.zoom || next.panX !== view.panX || next.panY !== view.panY) deps.setView(next);
      return;
    }
  }

  return {
    set(light) {
      clear();
      if (!light) return;
      root.classList.add('step-on');
      for (const id of light.wires) {
        const src = wirePaths.get(id);
        if (!src) continue;
        const copy = document.createElementNS(SVG_NS, 'path');
        const type = /type-\w+/.exec(src.getAttribute('class') ?? '')?.[0] ?? '';
        copy.setAttribute('class', `wc-wire step-wire ${type}`.trim());
        copy.setAttribute('d', src.getAttribute('d') ?? '');
        overlay.append(copy);
      }
      deps.wireLayer.after(overlay);
      for (const key of light.pins) {
        const dot = portEls.get(`${key}|out`);
        if (!dot) continue;
        dot.classList.add('step-pin');
        lastPins.push(dot);
      }
      for (const id of light.cards) {
        const el = nodeEls.get(id);
        if (!el) continue;
        el.classList.add('step-lit');
        lastCards.push(el);
      }
      const firedCards = new Set([...light.pins].map((k) => k.slice(0, k.indexOf('|'))));
      frame(lastCards, lastCards.filter((el) => firedCards.has(el.dataset.id ?? '')));
    },
  };
}
