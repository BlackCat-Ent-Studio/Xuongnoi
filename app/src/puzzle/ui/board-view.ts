import { getNodeDef } from '../../engine/registry';
import type { GraphNode, ParamDef, PortRef, PortType, Runtime, Wire } from '../../engine/types';
import { h } from '../../editor/dom';
import { estimateNodeSize } from '../../editor/graph/graph-geometry';
import { createCardHelpButton } from '../../handbook/card-help-popup';
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
  tryFreeSpot,
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
import { arrangeLayout, boundsOf, fitContent, type FitView } from './board-arrange';
import { attachPanZoom } from './board-pan-zoom';
import { isObjectKind } from './object-cards';
import { PUZZLE_UI_TEXT } from './puzzle-text';
import { ICONS, svg } from './shell-kit';
import { playSfx } from './sound';
import { clampUnit, legIndexAt, midPoint, routeWires, type Pt, type RouteCard, type WireRoute, type WireSpec } from './wire-geometry';
import { addKnot, emptyKnots, bestGomSpot, fanOuts, gomKnots, isSharedKnot, knotPoints, mergeKnots, moveKnot, pruneKnots, removeKnot, wiresOfKnot, type KnotBook } from './wire-knots';
import { TIDY_TEXT } from './wire-tidy-text';

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
/** Two taps on a wire this close in time (ms) and place (screen px) are a double tap. */
const DOUBLE_MS = 320;
const DOUBLE_PX = 30;
/** Knots snap to this grid (board px at card scale 1). */
const KNOT_GRID = 8;
/** A knot dropped this close (screen px) to another knot joins it. */
const MERGE_PX = 18;
const TIDY_MS = 620;
const FIT_MS = 320;

const NO_MISSING: ReadonlySet<string> = new Set();
const portKey = (node: string, dir: PortDir, port: string): string => `${node}|${dir}|${port}`;

