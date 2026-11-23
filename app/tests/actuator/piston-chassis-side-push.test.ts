import { beforeAll, describe, expect, it } from 'vitest';
import { chassisOutlineOfView, obbOf, obbSeparation } from '../../src/world/oriented-box';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import type { NodeSpec } from '../helpers/arm-rig';
import { bot, deckRig, seconds } from '../world/deck-rig';

/**
 * With "Vật lý thật" on, a piston meets a parked chassis where its real outline is (its length by its width, turned to its
 * heading), from whatever side it comes: it needs the grip of the chassis there, stalls with "Quá tải" below it, and its
 * solid head never moves the chassis by the upright square round it. Expected forces are worked out here from the cards.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const G = 9.81;
const LONG = { length: 0.9, width: 0.7, height: 0.24 };
/** The size a new "Thân robot" card has. */
const DEFAULT_CARD = { length: 1, width: 0.7, height: 0.24 };

interface Push {
  chassis: { length: number; width: number; height: number };
  /** Heading of the chassis, degrees. */
  heading: number;
  /** Direction the piston pushes along, degrees on the ground (0 = +x, 90 = +z); its line runs through the chassis. */
  direction: number;
  maxForce: number;
  mass?: number;
  friction?: number;
  /** A carton of this many kg standing on the chassis. */
  cartonKg?: number;
}

/** The chassis stands at the origin; the piston is switched on after one second and runs for five. */
function push(p: Push) {
  const b = bot({ id: 'r', x: 0, z: 0, floor: 0, heading: p.heading, chassis: p.chassis, body: { mass: p.mass ?? 5, friction: p.friction ?? 0.8 } });
  const rad = (p.direction * Math.PI) / 180;
  const along = { x: Math.cos(rad), z: Math.sin(rad) };
  const nodes: NodeSpec[] = [
    ...b.nodes,
    ['p', 'linear-actuator', { position: { x: -3.2 * along.x, y: 0.2, z: -3.2 * along.z }, direction: p.direction, stroke: 2, headSize: 0.2, speed: 0.5, maxForce: p.maxForce }],
    ['e', 'key', { key: 'KeyE' }],
    ...(p.cartonKg !== undefined ? [['c', 'item', { shape: 'crate', position: { x: 0, y: 0.24 + 0.15 + 0.005, z: 0 }, size: { x: 0.3, y: 0.3, z: 0.3 }, mass: p.cartonKg }] as NodeSpec] : []),
  ];
  const r = deckRig(nodes, [...b.wires, ['e', 'held', 'p', 'extend']], rapier);
  r.tick(seconds(1));
  const start = { ...r.entity('r')!.position };
  r.hold('KeyE');
  const res = { moved: 0, sideways: 0, mostForce: 0, force: 0, overloaded: false, everOverloaded: false, deepest: 0, ahead: 0, headTravel: 0, lifted: 0 };
  const headId = String(r.out('p', 'tip'));
  const head0 = { ...r.world.getEntity(headId)!.position };
  for (let k = 0; k < seconds(5); k++) {
    r.tick();
    res.force = Number(r.out('p', 'force'));
    res.mostForce = Math.max(res.mostForce, res.force);
    res.overloaded = r.out('p', 'overloaded') === true;
    res.everOverloaded ||= res.overloaded;
    const head = r.world.getEntity(headId)!;
    const outline = chassisOutlineOfView(r.entity('r')!)!;
    res.deepest = Math.max(res.deepest, -obbSeparation(obbOf(head.position, head.size), outline));
    res.lifted = Math.max(res.lifted, Math.abs(r.entity('r')!.position.y - start.y));
  }
  const e = r.entity('r')!;
  const head = r.world.getEntity(headId)!;
  const d = { x: e.position.x - start.x, z: e.position.z - start.z };
  res.moved = Math.hypot(d.x, d.z);
  res.sideways = Math.abs(d.z * along.x - d.x * along.z);
  res.ahead = (e.position.x - head.position.x) * along.x + (e.position.z - head.position.z) * along.z;
  res.headTravel = Math.hypot(head.position.x - head0.x, head.position.z - head0.z);
  r.world.dispose?.();
  return res;
}

