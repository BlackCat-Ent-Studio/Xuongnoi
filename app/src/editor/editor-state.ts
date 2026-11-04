import { clampNoteSize, createNote, NOTE_MAX_COUNT } from '../engine/notes';
import { getNodeDef } from '../engine/registry';
import type {
  Board,
  ConnectResult,
  Graph,
  GraphNode,
  Note,
  NoteColor,
  ParamValue,
  Params,
  PortRef,
  Vec3,
  ViewMode,
} from '../engine/types';
import { addWire, removeNode, removeWire } from '../engine/wiring';
import { PASTE_OFFSET, buildClip, pasteClip, readStoredClip, writeStoredClip } from './clipboard';
import {
  cleanGroupName,
  createGroup,
  findGroup,
  groupOfNode,
  groupsOf,
  patchGroup,
  pruneGroups,
  ungroup,
  withGroups,
  type GroupFail,
} from './groups/group-model';
import { spreadOverlaps } from './graph/graph-geometry';
import { migrateBoardWireRule } from './graph/wire-rule-migration';
import { pruneGraphKnots, withKnots } from './graph/board-knots';
import type { KnotBook } from '../puzzle/ui/wire-knots';
import { createHistory } from './history';
import { nextNodeId } from './node-ids';

export { nextNodeId };

/**
 * graph: structure changed (nodes/wires). params: a param value changed. layout: node moved on canvas.
 * board: a whole new board was loaded. notes: sticky notes changed. history: undo/redo availability changed.
 * scope: the canvas entered or left a group (navigation only, never a document change).
 */
export type ChangeKind =
  | 'graph'
  | 'params'
  | 'layout'
  | 'selection'
  | 'mode'
  | 'name'
  | 'playing'
  | 'board'
  | 'notes'
  | 'history'
  | 'scope';

export type Selection = { kind: 'node' | 'wire' | 'note' | 'group'; id: string } | null;

// ---------- pure helpers ----------

