import { polylinesCross, type Pt, type Rect } from './wire-geometry';

/**
 * "Sắp xếp gọn": puts the cards in columns from left to right along the way the signal flows (objects, then
 * sensors, then logic / maths / movement, then actions). No DOM: sizes and pin heights come from the caller.
 */

export interface ArrangeNode {
  id: string;
  kind: string;
  /** Category of the kind (used when the kind has no role of its own). */
  category: string;
  w: number;
  h: number;
}

export interface ArrangeWire {
  id: string;
  from: { node: string; port: string };
  to: { node: string; port: string };
}

export interface ArrangeInput {
  nodes: readonly ArrangeNode[];
  wires: readonly ArrangeWire[];
  /** Centre of a pin relative to its card's top-left corner. */
  pin: (node: string, dir: 'in' | 'out', port: string) => Pt | undefined;
  /** Where the cards are now (only their top-to-bottom order is used, to keep the result stable). */
  order: ReadonlyMap<string, number>;
}

/** Role of each kind from left to right. Kinds not listed fall back on their category. */
const KIND_STAGE: Readonly<Record<string, number>> = {
  character: 0,
  block: 0,
  item: 0,
  'nearest-item': 1,
  'color-sensor': 1,
  'next-free-slot': 1,
  'route-follow': 1,
  'ahead-sensor': 1,
  'vision-sensor': 1,
  'speed-sensor': 1,
  'zone-sensor': 1,
  touch: 1,
  and: 2,
  or: 2,
  not: 2,
  'go-to': 3,
  math: 3.5,
  carry: 4,
};
const CATEGORY_STAGE: Readonly<Record<string, number>> = { object: 0, input: 1, logic: 2, brain: 3, math: 3.5, action: 4, output: 4.5 };

export const stageOf = (n: { kind: string; category: string }): number => KIND_STAGE[n.kind] ?? CATEGORY_STAGE[n.category] ?? 2;

const MARGIN = 24;
const GAP_Y = 20;
const GAP_X_MIN = 78;
const GAP_X_MAX = 150;
const TARGET_W = 1000;
const MAX_PERMUTE = 6;

