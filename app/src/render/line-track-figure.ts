import * as THREE from 'three';
import type { EntityView, LineTrackSpec, ViewMode } from '../engine/types';

/** The ribbon floats this far above the floor top so it never fights with it for the same pixels. */
const RIBBON_LIFT = 0.012;
/** Half the thickness of the strip drawn in the side view, where the floor is seen edge-on. */
const SIDE_HALF_WIDTH = 0.03;
const JOIN_SEGMENTS = 12;

/**
 * Flat ribbon geometry along a path: a rectangle for every piece and a round cap on every point, which is exactly the area
 * the line sensors count as "on the line". `place` maps a plane point to the world.
 */
export function ribbonGeometry(track: LineTrackSpec, halfWidth: number, place: (u: number, v: number) => [number, number, number], normal: [number, number, number]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const vertex = (u: number, v: number): number => {
    pos.push(...place(u, v));
    nor.push(...normal);
    return pos.length / 3 - 1;
  };
  const { path, closed } = track;
  const n = path.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = path[i]!;
    const b = path[(i + 1) % n]!;
    const du = b.u - a.u;
    const dv = b.v - a.v;
    const len = Math.hypot(du, dv);
    if (len < 1e-9) continue;
    const nu = (-dv / len) * halfWidth;
    const nv = (du / len) * halfWidth;
    const q = [vertex(a.u + nu, a.v + nv), vertex(a.u - nu, a.v - nv), vertex(b.u - nu, b.v - nv), vertex(b.u + nu, b.v + nv)];
    idx.push(q[0]!, q[1]!, q[2]!, q[0]!, q[2]!, q[3]!);
  }
  for (const p of path) {
    const c = vertex(p.u, p.v);
    const first = pos.length / 3;
    for (let k = 0; k < JOIN_SEGMENTS; k++) {
      const t = (2 * Math.PI * k) / JOIN_SEGMENTS;
      vertex(p.u + Math.cos(t) * halfWidth, p.v + Math.sin(t) * halfWidth);
    }
    for (let k = 0; k < JOIN_SEGMENTS; k++) idx.push(c, first + k, first + ((k + 1) % JOIN_SEGMENTS));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** A painted line as a flat ribbon on the floor (a thin strip along the floor in the side view). */
export class LineTrackFigure {
  readonly object = new THREE.Group();
  private readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  private color: string;

  constructor(view: EntityView, mode: ViewMode) {
    this.color = view.color;
    const material = new THREE.MeshLambertMaterial({ color: view.color, side: THREE.DoubleSide });
    const track = view.track ?? { path: [], closed: false, width: 0 };
    const y = view.position.y;
    const geometry =
      mode === '2d-side'
        ? ribbonGeometry(track, SIDE_HALF_WIDTH, (u, v) => [u, v + SIDE_HALF_WIDTH, 0.02], [0, 0, 1])
        : ribbonGeometry(track, track.width / 2, (u, v) => [u, y + RIBBON_LIFT, v], [0, 1, 0]);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.userData.ownerNodeId = view.ownerNodeId;
    this.object.add(this.mesh);
  }

  update(view: EntityView): void {
    if (view.color !== this.color) {
      this.color = view.color;
      this.mesh.material.color.set(view.color);
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

/** The marker under a line sensor's spot: a flat disc as wide as the spot, lit when the sensor sees the line. */
export class LineDotFigure {
  readonly object = new THREE.Group();
  private readonly mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private color: string;

  constructor(view: EntityView, private readonly mode: ViewMode) {
    this.color = view.color;
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: view.color, side: THREE.DoubleSide }));
    if (mode !== '2d-side') this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.userData.ownerNodeId = view.ownerNodeId;
    this.object.add(this.mesh);
  }

  update(view: EntityView): void {
    this.object.position.set(view.position.x, view.position.y, this.mode === '2d-side' ? 0.05 : view.position.z);
    if (this.mode === '2d-side') this.object.scale.set(view.size.x, view.size.x, 1);
    else this.object.scale.set(view.size.x, 1, view.size.x);
    if (view.color !== this.color) {
      this.color = view.color;
      this.mesh.material.color.set(view.color);
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