/** Icons of the tidy tools (same style as the camera tools). */
const TOOL_ICONS = {
  tidy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5h6v5h-6zM14.5 5h6v5h-6zM9 14h6v5H9z"/></svg>',
  gom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6h5c4 0 4 6 8 6h4M3.5 18h5c4 0 4-6 8-6"/></svg>',
} as const;

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
  const knotLayer = document.createElementNS(SVG_NS, 'svg');
  knotLayer.setAttribute('class', 'wc-wires pz-knots');
  world.append(wireLayer, nodeLayer, knotLayer);
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

  // ----- tidy tools: knots, focus, the tidy layout and its pan / zoom -----
  /** Reroute knots (drawing only; the graph and the answer never see them). Kept in memory for this visit of the level. */
  let knots: KnotBook = emptyKnots();
  /** After "Sắp xếp gọn" the cards sit in a free layout (board px, scale 1) seen through `view`; before it they follow the level's stretched layout. */
  let tidy = false;
  const tidyPos = new Map<string, Pt>();
  let view: FitView = { k: 1, x: 0, y: 0 };
  /** The player moved the view by hand: a resize then keeps it. */
  let viewMoved = false;
  let animRaf = 0;
  /** The card whose wires are lit (the others fade). */
  let focusId: string | null = null;
  /** A wire the player tapped (lit until they tap elsewhere). */
  let selWire: string | null = null;
  let hoverWire: string | null = null;
  let routes = new Map<string, WireRoute>();
  let wireViews: { id: string; from: string; to: string; g: SVGGElement }[] = [];
  let lastWireTap: { id: string; t: number; x: number; y: number } | null = null;
  let lastKnotTap: { id: string; t: number } | null = null;
  let wireTapTimer = 0;
  let wirePress: { id: string; pid: number; sx: number; sy: number } | null = null;
  let knotDrag: { id: string; pid: number; sx: number; sy: number; moved: boolean } | null = null;
  let swallowClick = false;

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
    const alive = new Set([...level.base.wires, ...state.wires].map((w) => w.id));
    knots = pruneKnots(knots, alive);
    if (selWire !== null && !alive.has(selWire)) selWire = null;
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
    if (tidy) return layoutTidy();
    const c0 = Math.max(MIN_CARD_SCALE, Math.min(1, bw / 700));
    const clear = opts.keepClear?.() ?? null;
    const blocked: Box[] = clear ? [{ x: clear.x, y: clear.y - world.offsetTop, w: clear.w, h: clear.h }] : [];
    const toolsAt = toolsBox();
    const natural = [...cards].map(([id, box]) => {
      const p = positions.get(id) ?? { x: 0, y: 0 };
      return { id, x: p.x * spreadX(), y: p.y * spreadY(), w: box.offsetWidth, h: box.offsetHeight };
    });
    let result = separateBoxes([], area);
    cardScale = c0;
    // Cards keep clear of the tool buttons when that still fits; on a crowded board the buttons may cover a corner instead.
    for (const keep of toolsAt ? [[...blocked, toolsAt], blocked] : [blocked]) {
      for (const c of [c0, c0 * 0.93, c0 * 0.86, c0 * 0.8, c0 * 0.72, c0 * 0.65, c0 * 0.58, c0 * 0.52, c0 * 0.46]) {
        cardScale = c;
        result = separateBoxes(natural.map((n) => ({ ...n, w: n.w * c, h: n.h * c })), area, 8, keep);
        if (result.fits) break;
      }
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

  /** A screen position in board coordinates (undoes the shrink while the board sits in the corner). */
  function boardPoint(clientX: number, clientY: number): Pt {
    const w = world.getBoundingClientRect();
    const b = board.getBoundingClientRect();
    const k = board.offsetWidth > 0 && b.width > 0 ? b.width / board.offsetWidth : 1;
    return { x: (clientX - w.left) / k, y: (clientY - w.top) / k };
  }

  /** Centre of a pin in board coordinates. */
  function dotCenter(dot: Element): Pt {
    const r = dot.getBoundingClientRect();
    return boardPoint(r.left + r.width / 2, r.top + r.height / 2);
  }

  // ---------- the tidy layout ----------

  /** Board px <-> layout space (where knots and the tidy cards live): the stretched layout scales x and y apart, the tidy one is a plain zoom. */
  function toScreen(p: Pt): Pt {
    return tidy ? { x: view.x + p.x * view.k, y: view.y + p.y * view.k } : { x: p.x * spreadX(), y: p.y * spreadY() };
  }
  function toLayout(p: Pt): Pt {
    return tidy ? { x: (p.x - view.x) / view.k, y: (p.y - view.y) / view.k } : { x: p.x / spreadX(), y: p.y / spreadY() };
  }
  const snapKnot = (p: Pt): Pt => ({ x: Math.round(p.x / KNOT_GRID) * KNOT_GRID, y: Math.round(p.y / KNOT_GRID) * KNOT_GRID });

  const sizeOf = (id: string): { w: number; h: number } => {
    const box = cards.get(id);
    return { w: box?.offsetWidth ?? 0, h: box?.offsetHeight ?? 0 };
  };

  /** Every card as a box in layout space (card scale 1). */
  function tidyRects(): (Box & { id: string })[] {
    return [...cards.keys()].map((id) => ({ id, ...tidyPosOf(id), ...sizeOf(id) }));
  }

  function tidyPosOf(id: string): Pt {
    let p = tidyPos.get(id);
    if (!p) {
      const b = boundsOf([...tidyPos].map(([k, q]) => ({ ...q, ...sizeOf(k) })));
      p = { x: b.x, y: b.y + b.h + 24 };
      tidyPos.set(id, p);
    }
    return p;
  }

  function layoutTidy(): void {
    cardScale = view.k;
    for (const [id, box] of cards) {
      const p = toScreen(tidyPosOf(id));
      placedAt.set(id, p);
      box.style.left = `${Math.round(p.x)}px`;
      box.style.top = `${Math.round(p.y)}px`;
      box.style.transformOrigin = '0 0';
      box.style.transform = `scale(${cardScale})`;
    }
  }

  /** The tool buttons (right edge, under the top bar) as a box in board coordinates; they keep their size while the board sits in the corner. */
  function toolsBox(): Box | null {
    return tools.offsetWidth > 0 ? { x: tools.offsetLeft - 6, y: tools.offsetTop - world.offsetTop - 6, w: tools.offsetWidth + 12, h: tools.offsetHeight + 12 } : null;
  }

  /** Width of the strip on the right the tidy view keeps free for the tool buttons. */
  function toolsInset(): number {
    const t = toolsBox();
    return t ? Math.max(0, area.w - t.x) : 0;
  }

  /** The corner window as a box in board coordinates. */
  function avoidBox(): Box | null {
    const c = opts.keepClear?.() ?? null;
    return c ? { x: c.x, y: c.y - world.offsetTop, w: c.w, h: c.h } : null;
  }

  /** The view that shows every card (and keeps clear of the corner window). */
  function tidyFit(): FitView {
    return fitContent(boundsOf(tidyRects()), area, avoidBox(), toolsInset());
  }

  function stopAnim(): void {
    if (animRaf) cancelAnimationFrame(animRaf);
    animRaf = 0;
  }

  /** Slides the cards and the view to their new places. Wires are drawn as plain curves while it moves, then routed. */
  function animateTidy(toPos: ReadonlyMap<string, Pt>, toView: FitView, ms: number): void {
    stopAnim();
    const fromPos = new Map(tidyPos);
    const fromView = { ...view };
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    const frame = (now: number): void => {
      const t = reduce ? 1 : Math.min(1, (now - t0) / ms);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      for (const [id, to] of toPos) {
        const f = fromPos.get(id) ?? to;
        tidyPos.set(id, { x: f.x + (to.x - f.x) * e, y: f.y + (to.y - f.y) * e });
      }
      view = { k: fromView.k + (toView.k - fromView.k) * e, x: fromView.x + (toView.x - fromView.x) * e, y: fromView.y + (toView.y - fromView.y) * e };
      layout();
      if (t < 1) {
        drawWires(true);
        animRaf = requestAnimationFrame(frame);
      } else {
        animRaf = 0;
        drawWires();
      }
    };
    animRaf = requestAnimationFrame(frame);
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
        tidyPos.delete(node.id);
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

  /** Every wire of the board (the level's locked ones and the player's) whose two pins are on screen. */
  function shownWires(): { wire: Wire; locked: boolean; out: PortEntry; inn: PortEntry; type: PortType }[] {
    const all = [...level.base.wires.map((wire) => ({ wire, locked: true })), ...state.wires.map((wire) => ({ wire, locked: false }))];
    const res: { wire: Wire; locked: boolean; out: PortEntry; inn: PortEntry; type: PortType }[] = [];
    for (const { wire, locked } of all) {
      const out = ports.get(portKey(wire.from.node, 'out', wire.from.port));
      const inn = ports.get(portKey(wire.to.node, 'in', wire.to.port));
      const type = outputType(wire);
      if (out && inn && type) res.push({ wire, locked, out, inn, type });
    }
    return res;
  }

  const pinKey = (end: PortRef): string => `${end.node}|${end.port}`;

  /** Every card as a box on screen. */
  function cardRects(): RouteCard[] {
    const out: RouteCard[] = [];
    for (const [id, box] of cards) {
      const p = placedAt.get(id);
      if (p) out.push({ id, x: p.x, y: p.y, w: box.offsetWidth * cardScale, h: box.offsetHeight * cardScale });
    }
    return out;
  }

  function wireSpec(wire: Wire, out: PortEntry, inn: PortEntry): WireSpec {
    return {
      id: wire.id,
      fromCard: wire.from.node,
      toCard: wire.to.node,
      a: dotCenter(out.dot),
      b: dotCenter(inn.dot),
      via: knotPoints(knots, wire.id).map(toScreen),
      fromKey: pinKey(wire.from),
      toKey: pinKey(wire.to),
    };
  }

  /** In the stretched layout wires stay on the visible board; the tidy layout is bigger than the screen and routes freely. */
  function routeBounds(): { bounds?: Box } {
    return tidy ? {} : { bounds: { x: 0, y: 0, w: area.w, h: area.h - 8 } };
  }

  function drawWires(fast = false): void {
    wireLayer.replaceChildren();
    energy.reset();
    wireViews = [];
    const rects = cardRects();
    const list = shownWires();
    routes = routeWires(rects, list.map((w) => wireSpec(w.wire, w.out, w.inn)), { unit: clampUnit(cardScale), fast, ...routeBounds() });
    for (const { wire, locked, out, inn, type } of list) {
      const route = routes.get(wire.id);
      if (!route) continue;
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'pz-wire');
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', `wc-wire type-${type}${locked ? ' pz-wire-locked' : ''}`);
      path.setAttribute('d', route.d);
      const hit = document.createElementNS(SVG_NS, 'path');
      hit.setAttribute('class', 'wc-wire-hit');
      hit.setAttribute('d', route.d);
      hit.dataset.wire = wire.id;
      if (locked) hit.dataset.locked = '1';
      hit.addEventListener('pointerdown', (e) => onWirePress(e, wire.id));
      g.append(path, hit);
      wireLayer.append(g);
      wireViews.push({ id: wire.id, from: wire.from.node, to: wire.to.node, g });
      if (isEnergyEnabled()) energy.addWire(wire, type, path, out.dot, inn.dot, running);
    }
    drawKnots(new Map(list.map((w) => [w.wire.id, w.type])));
    drawGhost(rects);
    applyLook();
  }

  /** The guide's dotted line from where a wire starts to where it ends; the pins are never touched. */
  function drawGhost(rects: RouteCard[]): void {
    if (!ghost || running) return;
    const out = ports.get(portKey(ghost.from.node, 'out', ghost.from.port));
    const inn = ports.get(portKey(ghost.to.node, 'in', ghost.to.port));
    const type = outputType({ id: 'ghost', from: ghost.from, to: ghost.to });
    if (!out || !inn || !type) return;
    const spec = wireSpec({ id: 'ghost', from: ghost.from, to: ghost.to }, out, inn);
    const route = routeWires(rects, [{ ...spec, via: [] }], { unit: clampUnit(cardScale), fast: false, ...routeBounds() }).get('ghost');
    if (!route) return;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', `pz-ghost-wire type-${type}`);
    path.setAttribute('d', route.d);
    wireLayer.append(path);
  }

  // ---------- focus ----------

  /** Lights the wires of the tapped card (or wire) and fades everything else. */
  function applyLook(): void {
    if (focusId !== null && !cards.has(focusId)) focusId = null;
    const focusing = !running && (focusId !== null || selWire !== null);
    board.classList.toggle('pz-focusing', focusing);
    const litWires = new Set<string>();
    const litCards = new Set<string>();
    if (focusing) {
      for (const v of wireViews) {
        if (focusId !== null ? v.from === focusId || v.to === focusId : v.id === selWire) {
          litWires.add(v.id);
          litCards.add(v.from);
          litCards.add(v.to);
        }
      }
      if (focusId !== null) litCards.add(focusId);
    }
    for (const v of wireViews) {
      v.g.classList.toggle('pz-lit', litWires.has(v.id));
      v.g.classList.toggle('pz-hover', !running && hoverWire === v.id);
    }
    for (const [id, box] of cards) box.classList.toggle('pz-faded', focusing && !litCards.has(id));
    for (const el of knotLayer.children) {
      const id = (el as SVGElement).dataset.knot ?? '';
      el.classList.toggle('pz-faded', focusing && !wiresOfKnot(knots, id).some((w) => litWires.has(w)));
    }
  }

  /** The player's own tap on a card (or away): lights that card's wires; a second tap lets go. */
  function tapFocus(id: string | null): void {
    focusId = id !== null && id !== focusId ? id : null;
    selWire = null;
    applyLook();
    userPick(id);
  }

  // ---------- knots ----------

  function drawKnots(types: ReadonlyMap<string, PortType>): void {
    knotLayer.replaceChildren();
    for (const [id, p] of Object.entries(knots.pos)) {
      const type = wiresOfKnot(knots, id)
        .map((w) => types.get(w))
        .find((t) => t !== undefined);
      if (!type) continue;
      const shared = isSharedKnot(knots, id);
      const at = toScreen(p);
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', `pz-knot type-${type}${shared ? ' shared' : ''}`);
      g.setAttribute('transform', `translate(${at.x} ${at.y})`);
      g.dataset.knot = id;
      const circle = (r: number, cls: string): SVGCircleElement => {
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('r', String(r));
        c.setAttribute('class', cls);
        return c;
      };
      g.append(circle(16, 'pz-knot-hit'), circle(shared ? 9.5 : 7.5, 'pz-knot-ring'), circle(shared ? 4 : 3, 'pz-knot-core'));
      g.addEventListener('pointerdown', (e) => onKnotDown(e, id));
      knotLayer.append(g);
    }
  }

  const sourceOf = (wireId: string): string | undefined => {
    const w = [...level.base.wires, ...state.wires].find((x) => x.id === wireId);
    return w ? pinKey(w.from) : undefined;
  };

  function onKnotDown(e: PointerEvent, id: string): void {
    if (running || e.button > 0) return;
    e.stopPropagation();
    e.preventDefault();
    const now = performance.now();
    if (lastKnotTap && lastKnotTap.id === id && now - lastKnotTap.t < DOUBLE_MS) {
      lastKnotTap = null;
      knots = removeKnot(knots, id);
      playSfx('unwire');
      swallowClick = true;
      drawWires();
      return;
    }
    lastKnotTap = { id, t: now };
    beginKnotDrag(e.pointerId, id, e.clientX, e.clientY);
  }

  function beginKnotDrag(pid: number, id: string, x: number, y: number): void {
    knotDrag = { id, pid, sx: x, sy: y, moved: false };
    try {
      board.setPointerCapture(pid);
    } catch {
      // The pointer is already gone; the drag then just never starts.
    }
  }

  /** A press on a wire: a drag from it pulls out a knot, a tap is handled by the click. */
  function onWirePress(e: PointerEvent, wireId: string): void {
    if (running || e.button > 0) return;
    wirePress = { id: wireId, pid: e.pointerId, sx: e.clientX, sy: e.clientY };
  }

  function addKnotAt(wireId: string, screenPt: Pt): string | null {
    const route = routes.get(wireId);
    if (!route) return null;
    const res = addKnot(knots, wireId, snapKnot(toLayout(screenPt)), legIndexAt(route, screenPt));
    knots = res.book;
    return res.id;
  }

  function onBoardMove(e: PointerEvent): void {
    if (wirePress && wirePress.pid === e.pointerId && Math.hypot(e.clientX - wirePress.sx, e.clientY - wirePress.sy) > TAP_SLOP) {
      const press = wirePress;
      wirePress = null;
      window.clearTimeout(wireTapTimer);
      lastWireTap = null;
      const id = addKnotAt(press.id, boardPoint(press.sx, press.sy));
      if (id) beginKnotDrag(press.pid, id, press.sx, press.sy);
    }
    if (knotDrag && knotDrag.pid === e.pointerId) {
      if (Math.hypot(e.clientX - knotDrag.sx, e.clientY - knotDrag.sy) > TAP_SLOP) knotDrag.moved = true;
      if (!knotDrag.moved) return;
      knots = moveKnot(knots, knotDrag.id, snapKnot(toLayout(boardPoint(e.clientX, e.clientY))));
      drawWires(true);
    }
  }

  function onBoardUp(e: PointerEvent): void {
    if (wirePress && wirePress.pid === e.pointerId) wirePress = null;
    if (!knotDrag || knotDrag.pid !== e.pointerId) return;
    const drag = knotDrag;
    knotDrag = null;
    selWire = null;
    if (!drag.moved) return;
    swallowClick = true;
    window.setTimeout(() => (swallowClick = false), 0);
    const here = knots.pos[drag.id];
    if (here) {
      const at = toScreen(here);
      const near = Object.keys(knots.pos).find((k) => {
        const q = knots.pos[k];
        if (k === drag.id || !q) return false;
        const s = toScreen(q);
        return Math.hypot(s.x - at.x, s.y - at.y) <= MERGE_PX;
      });
      if (near) {
        const merged = mergeKnots(knots, near, drag.id, sourceOf);
        if (merged) {
          knots = merged;
          playSfx('wire');
          toast(TIDY_TEXT.knotMerged);
        } else toast(TIDY_TEXT.knotSameSource);
      }
    }
    drawWires();
  }

  /** A tap on a wire: it lights up; a second tap close behind adds a knot; otherwise the wire is taken off (as before). */
  function wireTap(id: string, locked: boolean, e: MouseEvent): void {
    const now = performance.now();
    const prev = lastWireTap;
    if (prev && prev.id === id && now - prev.t < DOUBLE_MS && Math.hypot(prev.x - e.clientX, prev.y - e.clientY) < DOUBLE_PX) {
      window.clearTimeout(wireTapTimer);
      lastWireTap = null;
      selWire = null;
      if (addKnotAt(id, boardPoint(e.clientX, e.clientY))) {
        playSfx('wire');
        drawWires();
      }
      return;
    }
    lastWireTap = { id, t: now, x: e.clientX, y: e.clientY };
    selWire = id;
    focusId = null;
    applyLook();
    window.clearTimeout(wireTapTimer);
    wireTapTimer = window.setTimeout(() => {
      lastWireTap = null;
      if (running) return;
      if (locked) return toast(PUZZLE_TEXT.lockedWire);
      if (!state.wires.some((w) => w.id === id)) return;
      state = removeWire(state, id);
      playSfx('unwire');
      toast(PUZZLE_TEXT.removed);
      changed();
    }, DOUBLE_MS);
  }

  /** Ctrl+R: a knot in the middle of the wire the pointer is over (or the one just tapped). */
  function onKey(e: KeyboardEvent): void {
    if (running || board.inert) return;
    if (e.key === 'Escape') {
      if (focusId !== null || selWire !== null) {
        focusId = selWire = null;
        applyLook();
      }
      return;
    }
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'r') return;
    const id = hoverWire ?? selWire;
    const route = id ? routes.get(id) : undefined;
    if (!id || !route) return;
    e.preventDefault();
    window.clearTimeout(wireTapTimer);
    lastWireTap = null;
    selWire = null;
    if (addKnotAt(id, midPoint(route.pts))) {
      playSfx('wire');
      toast(TIDY_TEXT.knotAdded);
      drawWires();
    }
  }

  /** "Gom dây": every output pin with three wires or more gets one shared knot near its targets. */
  function gom(): void {
    if (running) return;
    const list = shownWires();
    const groups = fanOuts(list.map((w) => w.wire), 3);
    if (groups.size === 0) {
      toast(TIDY_TEXT.gomNone);
      return;
    }
    const rects = cardRects();
    const route = { unit: clampUnit(cardScale), fast: false, ...routeBounds() };
    let specs = list.map((w) => wireSpec(w.wire, w.out, w.inn));
    const placed: { wireIds: string[]; at: Pt }[] = [];
    for (const ids of groups.values()) {
      const at = bestGomSpot(rects, specs, ids, route);
      placed.push({ wireIds: ids, at: snapKnot(toLayout(at)) });
      specs = specs.map((sp) => (ids.includes(sp.id) ? { ...sp, via: [at] } : sp));
    }
    knots = gomKnots(knots, placed);
    playSfx('wire');
    toast(TIDY_TEXT.gomDone(placed.length));
    drawWires();
  }

  // ---------- Sắp xếp gọn ----------

  function pinOffset(node: string, dir: PortDir, port: string): Pt | undefined {
    const entry = ports.get(portKey(node, dir, port));
    const box = cards.get(node);
    if (!entry || !box) return undefined;
    return { x: dir === 'in' ? 0 : box.offsetWidth, y: box.clientTop + entry.row.offsetTop + entry.row.offsetHeight / 2 };
  }

  /** Moves every card into columns along the signal flow, animated; the view then zooms to show them all. */
  function tidyUp(): void {
    if (running || cards.size === 0) return;
    picked = null;
    closePopover();
    applyPick();
    const nodes = [...cards].map(([id, box]) => {
      const kind = box.dataset.kind ?? '';
      return { id, kind, category: getNodeDef(kind)?.category ?? 'logic', ...sizeOf(id) };
    });
    const target = arrangeLayout({
      nodes,
      wires: shownWires().map((w) => w.wire),
      pin: pinOffset,
      order: new Map([...cards.keys()].map((id) => [id, placedAt.get(id)?.y ?? 0])),
    });
    if (!tidy) {
      // Start exactly where the cards are now, so the first frame does not jump.
      tidy = true;
      view = { k: cardScale, x: 0, y: 0 };
      for (const id of cards.keys()) {
        const p = placedAt.get(id) ?? { x: 0, y: 0 };
        tidyPos.set(id, { x: p.x / cardScale, y: p.y / cardScale });
      }
    }
    knots = emptyKnots();
    focusId = selWire = null;
    viewMoved = false;
    const fit = fitContent(boundsOf(nodes.map((n) => ({ ...(target.get(n.id) ?? { x: 0, y: 0 }), w: n.w, h: n.h }))), area, avoidBox(), toolsInset());
    animateTidy(target, fit, TIDY_MS);
    toast(TIDY_TEXT.tidied);
  }

  function fitView(): void {
    if (running || !tidy) return;
    viewMoved = false;
    animateTidy(new Map(tidyPos), tidyFit(), FIT_MS);
  }

  /** Drops a card that was dragged in the tidy layout: it slides down if it landed on another card. */
  function settleTidy(id: string): void {
    const me = tidyPosOf(id);
    const others = tidyRects().filter((r) => r.id !== id);
    const res = separateBoxes([{ id, ...me, ...sizeOf(id) }], { w: 1e6, h: 1e6 }, 12, others);
    const p = res.pos.get(id);
    if (p) tidyPos.set(id, p);
  }

  /** A free spot for a new card inside the part of the tidy layout on screen (below all cards when that is full). */
  function tidyFreeSpot(size: { w: number; h: number }): { pos: Pt; inView: boolean } {
    const region = { x: -view.x / view.k, y: -view.y / view.k, w: area.w / view.k, h: area.h / view.k };
    const taken = tidyRects().map((r) => ({ x: r.x - region.x, y: r.y - region.y, w: r.w, h: r.h }));
    const clear = avoidBox();
    if (clear) taken.push({ x: (clear.x - view.x) / view.k - region.x, y: (clear.y - view.y) / view.k - region.y, w: clear.w / view.k, h: clear.h / view.k });
    const spot = tryFreeSpot(taken, size, region, 14, 12);
    if (spot) return { pos: { x: region.x + spot.x, y: region.y + spot.y }, inView: true };
    const b = boundsOf(tidyRects());
    return { pos: { x: b.x, y: b.y + b.h + 24 }, inView: false };
  }

  // ---------- tray ----------

  function renderTray(): void {
    trayEl.replaceChildren();
    const left = trayLeft(level, state);
    level.tray.forEach((piece, slot) => {
      const def = getNodeDef(piece.kind);
      const n = left[slot] ?? 0;
      const wrap = h('div', 'pz-chip-wrap');
      const chip = h('button', `pz-chip cat-${def?.category ?? 'logic'}`);
      chip.type = 'button';
      chip.disabled = n <= 0 || running;
      chip.append(h('b', '', def?.label ?? piece.kind), h('span', '', n > 0 ? PUZZLE_UI_TEXT.trayLeft(n) : PUZZLE_UI_TEXT.trayUsed));
      chip.addEventListener('click', () => addFromTray(slot));
      wrap.append(chip);
      if (def) wrap.append(createCardHelpButton(piece.kind, def.label));
      trayEl.append(wrap);
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
    let logical: Pt;
    let refit = false;
    if (tidy) {
      const free = tidyFreeSpot(est);
      logical = { x: Math.round(free.pos.x), y: Math.round(free.pos.y) };
      tidyPos.set(placed.node.id, logical);
      refit = !free.inView;
    } else {
      const spot = findFreeSpot(taken, { w: est.w * cardScale, h: est.h * cardScale }, area, 8);
      // Stored in level space so the card keeps its place when the board is resized.
      logical = { x: Math.round(spot.x / spreadX()), y: Math.round(spot.y / spreadY()) };
    }
    positions.set(placed.node.id, logical);
    state = { ...probe, placed: probe.placed.map((p) => (p === placed ? { ...p, node: { ...p.node, pos: logical } } : p)) };
    picked = null;
    closePopover();
    playSfx('pick');
    changed();
    if (refit) fitView();
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
    if (swallowClick || panZoom.wasDrag()) {
      swallowClick = false;
      return;
    }
    const t = e.target;
    if (!(t instanceof Element)) return;
    // composedPath still lists the popover when the tapped − / + button was just replaced by the refill.
    if (popover && !e.composedPath().includes(popover)) {
      closePopover();
      return;
    }
    if (t.closest('button, .wc-node-head, .pz-pop, .pz-knot')) return;
    const hit = t.closest<SVGElement>('.wc-wire-hit');
    const row = t.closest('.wc-port');
    const onRow = row ? [...ports.values()].find((p) => p.row === row) : undefined;
    const pin = onRow ?? pinNear(e.clientX, e.clientY, hit ? WIRE_REACH : PORT_REACH);
    if (pin) return tapPort(pin.end);
    if (hit?.dataset.wire) return wireTap(hit.dataset.wire, !!hit.dataset.locked, e);
    if (picked) {
      picked = null;
      applyPick();
    }
    tapFocus(t.closest<HTMLElement>('.wc-node')?.dataset.id ?? null);
  });

  // Knots: dragging a knot or a wire; hovering a wire (Ctrl+R adds a knot to it).
  board.addEventListener('pointermove', onBoardMove);
  board.addEventListener('pointerup', onBoardUp);
  board.addEventListener('pointercancel', onBoardUp);
  board.addEventListener('pointerover', (e) => {
    const id = e.target instanceof Element ? (e.target.closest<SVGElement>('.wc-wire-hit')?.dataset.wire ?? null) : null;
    if (id !== hoverWire) {
      hoverWire = id;
      applyLook();
    }
  });
  window.addEventListener('keydown', onKey);

  // The tidy layout is a free view: drag the board to move it, wheel or two fingers to zoom.
  const panZoom = attachPanZoom(board, {
    enabled: () => tidy && !running && animRaf === 0 && knotDrag === null,
    startsOn: (t) => !t.closest('button, .wc-node-head, .wc-port, .pz-param, .pz-knot, .wc-wire-hit, .pz-pop, .pz-bottom'),
    wheelBlocked: (t) => !!t.closest('.pz-bottom, .pz-pop'),
    origin: () => {
      const w = world.getBoundingClientRect();
      return { x: w.left, y: w.top };
    },
    view: () => view,
    setView: (v, done) => {
      view = v;
      viewMoved = true;
      layout();
      drawWires(!done);
    },
    minK: 0.25,
    maxK: 1.6,
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
      // The tidy layout has no edge to stop at; the stretched one keeps every card on the board.
      const x = tidy ? start.x + ev.clientX - startX : Math.min(Math.max(0, start.x + ev.clientX - startX), Math.max(0, area.w - box.offsetWidth * cardScale));
      const y = tidy ? start.y + ev.clientY - startY : Math.min(Math.max(0, start.y + ev.clientY - startY), Math.max(0, area.h - box.offsetHeight * cardScale));
      if (tidy) tidyPos.set(id, toLayout({ x, y }));
      else positions.set(id, { x: x / spreadX(), y: y / spreadY() });
      box.style.left = `${Math.round(x)}px`;
      box.style.top = `${Math.round(y)}px`;
      drawWires(true);
    };
    const end = (up: PointerEvent): void => {
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', end);
      head.removeEventListener('pointercancel', end);
      box.classList.remove('pz-dragging');
      // Dropped on another card: the layout nudges the cards apart.
      if (tidy) settleTidy(id);
      layout();
      drawWires();
      // A tap without a drag picks the card (a second tap lets go).
      if (!dragged && up.type === 'pointerup') tapFocus(id);
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

  // ---------- tools ----------

  const tools = h('div', 'pz-tools');
  const toolButton = (icon: string, text: string, title: string, onClick: () => void): HTMLButtonElement => {
    const btn = h('button', 'pz-tool');
    btn.type = 'button';
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.append(svg(icon), h('span', 'pz-tool-txt', text));
    btn.addEventListener('click', onClick);
    return btn;
  };
  const toolButtons = [
    toolButton(TOOL_ICONS.tidy, TIDY_TEXT.tidy, TIDY_TEXT.tidyHint, tidyUp),
    toolButton(TOOL_ICONS.gom, TIDY_TEXT.gom, TIDY_TEXT.gomHint, gom),
    toolButton(ICONS.shrink, TIDY_TEXT.fit, TIDY_TEXT.fitAria, fitView),
  ];
  tools.append(...toolButtons);
  // The tidy / gather / fit buttons are kept but not shown: the user did not want them on the board.

  const ro = new ResizeObserver(() => {
    layout();
    if (tidy && !viewMoved && animRaf === 0) {
      view = tidyFit();
      layout();
    }
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
      stopAnim();
      tidy = false;
      tidyPos.clear();
      knots = emptyKnots();
      focusId = selWire = null;
      changed();
    },
    setRunning(on, rtGetter) {
      running = on;
      picked = null;
      closePopover();
      stopAnim();
      knotDrag = wirePress = null;
      window.clearTimeout(wireTapTimer);
      lastWireTap = null;
      focusId = selWire = hoverWire = null;
      for (const btn of toolButtons) btn.disabled = on;
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
      focusId = pickedCard;
      selWire = null;
      applyLook();
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
      stopAnim();
      window.clearTimeout(toastTimer);
      window.clearTimeout(wireTapTimer);
      window.removeEventListener('keydown', onKey);
      panZoom.dispose();
      tools.remove();
      ro.disconnect();
    },
  };
}
