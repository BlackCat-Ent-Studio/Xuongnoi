import { wirePath } from '../../editor/graph/graph-geometry';

/**
 * Wire drawing for the puzzle board, no DOM. A wire that runs forward through free space keeps the game's cubic
 * curve; one that goes backwards, would run across a card, or passes a knot is routed on a grid (A*) so it
 * goes around the cards through the gaps. Everything is in screen px of the board; `unit` (0.4..1) shrinks the
 * grid, clearances and corner radius together with the cards.
 */

export interface Pt {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface RouteCard extends Rect {
  id: string;
}

export interface WireSpec {
  id: string;
  fromCard: string;
  toCard: string;
  /** Centre of the output pin (on the card edge). */
  a: Pt;
  /** Centre of the input pin (on the card edge). */
  b: Pt;
  /** Knots the wire passes, in order. */
  via: readonly Pt[];
  /** Wires with the same key leave the same pin (or enter the same pin): they are allowed to touch there. */
  fromKey?: string;
  toKey?: string;
}

export interface WireRoute {
  id: string;
  /** SVG path data. */
  d: string;
  /** The wire as a polyline (for hit tests, knots and counting). */
  pts: Pt[];
  /** For each point of `pts`: the leg of the wire it belongs to (0 = before the first knot). A new knot goes in at this index. */
  leg: number[];
  /** True when the grid router made this route. */
  ortho: boolean;
}

export interface RouteOptions {
  unit: number;
  /** Curves only (used while cards or knots move): cheap, may run over a card for a moment. */
  fast: boolean;
  /** Routes stay inside this box (the visible board) when it is given; otherwise they may run round the outside of all cards. */
  bounds?: Rect;
  /** Grid cell size in px; the default follows `unit`. A coarser grid routes faster (the editor's cards are big). */
  grid?: number;
}

const TURN = 5;
const OVER = 16;
const CROSS = 14;
const BZ = 6;
const MAX_STEPS = 260000;

export const clampUnit = (u: number): number => Math.min(1, Math.max(0.4, u));
const gridSize = (u: number): number => Math.max(3, Math.round(8 * u));

// ---------- small geometry ----------

export function bezierPoints(a: Pt, b: Pt, n = 36): Pt[] {
  const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
  const c1 = { x: a.x + dx, y: a.y };
  const c2 = { x: b.x - dx, y: b.y };
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
    });
  }
  return out;
}

/** Points no further than `step` apart along a polyline. */
export function resample(pts: readonly Pt[], step: number): Pt[] {
  const first = pts[0];
  if (!first) return [];
  const out: Pt[] = [first];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let j = 1; j <= n; j++) out.push({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n });
  }
  return out;
}

/** Does the polyline run through the inside of any card (two px of skin are allowed, so a pin on the edge is fine)? */
export function hitsCard(pts: readonly Pt[], cards: readonly Rect[]): boolean {
  const rs = resample(pts, 4);
  return cards.some((c) => rs.some((p) => p.x > c.x + 2 && p.x < c.x + c.w - 2 && p.y > c.y + 2 && p.y < c.y + c.h - 2));
}

/** Which cards the polyline runs through. */
export function cardsHit<T extends Rect>(pts: readonly Pt[], cards: readonly T[]): T[] {
  return cards.filter((c) => hitsCard(pts, [c]));
}

function segCross(p: Pt, p2: Pt, q: Pt, q2: Pt): boolean {
  const rx = p2.x - p.x;
  const ry = p2.y - p.y;
  const sx = q2.x - q.x;
  const sy = q2.y - q.y;
  const d = rx * sy - ry * sx;
  if (Math.abs(d) < 1e-9) return false;
  const t = ((q.x - p.x) * sy - (q.y - p.y) * sx) / d;
  const u = ((q.x - p.x) * ry - (q.y - p.y) * rx) / d;
  return t >= 0 && t < 1 && u >= 0 && u < 1;
}

export function polylinesCross(a: readonly Pt[], b: readonly Pt[]): number {
  let n = 0;
  for (let i = 1; i < a.length; i++) for (let j = 1; j < b.length; j++) if (segCross(a[i - 1]!, a[i]!, b[j - 1]!, b[j]!)) n++;
  return n;
}

export interface CrossingStats {
  wireWire: number;
  wireCard: number;
  total: number;
}