/** Below the need the rod stalls on the outline and nothing moves; above it the chassis goes ahead of the head, never entered. */
function expectForceLimit(p: Omit<Push, 'maxForce'>, need: number): void {
  const weak = push({ ...p, maxForce: need - 0.5 });
  expect(weak.moved).toBeLessThan(1e-6);
  expect(weak.overloaded).toBe(true);
  expect(weak.force).toBeCloseTo(need - 0.5, 9);
  expect(weak.deepest).toBeLessThan(1e-3);
  // The rod did run up to the chassis before it stalled.
  expect(weak.headTravel).toBeGreaterThan(0.05);
  const strong = push({ ...p, maxForce: need + 0.5 });
  expect(strong.everOverloaded).toBe(false);
  expect(strong.mostForce).toBeCloseTo(need, 6);
  expect(strong.moved).toBeGreaterThan(1);
  // Pushed straight along the rod, and still ahead of the head: not passed through, not thrown aside.
  expect(strong.sideways).toBeLessThan(1e-6);
  expect(strong.ahead).toBeGreaterThan(0.1);
  expect(strong.deepest).toBeLessThan(1e-3);
  // It slides on the floor: it is never set down somewhere else.
  expect(strong.lifted).toBeLessThan(1e-3);
  expect(weak.lifted).toBeLessThan(1e-3);
}

const NEED = 0.8 * 5 * G;

describe('a piston pushing a parked chassis that is longer than wide ("Vật lý thật" on)', () => {
  it('from the side it needs friction x mass x 9.81, like from behind (0.9 x 0.7 m)', { timeout: 60_000 }, () => {
    expectForceLimit({ chassis: LONG, heading: 0, direction: 90 }, NEED);
  });

  it('the same for the size a new "Thân robot" card has (1 x 0.7 m), from either side', { timeout: 60_000 }, () => {
    expectForceLimit({ chassis: DEFAULT_CARD, heading: 0, direction: 90 }, NEED);
    expectForceLimit({ chassis: DEFAULT_CARD, heading: 0, direction: 270 }, NEED);
  });

  it('from behind and from the front it still needs the same', { timeout: 60_000 }, () => {
    expectForceLimit({ chassis: LONG, heading: 0, direction: 0 }, NEED);
    expectForceLimit({ chassis: LONG, heading: 0, direction: 180 }, NEED);
  });

  it('a chassis turned 30 degrees needs the same from the side and from behind', { timeout: 60_000 }, () => {
    expectForceLimit({ chassis: LONG, heading: 30, direction: 90 }, NEED);
    expectForceLimit({ chassis: LONG, heading: 30, direction: 0 }, NEED);
  });

  it('a chassis turned 45 degrees needs the same on its corner', { timeout: 60_000 }, () => {
    expectForceLimit({ chassis: LONG, heading: 45, direction: 90 }, NEED);
    expectForceLimit({ chassis: DEFAULT_CARD, heading: 45, direction: 0 }, NEED);
  });

  it('a chassis turned a quarter is met end on by a rod that comes along z', { timeout: 60_000 }, () => {
    expectForceLimit({ chassis: LONG, heading: 90, direction: 90 }, NEED);
    expectForceLimit({ chassis: LONG, heading: 90, direction: 0 }, NEED);
  });

  it('a rod that runs at an angle across the floor needs the same', { timeout: 60_000 }, () => {
    expectForceLimit({ chassis: LONG, heading: 0, direction: 60 }, NEED);
  });

  it('heavier, more slippery and loaded chassis need their own force from the side', { timeout: 60_000 }, () => {
    expectForceLimit({ chassis: LONG, heading: 0, direction: 90, mass: 20 }, 0.8 * 20 * G);
    expectForceLimit({ chassis: LONG, heading: 0, direction: 90, friction: 0.2 }, 0.2 * 5 * G);
    const loaded = 0.8 * (5 + 3) * G;
    const weak = push({ chassis: LONG, heading: 0, direction: 90, cartonKg: 3, maxForce: loaded - 0.5 });
    expect(weak.moved).toBeLessThan(1e-6);
    expect(weak.overloaded).toBe(true);
    const strong = push({ chassis: LONG, heading: 0, direction: 90, cartonKg: 3, maxForce: loaded + 20 });
    expect(strong.moved).toBeGreaterThan(1);
    expect(strong.everOverloaded).toBe(false);
    expect(strong.mostForce).toBeCloseTo(loaded, 6);
    expect(strong.deepest).toBeLessThan(1e-3);
    expect(strong.lifted).toBeLessThan(1e-3);
  });
});
