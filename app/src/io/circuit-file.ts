import { INSTANCE_CIRCUIT, UNWIRED_PIN, instanceValueKey, isInstance } from '../circuits/instance';
import { isBlockingIssue, validateCircuits, type CircuitIssue } from '../circuits/validate';
import type { Board, Circuit, Graph } from '../engine/types';
import { circuitsForFile } from './circuits-format';
import { CURRENT_FORMAT_VERSION } from './migrations';
import { parseBoard } from './save-format';
import { IO_TEXT } from './text-vi';

/**
 * One circuit as a file of its own (`<tên>.bangmach.json`): the circuit and every circuit it contains, written exactly as
 * they are inside a saved board. Reading goes through `parseBoard`, so a circuit file is held to the same rules as a board.
 */

export const CIRCUIT_FILE_KIND = 'xuongnoi-circuit';
const NAME_MAX = 40;

export interface CircuitFile {
  /** Id (inside the file) of the circuit the file is about. */
  root: string;
  /** The root circuit and every circuit it contains, however deep. */
  circuits: Circuit[];
}

export type CircuitFileResult = { ok: true; file: CircuitFile } | { ok: false; error: string };

const usedBy = (graph: Graph): string[] => graph.nodes.filter(isInstance).map((n) => String(n.params[INSTANCE_CIRCUIT] ?? ''));

/** The circuit and every circuit it contains (through any depth), the circuit itself first. Null for an unknown id. */
export function circuitWithContained(board: Pick<Board, 'circuits'>, circuitId: string): Circuit[] | null {
  const all = new Map((board.circuits ?? []).map((c) => [c.id, c]));
  if (!all.has(circuitId)) return null;
  const out: Circuit[] = [];
  const seen = new Set<string>();
  const walk = (id: string): void => {
    const c = all.get(id);
    if (!c || seen.has(id)) return;
    seen.add(id);
    out.push(c);
    for (const inner of usedBy(c.graph)) walk(inner);
  };
  walk(circuitId);
  return out;
}

/** The text of a circuit file for one circuit of the board; null for an unknown id. */
export function serializeCircuitFile(board: Pick<Board, 'circuits'>, circuitId: string): string | null {
  const circuits = circuitWithContained(board, circuitId);
  if (!circuits) return null;
  return JSON.stringify({ format_version: CURRENT_FORMAT_VERSION, kind: CIRCUIT_FILE_KIND, root: circuitId, circuits: circuitsForFile(circuits) }, null, 2);
}

/** Validates untrusted text into a circuit file. Never throws; errors are Vietnamese. */
export function parseCircuitFile(text: string): CircuitFileResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: IO_TEXT.badJson };
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return { ok: false, error: IO_TEXT.notCircuitFile };
  const data = json as Record<string, unknown>;
  if (data.kind !== CIRCUIT_FILE_KIND) return { ok: false, error: 'graph' in data ? IO_TEXT.boardNotCircuitFile : IO_TEXT.notCircuitFile };
  if (typeof data.root !== 'string' || !Array.isArray(data.circuits)) return { ok: false, error: IO_TEXT.notCircuitFile };
  // The circuits are read as the library of an otherwise empty board: same checks, same upgrades of old files.
  const asBoard = parseBoard(JSON.stringify({ format_version: data.format_version, name: 'bảng mạch', mode: '3d', graph: { nodes: [], wires: [] }, circuits: data.circuits }));
  if (!asBoard.ok) return asBoard;
  const circuits = asBoard.board.circuits ?? [];
  if (!circuits.some((c) => c.id === data.root)) return { ok: false, error: IO_TEXT.notCircuitFile };
  // Only what the root really contains comes in, whatever else the file may list.
  return { ok: true, file: { root: data.root, circuits: circuitWithContained({ circuits }, data.root)! } };
}

// ---------- bringing a circuit file into a board ----------

