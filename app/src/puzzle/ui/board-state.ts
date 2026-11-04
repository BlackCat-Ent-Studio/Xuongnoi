import { CONNECT_FAIL_TEXT } from '../../engine/text-vi';
import { getNodeDef } from '../../engine/registry';
import { canConnect } from '../../engine/wiring';
import type { Graph, GraphNode, NodeDef, ParamDef, ParamValue, Params, PortRef, Wire } from '../../engine/types';
import { checkPortPair, type PortDir } from '../../editor/graph/port-compat';
import { FORMERLY_ON_BY_DEFAULT } from '../../editor/graph/wire-rule-migration';
import { buildPlayGraph } from '../run-level';
import type { PuzzleAnswer, PuzzleLevel } from '../types';

/**
 * Pure state of one puzzle attempt: which tray pieces are on the board, the wires the player joined and the
 * edits to locked nodes' editable params. No DOM here, so the rules can be tested without a browser.
 */

export interface Placed {
  node: GraphNode;
  /** Index into `level.tray` the piece came from. */
  slot: number;
}

export interface BoardState {
  placed: readonly Placed[];
  /** Only wires the player joined; the level's own wires stay in `level.base`. */
  wires: readonly Wire[];
  /** Edited params of locked nodes, keyed by node id. */
  overrides: Readonly<Record<string, Params>>;
}

export interface PortEnd extends PortRef {
  dir: PortDir;
}

export const EMPTY_BOARD: BoardState = { placed: [], wires: [], overrides: {} };

export const PUZZLE_TEXT = {
  lockedWire: 'Dây này cố định, không gỡ được',
  lockedInput: 'Cổng này đã có dây cố định',
  startOnlyEnables: '"Khi bắt đầu" chỉ dùng để bật một mảnh ghép lên (cổng "Bật", "Bắt đầu"...)',
  hiddenPort: 'Cổng này không dùng trong màn này',
  joined: 'Đã nối!',
  removed: 'Đã gỡ dây',
} as const;

// ---------- tray ----------

/** Copies still in the tray for each slot of `level.tray`. */
export function trayLeft(level: PuzzleLevel, state: BoardState): number[] {
  return level.tray.map((piece, slot) => Math.max(0, piece.count - state.placed.filter((p) => p.slot === slot).length));
}

