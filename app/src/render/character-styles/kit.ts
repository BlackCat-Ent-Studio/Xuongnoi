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
  /** Where a tool in hand is attached; absent = the look cannot hold tools. */
  readonly hand?: HandMount;
  /** Advance the pose toward what `motion` asks for and apply it to the parts. */
  update(motion: Motion, dt: number): void;
  /**
   * The look keeps every pose inside the unit figure (base on y -0.5, nothing above 0.5) by construction, so
   * the engine skips its per-frame box-corner height fitting. Needed for rounded parts, whose boxes overshoot.
   */
  readonly selfFitting?: boolean;
}

/**
 * A spot on the figure that carries the tool. `swing` is a joint at the pivot of the swing (shoulder for
 * arms, mouth/side for the others); the tool sits at `at`, expressed in `swing`'s space, `length` figure units long.
 */
export interface HandMount {
  swing: THREE.Object3D;
  at: Vec3Tuple;
  length: number;
  /** Share of the full swing angle this look uses (arms 1, mouth/side looks less). */
  swingShare: number;
}

export interface StyleDef {
  id: string;
  build(kit: PartKit): StyleRig;
  /** The look has its own fixed palette and ignores the entity's color. */
  fixedColor?: boolean;
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
  hand?: HandMount,
): StyleRig {
  let pose: P = { ...rest };
  apply(pose);
  return {
    root,
    ...(hand ? { hand } : {}),
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

  /** Extra geometry/textures created by a style, disposed with the kit. */
  private readonly owned: { dispose(): void }[] = [];
  private readonly spheres = new Map<string, THREE.SphereGeometry>();
  private readonly ramps = new Map<string, THREE.DataTexture>();
  /** Re-derive every material that follows the main color. */
  private readonly tints: (() => void)[] = [];

  setMainColor(color: string): void {
    this.main.color.set(color);
    for (const apply of this.tints) apply();
  }

  /** Registers a geometry or texture so it is disposed with the figure; returns it for chaining. */
  own<T extends { dispose(): void }>(resource: T): T {
    this.owned.push(resource);
    return resource;
  }

  /** Shared unit-radius sphere; scale a mesh to make an ellipsoid. */
  sphere(widthSegments: number, heightSegments: number): THREE.SphereGeometry {
    const key = `${widthSegments}x${heightSegments}`;
    let g = this.spheres.get(key);
    if (!g) {
      g = new THREE.SphereGeometry(1, widthSegments, heightSegments);
      this.spheres.set(key, g);
    }
    return g;
  }

  /** Stepped light ramp for toon shading (one value per step, 0..255, dark to light). */
  ramp(steps: readonly number[]): THREE.DataTexture {
    const key = steps.join(',');
    let t = this.ramps.get(key);
    if (!t) {
      t = new THREE.DataTexture(new Uint8Array(steps), steps.length, 1, THREE.RedFormat);
      t.minFilter = t.magFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      this.ramps.set(key, t);
    }
    return t;
  }

  /** Toon-shaded material with a fixed color (cached per color and options). */
  toon(color: string, opts: ToonOptions): THREE.MeshToonMaterial {
    const key = `toon:${color}|${opts.ramp.join(',')}|${opts.rim ?? 0}|${opts.rimColor ?? ''}|${opts.vertexColors ? 'v' : ''}`;
    let m = this.cache.get(key);
    if (!m) {
      m = makeToon(this.ramp(opts.ramp), new THREE.Color(color), opts);
      this.cache.set(key, m);
    }
    return m as THREE.MeshToonMaterial;
  }

  /** Toon material whose color is derived from the entity's main color and follows it when it changes. */
  toonTinted(derive: (main: THREE.Color, out: THREE.Color) => void, opts: ToonOptions): THREE.MeshToonMaterial {
    const m = makeToon(this.ramp(opts.ramp), new THREE.Color(), opts);
    const apply = (): void => derive(this.main.color, m.color);
    apply();
    this.tints.push(apply);
    this.owned.push(m);
    return m;
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
    for (const g of this.spheres.values()) g.dispose();
    this.spheres.clear();
    for (const t of this.ramps.values()) t.dispose();
    this.ramps.clear();
    for (const r of this.owned) r.dispose();
    this.owned.length = 0;
    this.tints.length = 0;
  }
}

export interface ToonOptions {
  /** Light steps, dark to light (see PartKit.ramp). */
  ramp: readonly number[];
  /** Strength of a soft fresnel rim glow that keeps dark parts readable; 0 or absent = none. */
  rim?: number;
  /** Rim color as hex, used as-is in the shader (no color management); default a soft violet. */
  rimColor?: string;
  /** Color comes from a per-vertex `color` attribute (multiplied with the material color). */
  vertexColors?: boolean;
}

function makeToon(ramp: THREE.DataTexture, color: THREE.Color, opts: ToonOptions): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, vertexColors: opts.vertexColors === true });
  const rim = opts.rim ?? 0;
  if (rim > 0) {
    const n = Number.parseInt((opts.rimColor ?? '#9e8cff').slice(1), 16);
    const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => (c / 255).toFixed(3)).join(', ');
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `outgoingLight += vec3(${rgb}) * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.4) * ${rim.toFixed(3)};\n#include <opaque_fragment>`,
      );
    };
    m.customProgramCacheKey = () => `toonrim:${rgb}:${rim.toFixed(3)}`;
  }
  return m;
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
    // Held tools may stick out of the figure's box; they do not count toward the pose height.
    if (o.userData.noFit === true) return;
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
