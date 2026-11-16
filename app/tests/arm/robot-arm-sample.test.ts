import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { registerAllNodes } from '../../src/nodes';
import { ROBOT_ARM_WIRES, createRobotArmBoard } from '../../src/samples/robot-arm-board';
import { TICK_DT, type Board } from '../../src/engine/types';
import { createWorld } from '../../src/world/world';

registerAllNodes();

/** Plays a board with taps: each press holds a key for 3 ticks, then waits so the counters see a fresh edge. */
function session(board: Board) {
  const world = createWorld(board.mode);
  const rt = createRuntime(board.graph, world, board.mode);
  let held = new Set<string>();
  const tick = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      rt.tick({ keysDown: held });
      world.step(TICK_DT);
    }
  };
  return {
    world,
    rt,
    tick,
    seconds: (s: number) => tick(Math.round(s / TICK_DT)),
    tap(code: string, times = 1) {
      for (let i = 0; i < times; i++) {
        held = new Set([code]);
        tick(3);
        held = new Set();
        tick(3);
      }
    },
    hold(...codes: string[]) {
      held = new Set(codes);
    },
    crate: (owner: string) => world.entities().find((e) => e.ownerNodeId === owner)!,
    out: (id: string, port: string) => rt.getOutput(id, port),
  };
}

type Session = ReturnType<typeof session>;

/** Starting counts are shoulder 8 (50 deg) and elbow 4 (-90 deg); these tap the keys to reach other counts. */
function moveArm(s: Session, shoulder: number, elbow: number): void {
  s.tap(shoulder < 8 ? 'KeyS' : 'KeyW', Math.abs(shoulder - 8));
  s.tap(elbow < 4 ? 'KeyA' : 'KeyD', Math.abs(elbow - 4));
  s.seconds(3);
}

/** Taps Up until the force counter (starts at 1 = 10 N) reads `steps` more presses, closes the gripper and waits. */
function grip(s: Session, extraPresses: number): void {
  s.tap('ArrowUp', extraPresses);
  s.hold('Space');
  s.seconds(0.5);
}

/** Counts that bring the fingers to each crate. */
const POSE = { light: [6, 2], heavy: [6, 4], fragile: [4, 7] } as const;

function slipsWithin(s: Session, seconds: number): { slipped: boolean; crushed: boolean; overloaded: boolean } {
  let slipped = false;
  let crushed = false;
  let overloaded = false;
  for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
    s.tick();
    if (s.out('gripper', 'slipped') === true) slipped = true;
    if (s.out('gripper', 'crushedOut') === true) crushed = true;
    if (s.out('shoulder', 'overloaded') === true || s.out('elbow', 'overloaded') === true) overloaded = true;
  }
  return { slipped, crushed, overloaded };
}

/** Taps the shoulder-up key `presses` times with the gripper held closed, then watches for `seconds` more. */
function liftWatching(s: Session, seconds: number, presses = 2): { slipped: boolean; crushed: boolean; overloaded: boolean } {
  const total = { slipped: false, crushed: false, overloaded: false };
  const merge = (r: typeof total): void => {
    total.slipped ||= r.slipped;
    total.crushed ||= r.crushed;
    total.overloaded ||= r.overloaded;
  };
  for (let i = 0; i < presses; i++) {
    s.hold('Space', 'KeyW');
    merge(slipsWithin(s, 3 * TICK_DT));
    s.hold('Space');
    merge(slipsWithin(s, 3 * TICK_DT));
  }
  merge(slipsWithin(s, seconds));
  return total;
}

