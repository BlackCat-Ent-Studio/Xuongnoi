import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT, type EntityView } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { overlapDepth } from '../helpers/chassis-metrics';

/**
 * With "Vật lý thật" on, other bodies meet a robot chassis by its real outline: its length by its width, turned to where it
 * points. The card's collision square (as wide as the chassis is long) only meets blocks. Measured from the entity views.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const FLOOR: NodeSpec = ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 60 } }];
const TOUCH = 0.001;
const DEG = 180 / Math.PI;

interface Bot {
  id: string;
  x: number;
  z?: number;
  heading?: number;
  length?: number;
  width?: number;
  /** Power of the left and of the right motor. */
  left?: number;
  right?: number;
  payload?: boolean;
}

function bot(b: Bot): { nodes: NodeSpec[]; wires: WireSpec[] } {
  const id = b.id;
  const width = b.width ?? 1;
  return {
    nodes: [
      [id, 'robot-body', { position: { x: b.x, y: 0.15, z: b.z ?? 0 }, heading: b.heading ?? 0, length: b.length ?? 1.2, width, height: 0.3, mass: 5, friction: 0.8, showPayload: b.payload ? 'yes' : 'no' }],
      [`${id}-ml`, 'motor', { side: -(width / 2 - 0.05), maxRpm: 90, maxForce: 6 }],
      [`${id}-mr`, 'motor', { side: width / 2 - 0.05, maxRpm: 90, maxForce: 6 }],
      [`${id}-l`, 'const', { value: b.left ?? 0 }],
      [`${id}-r`, 'const', { value: b.right ?? 0 }],
    ],
    wires: [
      [id, 'self', `${id}-ml`, 'body'], [id, 'self', `${id}-mr`, 'body'],
      [`${id}-l`, 'value', `${id}-ml`, 'power'], [`${id}-r`, 'value', `${id}-mr`, 'power'],
    ],
  };
}

function play(bots: Bot[], extra: NodeSpec[] = [], engine = true) {
  const parts = bots.map(bot);
  return rig([FLOOR, ...parts.flatMap((p) => p.nodes), ...extra], parts.flatMap((p) => p.wires), '3d', false, true, engine ? rapier : undefined);
}

const crate = (id: string, x: number, z: number, y = 0.3 + 0.15 + 0.005, kg = 2): NodeSpec => [id, 'item', { shape: 'crate', position: { x, y, z }, size: { x: 0.3, y: 0.3, z: 0.3 }, mass: kg }];
const headingOf = (v: EntityView): number => v.robot!.heading * DEG;

