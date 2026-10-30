import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityView, VehicleModel } from '../../src/engine/types';
import { SceneView } from '../../src/render/scene-view';

function vehicle(id: string, model: VehicleModel): EntityView {
  return {
    id,
    kind: 'vehicle',
    ownerNodeId: `n-${id}`,
    position: { x: 0, y: 0.5, z: 0 },
    size: { x: 1.5, y: 0.8, z: 1.5 },
    color: '#3b82f6',
    visible: true,
    vehicle: { model, speed: 0, wheelSpin: 0, heading: 0, driver: 'd' },
  };
}

const driver = (seatedIn: string): EntityView => ({
  id: 'd',
  kind: 'character',
  ownerNodeId: 'n-d',
  position: { x: 0, y: 0.8, z: 0 },
  size: { x: 0.6, y: 1.2, z: 0.6 },
  color: '#ef4444',
  visible: true,
  seatedIn,
});

/** Whether any object owned by the driver node is drawn. */
function driverShown(scene: SceneView): boolean {
  let shown = false;
  scene.scene.traverseVisible((o) => {
    if (o instanceof THREE.Mesh && o.userData.ownerNodeId === 'n-d') shown = true;
  });
  return shown;
}

describe('seated driver', () => {
  it('is hidden inside closed car and truck models, shown on bikes and trains and after getting out', () => {
    for (const [model, shown] of [['car', false], ['truck', false], ['bike', true], ['locomotive', true]] as const) {
      const scene = new SceneView();
      scene.setMode('3d');
      scene.sync([vehicle('v', model), driver('v')]);
      expect(driverShown(scene), model).toBe(shown);
      const out = { ...driver('v') };
      delete out.seatedIn;
      scene.sync([vehicle('v', model), out]);
      expect(driverShown(scene), `${model} after getting out`).toBe(true);
      scene.dispose();
    }
  });
});
