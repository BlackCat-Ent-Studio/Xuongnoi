import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type ViewMode, type World } from '../../src/engine/types';
import { cargoNode } from '../../src/nodes/cargo';
import { vehicleSize } from '../../src/world/vehicles';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx } from './fake-world';

const MODES: ViewMode[] = ['2d-side', '2d-top', '3d'];

function floor(w: World): void {
  w.spawn({ kind: 'block', ownerNodeId: 'floor', position: { x: 0, y: -0.5, z: 0 }, size: { x: 200, y: 1, z: w.mode === '2d-side' ? 1 : 200 }, color: '#888', solid: true });
}
function truck(w: World): EntityId {
  return w.spawn({
    kind: 'vehicle',
    ownerNodeId: 'truck',
    position: { x: 0, y: vehicleSize('truck').y / 2, z: 0 },
    size: vehicleSize('truck'),
    color: '#f00',
    solid: true,
    vehicle: { model: 'truck', steerMode: 'direction', maxSpeed: 8, accel: 8 },
  });
}
function goods(w: World, x: number, tag?: string): EntityId {
  return w.spawn({ kind: 'item', ownerNodeId: 'g', position: { x, y: 0.25, z: 0 }, size: { x: 0.5, y: 0.5, z: 0.5 }, color: '#a60', solid: false, ...(tag !== undefined ? { tag } : {}) });
}

function rig(w: World, vehicle: EntityId, over: Record<string, string | number> = {}) {
  const params = defaultParams(cargoNode, over);
  const state = cargoNode.create!(makeCtx(w), params);
  let tick = 0;
  const step = (inputs: { load?: boolean; unload?: boolean; unloadAll?: boolean } = {}) => {
    const out = cargoNode.evaluate(makeCtx(w, { tick: tick++ }), { vehicle, ...inputs }, params, state);
    w.step(TICK_DT);
    return out;
  };
  const press = (key: 'load' | 'unload' | 'unloadAll') => {
    const out = step({ [key]: true });
    step({});
    return out;
  };
  return { step, press };
}

describe('world goods type', () => {
  it('reports the spawn tag and an empty string otherwise', () => {
    const w = createWorld('3d');
    expect(w.tagOf(goods(w, 3, 'rau'))).toBe('rau');
    expect(w.tagOf(goods(w, 4))).toBe('');
    expect(w.tagOf('missing')).toBe('');
  });
});

describe.each(MODES)('cargo types (%s)', (mode) => {
  function loaded(over: Record<string, string | number> = {}) {
    const w = createWorld(mode);
    floor(w);
    const t = truck(w);
    const ids = { ore1: goods(w, 2.2, 'quặng'), veg: goods(w, 2.4, 'rau'), ore2: goods(w, 2.6, 'quặng') };
    const r = rig(w, t, over);
    for (let i = 0; i < 3; i++) r.press('load');
    return { w, t, r, ...ids };
  }

  it('unloads the top-most item of the chosen type, leaving the rest', () => {
    const { w, t, r, ore1, veg } = loaded({ unloadType: 'quặng' });
    expect(w.cargoOf(t)).toHaveLength(3);
    const out = r.press('unload');
    expect(out).toMatchObject({ unloaded: true, count: 2, typeCount: 1, top: ore1 });
    expect(w.cargoOf(t)).toEqual([ore1, veg]);
  });

  it('does nothing when no loaded item has that type', () => {
    const { w, t, r } = loaded({ unloadType: 'thùng' });
    expect(r.press('unload')).toMatchObject({ unloaded: false, typeCount: 0, top: null });
    expect(w.cargoOf(t)).toHaveLength(3);
  });

  it('keeps the old behaviour with an empty type: top item, all counts', () => {
    const { w, t, r, ore2 } = loaded();
    expect(r.step({})).toMatchObject({ count: 3, typeCount: 3, top: ore2 });
    expect(r.press('unload')).toMatchObject({ unloaded: true });
    expect(w.cargoOf(t)).toHaveLength(2);
    expect(w.cargoOf(t)).not.toContain(ore2);
  });

  it('unload-all only removes the chosen type', () => {
    const { w, t, r, veg } = loaded({ unloadType: 'quặng' });
    expect(r.press('unloadAll')).toMatchObject({ unloaded: true });
    expect(w.cargoOf(t)).toEqual([veg]);
  });

  it('loads only items of the load type, skipping nearer ones of another type', () => {
    const w = createWorld(mode);
    floor(w);
    const t = truck(w);
    goods(w, 2.2, 'quặng');
    const veg = goods(w, 2.8, 'rau');
    const r = rig(w, t, { loadType: 'rau' });
    expect(r.press('load')).toMatchObject({ loaded: true, count: 1 });
    expect(w.cargoOf(t)).toEqual([veg]);
    expect(r.press('load')).toMatchObject({ loaded: false, count: 1 });
  });
});

describe('cargo node ports', () => {
  it('adds the type count output and keeps the old ones', () => {
    expect(cargoNode.outputs.map((p) => p.id)).toEqual(['count', 'loaded', 'unloaded', 'top', 'typeCount']);
    expect(cargoNode.params.filter((p) => p.kind === 'text').map((p) => p.id)).toEqual(['loadType', 'unloadType']);
  });
});