/** Snap to the nearest 0.5. */
export function snapHalf(v: number): number {
  return Math.round(v * 2) / 2;
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

/** Adds a node to the member list of an existing group. */
function addMember(graph: Graph, groupId: string, nodeId: string): Graph {
  return withGroups(
    graph,
    groupsOf(graph).map((g) => (g.id === groupId ? { ...g, nodeIds: [...g.nodeIds, nodeId] } : g)),
  );
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

/** Params that may change while the game runs: numbers, colours, positions and the look. Structure never can. */
export function isLiveParam(graph: Graph, nodeId: string, paramId: string): boolean {
  const node = graph.nodes.find((n) => n.id === nodeId);
  const def = node && getNodeDef(node.kind)?.params.find((p) => p.id === paramId);
  if (!def) return false;
  return def.kind === 'number' || def.kind === 'color' || def.kind === 'vec3' || paramId === 'look';
}

// ---------- state ----------

export interface NotePatch {
  text?: string;
  color?: NoteColor;
  size?: { w: number; h: number };
}

type Move = { id: string; pos: { x: number; y: number } };

export type GroupResult = { ok: true; groupId: string } | { ok: false; reason: GroupFail | 'locked' | 'in-group' };

export interface EditorState {
  getBoard(): Board;
  getGraph(): Graph;
  getNotes(): readonly Note[];
  getMode(): ViewMode;
  getSelection(): Selection;
  /** Ids of every selected node, group and note (single selections included). */
  getMulti(): ReadonlySet<string>;
  /** Id of the group the canvas is inside, or null on the main board. */
  getScope(): string | null;
  /** Show the inside of a group (no-op for an unknown id). Clears the selection. */
  enterGroup(id: string): void;
  /** Back to the main board. */
  exitGroup(): void;
  /** Gom nhóm: replace the selected loose nodes by one named block. */
  groupSelection(): GroupResult;
  /** Bung nhóm: dissolve the selected groups, or the entered one when nothing is selected. Returns how many. */
  ungroupSelection(): number;
  renameGroup(id: string, name: string): void;
  /** `null` restores the default colour. */
  setGroupColor(id: string, color: string | null): void;
  isPlaying(): boolean;
  subscribe(fn: (kind: ChangeKind) => void): () => void;
  loadBoard(board: Board): void;
  setName(name: string): void;
  setMode(mode: ViewMode): void;
  /** "Va chạm thật" of this game. */
  getSolidBodies(): boolean;
  /** Switches "Va chạm thật" for the next play. Ignored while playing; the field is dropped when off so old files round-trip unchanged. */
  setSolidBodies(on: boolean): void;
  setPlaying(playing: boolean): void;
  select(sel: Selection): void;
  /** Shift+click: add or remove one node/note from the selection. */
  toggleSelect(id: string): void;
  /** Replace the selection with these node/note ids. */
  selectMany(ids: readonly string[]): void;
  addNode(kind: string, pos: { x: number; y: number }): string | null;
  setParam(nodeId: string, paramId: string, value: ParamValue): void;
  setNodePos(nodeId: string, pos: { x: number; y: number }): void;
  /** Move nodes, groups and/or notes in one undo step. */
  moveItems(moves: readonly Move[], opts?: { amend?: boolean }): void;
  /** Replace the wire bend points (one undo step). An empty set drops the field so boards without knots stay as they were. */
  setKnots(knots: KnotBook): void;
  /** `replace`: an occupied input drops its old wire inside the same undo step instead of failing. */
  connect(from: PortRef, to: PortRef, opts?: { replace?: boolean }): ConnectResult;
  deleteSelection(): boolean;
  addNote(pos: { x: number; y: number }): string | null;
  updateNote(id: string, patch: NotePatch): void;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): boolean;
  redo(): boolean;
  /** Copy the selection to the clipboard. Returns how many items were copied. */
  copy(): number;
  /** Paste the clipboard (offset grows with each paste). Returns how many items were added. */
  paste(): number;
  /** Copy and paste the selection in one step without touching the clipboard. */
  duplicate(): number;
}

export function createEditorState(initial: Board): EditorState {
  let board = initial;
  let selection: Selection = null;
  let multi = new Set<string>();
  let scope: string | null = null;
  let playing = false;
  let clip: Board | null = null;
  let pasteStep = 0;
  const history = createHistory<Board>();
  const listeners = new Set<(kind: ChangeKind) => void>();

  const emit = (kind: ChangeKind): void => {
    for (const fn of [...listeners]) fn(kind);
  };
  const notesOf = (): readonly Note[] => board.notes ?? [];
  const isNote = (id: string): boolean => notesOf().some((n) => n.id === id);
  const isGroup = (id: string): boolean => groupsOf(board.graph).some((g) => g.id === id);

  /** Records the current board for undo, then swaps in `next`. */
  const commit = (next: Board, kinds: readonly ChangeKind[], key?: string): void => {
    history.record(board, key);
    board = { ...next, graph: pruneGraphKnots(pruneGroups(next.graph)) };
    if (scope !== null && !findGroup(board.graph, scope)) setScope(null);
    for (const k of kinds) emit(k);
    emit('history');
  };
  /** Board with the given notes; the field is dropped when empty so old files round-trip unchanged. */
  const withNotes = (b: Board, notes: Note[]): Board => {
    const { notes: _old, ...rest } = b;
    return notes.length > 0 ? { ...rest, notes } : rest;
  };

  const setSelectionState = (sel: Selection, ids: ReadonlySet<string>): void => {
    const same =
      selection?.kind === sel?.kind &&
      selection?.id === sel?.id &&
      ids.size === multi.size &&
      [...ids].every((i) => multi.has(i));
    if (same) return;
    selection = sel;
    multi = new Set(ids);
    emit('selection');
  };
  const selectionFor = (ids: ReadonlySet<string>): Selection => {
    if (ids.size !== 1) return null;
    const id = [...ids][0] as string;
    return { kind: isNote(id) ? 'note' : isGroup(id) ? 'group' : 'node', id };
  };

  /** Switch what the canvas shows. The selection is cleared because its items may be hidden now. */
  function setScope(next: string | null): void {
    if (next === scope) return;
    scope = next;
    selection = null;
    multi = new Set();
    emit('scope');
    emit('selection');
  }

  /** Swap the whole board for an undo/redo step and tell every listener what changed. */
  const restore = (next: Board): void => {
    const prev = board;
    board = next;
    const alive = new Set([...board.graph.nodes.map((n) => n.id), ...groupsOf(board.graph).map((g) => g.id), ...notesOf().map((n) => n.id)]);
    if (scope !== null && !findGroup(board.graph, scope)) setScope(null);
    if (selection?.kind === 'wire') {
      const id = selection.id;
      if (!board.graph.wires.some((w) => w.id === id)) selection = null;
    } else {
      multi = new Set([...multi].filter((i) => alive.has(i)));
      selection = selectionFor(multi);
    }
    emit('graph');
    if (prev.mode !== board.mode) emit('mode');
    if (prev.name !== board.name) emit('name');
    if (prev.notes !== board.notes) emit('notes');
    emit('selection');
    emit('history');
  };

  /** Board with the moved positions applied, or null when nothing actually moved. */
  const applyMoves = (moves: readonly Move[]): { board: Board; notesMoved: boolean } | null => {
    const byGroup = new Map(moves.map((m) => [m.id, m.pos]));
    const groups = groupsOf(board.graph).map((g) => {
      const p = byGroup.get(g.id);
      return p && (p.x !== g.x || p.y !== g.y) ? { ...g, x: p.x, y: p.y } : g;
    });
    const groupsMoved = groups.some((g, i) => g !== groupsOf(board.graph)[i]);
    const byId = new Map(moves.map((m) => [m.id, m.pos]));
    const moved = <T extends { id: string; pos: { x: number; y: number } }>(items: readonly T[]): T[] | null => {
      let changed = false;
      const out = items.map((it) => {
        const p = byId.get(it.id);
        if (!p || (p.x === it.pos.x && p.y === it.pos.y)) return it;
        changed = true;
        return { ...it, pos: { x: p.x, y: p.y } };
      });
      return changed ? out : null;
    };
    const nodes = moved(board.graph.nodes);
    const notes = moved(notesOf());
    if (!nodes && !notes && !groupsMoved) return null;
    let next: Board = nodes ? { ...board, graph: { ...board.graph, nodes } } : board;
    if (groupsMoved) next = { ...next, graph: withGroups(next.graph, groups) };
    if (notes) next = { ...next, notes };
    return { board: next, notesMoved: notes !== null };
  };

  const insertClip = (source: Board, step: number): number => {
    const off = PASTE_OFFSET * step;
    const res = pasteClip(board.graph, notesOf(), source, { x: off, y: off }, scope);
    if (res.newIds.length === 0) return 0;
    const hasNotes = (source.notes?.length ?? 0) > 0;
    commit(withNotes({ ...board, graph: res.graph }, res.notes), hasNotes ? ['graph', 'notes'] : ['graph']);
    const ids = new Set(res.newIds);
    setSelectionState(selectionFor(ids), ids);
    return res.newIds.length;
  };

  /** `amend` folds the move into the previous undo step (e.g. the placement nudge right after an add). */
  const moveItems = (moves: readonly Move[], opts?: { amend?: boolean }): void => {
    const res = applyMoves(moves);
    if (!res) return;
    const kinds: ChangeKind[] = res.notesMoved ? ['layout', 'notes'] : ['layout'];
    if (opts?.amend) {
      board = res.board;
      for (const k of kinds) emit(k);
      emit('history');
      return;
    }
    commit(res.board, kinds);
  };

  return {
    getBoard: () => board,
    getGraph: () => board.graph,
    getNotes: notesOf,
    getMode: () => board.mode,
    getSelection: () => selection,
    getMulti: () => multi,
    getScope: () => scope,
    enterGroup(id) {
      if (isGroup(id)) setScope(id);
    },
    exitGroup() {
      setScope(null);
    },
    groupSelection() {
      if (playing) return { ok: false, reason: 'locked' };
      if (scope !== null) return { ok: false, reason: 'in-group' };
      const ids = [...multi];
      if (ids.some(isGroup)) return { ok: false, reason: 'has-group' };
      const res = createGroup(board.graph, ids.filter((i) => !isNote(i)));
      if (!res.ok) return res;
      commit({ ...board, graph: res.graph }, ['graph']);
      setSelectionState({ kind: 'group', id: res.groupId }, new Set([res.groupId]));
      return { ok: true, groupId: res.groupId };
    },
    ungroupSelection() {
      if (playing) return 0;
      const ids = [...multi].filter(isGroup);
      if (ids.length === 0 && scope !== null) ids.push(scope);
      if (ids.length === 0) return 0;
      let graph = board.graph;
      for (const id of ids) graph = ungroup(graph, id);
      const members = new Set(ids.flatMap((id) => findGroup(board.graph, id)?.nodeIds ?? []));
      scope = null;
      commit({ ...board, graph }, ['scope', 'graph']);
      setSelectionState(selectionFor(members), members);
      return ids.length;
    },
    renameGroup(id, name) {
      const clean = cleanGroupName(name);
      const g = findGroup(board.graph, id);
      if (playing || !g || !clean || clean === g.name) return;
      commit({ ...board, graph: patchGroup(board.graph, id, { name: clean }) }, ['graph'], `gname:${id}`);
    },
    setGroupColor(id, color) {
      const g = findGroup(board.graph, id);
      if (playing || !g || (color ?? undefined) === g.color) return;
      commit({ ...board, graph: patchGroup(board.graph, id, { color: color ?? undefined }) }, ['graph']);
    },
    isPlaying: () => playing,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    loadBoard(next) {
      // Boards laid out before a node grew new ports can have cards on top of each other.
      const migrated = migrateBoardWireRule(next);
      const graph = spreadOverlaps(migrated.graph);
      board = graph === migrated.graph ? migrated : { ...migrated, graph };
      selection = null;
      multi = new Set();
      scope = null;
      history.clear();
      emit('board');
      emit('history');
    },
    setName(name) {
      if (name === board.name) return;
      commit({ ...board, name }, ['name'], 'name');
    },
    setMode(mode) {
      if (mode === board.mode) return;
      commit({ ...board, mode }, ['mode']);
    },
    getSolidBodies: () => board.graph.settings?.solidBodies === true,
    setSolidBodies(on) {
      if (playing || on === (board.graph.settings?.solidBodies === true)) return;
      const { settings: old, ...rest } = board.graph;
      const { solidBodies: _was, ...others } = old ?? {};
      const settings = on ? { ...others, solidBodies: true } : others;
      commit({ ...board, graph: Object.keys(settings).length > 0 ? { ...rest, settings } : rest }, ['graph']);
    },
    setPlaying(p) {
      if (p === playing) return;
      playing = p;
      emit('playing');
      emit('history');
    },
    select(sel) {
      // A node selected from elsewhere (scene tree, issue list, game view) may live in a group the canvas is not showing.
      if (sel?.kind === 'node') {
        const home = groupOfNode(board.graph, sel.id)?.id ?? null;
        if (home !== scope) setScope(home);
      }
      setSelectionState(sel, sel && sel.kind !== 'wire' ? new Set([sel.id]) : new Set());
    },
    toggleSelect(id) {
      const base = selection?.kind === 'wire' ? new Set<string>() : new Set(multi);
      if (base.has(id)) base.delete(id);
      else base.add(id);
      setSelectionState(selectionFor(base), base);
    },
    selectMany(ids) {
      const set = new Set(ids);
      setSelectionState(selectionFor(set), set);
    },
    addNode(kind, pos) {
      if (playing) return null;
      const node = createNode(board.graph, kind, pos);
      if (!node) return null;
      const graph = { ...board.graph, nodes: [...board.graph.nodes, node] };
      commit({ ...board, graph: scope === null ? graph : addMember(graph, scope, node.id) }, ['graph']);
      setSelectionState({ kind: 'node', id: node.id }, new Set([node.id]));
      return node.id;
    },
    setParam(nodeId, paramId, value) {
      if (playing && !isLiveParam(board.graph, nodeId, paramId)) return;
      commit({ ...board, graph: withParam(board.graph, nodeId, paramId, value) }, ['params'], `p:${nodeId}:${paramId}`);
    },
    setNodePos(nodeId, pos) {
      moveItems([{ id: nodeId, pos }]);
    },
    moveItems,
    setKnots(knots) {
      if (playing) return;
      commit({ ...board, graph: withKnots(board.graph, knots) }, ['layout']);
    },
    connect(from, to, opts) {
      if (playing) return { ok: false, reason: 'unknown-node' };
      let graph = board.graph;
      if (opts?.replace) {
        const old = graph.wires.find((w) => w.to.node === to.node && w.to.port === to.port);
        if (old) graph = removeWire(graph, old.id);
      }
      const res = addWire(graph, from, to);
      if ('ok' in res) return res;
      commit({ ...board, graph: res }, ['graph']);
      if (selection?.kind === 'wire' && !res.wires.some((w) => w.id === selection?.id)) {
        selection = null;
        emit('selection');
      }
      return { ok: true };
    },
    deleteSelection() {
      if (playing) return false;
      if (selection?.kind === 'wire') {
        const next = { ...board, graph: removeWire(board.graph, selection.id) };
        selection = null;
        multi = new Set();
        commit(next, ['graph']);
        emit('selection');
        return true;
      }
      if (multi.size === 0) return false;
      let graph = board.graph;
      const doomed = new Set(multi);
      for (const g of groupsOf(graph)) if (multi.has(g.id)) for (const id of g.nodeIds) doomed.add(id);
      for (const n of board.graph.nodes) if (doomed.has(n.id)) graph = removeNode(graph, n.id);
      const keptNotes = notesOf().filter((n) => !multi.has(n.id));
      const notesChanged = keptNotes.length !== notesOf().length;
      selection = null;
      multi = new Set();
      commit(withNotes({ ...board, graph }, keptNotes), notesChanged ? ['graph', 'notes'] : ['graph']);
      emit('selection');
      return true;
    },
    addNote(pos) {
      if (playing || notesOf().length >= NOTE_MAX_COUNT) return null;
      const note = createNote(notesOf(), pos);
      commit({ ...board, notes: [...notesOf(), note] }, ['notes']);
      setSelectionState({ kind: 'note', id: note.id }, new Set([note.id]));
      return note.id;
    },
    updateNote(id, patch) {
      if (playing) return;
      const cur = notesOf().find((n) => n.id === id);
      if (!cur) return;
      const size = patch.size ? clampNoteSize(patch.size) : cur.size;
      const next: Note = {
        ...cur,
        text: patch.text ?? cur.text,
        color: patch.color ?? cur.color,
        size,
      };
      if (next.text === cur.text && next.color === cur.color && size.w === cur.size.w && size.h === cur.size.h) return;
      const notes = notesOf().map((n) => (n.id === id ? next : n));
      commit({ ...board, notes }, ['notes'], patch.text !== undefined ? `note:${id}:text` : undefined);
    },
    canUndo: () => !playing && history.canUndo(),
    canRedo: () => !playing && history.canRedo(),
    undo() {
      if (playing) return false;
      const prev = history.undo(board);
      if (!prev) return false;
      restore(prev);
      return true;
    },
    redo() {
      if (playing) return false;
      const next = history.redo(board);
      if (!next) return false;
      restore(next);
      return true;
    },
    copy() {
      const c = buildClip(board, multi);
      if (!c) return 0;
      clip = c;
      pasteStep = 0;
      writeStoredClip(c);
      return multi.size;
    },
    paste() {
      if (playing) return 0;
      const source = clip ?? readStoredClip();
      if (!source) return 0;
      clip = source;
      pasteStep += 1;
      return insertClip(source, pasteStep);
    },
    duplicate() {
      if (playing) return 0;
      const c = buildClip(board, multi);
      return c ? insertClip(c, 1) : 0;
    },
  };
}
