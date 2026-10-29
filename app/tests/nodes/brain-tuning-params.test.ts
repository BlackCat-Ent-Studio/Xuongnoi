import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Graph, type Params, type Vec3 } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** One tick of a bot at x=0 driven by `kind`, with a still prey at `preyX`; returns the brain's moveX. */
function moveX(kind: 'chase' | 'go-to', params: Params, preyX: number): number {
  const at = { x: 0, y: 0 };
  const wire = (fn: string, fp: string, tn: string, tp: string, i: number) => ({
    id: `w${i}`,
    from: { node: fn, port: fp },
    to: { node: tn, port: tp },
  });
  const graph: Graph = {
    nodes: [
      { id: 'hero', kind: 'character', params: { position: v(0, 1, 0), speed: 5, role: 'bot' }, pos: at },
      { id: 'prey', kind: 'character', params: { position: v(preyX, 1, 0), speed: 0 }, pos: at },
      { id: 'b', kind, params: { pathfind: 'off', ...params }, pos: at },
      { id: 'f', kind: 'block', params: { position: v(0, -0.5, 0), size: v(60, 1, 1) }, pos: at },
    ],
    wires: [wire('hero', 'self', 'b', 'self', 0), wire('prey', 'self', 'b', 'target', 1)],
  };
  const world = createWorld('2d-side');
  const rt = createRuntime(graph, world, '2d-side');
  rt.tick({ keysDown: new Set() });
  world.step(TICK_DT);
  return rt.getOutput('b', 'moveX') as number;
}

describe('chase tuning params', () => {
  it('catchDistance: default 0.4 keeps walking at 1 away, a wider one stops', () => {
    expect(Math.abs(moveX('chase', { sightRange: 6 }, 1))).toBeGreaterThan(0);
    expect(moveX('chase', { sightRange: 6, catchDistance: 0.4 }, 1)).not.toBe(0);
    expect(moveX('chase', { sightRange: 6, catchDistance: 2 }, 1)).toBe(0);
  });

  it('fleeReach: a shorter flee target slows the bot more than the default', () => {
    const base = { mode: 'flee', sightRange: 6, slowRadius: 3 };
    const def = Math.abs(moveX('chase', base, 2));
    expect(Math.abs(moveX('chase', { ...base, fleeReach: 4 }, 2))).toBeCloseTo(def, 6);
    expect(Math.abs(moveX('chase', { ...base, fleeReach: 1 }, 2))).toBeLessThan(def);
  });

  it('slowRadius: default full speed at 0.9 away, a larger radius eases off', () => {
    expect(Math.abs(moveX('chase', { sightRange: 6 }, 0.9))).toBe(1);
    expect(Math.abs(moveX('chase', { sightRange: 6, slowRadius: 3 }, 0.9))).toBeLessThan(1);
  });
});

describe('go-to tuning params', () => {
  it('slowRadius: default full speed at 0.9 away, a larger radius eases off', () => {
    expect(Math.abs(moveX('go-to', {}, 0.9))).toBe(1);
    expect(Math.abs(moveX('go-to', { slowRadius: 0.6 }, 0.9))).toBe(1);
    expect(Math.abs(moveX('go-to', { slowRadius: 3 }, 0.9))).toBeLessThan(1);
  });
});
