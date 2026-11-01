import { describe, expect, it } from 'vitest';
import { getNodeDef } from '../../src/engine/registry';
import { registerAllNodes } from '../../src/nodes';
import { level01 } from '../../src/puzzle/levels/level-01';
import { level02 } from '../../src/puzzle/levels/level-02';
import { level03 } from '../../src/puzzle/levels/level-03';
import { level04 } from '../../src/puzzle/levels/level-04';
import { runLevel } from '../../src/puzzle/run-level';
import type { PuzzleAnswer } from '../../src/puzzle/types';

registerAllNodes();

const LEVELS = [level01, level02, level03, level04].map((l, i) => {
  if (!l) throw new Error(`level ${i + 1} is missing`);
  return l;
});
const EMPTY: PuzzleAnswer = { nodes: [], wires: [] };
const CONTROL_KINDS = ['key', 'stick'];

const without = (a: PuzzleAnswer, wireId: string): PuzzleAnswer => ({ ...a, wires: a.wires.filter((w) => w.id !== wireId) });
const withoutNode = (a: PuzzleAnswer, nodeId: string): PuzzleAnswer => ({
  nodes: a.nodes.filter((n) => n.id !== nodeId),
  wires: a.wires.filter((w) => w.from.node !== nodeId && w.to.node !== nodeId),
});

