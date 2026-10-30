import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { ITEM_SHAPES, type EntityView, type HudItem, type ItemShape } from '../../src/engine/types';
import { floatingLabels } from '../../src/render/floating-labels';
import { IN_HAND_SCALE, buildItem, liesFlat } from '../../src/render/item-shapes';
import { ITEM_PACK } from '../../src/render/pack-model-table';
import { pickVariant, setPackTemplateForTests } from '../../src/render/pack-models';
import { SceneView } from '../../src/render/scene-view';

function item(shape: ItemShape, y = 0.3, size = 0.6): EntityView {
  return {
    id: 'i1',
    kind: 'item',
    ownerNodeId: 'n1',
    position: { x: 2, y, z: 0 },
    size: { x: size, y: size, z: size },
    color: '#888888',
    shape,
    visible: true,
  };
}

function bounds(view: SceneView): THREE.Box3 {
  view.scene.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(view.scene);
}

describe('item shapes', () => {
  it('builds every shape, including the padlock', () => {
    expect(ITEM_SHAPES).toContain('lock');
    for (const shape of ITEM_SHAPES) {
      const fig = buildItem(shape, '#ff8800');
      expect(fig.object.children.length).toBeGreaterThan(0);
      fig.dispose();
    }
  });

  it('draws hand tools smaller than their ground size', () => {
    expect(IN_HAND_SCALE).toBeCloseTo(0.65, 5);
    expect(liesFlat('pickaxe')).toBe(true);
    expect(liesFlat('lock')).toBe(false);
    expect(liesFlat('crate')).toBe(false);
  });
});

describe('tools on the ground', () => {
  it('lie flat (wider than tall) and rest exactly on the floor without sinking', () => {
    for (const shape of ['sword', 'pickaxe', 'hammer', 'torch', 'wand'] as const) {
      const view = new SceneView();
      view.sync([item(shape)]);
      const box = bounds(view);
      const size = box.getSize(new THREE.Vector3());
      expect(size.x, shape).toBeGreaterThan(size.y * 1.5);
      expect(box.min.y, shape).toBeCloseTo(0, 5); // entity bottom = 0.3 - 0.3
      view.dispose();
    }
  });

  it('keeps non-tool items upright and centered on the entity', () => {
    const view = new SceneView();
    view.sync([item('crate')]);
    const box = bounds(view);
    expect(box.min.y).toBeCloseTo(0, 1);
    expect(box.getSize(new THREE.Vector3()).y).toBeGreaterThan(0.55);
    view.dispose();
  });
});

/** A stand-in pack model: x:y:z = 2:1:1, bottom on y=0. */
function fakeModel(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), new THREE.MeshBasicMaterial());
  m.position.y = 0.5;
  g.add(m);
  return g;
}

describe('pack items', () => {
  afterEach(() => setPackTemplateForTests(null));
  const packShapes = Object.keys(ITEM_PACK) as ItemShape[];
  const worldBox = (shape: ItemShape, size: { x: number; y: number; z: number }): THREE.Box3 => {
    const view = new SceneView();
    view.sync([{ ...item(shape, 0.5), size }]);
    view.sync([{ ...item(shape, 0.5), size }]);
    const box = bounds(view);
    view.dispose();
    return box;
  };

  it('covers every shape that has a pool and keeps the tools out of it', () => {
    expect(packShapes.sort()).toEqual(['ball', 'bucket', 'crate', 'key', 'ore', 'veggie']);
    for (const tool of ['sword', 'pickaxe', 'hammer', 'torch', 'wand', 'lock', 'box'] as const) expect(ITEM_PACK[tool]).toBeUndefined();
  });

  it('shows a box in the entity colour until the model is loaded', () => {
    const view = new SceneView();
    view.sync([{ ...item('crate', 0.5, 1), size: { x: 1, y: 1, z: 1 } }]);
    const box = bounds(view);
    expect(box.getSize(new THREE.Vector3()).x).toBeCloseTo(1, 5);
    view.dispose();
  });

  it('uses the model picked from the pool for the seed', () => {
    const pool = ITEM_PACK.crate!;
    const seed = 'n1|i1';
    const chosen = pickVariant(pool.models, `crate|${seed}`);
    setPackTemplateForTests(chosen, fakeModel());
    const box = worldBox('crate', { x: 1, y: 1, z: 1 });
    // The injected model is 2:1:1; a fit inside a unit box makes it 1 wide, 0.5 tall.
    expect(box.getSize(new THREE.Vector3()).y).toBeCloseTo(0.5, 5);
    expect(box.getSize(new THREE.Vector3()).x).toBeCloseTo(1, 5);
  });

  it('keeps proportions and rests on the floor for a non-cubic entity size', () => {
    for (const path of ITEM_PACK.crate!.models) setPackTemplateForTests(path, fakeModel());
    const box = worldBox('crate', { x: 0.6, y: 1.2, z: 0.4 });
    const s = box.getSize(new THREE.Vector3());
    expect(s.x / s.y).toBeCloseTo(2, 4);
    expect(s.z / s.y).toBeCloseTo(1, 4);
    expect(s.x).toBeLessThanOrEqual(0.6 + 1e-6);
    expect(s.z).toBeLessThanOrEqual(0.4 + 1e-6);
    expect(box.min.y).toBeCloseTo(0.5 - 0.6, 5); // entity bottom
  });

  it('builds in the unit cube for a hand and swaps in the model when it arrives', () => {
    const path = pickVariant(ITEM_PACK.bucket!.models, 'bucket|');
    const fig = buildItem('bucket', '#888888');
    fig.object.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(fig.object).getSize(new THREE.Vector3()).y).toBeCloseTo(1, 5);
    setPackTemplateForTests(path, fakeModel());
    fig.object.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(fig.object).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(1, 5);
    expect(size.y).toBeCloseTo(0.5, 5);
    fig.dispose();
  });

  it('leaves code-drawn tools without a layout hook', () => {
    expect(buildItem('sword', '#ff8800').update).toBeUndefined();
    expect(buildItem('crate', '#ff8800').update).toBeTypeOf('function');
  });
});

describe('floating labels', () => {
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  camera.position.set(0, 0, 20);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const target = item('lock', 0.3);
  const text: HudItem = { key: 'a', label: '', value: 0, corner: 'top-left', text: 'Bấm F để mở', anchor: 'i1' };
  const get = (id: string): EntityView | undefined => (id === 'i1' ? target : undefined);

  it('puts the label just above the entity', () => {
    const [label] = floatingLabels([text], get, camera, 200, 200);
    expect(label?.text).toBe('Bấm F để mở');
    expect(label?.x).toBeCloseTo(120, 3); // world x=2 on a 20-wide view
    expect(label!.y).toBeLessThan(100); // above the centre line (y=0.3 is slightly above 0, label higher)
  });

  it('skips hidden items, missing or hidden entities and corner texts', () => {
    expect(floatingLabels([{ ...text, hidden: true }], get, camera, 200, 200)).toEqual([]);
    expect(floatingLabels([{ ...text, anchor: 'gone' }], get, camera, 200, 200)).toEqual([]);
    expect(floatingLabels([text], () => ({ ...target, visible: false }), camera, 200, 200)).toEqual([]);
    const { anchor: _anchor, ...corner } = text;
    expect(floatingLabels([corner], get, camera, 200, 200)).toEqual([]);
  });
});
