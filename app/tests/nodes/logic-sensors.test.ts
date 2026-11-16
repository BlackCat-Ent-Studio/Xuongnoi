import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type EntityView, type InputSnapshot } from '../../src/engine/types';
import { listAllSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { distanceNode } from '../../src/nodes/distance';
import { latchNode } from '../../src/nodes/latch';
import { mapRangeNode } from '../../src/nodes/map-range';
import { createRng, randomNode } from '../../src/nodes/random';
import { zoneSensorNode } from '../../src/nodes/zone-sensor';
import { createWorld } from '../../src/world/world';
import { makeCtx, makeWorld, runNode } from './fake-world';

const keys = (...k: string[]): InputSnapshot => ({ keysDown: new Set(k) });

describe('random node', () => {
  const roll = (n: number) => Array.from({ length: n }, (_, i) => ({ inputs: { roll: i % 2 === 1 } }));

  it('same seed gives the same sequence, in range and whole', () => {
    const a = runNode(randomNode, roll(40), { seed: 7 }).map((o) => o.value);
    const b = runNode(randomNode, roll(40), { seed: 7 }).map((o) => o.value);
    expect(a).toEqual(b);
    expect(a[0]).toBe(0);
    for (const v of a.slice(1)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
    expect(new Set(a).size).toBeGreaterThan(2);
  });

  it('seed 0 follows the world run seed', () => {
    const w1 = makeWorld();
    const w2 = makeWorld();
    w2.runSeed = () => 999;
    const a = runNode(randomNode, roll(30), { seed: 0, mode: 'tick' }, w1).map((o) => o.value);
    const b = runNode(randomNode, roll(30), { seed: 0, mode: 'tick' }, w2).map((o) => o.value);
    expect(a).not.toEqual(b);
  });

  it('press mode only changes on a rising edge and reports it', () => {
    const out = runNode(randomNode, [{ inputs: { roll: false } }, { inputs: { roll: true } }, { inputs: { roll: true } }, { inputs: { roll: false } }], { seed: 3 });
    expect(out.map((o) => o.rolled)).toEqual([false, true, false, false]);
    expect(out[2]!.value).toBe(out[1]!.value);
    expect(out[0]!.value).toBe(0);
  });

  it('start mode never re-rolls; decimals stay in range; swapped bounds are tolerated', () => {
    const fixed = runNode(randomNode, roll(10), { seed: 5, mode: 'start' }).map((o) => o.value);
    expect(new Set(fixed).size).toBe(1);
    const dec = runNode(randomNode, roll(50), { seed: 5, mode: 'tick', whole: 'no', min: 10, max: 2 }).map((o) => o.value as number);
    expect(dec.every((v) => v >= 2 && v <= 10)).toBe(true);
    expect(dec.some((v) => !Number.isInteger(v))).toBe(true);
  });

  it('createRng is deterministic and in [0, 1)', () => {
    const r1 = createRng(1);
    const r2 = createRng(1);
    for (let i = 0; i < 100; i++) {
      const v = r1();
      expect(v).toBe(r2());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('latch node', () => {
  const step = (set = false, reset = false, toggle = false) => ({ inputs: { set, reset, toggle } });

  it('remembers set, reset and toggle edges', () => {
    const out = runNode(latchNode, [step(), step(true), step(), step(false, false, true), step(), step(false, true), step(), step(true, true)]);
    expect(out.map((o) => o.on)).toEqual([false, true, true, false, false, false, false, false]);
  });

  it('starts on when asked, and a held toggle flips only once', () => {
    const out = runNode(latchNode, [step(), step(false, false, true), step(false, false, true)], { start: 'on' });
    expect(out.map((o) => o.on)).toEqual([true, false, false]);
  });
});

describe('map-range node', () => {
  const run = (value: number, over = {}) => runNode(mapRangeNode, [{ inputs: { value } }], { inMin: 0, inMax: 10, outMin: 100, outMax: 0, ...over })[0]!.value;

  it('maps linearly, including reversed scales', () => {
    expect(run(0)).toBe(100);
    expect(run(5)).toBe(50);
    expect(run(10)).toBe(0);
  });

  it('clamps unless told not to', () => {
    expect(run(20)).toBe(0);
    expect(run(20, { clamp: 'no' })).toBe(-100);
  });

  it('a zero-width input scale gives the start of the new scale', () => {
    expect(run(3, { inMin: 2, inMax: 2 })).toBe(100);
  });
});

describe('distance node', () => {
  it('measures between two entities and flags the threshold', () => {
    const w = makeWorld();
    const a = w.spawn({ kind: 'character', ownerNodeId: 'a', position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#fff', solid: true });
    const b = w.spawn({ kind: 'block', ownerNodeId: 'b', position: { x: 3, y: 4, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#fff', solid: true });
    const out = runNode(distanceNode, [{ inputs: { a, b } }], { threshold: 5 }, w)[0]!;
    expect(out.distance).toBe(5);
    expect(out.within).toBe(true);
    expect(runNode(distanceNode, [{ inputs: { a, b } }], { threshold: 4.9 }, w)[0]!.within).toBe(false);
  });

  it('missing objects give 0 and not near', () => {
    expect(runNode(distanceNode, [{ inputs: { a: null, b: 'nope' } }])[0]).toEqual({ distance: 0, within: false });
  });
});

describe('zone sensor node', () => {
  function setup(filter = 'character') {
    const world = createWorld('2d-side');
    const params = { center: { x: 0, y: 1, z: 0 }, size: { x: 4, y: 2, z: 1 }, filter, color: '#22c55e' };
    const state = zoneSensorNode.create!(makeCtx(world), params);
    let tick = 0;
    const read = () => zoneSensorNode.evaluate(makeCtx(world, { tick: tick++ }), {}, params, state);
    return { world, read };
  }
  const spec = (kind: 'character' | 'item' | 'vehicle', x: number, role?: 'player' | 'bot') => ({
    kind,
    ownerNodeId: `${kind}${x}`,
    position: { x, y: 1, z: 0 },
    size: { x: 0.8, y: 1, z: 0.8 },
    color: '#f00',
    solid: kind !== 'item',
    ...(role ? { role } : {}),
  });

  it('shows a translucent marker before the run and hides it on the first tick', () => {
    const { world, read } = setup();
    const marker = world.entities().find((e: EntityView) => e.zone);
    expect(marker?.visible).toBe(true);
    read();
    expect(world.entities().find((e: EntityView) => e.zone)?.visible).toBe(false);
  });

  it('reports inside / entered / exited / count / first', () => {
    const { world, read } = setup();
    expect(read()).toMatchObject({ inside: false, count: 0, first: null });
    const id = world.spawn(spec('character', 0));
    world.spawn(spec('character', 1));
    world.spawn(spec('character', 20));
    const inn = read();
    expect(inn).toMatchObject({ inside: true, entered: true, exited: false, count: 2, first: id });
    expect(read()).toMatchObject({ inside: true, entered: false, exited: false });
    world.hide(id);
    expect(read()).toMatchObject({ count: 1 });
    world.hide(world.entities().find((e: EntityView) => e.ownerNodeId === 'character1')!.id);
    expect(read()).toMatchObject({ inside: false, exited: true, count: 0 });
  });

  it('filters by kind and role', () => {
    const cases: [string, number][] = [
      ['player', 1],
      ['bot', 1],
      ['item', 1],
      ['vehicle', 1],
      ['character', 2],
    ];
    for (const [filter, expected] of cases) {
      const { world, read } = setup(filter);
      world.spawn(spec('character', 0, 'player'));
      world.spawn(spec('character', 0.5, 'bot'));
      world.spawn(spec('item', 0));
      world.spawn(spec('vehicle', 0));
      expect(read().count, filter).toBe(expected);
    }
  });
});

describe('dice-zones sample', () => {
  const board = (): Board => listAllSamples().find((s) => s.id === 'dice-zones')!.board;

  function start() {
    registerAllNodes();
    const b = board();
    // Fix the dice seed so the scripted run is reproducible.
    b.graph.nodes.find((n) => n.id === 'dice')!.params.seed = 11;
    const world = createWorld(b.mode);
    const rt = createRuntime(b.graph, world, b.mode);
    const step = (input: InputSnapshot, n = 1): void => {
      for (let i = 0; i < n; i++) {
        rt.tick(input);
        world.step(TICK_DT);
      }
    };
    return { world, rt, step };
  }

  it('rolling outside the zone does nothing, inside it rolls; luck opens the goal', () => {
    const g = start();
    g.step(keys(), 30);
    expect(g.rt.getOutput('dist', 'within')).toBe(false);
    // Standing at the start (x = -5) is outside the zone: E is ignored.
    g.step(keys('KeyE'));
    g.step(keys());
    expect(g.rt.getOutput('dice-zone', 'inside')).toBe(false);
    expect(g.rt.getOutput('dice', 'rolled')).toBe(false);
    // Walk into the zone.
    for (let i = 0; i < 200 && g.rt.getOutput('dice-zone', 'inside') !== true; i++) g.step(keys('ArrowRight'));
    expect(g.rt.getOutput('dice-zone', 'inside')).toBe(true);
    // Roll until a 5 or 6 comes up (seed fixed, so this is the same every run).
    let rolls = 0;
    while (g.rt.getOutput('luck', 'on') !== true && rolls < 60) {
      g.step(keys('KeyE'));
      const v = Number(g.rt.getOutput('dice', 'value'));
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      g.step(keys());
      rolls++;
    }
    expect(g.rt.getOutput('luck', 'on')).toBe(true);
    expect(g.world.ended).toBeNull();
    // Run right to the flag.
    for (let i = 0; i < 900 && !g.world.ended; i++) g.step(keys('ArrowRight'));
    expect(g.world.ended?.result).toBe('win');
  });

  it('reaching the flag without luck does not win', () => {
    const g = start();
    let wasNear = false;
    for (let i = 0; i < 600; i++) {
      g.step(keys('ArrowRight'));
      wasNear ||= g.rt.getOutput('dist', 'within') === true;
    }
    expect(wasNear).toBe(true);
    expect(g.world.ended).toBeNull();
  });
});
