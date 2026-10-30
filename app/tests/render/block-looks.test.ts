import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { BLOCK_STYLES, TRAFFIC_COLORS, blockStyleOf } from '../../src/engine/block-styles';
import type { EntityView } from '../../src/engine/types';
import { buildBlockLook, countMeshes, trafficLampIndex } from '../../src/render/block-looks';
import { buildItem } from '../../src/render/item-shapes';
import { BLOCK_PACK } from '../../src/render/pack-model-table';
import { pickVariant, setPackTemplateForTests } from '../../src/render/pack-models';
import { SceneView } from '../../src/render/scene-view';

const SIZE = { x: 6, y: 2, z: 3 };

function block(id: string, style: string | undefined, color = '#a3a3a3', size = SIZE): EntityView {
  return {
    id,
    kind: 'block',
    ownerNodeId: `n-${id}`,
    position: { x: 0, y: 1, z: 0 },
    size,
    color,
    ...(style ? { blockStyle: style } : {}),
    visible: true,
  };
}

describe('block looks', () => {
  it('falls back to the plain box for unknown styles', () => {
    expect(blockStyleOf(undefined)).toBe('box');
    expect(blockStyleOf('nonsense')).toBe('box');
    expect(blockStyleOf('house')).toBe('house');
  });

  it('builds meshes inside the unit cube for every style', () => {
    for (const style of BLOCK_STYLES) {
      const fig = buildBlockLook(style, '#88aacc', SIZE, 'Chợ');
      expect(countMeshes(fig), style).toBeGreaterThan(0);
      fig.object.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(fig.object);
      // Footprint stays inside the collision box; small decor may rise a little above the top.
      expect(box.min.x, style).toBeGreaterThanOrEqual(-0.51);
      expect(box.max.x, style).toBeLessThanOrEqual(0.51);
      expect(box.min.z, style).toBeGreaterThanOrEqual(-0.51);
      expect(box.max.z, style).toBeLessThanOrEqual(0.51);
      expect(box.min.y, style).toBeGreaterThanOrEqual(-0.51);
      expect(box.max.y, style).toBeLessThanOrEqual(1.2);
      fig.dispose();
    }
  });

  it('handles tiny and elongated sizes without throwing', () => {
    for (const style of BLOCK_STYLES) {
      for (const size of [{ x: 0.1, y: 0.1, z: 0.1 }, { x: 40, y: 0.2, z: 0.5 }, { x: 0.5, y: 3, z: 40 }]) {
        expect(() => buildBlockLook(style, '#ffffff', size)).not.toThrow();
      }
    }
  });

  it('shares geometry between blocks of the same code-drawn style', () => {
    const a = buildBlockLook('rail', '#ff0000', SIZE);
    const b = buildBlockLook('rail', '#00ff00', SIZE);
    const ga = (a.object.children[0] as THREE.Mesh).geometry;
    const gb = (b.object.children[0] as THREE.Mesh).geometry;
    expect(ga).toBe(gb);
  });

  it('re-tints a code-drawn look without rebuilding', () => {
    const fig = buildBlockLook('rail', '#ff0000', SIZE);
    const mesh = fig.object.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
    const before = mesh.material;
    fig.setColor('#0000ff');
    expect(mesh.material).not.toBe(before);
    expect(mesh.material.color.getHexString()).toBe('0000ff');
  });

  it('lights the lamp that matches a colour', () => {
    expect(trafficLampIndex(TRAFFIC_COLORS[0])).toBe(0);
    expect(trafficLampIndex(TRAFFIC_COLORS[1])).toBe(1);
    expect(trafficLampIndex(TRAFFIC_COLORS[2])).toBe(2);
  });
});

/** A model standing on the ground: w wide, h tall, d deep. */
function fakeModel(w: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial());
  m.name = 'pack-model';
  m.position.y = h / 2;
  g.add(m);
  return g;
}

