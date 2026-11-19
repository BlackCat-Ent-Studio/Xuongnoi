import { describe, expect, it } from 'vitest';
import { activeOutputs, getNodeDef } from '../../src/engine/registry';
import type { Params, PortValues, ViewMode } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { colorSensorNode } from '../../src/nodes/color-sensor';
import { forceSensorNode } from '../../src/nodes/force-sensor';
import { spawnerNode } from '../../src/nodes/spawner';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx } from './fake-world';

registerAllNodes();

const COLORS = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#f97316'];

function setup(over: Params = {}, nodeId = 'maker') {
  const w = createWorld('2d-side' as ViewMode);
  const params = defaultParams(spawnerNode, { position: { x: 0, y: 3, z: 0 }, lifetime: 0, maxAlive: 50, ...over });
  const state = spawnerNode.create!(makeCtx(w, { nodeId }), params);
  let tick = 0;
  const fire = (inputs: PortValues = {}): PortValues => {
    spawnerNode.evaluate(makeCtx(w, { tick: tick++, nodeId }), { spawn: false }, params, state);
    return spawnerNode.evaluate(makeCtx(w, { tick: tick++, nodeId }), { spawn: true, ...inputs }, params, state);
  };
  return { w, params, fire };
}

/** Class, colour and mass of `n` objects made one after the other. */
function batch(over: Params, n = 40, nodeId = 'maker') {
  const { w, fire } = setup({ randomClass: 'yes', classSeed: 9, ...over }, nodeId);
  return Array.from({ length: n }, () => {
    const out = fire();
    const id = out.lastSpawned as string;
    return { cls: out.lastClass as number, outMass: out.lastMass as number, color: w.getEntity(id)!.color, mass: w.materialOf(id)!.massKg };
  });
}

describe('spawner random classes: off', () => {
  it('is off on new cards and on cards saved before the setting, and then nothing about the object changes', () => {
    expect(spawnerNode.params.find((p) => p.id === 'randomClass')).toMatchObject({ default: 'no', advanced: true });
    expect(spawnerNode.params.find((p) => p.id === 'randomClass')!.legacyDefault).toBeUndefined();
    const { w, fire } = setup({ color: '#123456', mass: 4, class1Color: '#000000', class1Mass: 77, classCount: 2, classSeed: 3 });
    const out = fire();
    const made = w.getEntity(out.lastSpawned as string)!;
    expect(made.color).toBe('#123456');
    expect(w.materialOf(made.id)!.massKg).toBe(4);
    expect([out.lastClass, out.lastMass]).toEqual([0, 0]);
  });

  it('hides the class outputs and every class setting', () => {
    const off = defaultParams(spawnerNode);
    expect(activeOutputs(spawnerNode, off).map((p) => p.id)).toEqual(['lastSpawned', 'count', 'spawned', 'touched']);
    const classRows = spawnerNode.params.filter((p) => /^class/.test(p.id));
    expect(classRows).toHaveLength(14);
    for (const p of classRows) {
      expect(p.advanced, p.id).toBe(true);
      expect(p.shownWhen?.(off), p.id).toBe(false);
    }
  });
});

