import { describe, expect, it } from 'vitest';
import type { EntitySpec, ViewMode, World } from '../../src/engine/types';
import { blockNode } from '../../src/nodes/block';
import { carryNode } from '../../src/nodes/carry';
import { forceSensorNode } from '../../src/nodes/force-sensor';
import { itemNode } from '../../src/nodes/item';
import { damagedColor, damagedView, DAMAGED_HEIGHT } from '../../src/render/damaged-look';
import { DEFAULT_MASS_KG } from '../../src/world/material';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx } from '../nodes/fake-world';

const DT = 1 / 60;
const run = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) w.step(DT);
};
const block = (x: number, y: number, over: Partial<EntitySpec> = {}): EntitySpec => ({
  kind: 'block', ownerNodeId: 'b', position: { x, y, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#ffffff', solid: true, ...over,
});
const crate = (x: number, y: number, over: Partial<EntitySpec> = {}): EntitySpec => ({
  kind: 'item', ownerNodeId: 'i', position: { x, y, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#ffff00', solid: false, ...over,
});
const hero = (x: number): EntitySpec => ({ kind: 'character', ownerNodeId: 'c', position: { x, y: 1, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#ff0000', solid: true });
const side = (): World => {
  const w = createWorld('2d-side' as ViewMode);
  for (let x = -6; x <= 6; x++) w.spawn(block(x, -0.5));
  return w;
};

describe('neutral material defaults', () => {
  it('a default body carries no material fields in its view, so old trajectories hash the same', () => {
    const w = side();
    const explicit = w.spawn(crate(0, 2, { mass: 1, mu: 0.5, crushLimit: 0 }));
    const plain = w.spawn(crate(2, 2));
    run(w, 60);
    for (const k of [explicit, plain]) {
      const v = w.getEntity(k)!;
      expect(v).not.toHaveProperty('mass');
      expect(v).not.toHaveProperty('mu');
      expect(v).not.toHaveProperty('crushLimit');
      expect(v).not.toHaveProperty('damaged');
    }
    expect(w.materialOf(explicit)).toEqual({ massKg: 1, mu: 0.5, crushLimitN: 0, damaged: false });
  });

  it('every kind has its own default mass; set values show up in the view', () => {
    const w = side();
    const b = w.spawn(block(0, 3));
    const c = w.spawn(hero(2));
    const heavy = w.spawn(crate(4, 3, { mass: 8, mu: 1.2, crushLimit: 150 }));
    expect(w.materialOf(b)!.massKg).toBe(DEFAULT_MASS_KG.block);
    expect(w.materialOf(c)!.massKg).toBe(DEFAULT_MASS_KG.character);
    expect(w.getEntity(heavy)).toMatchObject({ mass: 8, mu: 1.2, crushLimit: 150 });
    expect(w.materialOf('nope')).toBeNull();
  });

  it('bad values are clamped or ignored', () => {
    const w = side();
    const a = w.spawn(crate(0, 2, { mass: -5, mu: 99, crushLimit: NaN }));
    expect(w.materialOf(a)).toMatchObject({ massKg: 0, mu: 1.5, crushLimitN: 0 });
  });

  it('node params default to the neutral values', () => {
    for (const def of [blockNode, itemNode]) {
      const p = defaultParams(def);
      expect(p.mu).toBe(0.5);
      expect(p.crushLimit).toBe(0);
    }
    expect(defaultParams(itemNode).mass).toBe(DEFAULT_MASS_KG.item);
    expect(defaultParams(blockNode).mass).toBe(DEFAULT_MASS_KG.block);
  });
});

describe('applySqueeze', () => {
  it('damages only above the crush limit and stays damaged', () => {
    const w = side();
    const id = w.spawn(crate(0, 1, { crushLimit: 200 }));
    expect(w.applySqueeze(id, 200)).toBe(false);
    expect(w.getEntity(id)).not.toHaveProperty('damaged');
    expect(w.applySqueeze(id, 200.5)).toBe(true);
    expect(w.getEntity(id)!.damaged).toBe(true);
    expect(w.applySqueeze(id, 0)).toBe(true);
    expect(w.materialOf(id)!.damaged).toBe(true);
  });

  it('never damages a body with no limit, a bad force, or an unknown id', () => {
    const w = side();
    const free = w.spawn(crate(0, 1));
    expect(w.applySqueeze(free, 1e9)).toBe(false);
    const limited = w.spawn(crate(2, 1, { crushLimit: 10 }));
    expect(w.applySqueeze(limited, NaN)).toBe(false);
    expect(w.applySqueeze('nope', 99)).toBe(false);
  });

  it('a damaged view is squashed with its underside in place and tinted', () => {
    const w = side();
    const id = w.spawn(crate(0, 1, { crushLimit: 1, color: '#facc15' }));
    const whole = w.getEntity(id)!;
    expect(damagedView(whole)).toBe(whole);
    const d = damagedView({ ...whole, damaged: true });
    expect(d.size.y).toBeCloseTo(whole.size.y * DAMAGED_HEIGHT, 9);
    expect(d.size.x).toBeGreaterThan(whole.size.x);
    expect(d.position.y - d.size.y / 2).toBeCloseTo(whole.position.y - whole.size.y / 2, 9);
    expect(d.color).not.toBe(whole.color);
    expect(damagedColor('red')).toBe('red');
  });
});

describe('massOn and the force sensor', () => {
  function scaleWorld() {
    const w = side();
    const scale = w.spawn(block(0, 0.7, { size: { x: 4, y: 0.4, z: 1 } }));
    const a = w.spawn(crate(-1.2, 3, { mass: 2 }));
    const b = w.spawn(crate(0, 3, { mass: 5 }));
    const c = w.spawn(crate(1.2, 3, { mass: 10 }));
    run(w, 120);
    return { w, scale, a, b, c };
  }

  it('adds up the crates resting on the platform', () => {
    const { w, scale } = scaleWorld();
    expect(w.massOn(scale)).toBe(17);
  });

  it('ignores hidden crates and bodies beside the platform', () => {
    const { w, scale, c } = scaleWorld();
    const beside = w.spawn(crate(4, 3, { mass: 40 }));
    run(w, 120);
    expect(w.massOn(scale)).toBe(17);
    w.hide(c);
    expect(w.massOn(scale)).toBe(7);
    expect(w.massOn(beside)).toBe(0);
  });

  it('the sensor reports kg, N and loaded', () => {
    const { w, scale } = scaleWorld();
    const ctx = makeCtx(w);
    const params = defaultParams(forceSensorNode);
    const s = forceSensorNode.create!(ctx, params);
    const out = forceSensorNode.evaluate(ctx, { who: scale }, params, s);
    expect(out.mass).toBe(17);
    expect(out.force).toBeCloseTo(166.77, 6);
    expect(out.loaded).toBe(true);
  });

  it('smoothing eases the reading towards the load instead of jumping', () => {
    const { w, scale, c } = scaleWorld();
    const ctx = makeCtx(w);
    const params = defaultParams(forceSensorNode, { smoothing: 1 });
    const s = forceSensorNode.create!(ctx, params);
    expect(forceSensorNode.evaluate(ctx, { who: scale }, params, s).mass).toBe(17);
    w.hide(c);
    const next = forceSensorNode.evaluate(ctx, { who: scale }, params, s);
    expect(next.mass as number).toBeGreaterThan(7);
    expect(next.mass as number).toBeLessThan(17);
    expect(next.loaded).toBe(true);
  });

  it('an unwired sensor reads 0', () => {
    const w = side();
    const ctx = makeCtx(w);
    const params = defaultParams(forceSensorNode);
    const out = forceSensorNode.evaluate(ctx, {}, params, forceSensorNode.create!(ctx, params));
    expect(out).toEqual({ force: 0, mass: 0, loaded: false });
  });

  it('hold mode reads what a character carries', () => {
    const w = side();
    const who = w.spawn(hero(0));
    run(w, 30);
    const box = w.spawn(crate(0.2, 1, { mass: 7 }));
    expect(w.grab(who, 1.2)).toBe(box);
    const ctx = makeCtx(w);
    const params = defaultParams(forceSensorNode, { mode: 'hold' });
    const out = forceSensorNode.evaluate(ctx, { who }, params, forceSensorNode.create!(ctx, params));
    expect(out.mass).toBe(7);
    expect(out.force).toBeCloseTo(68.67, 6);
  });
});

describe('carry by weight', () => {
  function setup() {
    const w = side();
    const who = w.spawn(hero(0));
    run(w, 30);
    const light = w.spawn(crate(0.2, 1, { mass: 4 }));
    return { w, who, light };
  }

  it('lifts everything by default (strength 0)', () => {
    const { w, who } = setup();
    const heavy = w.spawn(crate(0.1, 1, { mass: 5000 }));
    expect(w.grab(who, 1.2)).toBe(heavy);
  });

  it('refuses an item heavier than the strength and says so', () => {
    const { w, who, light } = setup();
    expect(w.grab(who, 1.2, 3)).toBeNull();
    expect(w.tooHeavyToGrab(who, 1.2, 3)).toBe(true);
    expect(w.heldItem(who)).toBeNull();
    expect(w.tooHeavyToGrab(who, 1.2, 4)).toBe(false);
    expect(w.grab(who, 1.2, 4)).toBe(light);
  });

  it('the carry node latches "Quá nặng" until a lift works', () => {
    const { w, who, light } = setup();
    const ctx = makeCtx(w);
    const weak = defaultParams(carryNode, { strength: 3, showTooHeavyOut: 'yes' });
    const s = carryNode.create!(ctx, weak);
    carryNode.evaluate(ctx, { character: who, grab: false }, weak, s);
    const fail = carryNode.evaluate(ctx, { character: who, grab: true }, weak, s);
    expect(fail).toMatchObject({ holding: false, tooHeavy: true });
    expect(carryNode.evaluate(ctx, { character: who, grab: false }, weak, s).tooHeavy).toBe(true);

    const strong = defaultParams(carryNode, { strength: 4, showTooHeavyOut: 'yes' });
    const ok = carryNode.evaluate(ctx, { character: who, grab: true }, strong, s);
    expect(ok).toMatchObject({ holding: true, heldItem: light, tooHeavy: false });
    expect(carryNode.evaluate(ctx, { character: who, grab: false }, defaultParams(carryNode), s)).not.toHaveProperty('tooHeavy');
  });

  it('node params: strength defaults to 0 (unlimited) and the output is optional', () => {
    const p = defaultParams(carryNode);
    expect(p.strength).toBe(0);
    expect(carryNode.optionalOutputs!.active(p)).toEqual([]);
    expect(carryNode.optionalOutputs!.active({ ...p, showTooHeavyOut: 'yes' }).map((x) => x.id)).toEqual(['tooHeavy']);
  });
});
