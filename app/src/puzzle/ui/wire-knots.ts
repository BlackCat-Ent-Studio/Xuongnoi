import { countCrossings, routeWires, type Pt, type Rect, type RouteCard, type RouteOptions, type WireSpec } from './wire-geometry';

/**
 * Reroute knots on the puzzle board. A knot is only a place a wire is bent through; it never changes what the wire
 * does, so it lives here (keyed by wire id) and not in the graph. One knot may carry several wires that leave the
 * same output pin: the first stretch is then drawn once and the wires branch at the knot.
 * Knot positions are in the board's own layout space (not screen px), so they keep their place when the board is zoomed.
 */
export interface KnotBook {
  /** Knot id -> position. */
  readonly pos: Readonly<Record<string, Pt>>;
  /** Wire id -> knot ids the wire passes, in order. */
  readonly chain: Readonly<Record<string, readonly string[]>>;
}

export const emptyKnots = (): KnotBook => ({ pos: {}, chain: {} });

/** Knot positions a wire passes, in order. */
export function knotPoints(book: KnotBook, wireId: string): Pt[] {
  const out: Pt[] = [];
  for (const id of book.chain[wireId] ?? []) {
    const p = book.pos[id];
    if (p) out.push(p);
  }
  return out;
}

/** Wires that pass this knot. */
export function wiresOfKnot(book: KnotBook, knotId: string): string[] {
  return Object.keys(book.chain).filter((w) => book.chain[w]!.includes(knotId));
}

function freshKnotId(book: KnotBook): string {
  let i = 1;
  while (`k${i}` in book.pos) i++;
  return `k${i}`;
}

/** A new knot at `at`, inserted at position `index` of the wire's knots. */
export function addKnot(book: KnotBook, wireId: string, at: Pt, index: number): { book: KnotBook; id: string } {
  const id = freshKnotId(book);
  const list = [...(book.chain[wireId] ?? [])];
  list.splice(Math.max(0, Math.min(index, list.length)), 0, id);
  return { id, book: { pos: { ...book.pos, [id]: { x: at.x, y: at.y } }, chain: { ...book.chain, [wireId]: list } } };
}

export function moveKnot(book: KnotBook, knotId: string, to: Pt): KnotBook {
  if (!book.pos[knotId]) return book;
  return { ...book, pos: { ...book.pos, [knotId]: { x: to.x, y: to.y } } };
}

/** Takes the knot away from every wire that passes it. */
export function removeKnot(book: KnotBook, knotId: string): KnotBook {
  if (!book.pos[knotId]) return book;
  const pos = { ...book.pos };
  delete pos[knotId];
  const chain: Record<string, readonly string[]> = {};
  for (const [w, list] of Object.entries(book.chain)) {
    const rest = list.filter((k) => k !== knotId);
    if (rest.length > 0) chain[w] = rest;
  }
  return { pos, chain };
}

/** Forgets the knots of every wire that is not in `alive` (a wire was removed or replaced); knots nobody uses go too. */
export function pruneKnots(book: KnotBook, alive: ReadonlySet<string>): KnotBook {
  const chain: Record<string, readonly string[]> = {};
  const used = new Set<string>();
  let dropped = false;
  for (const [w, list] of Object.entries(book.chain)) {
    if (!alive.has(w)) {
      dropped = true;
      continue;
    }
    chain[w] = list;
    for (const k of list) used.add(k);
  }
  const pos: Record<string, Pt> = {};
  for (const [k, p] of Object.entries(book.pos)) {
    if (used.has(k)) pos[k] = p;
    else dropped = true;
  }
  return dropped ? { pos, chain } : book;
}

/**
 * Puts the wires of `dropId` through `keepId` instead (the player dropped one knot on another). Only wires that leave
 * the same pin may share a knot; `sourceOf` says which pin a wire leaves. Null when that is not allowed.
 */
export function mergeKnots(book: KnotBook, keepId: string, dropId: string, sourceOf: (wireId: string) => string | undefined): KnotBook | null {
  if (keepId === dropId || !book.pos[keepId] || !book.pos[dropId]) return null;
  const wires = [...wiresOfKnot(book, keepId), ...wiresOfKnot(book, dropId)];
  const sources = new Set(wires.map((w) => sourceOf(w)));
  if (sources.size !== 1 || sources.has(undefined)) return null;
  const chain: Record<string, readonly string[]> = {};
  for (const [w, list] of Object.entries(book.chain)) {
    if (list.includes(dropId) && list.includes(keepId)) return null;
    const swapped = list.map((k) => (k === dropId ? keepId : k));
    chain[w] = swapped;
  }
  const pos = { ...book.pos };
  delete pos[dropId];
  return { pos, chain };
}

/** Does a knot carry more than one wire? */
export const isSharedKnot = (book: KnotBook, knotId: string): boolean => wiresOfKnot(book, knotId).length > 1;

/** One group for "Gom dây": the wires of one output pin and where their shared knot goes. */
export interface GomGroup {
  wireIds: readonly string[];
  at: Pt;
}

