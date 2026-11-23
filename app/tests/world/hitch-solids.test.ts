import { beforeAll, describe, expect, it } from 'vitest';
import type { EntityId, EntityView } from '../../src/engine/types';
import { containerBlocks } from '../../src/nodes/container';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';
import type { NodeSpec } from '../helpers/arm-rig';
import { hitchRig, type HitchRig } from './hitch-rig';

/**
 * What a carried body meets. A block that a node moves is not stopped by fixed blocks (it passes through them), so a
 * cage that only followed its tug would be dragged through walls. The rule of the world: a held body never enters a solid
 * block; it goes as far as it can and its carrier is put back by what the body could not go.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const MM = 0.001;
/** Half the outer width of the default cage (1 m inside, 50 mm walls). */
const CAGE_HALF = 0.55;

/** How deep two upright boxes are in each other (negative = apart). */
function into(a: EntityView, b: EntityView): number {
  const o = (k: 'x' | 'y' | 'z'): number => (a.size[k] + b.size[k]) / 2 - Math.abs(a.position[k] - b.position[k]);
  return Math.min(o('x'), o('y'), o('z'));
}

function take(r: HitchRig): void {
  r.send(0, 0);
  expect(r.drive(20)).toBe(true);
  r.latch(true);
  r.play(1);
  expect(r.holding()).toBe(true);
}

/** Deepest any block of the carried cage gets into any of `others` while `run` plays, and how far the cage gets from its place over the tug. */
function watch(r: HitchRig, others: EntityId[], run: (each: () => void) => void): { deepest: number; offset: number } {
  const out = { deepest: -Infinity, offset: 0 };
  run(() => {
    for (const id of r.cageBlocks()) for (const o of others) out.deepest = Math.max(out.deepest, into(r.world.getEntity(id)!, r.world.getEntity(o)!));
    out.offset = Math.max(out.offset, Math.hypot(r.tug().position.x - r.cage().position.x, r.tug().position.z - r.cage().position.z));
  });
  return out;
}

const WALL: NodeSpec = ['wall', 'block', { position: { x: 6.1, y: 1, z: 0 }, size: { x: 0.2, y: 2, z: 6 } }];
/** A rail at the height of the cage walls: the tug alone fits under it. */
const RAIL: NodeSpec = ['rail', 'block', { position: { x: 0, y: 0.7, z: 6.1 }, size: { x: 6, y: 0.2, z: 0.2 } }];

describe('the engine fact the rule answers', () => {
  it('a cage that a mover sends with `moveBlocks` goes straight through a fixed wall', () => {
    const r = hitchRig({ rapier, nodes: [WALL] });
    r.tick();
    const ids = r.cageBlocks();
    const from = { ...r.cage().position };
    for (let x = 0; x <= 8; x += 0.05) {
      expect(r.world.moveBlocks(ids, { ...from, x })).toBe(true);
      r.tick();
    }
    expect(r.cage().position.x).toBeGreaterThan(7.9);
  });
});