function permutations<T>(arr: readonly T[]): T[][] {
  if (arr.length <= 1) return [arr.slice()];
  const out: T[][] = [];
  arr.forEach((x, i) => {
    for (const r of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([x, ...r]);
  });
  return out;
}

/** New top-left corner of every card, in board px at card scale 1. No two cards overlap and wires run left to right. */
export function arrangeLayout(input: ArrangeInput): Map<string, Pt> {
  const { nodes, wires } = input;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const stage = (id: string): number => {
    const n = byId.get(id);
    return n ? stageOf(n) : 2;
  };
  const fwd = wires.filter((w) => byId.has(w.from.node) && byId.has(w.to.node) && stage(w.from.node) < stage(w.to.node));
  const layer = new Map(nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const w of fwd) {
      const want = (layer.get(w.from.node) ?? 0) + 1;
      if ((layer.get(w.to.node) ?? 0) < want) {
        layer.set(w.to.node, want);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const nc = Math.max(0, ...layer.values()) + 1;
  const cols: string[][] = Array.from({ length: nc }, () => []);
  for (const n of [...nodes].sort((a, b) => (input.order.get(a.id) ?? 0) - (input.order.get(b.id) ?? 0))) cols[layer.get(n.id) ?? 0]!.push(n.id);

  const place = (order: readonly (readonly string[])[]): Map<string, Pt> => {
    const widths = order.map((col) => Math.max(0, ...col.map((id) => byId.get(id)!.w)));
    const sumW = widths.reduce((a, b) => a + b, 0);
    const gapX = nc > 1 ? Math.min(GAP_X_MAX, Math.max(GAP_X_MIN, (TARGET_W - 2 * MARGIN - sumW) / (nc - 1))) : 0;
    const pos = new Map<string, Pt>();
    const cy = new Map<string, number>();
    let x = MARGIN;
    order.forEach((col, ci) => {
      let bottom = MARGIN - GAP_Y;
      for (const id of col) {
        const h = byId.get(id)!.h;
        const srcs = fwd.filter((w) => w.to.node === id && cy.has(w.from.node)).map((w) => cy.get(w.from.node)!);
        const ideal = srcs.length > 0 ? srcs.reduce((a, b) => a + b, 0) / srcs.length - h / 2 : MARGIN;
        const top = Math.max(ideal, bottom + GAP_Y, MARGIN);
        pos.set(id, { x, y: top });
        cy.set(id, top + h / 2);
        bottom = top + h;
      }
      x += widths[ci]! + gapX;
    });
    return pos;
  };

  const cost = (order: readonly (readonly string[])[]): number => {
    const pos = place(order);
    const segs: { a: Pt; b: Pt; f: string; t: string }[] = [];
    for (const w of fwd) {
      const p1 = input.pin(w.from.node, 'out', w.from.port);
      const p2 = input.pin(w.to.node, 'in', w.to.port);
      const o1 = pos.get(w.from.node);
      const o2 = pos.get(w.to.node);
      if (!p1 || !p2 || !o1 || !o2) continue;
      segs.push({ a: { x: o1.x + p1.x, y: o1.y + p1.y }, b: { x: o2.x + p2.x, y: o2.y + p2.y }, f: `${w.from.node}|${w.from.port}`, t: `${w.to.node}|${w.to.port}` });
    }
    let crossings = 0;
    let dy = 0;
    for (let i = 0; i < segs.length; i++) {
      const A = segs[i]!;
      dy += Math.abs(A.a.y - A.b.y);
      for (let j = i + 1; j < segs.length; j++) {
        const B = segs[j]!;
        if (A.f !== B.f && A.t !== B.t && polylinesCross([A.a, A.b], [B.a, B.b]) > 0 && polylinesCross([B.a, B.b], [A.a, A.b]) > 0) crossings++;
      }
    }
    return crossings * 1000 + dy * 0.2;
  };

  // Barycentre sweeps give a good first order; then every order of each small column is tried.
  const indexIn = (id: string): number => cols[layer.get(id) ?? 0]!.indexOf(id);
  for (let sweep = 0; sweep < 2; sweep++) {
    for (let c = 1; c < nc; c++) {
      cols[c] = cols[c]!
        .map((id, i) => {
          const ins = fwd.filter((w) => w.to.node === id).map((w) => indexIn(w.from.node));
          return { id, k: ins.length > 0 ? ins.reduce((a, b) => a + b, 0) / ins.length : i, i };
        })
        .sort((a, b) => a.k - b.k || a.i - b.i)
        .map((x) => x.id);
    }
  }
  for (let round = 0; round < 3; round++) {
    for (let c = 0; c < nc; c++) {
      const col = cols[c]!;
      if (col.length < 2 || col.length > MAX_PERMUTE) continue;
      let bestOrder = col;
      let bestCost = cost(cols);
      for (const perm of permutations(col)) {
        cols[c] = perm;
        const k = cost(cols);
        if (k < bestCost - 1e-6) {
          bestCost = k;
          bestOrder = perm;
        }
      }
      cols[c] = bestOrder;
    }
  }
  return place(cols);
}

/** Box around a set of cards. */
export function boundsOf(boxes: readonly Rect[]): Rect {
  if (boxes.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export interface FitView {
  k: number;
  x: number;
  y: number;
}

/**
 * Zoom and pan that show `content` (board px) inside `area` (screen px) with `pad` around it. `avoid` is a screen
 * rectangle (the corner window) that the content must not run under: the content is fitted either left of it or above it,
 * whichever leaves the bigger zoom. `rightInset` keeps a strip on the right free. Zoom stays between `minK` and `maxK`.
 */
export function fitContent(content: Rect, area: { w: number; h: number }, avoid: Rect | null, rightInset = 0, pad = 10, minK = 0.3, maxK = 1): FitView {
  const full = { w: Math.max(40, area.w - rightInset), h: area.h };
  const tries: { w: number; h: number }[] = [full];
  if (avoid && avoid.w > 0 && avoid.h > 0) {
    const nearBottom = avoid.y + avoid.h >= area.h - 40;
    const nearRight = avoid.x + avoid.w >= area.w - 40;
    if (nearRight && nearBottom) {
      tries[0] = { w: Math.max(40, Math.min(full.w, avoid.x)), h: area.h };
      tries.push({ w: full.w, h: Math.max(40, avoid.y) });
    }
  }
  let best: FitView | null = null;
  let bestRaw = -Infinity;
  for (const t of tries) {
    const raw = Math.min((t.w - 2 * pad) / Math.max(1, content.w), (t.h - 2 * pad) / Math.max(1, content.h));
    if (raw > bestRaw + 1e-9) {
      bestRaw = raw;
      const k = Math.min(maxK, Math.max(minK, raw));
      best = { k, x: pad + Math.max(0, (t.w - 2 * pad - content.w * k) / 2) - content.x * k, y: pad + Math.max(0, (t.h - 2 * pad - content.h * k) / 2) - content.y * k };
    }
  }
  return best ?? { k: 1, x: pad, y: pad };
}
