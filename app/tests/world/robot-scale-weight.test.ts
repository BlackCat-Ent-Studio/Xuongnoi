import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { FLOOR } from '../helpers/nav-rig';
import { bot, deckRig, seconds, slab } from './deck-rig';

/**
 * With "Vật lý thật" on, a robot chassis weighs what its card says ("Khối lượng") to everything that weighs: a scale it
 * stands on, and the chassis or deck that carries it. What it carries itself is added on top, as for any other body.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

/** Top of the scale plate (m): a slab lying on the floor. */
const PLATE_TOP = 0.1;

interface Weighing {
  mass: number;
  /** A carton of this many kg standing on the chassis. */
  cartonKg?: number;
  heading?: number;
  /** "Vật lý thật" (default on). */
  real?: boolean;
}

/** A chassis parked on a scale plate; the reading after two seconds. */
function weigh(p: Weighing) {
  const b = bot({ id: 'r', x: 0, z: 0, floor: PLATE_TOP, heading: p.heading ?? 0, body: { mass: p.mass } });
  const nodes: NodeSpec[] = [
    slab('plate', PLATE_TOP, -1.5, 1.5, -1.5, 1.5, PLATE_TOP),
    ['scale', 'force-sensor', {}],
    ...b.nodes,
    ...(p.cartonKg !== undefined ? [['c', 'item', { shape: 'crate', position: { x: 0, y: PLATE_TOP + 0.24 + 0.15 + 0.005, z: 0 }, size: { x: 0.3, y: 0.3, z: 0.3 }, mass: p.cartonKg }] as NodeSpec] : []),
  ];
  const wires: WireSpec[] = [...b.wires, ['plate', 'self', 'scale', 'who']];
  const r = p.real === false ? rig([FLOOR, ...nodes], wires, '3d') : deckRig(nodes, wires, rapier);
  r.tick(seconds(2));
  const res = { kg: Number(r.out('scale', 'mass')), newton: Number(r.out('scale', 'force')), loaded: r.out('scale', 'loaded') === true, payload: Number(r.out('r', 'payload')) };
  r.world.dispose?.();
  return res;
}

describe('a robot chassis on a scale ("Vật lý thật" on)', () => {
  it('reads the mass on its card: 5 kg, 20 kg', { timeout: 60_000 }, () => {
    const light = weigh({ mass: 5 });
    expect(light.kg).toBeCloseTo(5, 9);
    expect(light.newton).toBeCloseTo(5 * 9.81, 6);
    expect(light.loaded).toBe(true);
    expect(weigh({ mass: 20 }).kg).toBeCloseTo(20, 9);
  });

  it('reads the same whichever way the chassis points', { timeout: 60_000 }, () => {
    expect(weigh({ mass: 20, heading: 30 }).kg).toBeCloseTo(20, 9);
    expect(weigh({ mass: 20, heading: 90 }).kg).toBeCloseTo(20, 9);
  });

  it('adds what the chassis carries', { timeout: 60_000 }, () => {
    const light = weigh({ mass: 5, cartonKg: 3 });
    expect(light.payload).toBeCloseTo(3, 6);
    expect(light.kg).toBeCloseTo(8, 6);
    expect(weigh({ mass: 20, cartonKg: 3 }).kg).toBeCloseTo(23, 6);
  });

  it('with the switch off the chassis still counts 2 kg, whatever its card says', () => {
    expect(weigh({ mass: 20, real: false }).kg).toBe(2);
    expect(weigh({ mass: 20, cartonKg: 3, real: false }).kg).toBe(5);
  });
});

describe('a robot riding on another robot ("Vật lý thật" on)', () => {
  const BIG = { length: 1.2, width: 1, height: 0.3 };
  const SMALL = { length: 0.5, width: 0.4, height: 0.2 };
  const DECK = { length: 1, thickness: 0.05, width: 0.8 };
  /** The joint that holds the deck sits this far above the big chassis's centre: the deck clears its top by 1 cm. */
  const UP = BIG.height / 2 + 0.01 + DECK.thickness / 2;
  const DECK_TOP = BIG.height / 2 + UP + DECK.thickness / 2;

  /**
   * A big chassis with a solid deck bolted on (a flat link on a joint that stays level), and a small chassis parked on that
   * deck; what the big one reports as its load after two seconds.
   */
  function ride(riderKg: number, cartonKg?: number) {
    const carrier = bot({ id: 'big', x: 0, z: 0, floor: 0, chassis: BIG, body: { mass: 30 } });
    const rider = bot({ id: 'small', x: 0, z: 0, floor: DECK_TOP + 0.002, chassis: SMALL, body: { mass: riderKg } });
    const nodes: NodeSpec[] = [
      ...carrier.nodes,
      ['go', 'on-start', {}],
      ['level', 'const', { value: 0 }],
      ['hinge', 'joint', { axis: 'pitch', start: 0, min: -90, max: 90, maxTorque: 2000, maxSpeed: 60, mount: { x: -DECK.length / 2, y: UP, z: 0 }, solid: 'no' }],
      ['deck', 'link', { ...DECK, solid: 'yes', mass: 1 }],
      ...rider.nodes,
      ...(cartonKg !== undefined ? [['c', 'item', { shape: 'crate', position: { x: 0, y: DECK_TOP + SMALL.height + 0.1 + 0.007, z: 0 }, size: { x: 0.2, y: 0.2, z: 0.2 }, mass: cartonKg }] as NodeSpec] : []),
    ];
    const wires: WireSpec[] = [...carrier.wires, ...rider.wires, ['big', 'self', 'hinge', 'base'], ['go', 'started', 'hinge', 'power'], ['level', 'value', 'hinge', 'angle'], ['hinge', 'tip', 'deck', 'base']];
    const r = deckRig(nodes, wires, rapier);
    r.tick(seconds(2));
    const res = { payload: Number(r.out('big', 'payload')), riderPayload: Number(r.out('small', 'payload')), riderY: r.entity('small')!.position.y };
    r.world.dispose?.();
    return res;
  }

  it('adds its real mass to the payload of the robot under it', { timeout: 60_000 }, () => {
    const light = ride(5);
    // It does stand on the deck of the big chassis.
    expect(light.riderY).toBeCloseTo(DECK_TOP + SMALL.height / 2, 2);
    expect(light.payload).toBeCloseTo(5, 9);
    expect(ride(20).payload).toBeCloseTo(20, 9);
  });

  it('and what the rider carries is added too', { timeout: 60_000 }, () => {
    const loaded = ride(20, 4);
    expect(loaded.riderPayload).toBeCloseTo(4, 6);
    expect(loaded.payload).toBeCloseTo(24, 6);
  });
});