describe.each([
  ['"Vật lý thật" on', true],
  ['the switch off', false],
] as const)('a carried cage does not pass through solid blocks (%s)', (_name, real) => {
  const make = (nodes: NodeSpec[]): HitchRig => hitchRig({ ...(real ? { rapier } : {}), nodes });

  it('driven at a wall, the cage stops flush against it and the tug stops with it, still under the middle of the cage', () => {
    const r = make([WALL]);
    take(r);
    const wall = r.entity('wall')!.id;
    r.send(9, 0);
    const m = watch(r, [wall], (each) => expect(r.drive(8, each)).toBe(false));
    expect(m.deepest).toBeLessThan(0.01 * MM);
    expect(m.offset).toBeLessThan(1 * MM);
    // The near face of the wall is at x = 6: the cage stands against it, the tug has not gone on.
    expect(r.cage().position.x + CAGE_HALF).toBeCloseTo(6, 3);
    expect(r.tug().position.x).toBeCloseTo(6 - CAGE_HALF, 3);
    expect(Math.abs(r.out('tug', 'speed') as number)).toBeLessThan(0.01);
    expect(r.holding()).toBe(true);
    // It backs away as a whole.
    r.send(0, 0);
    expect(r.drive(20)).toBe(true);
    expect(Math.abs(r.cage().position.x)).toBeLessThan(0.15);
  });

  it('a rail the tug fits under stops the tug all the same while it carries the cage, and lets it through once it has let go', () => {
    const r = make([RAIL]);
    take(r);
    const rail = r.entity('rail')!.id;
    r.send(0, 9);
    const m = watch(r, [rail], (each) => expect(r.drive(8, each)).toBe(false));
    expect(m.deepest).toBeLessThan(0.01 * MM);
    expect(m.offset).toBeLessThan(1 * MM);
    expect(r.cage().position.z + CAGE_HALF).toBeCloseTo(6, 3);
    r.latch(false);
    r.play(0.2);
    expect(r.drive(10)).toBe(true);
    expect(r.tug().position.z).toBeGreaterThan(8.8);
    expect(r.cage().position.z + CAGE_HALF).toBeCloseTo(6, 3);
  });

  it('a second cage standing in the way stops it: the two cages end up wall to wall, neither moved into the other', () => {
    const r = make([['parked', 'container', { position: { x: 4, y: 0, z: 0.3 } }]]);
    take(r);
    const parked = containerBlocks(r.world, r.out('parked', 'self') as EntityId);
    const before = parked.map((id) => ({ ...r.world.getEntity(id)!.position }));
    r.send(8, 0);
    const m = watch(r, parked, (each) => expect(r.drive(8, each)).toBe(false));
    expect(m.deepest).toBeLessThan(0.01 * MM);
    expect(m.offset).toBeLessThan(1 * MM);
    expect(r.cage().position.x + CAGE_HALF).toBeCloseTo(4 - CAGE_HALF, 3);
    expect(parked.map((id) => r.world.getEntity(id)!.position)).toEqual(before);
  });

  it('slides along a wall it meets at a slant instead of sticking to it', () => {
    const r = make([WALL]);
    take(r);
    const wall = r.entity('wall')!.id;
    r.send(7, 2);
    const m = watch(r, [wall], (each) => r.play(8, each));
    expect(m.deepest).toBeLessThan(0.01 * MM);
    expect(m.offset).toBeLessThan(1 * MM);
    expect(r.cage().position.x + CAGE_HALF).toBeLessThanOrEqual(6 + 0.01 * MM);
    // It went on sideways along the wall.
    expect(r.cage().position.z).toBeGreaterThan(1.5);
  });
});

