import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { tintDamaged } from '../../src/render/damaged-look';

describe('tintDamaged', () => {
  it('darkens a copy of each material and leaves a shared original alone', () => {
    const shared = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    const healthy = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
    const broken = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
    const root = new THREE.Group();
    root.add(broken);
    tintDamaged(root);
    expect(healthy.material).toBe(shared);
    expect(shared.color.getHexString()).toBe('ffffff');
    const m = broken.material as THREE.MeshLambertMaterial;
    expect(m).not.toBe(shared);
    expect(m.color.r).toBeGreaterThan(m.color.g);
    expect(m.color.g).toBeLessThan(1);
  });

  it('tints once, so a per-frame call does not keep darkening, and catches parts added later', () => {
    const root = new THREE.Group();
    const first = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#ffffff' }));
    root.add(first);
    tintDamaged(root);
    const once = (first.material as THREE.MeshLambertMaterial).color.getHexString();
    tintDamaged(root);
    tintDamaged(root);
    expect((first.material as THREE.MeshLambertMaterial).color.getHexString()).toBe(once);
    const late = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#ffffff' }));
    root.add(late);
    tintDamaged(root);
    expect((late.material as THREE.MeshLambertMaterial).color.getHexString()).toBe(once);
  });
});