/** Meshes of placed model copies (the fake models, by name). */
const modelsOf = (fig: ReturnType<typeof buildBlockLook>): THREE.Mesh[] => {
  const out: THREE.Mesh[] = [];
  fig.object.traverse((o) => {
    if (o instanceof THREE.Mesh && o.name === 'pack-model') out.push(o);
  });
  return out;
};

describe('pack looks', () => {
  afterEach(() => setPackTemplateForTests(null));

  it('code-drawn styles are exactly those without a pool', () => {
    for (const style of BLOCK_STYLES) {
      expect(['box', 'sign', 'conveyor', 'rail'].includes(style), style).toBe(BLOCK_PACK[style] === undefined);
    }
  });

  it('shows a coloured box until the model arrives, then the model', () => {
    const path = pickVariant(BLOCK_PACK.house?.models ?? [], 'n-a');
    const fig = buildBlockLook('house', '#ff0000', SIZE, '', 'n-a');
    expect(countMeshes(fig)).toBe(1);
    expect(modelsOf(fig)).toHaveLength(0);
    setPackTemplateForTests(path, fakeModel(4, 2, 3));
    expect(modelsOf(fig)).toHaveLength(1);
    expect(countMeshes(fig)).toBe(1);
  });

  it('gives the same model to the same seed and spreads others over the pool', () => {
    const pool = BLOCK_PACK.house?.models ?? [];
    pool.forEach((p, i) => setPackTemplateForTests(p, fakeModel(1 + (i % 5), 2, 1 + (i % 3))));
    const shapeOf = (seed: string): string => {
      const fig = buildBlockLook('house', '#ffffff', SIZE, '', seed);
      const g = modelsOf(fig)[0]?.geometry as THREE.BoxGeometry;
      return `${g.parameters.width}|${g.parameters.depth}`;
    };
    expect(shapeOf('node-1')).toBe(shapeOf('node-1'));
    expect(new Set(Array.from({ length: 30 }, (_, i) => shapeOf(`node-${i}`))).size).toBeGreaterThan(1);
  });

  it('puts the model on the footprint and re-lays it when the block is resized', () => {
    const path = pickVariant(BLOCK_PACK.house?.models ?? [], 'n-h');
    setPackTemplateForTests(path, fakeModel(4, 2, 4));
    const fig = buildBlockLook('house', '#ffffff', { x: 8, y: 2, z: 8 }, '', 'n-h');
    const measure = (size: { x: number; y: number; z: number }): THREE.Box3 => {
      fig.object.scale.set(size.x, size.y, size.z);
      fig.object.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(fig.object);
    };
    let box = measure({ x: 8, y: 2, z: 8 });
    expect(box.max.x - box.min.x).toBeCloseTo(8, 3);
    expect(box.min.y).toBeCloseTo(-1, 3);
    fig.update?.({ ...block('h', 'house'), size: { x: 4, y: 2, z: 4 } });
    box = measure({ x: 4, y: 2, z: 4 });
    expect(box.max.x - box.min.x).toBeCloseTo(4, 3);
    expect(box.min.y).toBeCloseTo(-1, 3);
  });

  it('tiles road copies along a long block', () => {
    const pool = BLOCK_PACK.road?.models ?? [];
    for (const p of pool) setPackTemplateForTests(p, fakeModel(6, 0.2, 3));
    const fig = buildBlockLook('road', '#444444', { x: 30, y: 0.2, z: 3 }, '', 'seed');
    // Five road tiles, baked into one mesh that spans the whole block.
    const meshes = modelsOf(fig);
    expect(meshes).toHaveLength(1);
    const geo = meshes[0]?.geometry;
    geo?.computeBoundingBox();
    expect((geo?.boundingBox?.max.x ?? 0) - (geo?.boundingBox?.min.x ?? 0)).toBeCloseTo(30, 3);
  });

  it('marks every model mesh with the owner node id so clicks pick the block', () => {
    const path = pickVariant(BLOCK_PACK.tree?.models ?? [], 'n-t');
    setPackTemplateForTests(path, fakeModel(1, 3, 1));
    const fig = buildBlockLook('tree', '#00ff00', { x: 1, y: 3, z: 1 }, '', 'n-t');
    const ms = modelsOf(fig);
    expect(ms.length).toBeGreaterThan(0);
    for (const m of ms) expect(m.userData.ownerNodeId).toBe('n-t');
  });

  it('switches the lit lamp of a traffic light with the colour', () => {
    const path = pickVariant(BLOCK_PACK.trafficlight?.models ?? [], 's');
    const fig = buildBlockLook('trafficlight', TRAFFIC_COLORS[0], { x: 0.6, y: 4, z: 0.6 }, '', 's');
    setPackTemplateForTests(path, fakeModel(1.2, 5.7, 1.6));
    const lamps: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
    fig.object.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) lamps.push(o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>);
    });
    expect(lamps).toHaveLength(3);
    const hex = (i: number): string => lamps[i]?.material.color.getHexString() ?? '';
    const full = (i: number): string => new THREE.Color(TRAFFIC_COLORS[i]).getHexString();
    expect(hex(0)).toBe(full(0));
    expect(hex(2)).not.toBe(full(2));
    fig.setColor(TRAFFIC_COLORS[2]);
    expect(hex(2)).toBe(full(2));
    expect(hex(0)).not.toBe(full(0));
    // Lamps sit on the pole inside the block's height, in front of it.
    fig.object.scale.set(0.6, 4, 0.6);
    fig.object.updateMatrixWorld(true);
    for (const lamp of lamps) {
      const p = new THREE.Vector3().setFromMatrixPosition(lamp.matrixWorld);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThanOrEqual(2.01);
      expect(p.z).toBeGreaterThan(0);
    }
  });
});

