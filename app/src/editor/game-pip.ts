import { h } from './dom';
import { icon, type IconName } from './icons';
import { PIP_TEXT } from './pip/pip-text-vi';
import './pip/pip.css';

export const PIP_KEY = 'xuong-noi:pip';
export const PIP_MIN_W = 240;
export const PIP_DEFAULT_W = 312;
const MARGIN = 4;
const DEFAULT_OFFSET = 12;
/** Pointer travel before a press on the tab counts as a drag. */
const DRAG_START_PX = 6;

export interface PipPrefs {
  w: number;
  /** Distance from the right and bottom edge of the host; the window stays anchored there when the host resizes. */
  right: number;
  bottom: number;
  collapsed: boolean;
}

export function defaultPipPrefs(): PipPrefs {
  return { w: PIP_DEFAULT_W, right: DEFAULT_OFFSET, bottom: DEFAULT_OFFSET, collapsed: false };
}

/** Reads saved prefs; anything missing or malformed falls back to defaults. */
export function parsePipPrefs(raw: string | null): PipPrefs {
  const d = defaultPipPrefs();
  if (!raw) return d;
  try {
    const o: unknown = JSON.parse(raw);
    if (typeof o !== 'object' || o === null) return d;
    const r = o as Record<string, unknown>;
    const num = (v: unknown, fb: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fb);
    return {
      w: Math.max(PIP_MIN_W, num(r.w, d.w)),
      right: Math.max(0, num(r.right, d.right)),
      bottom: Math.max(0, num(r.bottom, d.bottom)),
      collapsed: r.collapsed === true,
    };
  } catch {
    return d;
  }
}

/** Widest window that still fits the host in both directions, given the chrome height around the 16:10 game area. */
export function maxPipWidth(hostW: number, hostH: number, chromeH: number): number {
  const byH = ((hostH - 2 * MARGIN - chromeH) * 16) / 10;
  return Math.max(PIP_MIN_W, Math.floor(Math.min(hostW - 2 * MARGIN, byH)));
}

export interface GamePip {
  el: HTMLElement;
  visible(): boolean;
  /** Shows or hides the window; the game box moves in or back to its tab pane. */
  setVisible(on: boolean): void;
  setStatus(playing: boolean, paused: boolean): void;
  /** Places the window so its title bar sits under the given screen point. */
  placeAt(clientX: number, clientY: number): void;
  destroy(): void;
}

export interface GamePipOptions {
  /** Positioned container the window floats in and is clamped to (the centre dock's pane area). */
  host: HTMLElement;
  /** The game view's own container; the same element (and renderer) moves between its tab pane and the window. */
  gameBox: HTMLElement;
  /** Centre tab bar: dropping the window on it, or the Phóng to button, docks the game back. */
  tabBar: HTMLElement;
  /** The tab button that can be dragged out onto the host. */
  gameTab: HTMLElement;
  onDockBack(): void;
  /** The tab was dropped on the host: switch to the wiring board and show the window (then call `placeAt`). */
  onFloatRequest(): void;
  onSplit(): void;
  /** Called after the game box moved or the window changed size. */
  onMoved(): void;
}

