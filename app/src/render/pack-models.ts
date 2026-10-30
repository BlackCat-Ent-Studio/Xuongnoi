import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vec3 } from '../engine/types';

/**
 * Models from the MEGA PACK WORLD asset pack (GLB files under public/, not in git).
 *
 * Every model colours itself through the same palette texture, so all loaded models share ONE material:
 * one texture in GPU memory and the same Lambert lighting as the code-drawn looks.
 * Loading is async; callers show a placeholder until `packTemplate` returns the model.
 * Outside a browser (vitest) nothing is fetched; tests inject templates with `setPackTemplateForTests`.
 */

export const PACK_BASE = '/models/mega-pack-world/';

/**
 * How a model is placed in an entity box (sizes in world units, box centred on the entity):
 * - footprint: uniform scale so the model fills the box's floor area (buildings); height follows the model, capped.
 * - stand: uniform scale so the model is exactly as tall as the box (poles, trees); width may stick out.
 * - inside: uniform scale so the whole model fits inside the box (rocks, small things).
 * - tile: copies laid in a row/grid along the floor, each stretched to fill its cell and the box height (roads, fences).
 */
export type PackPlace = 'footprint' | 'stand' | 'inside' | 'tile';

export interface PackPool {
  readonly place: PackPlace;
  /** Paths relative to PACK_BASE. */
  readonly models: readonly string[];
  /** Tile only: target world size of one tile across the box. Omitted = one tile spans the whole width. */
  readonly tile?: number;
}

export interface Bounds3 {
  readonly min: Vec3;
  readonly max: Vec3;
}

/** A footprint-placed model never grows taller than this many box heights. */
export const FOOTPRINT_MAX_HEIGHT = 2.5;
/** Hard cap on copies for one tiled box. */
export const MAX_TILES = 256;

/** Deterministic pick from a pool: the same seed (owner node id) always gets the same model. FNV-1a hash. */
export function pickVariant(models: readonly string[], seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const m = models[(h >>> 0) % Math.max(models.length, 1)];
  if (m === undefined) throw new Error('empty model pool');
  return m;
}

/** Position, yaw and per-axis scale for one placed copy of a model, in the box frame (box centre = origin). */
export interface Placement {
  position: Vec3;
  rotationY: number;
  scale: Vec3;
}

const span = (b: Bounds3): Vec3 => ({
  x: Math.max(b.max.x - b.min.x, 1e-6),
  y: Math.max(b.max.y - b.min.y, 1e-6),
  z: Math.max(b.max.z - b.min.z, 1e-6),
});

/** Uniform placement for footprint / stand / inside: centred on the box floor, model bottom on the box bottom. */
export function fitPlacement(bounds: Bounds3, box: Vec3, place: Exclude<PackPlace, 'tile'>): Placement {
  const s = span(bounds);
  const footprint = Math.min(box.x / s.x, box.z / s.z);
  let k: number;
  if (place === 'stand') k = box.y / s.y;
  else if (place === 'inside') k = Math.min(footprint, box.y / s.y);
  else k = Math.min(footprint, (box.y * FOOTPRINT_MAX_HEIGHT) / s.y);
  const cx = (bounds.min.x + bounds.max.x) / 2;
  const cz = (bounds.min.z + bounds.max.z) / 2;
  return {
    position: { x: -cx * k, y: -box.y / 2 - bounds.min.y * k, z: -cz * k },
    rotationY: 0,
    scale: { x: k, y: k, z: k },
  };
}

/**
 * Copies of a model covering the box floor. The model's longer horizontal side is turned to run along the box's
 * longer side; each copy is stretched to fill its cell exactly and the full box height.
 */