function freshId(prefix: string, used: ReadonlySet<string>): string {
  let i = 1;
  while (used.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

export function defaultParams(def: NodeDef | undefined): Params {
  const out: Params = {};
  for (const p of def?.params ?? []) out[p.id] = structuredClone(p.default);
  return out;
}

/** Puts a copy of tray slot `slot` on the board. Null when the slot is empty or unknown. */
export function placePiece(level: PuzzleLevel, state: BoardState, slot: number, pos: { x: number; y: number }): BoardState | null {
  const piece = level.tray[slot];
  if (!piece || (trayLeft(level, state)[slot] ?? 0) <= 0) return null;
  const used = new Set<string>([...level.base.nodes.map((n) => n.id), ...state.placed.map((p) => p.node.id)]);
  const node: GraphNode = {
    id: freshId('p', used),
    kind: piece.kind,
    params: { ...defaultParams(getNodeDef(piece.kind)), ...structuredClone(piece.params ?? {}) },
    pos: { x: Math.round(pos.x), y: Math.round(pos.y) },
  };
  return { ...state, placed: [...state.placed, { node, slot }] };
}

/** Takes a placed piece back to the tray, dropping every wire attached to it. */
export function removePiece(state: BoardState, nodeId: string): BoardState {
  return {
    ...state,
    placed: state.placed.filter((p) => p.node.id !== nodeId),
    wires: state.wires.filter((w) => w.from.node !== nodeId && w.to.node !== nodeId),
  };
}

// ---------- locked nodes ----------

/** Ports the player can see and wire on a locked node. Unlisted nodes show every port. */
export function shownPortsOf(level: PuzzleLevel, nodeId: string): { in: ReadonlySet<string> | null; out: ReadonlySet<string> | null } {
  const s = level.shownPorts?.[nodeId];
  if (!s) return { in: null, out: null };
  return { in: new Set(s.in ?? []), out: new Set(s.out ?? []) };
}

/**
 * Convention for level authors: a locked node listed in `shownPorts` with no ports (`{}`) is scenery (win-lose,
 * floor, flag...) and is not drawn on the board; unlisted locked nodes show all their ports.
 */
export function isSceneryNode(level: PuzzleLevel, nodeId: string): boolean {
  const s = level.shownPorts?.[nodeId];
  return !!s && (s.in?.length ?? 0) === 0 && (s.out?.length ?? 0) === 0;
}

export function isPortShown(level: PuzzleLevel, nodeId: string, port: string, dir: PortDir): boolean {
  const s = shownPortsOf(level, nodeId);
  const set = dir === 'in' ? s.in : s.out;
  return set === null || set.has(port);
}

export function isLockedNode(level: PuzzleLevel, nodeId: string): boolean {
  return level.base.nodes.some((n) => n.id === nodeId);
}

// ---------- editable params ----------

/** Param ids the player may edit on this node (a locked node by id, a placed copy by kind). */
export function editableParamIds(level: PuzzleLevel, node: GraphNode): string[] {
  const locked = isLockedNode(level, node.id);
  const ids: string[] = [];
  for (const e of level.editable ?? []) {
    const hit = locked ? e.nodeId === node.id : e.kind !== undefined && e.kind === node.kind && e.nodeId === undefined;
    if (hit && !ids.includes(e.paramId)) ids.push(e.paramId);
  }
  return ids;
}

/** Current value of a node's param as the player sees it (edits included). */
export function paramValue(state: BoardState, node: GraphNode, paramId: string): ParamValue | undefined {
  return state.overrides[node.id]?.[paramId] ?? node.params[paramId];
}

/** Snaps a typed/stepped number to the param's range and step. */
export function clampParam(def: ParamDef, value: number): number {
  let v = Number.isFinite(value) ? value : Number(def.default);
  if (def.min !== undefined) v = Math.max(def.min, v);
  if (def.max !== undefined) v = Math.min(def.max, v);
  const step = def.step ?? 1;
  const decimals = Math.min(4, (String(step).split('.')[1] ?? '').length);
  return Number(v.toFixed(decimals));
}

/** Sets an editable param. Returns the same state when the param is not editable or the value is not valid. */
export function setParam(level: PuzzleLevel, state: BoardState, nodeId: string, paramId: string, value: ParamValue): BoardState {
  const placed = state.placed.find((p) => p.node.id === nodeId);
  const node = placed?.node ?? level.base.nodes.find((n) => n.id === nodeId);
  if (!node || !editableParamIds(level, node).includes(paramId)) return state;
  const def = getNodeDef(node.kind)?.params.find((p) => p.id === paramId);
  if (!def) return state;
  let next: ParamValue;
  if (def.kind === 'number') {
    if (typeof value !== 'number') return state;
    next = clampParam(def, value);
  } else if (def.kind === 'select') {
    if (typeof value !== 'string' || !def.options?.some((o) => o.value === value)) return state;
    next = value;
  } else {
    return state;
  }
  if (placed) {
    return { ...state, placed: state.placed.map((p) => (p === placed ? { ...p, node: { ...p.node, params: { ...p.node.params, [paramId]: next } } } : p)) };
  }
  return { ...state, overrides: { ...state.overrides, [nodeId]: { ...state.overrides[nodeId], [paramId]: next } } };
}

// ---------- the graph that runs ----------

export function toAnswer(state: BoardState): PuzzleAnswer {
  return { nodes: state.placed.map((p) => p.node), wires: [...state.wires] };
}

/** The level with the player's param edits on locked nodes applied. */
export function effectiveLevel(level: PuzzleLevel, state: BoardState): PuzzleLevel {
  if (Object.keys(state.overrides).length === 0) return level;
  const nodes = level.base.nodes.map((n) => {
    const o = state.overrides[n.id];
    return o ? { ...n, params: { ...n.params, ...o } } : n;
  });
  return { ...level, base: { ...level.base, nodes } };
}

/** Locked part + what the player added, ready for the preview and for the run. */
export function graphOf(level: PuzzleLevel, state: BoardState): Graph {
  return buildPlayGraph(effectiveLevel(level, state), toAnswer(state));
}

// ---------- wiring ----------

export type ConnectOutcome = { ok: true; state: BoardState } | { ok: false; message: string };

const endRef = (e: PortEnd): PortRef => ({ node: e.node, port: e.port });
const sameEnd = (a: PortEnd, b: PortEnd): boolean => a.node === b.node && a.port === b.port && a.dir === b.dir;

function isBaseInput(level: PuzzleLevel, to: PortRef): boolean {
  return level.base.wires.some((w) => w.to.node === to.node && w.to.port === to.port);
}

/**
 * "Khi bắt đầu" is the signal that switches a piece on from the first moment. As a constant "true" for the logic of a level
 * (a door, a memory switch) it would skip the puzzle, so a puzzle board lets it reach only the inputs that switch a piece on.
 */
export function startMayJoin(graph: Graph, from: PortRef, to: PortRef): boolean {
  if (graph.nodes.find((n) => n.id === from.node)?.kind !== 'on-start') return true;
  const kind = graph.nodes.find((n) => n.id === to.node)?.kind;
  return FORMERLY_ON_BY_DEFAULT.some((r) => r.kind === kind && r.port === to.port);
}

/** Can the picked port be joined to this one? Used for the pulsing hints and for the join itself. */
export function checkJoin(level: PuzzleLevel, state: BoardState, a: PortEnd, b: PortEnd): { ok: true } | { ok: false; message: string } {
  if (sameEnd(a, b)) return { ok: false, message: '' };
  for (const e of [a, b]) {
    if (!isPortShown(level, e.node, e.port, e.dir)) return { ok: false, message: PUZZLE_TEXT.hiddenPort };
  }
  const to = a.dir === 'in' ? a : b;
  if (a.dir !== b.dir && isBaseInput(level, to)) return { ok: false, message: PUZZLE_TEXT.lockedInput };
  const graph = graphOf(level, state);
  const [from, into] = a.dir === 'out' ? [a, b] : [b, a];
  if (a.dir !== b.dir && !startMayJoin(graph, endRef(from), endRef(into))) return { ok: false, message: PUZZLE_TEXT.startOnlyEnables };
  const res = checkPortPair(graph, endRef(a), a.dir, endRef(b), b.dir);
  return res.ok ? { ok: true } : res;
}

/** Joins an output to an input (taps in either order). A player wire already on that input is replaced. */
export function connect(level: PuzzleLevel, state: BoardState, a: PortEnd, b: PortEnd): ConnectOutcome {
  const check = checkJoin(level, state, a, b);
  if (!check.ok) return check;
  const [from, to] = a.dir === 'out' ? [a, b] : [b, a];
  const kept = state.wires.filter((w) => !(w.to.node === to.node && w.to.port === to.port));
  const base: BoardState = { ...state, wires: kept };
  const graph = graphOf(level, base);
  const res = canConnect(graph, endRef(from), endRef(to));
  if (!res.ok) return { ok: false, message: CONNECT_FAIL_TEXT[res.reason] };
  const used = new Set<string>([...level.base.wires.map((w) => w.id), ...state.wires.map((w) => w.id)]);
  const wire: Wire = { id: freshId('pw', used), from: endRef(from), to: endRef(to) };
  return { ok: true, state: { ...base, wires: [...kept, wire] } };
}

/** Removes one of the player's wires. Locked wires are not in the state, so they can never be removed here. */
export function removeWire(state: BoardState, wireId: string): BoardState {
  return { ...state, wires: state.wires.filter((w) => w.id !== wireId) };
}

// ---------- placement ----------

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box, gap: number): boolean => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;

/**
 * First spot (scanning rows left to right, top to bottom) where a card of `size` fits inside `area`
 * without touching `taken`. Falls back to a cascade offset when the board is full.
 */
export function findFreeSpot(taken: readonly Box[], size: { w: number; h: number }, area: { w: number; h: number }, gap = 14, step = 20): { x: number; y: number } {
  const spot = tryFreeSpot(taken, size, area, gap, step);
  if (spot) return spot;
  const n = taken.length % 6;
  return { x: Math.max(0, Math.min(area.w - size.w, 40 + n * 28)), y: Math.max(0, Math.min(area.h - size.h, 40 + n * 28)) };
}

/** Same scan as findFreeSpot, but null when nothing fits. */
export function tryFreeSpot(taken: readonly Box[], size: { w: number; h: number }, area: { w: number; h: number }, gap = 14, step = 20): { x: number; y: number } | null {
  for (let y = gap; y + size.h <= area.h - gap; y += step) {
    for (let x = gap; x + size.w <= area.w - gap; x += step) {
      const box = { x, y, w: size.w, h: size.h };
      if (!taken.some((t) => overlaps(box, t, gap))) return { x, y };
    }
  }
  return null;
}

export interface Item extends Box {
  id: string;
}

/**
 * Keeps every card inside `area` and apart from the others. Cards are visited top to bottom; one that lands on
 * an earlier card slides down below it, and when that leaves the area it takes the first free spot instead.
 * `fits` is false when some card found no room (the caller then tries smaller cards). `blocked` are areas no card may touch.
 */
export function separateBoxes(items: readonly Item[], area: { w: number; h: number }, gap = 8, blocked: readonly Box[] = []): { pos: Map<string, { x: number; y: number }>; fits: boolean } {
  const pos = new Map<string, { x: number; y: number }>();
  const placed: Box[] = [...blocked];
  let fits = true;
  const order = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const it of order) {
    let x = Math.max(0, Math.min(it.x, area.w - it.w));
    let y = Math.max(0, Math.min(it.y, area.h - it.h));
    for (let guard = 0; guard < 40; guard++) {
      const hit = placed.find((p) => overlaps({ x, y, w: it.w, h: it.h }, p, gap));
      if (!hit) break;
      y = hit.y + hit.h + gap;
    }
    if (y + it.h > area.h || placed.some((p) => overlaps({ x, y, w: it.w, h: it.h }, p, gap))) {
      const spot = tryFreeSpot(placed, { w: it.w, h: it.h }, area, gap, 8);
      if (spot) ({ x, y } = spot);
      else fits = false;
    }
    pos.set(it.id, { x, y });
    placed.push({ x, y, w: it.w, h: it.h });
  }
  return { pos, fits };
}
