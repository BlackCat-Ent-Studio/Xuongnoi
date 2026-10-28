import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import {
  TICK_DT,
  type EntityView,
  type Graph,
  type GraphNode,
  type Params,
  type Runtime,
  type Vec3,
  type ViewMode,
  type World,
} from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { sequenceNode } from '../../src/nodes/sequence';
import { nextWaypoint, moveForDirection } from '../../src/nodes/steering';
import { pickFollowTarget } from '../../src/render/cameras';
import { createWorld } from '../../src/world/world';
import { runNode } from './fake-world';

beforeAll(() => registerAllNodes());

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

type NodeSpec = [id: string, kind: string, params?: Params];
type WireSpec = [from: string, fromPort: string, to: string, toPort: string];

interface Sim {
  world: World;
  rt: Runtime;
  step(n?: number): void;
  hero(): EntityView;
  entity(ownerId: string): EntityView;
  out(node: string, port: string): unknown;
}

function sim(mode: ViewMode, nodes: NodeSpec[], wires: WireSpec[], yaw = 0): Sim {
  const graph: Graph = {
    nodes: nodes.map(([id, kind, params]): GraphNode => ({ id, kind, params: params ?? {}, pos: { x: 0, y: 0 } })),
    wires: wires.map(([fn, fp, tn, tp], i) => ({ id: `w${i}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } })),
  };
  const world = createWorld(mode);
  world.setCameraYaw(yaw);
  const rt = createRuntime(graph, world, mode);
  const entity = (ownerId: string): EntityView => world.entities().find((e) => e.ownerNodeId === ownerId)!;
  return {
    world,
    rt,
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        rt.tick({ keysDown: new Set() });
        world.step(TICK_DT);
      }
    },
    hero: () => entity('hero'),
    entity,
    out: (node, port) => rt.getOutput(node, port),
  };
}

const floor = (id: string, x: number, w: number, y = -0.5, h = 1, depth = 1): NodeSpec => [
  id,
  'block',
  { position: v(x, y, 0), size: v(w, h, depth), color: '#65a30d' },
];
const hero = (x: number, y = 1, extra: Params = {}): NodeSpec => [
  'hero',
  'character',
  { position: v(x, y, 0), speed: 5, jumpPower: 10, role: 'bot', ...extra },
];
const drive = (brain: string, jump = true): WireSpec[] => [
  ['hero', 'self', brain, 'self'],
  [brain, 'moveX', 'hero', 'moveX'],
  [brain, 'moveY', 'hero', 'moveY'],
  ...(jump ? ([[brain, 'jump', 'hero', 'jump']] as WireSpec[]) : []),
];

// ---------- sequence ----------

describe('sequence node', () => {
  const run = (inputs: { next?: boolean; reset?: boolean }[], params: Params = {}) =>
    runNode(sequenceNode, inputs.map((i) => ({ inputs: i })), params);
  const active = (o: Record<string, unknown>): number[] =>
    [1, 2, 3, 4, 5, 6].filter((k) => o[`step${k}`] === true);

  it('starts on step 1 and moves on only at a rising edge of next', () => {
    const out = run([{}, { next: true }, { next: true }, {}, { next: true }], { stepCount: 3 });
    expect(out.map(active)).toEqual([[1], [2], [2], [2], [3]]); // holding it on does not skip ahead
    expect(out[4]?.index).toBe(3);
  });

  it('ignores a next that is already on at the very first tick', () => {
    const out = run([{ next: true }, { next: true }, {}, { next: true }]);
    expect(out.map(active)).toEqual([[1], [1], [1], [2]]);
  });

  it('stops after the last step unless looping', () => {
    const pulse = [{}, { next: true }, {}, { next: true }, {}, { next: true }];
    const once = run(pulse, { stepCount: 2, loop: 'no' });
    expect(once.map(active)).toEqual([[1], [2], [2], [], [], []]);
    expect(once[5]?.finished).toBe(true);
    expect(once[5]?.index).toBe(0);
    const loop = run(pulse, { stepCount: 2, loop: 'yes' });
    expect(loop.map(active)).toEqual([[1], [2], [2], [1], [1], [2]]);
  });

  it('reset goes back to step 1, even after finishing', () => {
    const out = run([{}, { next: true }, {}, { next: true }, {}, { reset: true }], { stepCount: 2 });
    expect(out[3]?.finished).toBe(true);
    expect(active(out[5]!)).toEqual([1]);
    expect(out[5]?.finished).toBe(false);
  });

  it('clamps the step count to 2..6', () => {
    const next = [{}, ...Array.from({ length: 12 }, (_, k) => ({ next: k % 2 === 0 }))];
    expect(run(next, { stepCount: 99 }).some((o) => o.finished === true)).toBe(true);
    const out = run([{}, { next: true }, {}], { stepCount: 0 });
    expect(active(out[1]!)).toEqual([2]);
  });
});

// ---------- steering helpers ----------

describe('steering helpers', () => {
  it('the waypoint hook returns the goal itself (straight-line steering)', () => {
    const world = createWorld('2d-side');
    const self = { id: 'x' } as EntityView;
    const goal = v(3, 1, 0);
    expect(nextWaypoint({ world, self, goal, dt: TICK_DT, memo: {} })).toBe(goal);
  });

  it('moveForDirection undoes the 3D camera turn so the world direction is kept', () => {
    for (const yaw of [0, 0.7, -2.1, Math.PI]) {
      const dir = { x: Math.cos(0.4), z: Math.sin(0.4) };
      const { moveX, moveY } = moveForDirection('3d', yaw, dir.x, dir.z, 1);
      // Same math the physics uses to turn stick input into velocity.
      const vx = Math.cos(yaw) * moveX - Math.sin(yaw) * moveY;
      const vz = -Math.sin(yaw) * moveX - Math.cos(yaw) * moveY;
      expect(vx).toBeCloseTo(dir.x, 6);
      expect(vz).toBeCloseTo(dir.z, 6);
    }
  });

  it('2d-top maps "up" (negative z) to a positive moveY and never gives -0', () => {
    expect(moveForDirection('2d-top', 0, 0, -1, 1)).toEqual({ moveX: 0, moveY: 1 });
    expect(Object.is(moveForDirection('2d-side', 0, 1, 0, 1).moveY, 0)).toBe(true);
  });
});

// ---------- go-to ----------

describe('go-to node', () => {
  const goTo = (mode: ViewMode, params: Params, extra: NodeSpec[] = [], wires: WireSpec[] = [], yaw = 0): Sim =>
    sim(mode, [hero(0, mode === '2d-top' ? 0.5 : 1), ['g', 'go-to', params], ...extra], [...drive('g'), ...wires], yaw);

  it('walks along the floor to a point, stops, and reports arrival once', () => {
    const s = goTo('2d-side', { targetPos: v(6, 1, 0), stopDistance: 0.5 }, [floor('f', 0, 30)]);
    let pulses = 0;
    for (let i = 0; i < 300; i++) {
      s.step();
      if (s.out('g', 'arrivedPulse') === true) pulses++;
    }
    expect(pulses).toBe(1);
    expect(s.out('g', 'arrived')).toBe(true);
    expect(s.hero().position.x).toBeGreaterThan(5.4);
    expect(s.hero().position.x).toBeLessThan(6.6);
    const x = s.hero().position.x;
    s.step(30);
    expect(s.hero().position.x).toBeCloseTo(x, 3);
  });

  it('does nothing while go is off, then starts when it turns on', () => {
    // `go` stays off until the timer is done (1 s).
    const s = sim(
      '2d-side',
      [hero(0), ['g', 'go-to', { targetPos: v(6, 1, 0) }], floor('f', 0, 30), ['t', 'timer', { seconds: 1 }]],
      [...drive('g'), ['t', 'done', 'g', 'go']],
    );
    s.step(50);
    expect(s.hero().position.x).toBeCloseTo(0, 3);
    expect(s.out('g', 'arrived')).toBe(false);
    s.step(60);
    expect(s.hero().position.x).toBeGreaterThan(0.5);
  });

  it('follows a wired target object, and falls back to the point when that object is gone', () => {
    const s = sim(
      '2d-side',
      [
        hero(0),
        floor('f', 0, 40),
        ['ball', 'block', { position: v(-5, 0.5, 0), size: v(0.6, 0.6, 0.6), type: 'pickup' }],
        ['g', 'go-to', { targetPos: v(5, 1, 0), stopDistance: 0.4 }],
        ['hideTimer', 'timer', { seconds: 3 }],
      ],
      [...drive('g'), ['ball', 'self', 'g', 'target'], ['hideTimer', 'done', 'ball', 'hide']],
    );
    s.step(100); // heading left toward the ball
    expect(s.hero().position.x).toBeLessThan(-2);
    s.step(200); // ball hidden at 3 s -> goes to the fixed point at x=5
    expect(s.hero().position.x).toBeGreaterThan(4);
  });

  it('works in the top-down view (up is -z)', () => {
    const s = goTo('2d-top', { targetPos: v(4, 0.5, -5), stopDistance: 0.4 });
    s.step(300);
    expect(s.out('g', 'arrived')).toBe(true);
    expect(s.hero().position.z).toBeLessThan(-4.5);
    expect(s.hero().position.x).toBeGreaterThan(3.5);
  });

  it('works in 3D whatever the camera yaw is', () => {
    for (const yaw of [0, 1.2, -2.5]) {
      const s = goTo('3d', { targetPos: v(-4, 1, 6), stopDistance: 0.4 }, [floor('f', 0, 60, -0.5, 1, 60)], [], yaw);
      s.step(400);
      expect(s.out('g', 'arrived')).toBe(true);
      expect(s.hero().position.x).toBeLessThan(-3.5);
      expect(s.hero().position.z).toBeGreaterThan(5.5);
    }
  });

  it('idles safely with no bot wired', () => {
    const s = sim('2d-side', [['g', 'go-to', {}]], []);
    expect(() => s.step(5)).not.toThrow();
    expect(s.out('g', 'arrived')).toBe(false);
  });

  it('hops over a 1-high step and a gap, but not a 3-high wall', () => {
    const step = goTo('2d-side', { targetPos: v(8, 1, 0) }, [
      floor('f', 0, 40),
      ['b', 'block', { position: v(3, 0.5, 0), size: v(1, 1, 1) }],
    ]);
    step.step(400);
    expect(step.out('g', 'arrived')).toBe(true);

    const gap = goTo('2d-side', { targetPos: v(9, 1, 0) }, [floor('f1', -4, 12), floor('f2', 7.5, 9)]);
    gap.step(400);
    expect(gap.out('g', 'arrived')).toBe(true);
    expect(gap.hero().position.y).toBeGreaterThan(0.4);

    const wall = goTo('2d-side', { targetPos: v(8, 1, 0) }, [
      floor('f', 0, 40),
      ['w', 'block', { position: v(3, 1.5, 0), size: v(1, 3, 1) }],
    ]);
    wall.step(400);
    expect(wall.out('g', 'arrived')).toBe(false);
    expect(wall.hero().position.x).toBeLessThan(2.5);
  });

  it('walks off a ledge when the goal is far below', () => {
    const s = goTo('2d-side', { targetPos: v(5, -4, 0), stopDistance: 0.6 }, [
      floor('high', -2, 8, -0.5),
      floor('low', 4, 14, -5.5),
    ]);
    s.step(400);
    expect(s.out('g', 'arrived')).toBe(true);
    expect(s.hero().position.y).toBeLessThan(-4);
  });
});

// ---------- patrol ----------

describe('patrol node', () => {
  const patrol = (params: Params, extra: NodeSpec[] = [], wires: WireSpec[] = [], x = -4): Sim =>
    sim('2d-side', [hero(x), ['p', 'patrol', params], floor('f', 0, 40), ...extra], [...drive('p', false), ...wires]);

  it('walks between A and B, waits at each end and pulses atEnd', () => {
    const s = patrol({ pointA: v(-4, 1, 0), pointB: v(4, 1, 0), wait: 0.5 });
    let pulses = 0;
    const xs: number[] = [];
    for (let i = 0; i < 60 * 12; i++) {
      s.step();
      if (s.out('p', 'atEnd') === true) pulses++;
      xs.push(s.hero().position.x);
    }
    expect(Math.min(...xs)).toBeGreaterThan(-4.5);
    expect(Math.max(...xs)).toBeLessThan(4.5);
    expect(Math.max(...xs)).toBeGreaterThan(3.6);
    expect(Math.min(...xs.slice(300))).toBeLessThan(-3.6);
    expect(pulses).toBeGreaterThanOrEqual(4);
    // While waiting at the end it stands still.
    const waitStart = xs.findIndex((x) => x > 3.6);
    expect(Math.abs(xs[waitStart + 5]! - xs[waitStart + 20]!)).toBeLessThan(0.15);
  });

  it('first heads for the farther end', () => {
    const s = patrol({ pointA: v(-4, 1, 0), pointB: v(4, 1, 0), wait: 0 }, [], [], 3);
    s.step(30);
    expect(s.hero().position.x).toBeLessThan(3);
  });

  it('stands still while the "on" input is off', () => {
    // `on` stays off until the timer is done (1 s).
    const s = patrol(
      { pointA: v(-4, 1, 0), pointB: v(4, 1, 0) },
      [['t', 'timer', { seconds: 1 }]],
      [['t', 'done', 'p', 'on']],
    );
    s.step(50);
    expect(s.hero().position.x).toBeCloseTo(-4, 2);
    s.step(60);
    expect(s.hero().position.x).toBeGreaterThan(-3.8);
  });

  it('turns around at a platform edge instead of walking off', () => {
    const board: NodeSpec[] = [hero(0), ['p', 'patrol', { pointA: v(-1, 1, 0), pointB: v(9, 1, 0), wait: 0, turnAtEdge: 'yes' }], floor('f', 0, 8)];
    const s = sim('2d-side', board, drive('p', false));
    let minY = Infinity;
    for (let i = 0; i < 60 * 10; i++) {
      s.step();
      minY = Math.min(minY, s.hero().position.y);
    }
    expect(minY).toBeGreaterThan(0.4);
    const off = sim('2d-side', [hero(0), ['p', 'patrol', { pointA: v(-1, 1, 0), pointB: v(9, 1, 0), wait: 0, turnAtEdge: 'no' }], floor('f', 0, 8)], drive('p', false));
    off.step(60 * 4);
    expect(off.hero().position.y).toBeLessThan(0);
  });
});

// ---------- chase ----------

describe('chase node', () => {
  const chase = (params: Params, targetX: number, mode: ViewMode = '2d-side'): Sim => {
    const y = mode === '2d-top' ? 0.5 : 1;
    return sim(
      mode,
      [
        hero(0, y),
        ['prey', 'character', { position: v(targetX, y, 0), speed: 0, color: '#ef4444' }],
        ['c', 'chase', params],
        floor('f', 0, 60),
      ],
      [...drive('c'), ['prey', 'self', 'c', 'target']],
    );
  };

  it('ignores a target beyond sight range', () => {
    const s = chase({ sightRange: 4, giveUpRange: 8 }, 6);
    s.step(60);
    expect(s.out('c', 'seeing')).toBe(false);
    expect(s.hero().position.x).toBeCloseTo(0, 3);
  });

  it('chases a target in sight and keeps chasing until it is past the give-up range', () => {
    const s = chase({ sightRange: 4, giveUpRange: 8 }, 3.5);
    s.step(20);
    expect(s.out('c', 'seeing')).toBe(true);
    expect(s.hero().position.x).toBeGreaterThan(0.5);
    s.step(120);
    expect(s.hero().position.x).toBeGreaterThan(2.9); // caught up, standing next to it
  });

  it('gives up when the target ends up beyond the give-up range', () => {
    const s = sim(
      '2d-side',
      [
        hero(0),
        ['prey', 'character', { position: v(3, 1, 0), speed: 8, color: '#ef4444' }],
        ['c', 'chase', { sightRange: 4, giveUpRange: 7 }],
        floor('f', 0, 80),
        ['run', 'const', { value: 1 }],
      ],
      [...drive('c'), ['prey', 'self', 'c', 'target'], ['run', 'value', 'prey', 'moveX']],
    );
    s.step(5);
    expect(s.out('c', 'seeing')).toBe(true);
    s.step(300); // prey runs at 8 > bot's 5, gap widens past 7
    expect(s.out('c', 'seeing')).toBe(false);
  });

  it('flee mode runs away from the target', () => {
    const s = chase({ mode: 'flee', sightRange: 6, giveUpRange: 9 }, 2);
    s.step(60);
    expect(s.hero().position.x).toBeLessThan(-1);
  });

  it('flee mode stops at a ledge instead of jumping off', () => {
    const s = sim(
      '2d-side',
      [
        hero(0),
        ['prey', 'character', { position: v(2, 1, 0), speed: 0 }],
        ['c', 'chase', { mode: 'flee', sightRange: 8, giveUpRange: 12 }],
        floor('f', 2, 6),
      ],
      [...drive('c'), ['prey', 'self', 'c', 'target']],
    );
    s.step(240);
    expect(s.hero().position.y).toBeGreaterThan(0.4);
    expect(s.hero().position.x).toBeGreaterThan(-1.4);
  });

  it('chases in the top-down view and in 3D', () => {
    const top = chase({ sightRange: 10 }, 5, '2d-top');
    top.step(120);
    expect(top.hero().position.x).toBeGreaterThan(4);
    const d3 = sim(
      '3d',
      [hero(0), ['prey', 'character', { position: v(3, 1, -4), speed: 0 }], ['c', 'chase', { sightRange: 10 }], floor('f', 0, 60, -0.5, 1, 60)],
      [...drive('c'), ['prey', 'self', 'c', 'target']],
      0.9,
    );
    d3.step(200);
    expect(d3.hero().position.x).toBeGreaterThan(2.4);
    expect(d3.hero().position.z).toBeLessThan(-3);
  });
});

// ---------- character role / camera / world helpers / item hide ----------

describe('character role and follow target', () => {
  const view = (id: string, role: 'player' | 'bot' | undefined, visible = true, kind: EntityView['kind'] = 'character'): EntityView => ({
    id,
    kind,
    ownerNodeId: id,
    position: v(0, 0, 0),
    size: v(1, 1, 1),
    color: '#fff',
    ...(role ? { role } : {}),
    visible,
  });

  it('follows the first player, skipping bots listed earlier', () => {
    const list = [view('b1', 'bot'), view('p1', 'player'), view('p2', 'player')];
    expect(pickFollowTarget(list)?.id).toBe('p1');
  });

  it('treats a character without a role as a player (old boards)', () => {
    expect(pickFollowTarget([view('b1', 'bot'), view('old', undefined)])?.id).toBe('old');
  });

  it('falls back to the first bot when no player exists, ignoring hidden ones and non-characters', () => {
    expect(pickFollowTarget([view('blk', undefined, true, 'block'), view('b0', 'bot', false), view('b1', 'bot'), view('b2', 'bot')])?.id).toBe('b1');
    expect(pickFollowTarget([])).toBeUndefined();
  });

  it('the character node spawns with role "player" by default and "bot" when set', () => {
    const s = sim('2d-side', [['a', 'character', {}], ['b', 'character', { role: 'bot' }]], []);
    expect(s.entity('a').role).toBe('player');
    expect(s.entity('b').role).toBe('bot');
    expect(pickFollowTarget(s.world.entities())?.id).toBe(s.entity('a').id);
  });
});

describe('world probes and item hide', () => {
  it('solidAt sees visible solid blocks only', () => {
    const s = sim(
      '2d-side',
      [floor('f', 0, 10), ['pick', 'block', { position: v(0, 3, 0), size: v(2, 2, 1), type: 'pickup' }], ['crate', 'item', { position: v(4, 1, 0) }]],
      [],
    );
    expect(s.world.solidAt(v(1, -0.5, 0))).toBe(true);
    expect(s.world.solidAt(v(1, 0.6, 0))).toBe(false);
    expect(s.world.solidAt(v(0, 3, 0))).toBe(false);
    expect(s.world.solidAt(v(4, 1, 0))).toBe(false);
  });

  it('cameraYaw returns what was set', () => {
    const w = createWorld('3d');
    expect(w.cameraYaw()).toBe(0);
    w.setCameraYaw(1.5);
    expect(w.cameraYaw()).toBe(1.5);
  });

  it('an item hides on a rising "hide" and stays hidden', () => {
    const s = sim(
      '2d-side',
      [['crate', 'item', { position: v(0, 1, 0) }], ['t', 'timer', { seconds: 0.5 }]],
      [['t', 'done', 'crate', 'hide']],
    );
    s.step(10);
    expect(s.entity('crate').visible).toBe(true);
    s.step(60);
    expect(s.entity('crate').visible).toBe(false);
  });
});
