import { beforeAll, describe, expect, it } from 'vitest';
import { getNodeDef } from '../../src/engine/registry';
import { registerAllNodes } from '../../src/nodes';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import type { PuzzleLevel } from '../../src/puzzle/types';
import { arrangeLayout, boundsOf, fitContent, stageOf } from '../../src/puzzle/ui/board-arrange';
import { isSceneryNode, isPortShown } from '../../src/puzzle/ui/board-state';
import {
  addKnot,
  bestGomSpot,
  emptyKnots,
  fanOuts,
  gomKnots,
  gomSpot,
  isSharedKnot,
  knotPoints,
  mergeKnots,
  moveKnot,
  pruneKnots,
  removeKnot,
  wiresOfKnot,
} from '../../src/puzzle/ui/wire-knots';
import {
  cardsHit,
  countCrossings,
  hitsCard,
  legIndexAt,
  midPoint,
  routeWires,
  type Pt,
  type RouteCard,
  type WireSpec,
} from '../../src/puzzle/ui/wire-geometry';

beforeAll(() => registerAllNodes());

// ---------- a card model close to the real DOM sizes ----------

interface Model {
  nodes: { id: string; kind: string; category: string; w: number; h: number }[];
  wires: { id: string; from: { node: string; port: string }; to: { node: string; port: string } }[];
  pins: Map<string, Pt>;
}

function modelOf(level: PuzzleLevel): Model {
  const locked = level.base.nodes.filter((n) => !isSceneryNode(level, n.id)).map((n) => ({ n, locked: true }));
  const all = [...locked, ...level.solution.nodes.map((n) => ({ n, locked: false }))];
  const nodes: Model['nodes'] = [];
  const pins = new Map<string, Pt>();
  for (const { n, locked: isLocked } of all) {
    const def = getNodeDef(n.kind);
    if (!def) continue;
    const ins = def.inputs.filter((p) => !isLocked || isPortShown(level, n.id, p.id, 'in'));
    const outs = def.outputs.filter((p) => !isLocked || isPortShown(level, n.id, p.id, 'out'));
    const longest = Math.max(def.label.length, ...ins.map((p) => p.label.length), ...outs.map((p) => p.label.length));
    const w = Math.max(150, 40 + longest * 7.4);
    const h = 40 + (ins.length + outs.length) * 26 + 8;
    nodes.push({ id: n.id, kind: n.kind, category: def.category, w, h });
    ins.forEach((p, i) => pins.set(`${n.id}|in|${p.id}`, { x: 0, y: 43 + i * 26 + 13 }));
    outs.forEach((p, i) => pins.set(`${n.id}|out|${p.id}`, { x: w, y: 43 + (ins.length + i) * 26 + 13 }));
  }
  const have = new Set(nodes.map((n) => n.id));
  const wires = [...level.base.wires, ...level.solution.wires].filter((w) => have.has(w.from.node) && have.has(w.to.node) && pins.has(`${w.from.node}|out|${w.from.port}`) && pins.has(`${w.to.node}|in|${w.to.port}`));
  return { nodes, wires, pins };
}

function arrange(m: Model): { cards: RouteCard[]; specs: WireSpec[] } {
  const pos = arrangeLayout({
    nodes: m.nodes,
    wires: m.wires,
    pin: (node, dir, port) => m.pins.get(`${node}|${dir}|${port}`),
    order: new Map(m.nodes.map((n, i) => [n.id, i])),
  });
  const cards = m.nodes.map((n) => ({ id: n.id, x: pos.get(n.id)!.x, y: pos.get(n.id)!.y, w: n.w, h: n.h }));
  const byId = new Map(cards.map((c) => [c.id, c]));
  const specs: WireSpec[] = m.wires.map((w) => {
    const ca = byId.get(w.from.node)!;
    const cb = byId.get(w.to.node)!;
    const pa = m.pins.get(`${w.from.node}|out|${w.from.port}`)!;
    const pb = m.pins.get(`${w.to.node}|in|${w.to.port}`)!;
    return { id: w.id, fromCard: ca.id, toCard: cb.id, a: { x: ca.x + pa.x, y: ca.y + pa.y }, b: { x: cb.x + pb.x, y: cb.y + pb.y }, via: [], fromKey: `${w.from.node}|${w.from.port}`, toKey: `${w.to.node}|${w.to.port}` };
  });
  return { cards, specs };
}