export function tilePlacements(bounds: Bounds3, box: Vec3, tile?: number): Placement[] {
  const s = span(bounds);
  const tplAlongX = s.x >= s.z;
  const tplLong = tplAlongX ? s.x : s.z;
  const tplShort = tplAlongX ? s.z : s.x;
  const boxAlongX = box.x >= box.z;
  const long = Math.max(boxAlongX ? box.x : box.z, 1e-6);
  const short = Math.max(boxAlongX ? box.z : box.x, 1e-6);
  const k = tile !== undefined && tile > 0 ? tile / tplShort : short / tplShort;
  let across = Math.max(1, Math.round(short / (tplShort * k)));
  let along = Math.max(1, Math.round(long / (tplLong * k)));
  while (across * along > MAX_TILES) {
    if (along >= across) along = Math.ceil(along / 2);
    else across = Math.ceil(across / 2);
  }
  const cellLong = long / along;
  const cellShort = short / across;
  // Scale in the model's own axes: its long axis gets the cell length.
  const sLong = cellLong / tplLong;
  const sShort = cellShort / tplShort;
  const sy = box.y / s.y;
  const scale: Vec3 = tplAlongX ? { x: sLong, y: sy, z: sShort } : { x: sShort, y: sy, z: sLong };
  // Turn a quarter when the model's long axis and the box's long axis differ.
  const rotationY = tplAlongX === boxAlongX ? 0 : Math.PI / 2;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  // Model centre after scale and yaw, so each copy can be shifted onto its cell centre.
  const c = {
    x: ((bounds.min.x + bounds.max.x) / 2) * scale.x,
    z: ((bounds.min.z + bounds.max.z) / 2) * scale.z,
  };
  const turned = { x: c.x * cos + c.z * sin, z: -c.x * sin + c.z * cos };
  const y = -box.y / 2 - bounds.min.y * sy;
  const out: Placement[] = [];
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < across; j++) {
      const u = -long / 2 + (i + 0.5) * cellLong;
      const v = -short / 2 + (j + 0.5) * cellShort;
      const x = boxAlongX ? u : v;
      const z = boxAlongX ? v : u;
      out.push({ position: { x: x - turned.x, y, z: z - turned.z }, rotationY, scale: { ...scale } });
    }
  }
  return out;
}

/** Placements for any pool kind. */
export function placementsFor(pool: PackPool, bounds: Bounds3, box: Vec3): Placement[] {
  return pool.place === 'tile' ? tilePlacements(bounds, box, pool.tile) : [fitPlacement(bounds, box, pool.place)];
}

/** Apply a placement to an object (usually a model clone). */
export function applyPlacement(o: THREE.Object3D, p: Placement): void {
  o.position.set(p.position.x, p.position.y, p.position.z);
  o.rotation.set(0, p.rotationY, 0);
  o.scale.set(p.scale.x, p.scale.y, p.scale.z);
}

// ---------------------------------------------------------------- loading

export interface PackTemplate {
  /** Model as loaded, sharing geometry and the shared pack material; never add it to a scene, use `clonePack`. */
  readonly scene: THREE.Group;
  /** Model-space bounds (metres). */
  readonly bounds: Bounds3;
}

const templates = new Map<string, PackTemplate>();
const pending = new Map<string, Promise<PackTemplate | null>>();
const failed = new Set<string>();
const loadedListeners = new Set<() => void>();
let sharedMaterial: THREE.MeshLambertMaterial | null = null;
let loader: GLTFLoader | null = null;

const canLoad = (): boolean => typeof window !== 'undefined' && typeof fetch === 'function';

function boundsOf(o: THREE.Object3D): Bounds3 {
  const b = new THREE.Box3().setFromObject(o);
  return { min: { x: b.min.x, y: b.min.y, z: b.min.z }, max: { x: b.max.x, y: b.max.y, z: b.max.z } };
}

/** Swap every mesh onto the shared material; the first model's palette texture becomes the shared one. */
function adopt(scene: THREE.Group): void {
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const own = o.material as THREE.MeshStandardMaterial;
    if (!sharedMaterial) {
      const map = own.map ?? null;
      if (map) map.colorSpace = THREE.SRGBColorSpace;
      sharedMaterial = new THREE.MeshLambertMaterial({ map });
    } else {
      own.map?.dispose();
    }
    if ((own as THREE.Material) !== sharedMaterial) own.dispose();
    o.material = sharedMaterial;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  scene.updateMatrixWorld(true);
}

function startLoad(path: string): Promise<PackTemplate | null> {
  let p = pending.get(path);
  if (p) return p;
  loader ??= new GLTFLoader();
  p = loader
    .loadAsync(PACK_BASE + path)
    .then((gltf) => {
      adopt(gltf.scene);
      const t: PackTemplate = { scene: gltf.scene, bounds: boundsOf(gltf.scene) };
      templates.set(path, t);
      for (const cb of [...loadedListeners]) cb();
      return t;
    })
    .catch((err: unknown) => {
      failed.add(path);
      console.warn(`[pack] could not load ${path}`, err);
      return null;
    });
  pending.set(path, p);
  return p;
}

/** The loaded model, or null while it is loading (loading starts on the first call) or when it cannot load. */
export function packTemplate(path: string): PackTemplate | null {
  const t = templates.get(path);
  if (t) return t;
  if (canLoad() && !failed.has(path)) void startLoad(path);
  return null;
}

/** Resolves when the model is ready (null if it failed or cannot load here). */
export function whenPackLoaded(path: string): Promise<PackTemplate | null> {
  const t = templates.get(path);
  if (t) return Promise.resolve(t);
  if (!canLoad() || failed.has(path)) return Promise.resolve(null);
  return startLoad(path);
}

