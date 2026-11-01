import * as THREE from 'three';
import type { PartKit, Vec3Tuple } from './kit';

/** Ellipsoid from the kit's shared unit sphere. */
export function ellipsoid(
  kit: PartKit,
  parent: THREE.Object3D,
  mat: THREE.Material,
  radii: Vec3Tuple,
  pos: Vec3Tuple,
  segments: readonly [number, number] = [14, 10],
): THREE.Mesh {
  const m = new THREE.Mesh(kit.sphere(segments[0], segments[1]), mat);
  m.scale.set(radii[0], radii[1], radii[2]);
  m.position.set(pos[0], pos[1], pos[2]);
  parent.add(m);
  return m;
}

/** Mesh from a geometry the style created (the kit disposes it with the figure). */
export function part(
  kit: PartKit,
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: Vec3Tuple = [0, 0, 0],
  rot: Vec3Tuple = [0, 0, 0],
): THREE.Mesh {
  const m = new THREE.Mesh(kit.own(geometry), mat);
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  parent.add(m);
  return m;
}

/** Same as `part` for a geometry that several meshes share and that is already owned by the kit. */
export function instance(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: Vec3Tuple = [0, 0, 0],
  rot: Vec3Tuple = [0, 0, 0],
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  parent.add(m);
  return m;
}

export interface FitOptions {
  /** Extra room (fraction of the height) kept above the rest pose for bobbing and stretching. */
  headroom?: number;
  /** Share of the 0.5 footprint radius the rest pose may use; the rest is slack for swinging parts. */
  reachShare?: number;
}

export interface FitResult {
  /** Uniform scale from model units to figure units. */
  scale: number;
  /** Rest-pose height in model units. */
  height: number;
}

/**
 * Fits a model built in its own units (standing on y = 0, facing +Z) into the unit figure: turned to face +X,
 * centered on the origin horizontally, base on y = -0.5, scaled uniformly so the rest pose is as tall as the
 * figure allows (less `headroom`) without leaving the 0.5 footprint circle. Returns `squash`, the group to scale
 * vertically about the floor.
 */
export function fitFigure(root: THREE.Group, model: THREE.Group, opts: FitOptions = {}): { squash: THREE.Group } & FitResult {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  let reach = 0;
  const v = new THREE.Vector3();
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const pos = o.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      reach = Math.max(reach, Math.hypot(v.x - cx, v.z - cz));
    }
  });
  const height = box.max.y - box.min.y;
  const scale = Math.min(1 / (height * (1 + (opts.headroom ?? 0))), (0.5 * (opts.reachShare ?? 0.97)) / Math.max(reach, 1e-6));

  const outer = new THREE.Group();
  outer.scale.setScalar(scale);
  outer.position.y = -0.5;
  const yaw = new THREE.Group();
  yaw.rotation.y = Math.PI / 2;
  const squash = new THREE.Group();
  model.position.set(-cx, -box.min.y, -cz);
  squash.add(model);
  yaw.add(squash);
  outer.add(yaw);
  root.add(outer);
  return { squash, scale, height };
}

const HSL = { h: 0, s: 0, l: 0 };

/** Derives a darker shade of the main color for shaded body parts. */
export function darkerShade(lightnessDrop: number): (main: THREE.Color, out: THREE.Color) => void {
  return (main, out) => {
    main.getHSL(HSL);
    out.setHSL(HSL.h, HSL.s, Math.max(0, HSL.l - lightnessDrop));
  };
}

export function sameColor(main: THREE.Color, out: THREE.Color): void {
  out.copy(main);
}

/** Smoothstep 0..1. */
export function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** `hex` with its linear color scaled by `k` (darker shade of a fur or eye color), as a hex string. */
export function scaledHex(hex: string, k: number): string {
  return `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;
}

/** Linear blend of two hex colors, as a hex string. */
export function mixHex(a: string, b: string, t: number): string {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
}
