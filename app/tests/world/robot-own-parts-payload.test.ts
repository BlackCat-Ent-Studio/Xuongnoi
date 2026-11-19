import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT, type ParamValue } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';

/**
 * What a robot chassis carries ("Khối lượng đang chở") with "Vật lý thật" on. The pieces of a machine bolted to the chassis
 * (joint hub, link, its solid cover, a piston, a hand) are part of the robot, never its cargo; a crate resting on one of them,
 * or held by a hand bolted to the chassis, is cargo of the chassis.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const CHASSIS = { length: 1.2, width: 1, height: 0.3, mass: 5 };
const TOP = CHASSIS.height;

interface Build {
  /** Pieces bolted to the chassis. */
  machine: 'none' | 'tray' | 'bar' | 'fork' | 'piston';
  crateKg?: number;
  /** Gap (m) between the chassis top and the underside of the tray. */
  clearance?: number;
  maxPayload?: number;
  real?: boolean;
  /** "Chắn vật" of the joint hub; solid unless given (the hub then sits 4 cm into the chassis top, as a hub bolted onto a chassis does). */
  hub?: 'yes' | 'no';
}

function build(b: Build) {
  const t = b.machine === 'bar' ? 0.2 : b.machine === 'fork' ? 0.1 : 0.05;
  const up = CHASSIS.height / 2 + (b.clearance ?? 0.01) + t / 2;
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 20 } }],
    ['body', 'robot-body', { position: { x: 0, y: CHASSIS.height / 2, z: 0 }, heading: 0, ...CHASSIS, friction: 0.8, showPayload: 'yes', maxPayload: b.maxPayload ?? 0 }],
    ['ml', 'motor', { side: -0.45, maxRpm: 90, maxForce: 6 }],
    ['mr', 'motor', { side: 0.45, maxRpm: 90, maxForce: 6 }],
    ['p', 'const', { value: 0 }],
    ['go', 'on-start', {}],
  ];
  const wires: WireSpec[] = [
    ['body', 'self', 'ml', 'body'], ['body', 'self', 'mr', 'body'],
    ['p', 'value', 'ml', 'power'], ['p', 'value', 'mr', 'power'],
  ];
  const joint = (z: number): Record<string, ParamValue> => ({ axis: 'pitch', start: 0, min: -90, max: 90, maxTorque: 150, mount: { x: -0.6, y: up, z }, solid: b.hub ?? 'yes' });
  let surface = TOP;
  if (b.machine === 'tray' || b.machine === 'bar') {
    nodes.push(['tilt', 'joint', joint(0)], ['tray', 'link', { length: 1, thickness: t, solid: 'yes', mass: 1, ...(b.machine === 'tray' ? { width: 0.6 } : {}) }]);
    wires.push(['body', 'self', 'tilt', 'base'], ['go', 'started', 'tilt', 'power'], ['tilt', 'tip', 'tray', 'base']);
    surface = CHASSIS.height / 2 + up + t / 2;
  } else if (b.machine === 'fork') {
    for (const [k, z] of [['a', -0.12], ['b', 0.12]] as const) {
      nodes.push([`tilt-${k}`, 'joint', joint(z)], [`tray-${k}`, 'link', { length: 1, thickness: t, solid: 'yes', mass: 0.5 }]);
      wires.push(['body', 'self', `tilt-${k}`, 'base'], ['go', 'started', `tilt-${k}`, 'power'], [`tilt-${k}`, 'tip', `tray-${k}`, 'base']);
    }
    surface = CHASSIS.height / 2 + up + t / 2;
  } else if (b.machine === 'piston') {
    // A pusher lying on the chassis top, at its right edge, pointing across it.
    nodes.push(['push', 'linear-actuator', { direction: 90, stroke: 0.3, headSize: 0.2, mount: { x: 0.3, y: CHASSIS.height / 2 + 0.11, z: -0.45 } }]);
    wires.push(['body', 'self', 'push', 'base']);
  }
  if (b.crateKg !== undefined) {
    nodes.push(['crate', 'item', { shape: 'crate', position: { x: -0.1, y: surface + 0.2 + 0.005, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: b.crateKg }]);
  }
  const real = b.real !== false;
  return rig(nodes, wires, '3d', false, real, real ? rapier : undefined);
}

const seconds = (r: ReturnType<typeof build>, s: number): void => r.tick(Math.round(s / TICK_DT));