describe('a carried cage and other robots ("Vật lý thật" on)', () => {
  /** A parked chassis with no motors, `height` tall, in the way at x = 3. */
  const parked = (height: number): NodeSpec => ['other', 'robot-body', { position: { x: 3, y: height / 2, z: 0 }, heading: 0, length: 0.9, width: 0.7, height, mass: 5, friction: 0.8 }];
  const other = (r: HitchRig): EntityView => r.entity('other')!;

  it('a robot as tall as the cage walls is pushed ahead by the cage, never entered', () => {
    const r = hitchRig({ rapier, nodes: [parked(0.6)] });
    take(r);
    const id = other(r).id;
    r.send(6, 0);
    const m = watch(r, [id], (each) => r.drive(20, each));
    expect(m.deepest).toBeLessThan(1 * MM);
    expect(m.offset).toBeLessThan(1 * MM);
    expect(other(r).position.x).toBeGreaterThan(6);
  });

  it('with a wall behind that robot the cage stops against it and the tug stops with the cage', () => {
    const r = hitchRig({ rapier, nodes: [parked(0.6), ['stop', 'block', { position: { x: 3.55, y: 0.5, z: 0 }, size: { x: 0.2, y: 1, z: 0.4 } }]] });
    take(r);
    const id = other(r).id;
    r.send(6, 0);
    const m = watch(r, [id], (each) => expect(r.drive(8, each)).toBe(false));
    expect(m.deepest).toBeLessThan(1 * MM);
    expect(m.offset).toBeLessThan(1 * MM);
    expect(other(r).position.x).toBeCloseTo(3, 2);
    expect(r.tug().position.x).toBeLessThan(2.2);
  });

  it('a robot that drives at a standing held cage is stopped by its walls like by any solid block', () => {
    const r = hitchRig({
      rapier,
      nodes: [
        ['other', 'robot-body', { position: { x: 4, y: 0.3, z: 0 }, heading: 180, length: 0.9, width: 0.7, height: 0.6, mass: 5, friction: 0.8 }],
        ['other-l', 'motor', { side: -0.3 }],
        ['other-r', 'motor', { side: 0.3 }],
        ['full', 'const', { value: 0.5 }],
      ],
      wires: [
        ['other', 'self', 'other-l', 'body'],
        ['other', 'self', 'other-r', 'body'],
        ['full', 'value', 'other-l', 'power'],
        ['full', 'value', 'other-r', 'power'],
      ],
    });
    r.send(0, 0);
    r.latch(true);
    const id = other(r).id;
    const m = watch(r, [id], (each) => r.play(8, each));
    expect(r.holding()).toBe(true);
    expect(m.deepest).toBeLessThan(1 * MM);
    // Nose of the robot against the outer face of the cage wall.
    expect(other(r).position.x - 0.45).toBeGreaterThan(r.cage().position.x + CAGE_HALF - 1 * MM);
    expect(other(r).position.x - 0.45).toBeLessThan(r.cage().position.x + CAGE_HALF + 0.05);
  });
});

