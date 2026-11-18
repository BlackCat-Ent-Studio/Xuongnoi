import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';

/**
 * A pusher pushes the crate it touches, never the body that only holds the crate up (a chassis top, a platform), and never
 * the body it is mounted on. With "Vật lý thật" on the engine rests a crate a hair inside what supports it, which used to
 * make the supporting robot count as pushed too: the piston then stalled or shoved the robot instead of the crate.
 * Crate: 0.4 m cube, 1 kg, mu 0.5. Sliding it takes mu * m * g = 0.5 * 1 * 9.81 = 4.905 N; tipping it (pushed at its middle,
 * 0.2 m up, about an edge 0.2 m away) takes m * g * 0.2 / 0.2 = 9.81 N, so the smaller one, sliding, is what the card reads.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const CUBE = { x: 0.4, y: 0.4, z: 0.4 };
const FLOOR: NodeSpec = ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 6 } }];
/** Chassis 1.2 x 1 x 0.3 m, 5 kg, heading 0 (+x), top face at y = 0.3. No motor is wired: its wheels hold still. */
const CHASSIS: NodeSpec = ['bot', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, heading: 0, length: 1.2, width: 1, height: 0.3, mass: 5, friction: 0.8 }];
const KEY: [NodeSpec, WireSpec] = [['e', 'key', { key: 'KeyE' }], ['e', 'held', 'p', 'extend']];

function play(nodes: NodeSpec[], wires: WireSpec[], seconds: number) {
  const r = rig(nodes, wires, '3d', false, true, rapier);
  r.tick(30);
  const start = { bot: r.entity('bot')?.position.x ?? 0, bota: r.entity('plat')?.position.x ?? 0 };
  r.hold('KeyE');
  let peakForce = 0;
  let overloaded = false;
  let botDrift = 0;
  for (let i = 0; i < seconds * 60; i++) {
    r.tick(1);
    peakForce = Math.max(peakForce, r.out('p', 'force') as number);
    overloaded ||= r.out('p', 'overloaded') === true;
    const bot = r.entity('bot');
    if (bot) botDrift = Math.max(botDrift, Math.abs(bot.position.x - start.bot));
  }
  return { r, start, peakForce, overloaded, botDrift };
}

describe('a pusher never pushes what only supports the crate, nor what it is mounted on', () => {
  it('a piston on the floor pushes a crate off the top of a robot: needs mu*m*g = 4.905 N, the robot stays put', () => {
    const nodes: NodeSpec[] = [
      FLOOR,
      CHASSIS,
      ['p', 'linear-actuator', { position: { x: -4, y: 0.5, z: 0 }, stroke: 2, maxForce: 100, headSize: 0.3, speed: 0.5 }],
      KEY[0],
      ['c0', 'item', { shape: 'crate', position: { x: -0.2, y: 0.5, z: 0 }, size: CUBE, mass: 1, mu: 0.5 }],
    ];
    const res = play(nodes, [KEY[1]], 6);
    expect(res.overloaded).toBe(false);
    // The crate left the chassis (its far edge at x 0.6) and the force on the card is the sliding force.
    expect(res.r.entity('c0')!.position.x).toBeGreaterThan(0.8);
    expect(res.peakForce).toBeCloseTo(4.905, 1);
    // Tolerance 0.02 m: the 5 kg chassis sits on locked wheels (mu*m*g = 0.8*5*9.81 = 39 N against the 4.9 N the crate drags with).
    expect(res.botDrift).toBeLessThan(0.02);
  });

  it('a piston mounted on a robot pushes a crate lying on that same robot off its front, and does not push the robot', () => {
    const nodes: NodeSpec[] = [
      FLOOR,
      CHASSIS,
      // A 3 m long chassis; the rod sits on its rear end, 0.35 m above its middle: the head runs at the crate's middle height.
      ['p', 'linear-actuator', { stroke: 1.5, maxForce: 100, headSize: 0.3, speed: 0.5, mount: { x: -1.5, y: 0.35, z: 0 } }],
      KEY[0],
      ['c0', 'item', { shape: 'crate', position: { x: 0.7, y: 0.5, z: 0 }, size: CUBE, mass: 1, mu: 0.5 }],
    ];
    nodes[1] = ['bot', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, heading: 0, length: 3, width: 1, height: 0.3, mass: 5, friction: 0.8 }];
    const res = play(nodes, [KEY[1], ['bot', 'self', 'p', 'base']], 8);
    expect(res.overloaded).toBe(false);
    expect(res.r.entity('c0')!.position.x).toBeGreaterThan(res.r.entity('bot')!.position.x + 1.5);
    expect(res.peakForce).toBeCloseTo(4.905, 1);
    // The rod is bolted to the chassis, so the push and its reaction cancel inside the robot: it may only creep by the 5 mm skin.
    expect(res.botDrift).toBeLessThan(0.02);
  });

  it('a crate that carries another on top is still pushed with the whole load: mu * (1 + 1) * 9.81 = 9.81 N', () => {
    const nodes: NodeSpec[] = [
      FLOOR,
      ['p', 'linear-actuator', { position: { x: -2, y: 0.15, z: 0 }, stroke: 2, maxForce: 100, headSize: 0.3, speed: 0.5 }],
      KEY[0],
      ['c0', 'item', { shape: 'crate', position: { x: 1.5, y: 0.2, z: 0 }, size: CUBE, mass: 1, mu: 0.5 }],
      ['c1', 'item', { shape: 'crate', position: { x: 1.5, y: 0.6, z: 0 }, size: CUBE, mass: 1, mu: 0.5 }],
    ];
    const res = play(nodes, [KEY[1]], 5);
    expect(res.overloaded).toBe(false);
    expect(res.peakForce).toBeCloseTo(9.81, 1);
    expect(res.r.entity('c0')!.position.x).toBeGreaterThan(1.9);
  });

  it('a piston weaker than the crate needs (3 N against 4.905 N) on a robot stalls: overloaded, crate and robot stay', () => {
    const nodes: NodeSpec[] = [
      FLOOR,
      CHASSIS,
      ['p', 'linear-actuator', { position: { x: -4, y: 0.5, z: 0 }, stroke: 2, maxForce: 3, headSize: 0.3, speed: 0.5 }],
      KEY[0],
      ['c0', 'item', { shape: 'crate', position: { x: -0.2, y: 0.5, z: 0 }, size: CUBE, mass: 1, mu: 0.5 }],
    ];
    const res = play(nodes, [KEY[1]], 6);
    expect(res.overloaded).toBe(true);
    expect(res.r.entity('c0')!.position.x).toBeLessThan(-0.1);
    expect(res.botDrift).toBeLessThan(0.02);
  });
});
