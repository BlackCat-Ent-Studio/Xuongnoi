import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Graph, type GraphNode, type Params, type Vec3 } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { routeNoteOf } from '../../src/nodes/sight-notes';
import { createWorld } from '../../src/world/world';
import { wireStarts } from '../helpers/wire-starts';

beforeAll(() => registerAllNodes());

const v = (x: number, z: number): Vec3 => ({ x, y: 0.5, z });

/** A bot on a floor with a three-point route 4 units apart, run one leg at a time; the Space key drives "Chạy". */
function setup(extra: Params = {}) {
  const nodes: [string, string, Params][] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 20 }, color: '#888' }],
    ['bot', 'character', { position: { x: 0, y: 1, z: 0 }, speed: 4, role: 'bot' }],
    ['route', 'route-follow', { count: 3, p1: v(0, 0), p2: v(4, 0), p3: v(8, 0), speed: 4, lookAhead: 0, arriveRadius: 0.2, legs: 'dash', ...extra }],
    ['space', 'key', { key: 'Space' }],
  ];
  const wires: [string, string, string, string][] = [
    ['bot', 'self', 'route', 'self'],
    ['route', 'moveX', 'bot', 'moveX'],
    ['route', 'moveY', 'bot', 'moveY'],
    ['space', 'held', 'route', 'go'],
  ];
  const graph: Graph = {
    nodes: nodes.map(([id, kind, params]): GraphNode => ({ id, kind, params, pos: { x: 0, y: 0 } })),
    wires: wires.map(([fn, fp, tn, tp], i) => ({ id: `w${i}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } })),
  };
  const world = createWorld('3d');
  const rt = createRuntime(wireStarts(graph, '3d'), world, '3d');
  const bot = () => world.entities().find((e) => e.ownerNodeId === 'bot')!;
  const step = (go: boolean) => {
    rt.tick({ keysDown: new Set(go ? ['Space'] : []) });
    world.step(TICK_DT);
  };
  const out = (port: string) => rt.getOutput('route', port);
  const leg = () => routeNoteOf(world, bot().id, rt.tickIndex)!;
  return { step, bot, out, leg };
}

describe('route-follow: "Chạy từng chặng"', () => {
  it('stands at the first point while "Chạy" is off, and says what the next leg is', () => {
    const s = setup();
    for (let i = 0; i < 120; i++) s.step(false);
    expect(s.bot().position.x).toBeCloseTo(0, 1);
    expect(s.out('atPoint')).toBe(true);
    expect(s.out('atPoint')).toBe(true);
    expect(s.leg().need).toBeCloseTo(1, 1);
    expect([s.leg().from.x, s.leg().to.x].map(Math.round)).toEqual([0, 4]);
  });

  it('one push of "Chạy" is a whole dash to the next point, then it waits there', () => {
    const s = setup();
    for (let i = 0; i < 10; i++) s.step(false);
    s.step(true);
    for (let i = 0; i < 180; i++) s.step(false);
    expect(s.bot().position.x).toBeGreaterThan(3.7);
    expect(s.bot().position.x).toBeLessThan(4.3);
    expect(s.out('atPoint')).toBe(true);
    // The leg to decide on now starts here.
    expect(Math.round(s.leg().to.x)).toBe(8);
  });

  it('while dashing it is not waiting, the leg is the one after the point it runs to, and the time includes what is left', () => {
    const s = setup();
    s.step(true);
    for (let i = 0; i < 30; i++) s.step(false);
    expect(s.out('atPoint')).toBe(false);
    expect(Math.round(s.leg().from.x)).toBe(4);
    expect(Math.round(s.leg().to.x)).toBe(8);
    const left = 4 - s.bot().position.x;
    expect(s.leg().need).toBeCloseTo((left + 4) / 4, 1);
  });

  it('keeps going through a point while "Chạy" is still on (a chain), never standing still on the way', () => {
    const s = setup();
    let slowest = Infinity;
    let prev = s.bot().position.x;
    let reachedFar = false;
    for (let i = 0; i < 60 * 6 && !reachedFar; i++) {
      s.step(true);
      const x = s.bot().position.x;
      if (i > 10) slowest = Math.min(slowest, (x - prev) / TICK_DT);
      prev = x;
      reachedFar = x > 7.7;
    }
    expect(reachedFar).toBe(true);
    expect(slowest).toBeGreaterThan(0.9);
  });

  it('a dash is never cancelled half way when "Chạy" drops', () => {
    const s = setup();
    s.step(true);
    for (let i = 0; i < 20; i++) s.step(false);
    expect(s.bot().position.x).toBeGreaterThan(0.5);
    expect(s.bot().position.x).toBeLessThan(3.5);
    for (let i = 0; i < 120; i++) s.step(false);
    expect(s.bot().position.x).toBeGreaterThan(3.7);
  });

  it('"Chuẩn bị" holds the bot still for that long after "Chạy", but not when it runs on through a point', () => {
    const s = setup({ readyFor: 0.5 });
    s.step(true);
    for (let i = 0; i < 20; i++) s.step(false);
    expect(s.bot().position.x).toBeLessThan(0.05);
    expect(s.out('atPoint')).toBe(false);
    for (let i = 0; i < 40; i++) s.step(false);
    expect(s.bot().position.x).toBeGreaterThan(0.3);
    const chain = setup({ readyFor: 0.5 });
    let seconds = 0;
    for (let i = 0; i < 60 * 6 && chain.bot().position.x < 7.7; i++, seconds += TICK_DT) chain.step(true);
    // Two legs of 4 at speed 4 plus ONE get-ready pause at the very start.
    expect(seconds).toBeGreaterThan(2.4);
    expect(seconds).toBeLessThan(3.0);
  });

  it('with the setting off the route runs on its own, as before', () => {
    const s = setup({ legs: 'off' });
    for (let i = 0; i < 60 * 3; i++) s.step(false);
    expect(s.bot().position.x).toBeGreaterThan(3.5);
  });
});
