import { describe, expect, it } from 'vitest';
import { DEATH_SECONDS, IFRAME_SECONDS, defaultDamage } from '../../src/world/combat';
import { createWorld } from '../../src/world/world';
import type { EntitySpec, ViewMode, World } from '../../src/engine/types';

const DT = 1 / 60;
const MODES: ViewMode[] = ['2d-side', '2d-top', '3d'];

const block = (x: number, y: number, z = 0): EntitySpec => ({
  kind: 'block', ownerNodeId: 'b', position: { x, y, z }, size: { x: 1, y: 1, z: 1 }, color: '#fff', solid: true,
});
const char = (x: number, y: number, z = 0): EntitySpec => ({
  kind: 'character', ownerNodeId: 'c', position: { x, y, z }, size: { x: 1, y: 1, z: 1 }, color: '#f00', solid: true,
});
const item = (x: number, y: number, z = 0, over: Partial<EntitySpec> = {}): EntitySpec => ({
  kind: 'item', ownerNodeId: 'i', position: { x, y, z }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#ff0', solid: false, ...over,
});
const run = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) w.step(DT);
};
const seconds = (w: World, s: number): void => run(w, Math.ceil(s / DT));

/** Two characters one unit apart on a floor; `a` faces +X toward `b`. */
function duel(mode: ViewMode, hp = 5) {
  const w = createWorld(mode);
  if (mode === '2d-side') {
    for (let x = -10; x <= 10; x++) w.spawn(block(x, -0.5));
  } else if (mode === '3d') {
    for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) w.spawn(block(x, -0.5, z));
  }
  const y = mode === '2d-top' ? 0 : 0.5;
  const a = w.spawn(char(0, y));
  const b = w.spawn(char(1, y));
  w.setHealth(b, hp, true);
  run(w, 5);
  // Face +X: a brief push right, then stand still.
  w.setCharacterIntent(a, { moveX: 1, moveY: 0, jump: false, speed: 0.01, jumpPower: 0 });
  run(w, 2);
  w.setCharacterIntent(a, { moveX: 0, moveY: 0, jump: false, speed: 0, jumpPower: 0 });
  return { w, a, b, y };
}

