import { describe, expect, it } from 'vitest';
import { level07 } from '../../src/puzzle/levels/level-07';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { piecesUsed, runLevel, starsFor } from '../../src/puzzle/run-level';
import type { Params } from '../../src/engine/types';
import type { PuzzleAnswer } from '../../src/puzzle/types';

const EMPTY: PuzzleAnswer = { nodes: [], wires: [] };
const sol = level07.solution;

function withParams(a: PuzzleAnswer, kind: string, params: Params): PuzzleAnswer {
  return { ...a, nodes: a.nodes.map((n) => (n.kind === kind ? { ...n, params: { ...n.params, ...params } } : n)) };
}

describe('level 7: phan-loai-mau', () => {
  it('is the seventh level, with the legs robot', () => {
    expect(PUZZLE_LEVELS[6]).toBe(level07);
    expect(PUZZLE_LEVELS.map((l) => l.id)).not.toContain('cau-nhap-nhay');
    expect(level07.cast).toEqual(['robot-legs']);
    expect(level07.base.nodes.find((n) => n.id === 'robot')?.params.look).toBe('robot-legs');
  });

  it('the reference solution wins well inside the time limit', () => {
    const r = runLevel(level07, sol);
    expect(r.outcome).toBe('win');
    expect(r.seconds).toBeLessThan(level07.timeLimit * 0.6);
  });

  it('an empty answer never wins (the robot just walks past the crates)', () => {
    expect(runLevel(level07, EMPTY).outcome).toBe('timeout');
  });

  it('removing any one solution wire fails', () => {
    for (const w of sol.wires) {
      const r = runLevel(level07, { ...sol, wires: sol.wires.filter((x) => x.id !== w.id) });
      expect(r.outcome, `without ${w.id}`).not.toBe('win');
    }
  });

  it('removing any one placed piece fails', () => {
    for (const n of sol.nodes) {
      const r = runLevel(level07, {
        nodes: sol.nodes.filter((m) => m.id !== n.id),
        wires: sol.wires.filter((w) => w.from.node !== n.id && w.to.node !== n.id),
      });
      expect(r.outcome, `without ${n.id}`).not.toBe('win');
    }
  });

  it('carrying a red crate into the store loses', () => {
    const r = runLevel(level07, withParams(sol, 'color-sensor', { want: 1 }));
    expect(r.outcome).toBe('lose');
    expect(r.message).toContain('đỏ');
  });

  it('a colour that is on no crate (yellow) never carries anything', () => {
    expect(runLevel(level07, withParams(sol, 'color-sensor', { want: 3 })).outcome).toBe('timeout');
  });

  it('grabbing on blue alone drops the crate on the next blue pad, so it never wins', () => {
    const eye = sol.nodes.find((n) => n.id === 's-eye')!;
    const blueOnly: PuzzleAnswer = {
      nodes: [eye],
      wires: [sol.wires[0]!, { id: 'x', from: { node: 's-eye', port: 'match' }, to: { node: 'gate', port: 'a' } }],
    };
    expect(runLevel(level07, blueOnly).outcome).not.toBe('win');
  });

  it('the "Đảo ngược" left unwired (always true) is the same as blue alone', () => {
    const noNotWire: PuzzleAnswer = { ...sol, wires: sol.wires.filter((w) => w.id !== 'sw3') };
    expect(runLevel(level07, noNotWire).outcome).not.toBe('win');
  });

  it('keeps the spare Hoặc out of the solution, tray holds one extra piece', () => {
    const spare = level07.tray.filter((t) => t.count > sol.nodes.filter((n) => n.kind === t.kind).length).map((t) => t.kind);
    expect(spare).toEqual(['or']);
    expect(level07.tray.map((t) => t.kind)).toContain('color-sensor');
    expect(level07.freeHints).toBe(3);
  });

  it('the red sensor setting is the tray start, so the player has to change it', () => {
    const start = level07.tray.find((t) => t.kind === 'color-sensor');
    expect(start?.params?.want).toBe(1);
    expect(level07.editable).toEqual([{ kind: 'color-sensor', paramId: 'want' }]);
  });

  describe('decoy Hoặc gives no cheaper win', () => {
    const eye = sol.nodes.find((n) => n.id === 's-eye')!;
    const not = sol.nodes.find((n) => n.id === 's-free')!;
    const and = sol.nodes.find((n) => n.id === 's-and')!;
    const or = { id: 'p-decoy', kind: 'or', params: {}, pos: { x: 100, y: 100 } };
    const wire = (from: [string, string], to: [string, string]) => ({ id: `${from.join('.')}>${to.join('.')}`, from: { node: from[0], port: from[1] }, to: { node: to[0], port: to[1] } });

    it('an over-built answer with the decoy wins but earns 2 stars; the solution earns 3', () => {
      const over: PuzzleAnswer = {
        nodes: [...sol.nodes, or],
        wires: [...sol.wires.filter((w) => w.id !== 'sw5'), wire(['s-and', 'out'], ['p-decoy', 'a']), wire(['p-decoy', 'out'], ['gate', 'a'])],
      };
      expect(piecesUsed(over)).toBe(level07.par + 1);
      expect(runLevel(level07, over).outcome).toBe('win');
      expect(starsFor(level07, over, 0)).toBe(2);
      expect(starsFor(level07, sol, 0)).toBe(3);
    });

    it('every wiring of at most two pieces fails to win', () => {
      const pieces = [eye, not, and, or];
      const outs: [string, string][] = [['robot', 'self'], ['hands', 'holding'], ['s-eye', 'match'], ['s-eye', 'index'], ['s-free', 'out'], ['s-and', 'out'], ['p-decoy', 'out']];
      const ins: [string, string][] = [['gate', 'a'], ['s-eye', 'who'], ['s-free', 'in'], ['s-and', 'a'], ['s-and', 'b'], ['p-decoy', 'a'], ['p-decoy', 'b']];
      let tried = 0;
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i; j < pieces.length; j++) {
          const nodes = j === i ? [pieces[i]!] : [pieces[i]!, pieces[j]!];
          const alive = new Set(['robot', 'hands', 'gate', ...nodes.map((n) => n.id)]);
          const cand = [];
          for (const o of outs) {
            for (const t of ins) {
              if (o[0] === t[0] || !alive.has(o[0]) || !alive.has(t[0])) continue;
              cand.push(wire(o, t));
            }
          }
          const grabs = cand.filter((w) => w.to.node === 'gate');
          const others = cand.filter((w) => w.to.node !== 'gate');
          // One wire into the locked "Và" that feeds "Nhấc lên", up to two more anywhere.
          for (const g of grabs) {
            for (let a = -1; a < others.length; a++) {
              for (let b = a; b < others.length; b++) {
                if (a === -1 && b !== -1) continue;
                const ws = [g, ...(a >= 0 ? [others[a]!] : []), ...(b > a ? [others[b]!] : [])];
                tried++;
                const r = runLevel(level07, { nodes, wires: ws }, 35);
                expect(r.outcome, ws.map((w) => w.id).join(' + ')).not.toBe('win');
              }
            }
          }
        }
      }
      expect(tried).toBeGreaterThan(100);
    }, 600_000);
  });
});