describe.each(LEVELS.map((l) => [l.order, l] as const))('puzzle level %i', (_order, level) => {
  it('has the expected id, order and one locked win-lose node', () => {
    expect(level.order).toBe(_order);
    expect(level.base.nodes.filter((n) => n.kind === 'win-lose')).toHaveLength(1);
    expect(level.task.length).toBeGreaterThan(10);
    expect(level.hint.length).toBeGreaterThan(10);
    expect(level.par).toBe(level.solution.nodes.length);
    expect(Number.isFinite(level.timeLimit)).toBe(true);
  });

  it('is won by the reference solution before the time limit', () => {
    const r = runLevel(level, level.solution);
    expect(r.outcome).toBe('win');
    expect(r.seconds).toBeLessThan(level.timeLimit);
  });

  it('is not won with nothing added', () => {
    expect(runLevel(level, EMPTY).outcome).not.toBe('win');
  });

  it('is not won when any single wire of the solution is removed', () => {
    for (const w of level.solution.wires) {
      expect(runLevel(level, without(level.solution, w.id)).outcome, `without wire ${w.id}`).not.toBe('win');
    }
  });

  it('is not won when any single placed piece is removed', () => {
    for (const n of level.solution.nodes) {
      expect(runLevel(level, withoutNode(level.solution, n.id)).outcome, `without piece ${n.id}`).not.toBe('win');
    }
  });

  it('only uses tray kinds within their counts', () => {
    for (const n of level.solution.nodes) {
      expect(getNodeDef(n.kind), `unknown kind ${n.kind}`).toBeDefined();
      expect(level.tray.some((t) => t.kind === n.kind), `${n.kind} not in tray`).toBe(true);
    }
    for (const t of level.tray) {
      const used = level.solution.nodes.filter((n) => n.kind === t.kind).length;
      expect(used).toBeLessThanOrEqual(t.count);
    }
  });

  it('solution ids do not clash with base and each wire joins existing nodes', () => {
    const baseIds = new Set(level.base.nodes.map((n) => n.id));
    for (const n of level.solution.nodes) expect(baseIds.has(n.id)).toBe(false);
    const all = new Set([...baseIds, ...level.solution.nodes.map((n) => n.id)]);
    for (const w of [...level.base.wires, ...level.solution.wires]) {
      expect(all.has(w.from.node) && all.has(w.to.node), `wire ${w.id}`).toBe(true);
    }
  });

  it('every solution wire touches only ports that are shown on locked nodes', () => {
    const placed = new Set(level.solution.nodes.map((n) => n.id));
    const shown = (nodeId: string, dir: 'in' | 'out', port: string): boolean => {
      const list = level.shownPorts?.[nodeId]?.[dir];
      if (list) return list.includes(port);
      // A locked node missing from shownPorts shows all its ports.
      return true;
    };
    for (const w of level.solution.wires) {
      if (!placed.has(w.from.node)) expect(shown(w.from.node, 'out', w.from.port), `${w.id} from ${w.from.node}.${w.from.port}`).toBe(true);
      if (!placed.has(w.to.node)) expect(shown(w.to.node, 'in', w.to.port), `${w.id} to ${w.to.node}.${w.to.port}`).toBe(true);
    }
  });

  it('has no key or stick nodes in base, tray or solution', () => {
    const kinds = [...level.base.nodes.map((n) => n.kind), ...level.tray.map((t) => t.kind), ...level.solution.nodes.map((n) => n.kind)];
    for (const k of CONTROL_KINDS) expect(kinds).not.toContain(k);
  });

  it('locked node cards do not overlap', () => {
    const CARD_W = 170;
    const rect = (id: string, pos: { x: number; y: number }) => {
      const def = level.shownPorts?.[id];
      const node = level.base.nodes.find((n) => n.id === id)!;
      const d = getNodeDef(node.kind)!;
      const ins = def?.in ? def.in.length : d.inputs.length;
      const outs = def?.out ? def.out.length : d.outputs.length;
      return { x: pos.x, y: pos.y, w: CARD_W, h: 34 + 26 * Math.max(ins, outs, 1) };
    };
    const rects = level.base.nodes.map((n) => rect(n.id, n.pos));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${level.base.nodes[i]!.id} overlaps ${level.base.nodes[j]!.id}`).toBe(false);
      }
      expect(rects[i]!.x + CARD_W).toBeLessThanOrEqual(1000);
      expect(rects[i]!.y + rects[i]!.h).toBeLessThanOrEqual(560);
    }
  });
});

describe('level 1 (bot-dau-tien)', () => {
  it('without the wire into the walking input of the bot it stands still', () => {
    expect(runLevel(level01!, without(level01!.solution, 's3')).outcome).toBe('timeout');
  });
});

describe('level 2 (cua-kho)', () => {
  const sol = level02!.solution;
  it('touch straight into the door signal opens it only while the bot stands on the button, so the bot gets stuck', () => {
    const noLatch: PuzzleAnswer = {
      nodes: sol.nodes.filter((n) => n.id === 'p-touch'),
      wires: [
        ...sol.wires.filter((w) => w.id === 's1' || w.id === 's2'),
        { id: 'x1', from: { node: 'p-touch', port: 'touching' }, to: { node: 'door', port: 'hiddenWhile' } },
      ],
    };
    expect(runLevel(level02!, noLatch).outcome).toBe('timeout');
  });
  it('a latch wired from nothing never opens the door', () => {
    expect(runLevel(level02!, withoutNode(sol, 'p-touch')).outcome).toBe('timeout');
  });
});

describe('level 3 (nhat-sao)', () => {
  const sol = level03!.solution;
  const withConst = (value: number): PuzzleAnswer => ({
    ...sol,
    nodes: sol.nodes.map((n) => (n.id === 'p-const' ? { ...n, params: { ...n.params, value } } : n)),
  });
  it('the tray constant starts above 3, so the gate stays shut until the player sets 3', () => {
    const start = level03!.tray.find((t) => t.kind === 'const')!;
    expect(Number(start.params?.value)).toBeGreaterThan(3);
    expect(runLevel(level03!, withConst(Number(start.params?.value))).outcome).toBe('timeout');
    for (const v of [0, 1, 2, 4]) expect(runLevel(level03!, withConst(v)).outcome, `value ${v}`).toBe('timeout');
    expect(runLevel(level03!, withConst(3)).outcome).toBe('win');
  });
  it('only the compare constant is editable', () => {
    expect(level03!.editable).toEqual([{ kind: 'const', paramId: 'value' }]);
  });
  it('the cat cannot reach the goal on its own: gate blocks it', () => {
    expect(runLevel(level03!, EMPTY).outcome).toBe('timeout');
  });
});

describe('level 4 (hai-nut-mot-cua)', () => {
  const sol = level04!.solution;
  it('one sensor alone is not enough: a robot is left behind', () => {
    expect(runLevel(level04!, without(sol, 's5')).outcome).toBe('timeout');
    expect(runLevel(level04!, without(sol, 's6')).outcome).toBe('timeout');
  });
  it('both robots are locked with the approved looks', () => {
    expect(level04!.base.nodes.filter((n) => n.kind === 'character').map((n) => n.params.look)).toEqual(['robot-legs', 'robot-wheel']);
  });
  it('the door is wired only through its hidden-while input', () => {
    expect(level04!.shownPorts!.door).toEqual({ in: ['hiddenWhile'], out: [] });
    expect(sol.wires.some((w) => w.to.node === 'door' && w.to.port === 'hiddenWhile')).toBe(true);
  });
});
