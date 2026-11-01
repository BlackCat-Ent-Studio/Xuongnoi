import { getNodeDef } from '../../engine/registry';
import type { GraphNode, ParamDef, PortType, Runtime, Wire } from '../../engine/types';
import { h } from '../../editor/dom';
import { estimateNodeSize, wirePath } from '../../editor/graph/graph-geometry';
import { buildNodeView } from '../../editor/graph/node-view';
import type { PortDir } from '../../editor/graph/port-compat';
import { createWireEnergy, isEnergyEnabled } from '../../editor/graph/wire-energy';
import type { PuzzleLevel } from '../types';
import {
  EMPTY_BOARD,
  PUZZLE_TEXT,
  checkJoin,
  clampParam,
  connect,
  editableParamIds,
  findFreeSpot,
  isPortShown,
  isSceneryNode,
  paramValue,
  placePiece,
  removePiece,
  removeWire,
  setParam,
  trayLeft,
  type BoardState,
  type Box,
  type PortEnd,
} from './board-state';
import { PUZZLE_UI_TEXT } from './puzzle-text';

import '../../editor/graph/graph.css';
import '../../editor/graph/node-cards.css';
import '../../editor/graph/wire-energy.css';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Levels are laid out on a board this big (logical px); cards that stick out widen it. */
const BOARD_W = 1000;
const BOARD_H = 560;
const EDGE_PAD = 12;
/** A tap this close (screen px) to a pin counts as a tap on it, so small cards stay easy to wire. */
const PORT_REACH = 26;
const WIRE_REACH = 12;

const NO_MISSING: ReadonlySet<string> = new Set();
const portKey = (node: string, dir: PortDir, port: string): string => `${node}|${dir}|${port}`;

const LOCK_PATH = 'M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3';

function lockIcon(): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'pz-lock');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', PUZZLE_UI_TEXT.lockedCard);
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', LOCK_PATH);
  svg.append(p);
  return svg;
}

interface PortEntry {
  end: PortEnd;
  dot: HTMLElement;
  row: HTMLElement;
}

export interface BoardViewOptions {
  level: PuzzleLevel;
  /** The `.wc` board element; the view fills it. */
  board: HTMLElement;
  /** Where the tray chips go. */
  trayEl: HTMLElement;
  /** Bottom bar (tray + buttons); the cards are fitted above it. */
  bottomEl: HTMLElement;
  /** Called after every change the player makes. */
  onChange(state: BoardState): void;
}

export interface BoardView {
  state(): BoardState;
  /** Takes every placed piece and wire back and puts cards where the level had them. */
  reset(): void;
  /** Locks editing and shows the live current while the game runs. */
  setRunning(on: boolean, getRuntime?: () => Runtime | null): void;
  /** Stops animating but keeps the lit wires (the game ended). */
  freezeEnergy(): void;
  refit(): void;
  toast(message: string): void;
  destroy(): void;
}