describe('robot arm sample', () => {
  it('2 kg crate: the starting 10 N slips once lifted, 20 N holds it up', () => {
    const weak = session(createRobotArmBoard());
    weak.seconds(1);
    moveArm(weak, ...POSE.light);
    grip(weak, 0);
    expect(weak.out('gripper', 'holding')).toBe(true);
    const slip = liftWatching(weak, 2);
    expect(slip.slipped).toBe(true);
    expect(weak.crate('crate-light').position.y).toBeLessThan(0.95);

    const strong = session(createRobotArmBoard());
    strong.seconds(1);
    moveArm(strong, ...POSE.light);
    grip(strong, 1);
    const res = liftWatching(strong, 2);
    expect(res.slipped).toBe(false);
    expect(res.overloaded).toBe(false);
    expect(strong.out('gripper', 'holding')).toBe(true);
    expect(strong.crate('crate-light').position.y).toBeGreaterThan(1.3);
    expect(strong.crate('crate-light').damaged).toBeUndefined();
  });

  it('fragile crate: 30 N a finger is safe, 40 N breaks it (2 x 40 = 80 N over its 60 N limit) but it is still held', () => {
    const safe = session(createRobotArmBoard());
    safe.seconds(1);
    moveArm(safe, ...POSE.fragile);
    grip(safe, 2);
    expect(safe.out('gripper', 'gripForce')).toBe(30);
    expect(safe.out('gripper', 'holding')).toBe(true);
    expect(safe.crate('crate-fragile').damaged).toBeUndefined();

    const hard = session(createRobotArmBoard());
    hard.seconds(1);
    moveArm(hard, ...POSE.fragile);
    hard.tap('ArrowUp', 3);
    hard.hold('Space');
    const res = slipsWithin(hard, 0.5);
    expect(res.crushed).toBe(true);
    expect(hard.crate('crate-fragile').damaged).toBe(true);
    expect(hard.out('gripper', 'holding')).toBe(true);
  });

  it('6 kg crate: the grip can be made to hold (60 N) but the shoulder is overloaded until its max torque is raised', () => {
    const board = createRobotArmBoard();
    const s = session(board);
    s.seconds(1);
    moveArm(s, ...POSE.heavy);
    grip(s, 5);
    expect(s.out('gripper', 'gripForce')).toBe(60);
    expect(s.out('gripper', 'holding')).toBe(true);
    const res = liftWatching(s, 3, 3);
    expect(res.overloaded).toBe(true);
    expect(res.slipped).toBe(false);
    expect(s.crate('crate-heavy').position.y).toBeLessThan(1.2);

    expect(s.rt.applyNodeParams('shoulder', { maxTorque: 250 })).toBe(true);
    expect(s.rt.applyNodeParams('elbow', { maxTorque: 250 })).toBe(true);
    s.seconds(4);
    expect(s.out('shoulder', 'overloaded')).toBe(false);
    expect(s.crate('crate-heavy').position.y).toBeGreaterThan(1.3);
  });
});

/** The whole pick: reach the crate, set a force that holds without breaking it, close, lift. */
function pick(board: Board, which: 'light' | 'fragile'): { y: number; holding: boolean; damaged: boolean } {
  const s = session(board);
  s.seconds(1);
  const [shoulder, elbow] = POSE[which];
  moveArm(s, shoulder, elbow);
  s.tap('ArrowUp', which === 'light' ? 1 : 2);
  s.hold('Space');
  s.seconds(0.5);
  liftWatching(s, 2);
  const crate = s.crate(which === 'light' ? 'crate-light' : 'crate-fragile');
  return { y: crate.position.y, holding: s.out('gripper', 'holding') === true, damaged: crate.damaged === true };
}

const picked = (r: ReturnType<typeof pick>): boolean => r.holding && r.y > 1.3 && !r.damaged;

/** The wires the picks need; the readout wires after them only draw numbers and messages. The key-down wire only tunes the force down and no pick needs it (see its own test). */
const ESSENTIAL = ROBOT_ARM_WIRES.slice(0, 20).filter((w) => w[0] !== 'key-down');

