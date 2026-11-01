import { describe, expect, it } from 'vitest';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { runLevel, starsFor } from '../../src/puzzle/run-level';
import type { PuzzleAnswer, PuzzleLevel } from '../../src/puzzle/types';

/** Smallest possible level: a locked win-lose node; the player wires "Khi bắt đầu" into "Thắng". */
const tiny: PuzzleLevel = {
  id: 'tiny',
  order: 1,
  title: 'Thử',
  task: '',
  hint: '',
  mode: '2d-side',
  cast: [],
  base: { nodes: [{ id: 'end', kind: 'win-lose', params: {}, pos: { x: 0, y: 0 } }], wires: [] },
  tray: [{ kind: 'on-start', count: 1 }],
  par: 1,
  timeLimit: 2,
  solution: {
    nodes: [{ id: 'p1', kind: 'on-start', params: {}, pos: { x: 0, y: 0 } }],
    wires: [{ id: 'w1', from: { node: 'p1', port: 'fired' }, to: { node: 'end', port: 'win' } }],
  },
};
const empty: PuzzleAnswer = { nodes: [], wires: [] };

describe('runLevel', () => {
  it('wins with the reference answer and times out with nothing added', () => {
    expect(runLevel(tiny, tiny.solution).outcome).toBe('win');
    expect(runLevel(tiny, empty).outcome).toBe('timeout');
  });

  it('gives 3 stars within par, 2 above par, 1 after the hint', () => {
    expect(starsFor(tiny, tiny.solution, false)).toBe(3);
    const extra = { ...tiny.solution, nodes: [...tiny.solution.nodes, { id: 'p2', kind: 'on-start', params: {}, pos: { x: 0, y: 0 } }] };
    expect(starsFor(tiny, extra, false)).toBe(2);
    expect(starsFor(tiny, tiny.solution, true)).toBe(1);
  });

  it('level list is ordered and ids are unique', () => {
    const orders = PUZZLE_LEVELS.map((l) => l.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(PUZZLE_LEVELS.map((l) => l.id)).size).toBe(PUZZLE_LEVELS.length);
  });
});
