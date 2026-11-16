import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { getNodeDef, knownInputs, knownOutputs } from '../../src/engine/registry';
import { TICK_DT } from '../../src/engine/types';
import { HANDBOOK_ROBOT_CTRL } from '../../src/handbook/content-robot-ctrl';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { LESSONS } from '../../src/tutorial/lessons';
import { createWorld } from '../../src/world/world';

registerAllNodes();

const sorted = (a: Iterable<string>): string[] => [...a].sort();

describe('handbook: control and measurement pages', () => {
  it('covers pid and signal-plot', () => {
    expect(sorted(HANDBOOK_ROBOT_CTRL.map((e) => e.kind))).toEqual(['pid', 'signal-plot']);
  });

  for (const entry of HANDBOOK_ROBOT_CTRL) {
    describe(entry.kind, () => {
      const def = getNodeDef(entry.kind)!;

      it('explains every port (optional ones too) and every param, with non-empty text', () => {
        expect(sorted(Object.keys(entry.ports))).toEqual(sorted(new Set([...knownInputs(def), ...knownOutputs(def)].map((p) => p.id))));
        expect(sorted(Object.keys(entry.params))).toEqual(sorted(def.params.map((p) => p.id)));
        const texts = [entry.purpose, entry.whenToUse, entry.example, ...entry.tips, ...Object.values(entry.ports), ...Object.values(entry.params)];
        for (const t of texts) expect(t.trim().length).toBeGreaterThan(0);
      });

      it('points at a registered lesson', () => {
        expect(LESSONS.some((l) => l.id === entry.lessonId)).toBe(true);
      });

      it('has a try board that round-trips, uses the node and plays 12 s with the robot chasing the target', () => {
        const board = entry.tryBoard();
        expect(board.graph.nodes.some((n) => n.kind === entry.kind)).toBe(true);
        const parsed = parseBoard(serializeBoard(board));
        expect(parsed.ok).toBe(true);
        if (parsed.ok) expect(parsed.board.graph.wires).toEqual(board.graph.wires);
        const world = createWorld(board.mode);
        const rt = createRuntime(board.graph, world, board.mode);
        const robot = board.graph.nodes.find((n) => n.kind === 'character')!.id;
        const xs: number[] = [];
        for (let k = 0; k < 60 * 12; k++) {
          rt.tick({ keysDown: new Set() });
          world.step(TICK_DT);
          if (k % 60 === 59) xs.push(world.entities().find((e) => e.ownerNodeId === robot)!.position.x);
        }
        // The target flips every 4 s between -5 and 5: after each half the robot has to be near it.
        expect(xs[3]!).toBeGreaterThan(4);
        expect(xs[7]!).toBeLessThan(-4);
        const plot = world.hudItems().find((h) => h.widget?.type === 'plot');
        expect(plot?.hidden).toBe(false);
        expect(plot?.widget?.type === 'plot' && plot.widget.traces.length).toBe(3);
      });
    });
  }
});
