import { describe, expect, it } from 'vitest';
import { level05 } from '../../src/puzzle/levels/level-05';
import { level06 } from '../../src/puzzle/levels/level-06';
import { level07 } from '../../src/puzzle/levels/level-07';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { canConnect } from '../../src/engine/wiring';
import { registerAllNodes } from '../../src/nodes';
import { piecesUsed, runLevel } from '../../src/puzzle/run-level';
import type { Graph, Params } from '../../src/engine/types';
import type { PuzzleAnswer, PuzzleLevel } from '../../src/puzzle/types';

const EMPTY: PuzzleAnswer = { nodes: [], wires: [] };
const LEVELS: PuzzleLevel[] = [level05, level06, level07];

/** Copy of the answer where every placed node of `kind` gets these params. */
function withParams(a: PuzzleAnswer, kind: string, params: Params): PuzzleAnswer {
  return { ...a, nodes: a.nodes.map((n) => (n.kind === kind ? { ...n, params: { ...n.params, ...params } } : n)) };
}

describe.each(PUZZLE_LEVELS)('puzzle level $order $id: real board rules', (level) => {
  it('every solution wire passes the same connect rule the board uses, wired one by one', () => {
    registerAllNodes();
    let graph: Graph = { nodes: [...level.base.nodes, ...level.solution.nodes], wires: [...level.base.wires] };
    for (const w of level.solution.wires) {
      const res = canConnect(graph, w.from, w.to);
      expect(res.ok, `${w.id}: ${res.ok ? '' : res.reason}`).toBe(true);
      graph = { ...graph, wires: [...graph.wires, w] };
    }
  });
});

describe.each(LEVELS)('puzzle level $order $id', (level) => {
  it('reference solution wins before the time limit', () => {
    const r = runLevel(level, level.solution);
    expect(r.outcome).toBe('win');
    expect(r.seconds).toBeLessThan(level.timeLimit);
  });

  it('an empty answer does not win', () => {
    expect(runLevel(level, EMPTY).outcome).not.toBe('win');
  });

  it('solution stays within the tray and par', () => {
    const used = new Map<string, number>();
    for (const n of level.solution.nodes) used.set(n.kind, (used.get(n.kind) ?? 0) + 1);
    for (const [kind, n] of used) {
      const tray = level.tray.find((t) => t.kind === kind);
      expect(tray, `tray has ${kind}`).toBeDefined();
      expect(n).toBeLessThanOrEqual(tray!.count);
    }
    expect(piecesUsed(level.solution)).toBe(level.par);
  });

  it('solution wires only shown ports on locked nodes', () => {
    const locked = new Set(level.base.nodes.map((n) => n.id));
    for (const w of level.solution.wires) {
      const fromShown = level.shownPorts?.[w.from.node]?.out;
      const toShown = level.shownPorts?.[w.to.node]?.in;
      if (locked.has(w.from.node) && fromShown) expect(fromShown, `${w.id} from`).toContain(w.from.port);
      if (locked.has(w.to.node) && toShown) expect(toShown, `${w.id} to`).toContain(w.to.port);
    }
  });

  it('has no key or stick nodes, a locked win-lose and a locked camera', () => {
    const kinds = [...level.base.nodes, ...level.solution.nodes].map((n) => n.kind);
    expect(kinds).not.toContain('key');
    expect(kinds).not.toContain('stick');
    expect(level.tray.map((t) => t.kind)).not.toContain('key');
    expect(level.tray.map((t) => t.kind)).not.toContain('stick');
    expect(level.base.nodes.filter((n) => n.kind === 'win-lose')).toHaveLength(1);
    const cam = level.base.nodes.find((n) => n.kind === 'camera');
    expect(cam?.params.mode).toBe('fixed');
    expect(['tilted', 'top']).toContain(cam?.params.view);
    expect(level.mode).toBe('3d');
  });

  it('node ids do not clash and cards do not overlap', () => {
    const ids = [...level.base.nodes, ...level.solution.nodes].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Every locked node lists its shown ports, so no card grows to show all its ports.
    const rows = (id: string): number => {
      const sp = level.shownPorts?.[id];
      expect(sp, `${id} is listed in shownPorts`).toBeDefined();
      return (sp?.in?.length ?? 0) + (sp?.out?.length ?? 0);
    };
    const boxes = level.base.nodes.map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y, h: 34 + 26 * rows(n.id) }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlap = a.x < b.x + 170 && b.x < a.x + 170 && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });
});

describe('level 5: du-ba-thung', () => {
  it('the robot stops before the crates and the slots (go-to stop distance matters)', () => {
    expect(runLevel(level05, withParams(level05.solution, 'go-to', { stopDistance: 4 })).outcome).not.toBe('win');
  });

  it('a spare "Đảo ngược" left unwired does nothing', () => {
    const extra: PuzzleAnswer = { ...level05.solution, nodes: [...level05.solution.nodes, { id: 'n', kind: 'not', params: {}, pos: { x: 0, y: 0 } }] };
    expect(runLevel(level05, extra).outcome).toBe('win');
  });
});
