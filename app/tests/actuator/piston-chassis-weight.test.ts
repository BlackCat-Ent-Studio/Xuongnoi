import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec } from '../helpers/arm-rig';
import { FLOOR } from '../helpers/nav-rig';
import { bot, deckRig, seconds } from '../world/deck-rig';

/**
 * With "Vật lý thật" on, a piston that pushes a parked robot chassis has to overcome the grip of that chassis: the friction on
 * its card times its weight, the mass on its card plus what it carries. Expected forces are worked out here from the cards.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const G = 9.81;

interface Push {
  mass: number;
  friction: number;
  maxForce: number;
  /** A carton of this many kg standing on the chassis. */
  cartonKg?: number;
  /** The piston comes from the side of the chassis instead of from behind it. */
  fromSide?: boolean;
  chassis?: { length: number; width: number; height: number };
  /** "Vật lý thật" (default on). */
  real?: boolean;
}

/** The chassis stands at the origin; a piston 0.15 m off it is switched on after one second and runs for five. */
function push(p: Push) {
  const b = bot({ id: 'r', x: 0, z: 0, floor: 0, ...(p.chassis ? { chassis: p.chassis } : {}), body: { mass: p.mass, friction: p.friction } });
  const at = p.fromSide ? { x: 0, y: 0.2, z: -3 } : { x: -3, y: 0.2, z: 0 };
  const nodes: NodeSpec[] = [
    ...b.nodes,
    ['p', 'linear-actuator', { position: at, direction: p.fromSide ? 90 : 0, stroke: 2, headSize: 0.2, speed: 0.5, maxForce: p.maxForce }],
    ['e', 'key', { key: 'KeyE' }],
    ...(p.cartonKg !== undefined ? [['c', 'item', { shape: 'crate', position: { x: 0, y: 0.24 + 0.15 + 0.005, z: 0 }, size: { x: 0.3, y: 0.3, z: 0.3 }, mass: p.cartonKg }] as NodeSpec] : []),
  ];
  const r = p.real === false ? rig([FLOOR, ...nodes], [...b.wires, ['e', 'held', 'p', 'extend']], '3d') : deckRig(nodes, [...b.wires, ['e', 'held', 'p', 'extend']], rapier);
  r.tick(seconds(1));
  const payload = Number(r.out('r', 'payload'));
  r.hold('KeyE');
  const res = { payload, moved: 0, mostForce: 0, force: 0, overloaded: false, everOverloaded: false, cartonOff: NaN };
  for (let k = 0; k < seconds(5); k++) {
    r.tick();
    res.force = Number(r.out('p', 'force'));
    res.mostForce = Math.max(res.mostForce, res.force);
    res.overloaded = r.out('p', 'overloaded') === true;
    res.everOverloaded ||= res.overloaded;
  }
  const e = r.entity('r')!;
  res.moved = Math.hypot(e.position.x, e.position.z);
  const c = r.entity('c');
  if (c) res.cartonOff = Math.hypot(c.position.x - e.position.x, c.position.z - e.position.z);
  r.world.dispose?.();
  return res;
}

describe('a piston pushing a parked chassis ("Vật lý thật" on)', () => {
  it('needs friction x mass x 9.81 of the chassis card: just below that it stalls with "Quá tải", just above it pushes', { timeout: 60_000 }, () => {
    const need = 0.8 * 5 * G;
    const weak = push({ mass: 5, friction: 0.8, maxForce: need - 0.5 });
    expect(weak.moved).toBeLessThan(1e-6);
    expect(weak.overloaded).toBe(true);
    expect(weak.force).toBeCloseTo(need - 0.5, 9);
    const strong = push({ mass: 5, friction: 0.8, maxForce: need + 0.5 });
    expect(strong.moved).toBeGreaterThan(1);
    expect(strong.everOverloaded).toBe(false);
    expect(strong.mostForce).toBeCloseTo(need, 6);
  });

  it('a heavier chassis needs more, a more slippery one less', { timeout: 60_000 }, () => {
    const heavy = 0.8 * 20 * G;
    expect(push({ mass: 20, friction: 0.8, maxForce: heavy - 0.5 }).moved).toBeLessThan(1e-6);
    expect(push({ mass: 20, friction: 0.8, maxForce: heavy + 0.5 }).mostForce).toBeCloseTo(heavy, 6);
    const slippery = 0.2 * 5 * G;
    expect(push({ mass: 5, friction: 0.2, maxForce: slippery - 0.5 }).moved).toBeLessThan(1e-6);
    const slid = push({ mass: 5, friction: 0.2, maxForce: slippery + 0.5 });
    expect(slid.moved).toBeGreaterThan(1);
    expect(slid.mostForce).toBeCloseTo(slippery, 6);
  });

  it('a chassis that carries a carton needs the weight of both, and the carton stays on it', { timeout: 60_000 }, () => {
    const need = 0.8 * (5 + 3) * G;
    const weak = push({ mass: 5, friction: 0.8, cartonKg: 3, maxForce: need - 0.5 });
    expect(weak.payload).toBeCloseTo(3, 6);
    expect(weak.moved).toBeLessThan(1e-6);
    expect(weak.overloaded).toBe(true);
    // Just above, it pushes, slowly: the half newton to spare speeds 8 kg up by only 0.0625 m/s every second.
    const barely = push({ mass: 5, friction: 0.8, cartonKg: 3, maxForce: need + 0.5 });
    expect(barely.everOverloaded).toBe(false);
    expect(barely.moved).toBeGreaterThan(0.5);
    expect(barely.moved).toBeLessThan(0.5 * 0.0625 * 5 * 5);
    const strong = push({ mass: 5, friction: 0.8, cartonKg: 3, maxForce: need + 20 });
    expect(strong.moved).toBeGreaterThan(1);
    expect(strong.everOverloaded).toBe(false);
    expect(strong.mostForce).toBeCloseTo(need, 6);
    expect(strong.cartonOff).toBeLessThan(0.3);
  });

  it('needs the same from the side as from behind (its wheels are held, it skids either way)', { timeout: 60_000 }, () => {
    // A chassis as wide as it is long: the head then meets its outline and the square the world collides it by at the same place.
    const need = 0.8 * 5 * G;
    const square = { length: 0.9, width: 0.9, height: 0.24 };
    expect(push({ mass: 5, friction: 0.8, fromSide: true, chassis: square, maxForce: need - 0.5 }).moved).toBeLessThan(1e-6);
    const strong = push({ mass: 5, friction: 0.8, fromSide: true, chassis: square, maxForce: need + 0.5 });
    expect(strong.moved).toBeGreaterThan(1);
    expect(strong.mostForce).toBeCloseTo(need, 6);
  });

  it('with the switch off the same chassis still takes the old 9.81 N, whatever its card says', () => {
    const weak = push({ mass: 20, friction: 0.8, maxForce: 9.5, real: false });
    expect(weak.moved).toBeLessThan(1e-6);
    expect(weak.overloaded).toBe(true);
    const strong = push({ mass: 20, friction: 0.8, maxForce: 10, real: false });
    expect(strong.moved).toBeGreaterThan(1);
    expect(strong.mostForce).toBeCloseTo(0.5 * 2 * G, 6);
  });
});