export function createBoardView(opts: BoardViewOptions): BoardView {
  const { level, board, trayEl, bottomEl, onChange } = opts;
  board.classList.add('wc', 'pz-board');

  const world = h('div', 'wc-world');
  const wireLayer = document.createElementNS(SVG_NS, 'svg');
  wireLayer.setAttribute('class', 'wc-wires');
  const nodeLayer = h('div', 'wc-nodes');
  world.append(wireLayer, nodeLayer);
  const toastEl = h('div', 'pz-toast');
  toastEl.hidden = true;
  toastEl.setAttribute('role', 'status');
  board.prepend(world);
  board.append(toastEl);

  const energy = createWireEnergy(wireLayer);
  let state: BoardState = EMPTY_BOARD;
  let picked: PortEnd | null = null;
  let running = false;
  let scale = 1;
  let originX = 0;
  let originY = 0;
  let area = { w: BOARD_W, h: BOARD_H };
  const positions = new Map<string, { x: number; y: number }>();
  const ports = new Map<string, PortEntry>();
  const cards = new Map<string, HTMLElement>();
  let popover: HTMLElement | null = null;
  let toastTimer = 0;
  let energyRaf = 0;
  let energyLast = 0;
  let getRuntime: () => Runtime | null = () => null;

  function resetPositions(): void {
    positions.clear();
    for (const n of level.base.nodes) positions.set(n.id, { x: n.pos.x, y: n.pos.y });
  }
  resetPositions();

  // ---------- helpers ----------

  function visibleNodes(): { node: GraphNode; locked: boolean }[] {
    const base = level.base.nodes.filter((n) => !isSceneryNode(level, n.id)).map((node) => ({ node, locked: true }));
    return [...base, ...state.placed.map((p) => ({ node: p.node, locked: false }))];
  }

  const posOf = (node: GraphNode): { x: number; y: number } => positions.get(node.id) ?? node.pos;

  function toast(message: string): void {
    if (!message) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl.hidden = true;
    }, 2200);
  }

  function changed(): void {
    render();
    onChange(state);
  }

  // ---------- layout ----------

  function fit(): void {
    let ax = BOARD_W;
    let ay = BOARD_H;
    for (const [id, box] of cards) {
      const p = positions.get(id);
      if (!p) continue;
      ax = Math.max(ax, p.x + box.offsetWidth + EDGE_PAD);
      ay = Math.max(ay, p.y + box.offsetHeight + EDGE_PAD);
    }
    area = { w: ax, h: ay };
    const bw = board.clientWidth;
    const bh = Math.max(1, board.clientHeight - bottomEl.offsetHeight - 10);
    scale = Math.max(0.05, Math.min(1, bw / ax, bh / ay));
    originX = Math.max(0, (bw - ax * scale) / 2);
    originY = Math.max(0, (bh - ay * scale) / 2);
    world.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
  }

  /** Centre of a pin in board (logical) coordinates. */
  function dotCenter(dot: Element): { x: number; y: number } {
    const r = dot.getBoundingClientRect();
    const w = world.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - w.left) / scale, y: (r.top + r.height / 2 - w.top) / scale };
  }

  // ---------- nodes ----------

  function decorate(box: HTMLElement, node: GraphNode, locked: boolean): void {
    const head = box.querySelector('.wc-node-head');
    if (!head) return;
    box.classList.toggle('pz-locked', locked);
    if (locked) {
      head.append(lockIcon());
    } else {
      const x = h('button', 'pz-x', '×');
      x.type = 'button';
      const label = getNodeDef(node.kind)?.label ?? '';
      x.setAttribute('aria-label', PUZZLE_UI_TEXT.backToTray(label));
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        if (running) return;
        positions.delete(node.id);
        state = removePiece(state, node.id);
        if (picked?.node === node.id) picked = null;
        closePopover();
        changed();
      });
      head.append(x);
    }
    const def = getNodeDef(node.kind);
    for (const paramId of editableParamIds(level, node)) {
      const pd = def?.params.find((p) => p.id === paramId);
      if (!pd) continue;
      const btn = h('button', 'pz-param');
      btn.type = 'button';
      btn.dataset.node = node.id;
      btn.dataset.param = paramId;
      btn.append(h('span', 'pz-param-name', pd.label), h('b', 'pz-param-val', paramText(pd, paramValue(state, node, paramId))), h('span', 'pz-param-go', '▾'));
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (running) return;
        if (popover?.dataset.node === node.id && popover.dataset.param === paramId) closePopover();
        else openPopover(node, pd, btn);
      });
      box.append(btn);
    }
  }

  function paramText(pd: ParamDef, value: unknown): string {
    if (pd.kind === 'select') return pd.options?.find((o) => o.value === value)?.label ?? String(value ?? '');
    return String(value ?? '');
  }

  function hideLockedPorts(box: HTMLElement, node: GraphNode, dots: Map<string, HTMLElement>): void {
    for (const row of Array.from(box.querySelectorAll<HTMLElement>('.wc-port'))) {
      const dir = row.dataset.dir === 'out' ? 'out' : 'in';
      const port = row.dataset.port ?? '';
      if (isPortShown(level, node.id, port, dir)) continue;
      dots.delete(`${dir}|${port}`);
      row.remove();
    }
  }

  function renderNodes(): void {
    nodeLayer.replaceChildren();
    ports.clear();
    cards.clear();
    for (const { node, locked } of visibleNodes()) {
      const shown = { ...node, params: { ...node.params, ...state.overrides[node.id] }, pos: posOf(node) };
      const { box, dots } = buildNodeView(shown, NO_MISSING);
      if (locked) hideLockedPorts(box, node, dots);
      decorate(box, node, locked);
      nodeLayer.append(box);
      cards.set(node.id, box);
      for (const [k, dot] of dots) {
        const [dir, ...rest] = k.split('|');
        const port = rest.join('|');
        const row = dot.closest<HTMLElement>('.wc-port');
        if (!row || (dir !== 'in' && dir !== 'out')) continue;
        ports.set(portKey(node.id, dir, port), { end: { node: node.id, port, dir }, dot, row });
      }
    }
  }

  // ---------- wires ----------

  function outputType(w: Wire): PortType | null {
    const from = [...level.base.nodes, ...state.placed.map((p) => p.node)].find((n) => n.id === w.from.node);
    return getNodeDef(from?.kind ?? '')?.outputs.find((p) => p.id === w.from.port)?.type ?? null;
  }

  function drawWires(): void {
    wireLayer.replaceChildren();
    energy.reset();
    const all = [...level.base.wires.map((wire) => ({ wire, locked: true })), ...state.wires.map((wire) => ({ wire, locked: false }))];
    for (const { wire, locked } of all) {
      const out = ports.get(portKey(wire.from.node, 'out', wire.from.port));
      const inn = ports.get(portKey(wire.to.node, 'in', wire.to.port));
      const type = outputType(wire);
      if (!out || !inn || !type) continue;
      const a = dotCenter(out.dot);
      const b = dotCenter(inn.dot);
      const d = wirePath(a.x, a.y, b.x, b.y);
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', `wc-wire type-${type}${locked ? ' pz-wire-locked' : ''}`);
      path.setAttribute('d', d);
      const hit = document.createElementNS(SVG_NS, 'path');
      hit.setAttribute('class', 'wc-wire-hit');
      hit.setAttribute('d', d);
      hit.dataset.wire = wire.id;
      if (locked) hit.dataset.locked = '1';
      wireLayer.append(path, hit);
      if (isEnergyEnabled()) energy.addWire(wire, type, path, out.dot, inn.dot, running);
    }
  }

  // ---------- tray ----------

  function renderTray(): void {
    trayEl.replaceChildren();
    const left = trayLeft(level, state);
    level.tray.forEach((piece, slot) => {
      const def = getNodeDef(piece.kind);
      const n = left[slot] ?? 0;
      const chip = h('button', `pz-chip cat-${def?.category ?? 'logic'}`);
      chip.type = 'button';
      chip.disabled = n <= 0 || running;
      chip.append(h('b', '', def?.label ?? piece.kind), h('span', '', n > 0 ? PUZZLE_UI_TEXT.trayLeft(n) : PUZZLE_UI_TEXT.trayUsed));
      chip.addEventListener('click', () => addFromTray(slot));
      trayEl.append(chip);
    });
  }

  function addFromTray(slot: number): void {
    if (running) return;
    const piece = level.tray[slot];
    if (!piece) return;
    const probe = placePiece(level, state, slot, { x: 0, y: 0 });
    const placed = probe?.placed[probe.placed.length - 1];
    if (!probe || !placed) return;
    const taken: Box[] = [];
    for (const [id, box] of cards) {
      const p = positions.get(id);
      if (p) taken.push({ x: p.x, y: p.y, w: box.offsetWidth, h: box.offsetHeight });
    }
    const size = estimateNodeSize(placed.node);
    const spot = findFreeSpot(taken, size, area);
    positions.set(placed.node.id, spot);
    state = { ...probe, placed: probe.placed.map((p) => (p === placed ? { ...p, node: { ...p.node, pos: spot } } : p)) };
    picked = null;
    closePopover();
    changed();
  }

  // ---------- picking and joining ----------

  function applyPick(): void {
    board.classList.toggle('wiring', picked !== null);
    for (const entry of ports.values()) {
      const { row, end } = entry;
      const isPick = picked !== null && picked.node === end.node && picked.port === end.port && picked.dir === end.dir;
      const ok = picked !== null && !isPick && end.dir !== picked.dir && checkJoin(level, state, picked, end).ok;
      row.classList.toggle('pick', isPick);
      row.classList.toggle('ok', ok);
      row.classList.toggle('no', picked !== null && !isPick && !ok);
    }
  }

  function tapPort(end: PortEnd): void {
    if (!picked) {
      picked = end;
      return applyPick();
    }
    if (picked.node === end.node && picked.port === end.port && picked.dir === end.dir) {
      picked = null;
      return applyPick();
    }
    if (picked.dir === end.dir) {
      picked = end;
      return applyPick();
    }
    const res = connect(level, state, picked, end);
    if (res.ok) {
      state = res.state;
      picked = null;
      toast(PUZZLE_TEXT.joined);
      changed();
    } else {
      toast(res.message);
    }
  }

  /** The pin nearest to a tap, preferring one the picked pin can join when several are in reach. */
  function pinNear(x: number, y: number, reach: number): PortEntry | null {
    let best: PortEntry | null = null;
    let bestD = reach;
    let bestOk: PortEntry | null = null;
    let bestOkD = reach;
    for (const entry of ports.values()) {
      const r = entry.dot.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d <= bestD) {
        best = entry;
        bestD = d;
      }
      if (picked && d <= bestOkD && entry.row.classList.contains('ok')) {
        bestOk = entry;
        bestOkD = d;
      }
    }
    return bestOk ?? best;
  }

  board.addEventListener('click', (e) => {
    if (running) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (popover && !t.closest('.pz-pop')) {
      closePopover();
      return;
    }
    if (t.closest('button, .wc-node-head, .pz-pop')) return;
    const hit = t.closest<SVGElement>('.wc-wire-hit');
    const row = t.closest('.wc-port');
    const onRow = row ? [...ports.values()].find((p) => p.row === row) : undefined;
    const pin = onRow ?? pinNear(e.clientX, e.clientY, hit ? WIRE_REACH : PORT_REACH);
    if (pin) return tapPort(pin.end);
    if (hit?.dataset.wire) {
      if (hit.dataset.locked) return toast(PUZZLE_TEXT.lockedWire);
      state = removeWire(state, hit.dataset.wire);
      toast(PUZZLE_TEXT.removed);
      return changed();
    }
    if (picked) {
      picked = null;
      applyPick();
    }
  });

  // ---------- dragging cards by their header ----------

  nodeLayer.addEventListener('pointerdown', (e) => {
    if (running || e.button !== 0) return;
    const t = e.target;
    if (!(t instanceof Element) || t.closest('button')) return;
    const head = t.closest<HTMLElement>('.wc-node-head');
    const box = head?.closest<HTMLElement>('.wc-node');
    const id = box?.dataset.id;
    const start = id ? positions.get(id) : undefined;
    if (!head || !box || !id || !start) return;
    const startX = e.clientX;
    const startY = e.clientY;
    head.setPointerCapture(e.pointerId);
    box.classList.add('pz-dragging');
    const move = (ev: PointerEvent): void => {
      const x = Math.min(Math.max(0, start.x + (ev.clientX - startX) / scale), Math.max(0, area.w - box.offsetWidth));
      const y = Math.min(Math.max(0, start.y + (ev.clientY - startY) / scale), Math.max(0, area.h - box.offsetHeight));
      positions.set(id, { x: Math.round(x), y: Math.round(y) });
      box.style.left = `${Math.round(x)}px`;
      box.style.top = `${Math.round(y)}px`;
      drawWires();
    };
    const end = (): void => {
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', end);
      head.removeEventListener('pointercancel', end);
      box.classList.remove('pz-dragging');
    };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
  });

  // ---------- param editor ----------

  function closePopover(): void {
    popover?.remove();
    popover = null;
  }

  function openPopover(node: GraphNode, pd: ParamDef, anchor: HTMLElement): void {
    closePopover();
    const pop = h('div', 'pz-pop');
    pop.dataset.node = node.id;
    pop.dataset.param = pd.id;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', pd.label);
    popover = pop;
    board.append(pop);
    const refill = (): void => {
      const cur = paramValue(state, node, pd.id);
      pop.replaceChildren(h('div', 'pz-pop-title', pd.label));
      if (pd.kind === 'select') {
        const list = h('div', 'pz-pop-options');
        for (const o of pd.options ?? []) {
          const b = h('button', `pz-pop-opt${o.value === cur ? ' on' : ''}`, o.label);
          b.type = 'button';
          b.addEventListener('click', () => apply(o.value));
          list.append(b);
        }
        pop.append(list);
      } else {
        const step = pd.step ?? 1;
        const num = typeof cur === 'number' ? cur : Number(pd.default);
        const minus = h('button', 'pz-step', '−');
        const plus = h('button', 'pz-step', '+');
        minus.type = plus.type = 'button';
        minus.setAttribute('aria-label', PUZZLE_UI_TEXT.less);
        plus.setAttribute('aria-label', PUZZLE_UI_TEXT.more);
        minus.disabled = pd.min !== undefined && num <= pd.min;
        plus.disabled = pd.max !== undefined && num >= pd.max;
        minus.addEventListener('click', () => apply(clampParam(pd, num - step)));
        plus.addEventListener('click', () => apply(clampParam(pd, num + step)));
        const row = h('div', 'pz-pop-row');
        row.append(minus, h('b', 'pz-pop-num', String(num)), plus);
        pop.append(row);
      }
    };
    const apply = (v: string | number): void => {
      state = setParam(level, state, node.id, pd.id, v);
      refill();
      renderNodes();
      fit();
      drawWires();
      applyPick();
      onChange(state);
    };
    refill();
    // Sit under the tapped row (or above it near the bottom), kept inside the board.
    const b = board.getBoundingClientRect();
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth;
    const hgt = pop.offsetHeight;
    const left = Math.min(Math.max(6, r.left - b.left), Math.max(6, b.width - w - 6));
    const below = r.bottom - b.top + 6;
    const top = below + hgt > b.height - 6 ? Math.max(6, r.top - b.top - hgt - 6) : below;
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  // ---------- energy ----------

  function energyFrame(now: number): void {
    energyRaf = 0;
    if (!running || !isEnergyEnabled()) return;
    const dt = Math.min(50, now - energyLast);
    energyLast = now;
    const rt = getRuntime();
    if (rt) {
      try {
        energy.update(dt, now, (w) => rt.getWireValue(w), () => rt.takeRisen?.());
      } catch {
        // A bad frame must never break the board; the next frame tries again.
      }
    }
    energyRaf = requestAnimationFrame(energyFrame);
  }

  function stopEnergyLoop(): void {
    if (energyRaf) cancelAnimationFrame(energyRaf);
    energyRaf = 0;
  }

  // ---------- render ----------

  function render(): void {
    renderNodes();
    fit();
    drawWires();
    renderTray();
    applyPick();
  }

  const ro = new ResizeObserver(() => fit());
  ro.observe(board);
  ro.observe(bottomEl);
  render();

  return {
    state: () => state,
    reset() {
      state = EMPTY_BOARD;
      picked = null;
      closePopover();
      resetPositions();
      changed();
    },
    setRunning(on, rtGetter) {
      running = on;
      picked = null;
      closePopover();
      board.classList.toggle('readonly', on);
      board.classList.remove('wiring');
      stopEnergyLoop();
      energy.clear();
      if (rtGetter) getRuntime = rtGetter;
      renderTray();
      applyPick();
      drawWires();
      if (on && isEnergyEnabled()) {
        energyLast = performance.now();
        energyRaf = requestAnimationFrame(energyFrame);
      }
    },
    freezeEnergy: stopEnergyLoop,
    refit() {
      fit();
    },
    toast,
    destroy() {
      stopEnergyLoop();
      window.clearTimeout(toastTimer);
      ro.disconnect();
    },
  };
}
