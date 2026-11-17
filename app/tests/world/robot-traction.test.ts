import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type EntityView, type ViewMode } from '../../src/engine/types';
import { tractionStep, wheelGrip, yawInertia } from '../../src/world/robot-traction';
import { createWorld } from '../../src/world/world';
import { rig } from '../helpers/arm-rig';

const G = 9.81;
/** Rim speed far above anything the robot reaches: the motor force, not the command, limits every start. */
const FAST_RPM = 6000;
/** Rim speed of a wheel of radius 0.15 turning at this rpm. */
const rimOf = (rpm: number): number => (rpm * 2 * Math.PI * 0.15) / 60;
const rpmFor = (metresPerSecond: number): number => (metresPerSecond * 60) / (2 * Math.PI * 0.15);

interface Opts {
  realPhysics?: boolean;
  mode?: ViewMode;
  kg?: number;
  mu?: number;
  payloadKg?: number;
  side?: number;
  driveN?: number;
  brakeN?: number;
}

function setup(o: Opts = {}) {
  const mode = o.mode ?? '3d';
  const w = createWorld(mode, o.realPhysics === false ? undefined : { realPhysics: true });
  w.spawn({ kind: 'block', ownerNodeId: 'floor', position: { x: 0, y: -0.5, z: 0 }, size: { x: 200, y: 1, z: 200 }, color: '#888', solid: true });
  const robot: EntityId = w.spawn({
    kind: 'robot',
    ownerNodeId: 'body',
    position: { x: 0, y: 0.15, z: 0 },
    size: { x: 1, y: 0.3, z: 1 },
    color: '#00f',
    solid: true,
    robot: { length: 1, width: 0.7, mass: o.kg ?? 2, friction: o.mu ?? 0.8 },
    heading: 0,
  });
  if (o.payloadKg !== undefined) {
    w.spawn({ kind: 'item', ownerNodeId: 'crate', position: { x: 0, y: 0.5, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, color: '#fa0', solid: false, mass: o.payloadKg });
  }
  const side = o.side ?? 0.35;
  const view = (): EntityView => w.entities().find((e) => e.id === robot)!;
  const run = (ticks: number, left: number, right: number): void => {
    for (let i = 0; i < ticks; i++) {
      const extra = { ...(o.driveN !== undefined ? { driveN: o.driveN } : {}), ...(o.brakeN !== undefined ? { brakeN: o.brakeN } : {}) };
      w.setRobotWheel(robot, 'l', { side: -side, forward: 0, radius: 0.15, rpm: left, ...extra });
      w.setRobotWheel(robot, 'r', { side, forward: 0, radius: 0.15, rpm: right, ...extra });
      w.step(TICK_DT);
    }
  };
  return { w, robot, view, run };
}

describe('tractionStep: the formulas on their own', () => {
  const body = { mass: 2, friction: 0.8, length: 1, width: 0.7 };
  const pair = (command: number) => [
    { side: -0.35, command, driveN: 6, brakeN: 0 },
    { side: 0.35, command, driveN: 6, brakeN: 0 },
  ];

  it('inertia of a box is m (l^2 + w^2) / 12 and grip is mu m g shared by the wheels', () => {
    expect(yawInertia(2, 1, 0.7)).toBeCloseTo(0.248333, 5);
    expect(wheelGrip(2, 0.8, 2)).toBeCloseTo(0.8 * 2 * G / 2, 9);
  });

  it('two 6 N motors on 2 kg, mu 0.8: 12 N / 2 kg = 6 m/s2, gripping', () => {
    const r = tractionStep(0, 0, pair(100), body, TICK_DT);
    expect(r.speed / TICK_DT).toBeCloseTo(6, 9);
    expect(r.wheels.every((w) => !w.slipping && w.slip === 0)).toBe(true);
  });

  it('mu 0.2: grip 0.2 * 9.81 = 1.962 m/s2 and both wheels slip by command minus ground', () => {
    const r = tractionStep(0, 0, pair(100), { ...body, friction: 0.2 }, TICK_DT);
    expect(r.speed / TICK_DT).toBeCloseTo(0.2 * G, 9);
    expect(r.wheels.every((w) => w.slipping && w.slip === 100)).toBe(true);
  });

  it('opposite wheels at 6 N turn the robot at 2 * 6 * 0.35 / I = 16.91 rad/s2 and do not move it', () => {
    const r = tractionStep(0, 0, [{ side: -0.35, command: -100, driveN: 6, brakeN: 0 }, { side: 0.35, command: 100, driveN: 6, brakeN: 0 }], body, TICK_DT);
    expect(r.speed).toBeCloseTo(0, 12);
    // Left wheel forward is -100 here: the right wheel pushes forward, the left one backward = turning left (negative).
    expect(Math.abs(r.turn) / TICK_DT).toBeCloseTo(4.2 / 0.248333, 3);
  });

  it('never overshoots: a wheel that is nearly at the command closes the gap and stays there', () => {
    let s = 0;
    let t = 0;
    for (let i = 0; i < 200; i++) {
      const r = tractionStep(s, t, [{ side: -0.35, command: 1, driveN: 6, brakeN: 0 }, { side: 0.35, command: 0.5, driveN: 6, brakeN: 0 }], body, TICK_DT);
      s = r.speed;
      t = r.turn;
    }
    // The wheels settle at their own speeds: v = 0.75 m/s, turn = (left - right) / track = 0.5 / 0.7.
    expect(s).toBeCloseTo(0.75, 6);
    expect(t).toBeCloseTo(0.5 / 0.7, 6);
  });
});

describe('robot with real physics, in the world', () => {
  it('2 kg, two 6 N motors, mu 0.8: speeds up at 6 m/s2 and the wheels grip', () => {
    const s = setup();
    s.run(30, FAST_RPM, FAST_RPM);
    expect(s.view().robot!.speed).toBeCloseTo(6 * 0.5, 6);
    expect(s.view().robot!.slip!.every((x) => x === 0)).toBe(true);
    // x = a t^2 / 2 with the speed averaged over each tick: 6 * 0.25 / 2 = 0.75 m.
    expect(s.view().position.x).toBeCloseTo(0.75, 3);
  });

  it('1 kg of payload on the chassis: 12 N / 3 kg = 4 m/s2', () => {
    const s = setup({ payloadKg: 1 });
    s.run(30, FAST_RPM, FAST_RPM);
    expect(s.view().robot!.payload).toBeCloseTo(1, 9);
    expect(s.view().robot!.speed).toBeCloseTo(4 * 0.5, 6);
  });

  it('mu 0.2: grip-limited at 1.962 m/s2, wheel rim runs ahead of the ground', () => {
    const s = setup({ mu: 0.2 });
    s.run(30, FAST_RPM, FAST_RPM);
    expect(s.view().robot!.speed).toBeCloseTo(0.2 * G * 0.5, 6);
    const slip = s.view().robot!.slip!;
    expect(slip.length).toBe(2);
    // Slip = commanded rim speed minus ground speed.
    for (const x of slip) expect(x).toBeCloseTo(rimOf(FAST_RPM) - 0.2 * G * (29 / 60), 3);
    const wheel = s.w.robotWheelState(s.robot, 'l')!;
    expect(wheel.slipping).toBe(true);
    expect(wheel.rpm).toBeCloseTo(FAST_RPM, 6);
  });

  it('a rolling wheel turns with the ground, not with its command', () => {
    const s = setup();
    s.run(30, FAST_RPM, FAST_RPM);
    const wheel = s.w.robotWheelState(s.robot, 'l')!;
    expect(wheel.slipping).toBe(false);
    expect(wheel.rpm).toBeCloseTo(rpmFor(6 * (29 / 60)), 3);
  });

  it('turns on the spot at 16.9 rad/s2: 2 kg, 1 m x 0.7 m, wheels 0.35 m from the middle, 6 N each', () => {
    const s = setup();
    s.run(10, -FAST_RPM, FAST_RPM);
    const alpha = (4.2 / yawInertia(2, 1, 0.7));
    expect(alpha).toBeCloseTo(16.91, 2);
    // Right wheel forward, left wheel back: the robot turns left (negative turn rate).
    expect(s.view().robot!.turnRate).toBeCloseTo(-alpha * 10 * TICK_DT, 6);
    expect(s.view().robot!.speed).toBeCloseTo(0, 9);
  });

  it('a chassis twice as heavy turns twice as slowly', () => {
    const light = setup({ kg: 2 });
    const heavy = setup({ kg: 4 });
    light.run(10, -FAST_RPM, FAST_RPM);
    heavy.run(10, -FAST_RPM, FAST_RPM);
    expect(heavy.view().robot!.turnRate / light.view().robot!.turnRate).toBeCloseTo(0.5, 6);
  });

  describe('braking', () => {
    /** Reach about 1 m/s, then cut the power and measure how far the chassis rolls. */
    function stopDistance(o: Opts): { v0: number; metres: number } {
      const s = setup(o);
      s.run(60, rpmFor(1), rpmFor(1));
      const v0 = s.view().robot!.speed;
      const x0 = s.view().position.x;
      s.run(240, 0, 0);
      expect(Math.abs(s.view().robot!.speed)).toBeLessThan(1e-9);
      return { v0, metres: s.view().position.x - x0 };
    }

    it('friction only: 1 m/s, mu 0.8 stops in v2 / (2 mu g) = 0.064 m for 2 kg and for 5 kg alike', () => {
      for (const kg of [2, 5]) {
        const { v0, metres } = stopDistance({ kg });
        expect(v0).toBeCloseTo(1, 6);
        expect(metres).toBeCloseTo(1 / (2 * 0.8 * G), 3);
      }
    });

    it('motor braking 2 N a motor: the 5 kg robot needs 0.625 m, the 2 kg robot 0.25 m', () => {
      const light = stopDistance({ kg: 2, brakeN: 2 });
      const heavy = stopDistance({ kg: 5, brakeN: 2 });
      expect(light.metres).toBeCloseTo(1 / (2 * (4 / 2)), 3);
      expect(heavy.metres).toBeCloseTo(1 / (2 * (4 / 5)), 3);
    });

    it('a motor brake stronger than the grip gives the friction distance again', () => {
      const strong = stopDistance({ kg: 5, brakeN: 500 });
      expect(strong.metres).toBeCloseTo(1 / (2 * 0.8 * G), 3);
    });
  });

  it('robot push force is capped by what the wheels grip: 2 kg, mu 0.2 gives 2 * 0.2 * 9.81 / 2 * 2 = 3.92 N, not 60 N', () => {
    const grippy = setup({ mu: 0.8 });
    const slippery = setup({ mu: 0.2 });
    for (const s of [grippy, slippery]) {
      for (let i = 0; i < 3; i++) {
        s.w.setRobotWheel(s.robot, 'l', { side: -0.35, forward: 0, radius: 0.15, rpm: 60, pushN: 30 });
        s.w.setRobotWheel(s.robot, 'r', { side: 0.35, forward: 0, radius: 0.15, rpm: 60, pushN: 30 });
        s.w.step(TICK_DT);
      }
    }
    expect(slippery.w.robotPushN(slippery.robot, 1)).toBeCloseTo(0.2 * 2 * G, 6);
    expect(grippy.w.robotPushN(grippy.robot, 1)).toBeCloseTo(2 * 0.8 * 2 * G / 2, 6);
  });
});

describe('real physics off: the plain drive of every older board', () => {
  it('the chassis follows the old rule and publishes no slip', () => {
    const s = setup({ realPhysics: false });
    s.run(30, FAST_RPM, FAST_RPM);
    expect(s.view().robot!.speed).toBeCloseTo(6 * 0.5, 6);
    expect('slip' in s.view().robot!).toBe(false);
    expect(s.w.robotWheelState(s.robot, 'l')).toBeNull();
  });

  it('a grip-limited start does not slip: the wheel speed is just the command', () => {
    const s = setup({ realPhysics: false, mu: 0.2 });
    s.run(30, FAST_RPM, FAST_RPM);
    expect(s.view().robot!.speed).toBeCloseTo(0.2 * G * 0.5, 6);
    expect(s.w.robotWheelState(s.robot, 'l')).toBeNull();
  });
});

describe('motor card with real physics', () => {
  const nodes = (showSlip: string) => [
    ['body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, height: 0.3, friction: 0.2, pushObjects: 'no' }],
    ['ml', 'motor', { side: -0.35, maxRpm: 2000, accel: 10000, showSlip, showTurns: 'yes' }],
    ['mr', 'motor', { side: 0.35, maxRpm: 2000, accel: 10000, showSlip }],
    ['p', 'const', { value: 1 }],
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 200, y: 1, z: 200 } }],
  ] as [string, string, Record<string, number | string | { x: number; y: number; z: number }>][];
  const wires: [string, string, string, string][] = [
    ['body', 'self', 'ml', 'body'],
    ['body', 'self', 'mr', 'body'],
    ['p', 'value', 'ml', 'power'],
    ['p', 'value', 'mr', 'power'],
  ];

  it('slipping and slip speed read true and positive on slippery ground, false and 0 when switched off', () => {
    const on = rig(nodes('yes'), wires, '3d', false, true);
    on.tick(40);
    expect(on.out('ml', 'slipping')).toBe(true);
    expect(on.out('ml', 'slipSpeed') as number).toBeGreaterThan(1);
    // The wheel runs ahead of the ground: its revolutions are the commanded ones.
    expect(on.out('ml', 'rpm') as number).toBeGreaterThan(1500);

    const off = rig(nodes('yes'), wires, '3d');
    off.tick(40);
    expect(off.out('ml', 'slipping')).toBe(false);
    expect(off.out('ml', 'slipSpeed')).toBe(0);
  });

  it('on firm ground the wheel rpm output follows the robot, not the command', () => {
    const firm = nodes('no');
    (firm[0]![2] as Record<string, unknown>).friction = 0.8;
    const r = rig(firm, wires, '3d', false, true);
    r.tick(30);
    const speed = r.out('body', 'speed') as number;
    const rpm = r.out('ml', 'rpm') as number;
    expect(rpm / rpmFor(speed)).toBeGreaterThan(0.9);
    expect(rpm / rpmFor(speed)).toBeLessThanOrEqual(1);
    expect(rpm).toBeLessThan(500);
  });
});

describe('same board, real physics on and off, differ only by the switch', () => {
  it('worldOptionsForGraph sends the option only when the switch is on', async () => {
    const { worldOptionsForGraph } = await import('../../src/world/graph-world-options');
    expect(worldOptionsForGraph({ nodes: [], wires: [] })).toBeUndefined();
    expect(worldOptionsForGraph({ nodes: [], wires: [], settings: { realPhysics: true } })).toEqual({ realPhysics: true });
    expect(worldOptionsForGraph({ nodes: [], wires: [], settings: { solidBodies: true, realPhysics: true } })).toEqual({ solidBodies: true, frontCarryAll: true, realPhysics: true });
  });
});

