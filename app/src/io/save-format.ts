import { CONNECT_FAIL_TEXT } from '../engine/text-vi';
import { getNodeDef } from '../engine/registry';
import { canConnect } from '../engine/wiring';
import {
  VIEW_MODES,
  type Board,
  type Graph,
  type NodeGroup,
  type Note,
  type GraphNode,
  type ParamDef,
  type ParamValue,
  type Params,
  type ViewMode,
} from '../engine/types';
import { NOTE_MAX_COUNT, NOTE_MAX_TEXT, clampNoteSize, isNoteColor } from '../engine/notes';
import { GROUP_NAME_MAX, cleanGroupName, isGroupColor, withGroups } from '../editor/groups/group-model';
import { sanitizeKnots } from '../editor/graph/board-knots';
import { migrateWireRule } from '../editor/graph/wire-rule-migration';
import { registerAllNodes } from '../nodes';
import { CURRENT_FORMAT_VERSION, migrateToCurrent } from './migrations';
import { IO_TEXT } from './text-vi';

export type ParseResult = { ok: true; board: Board } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function createEmptyBoard(mode: ViewMode): Board {
  // A brand-new game starts with real collisions; older boards and the samples keep the plain rules.
  return { name: IO_TEXT.newBoardName, mode, graph: { nodes: [], wires: [], settings: { solidBodies: true, wireRule: true } } };
}

export function serializeBoard(board: Board): string {
  return JSON.stringify(
    {
      format_version: CURRENT_FORMAT_VERSION,
      name: board.name,
      mode: board.mode,
      graph: board.graph,
      ...(board.notes && board.notes.length > 0 ? { notes: board.notes } : {}),
    },
    null,
    2,
  );
}

/** Returns a clean ParamValue for the def, or undefined when the value has the wrong shape. */
function cleanParam(def: ParamDef, value: unknown): ParamValue | undefined {
  switch (def.kind) {
    case 'number':
      return isFiniteNum(value) ? value : undefined;
    case 'vec3':
      return isRecord(value) && isFiniteNum(value.x) && isFiniteNum(value.y) && isFiniteNum(value.z)
        ? { x: value.x, y: value.y, z: value.z }
        : undefined;
    default:
      return typeof value === 'string' ? value : undefined;
  }
}

function cloneDefault(v: ParamValue): ParamValue {
  return typeof v === 'object' ? { ...v } : v;
}

function parseNode(raw: unknown, index: number, seen: Set<string>): GraphNode | string {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.kind !== 'string') {
    return IO_TEXT.badNode(index);
  }
  const { id, kind } = raw;
  if (seen.has(id)) return IO_TEXT.dupNode(id);
  const def = getNodeDef(kind);
  if (!def) return IO_TEXT.unknownKind(id, kind);

  const given = raw.params === undefined ? {} : raw.params;
  if (!isRecord(given)) return IO_TEXT.badParam(id, 'params');
  const params: Params = {};
  for (const p of def.params) {
    if (!Object.prototype.hasOwnProperty.call(given, p.id)) {
      params[p.id] = cloneDefault(p.default);
      continue;
    }
    const clean = cleanParam(p, given[p.id]);
    if (clean === undefined) return IO_TEXT.badParam(id, p.id);
    params[p.id] = clean;
  }

  const pos = raw.pos;
  if (!isRecord(pos) || !isFiniteNum(pos.x) || !isFiniteNum(pos.y)) return IO_TEXT.badNode(index);
  return { id, kind, params, pos: { x: pos.x, y: pos.y } };
}

/** Validates the optional `notes` array. Returns the clean notes or a Vietnamese error. */
function parseNotes(raw: unknown): Note[] | string {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > NOTE_MAX_COUNT) return IO_TEXT.badNotes;
  const notes: Note[] = [];
  const seen = new Set<string>();
  for (const [i, n] of raw.entries()) {
    if (
      !isRecord(n) ||
      typeof n.id !== 'string' ||
      typeof n.text !== 'string' ||
      !isRecord(n.pos) ||
      !isFiniteNum(n.pos.x) ||
      !isFiniteNum(n.pos.y) ||
      !isRecord(n.size) ||
      !isFiniteNum(n.size.w) ||
      !isFiniteNum(n.size.h)
    ) {
      return IO_TEXT.badNote(i);
    }
    if (seen.has(n.id)) return IO_TEXT.dupNote(n.id);
    seen.add(n.id);
    notes.push({
      id: n.id,
      text: n.text.slice(0, NOTE_MAX_TEXT),
      color: isNoteColor(n.color) ? n.color : 'yellow',
      pos: { x: n.pos.x, y: n.pos.y },
      size: clampNoteSize({ w: n.size.w, h: n.size.h }),
    });
  }
  return notes;
}

/**
 * Reads the optional `graph.groups`. Groups are pure organisation, so bad entries are repaired instead of
 * failing the load: unknown or repeated node ids are dropped, empty or malformed groups vanish.
 */
