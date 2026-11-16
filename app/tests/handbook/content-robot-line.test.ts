import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { getNodeDef } from '../../src/engine/registry';
import { TICK_DT } from '../../src/engine/types';
import { HANDBOOK_ROBOT_LINE } from '../../src/handbook/content-robot-line';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { LESSONS } from '../../src/tutorial/lessons';
import { createWorld } from '../../src/world/world';

registerAllNodes();

const sorted = (a: string[]): string[] => [...a].sort();

describe('handbook robot line content', () => {
  it('has a page for the line track and the line sensor, once each', () => {
    expect(sorted(HANDBOOK_ROBOT_LINE.map((e) => e.kind))).toEqual(['line-sensor', 'line-track']);
  });

  for (const entry of HANDBOOK_ROBOT_LINE) {
    describe(entry.kind, () => {
      const def = getNodeDef(entry.kind)!;

      it('explains exactly the ports and params of the node, with real text', () => {
        expect(sorted(Object.keys(entry.ports))).toEqual(sorted([...def.inputs, ...def.outputs].map((p) => p.id)));
        expect(sorted(Object.keys(entry.params))).toEqual(sorted(def.params.map((p) => p.id)));
        for (const s of [entry.purpose, entry.whenToUse, entry.example, ...entry.tips, ...Object.values(entry.ports), ...Object.values(entry.params)]) expect(s.trim().length).toBeGreaterThan(0);
        expect(entry.tips.length).toBeGreaterThanOrEqual(2);
        expect(entry.tips.length).toBeLessThanOrEqual(4);
      });

      it('points at an existing lesson', () => {
        expect(LESSONS.some((l) => l.id === entry.lessonId)).toBe(true);
      });

      it('has try-boards that are valid saved boards and run', { timeout: 60_000 }, () => {
        for (const make of [entry.tryBoard, ...(entry.extraTries ?? []).map((t) => t.board)]) {
          const board = make();
          expect(board.name.startsWith('Thử: ')).toBe(true);
          expect(board.graph.nodes.length).toBeLessThanOrEqual(10);
          expect(board.graph.nodes.some((n) => n.kind === 'line-track')).toBe(true);
          expect(board.graph.nodes.filter((n) => n.kind === 'line-sensor')).toHaveLength(2);
          expect((board.notes ?? []).length).toBeGreaterThan(0);
          expect(parseBoard(serializeBoard(board)).ok).toBe(true);
          const world = createWorld(board.mode);
          const rt = createRuntime(board.graph, world, board.mode);
          for (let i = 0; i < 180; i++) {
            rt.tick({ keysDown: new Set<string>() });
            world.step(TICK_DT);
          }
        }
      });
    });
  }

  it('the 3D try-board stands the character on a floor so it does not fall', () => {
    const board = HANDBOOK_ROBOT_LINE.find((e) => e.kind === 'line-sensor')!.extraTries![0]!.board();
    expect(board.mode).toBe('3d');
    const world = createWorld(board.mode);
    const rt = createRuntime(board.graph, world, board.mode);
    for (let i = 0; i < 120; i++) {
      rt.tick({ keysDown: new Set<string>() });
      world.step(TICK_DT);
    }
    const hero = world.entities().find((e) => e.kind === 'character')!;
    expect(hero.position.y).toBeGreaterThan(0.9);
  });
});
