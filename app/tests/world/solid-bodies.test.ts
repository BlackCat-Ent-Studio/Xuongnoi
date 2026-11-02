import { describe, expect, it } from 'vitest';
import { createWorld } from '../../src/world/world';
import { puzzleWorldOptions } from '../../src/puzzle/world-options';
import { makeCtx } from '../nodes/fake-world';
import { zoneSensorNode } from '../../src/nodes/zone-sensor';
import type { CharacterIntent, EntitySpec, EntityId, World } from '../../src/engine/types';

const DT = 1 / 60;
const OPTS = puzzleWorldOptions('3d');

const intent = (p: Partial<CharacterIntent> = {}): CharacterIntent => ({ moveX: 0, moveY: 0, jump: false, speed: 4, jumpPower: 0, ...p });
const floor = (): EntitySpec => ({ kind: 'block', ownerNodeId: 'floor', position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 20 }, color: '#ccc', solid: true });
const wall = (x: number, z = 0, h = 3): EntitySpec => ({ kind: 'block', ownerNodeId: 'wall', position: { x, y: h / 2, z }, size: { x: 1, y: h, z: 8 }, color: '#999', solid: true });
const bot = (x: number, z = 0, look = 'robot-wheel'): EntitySpec => ({ kind: 'character', ownerNodeId: 'bot', position: { x, y: 0.5, z }, size: { x: 1, y: 1, z: 1 }, color: '#7cc4f0', look, solid: true });
const crate = (x: number, z = 0, name = 'crate'): EntitySpec => ({ kind: 'item', ownerNodeId: name, position: { x, y: 0.3, z }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#b45309', shape: 'crate', solid: false });

/** One reading of a fresh zone sensor with these params. */
function zoneCount(w: World, params: Record<string, unknown>): number {
  const state = zoneSensorNode.create!(makeCtx(w), params as never);
  return Number(zoneSensorNode.evaluate(makeCtx(w), {}, params as never, state).count);
}

function run(w: World, n: number, drive?: () => void): void {
  for (let i = 0; i < n; i++) {
    drive?.();
    w.step(DT);
  }
}

function box(w: World, id: EntityId): { x: number; z: number; minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number } {
  const b = w.debugBodies!().find((e) => e.id === id)!.box;
  return { x: b.pos.x, z: b.pos.z, minX: b.pos.x - b.size.x / 2, maxX: b.pos.x + b.size.x / 2, minY: b.pos.y - b.size.y / 2, maxY: b.pos.y + b.size.y / 2, minZ: b.pos.z - b.size.z / 2, maxZ: b.pos.z + b.size.z / 2 };
}

describe('solid bodies', () => {
  it('stay off by default: a character walks through a crate', () => {
    const w = createWorld('3d');
    w.spawn(floor());
    const c = w.spawn(bot(0));
    w.spawn(crate(2));
    run(w, 120, () => w.setCharacterIntent(c, intent({ moveX: 1 })));
    expect(w.getEntity(c)!.position.x).toBeGreaterThan(3.5);
  });

  it('give a character a collision box as tall as the drawn figure, standing on the same floor', () => {
    const w = createWorld('3d', OPTS);
    w.spawn(floor());
    const c = w.spawn(bot(0));
    run(w, 30);
    const b = box(w, c);
    expect(b.maxY - b.minY).toBeCloseTo(1.6, 5);
    expect(b.minY).toBeCloseTo(0, 3);
    expect(b.maxX - b.minX).toBeGreaterThanOrEqual(1.2);
  });

  it('stop a character in front of a crate, and the crate stays put', () => {
    const w = createWorld('3d', OPTS);
    w.spawn(floor());
    const c = w.spawn(bot(0));
    const k = w.spawn(crate(3));
    run(w, 240, () => w.setCharacterIntent(c, intent({ moveX: 1 })));
    const me = box(w, c);
    const it = box(w, k);
    expect(me.maxX).toBeLessThanOrEqual(it.minX + 1e-3);
    expect(me.maxX).toBeGreaterThan(it.minX - 0.05);
    expect(it.x).toBeCloseTo(3, 3);
  });

  it('stop two characters walking into each other', () => {
    const w = createWorld('3d', OPTS);
    w.spawn(floor());
    const a = w.spawn(bot(-4));
    const b = w.spawn(bot(4, 0, 'cat-chibi'));
    run(w, 300, () => {
      w.setCharacterIntent(a, intent({ moveX: 1 }));
      w.setCharacterIntent(b, intent({ moveX: -1 }));
    });
    expect(box(w, a).maxX).toBeLessThanOrEqual(box(w, b).minX + 1e-3);
    expect(w.isTouching(a, b)).toBe(true);
  });

  it('stack crates instead of merging them', () => {
    const w = createWorld('3d', OPTS);
    w.spawn(floor());
    const low = w.spawn(crate(0, 0, 'low'));
    const high = w.spawn({ ...crate(0, 0, 'high'), position: { x: 0.1, y: 2, z: 0 } });
    run(w, 90);
    expect(box(w, high).minY).toBeGreaterThanOrEqual(box(w, low).maxY - 1e-3);
  });

  it('a character that is already inside a crate at the start can walk out of it', () => {
    const w = createWorld('3d', OPTS);
    w.spawn(floor());
    const c = w.spawn(bot(0));
    w.spawn(crate(0.2));
    run(w, 90, () => w.setCharacterIntent(c, intent({ moveX: -1 })));
    expect(w.getEntity(c)!.position.x).toBeLessThan(-2);
  });

  it('bring a body that falls off the tray back to where it started', () => {
    const w = createWorld('3d', OPTS);
    w.spawn(floor());
    const c = w.spawn(bot(0));
    const k = w.spawn(crate(2));
    run(w, 5);
    w.teleport(c, { x: 30, y: 0.5, z: 0 }, false);
    run(w, 5, () => w.setCharacterIntent(c, intent({ moveX: 1 })));
    run(w, 240, () => w.setCharacterIntent(c, intent({ moveX: 1 })));
    const p = w.getEntity(c)!.position;
    expect(p.y).toBeGreaterThan(-1);
    expect(Math.abs(p.x)).toBeLessThan(25);
    expect(w.getEntity(k)!.position.y).toBeGreaterThan(0);
  });
});

describe('solid bodies: carrying', () => {
  it('a robot carrying overhead cannot push its crate through a wall', () => {
    const w = createWorld('3d', OPTS);
    w.spawn(floor());
    w.spawn(wall(5, 0, 3));
    const c = w.spawn(bot(0, 0, 'cat-chibi'));
    const k = w.spawn(crate(1.1));
    run(w, 5, () => w.setCharacterIntent(c, intent({ moveX: 1 })));
    expect(w.grab(c, 1.2)).toBe(k);
    run(w, 300, () => w.setCharacterIntent(c, intent({ moveX: 1 })));
    const it = box(w, k);
    expect(it.maxX).toBeLessThanOrEqual(4.5 + 1e-3);
    expect(w.getEntity(k)!.carried).toBe(true);
    // Carried above the head of the 1.6-high figure.
    expect(it.minY).toBeGreaterThanOrEqual(1.6 - 1e-3);
  });

  it('a legs robot holds its crate out front and the crate is stopped by the wall too', () => {
    const w = createWorld('3d', OPTS);
    w.spawn(floor());
    w.spawn(wall(5, 0, 3));
    const c = w.spawn(bot(0, 0, 'robot-legs'));
    const k = w.spawn(crate(1.1));
    run(w, 5, () => w.setCharacterIntent(c, intent({ moveX: 1 })));
    expect(w.grab(c, 1.2)).toBe(k);
    run(w, 300, () => w.setCharacterIntent(c, intent({ moveX: 1 })));
    const it = box(w, k);
    const me = box(w, c);
    expect(it.maxX).toBeLessThanOrEqual(4.5 + 1e-3);
    expect(it.maxX).toBeGreaterThan(4.4);
    expect(me.maxX).toBeLessThan(it.maxX + 1e-3);
    // Low and in front: the drawn spot is the simulated spot.
    expect(it.minY).toBeLessThan(0.5);
  });

  it('a drop lets go right where the hands are: the crate only falls, in front of the robot and clear of it', () => {
    const w = createWorld('3d', OPTS);
    w.spawn(floor());
    const c = w.spawn(bot(0, 0, 'robot-legs'));
    const k = w.spawn(crate(1.1));
    run(w, 5);
    expect(w.grab(c, 1.5)).toBe(k);
    run(w, 40);
    const before = box(w, k);
    expect(w.drop(c)).toBe(k);
    run(w, 1);
    const first = box(w, k);
    expect(Math.hypot(first.x - before.x, first.z - before.z)).toBeLessThan(0.01);
    run(w, 60);
    const rest = box(w, k);
    expect(Math.hypot(rest.x - before.x, rest.z - before.z)).toBeLessThan(0.01);
    expect(rest.minY).toBeCloseTo(0, 2);
    expect(w.heldItem(c)).toBeNull();
    const me = box(w, c);
    expect(rest.minX).toBeGreaterThanOrEqual(me.maxX - 1e-3);
  });

  it('a crate is set down on the ones already there: the hands lift it over them', () => {
    const w = createWorld('3d', OPTS);
    w.spawn(floor());
    const c = w.spawn(bot(0, 0, 'robot-legs'));
    const k = w.spawn(crate(1.0, 0, 'carried'));
    run(w, 5);
    expect(w.grab(c, 1.5)).toBe(k);
    run(w, 30);
    const low = w.spawn(crate(3.5, 0, 'low'));
    run(w, 5);
    run(w, 120, () => w.setCharacterIntent(c, intent({ moveX: 1 })));
    // The robot walked on up to the crate on the floor; the carried one rides above it.
    expect(box(w, c).x).toBeGreaterThan(1.8);
    expect(box(w, k).minY).toBeGreaterThanOrEqual(box(w, low).maxY - 1e-3);
    expect(w.drop(c)).toBe(k);
    run(w, 60);
    expect(box(w, k).minY).toBeCloseTo(box(w, low).maxY, 1);
  });

  it('with no room in front the drop fails and the robot keeps hold', () => {
    const w = createWorld('3d', OPTS);
    w.spawn(floor());
    const c = w.spawn(bot(0, 0, 'robot-legs'));
    const k = w.spawn(crate(1.1));
    run(w, 5);
    expect(w.grab(c, 1.5)).toBe(k);
    run(w, 40);
    const at = box(w, k);
    // A post appears right at the hands: letting go would put the crate inside it.
    w.spawn({ kind: 'block', ownerNodeId: 'post', position: { x: at.x, y: 0.5, z: at.z }, size: { x: 0.2, y: 0.2, z: 0.2 }, color: '#999', solid: true });
    expect(w.drop(c)).toBeNull();
    expect(w.heldItem(c)).toBe(k);
  });

  it('a zone counts a crate lying in it but not one a robot still carries', () => {
    const w = createWorld('3d', OPTS);
    w.spawn(floor());
    const c = w.spawn(bot(5, 0, 'robot-legs'));
    const k = w.spawn(crate(6.1));
    run(w, 5);
    const zone = { center: { x: 6, y: 0.5, z: 0 }, size: { x: 4, y: 3, z: 4 }, filter: 'item', rule: 'center' };
    const count = (): number => zoneCount(w, zone);
    expect(count()).toBe(1);
    expect(w.grab(c, 1.2)).toBe(k);
    run(w, 3);
    expect(count()).toBe(0);
    w.drop(c);
    run(w, 30);
    expect(count()).toBe(1);
  });

  it('without the option a carried crate still counts, as before', () => {
    const w = createWorld('3d');
    w.spawn(floor());
    const c = w.spawn(bot(5));
    const k = w.spawn(crate(5.6));
    run(w, 5);
    expect(w.grab(c, 1.2)).toBe(k);
    run(w, 3);
    const zone = { center: { x: 5, y: 1, z: 0 }, size: { x: 4, y: 3, z: 4 }, filter: 'item', rule: 'center' };
    expect(zoneCount(w, zone)).toBe(1);
  });
});
