import { h } from './dom';
import {
  BOTTOM_OPEN_H,
  COLLAPSED_LEFT_W,
  DEFAULT_SIZES,
  MAX_BOTTOM_H,
  MAX_LEFT_W,
  MAX_RIGHT_W,
  MIN_BOTTOM_H,
  MIN_LEFT_W,
  MIN_RIGHT_W,
  clampSizes,
  isNarrowWindow,
  loadPrefs,
  savePrefs,
  sizesForPreset,
  type LayoutBounds,
  type LayoutPrefs,
  type LayoutPreset,
  type LayoutSizes,
} from './layout-model';
import { SHELL_TEXT } from './shell-text-vi';

export interface LayoutController {
  /** Splitter between the left dock and the centre. */
  left: HTMLElement;
  /** Splitter between the centre and the right dock. */
  right: HTMLElement;
  /** Splitter between the centre and the bottom dock. */
  bottom: HTMLElement;
  preset(): LayoutPreset;
  setPreset(preset: LayoutPreset): void;
  leftCollapsed(): boolean;
  setLeftCollapsed(collapsed: boolean): void;
  /** Unfolds the bottom dock when it is down to just its tab bar. */
  ensureBottomOpen(): void;
  /** Called after the preset or the collapsed state changed (for syncing menus and selects). */
  onPrefsChange(cb: () => void): void;
}

const KEY_STEP = 16;
const KEY_STEP_BIG = 64;

type SizeKey = keyof LayoutSizes;

interface BarSpec {
  key: SizeKey;
  axis: 'x' | 'y';
  /** +1 when growing the dock means moving right/down, -1 for left/up. */
  sign: 1 | -1;
  label: string;
  min: number;
  max: number;
}

/**
 * Wires the three dock splitters. Sizes are applied as CSS variables on `work`
 * (--lw, --rw, --bh); preferred sizes are kept as saved and only clamped for
 * display, so enlarging the window restores them.
 */
