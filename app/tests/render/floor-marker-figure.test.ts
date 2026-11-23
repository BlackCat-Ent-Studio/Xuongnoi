import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { EntityView, ViewMode } from '../../src/engine/types';
import { FLOOR_MARKER_LOOK } from '../../src/nodes/floor-marker';
import { setTileHeld } from '../../src/engine/render-hints';
import { FloorMarkerFigure, HELD_WASH_NAME } from '../../src/render/floor-marker-figure';
import { SceneView } from '../../src/render/scene-view';

const tile = (over: Partial<EntityView> = {}): EntityView => ({
  id: 'e1',
  kind: 'block',
  ownerNodeId: 'n1',
  position: { x: 3, y: 0.5, z: -2 },
  size: { x: 1.4, y: 0.02, z: 1.4 },
  color: '#f59e0b',
  look: FLOOR_MARKER_LOOK,
  label: '7',
  zone: true,
  visible: true,
  ...over,
});

function bounds(view: EntityView, mode: ViewMode): THREE.Box3 {
  const fig = new FloorMarkerFigure(view, mode);
  fig.object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(fig.object);
}

describe('floor marker figure', () => {
  it('lies flat on the floor, exactly as wide and deep as the marker, a hair above it', () => {
    for (const mode of ['3d', '2d-top'] as const) {
      const b = bounds(tile(), mode);
      expect(b.min.x).toBeCloseTo(3 - 0.7, 6);
      expect(b.max.x).toBeCloseTo(3 + 0.7, 6);
      expect(b.min.z).toBeCloseTo(-2 - 0.7, 6);
      expect(b.max.z).toBeCloseTo(-2 + 0.7, 6);
      expect(b.min.y).toBeGreaterThan(0.5);
      expect(b.max.y).toBeLessThan(0.53);
    }
  });

  it('side view: a low strip along the floor as long as the tile', () => {
    const b = bounds(tile({ position: { x: 3, y: 0.5, z: 0 }, size: { x: 1.4, y: 0.02, z: 0.1 } }), '2d-side');
    expect(b.min.x).toBeCloseTo(3 - 0.7, 6);
    expect(b.max.x).toBeCloseTo(3 + 0.7, 6);
    expect(b.min.y).toBeCloseTo(0.5, 6);
    expect(b.max.y).toBeLessThan(0.6);
  });

  it('takes the marker colour, a darker rim, follows a colour change, and every part maps back to the card', () => {
    const fig = new FloorMarkerFigure(tile(), '3d');
    const colours = (): string[] => {
      const out: string[] = [];
      fig.object.traverse((o) => {
        if (o instanceof THREE.Mesh) out.push(`#${(o.material as THREE.MeshBasicMaterial).color.getHexString()}`);
      });
      return out;
    };
    const [rim, face] = colours();
    expect(face).toBe('#f59e0b');
    expect(rim).not.toBe(face);
    fig.update(tile({ color: '#22c55e' }));
    expect(colours()[1]).toBe('#22c55e');
    fig.object.traverse((o) => expect(o.userData.ownerNodeId).toBe('n1'));
    fig.dispose();
  });

  it('is a dark floor tile under a ring in the marker colour: the tile is the full marker, takes shadows and keeps its own colour', () => {
    const fig = new FloorMarkerFigure(tile(), '3d');
    const meshes: THREE.Mesh[] = [];
    fig.object.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes.push(o);
    });
    const [plate, ring] = meshes as [THREE.Mesh, THREE.Mesh];
    fig.object.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(plate).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(1.4, 6);
    expect(size.z).toBeCloseTo(1.4, 6);
    expect(plate.receiveShadow).toBe(true);
    // darker than any marker colour, so the light dashes and the ring read on a light floor too
    const dark = (plate.material as THREE.MeshLambertMaterial).color.getHexString();
    expect(dark).toBe('2c3038');
    fig.update(tile({ color: '#22c55e' }));
    expect((plate.material as THREE.MeshLambertMaterial).color.getHexString()).toBe(dark);
    // the ring lies over the tile, never under it
    expect(new THREE.Box3().setFromObject(ring).min.y).toBeGreaterThan(new THREE.Box3().setFromObject(plate).max.y);
    fig.dispose();
  });

  const meshesOf = (fig: FloorMarkerFigure): THREE.Mesh[] => {
    const out: THREE.Mesh[] = [];
    fig.object.traverse((o) => {
      if (o instanceof THREE.Mesh) out.push(o);
    });
    return out;
  };

  it('a marker without arrows has exactly the meshes it always had; arrows add one flat mesh in the marker colour that follows a repaint', () => {
    const plain = new FloorMarkerFigure(tile(), '3d');
    const none = new FloorMarkerFigure(tile({ blockStyle: 'box' }), '3d');
    expect(meshesOf(plain)).toHaveLength(2);
    expect(meshesOf(none)).toHaveLength(2);
    const fig = new FloorMarkerFigure(tile({ blockStyle: 'marker-exits:ES' }), '3d');
    const [plate, , arrows] = meshesOf(fig) as [THREE.Mesh, THREE.Mesh, THREE.Mesh];
    expect(meshesOf(fig)).toHaveLength(3);
    expect((arrows.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('f59e0b');
    fig.update(tile({ blockStyle: 'marker-exits:ES', color: '#ef4444' }));
    expect((arrows.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('ef4444');
    expect((plate.material as THREE.MeshLambertMaterial).color.getHexString()).toBe('2c3038');
    fig.object.traverse((o) => expect(o.userData.ownerNodeId).toBe('n1'));
    // The side view shows the floor edge-on: no arrows there.
    expect(meshesOf(new FloorMarkerFigure(tile({ blockStyle: 'marker-exits:ES' }), '2d-side'))).toHaveLength(2);
  });

  it('a held tile gets a light wash of its colour over the whole tile, under the ring and the arrows; let go, it is drawn as before', () => {
    const view = tile({ id: 'held-1', blockStyle: 'marker-exits:E' });
    const fig = new FloorMarkerFigure(view, '3d');
    const before = meshesOf(fig).length;
    fig.update(view);
    expect(meshesOf(fig)).toHaveLength(before);

    setTileHeld('n1', 'held-1', true);
    fig.update({ ...view, color: '#ef4444' });
    const wash = fig.object.getObjectByName(HELD_WASH_NAME) as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    expect(wash.visible).toBe(true);
    expect(wash.material.color.getHexString()).toBe('ef4444');
    expect(wash.material.transparent).toBe(true);
    expect(wash.material.opacity).toBeGreaterThan(0.15);
    expect(wash.material.opacity).toBeLessThan(0.5);
    expect(wash.userData.ownerNodeId).toBe('n1');
    // It covers exactly the tile, lies above the dark tile and below the ring and the arrows.
    fig.object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(wash);
    expect([box.min.x, box.max.x, box.min.z, box.max.z]).toEqual([expect.closeTo(3 - 0.7, 6), expect.closeTo(3 + 0.7, 6), expect.closeTo(-2 - 0.7, 6), expect.closeTo(-2 + 0.7, 6)]);
    const [plate, ring, arrows] = meshesOf(fig)
      .filter((m) => m !== wash)
      .map((m) => new THREE.Box3().setFromObject(m).max.y) as [number, number, number];
    expect(box.max.y).toBeGreaterThan(plate);
    expect(box.max.y).toBeLessThan(ring);
    expect(box.max.y).toBeLessThan(arrows);

    setTileHeld('n1', 'held-1', false);
    fig.update(view);
    expect(wash.visible).toBe(false);
    // A tile that was never held has no such mesh at all.
    expect(new FloorMarkerFigure(tile({ id: 'free-1' }), '3d').object.getObjectByName(HELD_WASH_NAME)).toBeUndefined();
    // Seen edge-on there is no tile face to wash.
    setTileHeld('n1', 'held-1', true);
    const side = new FloorMarkerFigure(view, '2d-side');
    side.update(view);
    expect(side.object.getObjectByName(HELD_WASH_NAME)).toBeUndefined();
    setTileHeld('n1', 'held-1', false);
  });

  it('each arrow lies inside the tile, above it, and reaches toward the edge it points at', () => {
    const reach = (exits: string): THREE.Box3 => {
      const fig = new FloorMarkerFigure(tile({ blockStyle: `marker-exits:${exits}` }), '3d');
      fig.object.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(meshesOf(fig)[2]!);
    };
    // The tile is 1.4 m wide round (3, -2): east is +x, south is +z.
    const e = reach('E');
    expect(e.min.x).toBeGreaterThan(3 + 0.2);
    expect(e.max.x).toBeGreaterThan(3 + 0.6);
    expect(e.max.x).toBeLessThan(3 + 0.7);
    expect(Math.abs((e.min.z + e.max.z) / 2 + 2)).toBeLessThan(1e-6);
    expect(e.min.y).toBeGreaterThan(0.5);
    const w = reach('W');
    expect(w.min.x).toBeGreaterThan(3 - 0.7);
    expect(w.min.x).toBeLessThan(3 - 0.6);
    const south = reach('S');
    expect(south.max.z).toBeGreaterThan(-2 + 0.6);
    expect(south.max.z).toBeLessThan(-2 + 0.7);
    expect(Math.abs((south.min.x + south.max.x) / 2 - 3)).toBeLessThan(1e-6);
    const n = reach('N');
    expect(n.min.z).toBeLessThan(-2 - 0.6);
    expect(n.min.z).toBeGreaterThan(-2 - 0.7);
    const both = reach('WS');
    expect(both.min.x).toBeLessThan(3 - 0.6);
    expect(both.max.z).toBeGreaterThan(-2 + 0.6);
  });

  it('the scene draws a marker as this figure (not as a zone box), moves it with the entity and removes it', () => {
    const view = new SceneView();
    view.setMode('3d');
    view.sync([tile()]);
    const entries = (view as unknown as { entries: Map<string, { type: string; figure: FloorMarkerFigure }> }).entries;
    expect(entries.get('e1')?.type).toBe('marker');
    view.sync([tile({ position: { x: 5, y: 0.5, z: 1 } })]);
    expect(entries.get('e1')!.figure.object.position.x).toBe(5);
    // The same entity turning into a plain zone box swaps the figure.
    view.sync([tile({ look: undefined, label: undefined })]);
    expect(entries.get('e1')?.type).toBe('block');
    view.sync([]);
    expect(entries.size).toBe(0);
    view.dispose();
  });
});
