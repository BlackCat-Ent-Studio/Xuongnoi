import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT } from '../../src/engine/types';
import { listSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { stepBreakKeys } from '../../src/render/step-break';
import { createWorld } from '../../src/world/world';
import { inputAt } from './solid-helpers';

registerAllNodes();

describe('step break on the editor samples', () => {
  it('every sample pauses on a wired output, and only on wired outputs', () => {
    const none: string[] = [];
    for (const s of listSamples()) {
      const { graph, mode } = s.board;
      const wired = new Set(graph.wires.map((w) => `${w.from.node}|${w.from.port}`));
      const rule = { accepts: (key: string): boolean => wired.has(key) };
      const world = createWorld(mode);
      const rt = createRuntime(graph, world, mode);
      let breaks = 0;
      for (let i = 0; i < 600 && !world.ended; i++) {
        rt.tick(inputAt(i));
        world.step(TICK_DT);
        const fired = stepBreakKeys(rule, rt);
        if (fired) {
          breaks++;
          for (const k of fired) expect(wired.has(k)).toBe(true);
        }
      }
      if (breaks === 0) none.push(s.id);
    }
    expect(none).toEqual([]);
  });
});
