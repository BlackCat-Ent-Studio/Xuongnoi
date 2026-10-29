import { describe, expect, it } from 'vitest';
import { touchNode } from '../../src/nodes/touch';
import type { EntityView, Params, Vec3 } from '../../src/engine/types';
import { defaultParams, makeCtx, makeWorld, type FakeWorld } from './fake-world';

function put(w: FakeWorld, id: string, position: Vec3, size: Vec3): void {
  const e: EntityView = { id, kind: 'block', ownerNodeId: 'x', position, size, color: '#fff', visible: true };
  w.entities.set(id, e);
}

function setup(over: Params = {}, mode: FakeWorld['mode'] = '2d-side') {
  const w = makeWorld();
  (w as { mode: FakeWorld["mode"] }).mode = mode;
  put(w, 'A', { x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 });
  put(w, 'B', { x: 0, y: 0, z: 0 }, { x: 4, y: 4, z: 4 });
  const params = defaultParams(touchNode, over);
  const s = touchNode.create!(makeCtx(w), params);
  const step = (dt = 1 / 60) => touchNode.evaluate(makeCtx(w, { dt }), { a: 'A', b: 'B' }, params, s);
  return { w, step };
}

describe('touch defaults', () => {
  it('uses physics contacts and ignores geometry', () => {
    const { w, step } = setup();
    expect(step().touching).toBe(false);
    w.touching.add('A|B');
    const r = step();
    expect(r).toMatchObject({ touching: true, began: true, ended: false });
    expect(step()).toMatchObject({ touching: true, began: false });
    w.touching.clear();
    expect(step()).toMatchObject({ touching: false, ended: true });
    expect(step().ended).toBe(false);
  });

  it('is false with missing inputs', () => {
    const w = makeWorld();
    const params = defaultParams(touchNode);
    const s = touchNode.create!(makeCtx(w), params);
    expect(touchNode.evaluate(makeCtx(w), {}, params, s).touching).toBe(false);
  });
});

describe('grow', () => {
  it('positive grow makes a near miss count (geometric)', () => {
    const { w, step } = setup({ grow: 1 });
    w.entities.set('A', { ...w.entities.get('A')!, position: { x: 3.5, y: 0, z: 0 } });
    // gap: 3.5 vs 1 + 2 = 3 (no grow) -> false; with grow 1 -> 4 -> true
    expect(step().touching).toBe(true);
    const n = setup({ grow: 0.2 });
    n.w.entities.set('A', { ...n.w.entities.get('A')!, position: { x: 3.5, y: 0, z: 0 } });
    expect(n.step().touching).toBe(false);
  });

  it('negative grow shrinks A so a shallow overlap stops counting', () => {
    const { w, step } = setup({ grow: -0.5 });
    w.entities.set('A', { ...w.entities.get('A')!, position: { x: 2.8, y: 0, z: 0 } });
    // sum halves 3 -> 2 with grow -0.5; d 2.8 > 2
    expect(step().touching).toBe(false);
    w.entities.set('A', { ...w.entities.get('A')!, position: { x: 1.9, y: 0, z: 0 } });
    expect(step().touching).toBe(true);
  });
});

describe('modes', () => {
  it('center: A centre inside B', () => {
    const { w, step } = setup({ mode: 'center' });
    w.entities.set('A', { ...w.entities.get('A')!, position: { x: 1.9, y: 0, z: 0 } });
    expect(step().touching).toBe(true);
    w.entities.set('A', { ...w.entities.get('A')!, position: { x: 2.5, y: 0, z: 0 } });
    expect(step().touching).toBe(false);
  });

  it('inside: A fully within B', () => {
    const { w, step } = setup({ mode: 'inside' });
    w.entities.set('A', { ...w.entities.get('A')!, position: { x: 1, y: 0, z: 0 } });
    expect(step().touching).toBe(true);
    w.entities.set('A', { ...w.entities.get('A')!, position: { x: 1.5, y: 0, z: 0 } });
    expect(step().touching).toBe(false);
  });

  it('2d-top ignores Y, 2d-side ignores Z', () => {
    const top = setup({ mode: 'center' }, '2d-top');
    top.w.entities.set('A', { ...top.w.entities.get('A')!, position: { x: 0, y: 50, z: 0 } });
    expect(top.step().touching).toBe(true);
    const side = setup({ mode: 'center' }, '2d-side');
    side.w.entities.set('A', { ...side.w.entities.get('A')!, position: { x: 0, y: 0, z: 50 } });
    expect(side.step().touching).toBe(true);
    const full = setup({ mode: 'center' }, '3d');
    full.w.entities.set('A', { ...full.w.entities.get('A')!, position: { x: 0, y: 0, z: 50 } });
    expect(full.step().touching).toBe(false);
  });

  it('unknown entity gives false', () => {
    const { w, step } = setup({ mode: 'center' });
    w.entities.delete('B');
    expect(step().touching).toBe(false);
  });
});

describe('hold timer', () => {
  it('turns true only after the hold time and pulses began once', () => {
    const { w, step } = setup({ hold: 0.5 });
    w.touching.add('A|B');
    expect(step(0.2)).toMatchObject({ touching: false, began: false });
    expect(step(0.2)).toMatchObject({ touching: false, began: false });
    expect(step(0.2)).toMatchObject({ touching: true, began: true });
    expect(step(0.2)).toMatchObject({ touching: true, began: false });
  });

  it('resets when contact breaks and does not pulse ended if never counted', () => {
    const { w, step } = setup({ hold: 0.5 });
    w.touching.add('A|B');
    step(0.3);
    w.touching.clear();
    expect(step(0.3)).toMatchObject({ touching: false, ended: false });
    w.touching.add('A|B');
    expect(step(0.3).touching).toBe(false);
    expect(step(0.3).touching).toBe(true);
  });

  it('works with geometric modes too', () => {
    const { step } = setup({ mode: 'center', hold: 0.1 });
    expect(step(0.05).touching).toBe(false);
    expect(step(0.06).touching).toBe(true);
  });
});

describe('ended pulse', () => {
  it('fires one tick when touching goes true to false', () => {
    const { w, step } = setup({ mode: 'center' });
    expect(step().touching).toBe(true);
    w.entities.set('A', { ...w.entities.get('A')!, position: { x: 9, y: 0, z: 0 } });
    expect(step()).toMatchObject({ touching: false, ended: true });
    expect(step().ended).toBe(false);
  });
});
