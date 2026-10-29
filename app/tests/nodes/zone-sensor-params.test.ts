import { describe, expect, it } from 'vitest';
import type { EntityId, EntityKind, EntityView, Params, Vec3, ViewMode } from '../../src/engine/types';
import { zoneSensorNode } from '../../src/nodes/zone-sensor';
import { defaultParams, makeCtx, makeWorld, type FakeWorld } from './fake-world';

const MODES: ViewMode[] = ['2d-side', '2d-top', '3d'];

function setup(mode: ViewMode, over: Params = {}) {
  const w = makeWorld();
  (w as { mode: ViewMode }).mode = mode;
  const params = defaultParams(zoneSensorNode, { center: { x: 0, y: 0, z: 0 }, size: { x: 4, y: 4, z: 4 }, filter: 'item', ...over });
  const state = zoneSensorNode.create!(makeCtx(w), params);
  const read = (follow?: EntityId | null) => zoneSensorNode.evaluate(makeCtx(w), follow === undefined ? {} : { follow }, params, state);
  return { w, read };
}

function put(w: FakeWorld, kind: EntityKind, position: Vec3, size: Vec3, tag?: string, patch: Partial<EntityView> = {}): EntityId {
  const id = w.spawn({ kind, ownerNodeId: 'x', position, size, color: '#fff', solid: false, ...(tag !== undefined ? { tag } : {}) });
  w.entities.set(id, { ...w.entities.get(id)!, ...patch });
  return id;
}
const box = (s: number): Vec3 => ({ x: s, y: s, z: s });

describe('zone sensor params: defaults', () => {
  it('declares the new params with neutral defaults', () => {
    const d = defaultParams(zoneSensorNode);
    expect(d).toMatchObject({ rotate: 'no', goods: '', rule: 'touch', minCount: 1 });
  });

  it.each(MODES)('keeps the plain overlap test and count>0 output (%s)', (mode) => {
    const { w, read } = setup(mode);
    const a = put(w, 'item', { x: 2.4, y: 0, z: 0 }, box(1)); // overlaps the edge (2.4 < 2.5)
    put(w, 'item', { x: 2.6, y: 0, z: 0 }, box(1)); // just outside
    const out = read();
    expect(out).toMatchObject({ inside: true, entered: true, exited: false, count: 1, first: a });
    expect(read()).toMatchObject({ entered: false });
  });
});

describe('zone sensor params: goods filter', () => {
  it.each(MODES)('counts only the matching goods tag (%s)', (mode) => {
    const { w, read } = setup(mode, { goods: 'gạo' });
    put(w, 'item', { x: 0, y: 0, z: 0 }, box(1), 'than');
    put(w, 'item', { x: 0.5, y: 0, z: 0 }, box(1));
    expect(read()).toMatchObject({ inside: false, count: 0 });
    const rice = put(w, 'item', { x: -0.5, y: 0, z: 0 }, box(1), 'gạo');
    expect(read()).toMatchObject({ inside: true, count: 1, first: rice });
  });

  it('empty filter counts everything', () => {
    const { w, read } = setup('3d');
    put(w, 'item', { x: 0, y: 0, z: 0 }, box(1), 'a');
    put(w, 'item', { x: 0.5, y: 0, z: 0 }, box(1));
    expect(read().count).toBe(2);
  });
});

describe('zone sensor params: when to count', () => {
  // Zone is 4 wide, spanning -2..2 on every axis. Items are 1 wide.
  it.each(MODES)('centre rule needs the middle inside the zone (%s)', (mode) => {
    const { w, read } = setup(mode, { rule: 'center' });
    put(w, 'item', { x: 2.4, y: 0, z: 0 }, box(1)); // edge-touching but centre outside
    expect(read().count).toBe(0);
    put(w, 'item', { x: 1.9, y: 0, z: 0 }, box(1));
    expect(read().count).toBe(1);
  });

  it.each(MODES)('inside rule needs the whole box within the zone (%s)', (mode) => {
    const { w, read } = setup(mode, { rule: 'inside' });
    put(w, 'item', { x: 1.6, y: 0, z: 0 }, box(1)); // sticks out past 2
    expect(read().count).toBe(0);
    put(w, 'item', { x: 1.5, y: 0, z: 0 }, box(1)); // exactly flush
    expect(read().count).toBe(1);
  });

  it('flat views skip the unused axis for every rule', () => {
    for (const rule of ['touch', 'center', 'inside']) {
      const top = setup('2d-top', { rule });
      put(top.w, 'item', { x: 0, y: 50, z: 0 }, box(1));
      expect(top.read().count, `2d-top ${rule}`).toBe(1);
      const side = setup('2d-side', { rule });
      put(side.w, 'item', { x: 0, y: 0, z: 50 }, box(1));
      expect(side.read().count, `2d-side ${rule}`).toBe(1);
      const full = setup('3d', { rule });
      put(full.w, 'item', { x: 0, y: 50, z: 0 }, box(1));
      expect(full.read().count, `3d ${rule}`).toBe(0);
    }
  });
});