describe('a crate rests on the chassis that is drawn, not on the square round it', () => {
  it('beside a narrow chassis (1.2 x 0.4 m) a crate falls to the floor; over it, it is carried and weighed', () => {
    // 0.45 m to the side: inside the 1.2 m square, 10 cm clear of the 0.4 m wide chassis.
    const beside = play([{ id: 'r', x: 0, width: 0.4, payload: true }], [crate('c', 0, 0.45)]);
    beside.tick(120);
    expect(beside.entity('c')!.position.y).toBeCloseTo(0.15, 2);
    expect(beside.out('r', 'payload')).toBe(0);
    beside.world.dispose?.();

    const over = play([{ id: 'r', x: 0, width: 0.4, payload: true }], [crate('c', 0.4, 0)]);
    over.tick(120);
    expect(over.entity('c')!.position.y).toBeCloseTo(0.45, 2);
    expect(over.out('r', 'payload')).toBeCloseTo(2, 3);
    over.world.dispose?.();
  });

  it('the same two spots swap when the chassis stands at 90 degrees', () => {
    const along = play([{ id: 'r', x: 0, width: 0.4, heading: 90, payload: true }], [crate('c', 0, 0.45)]);
    along.tick(120);
    expect(along.entity('c')!.position.y).toBeCloseTo(0.45, 2);
    expect(along.out('r', 'payload')).toBeCloseTo(2, 3);
    along.world.dispose?.();

    const beside = play([{ id: 'r', x: 0, width: 0.4, heading: 90, payload: true }], [crate('c', 0.4, 0)]);
    beside.tick(120);
    expect(beside.entity('c')!.position.y).toBeCloseTo(0.15, 2);
    expect(beside.out('r', 'payload')).toBe(0);
    beside.world.dispose?.();
  });

  it('at 45 degrees a crate over the corner of the chassis rides; one over the corner of the square falls', () => {
    // The corner of a 1.2 x 1 m chassis at 45 degrees points along x: it reaches 0.78 m, the square only 0.6 m.
    const corner = play([{ id: 'r', x: 0, heading: 45, payload: true }], [crate('c', 0.07, 0.6)]);
    corner.tick(120);
    expect(corner.entity('c')!.position.y).toBeCloseTo(0.45, 2);
    expect(corner.out('r', 'payload')).toBeCloseTo(2, 3);
    corner.world.dispose?.();

    // (0.5, -0.5) is inside the square and 21 cm outside the turned chassis.
    const empty = play([{ id: 'r', x: 0, heading: 45, payload: true }], [crate('c', 0.5, -0.5)]);
    empty.tick(120);
    expect(empty.entity('c')!.position.y).toBeCloseTo(0.15, 2);
    expect(empty.out('r', 'payload')).toBe(0);
    empty.world.dispose?.();
  });

  it('a crate on a chassis that turns on the spot through a quarter turn goes round with it and stays on', () => {
    // On a narrow chassis: if the crate did not go round with it, the chassis would turn away from under it.
    const r = play([{ id: 'r', x: 0, width: 0.4, left: 0.3, right: -0.3, payload: true }], [crate('c', 0.3, 0)]);
    r.tick(30);
    const startAngle = Math.atan2(r.entity('c')!.position.z, r.entity('c')!.position.x);
    const startHeading = Math.abs(headingOf(r.entity('r')!));
    let off = 0;
    let ticks = 0;
    while (Math.abs(headingOf(r.entity('r')!)) < 90 && ticks < 600) {
      r.tick();
      ticks++;
      const body = r.entity('r')!;
      const c = r.entity('c')!;
      const rad = body.robot!.heading;
      const dx = c.position.x - body.position.x;
      const dz = c.position.z - body.position.z;
      // Its middle still over the chassis, measured in the chassis's own frame, and still lying on its top.
      if (Math.abs(dx * Math.cos(rad) + dz * Math.sin(rad)) > 0.6 || Math.abs(-dx * Math.sin(rad) + dz * Math.cos(rad)) > 0.2 || Math.abs(c.position.y - 0.45) > 0.01) off++;
    }
    expect(ticks).toBeLessThan(600);
    expect(off).toBe(0);
    const c = r.entity('c')!.position;
    const swept = Math.abs(Math.atan2(c.z, c.x) - startAngle) * DEG;
    const turned = Math.abs(headingOf(r.entity('r')!)) - startHeading;
    expect(turned).toBeGreaterThan(80);
    // It goes round with the chassis and keeps its distance from the middle (measured: the same angle to 0.0001 degrees,
    // 0.2999 m; see robot-bare-deck.test.ts for long turns, bends, sliding off and being held back).
    expect(swept).toBeGreaterThan(turned * 0.999);
    expect(swept).toBeLessThan(turned * 1.001);
    const radius = Math.hypot(c.x, c.z);
    expect(radius).toBeGreaterThan(0.3 - 0.001);
    expect(radius).toBeLessThan(0.3 + 0.001);
    expect(r.out('r', 'payload')).toBeCloseTo(2, 3);
    r.world.dispose?.();
  });

  it('without the crate engine a plain item follows the same outline: carried over it, dropped beside it', () => {
    const over = play([{ id: 'r', x: 0, width: 0.4, left: 0.5, right: 0.5, payload: true }], [crate('c', 0.3, 0)], false);
    over.tick(120);
    const body = over.entity('r')!;
    expect(body.position.x).toBeGreaterThan(0.5);
    expect(over.entity('c')!.position.y).toBeCloseTo(0.45, 2);
    expect(over.entity('c')!.position.x - body.position.x).toBeCloseTo(0.3, 2);
    expect(over.out('r', 'payload')).toBeCloseTo(2, 3);

    const beside = play([{ id: 'r', x: 0, width: 0.4, payload: true }], [crate('c', 0, 0.45)], false);
    beside.tick(120);
    expect(beside.entity('c')!.position.y).toBeCloseTo(0.15, 2);
    expect(beside.out('r', 'payload')).toBe(0);
  });
});

