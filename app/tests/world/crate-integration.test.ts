import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT, type EntityView } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { crate, crateWorld, floor, run, tipDegrees, view } from './crate-helpers';

/**
 * Crates next to the parts that already existed: robot chassis (push cap and payload), piston, gripper, a character
 * carrying, a spawner, and the switch being off.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

function robotWorld(kg: number, opts: { y?: number } = {}) {
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 60 } }],
    ['body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, heading: 0, height: 0.3, showPush: 'yes', pushObjects: 'yes' }],
    ['ml', 'motor', { side: -0.4, maxForce: 30 }],
    ['mr', 'motor', { side: 0.4, maxForce: 30 }],
    ['p', 'const', { value: 1 }],
    ['c0', 'item', { shape: 'crate', position: { x: 3, y: opts.y ?? 0.3, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, mass: kg }],
  ];
  const wires: WireSpec[] = [['body', 'self', 'ml', 'body'], ['body', 'self', 'mr', 'body'], ['p', 'value', 'ml', 'power'], ['p', 'value', 'mr', 'power']];
  return rig(nodes, wires, '3d', false, true, rapier);
}

describe('a robot pushes crates with the force it really has', () => {
  // Two wheels, robot 2 kg with mu 0.8: each wheel grips 0.8 * 2 * 9.81 / 2 = 7.85 N, so the push cap is 15.7 N.
  // A crate with mu 0.5 needs 0.5 * m * 9.81: 3 kg = 14.7 N (moves), 4 kg = 19.6 N (does not).
  it('a 3 kg crate (14.7 N) is pushed along, with the robot behind it', () => {
    const r = robotWorld(3);
    r.tick(60 * 6);
    const crateX = r.entity('c0')!.position.x;
    const botX = r.entity('body')!.position.x;
    expect(crateX).toBeGreaterThan(8);
    expect(crateX - botX).toBeGreaterThan(0.75);
    expect(crateX - botX).toBeLessThan(0.85);
    expect(r.out('body', 'pushForce') as number).toBeCloseTo(14.715, 2);
  });

  it('a 4 kg crate (19.6 N) is above the cap: the robot stops at it and the crate does not move', () => {
    const r = robotWorld(4);
    r.tick(60 * 6);
    expect(r.entity('c0')!.position.x).toBeCloseTo(3, 2);
    expect(r.entity('body')!.position.x).toBeGreaterThan(2.15);
    expect(r.entity('body')!.position.x).toBeLessThan(2.25);
    expect(r.out('body', 'pushForce') as number).toBeCloseTo(15.696, 2);
  });

  it('a crate pushed low and slowly by the chassis slides; the cap is the same as the formula says', () => {
    const r = robotWorld(1);
    r.tick(60 * 4);
    expect(tipDegrees(r.entity('c0')!)).toBeLessThan(3);
    expect(r.out('body', 'pushForce') as number).toBeCloseTo(4.905, 3);
  });

  it('a crate lying on the chassis rides along while the robot drives', () => {
    const nodes: NodeSpec[] = [
      ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 60 } }],
      ['body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, heading: 0, height: 0.3, size: { x: 1, y: 0.3, z: 1 } }],
      ['ml', 'motor', { side: -0.4, maxForce: 30 }],
      ['mr', 'motor', { side: 0.4, maxForce: 30 }],
      ['p', 'const', { value: 0.4 }],
      ['load', 'item', { shape: 'crate', position: { x: 0, y: 0.52, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: 1, mu: 0.8 }],
    ];
    const r = rig(nodes, [['body', 'self', 'ml', 'body'], ['body', 'self', 'mr', 'body'], ['p', 'value', 'ml', 'power'], ['p', 'value', 'mr', 'power']], '3d', false, true, rapier);
    r.tick(60 * 3);
    const bot = r.entity('body')!.position.x;
    const load = r.entity('load')!.position;
    expect(bot).toBeGreaterThan(1);
    expect(Math.abs(load.x - bot)).toBeLessThan(0.15);
    expect(load.y).toBeGreaterThan(0.45);
  });
});

describe('piston and gripper keep their own force limits next to crates', () => {
  function piston(maxForce: number) {
    const nodes: NodeSpec[] = [
      ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 6 } }],
      ['p', 'linear-actuator', { position: { x: 0, y: 0.3, z: 0 }, stroke: 2, maxForce, headSize: 0.6, speed: 1 }],
      ['e', 'key', { key: 'KeyE' }],
      ['c0', 'item', { shape: 'crate', position: { x: 4, y: 0.3, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, mass: 10 }],
    ];
    return rig(nodes, [['e', 'held', 'p', 'extend']], '3d', false, true, rapier);
  }

  it('a 10 kg crate (49.05 N): the piston at 40 N stalls, at 60 N it pushes the crate along', () => {
    const weak = piston(40);
    weak.tick(10);
    weak.hold('KeyE');
    weak.tick(60 * 4);
    expect(weak.entity('c0')!.position.x).toBeCloseTo(4, 2);
    expect(weak.out('p', 'overloaded')).toBe(true);
    const strong = piston(60);
    strong.tick(10);
    strong.hold('KeyE');
    strong.tick(60 * 4);
    expect(strong.entity('c0')!.position.x).toBeGreaterThan(5);
    expect(strong.out('p', 'overloaded')).toBe(false);
  });

  function hand() {
    const nodes: NodeSpec[] = [
      ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 20, y: 1, z: 4 } }],
      ['hand', 'block', { position: { x: 0, y: 1.5, z: 0 }, size: { x: 0.1, y: 0.1, z: 0.1 }, type: 'pickup' }],
      ['g', 'gripper', { width: 1, grip: 'between' }],
      ['c', 'item', { shape: 'crate', position: { x: 0.3, y: 1.5, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: 1 }],
      ['k', 'key', { key: 'Space' }],
    ];
    return rig(nodes, [['hand', 'self', 'g', 'base'], ['k', 'held', 'g', 'close']], '3d', false, true, rapier);
  }

  it('a gripped crate leaves the simulation while held (it does not fall) and drops from its place when released', () => {
    const r = hand();
    r.hold('Space');
    r.tick(60 * 2);
    expect(r.out('g', 'holding')).toBe(true);
    expect(r.entity('c')!.position.y).toBeGreaterThan(1.4);
    expect(r.world.isOnGround(r.entity('c')!.id)).toBe(false);
    r.hold();
    r.tick(60 * 2);
    expect(r.out('g', 'holding')).toBe(false);
    expect(r.entity('c')!.position.y).toBeCloseTo(0.2, 1);
    expect(r.world.isOnGround(r.entity('c')!.id)).toBe(true);
  });
});

describe('a character carrying a crate', () => {
  it('the crate leaves the simulation while carried, and re-enters upright when put down', async () => {
    const w = await crateWorld();
    floor(w);
    const hero = w.spawn({ kind: 'character', ownerNodeId: 'hero', position: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#f00', solid: true });
    const c = crate(w, 0.5, 0.2, 0, undefined, { carryable: true });
    run(w, 0.5);
    expect(w.grab(hero, 2)).toBe(c);
    run(w, 1);
    const held = view(w, c);
    expect(held.position.y).toBeGreaterThan(1);
    expect(held.rotation).toBeUndefined();
    expect(w.drop(hero)).toBe(c);
    run(w, 2);
    const down = view(w, c);
    expect(down.position.y).toBeCloseTo(0.2, 1);
    expect(down.rotation).toBeDefined();
    expect(tipDegrees(down)).toBeLessThan(1);
  });
});

describe('crates loaded as vehicle cargo', () => {
  it('leave the simulation while on board and re-enter, upright, when unloaded', async () => {
    const w = await crateWorld();
    floor(w);
    const truck = w.spawn({ kind: 'vehicle', ownerNodeId: 'truck', position: { x: 0, y: 0.5, z: 0 }, size: { x: 2.5, y: 1, z: 1.4 }, color: '#f00', solid: true, vehicle: { model: 'truck', steerMode: 'direction', maxSpeed: 8, accel: 8 } });
    const c = crate(w, 1.6, 0.25, 0, { x: 0.5, y: 0.5, z: 0.5 });
    run(w, 0.5);
    expect(view(w, c).rotation).toBeDefined();
    expect(w.loadCargo(truck, 5, 4)).toBe(c);
    run(w, 1);
    expect(view(w, c).rotation).toBeUndefined();
    expect(view(w, c).position.y).toBeGreaterThan(0.9);
    expect(w.unloadCargo(truck)).toBe(c);
    run(w, 2);
    expect(view(w, c).rotation).toBeDefined();
    expect(view(w, c).position.y).toBeCloseTo(0.25, 1);
  });
});

describe('a spawner feeds mass and friction to the crates it makes', () => {
  function spawnerRun(mu: number) {
    const nodes: NodeSpec[] = [
      ['belt', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 6 }, style: 'belt', beltSpeed: 2, beltWalls: 'no' }],
      ['go', 'on-start'],
      ['sp', 'spawner', { template: 'item', shape: 'crate', position: { x: 0, y: 0.3, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, maxAlive: 1, lifetime: 0, mass: 5, mu }],
    ];
    return rig(nodes, [['go', 'fired', 'sp', 'spawn'], ['go', 'started', 'belt', 'run']], '3d', false, true, rapier);
  }

  it('the made crate carries the mass and mu of the card and is carried by the belt at a rate that follows mu', () => {
    const slow = spawnerRun(0.2);
    const quick = spawnerRun(0.8);
    slow.tick(30);
    quick.tick(30);
    const sv = slow.world.entities().find((e) => e.kind === 'item')!;
    expect(sv.mass).toBe(5);
    expect(sv.mu).toBe(0.2);
    const speed = (r: typeof slow, id: string): number => {
      const x0 = r.world.getEntity(id)!.position.x;
      r.tick(6);
      return (r.world.getEntity(id)!.position.x - x0) / (6 * TICK_DT);
    };
    // 0.5 s in: mu 0.8 has long reached the belt's 2 m/s (0.25 s), mu 0.2 is still gaining speed (1.02 s).
    const fast = speed(quick, quick.world.entities().find((e) => e.kind === 'item')!.id);
    const sluggish = speed(slow, sv.id);
    expect(fast).toBeGreaterThan(1.9);
    expect(sluggish).toBeLessThan(1.3);
    expect(sluggish).toBeGreaterThan(0.5);
  });
});

describe('the switch off leaves items on the old rules', () => {
  const tallBoard = (options?: { realPhysics: true }) => {
    const w = createWorld('3d', options);
    floor(w);
    const c = crate(w, 0, 0.6, 0, { x: 0.4, y: 1.2, z: 0.4 }, { mass: 10 });
    return { w, c };
  };

  it('no rotation field, plain fall, and no engine is created', () => {
    const { w, c } = tallBoard();
    run(w, 2);
    expect(view(w, c).rotation).toBeUndefined();
    const json = JSON.stringify(w.entities());
    expect(json).not.toContain('rotation');
  });

  it('the switch on without the engine loaded keeps the old item rules but with the maker gravity, and says nothing new in the views', () => {
    const w = createWorld('3d', { realPhysics: true, gravity: 9.81 });
    floor(w);
    const c = crate(w, 0, 4.905 + 0.2, 0);
    let t = -1;
    for (let i = 0; i < 400 && t < 0; i++) {
      w.step(TICK_DT);
      if (view(w, c).position.y < 0.21) t = (i + 1) * TICK_DT;
    }
    expect(t).toBeGreaterThan(0.97);
    expect(t).toBeLessThan(1.05);
    expect(view(w, c).rotation).toBeUndefined();
  });

  it('the old gravity (30) still applies with the switch off', () => {
    const w = createWorld('3d');
    floor(w);
    const c = crate(w, 0, 4.905 + 0.2, 0);
    let t = -1;
    for (let i = 0; i < 400 && t < 0; i++) {
      w.step(TICK_DT);
      if (view(w, c).position.y < 0.21) t = (i + 1) * TICK_DT;
    }
    expect(t).toBeGreaterThan(0.54);
    expect(t).toBeLessThan(0.62);
  });
});

describe('what the renderer is given', () => {
  it('only crates under the engine carry a rotation, as a unit quaternion', async () => {
    const w = await crateWorld();
    floor(w);
    const c = crate(w, 0, 1, 0);
    const b = w.spawn({ kind: 'block', ownerNodeId: 'b', position: { x: 4, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#fff', solid: true });
    run(w, 1);
    const rot = (id: string): EntityView['rotation'] => view(w, id).rotation;
    const q = rot(c)!;
    expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 5);
    expect(rot(b)).toBeUndefined();
  });
});
