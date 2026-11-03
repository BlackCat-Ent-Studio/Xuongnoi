import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Graph, type GraphNode, type InputSnapshot, type Params } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';
import { createAccumulator, createSimPacer } from '../../src/render/game-loop';

const noKeys: InputSnapshot = { keysDown: new Set() };
const node = (id: string, kind: string, params: Params = {}): GraphNode => ({ id, kind, params, pos: { x: 0, y: 0 } });
const wire = (id: string, from: [string, string], to: [string, string]) => ({
  id, from: { node: from[0], port: from[1] }, to: { node: to[0], port: to[1] },
});

beforeAll(() => registerAllNodes());

/** Floor + a character that runs right at full stick. */
function runnerGraph(speed = 5): Graph {
  return {
    nodes: [
      node('floor', 'block', { position: { x: 0, y: -1, z: 0 }, size: { x: 200, y: 1, z: 1 } }),
      node('hero', 'character', { position: { x: 0, y: 0.5, z: 0 }, speed, color: '#3b82f6' }),
      node('one', 'const', { value: 1 }),
    ],
    wires: [wire('w1', ['one', 'value'], ['hero', 'moveX'])],
  } as Graph;
}

function play(graph: Graph, ticks: number, onTick?: (i: number, rt: ReturnType<typeof createRuntime>) => void) {
  const world = createWorld('2d-side');
  const rt = createRuntime(graph, world, '2d-side');
  for (let i = 0; i < ticks; i++) {
    onTick?.(i, rt);
    rt.tick(noKeys);
    world.step(TICK_DT);
  }
  return { world, rt };
}

const heroX = (w: ReturnType<typeof createWorld>) => w.entities().find((e) => e.ownerNodeId === 'hero')!.position.x;

describe('sim pacer', () => {
  const FRAME = TICK_DT * 2;
  it('runs ticks when not paused', () => {
    const p = createSimPacer(createAccumulator());
    expect(p.stepsFor(FRAME)).toBe(2);
  });
  it('pause stops ticks and does not burst on resume', () => {
    const p = createSimPacer(createAccumulator());
    p.pause();
    let total = 0;
    for (let i = 0; i < 100; i++) total += p.stepsFor(0.1);
    expect(total).toBe(0);
    p.resume();
    expect(p.isPaused()).toBe(false);
    expect(p.stepsFor(TICK_DT)).toBe(1);
  });
  it('stepFrame advances exactly one tick while paused, then nothing', () => {
    const p = createSimPacer(createAccumulator());
    p.pause();
    p.requestStep();
    p.requestStep();
    expect(p.stepsFor(0.5)).toBe(1);
    expect(p.stepsFor(0.5)).toBe(0);
  });
  it('requestStep is ignored when running; reset clears pause', () => {
    const p = createSimPacer(createAccumulator());
    p.requestStep();
    p.pause();
    expect(p.stepsFor(0.5)).toBe(0);
    p.reset();
    expect(p.isPaused()).toBe(false);
  });
});

describe('determinism', () => {
  it('same graph gives identical results run to run', () => {
    expect(heroX(play(runnerGraph(), 120).world)).toBe(heroX(play(runnerGraph(), 120).world));
  });
  it('a paced run with a pause that skips frames matches an unpaused run of the same tick count', () => {
    const base = play(runnerGraph(), 60).world;
    const pacer = createSimPacer(createAccumulator());
    const world = createWorld('2d-side');
    const rt = createRuntime(runnerGraph(), world, '2d-side');
    let ticks = 0;
    const frame = (dt: number) => {
      for (let i = 0, n = pacer.stepsFor(dt); i < n; i++) {
        rt.tick(noKeys);
        world.step(TICK_DT);
        ticks++;
      }
    };
    for (let i = 0; i < 30; i++) frame(TICK_DT);
    pacer.pause();
    for (let i = 0; i < 50; i++) frame(TICK_DT);
    expect(ticks).toBe(30);
    pacer.resume();
    for (let i = 0; i < 30; i++) frame(TICK_DT);
    expect(ticks).toBe(60);
    expect(heroX(world)).toBe(heroX(base));
  });
});

describe('applyNodeParams', () => {
  it('speed change takes effect on the next tick', () => {
    const slow = heroX(play(runnerGraph(2), 120).world);
    const { world } = play(runnerGraph(2), 120, (i, rt) => {
      if (i === 60) expect(rt.applyNodeParams('hero', { speed: 8 })).toBe(true);
    });
    expect(heroX(world)).toBeGreaterThan(slow + 3);
  });

  it('colour applies to the running entity; look too', () => {
    const { world, rt } = play(runnerGraph(), 5);
    expect(rt.applyNodeParams('hero', { color: '#ff0000', look: 'robot' })).toBe(true);
    const hero = world.entities().find((e) => e.ownerNodeId === 'hero')!;
    expect(hero.color).toBe('#ff0000');
    expect(hero.look).toBe('robot');
  });

  it('timer duration keeps elapsed time', () => {
    const g = { nodes: [node('t', 'timer', { seconds: 10 }), node('s', 'on-start')], wires: [{ id: 'w1', from: { node: 's', port: 'started' }, to: { node: 't', port: 'run' } }] } as unknown as Graph;
    const world = createWorld('2d-side');
    const rt = createRuntime(g, world, '2d-side');
    for (let i = 0; i < 60; i++) rt.tick(noKeys);
    expect(rt.getOutput('t', 'left') as number).toBeCloseTo(9, 1);
    expect(rt.applyNodeParams('t', { seconds: 20 })).toBe(true);
    rt.tick(noKeys);
    expect(rt.getOutput('t', 'left') as number).toBeCloseTo(19, 1);
  });

  it('counter target is read live', () => {
    const g = { nodes: [node('c', 'counter', { target: 5 })], wires: [] } as unknown as Graph;
    const rt = createRuntime(g, createWorld('2d-side'), '2d-side');
    rt.tick(noKeys);
    expect(rt.getOutput('c', 'reached')).toBe(false);
    expect(rt.applyNodeParams('c', { target: 0 })).toBe(true);
    rt.tick(noKeys);
    expect(rt.getOutput('c', 'reached')).toBe(true);
  });

  it('rejects unknown node, unknown param, wrong type and create-only params', () => {
    const { world, rt } = play(runnerGraph(), 2);
    expect(rt.applyNodeParams('nope', { speed: 1 })).toBe(false);
    expect(rt.applyNodeParams('hero', { ghost: 1 })).toBe(false);
    expect(rt.applyNodeParams('hero', { speed: 'fast' })).toBe(false);
    expect(rt.applyNodeParams('hero', { speed: NaN })).toBe(false);
    const x = heroX(world);
    expect(rt.applyNodeParams('hero', { position: { x: 50, y: 1, z: 0 } })).toBe(false);
    expect(rt.applyNodeParams('hero', { role: 'bot' })).toBe(false);
    expect(heroX(world)).toBe(x);
  });

  it('mixed patch applies what it can but reports false', () => {
    const { rt } = play(runnerGraph(), 2);
    expect(rt.applyNodeParams('hero', { speed: 9, role: 'bot' })).toBe(false);
  });
});
