import { describe, expect, it } from 'vitest';
import { createWorld } from '../../src/world/world';
import type { CharacterIntent, EntitySpec, ViewMode, World } from '../../src/engine/types';

const DT = 1 / 60;
const intent = (p: Partial<CharacterIntent> = {}): CharacterIntent => ({
  moveX: 0, moveY: 0, jump: false, speed: 5, jumpPower: 10, ...p,
});
const block = (x: number, y: number, z = 0, solid = true): EntitySpec => ({
  kind: 'block', ownerNodeId: 'n', position: { x, y, z }, size: { x: 1, y: 1, z: 1 }, color: '#ffffff', solid,
});
const char = (x: number, y: number, z = 0): EntitySpec => ({
  kind: 'character', ownerNodeId: 'c', position: { x, y, z }, size: { x: 0.8, y: 1, z: 0.8 }, color: '#ff0000', solid: true,
});
function run(w: World, n: number): void {
  for (let i = 0; i < n; i++) w.step(DT);
}

describe('world physics', () => {
  it('lands on floor and stays', () => {
    const w = createWorld('2d-side');
    w.spawn(block(0, 0));
    const c = w.spawn(char(0, 3));
    run(w, 120);
    const y0 = w.getEntity(c)!.position.y;
    expect(w.isOnGround(c)).toBe(true);
    expect(y0).toBeCloseTo(1, 4);
    for (let i = 0; i < 300; i++) {
      w.step(DT);
      expect(w.isOnGround(c)).toBe(true);
      expect(Math.abs(w.getEntity(c)!.position.y - y0)).toBeLessThan(1e-4);
    }
  });

  it('works before any step', () => {
    const w = createWorld('3d');
    const c = w.spawn(char(0, 5));
    expect(w.getEntity(c)!.position.y).toBe(5);
    expect(w.isOnGround(c)).toBe(false);
  });

  it('walks across tiled floor without snagging', () => {
    const w = createWorld('2d-side');
    for (let i = 0; i < 10; i++) w.spawn(block(i, 0));
    const c = w.spawn(char(0, 1));
    run(w, 30);
    w.setCharacterIntent(c, intent({ moveX: 1, speed: 6 }));
    run(w, 60);
    const p = w.getEntity(c)!.position;
    expect(p.x).toBeGreaterThan(5.5);
    expect(p.y).toBeCloseTo(1, 4);
    expect(w.isOnGround(c)).toBe(true);
  });

  it('wall stops character at max speed', () => {
    const w = createWorld('2d-side');
    for (let i = 0; i < 12; i++) w.spawn(block(i, 0));
    w.spawn(block(8, 1));
    w.spawn(block(8, 2));
    const c = w.spawn(char(0, 1));
    run(w, 30);
    w.setCharacterIntent(c, intent({ moveX: 1, speed: 20 }));
    run(w, 120);
    expect(w.getEntity(c)!.position.x).toBeCloseTo(8 - 0.5 - 0.4, 4);
  });

  it('does not tunnel when falling fast', () => {
    const w = createWorld('2d-side');
    w.spawn(block(0, 0));
    const c = w.spawn(char(0, 500));
    run(w, 1200);
    expect(w.getEntity(c)!.position.y).toBeCloseTo(1, 4);
  });

  it('top mode ignores gravity and jump, maps moveY to -Z', () => {
    const w = createWorld('2d-top');
    const c = w.spawn(char(0, 2, 0));
    w.setCharacterIntent(c, intent({ moveY: 1, jump: true }));
    run(w, 60);
    const p = w.getEntity(c)!.position;
    expect(p.y).toBe(2);
    expect(p.z).toBeCloseTo(-5, 3);
  });

  it('side mode keeps z at 0', () => {
    const w = createWorld('2d-side');
    const c = w.spawn(char(0, 2, 3));
    w.setCharacterIntent(c, intent({ moveX: 1, moveY: 1 }));
    run(w, 30);
    expect(w.getEntity(c)!.position.z).toBe(0);
  });

  it('jumps only from ground in side mode', () => {
    const w = createWorld('2d-side');
    w.spawn(block(0, 0));
    const c = w.spawn(char(0, 1));
    run(w, 10);
    w.setCharacterIntent(c, intent({ jump: true, jumpPower: 12 }));
    run(w, 10);
    expect(w.getEntity(c)!.position.y).toBeGreaterThan(1.5);
    expect(w.isOnGround(c)).toBe(false);
  });

  it('3d yaw rotates stick input', () => {
    const w = createWorld('3d');
    const c = w.spawn(char(0, 0));
    w.setCharacterIntent(c, intent({ moveY: 1, speed: 6 }));
    run(w, 10);
    let p = w.getEntity(c)!.position;
    expect(p.z).toBeLessThan(-0.5);
    expect(Math.abs(p.x)).toBeLessThan(1e-9);

    const w2 = createWorld('3d');
    w2.setCameraYaw(Math.PI / 2); // camera looks toward -X
    const c2 = w2.spawn(char(0, 0));
    w2.setCharacterIntent(c2, intent({ moveY: 1, speed: 6 }));
    run(w2, 10);
    p = w2.getEntity(c2)!.position;
    expect(p.x).toBeLessThan(-0.5);
    expect(Math.abs(p.z)).toBeLessThan(1e-9);
  });

  it('pickup contact begins and ends; hidden gives none', () => {
    const w = createWorld('2d-top');
    const c = w.spawn(char(0, 0));
    const p = w.spawn(block(3, 0, 0, false));
    w.setCharacterIntent(c, intent({ moveX: 1, speed: 6 }));
    run(w, 5);
    expect(w.isTouching(c, p)).toBe(false);
    run(w, 25);
    expect(w.isTouching(c, p)).toBe(true);
    expect(w.isTouching(p, c)).toBe(true);
    run(w, 60);
    expect(w.isTouching(c, p)).toBe(false);

    const w2 = createWorld('2d-top');
    const c2 = w2.spawn(char(0, 0));
    const p2 = w2.spawn(block(0, 0, 0, false));
    w2.step(DT);
    expect(w2.isTouching(c2, p2)).toBe(true);
    w2.hide(p2);
    expect(w2.isTouching(c2, p2)).toBe(false);
    w2.step(DT);
    expect(w2.isTouching(c2, p2)).toBe(false);
    expect(w2.entities().find((e) => e.id === p2)!.visible).toBe(false);
  });

  it('endGame first wins and freezes step', () => {
    const w = createWorld('3d');
    const c = w.spawn(char(0, 10));
    w.endGame('win', 'a');
    w.endGame('lose', 'b');
    expect(w.ended).toEqual({ result: 'win', message: 'a' });
    w.step(DT);
    expect(w.getEntity(c)!.position.y).toBe(10);
  });

  it('hud upserts by key', () => {
    const w = createWorld('3d');
    w.setHud({ key: 'k', label: 'A', value: 1, corner: 'top-left' });
    w.setHud({ key: 'k', label: 'A', value: 2, corner: 'top-left' });
    expect(w.hudItems()).toHaveLength(1);
    expect(w.hudItems()[0]!.value).toBe(2);
  });

  it('is deterministic', () => {
    const sim = (mode: ViewMode): unknown => {
      const w = createWorld(mode);
      for (let i = 0; i < 6; i++) w.spawn(block(i, 0));
      const c = w.spawn(char(0, 3));
      for (let t = 0; t < 200; t++) {
        w.setCharacterIntent(c, intent({ moveX: Math.sin(t / 10), moveY: Math.cos(t / 7), jump: t % 40 === 0 }));
        w.step(DT);
      }
      return w.entities();
    };
    for (const m of ['2d-side', '2d-top', '3d'] as const) expect(sim(m)).toEqual(sim(m));
  });
});
