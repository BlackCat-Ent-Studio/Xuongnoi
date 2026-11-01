import * as THREE from 'three';

const FLASH_COLOR = new THREE.Color(0xff2020);

/** Tints every lit material under `root` red by `amount` 0..1 (0 restores). Unlit materials are left alone. */
export function applyHitFlash(root: THREE.Object3D, amount: number): void {
  const k = Math.min(1, Math.max(0, amount));
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m instanceof THREE.MeshLambertMaterial || m instanceof THREE.MeshToonMaterial) m.emissive.copy(FLASH_COLOR).multiplyScalar(k * 0.8);
    }
  });
}
