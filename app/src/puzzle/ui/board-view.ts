import { getNodeDef } from '../../engine/registry';
import type { GraphNode, ParamDef, PortRef, PortType, Runtime, Wire } from '../../engine/types';
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
  separateBoxes,
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
import { isObjectKind } from './object-cards';
import { PUZZLE_UI_TEXT } from './puzzle-text';
import { playSfx } from './sound';

import '../../editor/graph/graph.css';
import '../../editor/graph/node-cards.css';
import '../../editor/graph/wire-energy.css';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Levels are laid out on a board this big (logical px); cards that stick out widen it. */
const BOARD_W = 1000;
const BOARD_H = 560;
/** Smallest card scale; at 12px base text this keeps phone text at about 9px. */
const MIN_CARD_SCALE = 0.78;
/** A tap this close (screen px) to a pin counts as a tap on it, so small cards stay easy to wire. */
const PORT_REACH = 26;
const WIRE_REACH = 12;
/** A press that moves less than this (screen px) is a tap, not a drag. */
const TAP_SLOP = 6;

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
  /** The part of the board (board px) a card must stay out of: the corner window. Read on every layout. */
  keepClear?: () => Box | null;
  /** Where the toast goes (default: the board). The level screen passes itself so a toast stays readable while the board is shrunk. */
  toastHost?: HTMLElement;
  /** The player tapped an object card (id) or tapped away from it / tapped it again (null). The stage glows that object. */
  onCardPick?: (nodeId: string | null) => void;
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
  // ----- hooks for the tutorial guide -----
  /** Whether the board shows a card for this node that stands for a stage object (it can be picked). */
  hasObjectCard(nodeId: string): boolean;
  /** Marks one object card as picked and pulses it (null clears). Does not call `onCardPick`. */
  pickCard(nodeId: string | null): void;
  /** The pin of a port on the board, or null when it is not shown. */
  portEl(end: PortEnd): HTMLElement | null;
  /** The tray chip of a tray slot. */
  chipEl(slot: number): HTMLElement | null;
  /** The editable-param row of a node. */
  paramEl(nodeId: string, paramId: string): HTMLElement | null;
  /** The open param editor, if any. */
  popoverEl(): HTMLElement | null;
  closePopover(): void;
  /** The port the player has picked and not yet joined. */
  pickedEnd(): PortEnd | null;
  /** Draws a dotted "ghost" wire between two ports (null removes it). It never counts as a wire. */
  setGhost(from: PortRef | null, to?: PortRef): void;
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
  (opts.toastHost ?? board).append(toastEl);

  const energy = createWireEnergy(wireLayer);
  let state: BoardState = EMPTY_BOARD;
  let picked: PortEnd | null = null;
  /** The object card that is lit (tapped on the board, or its object tapped on the stage). */
  let pickedCard: string | null = null;
  let running = false;
  /** Cards keep a readable size; only their positions follow the board size. */
  let cardScale = 1;
  /** Board area (screen px) above the bottom bar, where cards live. */
  let area = { w: BOARD_W, h: BOARD_H };
  /** Where each card sits on screen after layout (top-left, px). */
  const placedAt = new Map<string, { x: number; y: number }>();
  const spreadX = (): number => area.w / BOARD_W;
  const spreadY = (): number => area.h / BOARD_H;
  const positions = new Map<string, { x: number; y: number }>();
  const ports = new Map<string, PortEntry>();
  const cards = new Map<string, HTMLElement>();
  let popover: HTMLElement | null = null;
  let ghost: { from: PortRef; to: PortRef } | null = null;
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

  /**
   * Level positions (1000x560 logical space) are stretched to the board; cards stay near full size
   * (a little smaller on a small board) and are pushed apart where they would overlap.
   */
  function layout(): void {
    const bw = Math.max(1, board.clientWidth);
    // The world starts below the top bar (CSS `top` of .wc-world); the bottom bar is the other end.
    const bh = Math.max(1, board.clientHeight - world.offsetTop - bottomEl.offsetHeight - 10);
    area = { w: bw, h: bh };
    const c0 = Math.max(MIN_CARD_SCALE, Math.min(1, bw / 700));
    const clear = opts.keepClear?.() ?? null;
    const blocked: Box[] = clear ? [{ x: clear.x, y: clear.y - world.offsetTop, w: clear.w, h: clear.h }] : [];
    const natural = [...cards].map(([id, box]) => {
      const p = positions.get(id) ?? { x: 0, y: 0 };
      return { id, x: p.x * spreadX(), y: p.y * spreadY(), w: box.offsetWidth, h: box.offsetHeight };
    });
    let result = separateBoxes([], area);
    cardScale = c0;
    for (const c of [c0, c0 * 0.93, c0 * 0.86, c0 * 0.8, c0 * 0.72, c0 * 0.65, c0 * 0.58]) {
      cardScale = c;
      result = separateBoxes(natural.map((n) => ({ ...n, w: n.w * c, h: n.h * c })), area, 8, blocked);
      if (result.fits) break;
    }
    for (const [id, box] of cards) {
      const p = result.pos.get(id);
      if (!p) continue;
      placedAt.set(id, p);
      box.style.left = `${Math.round(p.x)}px`;
      box.style.top = `${Math.round(p.y)}px`;
      box.style.transformOrigin = '0 0';
      box.style.transform = `scale(${cardScale})`;
    }
  }

  /** Centre of a pin in board coordinates (undoes the shrink while the board sits in the corner). */
  function dotCenter(dot: Element): { x: number; y: number } {
    const r = dot.getBoundingClientRect();
    const w = world.getBoundingClientRect();
    const b = board.getBoundingClientRect();
    const k = board.offsetWidth > 0 && b.width > 0 ? b.width / board.offsetWidth : 1;
    return { x: (r.left + r.width / 2 - w.left) / k, y: (r.top + r.height / 2 - w.top) / k };
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
        playSfx('unwire');
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

  // ---------- picked object card ----------

  function isPickable(id: string): boolean {
    const box = cards.get(id);
    return box !== undefined && isObjectKind(box.dataset.kind ?? '');
  }

  function showPicked(ping: boolean): void {
    for (const [id, box] of cards) {
      const on = id === pickedCard;
      box.classList.toggle('pz-picked', on);
      if (!on) box.classList.remove('pz-ping');
      else if (ping) {
        box.classList.remove('pz-ping');
        void box.offsetWidth; // restart the pulse
        box.classList.add('pz-ping');
      }
    }
  }

  /** The player's own tap on a card (or away): a second tap on the lit card, or any non-object spot, lights nothing. */
  function userPick(id: string | null): void {
    const next = id !== null && isPickable(id) && id !== pickedCard ? id : null;
    if (next === null && pickedCard === null) return;
    pickedCard = next;
    showPicked(next !== null);
    opts.onCardPick?.(next);
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
    showPicked(false);
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
    drawGhost();
  }

  /** The guide's dotted line from where a wire starts to where it ends; the pins are never touched. */
  function drawGhost(): void {
    if (!ghost || running) return;
    const out = ports.get(portKey(ghost.from.node, 'out', ghost.from.port));
    const inn = ports.get(portKey(ghost.to.node, 'in', ghost.to.port));
    const type = outputType({ id: 'ghost', from: ghost.from, to: ghost.to });
    if (!out || !inn || !type) return;
    const a = dotCenter(out.dot);
    const b = dotCenter(inn.dot);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', `pz-ghost-wire type-${type}`);
    path.setAttribute('d', wirePath(a.x, a.y, b.x, b.y));
    wireLayer.append(path);
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
    const clear = opts.keepClear?.() ?? null;
    const taken: Box[] = clear ? [{ x: clear.x, y: clear.y - world.offsetTop, w: clear.w, h: clear.h }] : [];
    for (const [id, box] of cards) {
      const p = placedAt.get(id);
      if (p) taken.push({ x: p.x, y: p.y, w: box.offsetWidth * cardScale, h: box.offsetHeight * cardScale });
    }
    const est = estimateNodeSize(placed.node);
    const spot = findFreeSpot(taken, { w: est.w * cardScale, h: est.h * cardScale }, area, 8);
    // Stored in level space so the card keeps its place when the board is resized.
    const logical = { x: Math.round(spot.x / spreadX()), y: Math.round(spot.y / spreadY()) };
    positions.set(placed.node.id, logical);
    state = { ...probe, placed: probe.placed.map((p) => (p === placed ? { ...p, node: { ...p.node, pos: logical } } : p)) };
    picked = null;
    closePopover();
    playSfx('pick');
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
      playSfx('wire');
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
    // composedPath still lists the popover when the tapped − / + button was just replaced by the refill.
    if (popover && !e.composedPath().includes(popover)) {
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
      playSfx('unwire');
      toast(PUZZLE_TEXT.removed);
      return changed();
    }
    if (picked) {
      picked = null;
      applyPick();
    }
    userPick(t.closest<HTMLElement>('.wc-node')?.dataset.id ?? null);
  });

  // ---------- dragging cards by their header ----------

  nodeLayer.addEventListener('pointerdown', (e) => {
    if (running || e.button !== 0) return;
    const t = e.target;
    if (!(t instanceof Element) || t.closest('button')) return;
    const head = t.closest<HTMLElement>('.wc-node-head');
    const box = head?.closest<HTMLElement>('.wc-node');
    const id = box?.dataset.id;
    const start = id ? placedAt.get(id) : undefined;
    if (!head || !box || !id || !start) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragged = false;
    head.setPointerCapture(e.pointerId);
    box.classList.add('pz-dragging');
    const move = (ev: PointerEvent): void => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > TAP_SLOP) dragged = true;
      const x = Math.min(Math.max(0, start.x + ev.clientX - startX), Math.max(0, area.w - box.offsetWidth * cardScale));
      const y = Math.min(Math.max(0, start.y + ev.clientY - startY), Math.max(0, area.h - box.offsetHeight * cardScale));
      positions.set(id, { x: x / spreadX(), y: y / spreadY() });
      box.style.left = `${Math.round(x)}px`;
      box.style.top = `${Math.round(y)}px`;
      drawWires();
    };
    const end = (up: PointerEvent): void => {
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', end);
      head.removeEventListener('pointercancel', end);
      box.classList.remove('pz-dragging');
      // Dropped on another card: the layout nudges the cards apart.
      layout();
      drawWires();
      // A tap without a drag picks the card (a second tap lets go).
      if (!dragged && up.type === 'pointerup') userPick(id);
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
      // A placed piece is replaced by a new object on every change, so read the current one.
      const cur = paramValue(state, state.placed.find((p) => p.node.id === node.id)?.node ?? node, pd.id);
      pop.replaceChildren(h('div', 'pz-pop-title', pd.label));
      if (pd.kind === 'select') {
        const list = h('div', 'pz-pop-options');
        for (const o of pd.options ?? []) {
          const b = h('button', `pz-pop-opt${o.value === cur ? ' on' : ''}`, o.label);
          b.type = 'button';
          b.dataset.value = o.value;
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
      layout();
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
    layout();
    drawWires();
    renderTray();
    applyPick();
  }

  const ro = new ResizeObserver(() => {
    layout();
    drawWires();
  });
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
      layout();
      drawWires();
    },
    toast,
    hasObjectCard: (nodeId) => isPickable(nodeId),
    pickCard(nodeId) {
      pickedCard = nodeId !== null && isPickable(nodeId) ? nodeId : null;
      showPicked(pickedCard !== null);
    },
    portEl: (end) => ports.get(portKey(end.node, end.dir, end.port))?.dot ?? null,
    chipEl: (slot) => (trayEl.children[slot] as HTMLElement | undefined) ?? null,
    paramEl: (nodeId, paramId) => {
      for (const el of nodeLayer.querySelectorAll<HTMLElement>('.pz-param')) {
        if (el.dataset.node === nodeId && el.dataset.param === paramId) return el;
      }
      return null;
    },
    popoverEl: () => popover,
    closePopover,
    pickedEnd: () => picked,
    setGhost(from, to) {
      ghost = from && to ? { from, to } : null;
      drawWires();
    },
    destroy() {
      stopEnergyLoop();
      window.clearTimeout(toastTimer);
      ro.disconnect();
    },
  };
}
