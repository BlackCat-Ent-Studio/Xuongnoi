import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { getNodeDef } from '../../src/engine/registry';
import { TICK_DT, type InputSnapshot } from '../../src/engine/types';
import { handbookEntry } from '../../src/handbook';
import { HANDBOOK_ROBOT_DRIVE } from '../../src/handbook/content-robot-drive';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { LESSONS } from '../../src/tutorial/lessons';
import { createWorld } from '../../src/world/world';

registerAllNodes();

const sorted = (a: Iterable<string>): string[] => [...a].sort();
const keys = (...k: string[]): InputSnapshot => ({ keysDown: new Set(k) });

describe('handbook: robot drive pages', () => {
  it('covers the chassis and the motor, once each, and the handbook finds them', () => {
    expect(sorted(HANDBOOK_ROBOT_DRIVE.map((e) => e.kind))).toEqual(['motor', 'robot-body']);
    for (const e of HANDBOOK_ROBOT_DRIVE) expect(handbookEntry(e.kind)).toBe(e);
  });

  for (const entry of HANDBOOK_ROBOT_DRIVE) {
    describe(entry.kind, () => {
      const def = getNodeDef(entry.kind);

      it('explains every port and every parameter of the node definition', () => {
        expect(def).toBeDefined();
        if (!def) return;
        expect(sorted(Object.keys(entry.ports))).toEqual(sorted(new Set([...def.inputs, ...def.outputs].map((p) => p.id))));
        expect(sorted(Object.keys(entry.params))).toEqual(sorted(def.params.map((p) => p.id)));
      });

      it('has non-empty text and a real lesson', () => {
        const texts = [entry.purpose, entry.whenToUse, entry.example, ...entry.tips, ...Object.values(entry.ports), ...Object.values(entry.params)];
        for (const t of texts) expect(t.trim().length).toBeGreaterThan(0);
        expect(entry.tips.length).toBeGreaterThanOrEqual(2);
        expect(entry.tips.length).toBeLessThanOrEqual(4);
        expect(LESSONS.map((l) => l.id)).toContain(entry.lessonId);
      });

      it('has a try board that is a valid saved board, is small, and shows the robot driving', () => {
        const board = entry.tryBoard();
        expect(board.name).toBe('Thử: ' + (def?.label ?? ''));
        expect(board.graph.nodes.some((n) => n.kind === entry.kind)).toBe(true);
        expect(board.graph.nodes.some((n) => n.kind === 'robot-body')).toBe(true);
        expect(board.graph.nodes.filter((n) => n.kind === 'motor')).toHaveLength(2);
        expect(board.graph.nodes.length).toBeLessThanOrEqual(9);
        expect((board.notes ?? []).length).toBeGreaterThan(0);
        expect(parseBoard(serializeBoard(board)).ok).toBe(true);

        const world = createWorld(board.mode);
        const rt = createRuntime(board.graph, world, board.mode);
        const robotAt = () => world.entities().find((e) => e.kind === 'robot')!;
        const start = { ...robotAt().position };
        for (let i = 0; i < 120; i++) {
          rt.tick(keys('ArrowUp'));
          world.step(TICK_DT);
        }
        const moved = Math.hypot(robotAt().position.x - start.x, robotAt().position.z - start.z);
        // The motor board needs the keys; the chassis board drives itself from its constants.
        expect(moved).toBeGreaterThan(0.5);
      });
    });
  }
});