export type CircuitImportFail = 'too-deep' | 'broken';
export type CircuitImportResult =
  | {
      ok: true;
      board: Board;
      /** Id the root circuit has in the board now. */
      circuitId: string;
      /** Name it ended up with (changed when the name was taken and both are kept). */
      name: string;
      /** How many circuits it contains came in with it. */
      contained: number;
      /** `replace` only: wires on copies of the replaced circuit that no longer fit a pin and were removed. */
      dropped: number;
    }
  | { ok: false; reason: CircuitImportFail };

/** The circuit of the board that already has the name of the file's root circuit, when there is one. */
export function importClash(board: Pick<Board, 'circuits'>, file: CircuitFile): Circuit | undefined {
  const root = file.circuits.find((c) => c.id === file.root);
  return root ? (board.circuits ?? []).find((c) => c.name === root.name) : undefined;
}

function freshName(taken: Set<string>, base: string): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const tail = ` ${i}`;
    const name = `${base.slice(0, NAME_MAX - tail.length)}${tail}`;
    if (!taken.has(name)) return name;
  }
}

function freshId(taken: Set<string>): string {
  let i = taken.size + 1;
  while (taken.has(`c${i}`)) i++;
  return `c${i}`;
}

/** The circuit with every copy inside it pointed at the new ids. */
function remapped(c: Circuit, ids: ReadonlyMap<string, string>): Circuit {
  const nodes = c.graph.nodes.map((n) => (isInstance(n) ? { ...n, params: { ...n.params, [INSTANCE_CIRCUIT]: ids.get(String(n.params[INSTANCE_CIRCUIT] ?? '')) ?? '' } } : n));
  const graph: Graph = { ...c.graph, nodes };
  if (c.graph.stacks) graph.stacks = c.graph.stacks.flatMap((id) => ids.get(id) ?? []);
  return { ...c, graph };
}

/** Wires on copies of `circuit` that name a pin it does not have (or one of another direction or type than `was` had). */
function withoutLostPinWires(graph: Graph, circuit: Circuit, was: Circuit): { graph: Graph; dropped: number } {
  const copies = new Set(graph.nodes.filter((n) => isInstance(n) && n.params[INSTANCE_CIRCUIT] === circuit.id).map((n) => n.id));
  if (copies.size === 0) return { graph, dropped: 0 };
  const fits = (port: string, dir: 'in' | 'out'): boolean => {
    const now = circuit.pins.find((p) => p.id === port && p.dir === dir);
    const before = was.pins.find((p) => p.id === port && p.dir === dir);
    return now !== undefined && (before === undefined || before.type === now.type);
  };
  const wires = graph.wires.filter((w) => (!copies.has(w.from.node) || fits(w.from.port, 'out')) && (!copies.has(w.to.node) || fits(w.to.port, 'in')));
  return wires.length === graph.wires.length ? { graph, dropped: 0 } : { graph: { ...graph, wires }, dropped: graph.wires.length - wires.length };
}

/**
 * Adds the circuits of a file to the board. Every circuit of the file gets a fresh id; a name that is taken gets a number
 * behind it ("Xe AGV 2"). With `replace` (the id of a circuit of the board) the root circuit instead takes the place of that
 * circuit: it keeps the id, so every copy on the board now is a copy of the imported circuit, and wires on pins that are
 * gone are removed. The board is refused when it would nest circuits too deep.
 */