describe('zone sensor params: minimum count', () => {
  it.each(MODES)('only reports inside once enough objects are in (%s)', (mode) => {
    const { w, read } = setup(mode, { minCount: 3 });
    put(w, 'item', { x: 0, y: 0, z: 0 }, box(1));
    put(w, 'item', { x: 0.2, y: 0, z: 0 }, box(1));
    expect(read()).toMatchObject({ inside: false, entered: false, count: 2 });
    const third = put(w, 'item', { x: 0.4, y: 0, z: 0 }, box(1));
    expect(read()).toMatchObject({ inside: true, entered: true, count: 3 });
    expect(read()).toMatchObject({ inside: true, entered: false });
    w.entities.set(third, { ...w.entities.get(third)!, visible: false });
    expect(read()).toMatchObject({ inside: false, exited: true, count: 2 });
  });

  it('clamps nonsense values to 1..50', () => {
    const { w, read } = setup('3d', { minCount: -4 });
    put(w, 'item', { x: 0, y: 0, z: 0 }, box(1));
    expect(read().inside).toBe(true);
    const big = setup('3d', { minCount: 999 });
    for (let i = 0; i < 50; i++) put(big.w, 'item', { x: 0, y: 0, z: 0 }, box(0.1));
    expect(big.read().inside).toBe(true);
  });
});

describe('zone sensor params: rotate with followed object', () => {
  const longZone = { center: { x: 3, y: 0, z: 0 }, size: { x: 2, y: 4, z: 2 }, filter: 'item' };

  it('vehicle heading turns the offset and the box (3d)', () => {
    const { w, read } = setup('3d', { ...longZone, rotate: 'yes' });
    const car = put(w, 'vehicle', { x: 0, y: 0, z: 0 }, box(1), undefined, {
      vehicle: { model: 'truck', speed: 0, wheelSpin: 0, heading: Math.PI / 2, driver: null },
    });
    const front = put(w, 'item', { x: 0, y: 0, z: 3 }, box(0.5)); // heading +Z, offset 3 ahead
    put(w, 'item', { x: 3, y: 0, z: 0 }, box(0.5)); // where an unrotated zone would be
    expect(read(car)).toMatchObject({ count: 1, first: front });
  });

  it('box is oriented, not just moved (3d)', () => {
    // Zone 6 long (ahead) x 1 wide; heading +Z. A thing 2.5 ahead and 0.2 aside is in; 0.2 ahead and 2.5 aside is out.
    const { w, read } = setup('3d', { center: { x: 0, y: 0, z: 0 }, size: { x: 6, y: 4, z: 1 }, filter: 'item', rotate: 'yes' });
    const car = put(w, 'vehicle', { x: 0, y: 0, z: 0 }, box(1), undefined, {
      vehicle: { model: 'truck', speed: 0, wheelSpin: 0, heading: Math.PI / 2, driver: null },
    });
    const ahead = put(w, 'item', { x: 0.2, y: 0, z: 2.5 }, box(0.2));
    put(w, 'item', { x: 2.5, y: 0, z: 0.2 }, box(0.2));
    expect(read(car)).toMatchObject({ count: 1, first: ahead });
  });

  it('character facing turns the zone (2d-top)', () => {
    const { w, read } = setup('2d-top', { ...longZone, rotate: 'yes' });
    const p = put(w, 'character', { x: 0, y: 0, z: 0 }, box(1), undefined, { facing: { x: 0, z: -1 } });
    const behindFacing = put(w, 'item', { x: 0, y: 0, z: -3 }, box(0.5));
    expect(read(p)).toMatchObject({ count: 1, first: behindFacing });
  });

  it('is off by default and ignored when nothing is followed', () => {
    const off = setup('3d', longZone);
    const car = put(off.w, 'vehicle', { x: 0, y: 0, z: 0 }, box(1), undefined, {
      vehicle: { model: 'truck', speed: 0, wheelSpin: 0, heading: Math.PI / 2, driver: null },
    });
    const east = put(off.w, 'item', { x: 3, y: 0, z: 0 }, box(0.5));
    expect(off.read(car).first).toBe(east);

    const on = setup('3d', { ...longZone, rotate: 'yes' });
    const east2 = put(on.w, 'item', { x: 3, y: 0, z: 0 }, box(0.5));
    expect(on.read(null).first).toBe(east2);
    expect(on.read().first).toBe(east2);
  });

  it('2d-side ignores the rotation', () => {
    const { w, read } = setup('2d-side', { ...longZone, rotate: 'yes' });
    const car = put(w, 'vehicle', { x: 0, y: 0, z: 0 }, box(1), undefined, {
      vehicle: { model: 'truck', speed: 0, wheelSpin: 0, heading: Math.PI / 2, driver: null },
    });
    const east = put(w, 'item', { x: 3, y: 0, z: 0 }, box(0.5));
    expect(read(car).first).toBe(east);
  });

  it('combines with the centre rule on the rotated frame', () => {
    const { w, read } = setup('3d', { center: { x: 3, y: 0, z: 0 }, size: { x: 2, y: 4, z: 2 }, filter: 'item', rotate: 'yes', rule: 'center' });
    const car = put(w, 'vehicle', { x: 0, y: 0, z: 0 }, box(1), undefined, {
      vehicle: { model: 'truck', speed: 0, wheelSpin: 0, heading: Math.PI / 2, driver: null },
    });
    put(w, 'item', { x: 0, y: 0, z: 4.2 }, box(1)); // touches but centre outside
    expect(read(car).count).toBe(0);
    put(w, 'item', { x: 0, y: 0, z: 3.8 }, box(1));
    expect(read(car).count).toBe(1);
  });
});
