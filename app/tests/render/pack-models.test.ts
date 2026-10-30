import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { BLOCK_PACK, ITEM_PACK, VEHICLE_PACK } from '../../src/render/pack-model-table';
import {
  FOOTPRINT_MAX_HEIGHT,
  MAX_TILES,
  PackSlot,
  fitPlacement,
  pickVariant,
  setPackTemplateForTests,
  tilePlacements,
  type Bounds3,
  type Placement,
} from '../../src/render/pack-models';

const bounds = (x: number, y: number, z: number, minY = 0): Bounds3 => ({
  min: { x: -x / 2, y: minY, z: -z / 2 },
  max: { x: x / 2, y: minY + y, z: z / 2 },
});

/** World-space box covered by one placed copy of a model with the given bounds. */
function covered(b: Bounds3, p: Placement): THREE.Box3 {
  const o = new THREE.Object3D();
  o.position.set(p.position.x, p.position.y, p.position.z);
  o.rotation.set(0, p.rotationY, 0);
  o.scale.set(p.scale.x, p.scale.y, p.scale.z);
  o.updateMatrixWorld(true);
  return new THREE.Box3(new THREE.Vector3(b.min.x, b.min.y, b.min.z), new THREE.Vector3(b.max.x, b.max.y, b.max.z)).applyMatrix4(o.matrixWorld);
}

describe('pack model table', () => {
  it('every pool has models with .glb paths and no duplicates', () => {
    for (const table of [BLOCK_PACK, VEHICLE_PACK, ITEM_PACK]) {
      for (const pool of Object.values(table)) {
        expect(pool.models.length).toBeGreaterThan(0);
        expect(new Set(pool.models).size).toBe(pool.models.length);
        for (const m of pool.models) expect(m).toMatch(/^(Exteriors|Islands)\/[A-Za-z]+\/[\w]+\.glb$/);
      }
    }
  });

  it('keeps code-drawn looks for things the pack has no model for', () => {
    expect(BLOCK_PACK.box).toBeUndefined();
    expect(BLOCK_PACK.sign).toBeUndefined();
    expect(BLOCK_PACK.conveyor).toBeUndefined();
    expect(BLOCK_PACK.rail).toBeUndefined();
    expect(VEHICLE_PACK.locomotive).toBeUndefined();
    expect(VEHICLE_PACK.wagon).toBeUndefined();
    for (const tool of ['sword', 'pickaxe', 'hammer', 'torch', 'wand', 'lock', 'box'] as const) expect(ITEM_PACK[tool]).toBeUndefined();
  });
});

describe('pickVariant', () => {
  const pool = ['a', 'b', 'c', 'd', 'e'];
  it('is stable for a seed and spreads over the pool', () => {
    expect(pickVariant(pool, 'node-17')).toBe(pickVariant(pool, 'node-17'));
    const seen = new Set(Array.from({ length: 60 }, (_, i) => pickVariant(pool, `n${i}`)));
    expect(seen.size).toBe(pool.length);
  });
});

describe('fitPlacement', () => {
  const box = { x: 4, y: 3, z: 4 };
  it('footprint fills the floor and sits on the box bottom, centred', () => {
    const b = bounds(2, 1, 1, 0.5);
    const c = covered(b, fitPlacement(b, box, 'footprint'));
    expect(c.min.y).toBeCloseTo(-box.y / 2);
    expect(c.max.x - c.min.x).toBeCloseTo(4);
    expect((c.min.x + c.max.x) / 2).toBeCloseTo(0);
    expect((c.min.z + c.max.z) / 2).toBeCloseTo(0);
  });
  it('footprint caps the height of tall models', () => {
    const b = bounds(1, 20, 1);
    const c = covered(b, fitPlacement(b, box, 'footprint'));
    expect(c.max.y - c.min.y).toBeCloseTo(box.y * FOOTPRINT_MAX_HEIGHT);
  });
  it('stand matches the box height; inside never leaves the box', () => {
    const b = bounds(3, 4, 1);
    const stand = covered(b, fitPlacement(b, { x: 0.8, y: 3.6, z: 0.8 }, 'stand'));
    expect(stand.max.y - stand.min.y).toBeCloseTo(3.6);
    const inside = covered(b, fitPlacement(b, box, 'inside'));
    expect(inside.max.x - inside.min.x).toBeLessThanOrEqual(box.x + 1e-9);
    expect(inside.max.y - inside.min.y).toBeLessThanOrEqual(box.y + 1e-9);
  });
});

describe('tilePlacements', () => {
  function union(b: Bounds3, ps: Placement[]): THREE.Box3 {
    return ps.reduce((acc, p) => acc.union(covered(b, p)), new THREE.Box3());
  }
  it('lays copies along the long side and covers the whole box', () => {
    const road = bounds(17.6, 0.2, 11.2);
    const box = { x: 86, y: 0.04, z: 8 };
    const ps = tilePlacements(road, box);
    expect(ps.length).toBeGreaterThan(1);
    const u = union(road, ps);
    expect(u.min.x).toBeCloseTo(-43);
    expect(u.max.x).toBeCloseTo(43);
    expect(u.min.z).toBeCloseTo(-4);
    expect(u.max.z).toBeCloseTo(4);
    expect(u.min.y).toBeCloseTo(-0.02);
    expect(u.max.y).toBeCloseTo(0.02);
  });
  it('turns a model whose long side runs the other way', () => {
    const fence = bounds(3.7, 0.8, 0.2);
    const ps = tilePlacements(fence, { x: 0.4, y: 1.4, z: 5 });
    expect(ps[0]?.rotationY).toBeCloseTo(Math.PI / 2);
    const u = union(fence, ps);
    expect(u.max.x - u.min.x).toBeCloseTo(0.4);
    expect(u.max.z - u.min.z).toBeCloseTo(5);
  });
  it('uses a grid when a tile size is given, capped', () => {
    const slab = bounds(3, 0.6, 8.7);
    expect(tilePlacements(slab, { x: 18, y: 0.08, z: 18 }, 3).length).toBeGreaterThan(6);
    expect(tilePlacements(slab, { x: 500, y: 0.08, z: 500 }, 0.5).length).toBeLessThanOrEqual(MAX_TILES);
  });
});

describe('PackSlot', () => {
  afterEach(() => setPackTemplateForTests(null));
  it('shows the placeholder until the model is there, then places copies tagged with the owner', () => {
    const placeholder = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const slot = new PackSlot('Exteriors/City/Test_1.glb', { place: 'tile', models: [] }, placeholder, 'n-1');
    slot.layout({ x: 2, y: 1, z: 10 });
    expect(slot.ready).toBe(false);
    expect(slot.object.children).toContain(placeholder);
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2)));
    setPackTemplateForTests('Exteriors/City/Test_1.glb', model);
    expect(slot.ready).toBe(true);
    expect(slot.object.children).not.toContain(placeholder);
    let meshes = 0;
    slot.object.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        meshes++;
        expect(o.userData.ownerNodeId).toBe('n-1');
      }
    });
    // Five tiles baked into one mesh that still spans the whole box.
    expect(meshes).toBe(1);
    const span = new THREE.Box3().setFromObject(slot.object);
    expect(span.max.z - span.min.z).toBeCloseTo(10);
    expect(span.max.x - span.min.x).toBeCloseTo(2);
    slot.dispose();
  });
});
