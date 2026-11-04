import { describe, expect, it } from 'vitest';
import { level07 } from '../../src/puzzle/levels/archive/level-cau-nhap-nhay';
import { piecesUsed, runLevel, starsFor } from '../../src/puzzle/run-level';
import type { Params } from '../../src/engine/types';
import type { PuzzleAnswer } from '../../src/puzzle/types';

/** The retired level "Cầu nhấp nháy" is kept in the archive; its engine behaviour stays covered. */
const EMPTY: PuzzleAnswer = { nodes: [], wires: [] };

function withParams(a: PuzzleAnswer, kind: string, params: Params): PuzzleAnswer {
  return { ...a, nodes: a.nodes.map((n) => (n.kind === kind ? { ...n, params: { ...n.params, ...params } } : n)) };
}

function withoutWires(a: PuzzleAnswer, ...ids: string[]): PuzzleAnswer {
  return { ...a, wires: a.wires.filter((w) => !ids.includes(w.id)) };
}

describe('archived: cau-nhap-nhay', () => {
  it('a robot that always rolls falls into the water; one nobody sets rolling never moves', () => {
    // An unwired "Đảo ngược" is a steady "bật": wired to "Bật" it keeps the robot rolling.
    const always: PuzzleAnswer = { nodes: [{ id: 'on', kind: 'not', params: {}, pos: { x: 0, y: 0 } }], wires: [{ id: 'x', from: { node: 'on', port: 'out' }, to: { node: 'walk', port: 'go' } }] };
    expect(runLevel(level07, always).outcome).toBe('lose');
    expect(runLevel(level07, EMPTY).outcome).toBe('timeout');
    expect(runLevel(level07, withoutWires(level07.solution, 'sw2')).outcome).toBe('timeout');
  });

  it('a blink that is too quick drops the robot mid-bridge', () => {
    expect(runLevel(level07, withParams(level07.solution, 'timer', { seconds: 1 })).outcome).toBe('lose');
  });

  it('a range of blink times works', () => {
    for (const seconds of [2, 3, 5]) {
      expect(runLevel(level07, withParams(level07.solution, 'timer', { seconds })).outcome).toBe('win');
    }
  });

  it('a bridge that never follows the switch stays hidden, so the robot never wins', () => {
    const noFollow = withoutWires(level07.solution, 'sw4');
    expect(runLevel(level07, noFollow).outcome).not.toBe('win');
  });

  it('the bridge wire is required: without it the bridge stays hidden and the robot falls', () => {
    expect(runLevel(level07, withoutWires(level07.solution, 'sw4')).outcome).toBe('lose');
    expect(runLevel(level07, level07.solution).outcome).toBe('win');
  });

  it('no small wiring that skips the bridge input ever wins', () => {
    const sol = level07.solution;
    const nodes = [...sol.nodes, { id: 'x-and', kind: 'and', params: {}, pos: { x: 0, y: 0 } }];
    const outs: [string, string][] = [['s-timer', 'done'], ['s-latch', 'on'], ['s-not', 'out'], ['x-and', 'out']];
    const ins: [string, string][] = [['s-timer', 'run'], ['s-timer', 'reset'], ['s-latch', 'set'], ['s-latch', 'reset'], ['s-latch', 'toggle'], ['s-not', 'in'], ['x-and', 'a'], ['x-and', 'b']];
    const wire = (a: [string, string], c: [string, string]) => ({ id: `${a[0]}.${a[1]}>${c[0]}.${c[1]}`, from: { node: a[0], port: a[1] }, to: { node: c[0], port: c[1] } });
    for (const go of outs) {
      const goWire = wire(go, ['walk', 'go']);
      expect(runLevel(level07, { nodes, wires: [goWire] }).outcome, goWire.id).not.toBe('win');
      for (const o of outs) {
        for (const i of ins) {
          if (o[0] === i[0]) continue;
          const answer = { nodes, wires: [goWire, wire(o, i)] };
          expect(runLevel(level07, answer).outcome, `${goWire.id} + ${wire(o, i).id}`).not.toBe('win');
        }
      }
    }
  });

  it('a timer that never reaches the switch leaves the robot waiting, never winning', () => {
    const noTick = withoutWires(level07.solution, 'sw1');
    expect(runLevel(level07, noTick).outcome).toBe('timeout');
  });

  it('a timer that does not repeat still crosses once the bridge shows', () => {
    expect(runLevel(level07, withParams(level07.solution, 'timer', { repeat: 'no' })).outcome).toBe('win');
  });

  describe('decoy tray piece: an extra Và', () => {
    const sol = level07.solution;
    const decoy = { id: 'p-decoy', kind: 'and', params: {}, pos: { x: 100, y: 100 } };
    const dropNode = (id: string): PuzzleAnswer => ({
      nodes: sol.nodes.filter((n) => n.id !== id),
      wires: sol.wires.filter((w) => w.from.node !== id && w.to.node !== id),
    });

    it('is a spare tray piece the solution does not use', () => {
      const spare = level07.tray.filter((t) => t.count > sol.nodes.filter((n) => n.kind === t.kind).length).map((t) => t.kind);
      expect(spare).toEqual(['and']);
    });

    it('an over-built answer still wins, 2 stars without hints, solution gets 3', () => {
      const answer: PuzzleAnswer = {
        nodes: [...sol.nodes, decoy],
        wires: [
          ...sol.wires,
          { id: 'd1', from: { node: 's-latch', port: 'on' }, to: { node: 'p-decoy', port: 'a' } },
          { id: 'd2', from: { node: 's-not', port: 'out' }, to: { node: 'p-decoy', port: 'b' } },
        ],
      };
      expect(piecesUsed(answer)).toBe(level07.par + 1);
      expect(runLevel(level07, answer).outcome).toBe('win');
      expect(starsFor(level07, answer, 0)).toBe(2);
      expect(starsFor(level07, sol, 0)).toBe(3);
    });

    it('no answer with fewer than par pieces wins, even with the decoy standing in for a piece', () => {
      for (const n of sol.nodes) {
        const dropped = dropNode(n.id);
        expect(runLevel(level07, dropped).outcome, `without ${n.id}`).not.toBe('win');
        expect(runLevel(level07, { ...dropped, nodes: [...dropped.nodes, decoy] }).outcome, `decoy unwired for ${n.id}`).not.toBe('win');
        const swapped: PuzzleAnswer = { ...sol, nodes: sol.nodes.map((m) => (m.id === n.id ? { ...m, kind: 'and' } : m)) };
        expect(runLevel(level07, swapped).outcome, `and in place of ${n.id}`).not.toBe('win');
      }
    });
  });
});