/** Called after any model finishes loading (the editor view uses it to redraw). Returns an unsubscribe. */
export function onPackLoaded(cb: () => void): () => void {
  loadedListeners.add(cb);
  return () => loadedListeners.delete(cb);
}

/** A copy that shares geometry and material with the template (cheap; nothing to dispose per copy). */
export function clonePack(t: PackTemplate): THREE.Group {
  return t.scene.clone(true);
}

/** Boxes thinner than this (roads, pavements) do not cast shadows: nothing to see, and it halves their draw cost. */
export const FLAT_NO_SHADOW = 0.25;

const mergedCache = new Map<string, THREE.Mesh | null>();

/**
 * All copies of a tiled box baked into ONE mesh (one draw call instead of one per tile), shared by every box of the
 * same model and size. Null when the template has no mesh.
 */
function mergedTiles(path: string, t: PackTemplate, placements: readonly Placement[], key: string): THREE.Mesh | null {
  const cacheKey = `${path}|${key}`;
  if (mergedCache.has(cacheKey)) return mergedCache.get(cacheKey) ?? null;
  const parts: THREE.BufferGeometry[] = [];
  let material: THREE.Material | null = null;
  let name = '';
  const holder = new THREE.Object3D();
  for (const p of placements) {
    applyPlacement(holder, p);
    holder.updateMatrix();
    t.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      material ??= o.material as THREE.Material;
      name ||= o.name;
      parts.push(o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(holder.matrix, o.matrixWorld)));
    });
  }
  const geometry = parts.length > 0 ? mergeGeometries(parts) : null;
  for (const g of parts) g.dispose();
  const mesh = geometry && material ? new THREE.Mesh(geometry, material) : null;
  if (mesh) mesh.name = name;
  mergedCache.set(cacheKey, mesh);
  return mesh;
}

/** Tests only: register a template without loading a file. Pass null to clear all templates. */
export function setPackTemplateForTests(path: string | null, scene?: THREE.Group): void {
  if (path === null) {
    templates.clear();
    mergedCache.clear();
    pending.clear();
    failed.clear();
    return;
  }
  if (!scene) throw new Error('scene required');
  scene.updateMatrixWorld(true);
  templates.set(path, { scene, bounds: boundsOf(scene) });
  for (const cb of [...loadedListeners]) cb();
}

/**
 * A group that holds the placed model copies for one entity. Until the model is loaded it shows `placeholder`
 * (if given); when the model arrives it calls `layout` again, so callers just call `layout` whenever the box changes.
 */
export class PackSlot {
  readonly object = new THREE.Group();
  private readonly copies = new THREE.Group();
  private placeholder: THREE.Object3D | null;
  private box: Vec3 | null = null;
  private laidFor = '';
  private readonly unsubscribe: () => void;

  constructor(
    readonly path: string,
    private readonly pool: PackPool,
    placeholder: THREE.Object3D | null = null,
    private readonly owner?: string,
  ) {
    this.placeholder = placeholder;
    if (placeholder) this.object.add(placeholder);
    this.object.add(this.copies);
    this.unsubscribe = onPackLoaded(() => {
      if (this.box) this.layout(this.box);
    });
    packTemplate(path);
  }

  get ready(): boolean {
    return templates.has(this.path);
  }

  /** Place copies for a box of this size (world units, centred on the slot origin). Cheap when nothing changed. */
  layout(box: Vec3): void {
    this.box = { ...box };
    const t = packTemplate(this.path);
    if (!t) return;
    const key = `${box.x.toFixed(3)}|${box.y.toFixed(3)}|${box.z.toFixed(3)}`;
    if (key === this.laidFor) return;
    this.laidFor = key;
    if (this.placeholder) {
      this.object.remove(this.placeholder);
      this.placeholder = null;
    }
    this.copies.clear();
    const placements = placementsFor(this.pool, t.bounds, box);
    const merged = placements.length > 1 ? mergedTiles(this.path, t, placements, key) : null;
    if (merged) {
      // Shares the cached geometry; only the mesh object (owner id, shadow flags) is per box.
      const mesh = new THREE.Mesh(merged.geometry, merged.material);
      mesh.name = merged.name;
      this.copies.add(mesh);
    } else {
      for (const p of placements) {
        const copy = clonePack(t);
        applyPlacement(copy, p);
        this.copies.add(copy);
      }
    }
    const shadows = box.y >= FLAT_NO_SHADOW;
    this.copies.traverse((o) => {
      if (this.owner !== undefined) o.userData.ownerNodeId = this.owner;
      if (o instanceof THREE.Mesh) {
        o.castShadow = shadows;
        o.receiveShadow = true;
      }
    });
    this.object.updateMatrixWorld(true);
  }

  dispose(): void {
    this.unsubscribe();
    this.copies.clear();
  }
}