/** Places where two wires cross (wires sharing a pin are skipped) plus wires running across a card. */
export function countCrossings(specs: readonly WireSpec[], routes: ReadonlyMap<string, WireRoute>, cards: readonly Rect[]): CrossingStats {
  let ww = 0;
  let wc = 0;
  for (let i = 0; i < specs.length; i++) {
    const A = specs[i]!;
    const ra = routes.get(A.id);
    if (!ra) continue;
    for (let j = i + 1; j < specs.length; j++) {
      const B = specs[j]!;
      const rb = routes.get(B.id);
      if (!rb || (A.fromKey !== undefined && A.fromKey === B.fromKey) || (A.toKey !== undefined && A.toKey === B.toKey)) continue;
      ww += polylinesCross(ra.pts, rb.pts);
    }
    wc += cardsHit(ra.pts, cards).length;
  }
  return { wireWire: ww, wireCard: wc, total: ww + wc };
}

// ---------- path text ----------

/** Straight lines with rounded corners. */
export function roundedPath(pts: readonly Pt[], r: number): string {
  const f = (n: number): string => n.toFixed(1);
  const first = pts[0];
  if (!first) return '';
  let d = `M ${f(first.x)} ${f(first.y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const c = pts[i + 1]!;
    const l1 = Math.hypot(b.x - a.x, b.y - a.y);
    const l2 = Math.hypot(c.x - b.x, c.y - b.y);
    if (l1 < 0.01 || l2 < 0.01) continue;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const p1 = { x: b.x - ((b.x - a.x) / l1) * rr, y: b.y - ((b.y - a.y) / l1) * rr };
    const p2 = { x: b.x + ((c.x - b.x) / l2) * rr, y: b.y + ((c.y - b.y) / l2) * rr };
    d += ` L ${f(p1.x)} ${f(p1.y)} Q ${f(b.x)} ${f(b.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  const z = pts[pts.length - 1]!;
  return d + ` L ${f(z.x)} ${f(z.y)}`;
}

/** Curves joined at the knots. */
function chainPath(wp: readonly Pt[]): string {
  const first = wp[0]!;
  let d = `M ${first.x} ${first.y}`;
  for (let s = 0; s < wp.length - 1; s++) {
    const a = wp[s]!;
    const b = wp[s + 1]!;
    const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
    d += ` C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  }
  return d;
}

export function curveRoute(w: WireSpec): WireRoute {
  if (w.via.length === 0) {
    const pts = bezierPoints(w.a, w.b);
    return { id: w.id, d: wirePath(w.a.x, w.a.y, w.b.x, w.b.y), pts, leg: pts.map(() => 0), ortho: false };
  }
  const wp = [w.a, ...w.via, w.b];
  const pts: Pt[] = [];
  const leg: number[] = [];
  for (let q = 0; q < wp.length - 1; q++) {
    bezierPoints(wp[q]!, wp[q + 1]!, 28).forEach((p, j) => {
      if (q > 0 && j === 0) return;
      pts.push(p);
      leg.push(q);
    });
  }
  return { id: w.id, d: chainPath(wp), pts, leg, ortho: false };
}

// ---------- grid router ----------

class MinHeap {
  private k: number[] = [];
  private v: number[] = [];
  get size(): number {
    return this.k.length;
  }
  push(key: number, val: number): void {
    const k = this.k;
    const v = this.v;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p]! <= key) break;
      k[i] = k[p]!;
      v[i] = v[p]!;
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop(): number {
    const k = this.k;
    const v = this.v;
    const top = v[0]!;
    const lk = k.pop()!;
    const lv = v.pop()!;
    if (k.length > 0) {
      let i = 0;
      const n = k.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1]! < k[c]!) c++;
        if (k[c]! >= lk) break;
        k[i] = k[c]!;
        v[i] = v[c]!;
        i = c;
      }
      k[i] = lk;
      v[i] = lv;
    }
    return top;
  }
}

interface Cell {
  cx: number;
  cy: number;
}
interface Grid {
  g: number;
  /** Penalties are tuned for 8 px cells; this keeps them the same size in px on a finer grid. */
  ps: number;
  ox: number;
  oy: number;
  cols: number;
  rows: number;
  blocked: Uint8Array;
  h: Uint8Array;
  v: Uint8Array;
  bz: Uint8Array;
}

function makeGrid(cards: readonly Rect[], extra: readonly Pt[], g: number, clear: number, bounds?: Rect): Grid {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of cards) {
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x + c.w);
    y1 = Math.max(y1, c.y + c.h);
  }
  for (const p of extra) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  if (!Number.isFinite(x0)) {
    x0 = y0 = 0;
    x1 = y1 = 1;
  }
  if (bounds) {
    x0 = bounds.x;
    y0 = bounds.y;
    x1 = bounds.x + bounds.w;
    y1 = bounds.y + bounds.h;
  }
  const pad = bounds ? 0 : 64;
  const ox = Math.floor((x0 - pad) / g) * g;
  const oy = Math.floor((y0 - pad) / g) * g;
  const cols = Math.ceil((x1 + pad - ox) / g) + 1;
  const rows = Math.ceil((y1 + pad - oy) / g) + 1;
  const blocked = new Uint8Array(cols * rows);
  for (const c of cards) {
    const a = Math.max(0, Math.floor((c.x - clear - ox) / g));
    const b = Math.min(cols - 1, Math.ceil((c.x + c.w + clear - ox) / g));
    const d = Math.max(0, Math.floor((c.y - clear - oy) / g));
    const e = Math.min(rows - 1, Math.ceil((c.y + c.h + clear - oy) / g));
    for (let cy = d; cy <= e; cy++) {
      for (let cx = a; cx <= b; cx++) {
        const px = ox + cx * g;
        const py = oy + cy * g;
        if (px > c.x - clear && px < c.x + c.w + clear && py > c.y - clear && py < c.y + c.h + clear) blocked[cy * cols + cx] = 1;
      }
    }
  }
  return { g, ps: 8 / g, ox, oy, cols, rows, blocked, h: new Uint8Array(cols * rows), v: new Uint8Array(cols * rows), bz: new Uint8Array(cols * rows) };
}

const cellOf = (gr: Grid, p: Pt): Cell => ({
  cx: Math.min(gr.cols - 1, Math.max(0, Math.round((p.x - gr.ox) / gr.g))),
  cy: Math.min(gr.rows - 1, Math.max(0, Math.round((p.y - gr.oy) / gr.g))),
});
const cellPt = (gr: Grid, c: Cell): Pt => ({ x: gr.ox + c.cx * gr.g, y: gr.oy + c.cy * gr.g });

function markBezier(gr: Grid, pts: readonly Pt[]): void {
  for (const p of resample(pts, gr.g)) {
    const c = cellOf(gr, p);
    gr.bz[c.cy * gr.cols + c.cx] = 1;
  }
}

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

/** Corner cells of the cheapest right-angle path from cell s to cell t, or null. */
function astar(gr: Grid, s: Cell, t: Cell): Cell[] | null {
  const { cols, rows, blocked } = gr;
  const N = cols * rows;
  const best = new Float32Array(N * 4).fill(Infinity);
  const prev = new Int32Array(N * 4).fill(-1);
  const heap = new MinHeap();
  const sc = s.cy * cols + s.cx;
  const tc = t.cy * cols + t.cx;
  const hh = (cx: number, cy: number): number => Math.abs(cx - t.cx) + Math.abs(cy - t.cy);
  for (let d = 0; d < 4; d++) {
    best[sc * 4 + d] = 0;
    heap.push(hh(s.cx, s.cy), sc * 4 + d);
  }
  let goal = -1;
  let steps = 0;
  while (heap.size > 0 && steps++ < MAX_STEPS) {
    const st = heap.pop();
    const cell = st >> 2;
    const d = st & 3;
    const cx = cell % cols;
    const cy = (cell / cols) | 0;
    if (cell === tc) {
      goal = st;
      break;
    }
    const gcost = best[st]!;
    for (let nd = 0; nd < 4; nd++) {
      if (nd === ((d + 2) & 3)) continue;
      const nx = cx + DX[nd]!;
      const ny = cy + DY[nd]!;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const nc = ny * cols + nx;
      if (blocked[nc] && nc !== tc && nc !== sc) continue;
      let c = 1;
      if (nd !== d) c += TURN * gr.ps;
      if (nd % 2 === 0) {
        if (gr.h[nc]) c += OVER * gr.ps;
        if (gr.v[nc]) c += CROSS * gr.ps;
      } else {
        if (gr.v[nc]) c += OVER * gr.ps;
        if (gr.h[nc]) c += CROSS * gr.ps;
      }
      if (gr.bz[nc]) c += BZ * gr.ps;
      const ng = gcost + c;
      const ns = nc * 4 + nd;
      if (ng < best[ns]!) {
        best[ns] = ng;
        prev[ns] = st;
        heap.push(ng + hh(nx, ny), ns);
      }
    }
  }
  if (goal < 0) return null;
  const cells: Cell[] = [];
  for (let st = goal; st >= 0; st = prev[st]!) cells.push({ cx: (st >> 2) % cols, cy: ((st >> 2) / cols) | 0 });
  cells.reverse();
  const corners: Cell[] = [cells[0]!];
  for (let i = 1; i < cells.length - 1; i++) {
    const a = cells[i - 1]!;
    const b = cells[i]!;
    const c = cells[i + 1]!;
    if ((b.cx - a.cx) * (c.cy - b.cy) !== (b.cy - a.cy) * (c.cx - b.cx)) corners.push(b);
  }
  corners.push(cells[cells.length - 1]!);
  return corners;
}

function markRoute(gr: Grid, corners: readonly Cell[]): void {
  for (let i = 1; i < corners.length; i++) {
    const a = corners[i - 1]!;
    const b = corners[i]!;
    const horiz = a.cy === b.cy;
    const n = Math.max(Math.abs(b.cx - a.cx), Math.abs(b.cy - a.cy));
    for (let j = 0; j <= n; j++) {
      const cx = a.cx + Math.sign(b.cx - a.cx) * j;
      const cy = a.cy + Math.sign(b.cy - a.cy) * j;
      (horiz ? gr.h : gr.v)[cy * gr.cols + cx] = 1;
    }
  }
}

/** Corner cells to a polyline that starts exactly at S1 and ends exactly at S2 with only horizontal and vertical segments. */
function orthoPoints(gr: Grid, corners: readonly Cell[], S1: Pt, S2: Pt): Pt[] {
  const c = corners.map((q) => cellPt(gr, q));
  if (c.length === 1) c.push({ ...c[0]! });
  const p = c.map((q) => ({ ...q }));
  const n = p.length;
  if (n >= 2) {
    if (Math.abs(c[0]!.y - c[1]!.y) < 1e-6) p[1]!.y = S1.y;
    else p[1]!.x = S1.x;
    if (Math.abs(c[n - 1]!.y - c[n - 2]!.y) < 1e-6) p[n - 2]!.y = S2.y;
    else p[n - 2]!.x = S2.x;
  }
  p[0] = { x: S1.x, y: S1.y };
  p[n - 1] = { x: S2.x, y: S2.y };
  const out: Pt[] = [p[0]!];
  let lastH: boolean | null = null;
  for (let i = 1; i < p.length; i++) {
    const a = out[out.length - 1]!;
    const b = p[i]!;
    if (Math.abs(b.x - a.x) > 0.5 && Math.abs(b.y - a.y) > 0.5) {
      out.push(lastH === false ? { x: b.x, y: a.y } : lastH === true ? { x: a.x, y: b.y } : { x: b.x, y: a.y });
    }
    const q = out[out.length - 1]!;
    if (Math.abs(b.y - q.y) < 0.5 && Math.abs(b.x - q.x) >= 0.5) lastH = true;
    else if (Math.abs(b.x - q.x) < 0.5 && Math.abs(b.y - q.y) >= 0.5) lastH = false;
    out.push(b);
  }
  const res: Pt[] = [out[0]!];
  for (let i = 1; i < out.length - 1; i++) {
    const a = res[res.length - 1]!;
    const b = out[i]!;
    const c2 = out[i + 1]!;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.5) continue;
    if (Math.abs((b.x - a.x) * (c2.y - b.y) - (b.y - a.y) * (c2.x - b.x)) < 1e-6) continue;
    res.push(b);
  }
  res.push(out[out.length - 1]!);
  return res;
}

/** Routes every wire. Wires that are fine keep their curve; the others go around the cards on a grid. */
export function routeWires(cards: readonly RouteCard[], wires: readonly WireSpec[], opts: RouteOptions): Map<string, WireRoute> {
  const u = clampUnit(opts.unit);
  const out = new Map<string, WireRoute>();
  if (opts.fast) {
    for (const w of wires) out.set(w.id, curveRoute(w));
    return out;
  }
  const g = opts.grid !== undefined && opts.grid >= 3 ? Math.round(opts.grid) : gridSize(u);
  const clear = 10 * u;
  const stub = 18 * u;
  const round = 9 * u;
  const extra = wires.flatMap((w) => [w.a, w.b, ...w.via]);
  const gr = makeGrid(cards, extra, g, clear, opts.bounds);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const todo: WireSpec[] = [];
  for (const w of wires) {
    const r = curveRoute(w);
    const knotted = w.via.length > 0;
    if (knotted || w.b.x < w.a.x + 36 * u || hitsCard(r.pts, cards)) todo.push(w);
    else {
      out.set(w.id, r);
      markBezier(gr, r.pts);
    }
  }
  todo.sort((p, q) => Math.abs(p.b.x - p.a.x) + Math.abs(p.b.y - p.a.y) - (Math.abs(q.b.x - q.a.x) + Math.abs(q.b.y - q.a.y)));
  // Wires leaving the same pin for the same knot share their first stretch: route that stretch once.
  const legCache = new Map<string, Pt[] | null>();
  const leg = (s: Pt, e: Pt): Pt[] | null => {
    const key = `${s.x},${s.y}>${e.x},${e.y}`;
    if (legCache.has(key)) return legCache.get(key) ?? null;
    const sc = cellOf(gr, s);
    const ec = cellOf(gr, e);
    gr.blocked[sc.cy * gr.cols + sc.cx] = 0;
    gr.blocked[ec.cy * gr.cols + ec.cx] = 0;
    const corners = astar(gr, sc, ec);
    let pts: Pt[] | null = null;
    if (corners) {
      markRoute(gr, corners);
      pts = orthoPoints(gr, corners, s, e);
    }
    legCache.set(key, pts);
    return pts;
  };
  for (const w of todo) {
    const ca = byId.get(w.fromCard);
    const cb = byId.get(w.toCard);
    const S1 = { x: Math.max(w.a.x, ca ? ca.x + ca.w : w.a.x) + stub, y: w.a.y };
    const S2 = { x: Math.min(w.b.x, cb ? cb.x : w.b.x) - stub, y: w.b.y };
    const wps = [S1, ...w.via, S2];
    const pts: Pt[] = [w.a];
    const tag: number[] = [0];
    let failed = false;
    for (let q = 0; q < wps.length - 1 && !failed; q++) {
      const part = leg(wps[q]!, wps[q + 1]!);
      if (!part) {
        failed = true;
        break;
      }
      part.forEach((p, j) => {
        if (q > 0 && j === 0) return;
        pts.push(p);
        tag.push(q);
      });
    }
    if (failed) {
      out.set(w.id, curveRoute(w));
      continue;
    }
    pts.push(w.b);
    tag.push(wps.length - 2);
    const keep = [0];
    for (let j = 1; j < pts.length - 1; j++) {
      const a = pts[keep[keep.length - 1]!]!;
      const b = pts[j]!;
      const c = pts[j + 1]!;
      if (Math.hypot(b.x - a.x, b.y - a.y) < 0.5) continue;
      if (tag[j] === tag[j + 1] && Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) < 1e-6) continue;
      keep.push(j);
    }
    keep.push(pts.length - 1);
    const fp = keep.map((j) => pts[j]!);
    out.set(w.id, { id: w.id, d: roundedPath(fp, round), pts: fp, leg: keep.map((j) => tag[j]!), ortho: true });
  }
  return out;
}

/** Index in a wire's knot list where a new knot at `p` belongs: the leg of the route nearest to `p`. */
export function legIndexAt(route: WireRoute, p: Pt): number {
  let bestJ = 1;
  let bestD = Infinity;
  for (let j = 1; j < route.pts.length; j++) {
    const a = route.pts[j - 1]!;
    const b = route.pts[j]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    const d = Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
    if (d < bestD) {
      bestD = d;
      bestJ = j;
    }
  }
  return route.leg[bestJ] ?? 0;
}

/** The point halfway along a polyline. */
export function midPoint(pts: readonly Pt[]): Pt {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  let run = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (run <= l && l > 0) return { x: a.x + ((b.x - a.x) * run) / l, y: a.y + ((b.y - a.y) * run) / l };
    run -= l;
  }
  return pts[0] ?? { x: 0, y: 0 };
}