const overlap = (a: RouteCard, b: RouteCard): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('Sắp xếp gọn on the reference solutions', () => {
  for (const level of PUZZLE_LEVELS) {
    it(`level ${level.order}: no overlap, no wire runs through a card`, () => {
      const m = modelOf(level);
      expect(m.nodes.length).toBeGreaterThan(0);
      const { cards, specs } = arrange(m);
      for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) expect(overlap(cards[i]!, cards[j]!), `${cards[i]!.id} / ${cards[j]!.id}`).toBe(false);
      const routes = routeWires(cards, specs, { unit: 1, fast: false });
      expect(routes.size).toBe(specs.length);
      for (const s of specs) {
        const r = routes.get(s.id)!;
        expect(cardsHit(r.pts, cards).map((c) => c.id), `wire ${s.id}`).toEqual([]);
        // every route starts and ends exactly on its pins
        expect(r.pts[0]).toEqual(s.a);
        expect(r.pts[r.pts.length - 1]).toEqual(s.b);
        expect(r.d.startsWith('M ')).toBe(true);
      }
    });
  }

  it('lays the columns out left to right by role', () => {
    const level = PUZZLE_LEVELS.find((l) => l.id === 'phan-loai-mau')!;
    const m = modelOf(level);
    const { cards } = arrange(m);
    const x = (id: string): number => cards.find((c) => c.id === id)!.x;
    expect(x('robot')).toBeLessThan(x('s-route'));
    expect(x('s-eye')).toBeLessThan(x('s-and'));
    expect(x('s-and')).toBeLessThan(x('s-hands'));
    expect(stageOf({ kind: 'carry', category: 'action' })).toBeGreaterThan(stageOf({ kind: 'and', category: 'logic' }));
  });

  it('crosses far less than a backwards stretched layout', () => {
    const level = PUZZLE_LEVELS.find((l) => l.id === 'phan-loai-mau')!;
    const { cards, specs } = arrange(modelOf(level));
    const tidy = countCrossings(specs, routeWires(cards, specs, { unit: 1, fast: false }), cards);
    // Same cards stacked in one column: every wire has to go back and forth.
    const stacked = cards.map((c, i) => ({ ...c, x: 20, y: 20 + i * 330 }));
    const shift = new Map(stacked.map((c) => [c.id, c]));
    const specs2 = specs.map((s) => {
      const ca = shift.get(s.fromCard)!;
      const cb = shift.get(s.toCard)!;
      const oa = cards.find((c) => c.id === s.fromCard)!;
      const ob = cards.find((c) => c.id === s.toCard)!;
      return { ...s, a: { x: ca.x + (s.a.x - oa.x), y: ca.y + (s.a.y - oa.y) }, b: { x: cb.x + (s.b.x - ob.x), y: cb.y + (s.b.y - ob.y) } };
    });
    const before = countCrossings(specs2, routeWires(stacked, specs2, { unit: 1, fast: true }), stacked);
    expect(tidy.wireCard).toBe(0);
    expect(tidy.total).toBeLessThan(before.total);
  });
});