describe('the pieces bolted to a chassis are not its cargo, and not in its way', () => {
  for (const machine of ['tray', 'bar', 'fork', 'piston'] as const) {
    it(`a chassis with a ${machine} and no crate carries 0 kg and drives exactly like a bare chassis`, () => {
      const bare = build({ machine: 'none' });
      const r = build({ machine });
      seconds(bare, 1);
      seconds(r, 1);
      expect(r.out('body', 'payload')).toBe(0);
      bare.set('p', { value: 0.7 });
      r.set('p', { value: 0.7 });
      for (let k = 0; k < Math.round(3 / TICK_DT); k++) {
        bare.tick();
        r.tick();
        expect(r.out('body', 'payload')).toBe(0);
        expect(r.entity('body')!.position).toEqual(bare.entity('body')!.position);
      }
      expect(r.entity('body')!.robot!.speed).toBeGreaterThan(0.9);
      bare.world.dispose?.();
      r.world.dispose?.();
    });
  }

  it('a tray held 10 cm above the chassis is no cargo either', () => {
    const r = build({ machine: 'tray', clearance: 0.1 });
    seconds(r, 2);
    expect(r.out('body', 'payload')).toBe(0);
    r.world.dispose?.();
  });
});

describe('a crate resting on a piece bolted to the chassis is cargo of the chassis', () => {
  for (const machine of ['tray', 'bar', 'fork'] as const) {
    for (const kg of [1, 5]) {
      it(`${kg} kg crate on the ${machine}: the chassis carries ${kg} kg`, () => {
        const r = build({ machine, crateKg: kg });
        seconds(r, 2);
        expect(Number(r.out('body', 'payload'))).toBeCloseTo(kg, 6);
        expect(r.out('body', 'overloaded')).toBe(false);
        r.world.dispose?.();
      });
    }
  }

  it('also when the tray is 10 cm above the chassis top', () => {
    const r = build({ machine: 'tray', crateKg: 2, clearance: 0.1 });
    seconds(r, 2);
    expect(Number(r.out('body', 'payload'))).toBeCloseTo(2, 6);
    r.world.dispose?.();
  });

  it('a crate on the chassis top beside a bolted piston counts alone', () => {
    const r = build({ machine: 'piston', crateKg: 3 });
    seconds(r, 2);
    expect(Number(r.out('body', 'payload'))).toBeCloseTo(3, 6);
    r.world.dispose?.();
  });

  it('"Quá tải" follows it: 5 kg on the tray of a chassis that may carry 3 kg stops the motors, 2 kg does not', () => {
    const heavy = build({ machine: 'tray', crateKg: 5, maxPayload: 3 });
    const light = build({ machine: 'tray', crateKg: 2, maxPayload: 3 });
    for (const r of [heavy, light]) {
      seconds(r, 1);
      r.set('p', { value: 0.7 });
      seconds(r, 3);
    }
    expect(heavy.out('body', 'overloaded')).toBe(true);
    expect(Math.abs(heavy.entity('body')!.position.x)).toBeLessThan(0.001);
    expect(light.out('body', 'overloaded')).toBe(false);
    expect(light.entity('body')!.position.x).toBeGreaterThan(1);
    heavy.world.dispose?.();
    light.world.dispose?.();
  });

  it('the load slows the chassis as its mass says: 5 kg on the tray of a 5 kg chassis halves the acceleration', () => {
    const empty = build({ machine: 'tray' });
    const loaded = build({ machine: 'tray', crateKg: 5 });
    for (const r of [empty, loaded]) {
      seconds(r, 1);
      r.set('p', { value: 0.7 });
      seconds(r, 0.25);
    }
    const ratio = loaded.entity('body')!.robot!.speed / empty.entity('body')!.robot!.speed;
    expect(ratio).toBeGreaterThan(0.45);
    expect(ratio).toBeLessThan(0.55);
    empty.world.dispose?.();
    loaded.world.dispose?.();
  });
});

