import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { getNodeDef } from '../../src/engine/registry';
import { TICK_DT } from '../../src/engine/types';
import { HANDBOOK_INPUT_LOGIC } from '../../src/handbook/content-input-logic';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { LESSONS } from '../../src/tutorial/lessons';
import { createWorld } from '../../src/world/world';

registerAllNodes();

const KINDS = [
  'key', 'stick', 'on-start', 'ui-button', 'ui-pick', 'ui-dialog', 'ui-start',
  'and', 'or', 'not', 'compare', 'touch', 'select-number', 'latch', 'zone', 'distance', 'speed-sensor', 'ahead-sensor', 'vision-sensor', 'color-sensor', 'next-free-slot', 'nearest-item', 'sight-forecast',
];

const sorted = (a: string[]): string[] => [...a].sort();

describe('handbook input and logic pages', () => {
  it('covers exactly the 23 input and logic kinds once each', () => {
    expect(sorted(HANDBOOK_INPUT_LOGIC.map((e) => e.kind))).toEqual(sorted(KINDS));
  });

  for (const entry of HANDBOOK_INPUT_LOGIC) {
    describe(entry.kind, () => {
      const def = getNodeDef(entry.kind);

      it('is a registered node kind with ports and params matching its definition', () => {
        expect(def).toBeDefined();
        expect(sorted(Object.keys(entry.ports))).toEqual(sorted([...def!.inputs, ...def!.outputs].map((p) => p.id)));
        expect(sorted(Object.keys(entry.params))).toEqual(sorted(def!.params.map((p) => p.id)));
      });

      it('has non-empty texts and a real lesson', () => {
        for (const s of [entry.purpose, entry.whenToUse, entry.example, ...Object.values(entry.ports), ...Object.values(entry.params), ...entry.tips]) {
          expect(s.trim().length).toBeGreaterThan(0);
        }
        expect(entry.tips.length).toBeGreaterThanOrEqual(2);
        expect(entry.tips.length).toBeLessThanOrEqual(4);
        expect(LESSONS.some((l) => l.id === entry.lessonId)).toBe(true);
      });

      it('tryBoard validates, uses the node, and runs 3 seconds headless', () => {
        const board = entry.tryBoard();
        expect(board.name).toBe(`Thử: ${def!.label}`);
        expect(board.graph.nodes.some((n) => n.kind === entry.kind)).toBe(true);
        expect(board.graph.nodes.length).toBeLessThanOrEqual(9); // 8 pieces + the "Khi bắt đầu" card the wire rule adds
        expect(board.notes?.length).toBeGreaterThan(0);

        const parsed = parseBoard(serializeBoard(board));
        expect(parsed.ok).toBe(true);

        const world = createWorld(board.mode);
        const rt = createRuntime(board.graph, world, board.mode);
        const ticks = Math.ceil(3 / TICK_DT);
        expect(() => {
          for (let i = 0; i < ticks; i++) {
            rt.tick({ keysDown: new Set(i % 2 === 0 ? ['ArrowRight', 'Space'] : ['KeyE']) });
            world.step(TICK_DT);
          }
        }).not.toThrow();
      });
    });
  }
});