export function createGamePip(opts: GamePipOptions): GamePip {
  const { host, gameBox, tabBar, gameTab } = opts;
  const home = gameBox.parentElement as HTMLElement;
  let prefs = loadPrefs();
  let shown = false;

  const el = h('section', 'pip');
  el.setAttribute('aria-label', PIP_TEXT.aria);
  const title = h('div', 'pip-title');
  const chip = h('span', 'pip-chip', PIP_TEXT.statusEdit);
  const collapseBtn = actionBtn('minus', PIP_TEXT.collapse);
  const splitBtn = actionBtn('layout', PIP_TEXT.split);
  const maxBtn = actionBtn('expand', PIP_TEXT.maximize);
  const actions = h('div', 'pip-actions');
  actions.append(collapseBtn, splitBtn, maxBtn);
  title.append(h('span', 'pip-name', PIP_TEXT.title), chip, actions);
  const body = h('div', 'pip-body');
  const hint = h('div', 'pip-hint', PIP_TEXT.hintEdit);
  const grip = h('div', 'pip-resize');
  grip.title = PIP_TEXT.resize;
  el.append(title, body, hint, grip);
  el.hidden = true;
  host.append(el);

  function savePrefs(): void {
    try {
      localStorage.setItem(PIP_KEY, JSON.stringify(prefs));
    } catch {
      /* preference only */
    }
  }

  function loadPrefs(): PipPrefs {
    try {
      return parsePipPrefs(localStorage.getItem(PIP_KEY));
    } catch {
      return defaultPipPrefs();
    }
  }

  /** Height of everything except the 16:10 game area. */
  function chromeH(): number {
    return title.offsetHeight + (prefs.collapsed ? 0 : hint.offsetHeight + 1) + 2;
  }

  /** Applies size and position, clamped so the window never leaves the host. */
  function apply(): void {
    if (!shown) return;
    const hw = host.clientWidth;
    const hh = host.clientHeight;
    if (hw === 0 || hh === 0) return;
    const w = Math.min(Math.max(prefs.w, PIP_MIN_W), maxPipWidth(hw, hh, chromeH()));
    el.style.width = `${w}px`;
    const ew = el.offsetWidth;
    const eh = el.offsetHeight;
    const right = Math.min(Math.max(prefs.right, MARGIN), Math.max(MARGIN, hw - ew - MARGIN));
    const bottom = Math.min(Math.max(prefs.bottom, MARGIN), Math.max(MARGIN, hh - eh - MARGIN));
    el.style.right = `${right}px`;
    el.style.bottom = `${bottom}px`;
    el.classList.toggle('collapsed', prefs.collapsed);
    collapseBtn.replaceChildren(icon(prefs.collapsed ? 'plus' : 'minus'));
    collapseBtn.title = collapseBtn.ariaLabel = prefs.collapsed ? PIP_TEXT.expand : PIP_TEXT.collapse;
  }

  function setCollapsed(on: boolean): void {
    prefs = { ...prefs, collapsed: on };
    apply();
    savePrefs();
    opts.onMoved();
  }

  collapseBtn.addEventListener('click', () => {
    setCollapsed(!prefs.collapsed);
    collapseBtn.blur();
  });
  splitBtn.addEventListener('click', () => {
    splitBtn.blur();
    opts.onSplit();
  });
  maxBtn.addEventListener('click', () => {
    maxBtn.blur();
    opts.onDockBack();
  });
  title.addEventListener('dblclick', (e) => {
    if (!(e.target as Element).closest('button')) setCollapsed(!prefs.collapsed);
  });

  // ---------- drag by title bar (also docks back when released over the tab bar) ----------

  const over = (r: DOMRect, x: number, y: number): boolean => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

  title.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as Element).closest('button')) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const base = { ...prefs };
    title.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    const zone = makeZone(PIP_TEXT.dockBack);
    let moved = false;
    const move = (ev: PointerEvent): void => {
      if (ev.pointerId !== e.pointerId) return;
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 3) moved = true;
      prefs = { ...prefs, right: base.right - (ev.clientX - startX), bottom: base.bottom - (ev.clientY - startY) };
      apply();
      tabBar.classList.toggle('pip-drop', over(tabBar.getBoundingClientRect(), ev.clientX, ev.clientY));
    };
    const end = (ev: PointerEvent): void => {
      if (ev.pointerId !== e.pointerId) return;
      title.removeEventListener('pointermove', move);
      title.removeEventListener('pointerup', end);
      title.removeEventListener('pointercancel', end);
      if (title.hasPointerCapture(ev.pointerId)) title.releasePointerCapture(ev.pointerId);
      el.classList.remove('dragging');
      zone.remove();
      const docked = ev.type === 'pointerup' && over(tabBar.getBoundingClientRect(), ev.clientX, ev.clientY);
      tabBar.classList.remove('pip-drop');
      if (docked) {
        prefs = base; // the window keeps its old spot for the next time it floats
        apply();
        opts.onDockBack();
        return;
      }
      if (moved) savePrefs();
    };
    title.addEventListener('pointermove', move);
    title.addEventListener('pointerup', end);
    title.addEventListener('pointercancel', end);
  });

  // ---------- resize from the top-left corner (the window is anchored bottom-right) ----------

  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const baseW = el.offsetWidth;
    grip.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent): void => {
      if (ev.pointerId !== e.pointerId) return;
      prefs = { ...prefs, w: baseW - (ev.clientX - startX) };
      apply();
      opts.onMoved();
    };
    const end = (ev: PointerEvent): void => {
      if (ev.pointerId !== e.pointerId) return;
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', end);
      grip.removeEventListener('pointercancel', end);
      if (grip.hasPointerCapture(ev.pointerId)) grip.releasePointerCapture(ev.pointerId);
      // Keep what is actually shown, so a clamped size does not snap back later.
      prefs = { ...prefs, w: el.offsetWidth };
      savePrefs();
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  });

  // ---------- drag the Màn chơi tab out onto the canvas area ----------

  let suppressClick = false;
  gameTab.addEventListener(
    'click',
    (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopImmediatePropagation();
    },
    true,
  );
  gameTab.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let zone: HTMLElement | null = null;
    let ghost: HTMLElement | null = null;
    gameTab.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent): void => {
      if (ev.pointerId !== e.pointerId) return;
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_START_PX) return;
        dragging = true;
        zone = makeZone(PIP_TEXT.dropZone);
        ghost = h('div', 'pip-ghost', gameTab.textContent ?? '');
        document.body.append(ghost);
      }
      ghost!.style.left = `${ev.clientX}px`;
      ghost!.style.top = `${ev.clientY}px`;
      zone!.classList.toggle('active', over(host.getBoundingClientRect(), ev.clientX, ev.clientY));
    };
    const end = (ev: PointerEvent): void => {
      if (ev.pointerId !== e.pointerId) return;
      gameTab.removeEventListener('pointermove', move);
      gameTab.removeEventListener('pointerup', end);
      gameTab.removeEventListener('pointercancel', end);
      if (gameTab.hasPointerCapture(ev.pointerId)) gameTab.releasePointerCapture(ev.pointerId);
      zone?.remove();
      ghost?.remove();
      if (!dragging) return;
      suppressClick = true; // the click that follows this release must not re-select the tab
      setTimeout(() => (suppressClick = false), 0);
      if (ev.type === 'pointerup' && over(host.getBoundingClientRect(), ev.clientX, ev.clientY)) {
        dropPoint = { x: ev.clientX, y: ev.clientY };
        opts.onFloatRequest();
        // Already floating (the board tab was open): the request changed nothing, so move the window here.
        if (dropPoint && shown) {
          placeAt(dropPoint.x, dropPoint.y);
          dropPoint = null;
          opts.onMoved();
        }
      }
    };
    gameTab.addEventListener('pointermove', move);
    gameTab.addEventListener('pointerup', end);
    gameTab.addEventListener('pointercancel', end);
  });

  function makeZone(text: string): HTMLElement {
    const z = h('div', 'pip-dropzone', text);
    host.append(z);
    return z;
  }

  // ---------- show / hide ----------

  const ro = new ResizeObserver(apply);
  ro.observe(host);

  let dropPoint: { x: number; y: number } | null = null;

  function placeAt(clientX: number, clientY: number): void {
    const r = host.getBoundingClientRect();
    const w = Math.min(Math.max(prefs.w, PIP_MIN_W), maxPipWidth(r.width, r.height, 62));
    // Title bar centred under the pointer.
    prefs = { ...prefs, collapsed: false, w, right: r.right - clientX - w / 2, bottom: r.bottom - clientY - (el.offsetHeight || 200) + 16 };
    apply();
    savePrefs();
  }

  return {
    el,
    visible: () => shown,
    setVisible(on) {
      if (on === shown) return;
      shown = on;
      el.hidden = !on;
      if (on) {
        body.append(gameBox);
        if (dropPoint) {
          const p = dropPoint;
          dropPoint = null;
          placeAt(p.x, p.y);
        }
        apply();
      } else {
        home.append(gameBox);
      }
      opts.onMoved();
    },
    setStatus(playing, paused) {
      el.classList.toggle('playing', playing && !paused);
      el.classList.toggle('paused', playing && paused);
      chip.textContent = !playing ? PIP_TEXT.statusEdit : paused ? PIP_TEXT.statusPaused : PIP_TEXT.statusPlay;
      hint.textContent = !playing ? PIP_TEXT.hintEdit : paused ? PIP_TEXT.hintPaused : PIP_TEXT.hintPlay;
    },
    placeAt,
    destroy: () => ro.disconnect(),
  };
}

function actionBtn(name: IconName, label: string): HTMLButtonElement {
  const b = h('button', 'icobtn');
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.append(icon(name));
  return b;
}