describe('the weighing rule on the world itself', () => {
  /** A chassis, one block declared as bolted to it by node "hand", and a crate. */
  function scene() {
    const w = createWorld('3d', { realPhysics: true, rapier });
    w.spawn({ kind: 'block', ownerNodeId: 'floor', position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 40 }, color: '#888', solid: true });
    const body = w.spawn({ kind: 'robot', ownerNodeId: 'body', position: { x: 0, y: 0.15, z: 0 }, size: { x: 1.2, y: 0.3, z: 1.2 }, color: '#00f', solid: true, robot: { length: 1.2, width: 1, mass: 5, friction: 0.8 } });
    const part = w.spawn({ kind: 'block', ownerNodeId: 'hand', position: { x: 0, y: 0.35, z: 0 }, size: { x: 0.3, y: 0.1, z: 0.3 }, color: '#333', solid: true });
    return { w, body, part };
  }

  it('a crate a hand bolted to the chassis holds in the air is cargo of the chassis; let go, or on a hand that is not bolted to it, it is not', () => {
    const s = scene();
    const crate = s.w.spawn({ kind: 'item', ownerNodeId: 'crate', position: { x: 2, y: 1.5, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, color: '#fa0', solid: false, mass: 4 });
    s.w.setMount('hand', s.body);
    expect(s.w.massOn(s.body)).toBe(0);
    s.w.setItemGrip(crate, 'hand');
    expect(s.w.massOn(s.body)).toBeCloseTo(4, 9);
    s.w.setItemGrip(crate, 'other-hand');
    expect(s.w.massOn(s.body)).toBe(0);
    s.w.setItemGrip(crate, null);
    expect(s.w.massOn(s.body)).toBe(0);
    s.w.dispose?.();
  });

  it('a piece that stops declaring its mount is weighed again as a plain body from the next step on; with the switch off a mount is never taken', () => {
    const s = scene();
    s.w.setMount('hand', s.body);
    expect(s.w.massOn(s.body)).toBe(0);
    s.w.step(TICK_DT);
    expect(s.w.massOn(s.body)).toBe(0);
    // Not refreshed before this step: dropped by it.
    s.w.step(TICK_DT);
    expect(s.w.massOn(s.body)).toBe(10);
    s.w.dispose?.();

    const off = createWorld('3d');
    off.spawn({ kind: 'block', ownerNodeId: 'floor', position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 40 }, color: '#888', solid: true });
    const body = off.spawn({ kind: 'robot', ownerNodeId: 'body', position: { x: 0, y: 0.15, z: 0 }, size: { x: 1.2, y: 0.3, z: 1.2 }, color: '#00f', solid: true, robot: { length: 1.2, width: 1, mass: 5, friction: 0.8 } });
    off.spawn({ kind: 'block', ownerNodeId: 'hand', position: { x: 0, y: 0.35, z: 0 }, size: { x: 0.3, y: 0.1, z: 0.3 }, color: '#333', solid: true });
    off.setMount('hand', body);
    expect(off.massOn(body)).toBe(10);
  });

  it('a piece bolted to a piece bolted to the chassis belongs to the chassis too', () => {
    const s = scene();
    const tip = s.w.spawn({ kind: 'block', ownerNodeId: 'finger', position: { x: 0, y: 0.45, z: 0 }, size: { x: 0.2, y: 0.1, z: 0.2 }, color: '#333', solid: true });
    s.w.setMount('hand', s.body);
    s.w.setMount('finger', s.part);
    expect(s.w.massOn(s.body)).toBe(0);
    // Each piece is not cargo of the piece it is bolted to either, and the crate on the finger loads all three.
    expect(s.w.massOn(s.part)).toBe(0);
    s.w.spawn({ kind: 'item', ownerNodeId: 'crate', position: { x: 0, y: 0.5 + 0.2, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, color: '#fa0', solid: false, mass: 2 });
    for (let k = 0; k < 60; k++) {
      s.w.setMount('hand', s.body);
      s.w.setMount('finger', s.part);
      s.w.step(TICK_DT);
    }
    expect(s.w.massOn(s.body)).toBeCloseTo(2, 6);
    expect(s.w.massOn(s.part)).toBeCloseTo(2, 6);
    expect(s.w.massOn(tip)).toBeCloseTo(2, 6);
    s.w.dispose?.();
  });
});

describe('with "Vật lý thật" off the weighing is the one older boards have', () => {
  it('a bar bolted 1 cm above the chassis still reads as load (the board plays as it did)', () => {
    const r = build({ machine: 'bar', real: false, hub: 'no' });
    seconds(r, 1);
    expect(Number(r.out('body', 'payload'))).toBeGreaterThan(0);
  });
});
