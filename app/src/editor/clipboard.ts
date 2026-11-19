import { nextNoteId } from '../engine/notes';
import type { Board, Graph, GraphNode, Note, NodeGroup, Wire } from '../engine/types';
import { parseBoard, serializeBoard } from '../io/save-format';
import { GROUP_NAME_MAX, groupsOf, nextGroupId, withGroups } from './groups/group-model';
import { nextNodeId } from './node-ids';

export const CLIPBOARD_KEY = 'xuong-noi:clipboard';
export const PASTE_OFFSET = 30;

/**
 * Copies the chosen nodes/notes plus the wires running between two chosen nodes.
 * A chosen group brings all its members and stays a group in the clip.
 */
export function buildClip(board: Board, ids: ReadonlySet<string>): Board | null {
  const groups = groupsOf(board.graph).filter((g) => ids.has(g.id));
  const members = new Set(groups.flatMap((g) => g.nodeIds));
  const nodes = board.graph.nodes.filter((n) => ids.has(n.id) || members.has(n.id));
  const notes = (board.notes ?? []).filter((n) => ids.has(n.id));
  if (nodes.length + notes.length === 0) return null;
  const inside = new Set(nodes.map((n) => n.id));
  const wires = board.graph.wires.filter((w) => inside.has(w.from.node) && inside.has(w.to.node));
  const clip: Board = {
    name: 'clip',
    mode: board.mode,
    graph: structuredClone(withGroups({ nodes, wires }, groups)),
  };
  if (notes.length > 0) clip.notes = structuredClone(notes);
  return clip;
}

export interface PasteResult {
  graph: Graph;
  notes: Note[];
  /** Ids to select after the insert: new groups, new loose nodes and new notes (members of a new group stay hidden inside it). */
  newIds: string[];
}

/**
 * Inserts a clip into the board with fresh ids and an offset; internal wires are remapped.
 * With `intoGroup` (pasting while inside a group) every new node joins that group and clip groups are flattened away.
 */
export function pasteClip(
  graph: Graph,
  notes: readonly Note[],
  clip: Board,
  offset: { x: number; y: number },
  intoGroup: string | null = null,
): PasteResult {
  const idMap = new Map<string, string>();
  let work: Graph = graph;
  const newNodes: GraphNode[] = [];
  // A new card never takes the id of a note: the canvas tells its items apart by id.
  const noteIds = notes.map((n) => n.id);
  for (const n of clip.graph.nodes) {
    const id = nextNodeId(work, noteIds);
    idMap.set(n.id, id);
    const copy: GraphNode = {
      ...structuredClone(n),
      id,
      pos: { x: n.pos.x + offset.x, y: n.pos.y + offset.y },
    };
    newNodes.push(copy);
    work = { ...work, nodes: [...work.nodes, copy] };
  }

  const usedWires = new Set(graph.wires.map((w) => w.id));
  let wi = graph.wires.length + 1;
  const newWires: Wire[] = [];
  for (const w of clip.graph.wires) {
    const from = idMap.get(w.from.node);
    const to = idMap.get(w.to.node);
    if (!from || !to) continue;
    while (usedWires.has(`w${wi}`)) wi++;
    const id = `w${wi}`;
    usedWires.add(id);
    newWires.push({ id, from: { node: from, port: w.from.port }, to: { node: to, port: w.to.port } });
  }

  let allNotes: Note[] = [...notes];
  const newNoteIds: string[] = [];
  for (const n of clip.notes ?? []) {
    const note: Note = {
      ...structuredClone(n),
      id: nextNoteId(allNotes),
      pos: { x: n.pos.x + offset.x, y: n.pos.y + offset.y },
    };
    allNotes = [...allNotes, note];
    newNoteIds.push(note.id);
  }

  let groups: NodeGroup[] = [...groupsOf(graph)];
  const inNewGroup = new Set<string>();
  if (intoGroup) {
    groups = groups.map((g) => (g.id === intoGroup ? { ...g, nodeIds: [...g.nodeIds, ...newNodes.map((n) => n.id)] } : g));
  } else {
    for (const g of groupsOf(clip.graph)) {
      const ids = g.nodeIds.flatMap((i) => idMap.get(i) ?? []);
      if (ids.length === 0) continue;
      const id = nextGroupId(withGroups(graph, groups));
      groups.push({ ...structuredClone(g), id, name: `${g.name} (bản sao)`.slice(0, GROUP_NAME_MAX), nodeIds: ids, x: g.x + offset.x, y: g.y + offset.y });
      for (const i of ids) inNewGroup.add(i);
    }
  }
  const newGroupIds = groups.slice(groupsOf(graph).length).map((g) => g.id);
  const loose = intoGroup ? newNodes.map((n) => n.id) : newNodes.filter((n) => !inNewGroup.has(n.id)).map((n) => n.id);
  return {
    graph: withGroups({ ...graph, nodes: [...graph.nodes, ...newNodes], wires: [...graph.wires, ...newWires] }, groups),
    notes: allNotes,
    newIds: [...newGroupIds, ...loose, ...newNoteIds],
  };
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function writeStoredClip(clip: Board): void {
  try {
    getStorage()?.setItem(CLIPBOARD_KEY, serializeBoard(clip));
  } catch {
    // Storage full or blocked: the in-memory clipboard still works.
  }
}

/** Reads and validates the stored clipboard; anything corrupt is ignored. */
export function readStoredClip(): Board | null {
  try {
    const raw = getStorage()?.getItem(CLIPBOARD_KEY);
    if (!raw) return null;
    const res = parseBoard(raw);
    return res.ok ? res.board : null;
  } catch {
    return null;
  }
}
