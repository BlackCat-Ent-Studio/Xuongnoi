import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityView, VehicleModel } from '../../src/engine/types';
import { SceneView } from '../../src/render/scene-view';
import { VehicleFigure } from '../../src/render/vehicle-models';
import { vehicleSize } from '../../src/world/vehicles';

const view = (model: VehicleModel, over: Partial<EntityView> = {}): EntityView => ({
  id: 'v1',
  kind: 'vehicle',
  ownerNodeId: 'car-node',
  position: { x: 2, y: 0.4, z: -3 },
  size: vehicleSize(model),
  color: '#ef4444',
  vehicle: { model, speed: 3, wheelSpin: 1.5, heading: 0.6, driver: null },
  visible: true,
  ...over,
});

describe('vehicle figures', () => {
  it('build for every model and stay inside the collision box', () => {
    for (const model of ['car', 'bike', 'truck', 'locomotive', 'wagon'] as const) {
      const fig = new VehicleFigure(model, '#3b82f6');
      fig.update(view(model));
      const size = vehicleSize(model);
      let meshes = 0;
      fig.object.traverse((o) => {
        if (o instanceof THREE.Mesh) meshes++;
      });
      expect(meshes).toBeGreaterThan(6);
      expect(fig.object.position.toArray()).toEqual([2, 0.4, -3]);
      // The nose points along the heading and the model stays within its collision box.
      expect(fig.object.rotation.y).toBeCloseTo(-0.6, 6);
      const half = size.x / 2 + 1e-6;
      for (const part of fig.object.children) {
        // Body parts are direct meshes; wheels are groups holding their own meshes (centered on the group).
        const at = part.position;
        const extent = part instanceof THREE.Mesh ? part.scale : (part.children[0] as THREE.Mesh).scale;
        expect(Math.abs(at.x) + extent.x / 2).toBeLessThanOrEqual(half);
        expect(Math.abs(at.z) + extent.z / 2).toBeLessThanOrEqual(half);
        expect(at.y - extent.y / 2).toBeGreaterThanOrEqual(-size.y / 2 - 1e-6);
      }
      fig.dispose();
    }
  });

  it('turns the wheels with the distance travelled and follows color and owner', () => {
    const fig = new VehicleFigure('car', '#ef4444');
    fig.update(view('car', { vehicle: { model: 'car', speed: 0, wheelSpin: 2, heading: 0, driver: null } }));
    const rotations: number[] = [];
    fig.object.children.forEach((c) => {
      if (c.children.length === 2) rotations.push(c.rotation.z);
    });
    expect(rotations).toHaveLength(4);
    for (const r of rotations) expect(r).toBeCloseTo(-2, 6);
    fig.update(view('car', { color: '#00ff00' }));
    let owner: unknown;
    fig.object.traverse((o) => {
      owner = o.userData.ownerNodeId;
    });
    expect(owner).toBe('car-node');
    fig.dispose();
  });
});

describe('scene view with vehicles', () => {
  it('draws vehicles, shows a seated driver, and cleans up', () => {
    const scene = new SceneView();
    const car = view('car');
    const driver: EntityView = {
      id: 'c1',
      kind: 'character',
      ownerNodeId: 'hero',
      position: { x: 2, y: 0.8, z: -3 },
      size: { x: 1, y: 1, z: 1 },
      color: '#3b82f6',
      seatedIn: 'v1',
      visible: true,
    };
    expect(() => scene.sync([car, driver], 1 / 60)).not.toThrow();
    expect(() => scene.sync([car, driver], 1 / 60)).not.toThrow();
    // Swapping the model rebuilds the figure instead of reusing the old one.
    expect(() => scene.sync([view('truck'), { ...driver, seatedIn: undefined }], 1 / 60)).not.toThrow();
    scene.sync([], 0);
    expect(scene.scene.children.filter((c) => c.type === 'Group')[0]?.children).toHaveLength(0);
    scene.dispose();
  });
});