describe('the world calls behind a hitch', () => {
  const block = (w: ReturnType<typeof createWorld>, owner: string, x: number, extra: object = {}): EntityId =>
    w.spawn({ kind: 'block', ownerNodeId: owner, position: { x, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#888', solid: true, ...extra });
  const item = (w: ReturnType<typeof createWorld>, x: number): EntityId => w.spawn({ kind: 'item', ownerNodeId: 'item', position: { x, y: 0.3, z: 0 }, size: { x: 0.3, y: 0.3, z: 0.3 }, color: '#888', solid: false });
  const ZERO = { x: 0, y: 0, z: 0 };

  it('refuses what is not free and holds nothing then', () => {
    const w = createWorld('3d');
    const carrier = block(w, 'carrier', 0);
    const a = block(w, 'a', 3);
    const b = block(w, 'b', 6);
    const belt = block(w, 'belt', 9, { belt: { axis: 'x' } });
    const crate = item(w, 12);
    const hero = w.spawn({ kind: 'character', ownerNodeId: 'hero', position: { x: 12.5, y: 0.5, z: 0 }, size: { x: 0.6, y: 1, z: 0.6 }, color: '#888', solid: true });
    expect(w.hitch('h1', 'nobody', [a], ZERO)).toBe(false);
    expect(w.hitch('h1', carrier, [], ZERO)).toBe(false);
    expect(w.hitch('h1', carrier, ['nothing'], ZERO)).toBe(false);
    expect(w.hitch('h1', carrier, [carrier], ZERO)).toBe(false);
    expect(w.hitch('h1', carrier, [belt], ZERO)).toBe(false);
    expect(w.hitch('h1', carrier, [hero], ZERO)).toBe(false);
    expect(w.hitch('h1', carrier, [a, crate], ZERO)).toBe(false);
    expect(w.hitch('h1', carrier, [a], { x: Number.NaN, y: 0, z: 0 })).toBe(false);
    expect(w.hitched('h1')).toBeNull();

    expect(w.hitch('h1', carrier, [a], { x: 3, y: 0, z: 0 })).toBe(true);
    expect(w.hitched('h1')).toBe(a);
    // Held by one hitch: no other may have it, alone or with others.
    expect(w.hitch('h2', carrier, [a], ZERO)).toBe(false);
    expect(w.hitch('h2', b, [a, b], ZERO)).toBe(false);
    expect(w.hitched('h2')).toBeNull();
    // A crate a character carries is not free either.
    expect(w.grab(hero, 2)).toBe(crate);
    expect(w.hitch('h2', carrier, [crate], ZERO)).toBe(false);
    w.drop(hero);
    expect(w.hitch('h2', carrier, [crate], { x: 12, y: 0, z: 0 })).toBe(true);
    // And a hitched crate is not there for a character to take.
    expect(w.grab(hero, 2)).toBeNull();

    // A hidden body leaves its hitch; a hidden carrier lets go of everything it held.
    w.hide(a);
    expect(w.hitched('h1')).toBeNull();
    w.hide(carrier);
    expect(w.hitched('h2')).toBeNull();
    expect(w.isHeld(crate)).toBe(false);
  });

  it('taking other bodies with the same hitch lets go of the first; the same bodies again only move the place', () => {
    const w = createWorld('3d');
    const carrier = block(w, 'carrier', 0, { solid: false });
    const a = block(w, 'a', 3);
    const b = block(w, 'b', 6);
    expect(w.hitch('h', carrier, [a], { x: 3, y: 0, z: 0 })).toBe(true);
    expect(w.hitch('h', carrier, [a], { x: 4, y: 0, z: 0 })).toBe(true);
    w.step(1 / 60);
    expect(w.getEntity(a)!.position.x).toBe(4);
    expect(w.hitch('h', carrier, [b], { x: 6, y: 0, z: 0 })).toBe(true);
    expect(w.hitched('h')).toBe(b);
    expect(w.hitch('other', carrier, [a], { x: 4, y: 0, z: 0 })).toBe(true);
    w.unhitch('h');
    w.unhitch('h');
    expect(w.hitched('h')).toBeNull();
    expect(w.hitched('other')).toBe(a);
  });

  it('a body follows a carrier that a node moved before the step, in the same tick', () => {
    const w = createWorld('3d');
    const carrier = block(w, 'carrier', 0, { solid: false });
    const a = block(w, 'a', 3);
    w.hitch('h', carrier, [a], { x: 3, y: 0, z: 0 });
    for (let k = 1; k <= 30; k++) {
      w.moveBlock(carrier, { x: k * 0.1, y: 0.5, z: 0 });
      w.step(1 / 60);
      expect(w.getEntity(a)!.position.x).toBeCloseTo(3 + k * 0.1, 9);
    }
  });

  it('`hitched` is a question: the list of entity views handed out before it is still the one handed out after', () => {
    const w = createWorld('3d');
    const carrier = block(w, 'carrier', 0);
    const a = block(w, 'a', 3);
    w.hitch('h', carrier, [a], { x: 3, y: 0, z: 0 });
    const views = w.listEntities();
    expect(w.hitched('h')).toBe(a);
    expect(w.listEntities()).toBe(views);
    // A step moves what is held: the list after it is a new one and shows the body where it is now.
    w.hitch('h', carrier, [a], { x: 3.5, y: 0, z: 0 });
    w.step(1 / 60);
    const after = w.listEntities();
    expect(after).not.toBe(views);
    expect(after.find((e) => e.id === a)!.position.x).toBe(3.5);
    expect(views.find((e) => e.id === a)!.position.x).toBe(3);
  });

  it('without a hitch in the world nothing of this runs: two runs of a board with and without an unused hitch card end the same', () => {
    const play = (withCard: boolean): string => {
      const r = hitchRig({ rapier, drops: [{ x: 0, z: 0, count: 3 }], ...(withCard ? { nodes: [['spare', 'hitch', {}]] } : {}) });
      r.play(6);
      r.send(0.3, 0);
      r.drive(20);
      return JSON.stringify(r.world.entities().map((e) => [e.kind, e.position, e.rotation ?? null]));
    };
    expect(play(true)).toBe(play(false));
  });
});