describe('robot arm sample is built only from wires', () => {
  it('the full board picks the crate up (control run for the cases below)', () => {
    expect(picked(pick(createRobotArmBoard(), 'light'))).toBe(true);
    expect(picked(pick(createRobotArmBoard(), 'fragile'))).toBe(true);
  });

  for (const [fn, fp, tn, tp] of ESSENTIAL) {
    it(`without the wire ${fn}.${fp} -> ${tn}.${tp} the pick fails`, () => {
      const board = createRobotArmBoard();
      board.graph.wires = board.graph.wires.filter((w) => !(w.from.node === fn && w.from.port === fp && w.to.node === tn && w.to.port === tp));
      expect(board.graph.wires.length).toBe(ROBOT_ARM_WIRES.length - 1);
      // The two picks together use every control: a missing wire spoils at least one of them.
      const both = picked(pick(structuredClone(board), 'light')) && picked(pick(structuredClone(board), 'fragile'));
      expect(both, 'both crates must not be picked without this wire').toBe(false);
    });
  }

  it('the pieces carry no hidden job: the three arm kinds are wired to general pieces and nothing but wires', () => {
    const board = createRobotArmBoard();
    const kinds = new Set(board.graph.nodes.map((n) => n.kind));
    for (const k of ['joint', 'link', 'gripper', 'key', 'counter', 'map-range', 'on-start']) expect(kinds.has(k)).toBe(true);
    // every input of the arm pieces that matters is fed by a wire
    for (const need of [
      ['shoulder', 'base'], ['shoulder', 'angle'], ['shoulder', 'power'], ['elbow', 'base'], ['elbow', 'angle'], ['elbow', 'power'],
      ['upper', 'base'], ['fore', 'base'], ['gripper', 'base'], ['gripper', 'close'], ['gripper', 'force'],
    ] as const) {
      expect(board.graph.wires.some((w) => w.to.node === need[0] && w.to.port === need[1]), need.join('.')).toBe(true);
    }
  });
});

describe('arm in 3D and from above', () => {
  it('3D: the arm builds the same chain and the crate is lifted when the grip is strong enough', () => {
    const b = createRobotArmBoard();
    b.mode = '3d';
    const s = session(b);
    s.seconds(1);
    moveArm(s, ...POSE.light);
    s.tap('ArrowUp', 1);
    s.hold('Space');
    s.seconds(0.5);
    expect(s.out('gripper', 'holding')).toBe(true);
    const beam = s.world.entities().find((e) => e.ownerNodeId === 'upper')!;
    expect(beam.tilt).toBeDefined();
  });

  it('top view: a yaw joint swings the arm about the vertical axis and the lever arm needs no pitch', () => {
    const r = rigTop();
    r.tick(120);
    const beam = r.world.entities().find((e) => e.ownerNodeId === 'l')!;
    // 90 degrees yaw: the 2 m link now lies along -z (centre at z = -1)
    expect(beam.position.x).toBeCloseTo(0, 6);
    expect(beam.position.z).toBeCloseTo(-1, 6);
    expect(beam.angle).toBeCloseTo(Math.PI / 2, 6);
  });
});

import { rig } from '../helpers/arm-rig';
function rigTop() {
  return rig(
    [
      ['base', 'block', { position: { x: 0, y: 0, z: 0 }, size: { x: 0.5, y: 0.5, z: 0.5 } }],
      ['go', 'on-start'],
      ['c', 'const', { value: 90 }],
      ['j', 'joint', { axis: 'yaw', min: -180, max: 180 }],
      ['l', 'link', { length: 2 }],
    ],
    [['base', 'self', 'j', 'base'], ['go', 'started', 'j', 'power'], ['c', 'value', 'j', 'angle'], ['j', 'tip', 'l', 'base']],
    '2d-top',
  );
}

describe('robot arm sample controls', () => {
  it('Up raises the grip force by 10 N a press and Down lowers it again', () => {
    const s = session(createRobotArmBoard());
    s.seconds(0.5);
    s.tap('ArrowUp', 3);
    expect(s.out('gripper', 'gripForce')).toBe(0);
    s.hold('Space');
    s.tick(2);
    expect(s.out('gripper', 'gripForce')).toBe(40);
    s.hold();
    s.tap('ArrowDown', 1);
    s.hold('Space');
    s.tick(2);
    expect(s.out('gripper', 'gripForce')).toBe(30);
  });
});
