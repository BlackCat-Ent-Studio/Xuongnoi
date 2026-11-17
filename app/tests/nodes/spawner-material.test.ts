import { describe, expect, it } from 'vitest';
import type { Params, ViewMode, World } from '../../src/engine/types';
import { forceSensorNode } from '../../src/nodes/force-sensor';
import { spawnerNode } from '../../src/nodes/spawner';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx } from './fake-world';

function setup(over: Params = {}) {
  const w = createWorld('2d-side' as ViewMode);
  const params = defaultParams(spawnerNode, { position: { x: 0, y: 3, z: 0 }, lifetime: 0, maxAlive: 10, ...over });
  const state = spawnerNode.create!(makeCtx(w), params);
  let tick = 0;
  const fire = (inputs: Record<string, number | boolean> = {}) => {
    const off = spawnerNode.evaluate(makeCtx(w, { tick: tick++ }), { spawn: false }, params, state);
    const on = spawnerNode.evaluate(makeCtx(w, { tick: tick++ }), { spawn: true, ...inputs }, params, state);
    void off;
    return on.lastSpawned as string;
  };
  return { w, params, fire };
}
const plain = (w: World, id: string) => w.getEntity(id)!;

describe('spawner material', () => {
  it('a board saved before the mass setting adds no field to the spawned entity (item and block)', () => {
    for (const template of ['item', 'block']) {
      const { w, fire } = setup({ template, mass: 0 });
      const id = fire();
      const v = plain(w, id);
      expect(v).not.toHaveProperty('mass');
      expect(v).not.toHaveProperty('mu');
      expect(v).not.toHaveProperty('crushLimit');
    }
  });

  it('mass 0 means by kind: a block weighs 10 kg and an item 1 kg; old boards read 0', () => {
    expect(spawnerNode.params.find((p) => p.id === 'mass')).toMatchObject({ default: 1, legacyDefault: 0 });
    const block = setup({ template: 'block', mass: 0 });
    expect(block.w.materialOf(block.fire())!.massKg).toBe(10);
    const item = setup({ template: 'item', mass: 0 });
    expect(item.w.materialOf(item.fire())!.massKg).toBe(1);
  });

  it('a block weighs what the mass box says, 1 kg included', () => {
    const { w, fire } = setup({ template: 'block', mass: 1 });
    expect(w.materialOf(fire())!.massKg).toBe(1);
  });

  it('applies mass, friction and crush limit params', () => {
    const { w, fire } = setup({ mass: 7, mu: 1.2, crushLimit: 300 });
    expect(w.materialOf(fire())).toMatchObject({ massKg: 7, mu: 1.2, crushLimitN: 300 });
  });

  it('clamps params like a placed body', () => {
    const { w, fire } = setup({ mass: 1e9 });
    expect(w.materialOf(fire())!.massKg).toBe(100000);
  });

  it('wired mass is used at each spawn and ignored while the inputs are hidden', () => {
    const { w, fire } = setup({ wireMaterial: 'yes', mass: 3 });
    const a = fire({ mass: 2 });
    const b = fire({ mass: 9 });
    const c = fire({});
    expect(w.materialOf(a)!.massKg).toBe(2);
    expect(w.materialOf(b)!.massKg).toBe(9);
    expect(w.materialOf(c)!.massKg).toBe(3);
    const off = setup({ mass: 3 });
    expect(off.w.materialOf(off.fire({ mass: 50 }))!.massKg).toBe(3);
  });

  it('wired crush limit makes the crate breakable', () => {
    const { w, fire } = setup({ wireMaterial: 'yes' });
    expect(w.materialOf(fire({ crushLimit: 120 }))!.crushLimitN).toBe(120);
  });

  it('only shows the extra ports while the toggle is on', () => {
    const on = spawnerNode.optionalInputs!.active({ wireMaterial: 'yes' }).map((p) => p.id);
    const off = spawnerNode.optionalInputs!.active(defaultParams(spawnerNode)).map((p) => p.id);
    expect(on).toEqual(['mass', 'crushLimit']);
    expect(off).toEqual([]);
  });

  it('a scale reads the mass of crates spawned with different masses', () => {
    const { w, fire } = setup({ wireMaterial: 'yes', position: { x: 0, y: 1.5, z: 0 } });
    const scale = w.spawn({ kind: 'block', ownerNodeId: 'b', position: { x: 0, y: 0.5, z: 0 }, size: { x: 6, y: 0.4, z: 1 }, color: '#fff', solid: true });
    fire({ mass: 4 });
    for (let i = 0; i < 90; i++) w.step(1 / 60);
    expect(w.massOn(scale)).toBe(4);
    const sensor = forceSensorNode.evaluate(makeCtx(w), { who: scale }, defaultParams(forceSensorNode), forceSensorNode.create!(makeCtx(w), defaultParams(forceSensorNode)));
    expect(sensor.mass).toBe(4);
  });
});