describe('spawner random classes: on', () => {
  it('shows the two outputs and only the rows of the classes in use', () => {
    const shown = (params: Params) => spawnerNode.params.filter((p) => /^class\d/.test(p.id) && p.shownWhen?.(params) !== false).map((p) => p.id);
    expect(activeOutputs(spawnerNode, { randomClass: 'yes' }).map((p) => p.label).slice(-2)).toEqual(['Loại vừa sinh', 'Khối lượng vừa sinh']);
    expect(shown({ randomClass: 'yes' })).toEqual(['class1Color', 'class1Mass', 'class2Color', 'class2Mass', 'class3Color', 'class3Mass']);
    expect(shown({ randomClass: 'yes', classCount: 6 })).toHaveLength(12);
    expect(shown({ randomClass: 'yes', classCount: 99 })).toHaveLength(12);
    expect(shown({ randomClass: 'yes', classCount: 0 })).toHaveLength(4);
    expect(spawnerNode.params.filter((p) => /^class\dColor$/.test(p.id)).map((p) => [p.label, p.default])).toEqual(COLORS.map((c, k) => [`Màu loại ${k + 1}`, c]));
    expect(spawnerNode.params.find((p) => p.id === 'class4Mass')).toMatchObject({ label: 'Khối lượng loại 4 (kg)', default: 4 });
  });

  it('each object takes the colour and mass of its class, and the outputs say which', () => {
    const made = batch({ classCount: 3, class1Mass: 1, class2Mass: 3, class3Mass: 6 });
    const masses = [1, 3, 6];
    for (const m of made) {
      expect(m.cls).toBeGreaterThanOrEqual(1);
      expect(m.cls).toBeLessThanOrEqual(3);
      expect(m.color).toBe(COLORS[m.cls - 1]);
      expect(m.mass).toBe(masses[m.cls - 1]);
      expect(m.outMass).toBe(m.mass);
    }
    expect(new Set(made.map((m) => m.cls)).size).toBe(3);
  });

  it('the same seed repeats the same classes; another seed or another card id gives another order', () => {
    const order = (over: Params, id?: string) => batch(over, 40, id).map((m) => m.cls).join('');
    expect(order({})).toBe(order({}));
    expect(order({ classSeed: 10 })).not.toBe(order({}));
    expect(order({}, 'other-card')).not.toBe(order({}));
  });

  it('seed 0 follows the seed of the run', () => {
    const classes = (runSeed: number): string => {
      const w = createWorld('2d-side' as ViewMode);
      w.runSeed = () => runSeed;
      const params = defaultParams(spawnerNode, { lifetime: 0, maxAlive: 50, randomClass: 'yes', classSeed: 0 });
      const state = spawnerNode.create!(makeCtx(w), params);
      let out = '';
      for (let t = 0; t < 60; t++) out += String(spawnerNode.evaluate(makeCtx(w, { tick: t }), { spawn: t % 2 === 1 }, params, state).lastClass);
      return out;
    };
    expect(classes(111)).toBe(classes(111));
    expect(classes(111)).not.toBe(classes(222));
  });

  it('every class in use comes up about equally often, up to six', () => {
    for (const count of [2, 6]) {
      const made = batch({ classCount: count, maxAlive: 50, lifetime: 0.01 }, 3000);
      const seen = Array.from({ length: count }, (_, k) => made.filter((m) => m.cls === k + 1).length);
      expect(seen.reduce((a, b) => a + b, 0)).toBe(3000);
      for (const n of seen) expect(Math.abs(n - 3000 / count)).toBeLessThan((3000 / count) * 0.15);
    }
  });

  it('class mass 0 means by kind, a wired mass still wins, and a spawn that does not happen draws nothing', () => {
    const byKind = batch({ template: 'block', classCount: 2, class1Mass: 0, class2Mass: 0 }, 4);
    expect(byKind.map((m) => m.mass)).toEqual([10, 10, 10, 10]);
    const wiredRun = setup({ randomClass: 'yes', classSeed: 9, wireMaterial: 'yes' });
    const out = wiredRun.fire({ mass: 42 });
    expect([wiredRun.w.materialOf(out.lastSpawned as string)!.massKg, out.lastMass]).toEqual([42, 42]);

    const free = batch({}, 6).map((m) => m.cls);
    const capped = setup({ randomClass: 'yes', classSeed: 9, maxAlive: 1 });
    const first = capped.fire().lastClass;
    for (let n = 0; n < 5; n++) expect(capped.fire().lastClass).toBe(first);
    expect(first).toBe(free[0]);
  });

  it('a scale reads the class mass of a spawned crate', () => {
    const { w, fire } = setup({ randomClass: 'yes', classSeed: 9, classCount: 2, class1Mass: 5, class2Mass: 8, position: { x: 0, y: 1.5, z: 0 } });
    const scale = w.spawn({ kind: 'block', ownerNodeId: 'b', position: { x: 0, y: 0.5, z: 0 }, size: { x: 6, y: 0.4, z: 1 }, color: '#fff', solid: true });
    const out = fire();
    for (let i = 0; i < 90; i++) w.step(1 / 60);
    const sensor = forceSensorNode.evaluate(makeCtx(w), { who: scale }, defaultParams(forceSensorNode), forceSensorNode.create!(makeCtx(w), defaultParams(forceSensorNode)));
    expect(sensor.mass).toBe(out.lastMass);
    expect([5, 8]).toContain(sensor.mass);
  });
});

describe('what "Đọc màu" sees of a spawned object when it looks ahead from "Đối tượng"', () => {
  /** A viewer block looking along +x at whatever the spawner drops one unit in front of it. */
  function seenIndex(template: 'block' | 'item'): { index: number; cls: number; hitKind: string | undefined } {
    const { w, fire } = setup({ template, randomClass: 'yes', classSeed: 9, classCount: 3, position: { x: 1.2, y: 0.5, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 } });
    w.spawn({ kind: 'block', ownerNodeId: 'floor', position: { x: 0, y: -0.5, z: 0 }, size: { x: 12, y: 1, z: 1 }, color: '#777777', solid: true });
    const viewer = w.spawn({ kind: 'character', ownerNodeId: 'viewer', position: { x: 0, y: 0.5, z: 0 }, size: { x: 0.6, y: 1, z: 0.6 }, color: '#ffffff', solid: true });
    const out = fire();
    for (let i = 0; i < 30; i++) w.step(1 / 60);
    const params = defaultParams(colorSensorNode, { where: 'ahead', reach: 3 });
    const read = colorSensorNode.evaluate(makeCtx(w), { who: viewer }, params, undefined);
    const hit = w.probeAhead(viewer, 3);
    return { index: read.index as number, cls: out.lastClass as number, hitKind: hit ? w.getEntity(hit.id)?.kind : undefined };
  }

  it('a spawned Vật thể (block) is read: the colour index is its class for classes 1 to 3', () => {
    const r = seenIndex('block');
    expect(r.hitKind).toBe('block');
    expect(r.index).toBe(r.cls);
  });

  it('a spawned Đồ vật (item) is not read this way: looking ahead only finds blocks (it is read through "Vật cần đọc")', () => {
    const r = seenIndex('item');
    expect(r.index).toBe(0);
  });

  it('the sensor knows as many colours as the spawner has classes', () => {
    expect(getNodeDef('color-sensor')!.params.filter((p) => /^color\d$/.test(p.id))).toHaveLength(6);
  });
});