describe('a person on foot is stopped by the chassis that is drawn', () => {
  const walker = (r: ReturnType<typeof play>, x: number, z: number): string => {
    const id = r.world.spawn({ kind: 'character', ownerNodeId: 'hero', position: { x, y: 0.5, z }, size: { x: 0.6, y: 1, z: 0.6 }, color: '#00f', solid: true });
    r.world.setCharacterIntent(id, { moveX: 1, moveY: 0, jump: false, speed: 2, jumpPower: 0 });
    return id;
  };

  it('walks past a narrow chassis through the room its square used to take', () => {
    const r = play([{ id: 'r', x: 0, width: 0.4 }]);
    // Walking along z = 0.55: 5 cm clear of the 0.4 m wide chassis, inside the 1.2 m square.
    const id = walker(r, -3, 0.55);
    r.tick(240);
    expect(r.world.getEntity(id)!.position.x).toBeGreaterThan(2);
  });

  it('is stopped by the corner of a chassis that stands at 45 degrees, 18 cm before the square', () => {
    const r = play([{ id: 'r', x: 0, heading: 45 }]);
    const id = walker(r, -3, -0.07);
    r.tick(240);
    // The corner is at x = -0.778; the walker is 0.6 m wide.
    expect(r.world.getEntity(id)!.position.x).toBeCloseTo(-0.778 - 0.3, 2);
  });
});

describe('a chassis that turns beside another one', () => {
  it('backs off as its corner comes round: it never goes into the other, which does not move, and it does turn', () => {
    // Side by side, 2 cm apart; "a" turns on the spot.
    const r = play([{ id: 'a', x: 0, z: 0, left: 0.4, right: -0.4 }, { id: 'b', x: 0, z: 1.02 }]);
    const from = r.entity('b')!.position;
    let deepest = -Infinity;
    let turned = 0;
    let last = 0;
    for (let k = 0; k < 8 / TICK_DT; k++) {
      r.tick();
      const a = r.entity('a')!;
      deepest = Math.max(deepest, overlapDepth(a, r.entity('b')!));
      const h = headingOf(a);
      turned += Math.abs(((h - last + 540) % 360) - 180);
      last = h;
    }
    expect(deepest).toBeLessThan(TOUCH);
    expect(turned).toBeGreaterThan(180);
    const b = r.entity('b')!.position;
    expect(Math.hypot(b.x - from.x, b.z - from.z)).toBeLessThan(0.001);
    // It was pushed away by its own corner: about half its diagonal less half its width, less the gap it had.
    const a = r.entity('a')!.position;
    expect(a.z).toBeLessThan(-0.2);
    expect(a.z).toBeGreaterThan(-0.3);
    expect(Math.abs(a.x)).toBeLessThan(0.3);
    r.world.dispose?.();
  });

  it('with a wall on its other side it has no room to back off: the turn stops, nothing overlaps, nothing shakes', () => {
    // The wall stands 1 cm from the square of "a" (the square is what a block meets).
    const wall: NodeSpec = ['wall', 'block', { position: { x: 0, y: 0.5, z: -0.6 - 0.01 - 0.25 }, size: { x: 4, y: 1, z: 0.5 } }];
    const r = play([{ id: 'a', x: 0, z: 0, left: 0.4, right: -0.4 }, { id: 'b', x: 0, z: 1.02 }], [wall]);
    let deepest = -Infinity;
    for (let k = 0; k < 4 / TICK_DT; k++) {
      r.tick();
      deepest = Math.max(deepest, overlapDepth(r.entity('a')!, r.entity('b')!));
    }
    expect(deepest).toBeLessThan(TOUCH);
    const a = r.entity('a')!;
    // It turned until its corner met the other chassis and the wall would not let it back off further.
    expect(Math.abs(headingOf(a))).toBeGreaterThan(0.5);
    expect(Math.abs(headingOf(a))).toBeLessThan(8);
    expect(a.position.z).toBeGreaterThan(-0.0101);
    const at = { ...a.position };
    const heading = headingOf(a);
    r.tick(120);
    const later = r.entity('a')!;
    expect(Math.hypot(later.position.x - at.x, later.position.z - at.z)).toBeLessThan(1e-9);
    expect(headingOf(later)).toBe(heading);
    expect(later.robot!.turnRate).toBe(0);
    r.world.dispose?.();
  });
});
