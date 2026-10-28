import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityView } from '../../src/engine/types';
import { defaultYaw, facingTarget, motionOf, shortestAngle, smoothAngle, yawToward } from '../../src/render/character-motion';
import { humanTarget } from '../../src/render/character-styles/human';
import { blendPose } from '../../src/render/character-styles/kit';
import { Humanoid } from '../../src/render/humanoid-model';
import { SceneView } from '../../src/render/scene-view';

function view(over: Partial<EntityView> = {}): EntityView {
  return {
    id: 'c1',
    kind: 'character',
    ownerNodeId: 'n1',
    position: { x: 0, y: 0.5, z: 0 },
    size: { x: 1, y: 1, z: 1 },
    color: '#ff8800',
    visible: true,
    ...over,
  };
}

describe('pose math', () => {
  it('idle has no limb swing but breathes', () => {
    const p = humanTarget(motionOf(0, false, 1, 0.4));
    expect(p.legL).toBe(0);
    expect(p.legR).toBe(0);
    expect(Math.abs(p.breathe)).toBeGreaterThan(0);
  });
  it('walk swings opposite limbs and scales with speed', () => {
    const slow = humanTarget(motionOf(1, false, Math.PI / 2, 0));
    const fast = humanTarget(motionOf(3, false, Math.PI / 2, 0));
    expect(fast.legL).toBeCloseTo(-fast.legR);
    expect(fast.armL).toBeCloseTo(-fast.legL * 0.9);
    expect(Math.abs(fast.legL)).toBeGreaterThan(Math.abs(slow.legL));
  });
  it('airborne raises arms and tucks legs regardless of speed', () => {
    const p = humanTarget(motionOf(5, true, 1, 0));
    expect(p.armL).toBeGreaterThan(2);
    expect(p.legL).toBeGreaterThan(0.5);
  });
  it('blend converges toward target and is a no-op at dt 0', () => {
    const t = humanTarget(motionOf(0, true, 0, 0));
    const rest = { armL: 0, armR: 0, legL: 0, legR: 0, breathe: 0 };
    expect(blendPose(rest, t, 0, 14)).toEqual(rest);
    let p = rest;
    for (let i = 0; i < 120; i++) p = blendPose(p, t, 1 / 60, 14);
    expect(p.armL).toBeCloseTo(t.armL, 2);
  });
});

describe('facing', () => {
  it('side mode faces +X / -X and keeps facing when idle', () => {
    expect(facingTarget('2d-side', 2, 0, 1)).toBe(0);
    expect(facingTarget('2d-side', -2, 0, 0)).toBe(Math.PI);
    expect(facingTarget('2d-side', 0.1, 0, Math.PI)).toBe(Math.PI);
  });
  it('top/3d faces velocity direction', () => {
    const f = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), facingTarget('3d', 0, -3, 0));
    expect(f.z).toBeCloseTo(-1);
    expect(f.x).toBeCloseTo(0);
    expect(facingTarget('2d-top', 0.1, 0.1, 0.7)).toBe(0.7);
  });
  it('default preview faces +X in side, toward +Z otherwise', () => {
    expect(defaultYaw('2d-side')).toBe(0);
    expect(defaultYaw('3d')).toBeCloseTo(yawToward(0, 1));
  });
  it('turns the short way', () => {
    expect(shortestAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    const a = smoothAngle(Math.PI - 0.1, -Math.PI + 0.1, 1 / 60);
    expect(a).toBeGreaterThan(Math.PI - 0.1);
  });
});

describe('humanoid figure', () => {
  function bounds(h: Humanoid): THREE.Box3 {
    h.object.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(h.object);
  }

  it('fits inside the collision box with feet on its floor', () => {
    const h = new Humanoid('#ff8800', '2d-side');
    h.update(view({ position: { x: 4, y: 3, z: 1 }, size: { x: 1, y: 1.6, z: 1 } }), 0);
    const b = bounds(h);
    expect(b.min.y).toBeCloseTo(3 - 0.8, 3);
    expect(b.max.y).toBeLessThanOrEqual(3 + 0.8 + 1e-6);
    expect(b.min.x).toBeGreaterThanOrEqual(4 - 0.5 - 1e-6);
    expect(b.max.x).toBeLessThanOrEqual(4 + 0.5 + 1e-6);
    expect(b.min.z).toBeGreaterThanOrEqual(1 - 0.5 - 1e-6);
    expect(b.max.z).toBeLessThanOrEqual(1 + 0.5 + 1e-6);
    h.dispose();
  });

  it('stays inside the box while walking and jumping', () => {
    const h = new Humanoid('#ff8800', '2d-side');
    let x = 0;
    for (let i = 0; i < 90; i++) {
      x += 0.1;
      const y = 0.5 + (i > 40 ? 0.1 : 0);
      h.update(view({ position: { x, y, z: 0 } }), 1 / 60);
      const b = bounds(h);
      expect(b.min.y).toBeGreaterThanOrEqual(y - 0.5 - 1e-6);
      expect(b.max.y).toBeLessThanOrEqual(y + 0.5 + 1e-6);
      expect(b.min.x).toBeGreaterThanOrEqual(x - 0.5 - 1e-6);
      expect(b.max.x).toBeLessThanOrEqual(x + 0.5 + 1e-6);
    }
    h.dispose();
  });

  it('tags every mesh with the owner node', () => {
    const h = new Humanoid('#ff8800', '3d');
    h.update(view({ ownerNodeId: 'node-7' }), 0);
    let meshes = 0;
    h.object.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        meshes++;
        expect(o.userData.ownerNodeId).toBe('node-7');
      }
    });
    expect(meshes).toBeGreaterThan(8);
    h.dispose();
  });
});

describe('SceneView entities', () => {
  it('renders characters as humanoids, blocks as boxes, and cleans up', () => {
    const sv = new SceneView();
    const block = view({ id: 'b1', kind: 'block', ownerNodeId: 'nb' });
    sv.sync([view(), block]);
    expect(sv.scene.getObjectByProperty('type', 'Group')).toBeDefined();
    const ndc = new THREE.Vector2(0, 0);
    const cam = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    cam.position.set(0, 0.5, 50);
    cam.lookAt(0, 0.5, 0);
    cam.updateMatrixWorld();
    expect(['n1', 'nb']).toContain(sv.pick(ndc, cam));
    sv.sync([block]);
    sv.sync([]);
    expect(sv.pick(ndc, cam)).toBeNull();
    sv.dispose();
  });

  it('picks the character owner through nested parts', () => {
    const sv = new SceneView();
    sv.sync([view()]);
    const cam = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    cam.position.set(0, 0.5, 50);
    cam.lookAt(0, 0.5, 0);
    cam.updateMatrixWorld();
    expect(sv.pick(new THREE.Vector2(0, 0), cam)).toBe('n1');
    sv.dispose();
  });
});
