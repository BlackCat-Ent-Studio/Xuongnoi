import { describe, expect, it } from 'vitest';
import { level08 } from '../../src/puzzle/levels/archive/level-xuong-tong-hop';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { runLevel } from '../../src/puzzle/run-level';
import type { Params } from '../../src/engine/types';
import type { PuzzleAnswer, PuzzleLevel } from '../../src/puzzle/types';

/** The retired level "Xưởng tổng hợp" is kept in the archive; its engine behaviour stays covered. */
const EMPTY: PuzzleAnswer = { nodes: [], wires: [] };

function withParams(a: PuzzleAnswer, kind: string, params: Params): PuzzleAnswer {
  return { ...a, nodes: a.nodes.map((n) => (n.kind === kind ? { ...n, params: { ...n.params, ...params } } : n)) };
}

function withoutWires(a: PuzzleAnswer, ...ids: string[]): PuzzleAnswer {
  return { ...a, wires: a.wires.filter((w) => !ids.includes(w.id)) };
}

function onlyPieces(a: PuzzleAnswer, level: PuzzleLevel, keep: string[]): PuzzleAnswer {
  const alive = new Set([...level.base.nodes.map((n) => n.id), ...keep]);
  return { nodes: a.nodes.filter((n) => keep.includes(n.id)), wires: a.wires.filter((w) => alive.has(w.from.node) && alive.has(w.to.node)) };
}

describe('archived: xuong-tong-hop', () => {
  it('is no longer in the level list', () => {
    expect(PUZZLE_LEVELS.map((l) => l.id)).not.toContain(level08.id);
  });

  it('reference solution wins before the time limit; an empty answer does not', () => {
    const r = runLevel(level08, level08.solution);
    expect(r.outcome).toBe('win');
    expect(r.seconds).toBeLessThan(level08.timeLimit);
    expect(runLevel(level08, EMPTY).outcome).not.toBe('win');
  });

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
