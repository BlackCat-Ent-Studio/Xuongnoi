import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ITEM_SHAPES, type EntityView, type HudItem, type ItemShape } from '../../src/engine/types';
import { floatingLabels } from '../../src/render/floating-labels';
import { IN_HAND_SCALE, buildItem, liesFlat } from '../../src/render/item-shapes';
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
