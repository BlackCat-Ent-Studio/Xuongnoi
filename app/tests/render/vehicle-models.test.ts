import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import type { EntityView, VehicleModel } from '../../src/engine/types';
import { SceneView } from '../../src/render/scene-view';
import { pickVariant, setPackTemplateForTests } from '../../src/render/pack-models';
import { VEHICLE_PACK } from '../../src/render/pack-model-table';
import { VehicleFigure } from '../../src/render/vehicle-models';
import { VEHICLE_DIMS, vehicleSize } from '../../src/world/vehicles';

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

/** A fake pack vehicle: a box 2 wide (x), 1.5 tall, 4 long (z), with its grille side (+z) marked by a child. */
function fakeVehicle(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 4), new THREE.MeshBasicMaterial());
  body.position.y = 0.75 + 0.2;
  body.name = 'body';
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 0.2), new THREE.MeshBasicMaterial());
  grille.position.set(0, 0.5, 2.1);
  grille.name = 'grille';
  g.add(body, grille);
  return g;
}

function poolPath(model: 'car' | 'truck' | 'bike', owner: string): string {
  const pool = VEHICLE_PACK[model];
  if (!pool) throw new Error('no pool');
  return pickVariant(pool.models, owner);
}

afterEach(() => setPackTemplateForTests(null));

describe('pack vehicles', () => {
  it('show a box until the model loads, then the picked model with its nose on +x, on the floor', () => {
    for (const model of ['car', 'truck', 'bike'] as const) {
      const fig = new VehicleFigure(model, '#ef4444');
      fig.update(view(model, { vehicle: { model, speed: 0, wheelSpin: 0, heading: 0, driver: null } }));
      expect(fig.object.children).toHaveLength(1);
      expect(fig.object.children[0]?.name).toBe('');
      setPackTemplateForTests(poolPath(model, 'car-node'), fakeVehicle());
      fig.update(view(model, { vehicle: { model, speed: 0, wheelSpin: 0, heading: 0, driver: null } }));
      expect(fig.object.children).toHaveLength(1);
      const d = VEHICLE_DIMS[model];
      const box = new THREE.Box3().setFromObject(fig.object);
      // Heading 0: nose along +x, length equals the footprint, bottom on the floor.
      expect(box.max.x - box.min.x).toBeCloseTo(d.footprint, 3);
      expect(box.max.z - box.min.z).toBeLessThan(d.footprint);
      expect(box.min.y - fig.object.position.y).toBeCloseTo(-d.height / 2, 3);
      const grille = fig.object.getObjectByName('grille');
      expect(grille).toBeDefined();
      const at = new THREE.Vector3();
      grille?.getWorldPosition(at);
      expect(at.x - fig.object.position.x).toBeGreaterThan(d.footprint / 2 - 0.1);
      expect(Math.abs(at.z - fig.object.position.z)).toBeLessThan(0.01);
      fig.dispose();
      setPackTemplateForTests(null);
    }
  });

  it('picks the model by owner id and does not wheel-spin', () => {
    const a = poolPath('car', 'owner-a');
    const other = (VEHICLE_PACK.car?.models ?? []).find((m) => m !== a);
    expect(other).toBeDefined();
    const ids = ['owner-a', 'owner-b', 'owner-c', 'owner-d', 'owner-e', 'owner-f'];
    const picked = new Set(ids.map((id) => poolPath('car', id)));
    expect(picked.size).toBeGreaterThan(1);
    for (const m of picked) setPackTemplateForTests(m, fakeVehicle());
    const fig = new VehicleFigure('car', '#ef4444');
    fig.update(view('car', { ownerNodeId: 'owner-a' }));
    fig.update(view('car', { ownerNodeId: 'owner-b' }));
    expect(fig.object.children).toHaveLength(1);
    fig.update(view('car', { vehicle: { model: 'car', speed: 0, wheelSpin: 2, heading: 0, driver: null } }));
    expect(fig.object.children[0]?.rotation.z).toBe(0);
    let owner: unknown;
    fig.object.traverse((o) => {
      owner = o.userData.ownerNodeId;
    });
    expect(owner).toBe('car-node');
    fig.dispose();
  });
});

describe('vehicle figures', () => {
  it('build trains from boxes and stay inside the collision box', () => {
    for (const model of ['locomotive', 'wagon'] as const) {
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

  it('turns the train wheels with the distance travelled and follows color and owner', () => {
    const fig = new VehicleFigure('wagon', '#ef4444');
    fig.update(view('wagon', { vehicle: { model: 'wagon', speed: 0, wheelSpin: 2, heading: 0, driver: null } }));
    const rotations: number[] = [];
    fig.object.children.forEach((c) => {
      if (c.children.length === 2) rotations.push(c.rotation.z);
    });
    expect(rotations).toHaveLength(4);
    for (const r of rotations) expect(r).toBeCloseTo(-2, 6);
    fig.update(view('wagon', { color: '#00ff00' }));
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
