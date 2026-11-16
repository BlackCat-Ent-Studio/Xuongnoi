import * as THREE from 'three';
import type { EntityView } from '../engine/types';

/** A broken body is drawn flattened to this share of its height and a little wider, so it looks crushed. */
export const DAMAGED_HEIGHT = 0.6;
export const DAMAGED_WIDEN = 1.12;
/** Share of the dark-red tint mixed into its colour. */
const TINT_SHARE = 0.55;
const TINT = [0x5a, 0x1a, 0x1a] as const;

/** Mixes a #rrggbb colour towards dark red; anything that is not 6-digit hex is returned as it is. */
export function damagedColor(color: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(color);
  if (!m) return color;
  const n = parseInt(m[1]!, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v * (1 - TINT_SHARE) + TINT[i]! * TINT_SHARE));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** What the renderer draws for a body: the entity itself, or for a damaged one a squashed, darker copy that keeps its underside in place. Collision is untouched. */
export function damagedView(e: EntityView): EntityView {
  if (!e.damaged) return e;
  const height = e.size.y * DAMAGED_HEIGHT;
  const floor = e.position.y - e.size.y / 2;
  return {
    ...e,
    size: { x: e.size.x * DAMAGED_WIDEN, y: height, z: e.size.z * DAMAGED_WIDEN },
    position: { x: e.position.x, y: floor + height / 2, z: e.position.z },
    color: damagedColor(e.color),
  };
}

const MATERIAL_TINT = new THREE.Color(0.8, 0.42, 0.42);

/**
 * Darkens and reddens every material under `root`, so models that carry their own colours (crates, figures) look
 * damaged too. Each mesh gets its own copy of the material the first time (the originals may be shared with healthy
 * bodies), and a mesh is only tinted once, so calling it every frame is safe and also catches parts that load late.
 */
export function tintDamaged(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.damageTinted) return;
    const own = (m: THREE.Material): THREE.Material => {
      const copy = m.clone();
      const color = (copy as THREE.Material & { color?: THREE.Color }).color;
      if (color) color.multiply(MATERIAL_TINT);
      return copy;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material);
    mesh.userData.damageTinted = true;
  });
}
