import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CLASSIC_LOOK } from '../../src/engine/factory-looks';
import type { EntityView, ParamValue } from '../../src/engine/types';
import { CONTAINER_LOOK } from '../../src/nodes/container';
import { ContainerFigure } from '../../src/render/container-figure';
import { CAGE_FRAME } from '../../src/render/factory-blocks';
import { SceneView } from '../../src/render/scene-view';
import { rig } from '../helpers/arm-rig';

/** How a "Lồng chứa" is drawn: measured on the meshes the figure makes for the blocks the card really builds. */

const MM = 0.001;
const AT = { x: 3, y: 0, z: -2 };

function blocks(params: Record<string, ParamValue> = {}): EntityView[] {
  return rig([['cage', 'container', { position: AT, ...params }]], [], '3d').world.entities().filter((e) => e.ownerNodeId === 'cage');
}

/** Bounds of everything a figure draws, in world metres; null when it draws nothing. */
function drawn(view: EntityView): THREE.Box3 | null {
  const fig = new ContainerFigure(view);
  fig.object.updateMatrixWorld(true);
  let meshes = 0;
  fig.object.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes++;
  });
  return meshes === 0 ? null : new THREE.Box3().setFromObject(fig.object);
}

describe('the mesh roll cage', () => {
  const [floor, ...walls] = blocks() as [EntityView, ...EntityView[]];

  it('the floor plate draws the whole cage: wheels on the ground, mesh up to the rim, the frame just outside the clear room', () => {
    const box = drawn(floor)!;
    expect(box.min.y).toBeCloseTo(AT.y, 2);
    // Rim of the solid walls: 0.35 m clearance + 0.05 m plate + 1 m wall.
    expect(box.max.y).toBeGreaterThan(AT.y + 1.4 - 20 * MM);
    expect(box.max.y).toBeLessThanOrEqual(AT.y + 1.4 + MM);
    for (const [lo, hi, mid] of [
      [box.min.x, box.max.x, AT.x],
      [box.min.z, box.max.z, AT.z],
    ] as const) {
      expect(hi - mid).toBeCloseTo(0.5 + CAGE_FRAME, 2);
      expect(mid - lo).toBeCloseTo(0.5 + CAGE_FRAME, 2);
    }
  });

  it('the drawn frame stays inside the solid walls and never reaches into the clear room', () => {
    const box = drawn(floor)!;
    const outer = Math.max(...walls.map((w) => Math.abs(w.position.x - AT.x) + w.size.x / 2));
    expect(outer).toBeCloseTo(0.55, 9);
    expect(box.max.x - AT.x).toBeLessThanOrEqual(outer + MM);
    expect(CAGE_FRAME).toBeLessThanOrEqual(0.05);
  });

  it('the walls draw nothing of their own: the mesh stands where they are', () => {
    for (const w of walls) expect(drawn(w)).toBeNull();
  });

  it('follows the size of the card', () => {
    const [low] = blocks({ inside: 0.8, wall: 0.6, clearance: 0.2 }) as [EntityView];
    const box = drawn(low)!;
    expect(box.min.y).toBeCloseTo(AT.y, 2);
    expect(box.max.y).toBeCloseTo(AT.y + 0.2 + 0.05 + 0.6, 1);
    expect(box.max.x - box.min.x).toBeCloseTo(0.8 + 2 * CAGE_FRAME, 2);
  });
});

describe('the closed box', () => {
  const [floor, ...walls] = blocks({ look: CLASSIC_LOOK }) as [EntityView, ...EntityView[]];

  it('the floor plate is drawn as its solid box on four feet that reach the ground', () => {
    const box = drawn(floor)!;
    expect(box.min.y).toBeCloseTo(AT.y, 6);
    expect(box.max.y).toBeCloseTo(floor.position.y + floor.size.y / 2, 6);
    expect(box.max.x - box.min.x).toBeCloseTo(floor.size.x, 6);
  });

  it('every wall is drawn as exactly its solid box', () => {
    for (const w of walls) {
      const box = drawn(w)!;
      const size = box.getSize(new THREE.Vector3());
      const mid = box.getCenter(new THREE.Vector3());
      expect([size.x, size.y, size.z].map((n) => +n.toFixed(6))).toEqual([w.size.x, w.size.y, w.size.z].map((n) => +n.toFixed(6)));
      expect(mid.distanceTo(new THREE.Vector3(w.position.x, w.position.y, w.position.z))).toBeLessThan(1e-6);
    }
  });
});

describe('in the scene', () => {
  const ownersOf = (view: SceneView): Map<string, number> => {
    const owners = new Map<string, number>();
    view.scene.traverse((o) => {
      if (o instanceof THREE.Mesh && typeof o.userData.ownerNodeId === 'string') owners.set(o.userData.ownerNodeId, (owners.get(o.userData.ownerNodeId) ?? 0) + 1);
    });
    return owners;
  };

  it('cage blocks are drawn by the cage figure, follow the cage when it moves, and leave nothing behind when it goes', () => {
    const view = new SceneView();
    view.setMode('3d');
    const cage = blocks();
    const plain: EntityView = { id: 'p1', kind: 'block', ownerNodeId: 'other', position: { x: 9, y: 0, z: 9 }, size: { x: 1, y: 1, z: 1 }, color: '#a3a3a3', visible: true };
    view.sync([...cage, plain], 0);
    // One baked mesh for the whole roll cage; the four walls add none.
    expect(ownersOf(view).get('cage')).toBe(1);
    const figure = (): THREE.Object3D => {
      let found: THREE.Object3D | null = null;
      view.scene.traverse((o) => {
        if (o instanceof THREE.Mesh && o.userData.ownerNodeId === 'cage') found = o.parent;
      });
      return found!;
    };
    expect(figure().position.x).toBeCloseTo(cage[0]!.position.x, 9);
    view.sync([...cage.map((e) => ({ ...e, position: { ...e.position, x: e.position.x + 5 } })), plain], 0);
    expect(figure().position.x).toBeCloseTo(cage[0]!.position.x + 5, 9);
    // The closed box: a plate, its feet and four boards.
    view.sync([...blocks({ look: CLASSIC_LOOK }).map((e, k) => ({ ...e, id: cage[k]!.id })), plain], 0);
    expect(ownersOf(view).get('cage')).toBe(6);
    view.sync([plain], 0);
    expect(ownersOf(view).has('cage')).toBe(false);
    expect(cage.every((e) => e.look === CONTAINER_LOOK)).toBe(true);
  });
});
