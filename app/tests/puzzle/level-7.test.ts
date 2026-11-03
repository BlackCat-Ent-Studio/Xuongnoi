import { describe, expect, it } from 'vitest';
import { level07 } from '../../src/puzzle/levels/level-07';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { piecesUsed, runLevel, starsFor } from '../../src/puzzle/run-level';
import type { Params } from '../../src/engine/types';
import type { PuzzleAnswer } from '../../src/puzzle/types';
import { allSolved, buildStops, starTotals } from '../../src/puzzle/ui/map-state';
import { PROGRESS_KEY, loadProgress, withBest } from '../../src/puzzle/ui/progress';

const EMPTY: PuzzleAnswer = { nodes: [], wires: [] };
const sol = level07.solution;

function withParams(a: PuzzleAnswer, kind: string, params: Params): PuzzleAnswer {
  return { ...a, nodes: a.nodes.map((n) => (n.kind === kind ? { ...n, params: { ...n.params, ...params } } : n)) };
}

describe('level 7: phan-loai-mau', () => {
  it('is the seventh and last level, with the legs robot', () => {
    expect(PUZZLE_LEVELS).toHaveLength(7);
    expect(PUZZLE_LEVELS[6]).toBe(level07);
    expect(PUZZLE_LEVELS.map((l) => l.id)).not.toContain('cau-nhap-nhay');
    expect(PUZZLE_LEVELS.map((l) => l.id)).not.toContain('xuong-tong-hop');
    expect(level07.cast).toEqual(['robot-legs']);
    expect(level07.base.nodes.find((n) => n.id === 'robot')?.params.look).toBe('robot-legs');
  });

  it('the reference solution wins well inside the time limit', () => {
    const r = runLevel(level07, sol);
    expect(r.outcome).toBe('win');
    expect(r.seconds).toBeLessThan(level07.timeLimit * 0.6);
  });

  it('an empty answer never wins: without the player the robot just stands there', () => {
    expect(runLevel(level07, EMPTY).outcome).toBe('timeout');
  });

  it('removing any one solution wire fails', () => {
    for (const w of sol.wires) {
      const r = runLevel(level07, { ...sol, wires: sol.wires.filter((x) => x.id !== w.id) });
      expect(r.outcome, `without ${w.id}`).not.toBe('win');
    }
  }, 120_000);

  it('removing any one placed piece fails', () => {
    for (const n of sol.nodes) {
      const r = runLevel(level07, {
        nodes: sol.nodes.filter((m) => m.id !== n.id),
        wires: sol.wires.filter((w) => w.from.node !== n.id && w.to.node !== n.id),
      });
      expect(r.outcome, `without ${n.id}`).not.toBe('win');
    }
  }, 120_000);

  it('carrying a red crate into the store loses', () => {
    const r = runLevel(level07, withParams(sol, 'color-sensor', { want: 1 }));
    expect(r.outcome).toBe('lose');
    expect(r.message).toContain('đỏ');
  });

  it('a colour that is on no crate (yellow) never carries anything', () => {
    expect(runLevel(level07, withParams(sol, 'color-sensor', { want: 3 })).outcome).toBe('timeout');
  });

  it('the red sensor setting is the tray start, so the player has to change it', () => {
    const start = level07.tray.find((t) => t.kind === 'color-sensor');
    expect(start?.params?.want).toBe(1);
    expect(level07.editable).toEqual([{ kind: 'color-sensor', paramId: 'want' }]);
  });

  it('the tray holds exactly the solution pieces plus one spare; par is the solution piece count', () => {
    const counts = new Map<string, number>();
    for (const n of sol.nodes) counts.set(n.kind, (counts.get(n.kind) ?? 0) + 1);
    const spare = level07.tray.filter((t) => t.count > (counts.get(t.kind) ?? 0));
    expect(spare.map((t) => [t.kind, t.count - (counts.get(t.kind) ?? 0)])).toEqual([['not', 1]]);
    for (const [kind, n] of counts) expect(level07.tray.find((t) => t.kind === kind)?.count, kind).toBe(n);
    expect(level07.tray.reduce((sum, t) => sum + t.count, 0)).toBe(piecesUsed(sol) + 1);
    expect(level07.par).toBe(piecesUsed(sol));
    expect(level07.freeHints).toBe(7);
  });

  it('stars: three within par, one fewer per "?" beyond the seven free ones', () => {
    expect(starsFor(level07, sol, 0)).toBe(3);
    expect(starsFor(level07, sol, 7)).toBe(3);
    expect(starsFor(level07, sol, 8)).toBe(2);
    expect(starsFor(level07, sol, 20)).toBe(1);
    const over: PuzzleAnswer = { nodes: [...sol.nodes, { id: 'extra', kind: 'not', params: {}, pos: { x: 0, y: 0 } }], wires: sol.wires };
    expect(starsFor(level07, over, 0)).toBe(2);
  });

  it('the win asks for a blue crate in each of the three slots, so crates piled in one slot do not win', () => {
    const pile: PuzzleAnswer = {
      ...sol,
      wires: sol.wires.filter((w) => w.id !== 'sw14').concat({ id: 'x', from: { node: 'slot-1', port: 'self' }, to: { node: 's-goto', port: 'target' } }),
    };
    expect(runLevel(level07, pile).outcome).not.toBe('win');
  });

  describe('last level and saved progress', () => {
    const memory = (value: string) => ({ getItem: () => value, setItem: () => undefined });
    const solvedAll = (extra: Record<string, { stars: number }> = {}) => ({
      ...Object.fromEntries(PUZZLE_LEVELS.map((l) => [l.id, { stars: 3 }])),
      ...extra,
    });

    it('after the seventh level there is nothing to open next, and solving all seven leads to the ending', () => {
      const stops = buildStops(PUZZLE_LEVELS, {});
      expect(stops).toHaveLength(7);
      expect(allSolved(PUZZLE_LEVELS, Object.fromEntries(PUZZLE_LEVELS.slice(0, 6).map((l) => [l.id, { stars: 1 as const }])))).toBe(false);
      const won = withBest(Object.fromEntries(PUZZLE_LEVELS.slice(0, 6).map((l) => [l.id, { stars: 1 as const }])), level07.id, 3);
      expect(allSolved(PUZZLE_LEVELS, won)).toBe(true);
    });

    it('a save that also holds the retired eighth level loads and changes nothing: 7 stops, 21 stars at most', () => {
      const saved = loadProgress(memory(JSON.stringify(solvedAll({ 'xuong-tong-hop': { stars: 2 } }))));
      expect(saved['xuong-tong-hop']).toEqual({ stars: 2 });
      expect(buildStops(PUZZLE_LEVELS, saved).map((s) => s.state)).toEqual(Array(7).fill('done'));
      expect(starTotals(PUZZLE_LEVELS, saved)).toEqual({ got: 21, max: 21 });
      expect(allSolved(PUZZLE_LEVELS, saved)).toBe(true);
    });

    it('a save with the eighth level solved but the seventh not does not count as finished', () => {
      const partial = Object.fromEntries(PUZZLE_LEVELS.slice(0, 6).map((l) => [l.id, { stars: 1 as const }]));
      const saved = loadProgress(memory(JSON.stringify({ ...partial, 'xuong-tong-hop': { stars: 3 } })));
      expect(allSolved(PUZZLE_LEVELS, saved)).toBe(false);
      expect(buildStops(PUZZLE_LEVELS, saved)[6]?.state).toBe('next');
      expect(PROGRESS_KEY).toBeTruthy();
    });
  });
});
