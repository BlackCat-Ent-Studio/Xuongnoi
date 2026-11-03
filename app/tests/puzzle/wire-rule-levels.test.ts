import { describe, expect, it } from 'vitest';
import { FORMERLY_ON_BY_DEFAULT } from '../../src/editor/graph/wire-rule-migration';
import type { GraphNode } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { buildPlayGraph, runLevel } from '../../src/puzzle/run-level';
import { startMayJoin } from '../../src/puzzle/ui/board-state';

registerAllNodes();

const LEVELS = PUZZLE_LEVELS.filter((l) => l.order <= 7);

/** Every node a level can put on the board: locked ones, tray pieces with their preset params, and the reference answer's. */
function everyNode(level: (typeof LEVELS)[number]): GraphNode[] {
  const trays: GraphNode[] = level.tray.map((t, i) => ({ id: `tray-${i}`, kind: t.kind, params: t.params ?? {}, pos: { x: 0, y: 0 } }));
  return [...level.base.nodes, ...trays, ...level.solution.nodes];
}

describe('the puzzle levels follow "every action needs its own wire"', () => {
  it('covers levels 1 to 7', () => {
    expect(LEVELS.map((l) => l.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  for (const level of LEVELS) {
    describe(`level ${level.order} (${level.id})`, () => {
      it('never uses the one-key carry mode (one input that both lifts and puts down)', () => {
        for (const n of everyNode(level).filter((x) => x.kind === 'carry')) expect(n.params.mode ?? 'separate', n.id).toBe('separate');
      });

      it('never uses the legacy stop-at-every-point or turn-at-stop settings of the route piece', () => {
        for (const n of everyNode(level).filter((x) => x.kind === 'route-follow')) {
          expect(Number(n.params.stopFor ?? 0), `${n.id} stopFor`).toBe(0);
          expect(n.params.faceAtStop ?? 'none', `${n.id} faceAtStop`).toBe('none');
        }
      });

      it('has a wire into the switch-on input of every brain, timer, platform and portal in the finished board', () => {
        const graph = buildPlayGraph(level, level.solution);
        for (const n of graph.nodes) {
          for (const rule of FORMERLY_ON_BY_DEFAULT.filter((r) => r.kind === n.kind && r.kind !== 'block')) {
            const wired = graph.wires.some((w) => w.to.node === n.id && w.to.port === rule.port);
            expect(wired, `${n.id}.${rule.port}`).toBe(true);
          }
        }
      });

      it('stops acting when a wire into a switch-on input is taken away', () => {
        const nodes = [...level.base.nodes, ...level.solution.nodes];
        const kindOf = (id: string): string | undefined => nodes.find((n) => n.id === id)?.kind;
        const enabling = level.solution.wires.filter((w) => FORMERLY_ON_BY_DEFAULT.some((r) => r.kind === kindOf(w.to.node) && r.port === w.to.port));
        expect(enabling.length).toBeGreaterThan(0);
        for (const w of enabling) {
          const r = runLevel(level, { ...level.solution, wires: level.solution.wires.filter((x) => x.id !== w.id) });
          expect(r.outcome, `without ${w.id}`).not.toBe('win');
        }
      }, 120_000);

      it('only lets "Khi bắt đầu" switch a piece on, never feed the logic of the level', () => {
        const graph = buildPlayGraph(level, level.solution);
        for (const w of level.solution.wires) {
          expect(startMayJoin(graph, w.from, w.to), w.id).toBe(true);
        }
        const door = graph.nodes.find((n) => n.kind === 'latch' || n.kind === 'counter' || n.kind === 'win-lose');
        const start = graph.nodes.find((n) => n.kind === 'on-start');
        if (door && start) expect(startMayJoin(graph, { node: start.id, port: 'started' }, { node: door.id, port: door.kind === 'win-lose' ? 'win' : 'set' }), `${door.kind}`).toBe(false);
      });
    });
  }
});