describe.each(MODES)('combat in %s', (mode) => {
  it('a bare-handed swing costs one health and shows as a one-tick hurt pulse', () => {
    const { w, a, b } = duel(mode);
    expect(w.healthOf(b)).toEqual({ hp: 5, max: 5, dead: false });
    expect(w.useTool(a, 1.3)).toEqual({ target: b });
    expect(w.healthOf(b)?.hp).toBe(4);
    expect(w.wasHurt(b)).toBe(false); // visible from the next step, like other pulses
    w.step(DT);
    expect(w.wasHurt(b)).toBe(true);
    w.step(DT);
    expect(w.wasHurt(b)).toBe(false);
  });

  it('knocks the victim away from the attacker', () => {
    const { w, a, b } = duel(mode);
    w.useTool(a, 1.3);
    seconds(w, 0.4);
    expect(w.getEntity(b)!.position.x).toBeGreaterThan(1.5);
    expect(w.getEntity(a)!.position.x).toBeCloseTo(0, 1);
  });

  it('ignores hits on a character that has no health', () => {
    const { w, a, b } = duel(mode);
    const c = w.spawn(char(-1, mode === '2d-top' ? 0 : 0.5));
    w.setCharacterIntent(a, { moveX: -1, moveY: 0, jump: false, speed: 0.01, jumpPower: 0 });
    run(w, 2);
    w.setCharacterIntent(a, { moveX: 0, moveY: 0, jump: false, speed: 0, jumpPower: 0 });
    expect(w.useTool(a, 1.3)).toEqual({ target: c });
    seconds(w, 0.5);
    expect(w.healthOf(c)).toBeNull();
    expect(w.getEntity(c)!.position.x).toBeCloseTo(-1, 1);
    expect(w.healthOf(b)?.hp).toBe(5);
  });

  it('a second hit inside the invulnerable window does nothing; after it, it lands', () => {
    const { w, a, b } = duel(mode, 10);
    w.useTool(a, 1.3);
    seconds(w, 0.3); // swing over, victim knocked back but still invulnerable
    expect(w.getEntity(b)!.hurt).toBeGreaterThan(0);
    // Walk up to the victim again and swing.
    w.setCharacterIntent(a, { moveX: 1, moveY: 0, jump: false, speed: 5, jumpPower: 0 });
    for (let i = 0; i < 12; i++) w.step(DT);
    w.setCharacterIntent(a, { moveX: 0, moveY: 0, jump: false, speed: 0, jumpPower: 0 });
    const early = w.useTool(a, 1.3);
    expect(early?.target).toBe(b);
    expect(w.healthOf(b)?.hp).toBe(9);
    seconds(w, IFRAME_SECONDS + 0.2);
    expect(w.getEntity(b)!.hurt).toBeUndefined();
  });

  it('tools hit harder: sword 3, hammer 2, custom damage wins over the shape', () => {
    expect(defaultDamage('sword')).toBe(3);
    expect(defaultDamage('hammer')).toBe(2);
    expect(defaultDamage('pickaxe')).toBe(2);
    expect(defaultDamage('torch')).toBe(1);
    for (const [spec, dmg] of [
      [{ shape: 'sword' as const }, 3],
      [{ shape: 'hammer' as const }, 2],
      [{ shape: 'sword' as const, damage: 4 }, 4],
    ] as const) {
      const { w, a, b, y } = duel(mode, 10);
      const t = w.spawn(item(0, y, 0, { holdStyle: 'hand', ...spec }));
      run(w, 3);
      expect(w.equip(a, 1)).toBe(t);
      w.useTool(a, 1.3);
      expect(w.healthOf(b)?.hp).toBe(10 - dmg);
    }
  });

  it('a thrown item hurts the first character it hits, once, and not its thrower', () => {
    const { w, a, b: near, y } = duel(mode, 10);
    w.setHealth(a, 10, true);
    // The throw arcs over the head of anyone adjacent, so outside the top view the target stands a few steps away.
    const far = w.spawn(char(3.5, y));
    w.setHealth(far, 10, true);
    const b = mode === '2d-top' ? near : far;
    const ball = w.spawn(item(0, y, 0, { shape: 'ball', damage: 2 }));
    run(w, 3);
    expect(w.grab(a, 1)).toBe(ball);
    expect(w.throwHeld(a, 9)).toBe(ball);
    seconds(w, 0.6);
    expect(w.healthOf(b)?.hp).toBe(8);
    expect(w.healthOf(a)?.hp).toBe(10);
    seconds(w, 2);
    expect(w.healthOf(b)?.hp).toBe(8);
  });

  it('a gently dropped or slow item does no damage', () => {
    const { w, a, b, y } = duel(mode, 10);
    const ball = w.spawn(item(0.5, y, 0, { shape: 'ball' }));
    run(w, 3);
    w.grab(a, 1);
    w.throwHeld(a, 0.5);
    seconds(w, 1);
    expect(w.healthOf(b)?.hp).toBe(10);
    void ball;
  });

  it('running out of health tips the character over, then hides it; dead stays true', () => {
    const { w, a, b } = duel(mode, 1);
    w.useTool(a, 1.3);
    expect(w.healthOf(b)).toEqual({ hp: 0, max: 1, dead: true });
    const view = () => w.entities().find((e) => e.id === b)!;
    expect(view().fallen).toBe(0);
    seconds(w, DEATH_SECONDS / 2);
    expect(view().visible).toBe(true);
    expect(view().fallen).toBeGreaterThan(0.3);
    expect(view().fallen).toBeLessThan(0.8);
    seconds(w, DEATH_SECONDS);
    expect(view().visible).toBe(false);
    expect(w.healthOf(b)?.dead).toBe(true);
  });

  it('a fall that began as the game ended still plays out to the end', () => {
    const { w, a, b } = duel(mode, 1);
    w.useTool(a, 1.3);
    w.endGame('win', 'done');
    seconds(w, DEATH_SECONDS / 2);
    const view = () => w.entities().find((e) => e.id === b)!;
    expect(view().visible).toBe(true);
    expect(view().fallen).toBeGreaterThan(0.3);
    seconds(w, DEATH_SECONDS);
    expect(view().visible).toBe(false);
  });

  it('the dying let go of what they hold and cannot act or be hit again', () => {
    const { w, a, b, y } = duel(mode, 1);
    const crate = w.spawn(item(1, y, 0));
    const sword = w.spawn(item(1, y, 0, { shape: 'sword', holdStyle: 'hand' }));
    run(w, 3);
    expect(w.grab(b, 1)).toBe(crate);
    expect(w.equip(b, 1)).toBe(sword);
    w.useTool(a, 1.3);
    expect(w.heldItem(b)).toBeNull();
    expect(w.handItem(b)).toBeNull();
    expect(w.isHeld(crate)).toBe(false);
    expect(w.isInHand(sword)).toBe(false);
    expect(w.useTool(b, 1.3)).toBeNull();
    expect(w.grab(b, 3)).toBeNull();
    seconds(w, IFRAME_SECONDS + 0.1);
    w.useTool(a, 1.3);
    expect(w.healthOf(b)?.hp).toBe(0);
  });

  it('heal adds health up to the maximum, never revives', () => {
    const { w, a, b } = duel(mode, 5);
    w.useTool(a, 1.3);
    w.heal(b, 1);
    expect(w.healthOf(b)?.hp).toBe(5);
    w.heal(b, 10);
    expect(w.healthOf(b)?.hp).toBe(5);
    const { w: w2, a: a2, b: b2 } = duel(mode, 1);
    w2.useTool(a2, 1.3);
    w2.heal(b2, 3);
    expect(w2.healthOf(b2)).toEqual({ hp: 0, max: 1, dead: true });
  });

  it('exposes health to the renderer and re-registering only updates max and bar', () => {
    const { w, a, b } = duel(mode, 5);
    w.useTool(a, 1.3);
    expect(w.getEntity(b)?.health).toEqual({ hp: 4, max: 5, bar: true });
    w.setHealth(b, 3, false);
    expect(w.getEntity(b)?.health).toEqual({ hp: 3, max: 3, bar: false });
    expect(w.getEntity(a)?.health).toBeUndefined();
  });
});
