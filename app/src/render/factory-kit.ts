import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonMat } from './arm-part-models';

/**
 * Building blocks of the factory looks (AGV, tidy arm, cartons, chute, belt). A figure is described as a list of
 * coloured parts in real units and baked into ONE geometry with a colour per vertex, drawn with one shared toon
 * material (same shading steps as `toonMat`), so a whole chassis or joint costs a single draw call. Baked geometry is
 * cached by a key (sizes and colours), so every piece of the same size shares it.
 */

export type XYZ = { x: number; y: number; z: number };

/** One coloured part of a baked figure. The geometry is consumed (disposed) by `bake`. */
export interface Part {
  geo: THREE.BufferGeometry;
  color: string;
  at?: [number, number, number];
  /** Euler turn (XYZ order) applied before the shift. */
  turn?: [number, number, number];
}

const gradient = toonMat('#ffffff').gradientMap;

/** Shared by every baked toon mesh: the vertex colour is the part colour. */
export const VERTEX_TOON = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient });
/** Thin open shells (a cloth bag, a funnel) are seen from both sides. */
export const VERTEX_TOON_DOUBLE = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient, side: THREE.DoubleSide });
/** Lamps and lights: unlit, so they read as glowing. */
export const VERTEX_GLOW = new THREE.MeshBasicMaterial({ vertexColors: true });

const glowMats = new Map<string, THREE.MeshBasicMaterial>();
/** One unlit material per lamp colour (status strips and gate lamps switch between a handful of colours). */
export function glowMat(hex: string): THREE.MeshBasicMaterial {
  let m = glowMats.get(hex);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: hex });
    glowMats.set(hex, m);
  }
  return m;
}

/** A toon material that carries a picture (the moving belt surface). */
export function toonMapMat(map: THREE.Texture): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ map, gradientMap: gradient });
}

export const q = (v: number): string => (Math.round(v * 1000) / 1000).toString();
export const sizeKey = (s: XYZ): string => `${q(s.x)}x${q(s.y)}x${q(s.z)}`;

// ---------------------------------------------------------------- primitives (not cached: the baked result is)

export const box = (w: number, h: number, d: number): THREE.BufferGeometry => new THREE.BoxGeometry(w, h, d);

export function rbox(w: number, h: number, d: number, r = 0.02, seg = 1): THREE.BufferGeometry {
  const [x, y, z] = [Math.max(w, 0.006), Math.max(h, 0.006), Math.max(d, 0.006)];
  return new RoundedBoxGeometry(x, y, z, seg, Math.max(0.001, Math.min(r, Math.min(x, y, z) / 2 - 1e-3)));
}

/** Cylinder along an axis; `r2` is the radius at the +axis end. */
export function cyl(axis: 'x' | 'y' | 'z', r: number, len: number, seg = 16, r2 = r): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r2, r, len, seg);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  return g;
}

/**
 * Flat plate with rounded corners seen from above and a bevelled edge: `L` along x, `W` along z, y from 0 to `T`.
 * `r` corner radius, `b` bevel, `cs` segments per corner, `bs` bevel steps.
 */
export function plate(L: number, W: number, T: number, r: number, b = 0.012, cs = 2, bs = 1): THREE.BufferGeometry {
  const bb = Math.max(0.001, Math.min(b, T / 2 - 0.001, L / 2 - 0.002, W / 2 - 0.002));
  const w = L - 2 * bb;
  const h = W - 2 * bb;
  const rr = Math.max(0.001, Math.min(r - bb, w / 2 - 0.001, h / 2 - 0.001));
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + rr, -h / 2);
  s.lineTo(w / 2 - rr, -h / 2);
  s.absarc(w / 2 - rr, -h / 2 + rr, rr, -Math.PI / 2, 0, false);
  s.lineTo(w / 2, h / 2 - rr);
  s.absarc(w / 2 - rr, h / 2 - rr, rr, 0, Math.PI / 2, false);
  s.lineTo(-w / 2 + rr, h / 2);
  s.absarc(-w / 2 + rr, h / 2 - rr, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(-w / 2, -h / 2 + rr);
  s.absarc(-w / 2 + rr, -h / 2 + rr, rr, Math.PI, Math.PI * 1.5, false);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(T - 2 * bb, 0.001), bevelEnabled: true, bevelSize: bb, bevelThickness: bb, bevelSegments: bs, curveSegments: cs });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bb, 0);
  return g;
}

// ---------------------------------------------------------------- baking

const turnEuler = new THREE.Euler();
const turnQuat = new THREE.Quaternion();
const shift = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);
const matrix = new THREE.Matrix4();

/** Merges the parts into one geometry (position, normal, colour); the part geometries are freed. */
export function bake(parts: readonly Part[]): THREE.BufferGeometry {
  const list = parts.map((p) => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    p.geo.dispose();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    g.clearGroups();
    turnQuat.setFromEuler(turnEuler.set(p.turn?.[0] ?? 0, p.turn?.[1] ?? 0, p.turn?.[2] ?? 0));
    shift.set(p.at?.[0] ?? 0, p.at?.[1] ?? 0, p.at?.[2] ?? 0);
    g.applyMatrix4(matrix.compose(shift, turnQuat, ONE));
    const c = new THREE.Color(p.color);
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  const out = list.length > 0 ? mergeGeometries(list) : null;
  for (const g of list) g.dispose();
  const geo = out ?? new THREE.BufferGeometry();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

const baked = new Map<string, THREE.BufferGeometry>();
/** The baked geometry for `key`, built on first use and then shared for the life of the page. */
export function bakedGeo(key: string, parts: () => readonly Part[]): THREE.BufferGeometry {
  let g = baked.get(key);
  if (!g) {
    g = bake(parts());
    baked.set(key, g);
  }
  return g;
}

/** A baked mesh that casts a shadow; `receive` for flat tops things rest on. */
export function bakedMesh(key: string, parts: () => readonly Part[], material: THREE.Material = VERTEX_TOON, receive = false): THREE.Mesh {
  const m = new THREE.Mesh(bakedGeo(key, parts), material);
  m.castShadow = !(material instanceof THREE.MeshBasicMaterial);
  m.receiveShadow = receive;
  return m;
}

/** Triangles and meshes (draw calls per pass) under an object; for tests and reports. */
export function drawCost(o: THREE.Object3D): { meshes: number; triangles: number } {
  let meshes = 0;
  let triangles = 0;
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    meshes++;
    triangles += (m.geometry.index ? m.geometry.index.count : (m.geometry.getAttribute('position')?.count ?? 0)) / 3;
  });
  return { meshes, triangles: Math.round(triangles) };
}

// ---------------------------------------------------------------- pictures

const textures = new Map<string, THREE.Texture | null>();
/** A picture drawn once on a canvas and shared; null where there is no canvas (headless tests). */
export function canvasTexture(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.Texture | null {
  if (textures.has(key)) return textures.get(key) ?? null;
  let tex: THREE.Texture | null = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    if (g) {
      draw(g, w, h);
      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
    }
  }
  textures.set(key, tex);
  return tex;
}