describe('routing', () => {
  const cards: RouteCard[] = [
    { id: 'A', x: 0, y: 0, w: 100, h: 100 },
    { id: 'B', x: 300, y: 0, w: 100, h: 100 },
    { id: 'M', x: 150, y: 0, w: 100, h: 100 },
  ];
  const spec = (id: string, a: Pt, b: Pt, via: Pt[] = [], from = 'A', to = 'B'): WireSpec => ({ id, fromCard: from, toCard: to, a, b, via });

  it('keeps the curve when nothing is in the way', () => {
    const s = spec('w', { x: 100, y: 50 }, { x: 300, y: 250 });
    const r = routeWires([cards[0]!, cards[1]!], [s], { unit: 1, fast: false }).get('w')!;
    expect(r.ortho).toBe(false);
    expect(r.d).toContain('C');
  });

  it('goes around a card that is in the way', () => {
    const s = spec('w', { x: 100, y: 50 }, { x: 300, y: 50 });
    const r = routeWires(cards, [s], { unit: 1, fast: false }).get('w')!;
    expect(r.ortho).toBe(true);
    expect(hitsCard(r.pts, cards)).toBe(false);
  });

  it('routes a backwards wire around both cards', () => {
    const s = spec('w', { x: 400, y: 50 }, { x: 0, y: 50 }, [], 'B', 'A');
    const r = routeWires(cards, [s], { unit: 1, fast: false }).get('w')!;
    expect(hitsCard(r.pts, cards)).toBe(false);
    expect(r.pts[0]).toEqual({ x: 400, y: 50 });
    expect(r.pts[r.pts.length - 1]).toEqual({ x: 0, y: 50 });
  });

  it('fast mode only draws curves', () => {
    const s = spec('w', { x: 100, y: 50 }, { x: 300, y: 50 });
    expect(routeWires(cards, [s], { unit: 1, fast: true }).get('w')!.ortho).toBe(false);
  });

  it('passes through a knot and reports the leg for a new knot', () => {
    const s = spec('w', { x: 100, y: 50 }, { x: 300, y: 250 }, [{ x: 200, y: 200 }]);
    const r = routeWires([cards[0]!, cards[1]!], [s], { unit: 1, fast: false }).get('w')!;
    expect(r.pts.some((p) => Math.abs(p.x - 200) < 0.6 && Math.abs(p.y - 200) < 0.6)).toBe(true);
    expect(legIndexAt(r, { x: 120, y: 60 })).toBe(0);
    expect(legIndexAt(r, { x: 290, y: 250 })).toBe(1);
  });

  it('draws the shared first stretch of two wires from one pin only once', () => {
    const knot = { x: 200, y: 200 };
    const a = { x: 100, y: 50 };
    const w1 = spec('w1', a, { x: 300, y: 250 }, [knot]);
    const w2 = spec('w2', a, { x: 300, y: 330 }, [knot]);
    const routes = routeWires([cards[0]!, cards[1]!], [w1, w2], { unit: 1, fast: false });
    const r1 = routes.get('w1')!.pts;
    const r2 = routes.get('w2')!.pts;
    const k1 = r1.findIndex((p) => Math.abs(p.x - 200) < 0.6 && Math.abs(p.y - 200) < 0.6);
    const k2 = r2.findIndex((p) => Math.abs(p.x - 200) < 0.6 && Math.abs(p.y - 200) < 0.6);
    expect(r1.slice(0, k1 + 1)).toEqual(r2.slice(0, k2 + 1));
  });

  it('counts a wire across a card', () => {
    const s = spec('w', { x: 100, y: 50 }, { x: 300, y: 50 });
    const routes = routeWires(cards, [s], { unit: 1, fast: true });
    expect(countCrossings([s], routes, cards).wireCard).toBe(1);
  });

  it('finds the middle of a polyline', () => {
    expect(midPoint([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toEqual({ x: 10, y: 0 });
  });
});

describe('knots', () => {
  const sources: Record<string, string> = { a: 'robot|self', b: 'robot|self', c: 'robot|self', d: 'eye|match' };
  const sourceOf = (w: string): string | undefined => sources[w];

  it('adds, orders, moves and removes a knot', () => {
    let book = emptyKnots();
    const first = addKnot(book, 'a', { x: 100, y: 100 }, 0);
    book = first.book;
    const second = addKnot(book, 'a', { x: 50, y: 50 }, 0);
    book = second.book;
    expect(knotPoints(book, 'a')).toEqual([{ x: 50, y: 50 }, { x: 100, y: 100 }]);
    book = moveKnot(book, first.id, { x: 120, y: 90 });
    expect(knotPoints(book, 'a')[1]).toEqual({ x: 120, y: 90 });
    book = removeKnot(book, second.id);
    expect(knotPoints(book, 'a')).toEqual([{ x: 120, y: 90 }]);
    book = removeKnot(book, first.id);
    expect(book).toEqual(emptyKnots());
  });

  it('merges knots of wires from the same pin (branching) and refuses other pins', () => {
    let book = emptyKnots();
    const k1 = addKnot(book, 'a', { x: 100, y: 100 }, 0);
    const k2 = addKnot(k1.book, 'b', { x: 110, y: 120 }, 0);
    const k3 = addKnot(k2.book, 'd', { x: 105, y: 110 }, 0);
    expect(mergeKnots(k3.book, k1.id, k3.id, sourceOf)).toBeNull();
    const merged = mergeKnots(k3.book, k1.id, k2.id, sourceOf)!;
    expect(merged.chain['a']).toEqual([k1.id]);
    expect(merged.chain['b']).toEqual([k1.id]);
    expect(isSharedKnot(merged, k1.id)).toBe(true);
    expect(wiresOfKnot(merged, k1.id).sort()).toEqual(['a', 'b']);
    expect(merged.pos[k2.id]).toBeUndefined();
    // removing the shared knot takes it off both wires
    book = removeKnot(merged, k1.id);
    expect(book.chain['a']).toBeUndefined();
    expect(book.chain['b']).toBeUndefined();
  });

  it('does not merge two knots of one wire', () => {
    const k1 = addKnot(emptyKnots(), 'a', { x: 1, y: 1 }, 0);
    const k2 = addKnot(k1.book, 'a', { x: 2, y: 2 }, 1);
    expect(mergeKnots(k2.book, k1.id, k2.id, sourceOf)).toBeNull();
  });

  it('drops the knots of wires that are gone', () => {
    const k1 = addKnot(emptyKnots(), 'a', { x: 1, y: 1 }, 0);
    const k2 = addKnot(k1.book, 'd', { x: 2, y: 2 }, 0);
    const pruned = pruneKnots(k2.book, new Set(['d']));
    expect(Object.keys(pruned.pos)).toEqual([k2.id]);
    expect(pruneKnots(pruned, new Set(['d']))).toBe(pruned);
    expect(pruneKnots(pruned, new Set())).toEqual(emptyKnots());
  });

  it('Gom dây: one shared knot per pin with three wires or more', () => {
    const wires = [
      { id: 'a', from: { node: 'robot', port: 'self' } },
      { id: 'b', from: { node: 'robot', port: 'self' } },
      { id: 'c', from: { node: 'robot', port: 'self' } },
      { id: 'd', from: { node: 'eye', port: 'match' } },
      { id: 'e', from: { node: 'eye', port: 'match' } },
    ];
    const groups = fanOuts(wires, 3);
    expect([...groups.keys()]).toEqual(['robot|self']);
    let book = addKnot(emptyKnots(), 'a', { x: 5, y: 5 }, 0).book;
    book = gomKnots(book, [{ wireIds: groups.get('robot|self')!, at: { x: 200, y: 100 } }]);
    expect(Object.keys(book.pos)).toHaveLength(1);
    expect(book.chain['a']).toEqual(book.chain['b']);
    expect(book.chain['c']).toEqual(book.chain['a']);
    expect(book.chain['d']).toBeUndefined();
    expect(wiresOfKnot(book, book.chain['a']![0]!)).toHaveLength(3);
  });

  it('places the shared knot in free space left of the targets', () => {
    const cards = [
      { x: 0, y: 0, w: 100, h: 200 },
      { x: 300, y: 0, w: 100, h: 100 },
      { x: 300, y: 120, w: 100, h: 100 },
      { x: 150, y: 80, w: 100, h: 60 },
    ];
    const at = gomSpot(cards, { x: 100, y: 20 }, [{ x: 300, y: 40 }, { x: 300, y: 160 }, { x: 300, y: 190 }]);
    expect(at.x).toBeLessThan(300);
    expect(at.x).toBeGreaterThan(100);
    expect(cards.some((c) => at.x > c.x && at.x < c.x + c.w && at.y > c.y && at.y < c.y + c.h)).toBe(false);
  });
});

describe('Gom dây on a tidy board', () => {
  it('picks a free spot that crosses no more than the plain spot, on every level that has a fan-out', () => {
    let tried = 0;
    for (const level of PUZZLE_LEVELS) {
      const { cards, specs } = arrange(modelOf(level));
      const groups = fanOuts(specs.map((sp) => ({ id: sp.id, from: { node: sp.fromCard, port: sp.fromKey!.split('|')[1]! } })), 3);
      for (const ids of groups.values()) {
        tried++;
        const opts = { unit: 1, fast: false };
        const at = bestGomSpot(cards, specs, ids, opts);
        expect(cards.some((c) => at.x > c.x && at.x < c.x + c.w && at.y > c.y && at.y < c.y + c.h)).toBe(false);
        const members = specs.filter((sp) => ids.includes(sp.id));
        const plain = gomSpot(cards, members[0]!.a, members.map((m) => m.b));
        const count = (pt: Pt): number => {
          const trial = specs.map((sp) => (ids.includes(sp.id) ? { ...sp, via: [pt] } : sp));
          return countCrossings(trial, routeWires(cards, trial, opts), cards).total;
        };
        expect(count(at)).toBeLessThanOrEqual(count(plain));
      }
    }
    expect(tried).toBeGreaterThan(0);
  });
});

describe('fit', () => {
  it('shows all content, never magnifies, keeps clear of the corner window', () => {
    const content = { x: 24, y: 24, w: 1000, h: 600 };
    const v = fitContent(content, { w: 844, h: 250 }, null);
    expect(v.k).toBeLessThanOrEqual(1);
    expect(content.w * v.k + 20).toBeLessThanOrEqual(844 + 0.01);
    expect(content.h * v.k + 20).toBeLessThanOrEqual(250 + 0.01);
    const small = fitContent({ x: 0, y: 0, w: 100, h: 100 }, { w: 800, h: 400 }, null);
    expect(small.k).toBe(1);
    const avoid = fitContent(content, { w: 844, h: 250 }, { x: 650, y: 100, w: 194, h: 150 });
    expect(avoid.k).toBeGreaterThan(0);
    expect(boundsOf([{ x: 1, y: 2, w: 3, h: 4 }, { x: 10, y: 0, w: 1, h: 1 }])).toEqual({ x: 1, y: 0, w: 10, h: 6 });
  });
});
