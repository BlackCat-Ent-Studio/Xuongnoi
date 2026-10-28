import * as THREE from 'three';
import { smoothValue } from '../cameras';
import type { Motion } from '../character-motion';

export type Vec3Tuple = [number, number, number];

/**
 * A built character style. Figures are 1 unit tall (y -0.5 base .. 0.5 top), facing +X, and keep their
 * footprint inside a circle of radius 0.5 so they fit the collision box under any yaw.
 */
export interface StyleRig {
  readonly root: THREE.Group;
  /** Advance the pose toward what `motion` asks for and apply it to the parts. */
  update(motion: Motion, dt: number): void;
}

export interface StyleDef {
  id: string;
  build(kit: PartKit): StyleRig;
}

/** Numeric pose channels for one style (named, so each style reads as plain properties). */
export type PoseValues = Record<string, number>;

export function blendPose<P extends PoseValues>(current: P, target: P, dt: number, rate: number): P {
  const out: PoseValues = { ...target };
  for (const key of Object.keys(target)) {
    out[key] = smoothValue(current[key] ?? 0, target[key] ?? 0, dt, rate);
  }
  return out as P;
}

/** Wraps a pose function pair into a rig: smooth toward the target pose, then apply it. */
export function poseRig<P extends PoseValues>(
  root: THREE.Group,
  rest: P,
  target: (m: Motion) => P,
  apply: (pose: P) => void,
  rate = 14,
): StyleRig {
  let pose: P = { ...rest };
  apply(pose);
  return {
    root,
    update(motion, dt) {
      pose = blendPose(pose, target(motion), dt, rate);
      apply(pose);
    },
  };
}

/** Shared unit-box geometry and cached materials for building one figure; disposed with it. */
export class PartKit {
  readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  /** Tinted with the entity's color. */
  readonly main: THREE.MeshLambertMaterial;
  private readonly cache = new Map<string, THREE.Material>();

  constructor(color: string) {
    this.main = new THREE.MeshLambertMaterial({ color });
  }

  setMainColor(color: string): void {
    this.main.color.set(color);
  }

  /** Lit fixed-color material (cached per color). */
  mat(color: string): THREE.MeshLambertMaterial {
    let m = this.cache.get(color);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color });
      this.cache.set(color, m);
    }
    return m as THREE.MeshLambertMaterial;
  }

  /** Unlit material for glowing parts such as robot eyes. */
  glow(color: string): THREE.MeshBasicMaterial {
    const key = `glow:${color}`;
    let m = this.cache.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color });
      this.cache.set(key, m);
    }
    return m as THREE.MeshBasicMaterial;
  }

  box(parent: THREE.Object3D, mat: THREE.Material, size: Vec3Tuple, pos: Vec3Tuple): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry, mat);
    mesh.scale.set(size[0], size[1], size[2]);
    mesh.position.set(pos[0], pos[1], pos[2]);
    parent.add(mesh);
    return mesh;
  }

  /** An empty group used as a joint: rotating it swings everything attached to it. */
  joint(parent: THREE.Object3D, pos: Vec3Tuple): THREE.Group {
    const g = new THREE.Group();
    g.position.set(pos[0], pos[1], pos[2]);
    parent.add(g);
    return g;
  }

  dispose(): void {
    this.geometry.dispose();
    this.main.dispose();
    for (const m of this.cache.values()) m.dispose();
    this.cache.clear();
  }
}

const CORNERS: Vec3Tuple[] = [
  [-0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5],
  [-0.5, 0.5, -0.5],
  [0.5, 0.5, -0.5],
  [-0.5, -0.5, 0.5],
  [0.5, -0.5, 0.5],
  [-0.5, 0.5, 0.5],
  [0.5, 0.5, 0.5],
];

/** Lowest and highest y of any box under `root`, in root-local space (root's own transform is ignored). */
export function localYRange(root: THREE.Object3D): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  const v = new THREE.Vector3();
  const visit = (o: THREE.Object3D, parentMatrix: THREE.Matrix4): void => {
    o.updateMatrix();
    const m = new THREE.Matrix4().multiplyMatrices(parentMatrix, o.matrix);
    if (o instanceof THREE.Mesh) {
      for (const c of CORNERS) {
        v.set(c[0], c[1], c[2]).applyMatrix4(m);
        if (v.y < min) min = v.y;
        if (v.y > max) max = v.y;
      }
    }
    for (const child of o.children) visit(child, m);
  };
  for (const child of root.children) visit(child, new THREE.Matrix4());
  return { min, max };
}