function parseGroups(raw: unknown, nodes: readonly GraphNode[]): NodeGroup[] {
  if (!Array.isArray(raw)) return [];
  const alive = new Set(nodes.map((n) => n.id));
  const taken = new Set<string>();
  const usedIds = new Set<string>();
  const groups: NodeGroup[] = [];
  for (const g of raw) {
    if (!isRecord(g) || typeof g.id !== 'string' || usedIds.has(g.id) || !Array.isArray(g.nodeIds)) continue;
    const nodeIds: string[] = [];
    for (const id of g.nodeIds) {
      if (typeof id === 'string' && alive.has(id) && !taken.has(id)) {
        taken.add(id);
        nodeIds.push(id);
      }
    }
    if (nodeIds.length === 0) continue;
    usedIds.add(g.id);
    const name = typeof g.name === 'string' ? cleanGroupName(g.name) : '';
    const first = nodes.find((n) => n.id === nodeIds[0]);
    const group: NodeGroup = {
      id: g.id,
      name: name || `Nhóm ${groups.length + 1}`.slice(0, GROUP_NAME_MAX),
      nodeIds,
      x: isFiniteNum(g.x) ? g.x : (first?.pos.x ?? 0),
      y: isFiniteNum(g.y) ? g.y : (first?.pos.y ?? 0),
    };
    if (isGroupColor(g.color)) group.color = g.color;
    groups.push(group);
  }
  return groups;
}

/** Validates untrusted text into a Board. Never throws; errors are Vietnamese. */
export function parseBoard(text: string): ParseResult {
  registerAllNodes();

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: IO_TEXT.badJson };
  }
  if (!isRecord(json)) return { ok: false, error: IO_TEXT.notBoard };

  const migrated = migrateToCurrent(json);
  if (!migrated.ok) return migrated;
  const data = migrated.data;

  if (typeof data.name !== 'string') return { ok: false, error: IO_TEXT.badName };
  const mode = data.mode;
  if (typeof mode !== 'string' || !VIEW_MODES.includes(mode as ViewMode)) {
    return { ok: false, error: IO_TEXT.badMode };
  }
  const rawGraph = data.graph;
  if (!isRecord(rawGraph) || !Array.isArray(rawGraph.nodes) || !Array.isArray(rawGraph.wires)) {
    return { ok: false, error: IO_TEXT.badGraph };
  }

  const nodes: GraphNode[] = [];
  const seenNodes = new Set<string>();
  for (const [i, raw] of rawGraph.nodes.entries()) {
    const node = parseNode(raw, i, seenNodes);
    if (typeof node === 'string') return { ok: false, error: node };
    seenNodes.add(node.id);
    nodes.push(node);
  }

  // Add wires one by one so canConnect enforces ports, types and one wire per input.
  let graph: Graph = { nodes, wires: [] };
  const seenWires = new Set<string>();
  for (const [i, raw] of rawGraph.wires.entries()) {
    if (
      !isRecord(raw) ||
      typeof raw.id !== 'string' ||
      !isRecord(raw.from) ||
      !isRecord(raw.to) ||
      typeof raw.from.node !== 'string' ||
      typeof raw.from.port !== 'string' ||
      typeof raw.to.node !== 'string' ||
      typeof raw.to.port !== 'string'
    ) {
      return { ok: false, error: IO_TEXT.badWire(i) };
    }
    if (seenWires.has(raw.id)) return { ok: false, error: IO_TEXT.dupWire(raw.id) };
    const from = { node: raw.from.node, port: raw.from.port };
    const to = { node: raw.to.node, port: raw.to.port };
    const res = canConnect(graph, from, to);
    if (!res.ok) return { ok: false, error: IO_TEXT.wireRejected(raw.id, CONNECT_FAIL_TEXT[res.reason]) };
    seenWires.add(raw.id);
    graph = { nodes, wires: [...graph.wires, { id: raw.id, from, to }] };
  }

  graph = withGroups(graph, parseGroups(rawGraph.groups, nodes));
  // Only an explicit `true` switches a setting on; anything else reads as the old behaviour.
  const rawSettings = isRecord(rawGraph.settings) ? rawGraph.settings : {};
  const settings: Graph['settings'] = {};
  if (rawSettings.solidBodies === true) settings.solidBodies = true;
  if (rawSettings.wireRule === true) settings.wireRule = true;
  if (Object.keys(settings).length > 0) graph = { ...graph, settings };
  // A board saved before the wire rule gets its "Khi bắt đầu" wires here, on every way in (file, library, autosave, sample).
  graph = migrateWireRule(graph, mode as ViewMode);
  // Wire bend points are decoration: a bad entry is dropped, and a board without any keeps no `knots` key.
  const knots = sanitizeKnots(rawGraph.knots, seenWires);
  if (knots) graph = { ...graph, knots };

  const notes = parseNotes(data.notes);
  if (typeof notes === 'string') return { ok: false, error: notes };

  const board: Board = { name: data.name, mode: mode as ViewMode, graph };
  if (notes.length > 0) board.notes = notes;
  return { ok: true, board };
}
