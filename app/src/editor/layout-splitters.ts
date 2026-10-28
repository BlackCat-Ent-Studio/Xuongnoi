import { h } from './dom';
import {
  DEFAULT_SIZES,
  clampGameH,
  clampRightW,
  clampSizes,
  loadSizes,
  saveSizes,
  type LayoutBounds,
  type LayoutSizes,
} from './layout-model';
import { TEXT_VI } from './text-vi';

export interface LayoutSplitters {
  /** Vertical bar between wiring canvas and right column. */
  vertical: HTMLElement;
  /** Horizontal bar between game view and properties. */
  horizontal: HTMLElement;
}

const KEY_STEP = 16;
const KEY_STEP_BIG = 64;

/**
 * Wires two draggable splitters. Sizes are applied as CSS variables on `main`
 * (--right-w, --game-h); the user's preferred sizes are kept as saved and only
 * clamped for display, so enlarging the window restores them.
 */
export function installLayoutSplitters(opts: {
  main: HTMLElement;
  right: HTMLElement;
  /** Called after every applied size change. */
  onChange: () => void;
}): LayoutSplitters {
  const { main, right, onChange } = opts;
  let pref: LayoutSizes = loadSizes();

  const vertical = makeBar('vertical');
  const horizontal = makeBar('horizontal');

  function bounds(): LayoutBounds {
    return { mainW: main.clientWidth, rightH: right.clientHeight };
  }

  function apply(): void {
    const s = clampSizes(pref, bounds());
    main.style.setProperty('--right-w', `${s.rightW}px`);
    main.style.setProperty('--game-h', `${s.gameH}px`);
    vertical.setAttribute('aria-valuenow', String(s.rightW));
    horizontal.setAttribute('aria-valuenow', String(s.gameH));
    onChange();
  }

  function current(): LayoutSizes {
    return clampSizes(pref, bounds());
  }

  function setRightW(v: number): void {
    pref = { ...pref, rightW: clampRightW(v, bounds()) };
    apply();
  }
  function setGameH(v: number): void {
    pref = { ...pref, gameH: clampGameH(v, bounds()) };
    apply();
  }

  function bindDrag(bar: HTMLElement, axis: 'x' | 'y'): void {
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const start = axis === 'x' ? e.clientX : e.clientY;
      const base = axis === 'x' ? current().rightW : current().gameH;
      bar.setPointerCapture(e.pointerId);
      bar.classList.add('dragging');
      document.body.classList.add(axis === 'x' ? 'resizing-x' : 'resizing-y');

      const move = (ev: PointerEvent): void => {
        if (ev.pointerId !== e.pointerId) return;
        if (axis === 'x') setRightW(base - (ev.clientX - start));
        else setGameH(base + (ev.clientY - start));
      };
      const end = (ev: PointerEvent): void => {
        if (ev.pointerId !== e.pointerId) return;
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', end);
        bar.removeEventListener('pointercancel', end);
        bar.classList.remove('dragging');
        document.body.classList.remove('resizing-x', 'resizing-y');
        if (bar.hasPointerCapture(ev.pointerId)) bar.releasePointerCapture(ev.pointerId);
        saveSizes(pref);
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', end);
      bar.addEventListener('pointercancel', end);
    });

    bar.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (axis === 'x') pref = { ...pref, rightW: DEFAULT_SIZES.rightW };
      else pref = { ...pref, gameH: DEFAULT_SIZES.gameH };
      saveSizes(pref);
      apply();
    });

    bar.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? KEY_STEP_BIG : KEY_STEP;
      let delta = 0;
      if (axis === 'x') {
        if (e.key === 'ArrowLeft') delta = step;
        else if (e.key === 'ArrowRight') delta = -step;
      } else if (e.key === 'ArrowDown') delta = step;
      else if (e.key === 'ArrowUp') delta = -step;
      if (delta === 0) return;
      e.preventDefault();
      if (axis === 'x') setRightW(current().rightW + delta);
      else setGameH(current().gameH + delta);
      saveSizes(pref);
    });
  }

  bindDrag(vertical, 'x');
  bindDrag(horizontal, 'y');
  window.addEventListener('resize', apply);
  apply();

  return { vertical, horizontal };
}

function makeBar(orientation: 'vertical' | 'horizontal'): HTMLElement {
  const bar = h('div', `splitter splitter-${orientation}`);
  bar.tabIndex = 0;
  bar.setAttribute('role', 'separator');
  // A vertical bar separates side-by-side panes; its aria orientation is "vertical".
  bar.setAttribute('aria-orientation', orientation);
  bar.title = TEXT_VI.splitterTip;
  bar.setAttribute('aria-label', TEXT_VI.splitterTip);
  return bar;
}
