import { beforeAll, describe, expect, it } from 'vitest';
import type { ParamValue } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';

/**
 * A crate on the bare deck of a robot chassis (no tray), with "Vật lý thật" on. The chassis turns under it: friction takes
 * the crate round with the deck, and it keeps its place there for as long as its friction can hold it. Chassis, motors and
 * speeds are those of the shipped shuttle sample (1.2 x 1 m, 90 rpm; about 1 m/s through a bend of 1.3 m).
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const FLOOR: NodeSpec = ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 60 } }];
const DECK = 0.3;
const CRATE = 0.3;
const G = 9.81;

function play(left: number, right: number, extra: NodeSpec[]) {
  const nodes: NodeSpec[] = [
    FLOOR,
    ['r', 'robot-body', { position: { x: 0, y: DECK / 2, z: 0 }, heading: 0, length: 1.2, width: 1, height: DECK, mass: 5, friction: 0.8, showPayload: 'yes' }],
    ['ml', 'motor', { side: -0.45, maxRpm: 90, maxForce: 6 }],
    ['mr', 'motor', { side: 0.45, maxRpm: 90, maxForce: 6 }],
    ['l', 'const', { value: left }],
    ['rr', 'const', { value: right }],
    ...extra,
  ];
  const wires: WireSpec[] = [['r', 'self', 'ml', 'body'], ['r', 'self', 'mr', 'body'], ['l', 'value', 'ml', 'power'], ['rr', 'value', 'mr', 'power']];
  return rig(nodes, wires, '3d', false, true, rapier);
}

const crate = (x: number, z: number, more: Record<string, ParamValue> = {}): NodeSpec => ['c', 'item', { shape: 'crate', position: { x, y: DECK + CRATE / 2 + 0.005, z }, size: { x: CRATE, y: CRATE, z: CRATE }, mass: 2, ...more }];

type Rig = ReturnType<typeof play>;

/** Where the crate sits on the chassis: metres ahead of its middle and to its side, and its height. */
function placeOnDeck(r: Rig): { ahead: number; side: number; y: number } {
  const body = r.entity('r')!;
  const c = r.entity('c')!;
  const h = body.robot!.heading;
  const dx = c.position.x - body.position.x;
  const dz = c.position.z - body.position.z;
  return { ahead: dx * Math.cos(h) + dz * Math.sin(h), side: -dx * Math.sin(h) + dz * Math.cos(h), y: c.position.y };
}

/** Plays until the chassis has turned `rad` in all; gives the angle turned, the fastest turn rate (rad/s) and speed (m/s) seen, and what `each` saw. */
function turnThrough(r: Rig, rad: number, each?: () => void): { turned: number; rate: number; speed: number } {
  let turned = 0;
  let rate = 0;
  let speed = 0;
  let prev = r.entity('r')!.robot!.heading;
  for (let k = 0; k < 60 * 60 && turned < rad; k++) {
    r.tick();
    const body = r.entity('r')!.robot!;
    let d = body.heading - prev;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    prev = body.heading;
    turned += Math.abs(d);
    rate = Math.max(rate, Math.abs(d) * 60);
    speed = Math.max(speed, Math.abs(body.speed));
    each?.();
  }
  return { turned, rate, speed };
}

describe('a crate 0.3 m from the middle of a bare deck keeps its place while the chassis turns', () => {
  const cases: { name: string; left: number; right: number; at: [number, number]; rate: [number, number]; speed: [number, number] }[] = [
    { name: 'turning on the spot at 0.9 rad/s, crate ahead of the middle', left: 0.3, right: -0.3, at: [0.3, 0], rate: [0.8, 1.1], speed: [0, 0.05] },
    { name: 'turning on the spot the other way, crate to the side and behind', left: -0.3, right: 0.3, at: [-0.2, 0.22], rate: [0.8, 1.1], speed: [0, 0.05] },
    { name: 'driving round a 1.3 m bend at 1 m/s (the sample), crate ahead of the middle', left: 1, right: 0.5, at: [0.3, 0], rate: [0.7, 0.9], speed: [0.9, 1.2] },
    { name: 'driving round a wide bend at 1.2 m/s, crate to the side', left: 0.7, right: 1, at: [0, 0.3], rate: [0.4, 0.6], speed: [1, 1.3] },
  ];
  for (const c of cases) {
    it(`${c.name}: within 2 mm over more than 9 rad`, () => {
      const r = play(c.left, c.right, [crate(...c.at)]);
      // The chassis gets going (the crate may settle a millimetre while it speeds up); then its place is noted.
      r.tick(90);
      const start = placeOnDeck(r);
      expect(Math.hypot(start.ahead - c.at[0], start.side - c.at[1])).toBeLessThan(0.005);
      let worst = 0;
      const run = turnThrough(r, 9.5, () => {
        const p = placeOnDeck(r);
        worst = Math.max(worst, Math.hypot(p.ahead - start.ahead, p.side - start.side));
        expect(Math.abs(p.y - (DECK + CRATE / 2))).toBeLessThan(0.002);
      });
      expect(run.turned).toBeGreaterThan(9);
      expect(run.rate).toBeGreaterThan(c.rate[0]);
      expect(run.rate).toBeLessThan(c.rate[1]);
      expect(run.speed).toBeGreaterThanOrEqual(c.speed[0]);
      expect(run.speed).toBeLessThan(c.speed[1]);
      // Measured: 0.18 to 0.34 mm.
      expect(worst).toBeLessThan(0.002);
      expect(Number(r.out('r', 'payload'))).toBeCloseTo(2, 6);
      r.world.dispose?.();
    });
  }
});

