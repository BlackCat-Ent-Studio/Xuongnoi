import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { getNodeDef } from '../../src/engine/registry';
import { TICK_DT, type InputSnapshot } from '../../src/engine/types';
import { HANDBOOK_MATH_OBJECT_OUTPUT } from '../../src/handbook/content-math-object-output';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { LESSONS } from '../../src/tutorial/lessons';
import { createWorld } from '../../src/world/world';

registerAllNodes();

const KINDS = [
  'const', 'math', 'counter', 'timer', 'random', 'map-range',
  'character', 'block', 'item', 'vehicle', 'portal', 'moving-platform', 'rotating-platform',
  'win-lose', 'show-number', 'show-text', 'guide-arrow', 'ui-meter',
];

const sorted = (a: Iterable<string>): string[] => [...a].sort();
const keys = (...k: string[]): InputSnapshot => ({ keysDown: new Set(k) });

describe('handbook: math, object and output pages', () => {
  it('covers exactly the 18 expected kinds once each', () => {
    expect(sorted(HANDBOOK_MATH_OBJECT_OUTPUT.map((e) => e.kind))).toEqual(sorted(KINDS));
  });

  for (const entry of HANDBOOK_MATH_OBJECT_OUTPUT) {
    describe(entry.kind, () => {
      const def = getNodeDef(entry.kind);

      it('matches the node definition', () => {
        expect(def).toBeDefined();
        if (!def) return;
        expect(sorted(Object.keys(entry.ports))).toEqual(sorted(new Set([...def.inputs, ...def.outputs].map((p) => p.id))));
        expect(sorted(Object.keys(entry.params))).toEqual(sorted(def.params.map((p) => p.id)));
      });

      it('has non-empty text', () => {
        const texts = [entry.purpose, entry.whenToUse, entry.example, ...entry.tips, ...Object.values(entry.ports), ...Object.values(entry.params)];
        for (const t of texts) expect(t.trim().length).toBeGreaterThan(0);
        expect(entry.tips.length).toBeGreaterThanOrEqual(2);
        expect(entry.tips.length).toBeLessThanOrEqual(4);
      });

      it('points at a real lesson', () => {
        expect(LESSONS.map((l) => l.id)).toContain(entry.lessonId);
      });

      it('has a try board that validates and runs 3 s headless', () => {
        const board = entry.tryBoard();
        expect(board.name).toBe('Thử: ' + (def?.label ?? ''));
        expect(board.graph.nodes.some((n) => n.kind === entry.kind)).toBe(true);
        expect(board.graph.nodes.length).toBeLessThanOrEqual(9); // 8 pieces + the "Khi bắt đầu" card the wire rule adds
        expect((board.notes ?? []).length).toBeGreaterThan(0);

        const res = parseBoard(serializeBoard(board));
        expect(res.ok).toBe(true);
        const world = createWorld(board.mode);
        const rt = createRuntime(board.graph, world, board.mode);
        expect(() => {
          for (let i = 0; i < 180; i++) {
            rt.tick(keys());
            world.step(TICK_DT);
          }
          for (let i = 0; i < 30; i++) {
            rt.tick(keys('ArrowRight', 'Space', 'KeyR'));
            world.step(TICK_DT);
          }
        }).not.toThrow();
        expect(world.entities().length).toBeGreaterThan(0);
      });

      it('returns a fresh board each call', () => {
        const a = entry.tryBoard();
        a.name = 'changed';
        expect(entry.tryBoard().name).not.toBe('changed');
      });
    });
  }
});
