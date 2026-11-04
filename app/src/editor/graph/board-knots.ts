import type { Graph, GraphKnots } from '../../engine/types';
import { emptyKnots, pruneKnots, type KnotBook } from '../../puzzle/ui/wire-knots';

/**
 * Wire bend points saved with a board. They only change how a wire is drawn, so the field is optional:
 * a board without knots has no `knots` key at all and serialises exactly as it did before knots existed.
 */

const MAX_KNOTS = 2000;
const MAX_PER_WIRE = 32;
const MAX_ID_LEN = 40;
const MAX_COORD = 1e6;
/** Knot positions are in the coordinates of the board they were made on, so inside a group they are kept apart from the main board. */
const SCOPE_SEP = '@';

/** Key of a wire in `knots.chain`: the wire id on the main board, `group@wire` inside a group. */
export const knotKey = (scope: string | null, wireId: string): string => (scope === null ? wireId : `${scope}${SCOPE_SEP}${wireId}`);

const wireOfKey = (key: string): { scope: string | null; wire: string } => {
  const at = key.indexOf(SCOPE_SEP);
  return at < 0 ? { scope: null, wire: key } : { scope: key.slice(0, at), wire: key.slice(at + 1) };
};

/** The wire id a chain key stands for. */
export const wireIdOfKnotKey = (key: string): string => wireOfKey(key).wire;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCoord = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAX_COORD;

export const knotsOf = (graph: Graph): KnotBook => graph.knots ?? emptyKnots();

const isEmpty = (book: KnotBook): boolean => Object.keys(book.pos).length === 0;

/** The graph with these knots, or without the field when there are none. */
export function withKnots(graph: Graph, knots: KnotBook): Graph {
  const { knots: _old, ...rest } = graph;
  if (isEmpty(knots)) return rest;
  const pos: GraphKnots['pos'] = {};
  for (const [id, p] of Object.entries(knots.pos)) pos[id] = { x: p.x, y: p.y };
  const chain: GraphKnots['chain'] = {};
  for (const [w, list] of Object.entries(knots.chain)) chain[w] = [...list];
  return { ...rest, knots: { pos, chain } };
}

/** Forgets knots of wires that no longer exist. Returns the same graph when nothing was dropped. */
export function pruneGraphKnots(graph: Graph): Graph {
  if (!graph.knots) return graph;
  const wires = new Set(graph.wires.map((w) => w.id));
  const groups = new Set((graph.groups ?? []).map((g) => g.id));
  const alive = new Set(Object.keys(graph.knots.chain).filter((key) => {
    const { scope, wire } = wireOfKey(key);
    return wires.has(wire) && (scope === null || groups.has(scope));
  }));
  const next = pruneKnots(graph.knots, alive);
  return next === graph.knots ? graph : withKnots(graph, next);
}

/**
 * Reads untrusted knots from a file. Anything that does not fit (unknown wire, missing knot, odd numbers) is dropped
 * quietly: knots are only decoration, so a bad entry must never stop a board from loading.
 */
export function sanitizeKnots(raw: unknown, wireIds: ReadonlySet<string>): GraphKnots | undefined {
  if (!isRecord(raw) || !isRecord(raw.pos) || !isRecord(raw.chain)) return undefined;
  const pos: GraphKnots['pos'] = {};
  let count = 0;
  for (const [id, p] of Object.entries(raw.pos)) {
    if (count >= MAX_KNOTS) break;
    if (id.length === 0 || id.length > MAX_ID_LEN || !isRecord(p) || !isCoord(p.x) || !isCoord(p.y)) continue;
    pos[id] = { x: p.x, y: p.y };
    count++;
  }
  const chain: GraphKnots['chain'] = {};
  for (const [wire, list] of Object.entries(raw.chain)) {
    if (!wireIds.has(wireOfKey(wire).wire) || !Array.isArray(list)) continue;
    const ids = list.filter((k): k is string => typeof k === 'string' && k in pos).slice(0, MAX_PER_WIRE);
    if (ids.length > 0) chain[wire] = ids;
  }
  const pruned = pruneKnots({ pos, chain }, new Set(Object.keys(chain)));
  return isEmpty(pruned) ? undefined : { pos: { ...pruned.pos }, chain: Object.fromEntries(Object.entries(pruned.chain).map(([w, l]) => [w, [...l]])) };
}
