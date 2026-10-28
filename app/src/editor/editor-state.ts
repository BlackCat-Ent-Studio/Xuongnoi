import { getNodeDef } from '../engine/registry';
import type {
  Board,
  ConnectResult,
  Graph,
  GraphNode,
  ParamValue,
  Params,
  PortRef,
  Vec3,
  ViewMode,
} from '../engine/types';
import { addWire, removeNode, removeWire } from '../engine/wiring';

/**
 * graph: structure changed (nodes/wires). params: a param value changed. layout: node moved on canvas.
 * board: a whole new board was loaded.
 */
export type ChangeKind = 'graph' | 'params' | 'layout' | 'selection' | 'mode' | 'name' | 'playing' | 'board';

export type Selection = { kind: 'node' | 'wire'; id: string } | null;

// ---------- pure helpers ----------

/** Snap to the nearest 0.5. */
export function snapHalf(v: number): number {
  return Math.round(v * 2) / 2;
}

export function nextNodeId(graph: Graph): string {
  let max = 0;
  for (const n of graph.nodes) {
    const m = /^n(\d+)$/.exec(n.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let i = max + 1;
  const used = new Set(graph.nodes.map((n) => n.id));
  while (used.has(`n${i}`)) i++;
  return `n${i}`;
}

function cloneParam(v: ParamValue): ParamValue {
  return typeof v === 'object' ? { ...v } : v;
}

/** Builds a node with default params, or null for an unknown kind. */
export function createNode(graph: Graph, kind: string, pos: { x: number; y: number }): GraphNode | null {
  const def = getNodeDef(kind);
  if (!def) return null;
  const params: Params = {};
  for (const p of def.params) params[p.id] = cloneParam(p.default);
  return { id: nextNodeId(graph), kind, params, pos: { x: Math.round(pos.x), y: Math.round(pos.y) } };
}

export function withParam(graph: Graph, nodeId: string, paramId: string, value: ParamValue): Graph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, [paramId]: value } } : n)),
  };
}

export function withNodePos(graph: Graph, nodeId: string, pos: { x: number; y: number }): Graph {
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, pos: { ...pos } } : n)) };
}

/** Current `position` param of a node, only for nodes that declare a vec3 `position` param. */
export function readPosition(graph: Graph, nodeId: string): Vec3 | null {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const def = getNodeDef(node.kind);
  const pd = def?.params.find((p) => p.id === 'position' && p.kind === 'vec3');
  if (!pd) return null;
  const raw = node.params.position ?? pd.default;
  if (raw && typeof raw === 'object') {
    const fin = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    return { x: fin(raw.x, 0), y: fin(raw.y, 0), z: fin(raw.z, 0) };
  }
  return { x: 0, y: 0, z: 0 };
}

/** Number of nodes whose definition is hidden in the given mode (or unknown). */
export function countUnavailable(graph: Graph, mode: ViewMode): number {
  return graph.nodes.filter((n) => {
    const def = getNodeDef(n.kind);
    return !def || (def.modes !== undefined && !def.modes.includes(mode));
  }).length;
}

// ---------- state ----------

export interface EditorState {
  getBoard(): Board;
  getGraph(): Graph;
  getMode(): ViewMode;
  getSelection(): Selection;
  isPlaying(): boolean;
  subscribe(fn: (kind: ChangeKind) => void): () => void;
  loadBoard(board: Board): void;
  setName(name: string): void;
  setMode(mode: ViewMode): void;
  setPlaying(playing: boolean): void;
  select(sel: Selection): void;
  addNode(kind: string, pos: { x: number; y: number }): string | null;
  setParam(nodeId: string, paramId: string, value: ParamValue): void;
  setNodePos(nodeId: string, pos: { x: number; y: number }): void;
  connect(from: PortRef, to: PortRef): ConnectResult;
  deleteSelection(): boolean;
}

export function createEditorState(initial: Board): EditorState {
  let board = initial;
  let selection: Selection = null;
  let playing = false;
  const listeners = new Set<(kind: ChangeKind) => void>();

  const emit = (kind: ChangeKind): void => {
    for (const fn of [...listeners]) fn(kind);
  };
  const setGraph = (graph: Graph, kind: ChangeKind): void => {
    board = { ...board, graph };
    emit(kind);
  };

  return {
    getBoard: () => board,
    getGraph: () => board.graph,
    getMode: () => board.mode,
    getSelection: () => selection,
    isPlaying: () => playing,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    loadBoard(next) {
      board = next;
      selection = null;
      emit('board');
    },
    setName(name) {
      if (name === board.name) return;
      board = { ...board, name };
      emit('name');
    },
    setMode(mode) {
      if (mode === board.mode) return;
      board = { ...board, mode };
      emit('mode');
    },
    setPlaying(p) {
      if (p === playing) return;
      playing = p;
      emit('playing');
    },
    select(sel) {
      if (selection?.kind === sel?.kind && selection?.id === sel?.id) return;
      selection = sel;
      emit('selection');
    },
    addNode(kind, pos) {
      if (playing) return null;
      const node = createNode(board.graph, kind, pos);
      if (!node) return null;
      setGraph({ ...board.graph, nodes: [...board.graph.nodes, node] }, 'graph');
      selection = { kind: 'node', id: node.id };
      emit('selection');
      return node.id;
    },
    setParam(nodeId, paramId, value) {
      if (playing) return;
      setGraph(withParam(board.graph, nodeId, paramId, value), 'params');
    },
    setNodePos(nodeId, pos) {
      setGraph(withNodePos(board.graph, nodeId, pos), 'layout');
    },
    connect(from, to) {
      if (playing) return { ok: false, reason: 'unknown-node' };
      const res = addWire(board.graph, from, to);
      if ('ok' in res) return res;
      setGraph(res, 'graph');
      return { ok: true };
    },
    deleteSelection() {
      if (playing || !selection) return false;
      const sel = selection;
      const next =
        sel.kind === 'node' ? removeNode(board.graph, sel.id) : removeWire(board.graph, sel.id);
      selection = null;
      setGraph(next, 'graph');
      emit('selection');
      return true;
    },
  };
}