describe('it slides off when its friction cannot hold it', () => {
  // Flat out on the spot the chassis turns at 3.1 rad/s: 0.3 m from the middle the deck pulls inwards at rate^2 x 0.3 = 3 m/s^2,
  // which a crate holds with a friction of 3 / 9.81 = 0.30 or more.
  const spin = (mu: number) => {
    const r = play(1, -1, [crate(0.3, 0, { mu })]);
    let rate = 0;
    let far = 0;
    for (let k = 0; k < 10; k++) {
      rate = Math.max(rate, turnThrough(r, 3).rate);
      far = Math.max(far, Math.hypot(placeOnDeck(r).ahead, placeOnDeck(r).side));
    }
    const end = { rate, far, y: r.entity('c')!.position.y, payload: Number(r.out('r', 'payload')) };
    r.world.dispose?.();
    return end;
  };

  it('the limit is where the hand calculation puts it: friction 0.35 holds through 30 rad, 0.25 does not', () => {
    const holds = spin(0.35);
    expect(holds.rate).toBeGreaterThan(3);
    expect(holds.rate * holds.rate * 0.3).toBeGreaterThan(0.25 * G);
    expect(holds.rate * holds.rate * 0.3).toBeLessThan(0.35 * G);
    expect(holds.y).toBeCloseTo(DECK + CRATE / 2, 2);
    expect(holds.payload).toBeCloseTo(2, 6);
    const slips = spin(0.25);
    expect(slips.y).toBeCloseTo(CRATE / 2, 2);
    expect(slips.far).toBeGreaterThan(0.9);
    expect(slips.payload).toBe(0);
  });

  it('a slippery crate (friction 0.02) is left behind by a chassis that drives off round a bend', () => {
    const r = play(1, 0.5, [crate(0.3, 0, { mu: 0.02 })]);
    turnThrough(r, 3);
    expect(r.entity('c')!.position.y).toBeCloseTo(CRATE / 2, 2);
    expect(Number(r.out('r', 'payload'))).toBe(0);
    r.world.dispose?.();
  });
});

describe('what holds the crate back still holds it', () => {
  it('between two walls that hang over the deck it stays between them while the chassis turns under it through 9 rad', () => {
    // The walls leave 1 cm of room to each side of the crate and 6 cm of air over the deck: the chassis turns freely under them.
    const wall = (id: string, z: number): NodeSpec => [id, 'block', { position: { x: 0.3, y: DECK + 0.06 + 0.25, z }, size: { x: 1.4, y: 0.5, z: 0.1 } }];
    const reach = CRATE / 2 + 0.01;
    const r = play(0.3, -0.3, [crate(0.3, 0), wall('w1', reach + 0.05), wall('w2', -reach - 0.05)]);
    const x0 = r.entity('c')!.position.x;
    let worstZ = 0;
    let worstX = 0;
    const run = turnThrough(r, 9.5, () => {
      const c = r.entity('c')!.position;
      worstZ = Math.max(worstZ, Math.abs(c.z));
      worstX = Math.max(worstX, Math.abs(c.x - x0));
      expect(Math.abs(c.y - (DECK + CRATE / 2))).toBeLessThan(0.006);
    });
    expect(run.turned).toBeGreaterThan(9);
    expect(run.rate).toBeGreaterThan(0.8);
    // The deck takes it 7 mm towards one wall and turns it a few degrees, until it sits askew between the two walls; there it
    // stays (measured: 7 mm along the walls from where it stood), never through a wall and not taken round.
    expect(worstZ).toBeGreaterThan(0.003);
    expect(worstZ).toBeLessThan(0.01 + 0.002);
    expect(worstX).toBeLessThan(0.02);
    const end = r.entity('c')!.position;
    expect(Math.hypot(end.x - 0.3, end.z)).toBeLessThan(0.02);
    expect(Number(r.out('r', 'payload'))).toBeCloseTo(2, 6);
    r.world.dispose?.();
  });
});