export function installLayoutSplitters(opts: {
  work: HTMLElement;
  /** Called after every applied size or layout change. */
  onChange: () => void;
}): LayoutController {
  const { work, onChange } = opts;
  const prefs: LayoutPrefs = loadPrefs();
  // null means "never chosen": start collapsed on narrow windows, without persisting that guess.
  let collapsed = prefs.leftCollapsed ?? isNarrowWindow(window.innerWidth);
  const prefsListeners: Array<() => void> = [];

  const specs: Record<'left' | 'right' | 'bottom', BarSpec> = {
    left: { key: 'leftW', axis: 'x', sign: 1, label: SHELL_TEXT.splitterLeft, min: MIN_LEFT_W, max: MAX_LEFT_W },
    right: { key: 'rightW', axis: 'x', sign: -1, label: SHELL_TEXT.splitterRight, min: MIN_RIGHT_W, max: MAX_RIGHT_W },
    bottom: { key: 'bottomH', axis: 'y', sign: -1, label: SHELL_TEXT.splitterBottom, min: MIN_BOTTOM_H, max: MAX_BOTTOM_H },
  };
  const bars = {
    left: makeBar(specs.left),
    right: makeBar(specs.right),
    bottom: makeBar(specs.bottom),
  };

  function bounds(): LayoutBounds {
    return { mainW: work.clientWidth, mainH: work.clientHeight };
  }
  function current(): LayoutSizes {
    return clampSizes(prefs.sizes, bounds(), collapsed);
  }
  function persist(): void {
    savePrefs({ ...prefs, leftCollapsed: userChoseCollapse ? collapsed : prefs.leftCollapsed });
  }
  let userChoseCollapse = prefs.leftCollapsed !== null;

  function apply(): void {
    const s = current();
    work.style.setProperty('--lw', `${collapsed ? COLLAPSED_LEFT_W : s.leftW}px`);
    work.style.setProperty('--rw', `${s.rightW}px`);
    work.style.setProperty('--bh', `${s.bottomH}px`);
    work.classList.toggle('left-collapsed', collapsed);
    work.classList.toggle('split', prefs.preset === 'split');
    for (const name of ['left', 'right', 'bottom'] as const) {
      bars[name].setAttribute('aria-valuenow', String(s[specs[name].key]));
    }
    bars.left.classList.toggle('collapsed', collapsed);
    onChange();
  }

  function setSize(key: SizeKey, v: number): void {
    prefs.sizes = { ...prefs.sizes, [key]: v };
    // Re-clamp so the saved preference never drifts beyond what can be shown.
    prefs.sizes = { ...prefs.sizes, [key]: clampSizes(prefs.sizes, bounds(), collapsed)[key] };
    apply();
  }

  function notifyPrefs(): void {
    for (const cb of prefsListeners) cb();
  }

  function setLeftCollapsed(next: boolean): void {
    if (collapsed === next && userChoseCollapse) return;
    collapsed = next;
    userChoseCollapse = true;
    apply();
    persist();
    notifyPrefs();
  }

  function bindBar(name: 'left' | 'right' | 'bottom'): void {
    const bar = bars[name];
    const spec = specs[name];
    const axis = spec.axis;

    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (name === 'left' && collapsed) setLeftCollapsed(false);
      const start = axis === 'x' ? e.clientX : e.clientY;
      const base = current()[spec.key];
      bar.setPointerCapture(e.pointerId);
      bar.classList.add('dragging');
      document.body.classList.add(axis === 'x' ? 'resizing-x' : 'resizing-y');

      const move = (ev: PointerEvent): void => {
        if (ev.pointerId !== e.pointerId) return;
        const d = axis === 'x' ? ev.clientX - start : ev.clientY - start;
        setSize(spec.key, base + spec.sign * d);
      };
      const end = (ev: PointerEvent): void => {
        if (ev.pointerId !== e.pointerId) return;
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', end);
        bar.removeEventListener('pointercancel', end);
        bar.classList.remove('dragging');
        document.body.classList.remove('resizing-x', 'resizing-y');
        if (bar.hasPointerCapture(ev.pointerId)) bar.releasePointerCapture(ev.pointerId);
        persist();
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', end);
      bar.addEventListener('pointercancel', end);
    });

    bar.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (name === 'left') {
        prefs.sizes = { ...prefs.sizes, leftW: DEFAULT_SIZES.leftW };
        if (collapsed) {
          setLeftCollapsed(false);
          return;
        }
      } else {
        prefs.sizes = { ...prefs.sizes, [spec.key]: DEFAULT_SIZES[spec.key] };
      }
      apply();
      persist();
    });

    bar.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? KEY_STEP_BIG : KEY_STEP;
      let d = 0;
      if (axis === 'x') {
        if (e.key === 'ArrowLeft') d = -step;
        else if (e.key === 'ArrowRight') d = step;
      } else if (e.key === 'ArrowUp') d = -step;
      else if (e.key === 'ArrowDown') d = step;
      if (d === 0) return;
      e.preventDefault();
      if (name === 'left' && collapsed) setLeftCollapsed(false);
      setSize(spec.key, current()[spec.key] + spec.sign * d);
      persist();
    });
  }

  bindBar('left');
  bindBar('right');
  bindBar('bottom');
  window.addEventListener('resize', apply);
  apply();

  return {
    ...bars,
    preset: () => prefs.preset,
    setPreset(preset) {
      prefs.preset = preset;
      prefs.sizes = sizesForPreset(preset, current());
      apply();
      persist();
      notifyPrefs();
    },
    leftCollapsed: () => collapsed,
    setLeftCollapsed,
    ensureBottomOpen() {
      if (current().bottomH >= BOTTOM_OPEN_H) return;
      setSize('bottomH', DEFAULT_SIZES.bottomH);
      persist();
    },
    onPrefsChange(cb) {
      prefsListeners.push(cb);
    },
  };
}

function makeBar(spec: BarSpec): HTMLElement {
  const bar = h('div', `splitter ${spec.axis === 'x' ? 'v' : 'h'}`);
  bar.tabIndex = 0;
  bar.setAttribute('role', 'separator');
  // A separator between side-by-side panes has a vertical orientation, and vice versa.
  bar.setAttribute('aria-orientation', spec.axis === 'x' ? 'vertical' : 'horizontal');
  bar.setAttribute('aria-valuemin', String(spec.min));
  bar.setAttribute('aria-valuemax', String(spec.max));
  bar.title = spec.label;
  bar.setAttribute('aria-label', spec.label);
  return bar;
}