describe('scene view with styled blocks', () => {
  it('keeps plain boxes as they were and draws styled ones as looks', () => {
    const view = new SceneView();
    view.sync([block('a', undefined), block('b', 'house'), block('c', 'trafficlight', '#ef4444')]);
    expect(view.scene.children.length).toBeGreaterThan(0);
    // Switching the style of an entity swaps its representation.
    view.sync([block('a', 'tree'), block('b', 'house'), block('c', 'trafficlight', '#22c55e')]);
    view.sync([]);
    view.dispose();
  });

  it('only turns shadows on in 3D, and respects the switch-off', () => {
    const view = new SceneView();
    expect(view.shadowsOn).toBe(false);
    view.setMode('3d');
    expect(view.shadowsOn).toBe(true);
    view.setShadowsAllowed(false);
    expect(view.shadowsOn).toBe(false);
    view.setShadowsAllowed(true);
    view.setMode('2d-top');
    expect(view.shadowsOn).toBe(false);
  });

  it('keeps the shadow window on the focus and snaps it to whole texels', () => {
    const view = new SceneView();
    view.setMode('3d');
    view.focusSun({ x: 10.013, y: 0, z: -4.2 }, 30);
    const cam = (view as unknown as { sun: THREE.DirectionalLight }).sun.shadow.camera;
    expect(cam.right).toBe(30);
    const sun = (view as unknown as { sun: THREE.DirectionalLight }).sun;
    expect(Math.abs(sun.target.position.x - 10)).toBeLessThan(0.1);
    view.focusSun({ x: 0, y: 0, z: 0 }, 1);
    expect(cam.right).toBe(8); // clamped
  });
});

describe('new item shapes', () => {
  it('builds the vegetable bunch and the ore chunk', () => {
    for (const shape of ['veggie', 'ore'] as const) {
      const fig = buildItem(shape, '#44aa44');
      expect(fig.object.children.length).toBeGreaterThan(0);
      fig.object.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(fig.object);
      expect(box.max.y - box.min.y).toBeGreaterThan(0.5);
      expect(box.max.y).toBeLessThanOrEqual(0.62);
      expect(box.min.y).toBeGreaterThanOrEqual(-0.62);
      fig.setColor('#ff00ff');
      fig.dispose();
    }
  });
});