export function importCircuitFile(board: Board, file: CircuitFile, opts: { replace?: string } = {}): CircuitImportResult {
  const have = board.circuits ?? [];
  const replaced = opts.replace === undefined ? undefined : have.find((c) => c.id === opts.replace);
  const takenIds = new Set(have.map((c) => c.id));
  const takenNames = new Set(have.filter((c) => c !== replaced).map((c) => c.name));
  const ids = new Map<string, string>();
  const names = new Map<string, string>();
  for (const c of file.circuits) {
    const isRoot = c.id === file.root;
    const id = isRoot && replaced ? replaced.id : freshId(takenIds);
    takenIds.add(id);
    ids.set(c.id, id);
    const name = freshName(takenNames, c.name.slice(0, NAME_MAX) || IO_TEXT.circuitFallbackName);
    takenNames.add(name);
    names.set(c.id, name);
  }
  const incoming = file.circuits.map((c) => ({ ...remapped(structuredClone(c), ids), id: ids.get(c.id)!, name: names.get(c.id)! }));
  const root = incoming.find((c) => c.id === ids.get(file.root));
  if (!root) return { ok: false, reason: 'broken' };

  let dropped = 0;
  let graph = board.graph;
  let circuits: Circuit[];
  if (replaced) {
    const clean = (g: Graph): Graph => {
      const res = withoutLostPinWires(g, root, replaced);
      dropped += res.dropped;
      return res.graph;
    };
    graph = clean(board.graph);
    circuits = [
      ...have.map((c) => {
        if (c === replaced) return root;
        const g = clean(c.graph);
        return g === c.graph ? c : { ...c, graph: g };
      }),
      ...incoming.filter((c) => c !== root),
    ];
  } else {
    circuits = [...have, ...incoming];
  }
  let next: Board = { ...board, graph, circuits };
  const before = new Set(validateCircuits(board).map((i) => JSON.stringify(i)));
  // What a replaced circuit leaves behind elsewhere is let go, one layer per pass (a pin may pass on a pin that passes on a pin...).
  for (let pass = 0; pass <= circuits.length + 1; pass++) {
    const fresh = validateCircuits(next).filter((i) => isBlockingIssue(i) && !before.has(JSON.stringify(i)));
    if (fresh.length === 0) return { ok: true, board: next, circuitId: root.id, name: root.name, contained: incoming.length - 1, dropped };
    const fatal = fresh.find((i) => i.code !== 'bad-pin' && i.code !== 'bad-exposed' && i.code !== 'bad-value');
    if (fatal || !replaced) return { ok: false, reason: fatal?.code === 'too-deep' || fatal?.code === 'cycle' ? 'too-deep' : 'broken' };
    next = lettingGo(next, fresh);
  }
  return { ok: false, reason: 'broken' };
}

/**
 * The board with what these problems name let go: a pin that no longer leads to a fitting port is left unwired, an opened
 * setting that leads nowhere is closed, a copy's own value of the wrong shape is forgotten (the copy shows the circuit's value).
 */
function lettingGo(board: Board, issues: readonly CircuitIssue[]): Board {
  const badValue = (owner: string | undefined, g: Graph): Graph => {
    const mine = issues.filter((i) => i.code === 'bad-value' && i.circuit === owner);
    if (mine.length === 0) return g;
    return {
      ...g,
      nodes: g.nodes.map((n) => {
        const keys = mine.flatMap((i) => (i.code === 'bad-value' && i.node === n.id ? [instanceValueKey(i.exposed)] : []));
        if (keys.length === 0) return n;
        const params = { ...n.params };
        for (const k of keys) delete params[k];
        return { ...n, params };
      }),
    };
  };
  const circuits = (board.circuits ?? []).map((c) => {
    const pins = new Set(issues.flatMap((i) => (i.code === 'bad-pin' && i.circuit === c.id ? [i.pin] : [])));
    const exposed = new Set(issues.flatMap((i) => (i.code === 'bad-exposed' && i.circuit === c.id ? [i.exposed] : [])));
    return {
      ...c,
      graph: badValue(c.id, c.graph),
      pins: pins.size === 0 ? c.pins : c.pins.map((p) => (pins.has(p.id) ? { ...p, inner: { ...UNWIRED_PIN } } : p)),
      exposed: exposed.size === 0 ? c.exposed : c.exposed.filter((e) => !exposed.has(e.id)),
    };
  });
  return { ...board, graph: badValue(undefined, board.graph), circuits };
}
