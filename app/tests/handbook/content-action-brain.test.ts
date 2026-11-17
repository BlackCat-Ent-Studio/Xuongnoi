import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type InputSnapshot } from '../../src/engine/types';
import { getNodeDef, knownInputs, knownOutputs } from '../../src/engine/registry';
import { HANDBOOK_ACTION_BRAIN } from '../../src/handbook/content-action-brain';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { LESSONS } from '../../src/tutorial/lessons';
import { createWorld } from '../../src/world/world';

registerAllNodes();

const KINDS = ['carry', 'interact', 'hand-tool', 'health', 'enter-exit', 'cargo', 'camera', 'teleport', 'shooter', 'spawner', 'patrol', 'go-to', 'route-follow', 'chase', 'sequence', 'fight'];
const sorted = (a: string[]): string[] => [...a].sort();
const filled = (s: string): boolean => s.trim().length > 0;

describe('handbook action-brain content', () => {
  it('covers exactly the 16 expected kinds, once each', () => {
    expect(sorted(HANDBOOK_ACTION_BRAIN.map((e) => e.kind))).toEqual(sorted(KINDS));
  });

  for (const entry of HANDBOOK_ACTION_BRAIN) {
    describe(entry.kind, () => {
      const def = getNodeDef(entry.kind);

      it('is a registered node kind', () => {
        expect(def).toBeDefined();
      });

      it('explains exactly the def ports and params', () => {
        const documented = new Set(Object.keys(entry.ports));
        const known = new Set([...knownInputs(def!), ...knownOutputs(def!)].map((p) => p.id));
        // Every always-shown port is explained; a page may also explain switched-on ones, but never an unknown id.
        expect(sorted([...def!.inputs, ...def!.outputs].map((p) => p.id).filter((id) => !documented.has(id)))).toEqual([]);
        expect(sorted([...documented].filter((id) => !known.has(id)))).toEqual([]);
        expect(sorted(Object.keys(entry.params))).toEqual(sorted(def!.params.map((p) => p.id)));
      });

      it('has non-empty texts', () => {
        for (const s of [entry.purpose, entry.whenToUse, entry.example, ...entry.tips, ...Object.values(entry.ports), ...Object.values(entry.params)]) expect(filled(s)).toBe(true);
        expect(entry.tips.length).toBeGreaterThanOrEqual(2);
        expect(entry.tips.length).toBeLessThanOrEqual(4);
      });

      it('points at an existing lesson', () => {
        expect(LESSONS.some((l) => l.id === entry.lessonId)).toBe(true);
      });

      it('tryBoard is a valid saved board that runs 3 s headless', { timeout: 60_000 }, () => {
        const board = entry.tryBoard();
        expect(board.name.startsWith('Thử: ')).toBe(true);
        expect(board.graph.nodes.length).toBeGreaterThanOrEqual(2);
        expect(board.graph.nodes.length).toBeLessThanOrEqual(10);
        expect(board.graph.nodes.some((n) => n.kind === entry.kind)).toBe(true);
        expect((board.notes ?? []).length).toBeGreaterThan(0);

        const parsed = parseBoard(serializeBoard(board));
        expect(parsed.ok).toBe(true);

        const world = createWorld(board.mode);
        const rt = createRuntime(board.graph, world, board.mode);
        const idle: InputSnapshot = { keysDown: new Set<string>() };
        expect(() => {
          for (let i = 0; i < 180; i++) {
            rt.tick(idle);
            world.step(TICK_DT);
          }
        }).not.toThrow();
        expect(world.entities().length).toBeGreaterThan(0);
      });
    });
  }

  it('self-running boards visibly move something within 3 s', () => {
    for (const make of [HANDBOOK_ACTION_BRAIN.find((e) => e.kind === 'patrol'), HANDBOOK_ACTION_BRAIN.find((e) => e.kind === 'go-to'), HANDBOOK_ACTION_BRAIN.find((e) => e.kind === 'route-follow'), HANDBOOK_ACTION_BRAIN.find((e) => e.kind === 'chase'), HANDBOOK_ACTION_BRAIN.find((e) => e.kind === 'sequence'), HANDBOOK_ACTION_BRAIN.find((e) => e.kind === 'fight')]) {
      const board = make!.tryBoard();
      const world = createWorld(board.mode);
      const rt = createRuntime(board.graph, world, board.mode);
      const idle: InputSnapshot = { keysDown: new Set<string>() };
      rt.tick(idle);
      world.step(TICK_DT);
      const before = new Map(world.entities().map((e) => [e.id, { ...e.position }]));
      for (let i = 0; i < 180; i++) {
        rt.tick(idle);
        world.step(TICK_DT);
      }
      const moved = world.entities().some((e) => {
        const b = before.get(e.id);
        return b !== undefined && Math.hypot(e.position.x - b.x, e.position.z - b.z) > 0.5;
      });
      expect(moved, make!.kind).toBe(true);
    }
  });
});
