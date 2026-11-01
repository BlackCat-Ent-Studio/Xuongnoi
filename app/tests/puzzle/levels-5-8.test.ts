import { describe, expect, it } from 'vitest';
import { level05 } from '../../src/puzzle/levels/level-05';
import { level06 } from '../../src/puzzle/levels/level-06';
import { level07 } from '../../src/puzzle/levels/level-07';
import { level08 } from '../../src/puzzle/levels/level-08';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { canConnect } from '../../src/engine/wiring';
import { registerAllNodes } from '../../src/nodes';
import { piecesUsed, runLevel } from '../../src/puzzle/run-level';
import type { Graph, Params } from '../../src/engine/types';
import type { PuzzleAnswer, PuzzleLevel } from '../../src/puzzle/types';

const EMPTY: PuzzleAnswer = { nodes: [], wires: [] };
const LEVELS: PuzzleLevel[] = [level05, level06, level07, level08];

/** Copy of the answer where every placed node of `kind` gets these params. */
function withParams(a: PuzzleAnswer, kind: string, params: Params): PuzzleAnswer {
  return { ...a, nodes: a.nodes.map((n) => (n.kind === kind ? { ...n, params: { ...n.params, ...params } } : n)) };
}

/** Copy of the answer without the given wires (pieces left unwired stay on the board). */
function withoutWires(a: PuzzleAnswer, ...ids: string[]): PuzzleAnswer {
  return { ...a, wires: a.wires.filter((w) => !ids.includes(w.id)) };
}

/** Copy of the answer keeping only these placed pieces and the wires between known nodes. */
function onlyPieces(a: PuzzleAnswer, level: PuzzleLevel, keep: string[]): PuzzleAnswer {
  const alive = new Set([...level.base.nodes.map((n) => n.id), ...keep]);
  return { nodes: a.nodes.filter((n) => keep.includes(n.id)), wires: a.wires.filter((w) => alive.has(w.from.node) && alive.has(w.to.node)) };
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
  it('needs the compare to ask for the full count', () => {
    expect(runLevel(level05, withParams(level05.solution, 'compare', { op: 'gt' })).outcome).toBe('timeout');
  });

  it('a zone placed away from the storage never counts crates', () => {
    const away = withParams(level05.solution, 'zone', { center: { x: 0, y: 1, z: 5 } });
    expect(runLevel(level05, away).outcome).toBe('timeout');
  });

  it('a counter left unwired does nothing', () => {
    const extra: PuzzleAnswer = { ...EMPTY, nodes: [{ id: 'c', kind: 'counter', params: {}, pos: { x: 0, y: 0 } }] };
    expect(runLevel(level05, extra).outcome).toBe('timeout');
  });
});

describe('level 6: ne-linh-gac', () => {
  it('a hero that always walks runs into the guard', () => {
    expect(runLevel(level06, EMPTY).outcome).toBe('lose');
  });

  it('a safe distance that is too small still gets caught', () => {
    expect(runLevel(level06, withParams(level06.solution, 'distance', { threshold: 1 })).outcome).toBe('lose');
  });

  it('a safe distance that is too big keeps the hero waiting forever', () => {
    expect(runLevel(level06, withParams(level06.solution, 'distance', { threshold: 8 })).outcome).toBe('timeout');
  });

  it('a range of safe distances works', () => {
    for (const threshold of [2, 3, 4]) {
      expect(runLevel(level06, withParams(level06.solution, 'distance', { threshold })).outcome).toBe('win');
    }
  });

  it('forgetting the "Không" (hero waits when the guard is far) never arrives', () => {
    const notBack = withoutWires(level06.solution, 'sw3', 'sw4');
    const direct: PuzzleAnswer = {
      ...notBack,
      wires: [...notBack.wires, { id: 'x1', from: { node: 's-dist', port: 'within' }, to: { node: 'walk', port: 'go' } }],
    };
    expect(runLevel(level06, direct).outcome).not.toBe('win');
  });
});

describe('level 8: xuong-tong-hop', () => {
  const s = level08.solution;
  const guardIds = ['s-dist', 's-not'];
  const doorIds = ['s-touch', 's-cmp', 's-and'];

  it('a door without the guard check lets the cat run into the guard', () => {
    expect(runLevel(level08, onlyPieces(s, level08, doorIds)).outcome).toBe('lose');
  });

  it('guard check without opening the door never finishes', () => {
    expect(runLevel(level08, onlyPieces(s, level08, guardIds)).outcome).toBe('timeout');
  });

  it('the door needs the crates as well as the button', () => {
    const noCrates = withoutWires(s, 'sw3', 'sw4', 'sw2');
    expect(runLevel(level08, noCrates).outcome).toBe('timeout');
  });

  it('a second way works: a memory switch keeps the button press', () => {
    const alt: PuzzleAnswer = {
      nodes: [
        ...s.nodes,
        { id: 's-latch', kind: 'latch', params: {}, pos: { x: 620, y: 250 } },
      ],
      wires: [
        ...s.wires.filter((w) => w.id !== 'sw5'),
        { id: 'a1', from: { node: 's-touch', port: 'began' }, to: { node: 's-latch', port: 'set' } },
        { id: 'a2', from: { node: 's-latch', port: 'on' }, to: { node: 's-and', port: 'a' } },
      ],
    };
    expect(runLevel(level08, alt).outcome).toBe('win');
  });

  it('a range of safe distances works', () => {
    for (const threshold of [2.5, 3, 3.5]) {
      expect(runLevel(level08, withParams(s, 'distance', { threshold })).outcome).toBe('win');
    }
    expect(runLevel(level08, withParams(s, 'distance', { threshold: 1 })).outcome).toBe('lose');
  });
});
