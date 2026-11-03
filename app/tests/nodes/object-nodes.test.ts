import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import {
  TICK_DT,
  type EntityView,
  type Graph,
  type GraphNode,
  type InputSnapshot,
  type Params,
  type Vec3,
  type ViewMode,
} from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';
import { makeWorld, runNode } from './fake-world';
import { movingPlatformNode } from '../../src/nodes/moving-platform';
import { shooterNode } from '../../src/nodes/shooter';
import { spawnerNode } from '../../src/nodes/spawner';
import { wireStarts } from '../helpers/wire-starts';

beforeAll(() => registerAllNodes());

const v = (x: number, y: number, z = 0): Vec3 => ({ x, y, z });
type NodeSpec = [id: string, kind: string, params?: Params];
type WireSpec = [from: string, fromPort: string, to: string, toPort: string];

function sim(mode: ViewMode, nodes: NodeSpec[], wires: WireSpec[]) {
  const graph: Graph = {
    nodes: nodes.map(([id, kind, params]): GraphNode => ({ id, kind, params: params ?? {}, pos: { x: 0, y: 0 } })),
    wires: wires.map(([fn, fp, tn, tp], i) => ({ id: `w${i}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } })),
  };
  const world = createWorld(mode);
  const rt = createRuntime(wireStarts(graph, mode), world, mode);
  return {
    world,
    rt,
    step(n = 1, keys: string[] = []) {
      const input: InputSnapshot = { keysDown: new Set(keys) };
      for (let i = 0; i < n; i++) {
        rt.tick(input);
        world.step(TICK_DT);
      }
    },
    view: (owner: string): EntityView => world.entities().find((e) => e.ownerNodeId === owner)!,
    out: (node: string, port: string) => rt.getOutput(node, port),
  };
}

const floor: NodeSpec = ['floor', 'block', { position: v(0, -0.5), size: v(60, 1, 1), color: '#0a0', type: 'solid' }];

describe('moving platform node', () => {
  const plat = (over: Params = {}): NodeSpec => ['plat', 'moving-platform', { position: v(0, 1), to: v(4, 1), speed: 2, wait: 1, ...over }];

  it('goes to B, rests, comes back, and repeats', () => {
    const g = sim('2d-side', [floor, plat()], []);
    const xs: number[] = [];
    let arrivals = 0;
    for (let i = 0; i < 60 * 12; i++) {
      g.step();
      xs.push(g.view('plat').position.x);
      if (g.out('plat', 'arrived') === true) arrivals++;
    }
    // 2 s there, 1 s rest, 2 s back, 1 s rest => 6 s cycle.
    expect(xs[60 * 2 - 1]).toBeCloseTo(4, 2);
    expect(xs[60 * 3 - 10]).toBeCloseTo(4, 6); // still resting
    expect(xs[60 * 5 - 1]).toBeCloseTo(0, 1);
    expect(Math.max(...xs)).toBeCloseTo(4, 6);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(arrivals).toBe(4);
  });

  it('stops at B in one-way mode', () => {
    const g = sim('2d-side', [floor, plat({ loop: 'once' })], []);
    g.step(60 * 10);
    expect(g.view('plat').position.x).toBeCloseTo(4, 6);
    expect(g.out('plat', 'moving')).toBe(false);
  });

  it('only moves while Chạy is on', () => {
    const g = sim('2d-side', [floor, plat(), ['k', 'key', { key: 'KeyG' }]], [['k', 'held', 'plat', 'run']]);
    g.step(30);
    expect(g.view('plat').position.x).toBe(0);
    g.step(30, ['KeyG']);
    expect(g.view('plat').position.x).toBeGreaterThan(0.9);
    const x = g.view('plat').position.x;
    g.step(30);
    expect(g.view('plat').position.x).toBe(x);
  });

  it('carries the player across a gap, in every view mode', () => {
    for (const mode of ['2d-side', '3d'] as ViewMode[]) {
      const size = mode === '3d' ? v(3, 0.5, 3) : v(3, 0.5, 1);
      const g = sim(
        mode,
        [
          ['pit-left', 'block', { position: v(-8, -0.5), size: mode === '3d' ? v(10, 1, 10) : v(10, 1, 1), color: '#0a0', type: 'solid' }],
          ['plat', 'moving-platform', { position: v(-2, -0.25), to: v(2, -0.25), size, speed: 2, wait: 0 }],
          ['me', 'character', { position: v(-2, 0.5), speed: 0 }],
        ],
        [],
      );
      g.step(60 * 2);
      expect(g.view('me').position.x).toBeGreaterThan(1.8);
      expect(g.world.isOnGround(g.view('me').id)).toBe(true);
    }
  });

  it('waits instead of crushing when its way is blocked, then carries on', () => {
    const g = sim(
      '2d-side',
      [
        floor,
        plat({ position: v(-3, 0.75), to: v(6, 0.75), size: v(2, 1.5, 1), wait: 0 }),
        ['wall', 'block', { position: v(3, 2), size: v(1, 4, 1), color: '#555', type: 'solid' }],
        ['me', 'character', { position: v(2, 0.5), speed: 0 }],
        ['hide', 'key', { key: 'KeyH' }],
      ],
      [['hide', 'held', 'wall', 'hide']],
    );
    g.step(60 * 4);
    expect(g.view('plat').position.x).toBeLessThan(1.1);
    expect(g.view('me').position.x).toBeLessThan(2.01);
    g.step(2, ['KeyH']); // remove the wall
    g.step(60 * 4);
    expect(g.view('plat').position.x).toBeGreaterThan(3);
  });

  it('keeps quiet when its platform has been removed', () => {
    const g = sim('2d-side', [floor, plat()], []);
    g.step(10);
    g.world.hide(g.view('plat').id);
    expect(() => g.step(10)).not.toThrow();
    expect(g.out('plat', 'moving')).toBe(false);
  });

  it('works on a bare fake world', () => {
    expect(runNode(movingPlatformNode, [{}, {}], {}, makeWorld())).toHaveLength(2);
  });
});

describe('rotating platform node', () => {
  it('turns a quarter on each Xoay edge and swaps its box', () => {
    const g = sim('2d-side', [floor, ['rot', 'rotating-platform', { position: v(0, 3), size: v(4, 0.5, 1) }], ['k', 'key', { key: 'KeyR' }]], [['k', 'held', 'rot', 'turn']]);
    g.step(3);
    expect(g.view('rot').size.x).toBe(4);
    g.step(2, ['KeyR']); // one held press = one step
    expect(g.view('rot').size).toEqual(v(0.5, 4, 1));
    expect(g.out('rot', 'angle')).toBe(90);
    g.step(3);
    g.step(1, ['KeyR']);
    expect(g.view('rot').size).toEqual(v(4, 0.5, 1));
    expect(g.out('rot', 'angle')).toBe(180);
  });

  it('turns by itself every N seconds', () => {
    const g = sim('2d-side', [floor, ['rot', 'rotating-platform', { position: v(0, 3), size: v(4, 0.5, 1), every: 1 }]], []);
    g.step(59);
    expect(g.view('rot').size.x).toBe(4);
    g.step(3);
    expect(g.view('rot').size.x).toBe(0.5);
    g.step(60);
    expect(g.view('rot').size.x).toBe(4);
  });

  it('retries a blocked turn until the way is free', () => {
    const g = sim(
      '2d-side',
      [
        ['floor', 'block', { position: v(0, -2), size: v(10, 4, 1), color: '#0a0', type: 'solid' }],
        ['roof', 'block', { position: v(0, 2), size: v(10, 2, 1), color: '#555', type: 'solid' }],
        ['wl', 'block', { position: v(-1, 0.5), size: v(1, 1, 1), color: '#555', type: 'solid' }],
        ['wr', 'block', { position: v(1, 0.5), size: v(1, 1, 1), color: '#555', type: 'solid' }],
        ['rot', 'rotating-platform', { position: v(0, 1.5), size: v(6, 0.2, 1), every: 1 }],
        ['me', 'character', { position: v(0, 0.5), speed: 0 }],
        ['k', 'key', { key: 'KeyH' }],
      ],
      [['k', 'held', 'wr', 'hide']],
    );
    g.step(60 * 3);
    expect(g.view('rot').size).toEqual(v(6, 0.2, 1)); // trapped occupant: it waits
    g.step(2, ['KeyH']);
    g.step(2);
    expect(g.view('rot').size).toEqual(v(0.2, 6, 1));
    expect(g.view('me').position.x).toBeGreaterThanOrEqual(0.6 - 1e-6);
  });

  it('spin mode is not solid and reports the touching of the swept outline', () => {
    const g = sim(
      '2d-side',
      [
        floor,
        ['bar', 'rotating-platform', { mode: 'spin', position: v(0, 2), size: v(4, 0.3, 1), speed: 90 }],
        ['me', 'character', { position: v(0, 0.5), speed: 0 }],
        ['t', 'touch'],
      ],
      [
        ['bar', 'self', 't', 'a'],
        ['me', 'self', 't', 'b'],
      ],
    );
    const touches: boolean[] = [];
    for (let i = 0; i < 60 * 4; i++) {
      g.step();
      touches.push(g.out('t', 'touching') === true);
    }
    // The player stands under the pivot; the bar sweeps down through it once per half turn (every 2 s), not all the time.
    expect(touches.some((t) => t)).toBe(true);
    expect(touches.some((t) => !t)).toBe(true);
    expect(g.world.entities().find((e) => e.ownerNodeId === 'bar')!.angle).toBeDefined();
    expect(g.out('bar', 'angle')).toBeGreaterThanOrEqual(0);
    // The player never gets pushed by it.
    expect(g.view('me').position.x).toBe(0);
  });

  it('Chạy off freezes the spin', () => {
    const g = sim('2d-side', [floor, ['bar', 'rotating-platform', { mode: 'spin', position: v(0, 2), speed: 90 }], ['k', 'key', { key: 'KeyG' }]], [['k', 'held', 'bar', 'run']]);
    g.step(30);
    expect(g.out('bar', 'angle')).toBe(0);
    g.step(60, ['KeyG']);
    expect(g.out('bar', 'angle')).toBeCloseTo(90, 3);
  });
});

describe('shooter node', () => {
  const duel = (mode: ViewMode = '2d-side', shooter: Params = {}) =>
    sim(
      mode,
      [
        ...(mode === '2d-top' ? [] : [floor]),
        ['me', 'character', { position: v(-5, mode === '2d-top' ? 0 : 1), speed: 0 }],
        ['dummy', 'character', { position: v(2, mode === '2d-top' ? 0 : 1), speed: 0, role: 'bot' }],
        ['hp', 'health', { maxHp: 3 }],
        ['gun', 'shooter', { speed: 14, lifetime: 2, ...shooter }],
        ['k', 'key', { key: 'KeyF' }],
        ['hits', 'counter'],
      ],
      [
        ['me', 'self', 'gun', 'shooter'],
        ['k', 'held', 'gun', 'fire'],
        ['dummy', 'self', 'hp', 'self'],
        ['gun', 'hit', 'hits', 'inc'],
      ],
    );

  it('fires on the key edge, hits the dummy with a one-tick pulse and reports it', () => {
    for (const mode of ['2d-side', '2d-top', '3d'] as ViewMode[]) {
      const g = duel(mode);
      g.step(5);
      g.step(1, ['KeyF']);
      let pulses = 0;
      for (let i = 0; i < 90; i++) {
        g.step();
        if (g.out('gun', 'hit') === true) {
          pulses++;
          expect(g.out('gun', 'lastHit')).toBe(g.view('dummy').id);
        }
      }
      expect(pulses).toBe(1);
      expect(g.out('hp', 'hp')).toBe(2);
      expect(g.out('gun', 'lastHit')).toBe(g.view('dummy').id); // remembered after the pulse
    }
  });

  it('holding the key fires once; a second press inside the cooldown does nothing', () => {
    const g = duel('2d-side', { cooldown: 1, damage: 1 });
    g.step(5);
    g.step(30, ['KeyF']);
    g.step(5);
    g.step(2, ['KeyF']); // 0.6 s after the first shot: still cooling down
    g.step(90);
    expect(g.out('hp', 'hp')).toBe(2);
    g.step(2, ['KeyF']); // cooled down
    g.step(60);
    expect(g.out('hp', 'hp')).toBe(1);
  });

  it('three hits finish the dummy', () => {
    const g = duel('2d-side', { cooldown: 0 });
    g.step(5);
    for (let shot = 0; shot < 3; shot++) {
      g.step(1, ['KeyF']);
      g.step(60);
    }
    expect(g.out('hp', 'dead')).toBe(true);
  });

  it('tolerates nothing wired', () => {
    expect(runNode(shooterNode, [{}, { inputs: { fire: true } }], {}, makeWorld())[1]).toEqual({ hit: false, lastHit: null });
  });
});

describe('spawner node', () => {
  const rain = (over: Params = {}, extra: NodeSpec[] = [], wires: WireSpec[] = []) =>
    sim(
      '2d-side',
      [
        floor,
        ['me', 'character', { position: v(0, 0.5), speed: 0 }],
        ['sp', 'spawner', { position: v(0, 5), lifetime: 2, maxAlive: 2, ...over }],
        ['k', 'key', { key: 'KeyG' }],
        ...extra,
      ],
      [['k', 'held', 'sp', 'spawn'], ...wires],
    );
  const press = (g: ReturnType<typeof rain>) => {
    g.step(1, ['KeyG']);
    g.step(1);
  };

  it('spawns on each edge up to max alive, then lets old ones expire', () => {
    const g = rain();
    press(g);
    press(g);
    press(g); // over the cap: ignored
    expect(g.out('sp', 'count')).toBe(2);
    g.step(60 * 2 + 5);
    expect(g.out('sp', 'count')).toBe(0);
    press(g);
    expect(g.out('sp', 'count')).toBe(1);
  });

  it('places the copy at an object plus the offset', () => {
    const g = rain({ position: v(1, 4) }, [], [['me', 'self', 'sp', 'at']]);
    g.step(1, ['KeyG']);
    const id = g.out('sp', 'lastSpawned');
    expect(typeof id).toBe('string');
    const e = g.world.getEntity(id as string)!;
    expect(e.position.x).toBeCloseTo(1, 6);
    expect(e.position.y).toBeGreaterThan(4);
    expect(e.ownerNodeId).toBe('sp');
  });

  it('a copy dropped on the player works with the Chạm nhau node and the Vật thử chạm output', () => {
    const g = rain({ position: v(0, 4), size: v(0.6, 0.6, 0.6), lifetime: 5 }, [['t', 'touch']], [
      ['me', 'self', 'sp', 'at'],
      ['sp', 'lastSpawned', 't', 'a'],
      ['me', 'self', 't', 'b'],
      ['me', 'self', 'sp', 'toucher'],
    ]);
    // Spawn above the player: it falls onto the player's head.
    g.step(1, ['KeyG']);
    let touched = false;
    let viaOutput = false;
    for (let i = 0; i < 60; i++) {
      g.step();
      touched ||= g.out('t', 'touching') === true;
      viaOutput ||= g.out('sp', 'touched') === true;
    }
    expect(touched).toBe(true);
    expect(viaOutput).toBe(true);
  });

  it('spawns blocks with their solid setting, and a solid copy blocks movement', () => {
    const g = rain({ template: 'block', position: v(4, 0.5), size: v(1, 1, 1), solid: 'solid', lifetime: 0 });
    press(g);
    const id = g.out('sp', 'lastSpawned') as string;
    expect(g.world.getEntity(id)!.kind).toBe('block');
    expect(g.world.solidAt(v(4, 0.5))).toBe(true);
    g.step(60 * 10);
    expect(g.out('sp', 'count')).toBe(1); // lifetime 0 = stays
    const soft = rain({ template: 'block', position: v(4, 0.5), solid: 'pickup' });
    press(soft);
    expect(soft.world.solidAt(v(4, 0.5))).toBe(false);
  });

  it('spawns items that fall and rest; spawned copies are dropped from the world after they expire', () => {
    const g = rain({ lifetime: 1 });
    press(g);
    g.step(60);
    expect(g.world.entities().filter((e) => e.ownerNodeId === 'sp' && e.visible)).toHaveLength(0);
    expect(g.world.entities().filter((e) => e.ownerNodeId === 'sp')).toHaveLength(0);
  });

  it('does nothing when its anchor object is gone, and survives a bare fake world', () => {
    const g = rain({}, [], [['me', 'self', 'sp', 'at']]);
    g.world.hide(g.view('me').id);
    g.step(1, ['KeyG']);
    expect(g.out('sp', 'count')).toBe(0);
    const out = runNode(spawnerNode, [{ inputs: { spawn: true } }], {}, makeWorld());
    expect(out[0]).toMatchObject({ count: 1, spawned: true });
  });

  it('is deterministic', () => {
    const play = (): string => {
      const g = rain({ lifetime: 1.5 });
      for (let i = 0; i < 400; i++) g.step(1, i % 45 === 0 ? ['KeyG'] : []);
      return JSON.stringify(g.world.entities());
    };
    expect(play()).toBe(play());
  });
});
