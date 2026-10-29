import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BLOCK_STYLES, TRAFFIC_COLORS, blockStyleOf } from '../../src/engine/block-styles';
import type { EntityView } from '../../src/engine/types';
import { buildBlockLook, countMeshes, trafficLampIndex } from '../../src/render/block-looks';
import { buildItem } from '../../src/render/item-shapes';
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

  it('shares geometry between blocks of the same style', () => {
    const a = buildBlockLook('house', '#ff0000', SIZE);
    const b = buildBlockLook('house', '#00ff00', SIZE);
    const ga = (a.object.children[0] as THREE.Mesh).geometry;
    const gb = (b.object.children[0] as THREE.Mesh).geometry;
    expect(ga).toBe(gb);
  });

  it('re-tints without rebuilding', () => {
    const fig = buildBlockLook('house', '#ff0000', SIZE);
    const mesh = fig.object.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
    const before = mesh.material;
    fig.setColor('#0000ff');
    expect(mesh.material).not.toBe(before);
    expect(mesh.material.color.getHexString()).toBe('0000ff');
  });

  it('lights the lamp that matches the colour of a traffic light', () => {
    expect(trafficLampIndex(TRAFFIC_COLORS[0])).toBe(0);
    expect(trafficLampIndex(TRAFFIC_COLORS[1])).toBe(1);
    expect(trafficLampIndex(TRAFFIC_COLORS[2])).toBe(2);
    const fig = buildBlockLook('trafficlight', TRAFFIC_COLORS[0], { x: 0.6, y: 4, z: 0.6 });
    const lamps = fig.object.children.filter((c): c is THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> => c instanceof THREE.Mesh && c.position.y < 0.45 && c.position.y > 0.1 && c.scale.z > 0.8);
    expect(lamps).toHaveLength(3);
    const lit = () => lamps.map((l) => l.material.color.getHexString());
    expect(lit()[0]).toBe(new THREE.Color(TRAFFIC_COLORS[0]).getHexString());
    expect(lit()[2]).not.toBe(new THREE.Color(TRAFFIC_COLORS[2]).getHexString());
    fig.setColor(TRAFFIC_COLORS[2]);
    expect(lit()[2]).toBe(new THREE.Color(TRAFFIC_COLORS[2]).getHexString());
    expect(lit()[0]).not.toBe(new THREE.Color(TRAFFIC_COLORS[0]).getHexString());
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
      expect(fig.object.children.length).toBeGreaterThan(2);
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