/** Gives each group a single shared knot (replacing any knots its wires had). */
export function gomKnots(book: KnotBook, groups: readonly GomGroup[]): KnotBook {
  let next = book;
  for (const g of groups) {
    for (const w of g.wireIds) {
      const list = next.chain[w] ?? [];
      for (const k of list) if (wiresOfKnot(next, k).every((x) => g.wireIds.includes(x))) next = removeKnot(next, k);
      const chain = { ...next.chain };
      delete chain[w];
      next = { ...next, chain };
    }
    const id = freshKnotId(next);
    const chain = { ...next.chain };
    for (const w of g.wireIds) chain[w] = [id];
    next = { pos: { ...next.pos, [id]: { x: g.at.x, y: g.at.y } }, chain };
  }
  return next;
}

/** Output pins that feed at least `min` wires: pin key -> wire ids. */
export function fanOuts(wires: readonly { id: string; from: { node: string; port: string } }[], min = 3): Map<string, string[]> {
  const by = new Map<string, string[]>();
  for (const w of wires) {
    const key = `${w.from.node}|${w.from.port}`;
    const list = by.get(key);
    if (list) list.push(w.id);
    else by.set(key, [w.id]);
  }
  for (const [k, list] of by) if (list.length < min) by.delete(k);
  return by;
}

const free = (p: Pt, cards: readonly Rect[], gap: number): boolean => !cards.some((c) => p.x > c.x - gap && p.x < c.x + c.w + gap && p.y > c.y - gap && p.y < c.y + c.h + gap);

/**
 * Where the shared knot of a fan-out goes: just left of the nearest target column, level with the middle of the
 * targets, in free space. `a` is the output pin, `targets` the input pins, all in the same space as `cards`.
 */
export function gomSpot(cards: readonly Rect[], a: Pt, targets: readonly Pt[], unit = 1): Pt {
  const minX = Math.min(...targets.map((t) => t.x));
  const ys = targets.map((t) => t.y).sort((p, q) => p - q);
  const midY = ys[Math.floor(ys.length / 2)] ?? a.y;
  let x = minX - 48 * unit;
  if (x < a.x + 30 * unit) x = (a.x + minX) / 2;
  const step = 8 * unit;
  const gap = 12 * unit;
  const snap = (v: number): number => Math.round(v / step) * step;
  const want = { x: snap(x), y: snap(midY) };
  let best: Pt | null = null;
  let bestD = Infinity;
  for (let r = 0; r <= 60 && best === null; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const p = { x: want.x + dx * step, y: want.y + dy * step };
        if (p.x < a.x + 20 * unit || !free(p, cards, gap)) continue;
        const d = Math.hypot(dx, dy * 0.8);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
    }
  }
  return best ?? want;
}

/** How untidy a set of routes is: crossings count most, then the total length. */
function routeCost(specs: readonly WireSpec[], cards: readonly RouteCard[], opts: RouteOptions): number {
  const routes = routeWires(cards, specs, opts);
  const stats = countCrossings(specs, routes, cards);
  let length = 0;
  for (const r of routes.values()) for (let i = 1; i < r.pts.length; i++) length += Math.hypot(r.pts[i]!.x - r.pts[i - 1]!.x, r.pts[i]!.y - r.pts[i - 1]!.y);
  return stats.wireWire * 100 + stats.wireCard * 400 + length * 0.05;
}

/**
 * Picks the knot spot of a fan-out that leaves the neatest drawing: a few free spots between the output pin and the
 * nearest input are tried with the real router and the one with the fewest crossings (then the shortest wires) wins.
 * `specs` holds every wire with the knots it has now; `group` names the wires that will share the new knot.
 */
export function bestGomSpot(cards: readonly RouteCard[], specs: readonly WireSpec[], group: readonly string[], opts: RouteOptions): Pt {
  const members = specs.filter((s) => group.includes(s.id));
  const first = members[0];
  if (!first) return { x: 0, y: 0 };
  const unit = opts.unit;
  const a = first.a;
  const ends = members.map((m) => m.b);
  const fallback = gomSpot(cards, a, ends, unit);
  const minX = Math.min(...ends.map((t) => t.x));
  const xs: number[] = [];
  const lo = a.x + 30 * unit;
  const hi = minX - 24 * unit;
  for (let x = hi; x >= lo && xs.length < 5; x -= 28 * unit) xs.push(x);
  if (xs.length === 0) xs.push(fallback.x);
  const ys = [...new Set([a.y, fallback.y, ...ends.map((t) => t.y)])];
  const step = 8 * unit;
  const snap = (v: number): number => Math.round(v / step) * step;
  const seen = new Set<string>();
  const candidates: Pt[] = [fallback];
  for (const x of xs) {
    for (const y of ys) {
      const p = { x: snap(x), y: snap(y) };
      const key = `${p.x},${p.y}`;
      if (seen.has(key) || !free(p, cards, 12 * unit)) continue;
      seen.add(key);
      candidates.push(p);
    }
  }
  let best = fallback;
  let bestCost = Infinity;
  for (const p of candidates.slice(0, 16)) {
    const trial = specs.map((s) => (group.includes(s.id) ? { ...s, via: [p] } : s));
    const cost = routeCost(trial, cards, opts);
    if (cost < bestCost - 1e-6) {
      bestCost = cost;
      best = p;
    }
  }
  return best;
}
