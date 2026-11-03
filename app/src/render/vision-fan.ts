import * as THREE from 'three';
import type { EntityId, EntityView, SolidBox, World } from '../engine/types';
import { liveVisionNotes } from '../nodes/sight-notes';

/** Fan colours: yellow while nothing is seen, red when the sensor sees something. */
const CALM = 0xffe033;
const ALERT = 0xff3a2a;
/** Fill opacity at the viewer and at the far edge of the fan. */
const NEAR_ALPHA = 0.8;
const FAR_ALPHA = 0.42;
/** A ray every this many degrees of the cone (at most MAX_RAYS). */
const RAY_STEP_DEG = 2.5;
const MIN_RAYS = 8;
const MAX_RAYS = 72;
/** Height of the fan above the viewer's feet; a hair, so it lies on the floor without fighting it. */
const LIFT = 0.06;

export interface FanSpec {
  id: EntityId;
  /** Where the viewer's feet are, and the height of its eyes (the plane crates must reach to block sight). */
  x: number;
  z: number;
  feetY: number;
  eyeY: number;
  facing: { x: number; z: number };
  range: number;
  /** Full cone angle in degrees. */
  angle: number;
  walls: boolean;
  seen: boolean;
}

/** Specs of every viewer that has a "Tầm nhìn" sensor wired and reporting. Empty for views other than 3D. */
export function fanSpecs(world: World, tick: number, entities: readonly EntityView[], mode: string): FanSpec[] {
  if (mode !== '3d') return [];
  const out: FanSpec[] = [];
  for (const { viewer, note } of liveVisionNotes(world, tick)) {
    const e = entities.find((x) => x.id === viewer);
    if (!e || !e.visible || e.kind !== 'character' || e.seatedIn !== undefined || e.fallen !== undefined) continue;
    const f = e.facing && Math.hypot(e.facing.x, e.facing.z) > 1e-6 ? e.facing : { x: 1, z: 0 };
    out.push({
      id: viewer,
      x: e.position.x,
      z: e.position.z,
      feetY: e.position.y - e.size.y / 2,
      eyeY: e.position.y,
      facing: f,
      range: note.range,
      angle: note.angle,
      walls: note.walls,
      seen: note.seen,
    });
  }
  return out;
}

/** Distances along the ray (ox, oz) + t (dx, dz) where it enters and leaves the box on the ground plane, or null when it misses. */
function rayBox(ox: number, oz: number, dx: number, dz: number, b: SolidBox): { enter: number; leave: number } | null {
  let t0 = 0;
  let t1 = Infinity;
  for (const [o, d, c, s] of [[ox, dx, b.position.x, b.size.x], [oz, dz, b.position.z, b.size.z]] as const) {
    const lo = c - s / 2;
    const hi = c + s / 2;
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let near = (lo - o) / d;
    let far = (hi - o) / d;
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
    if (t0 > t1) return null;
  }
  return { enter: t0, leave: t1 };
}

/**
 * The far edge of the fan as ground points, cut short by the range, by every solid block that reaches eye height, and
 * by the edge of the floor slab the viewer stands on (the fan is painted on that floor and stops where it ends).
 */
export function fanOutline(spec: FanSpec, boxes: readonly SolidBox[]): { x: number; z: number }[] {
  const half = (Math.min(360, Math.max(1, spec.angle)) / 2) * (Math.PI / 180);
  const n = Math.max(MIN_RAYS, Math.min(MAX_RAYS, Math.round(spec.angle / RAY_STEP_DEG)));
  const centre = Math.atan2(spec.facing.z, spec.facing.x);
  const blockers = spec.walls ? boxes.filter((b) => Math.abs(b.position.y - spec.eyeY) <= b.size.y / 2) : [];
  const ground = boxes.find(
    (b) => Math.abs(b.position.y + b.size.y / 2 - spec.feetY) <= 0.1 && Math.abs(spec.x - b.position.x) <= b.size.x / 2 && Math.abs(spec.z - b.position.z) <= b.size.z / 2,
  );
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const a = centre - half + (2 * half * i) / n;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    let r = spec.range;
    for (const b of blockers) {
      const hit = rayBox(spec.x, spec.z, dx, dz, b);
      if (hit) r = Math.min(r, hit.enter);
    }
    const edge = ground ? rayBox(spec.x, spec.z, dx, dz, ground) : null;
    if (edge) r = Math.min(r, edge.leave);
    pts.push({ x: spec.x + dx * r, z: spec.z + dz * r });
  }
  return pts;
}

interface Fan {
  fill: THREE.Mesh;
  edge: THREE.LineLoop;
}

/**
 * Translucent sight fans on the floor, one per character that has a "Tầm nhìn" sensor reporting. Drawn from the
 * sensor's own numbers and the viewer's facing, cut at solid blocks, so what is painted is what the sensor sees.
 */
export class VisionFanLayer {
  private readonly fans = new Map<EntityId, Fan>();

  constructor(private readonly parent: THREE.Object3D) {}

  sync(specs: readonly FanSpec[], boxes: () => readonly SolidBox[]): void {
    const seen = new Set<EntityId>();
    const solid = specs.length > 0 ? boxes() : [];
    for (const spec of specs) {
      seen.add(spec.id);
      let fan = this.fans.get(spec.id);
      if (!fan) {
        fan = this.create();
        this.fans.set(spec.id, fan);
      }
      this.update(fan, spec, fanOutline(spec, solid));
    }
    for (const [id, fan] of this.fans) {
      if (!seen.has(id)) this.remove(id, fan);
    }
  }

  private create(): Fan {
    const fillMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    });
    const fill = new THREE.Mesh(new THREE.BufferGeometry(), fillMaterial);
    fill.renderOrder = 5;
    fill.frustumCulled = false;
    fill.raycast = () => undefined;
    const edge = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false }));
    edge.renderOrder = 6;
    edge.frustumCulled = false;
    edge.raycast = () => undefined;
    this.parent.add(fill, edge);
    return { fill, edge };
  }

  private update(fan: Fan, spec: FanSpec, outline: readonly { x: number; z: number }[]): void {
    const y = spec.feetY + LIFT;
    const colour = new THREE.Color(spec.seen ? ALERT : CALM);
    // Triangle fan: the viewer, then the outline points. The fill fades from the viewer outwards.
    const positions: number[] = [spec.x, y, spec.z];
    const colours: number[] = [colour.r, colour.g, colour.b, NEAR_ALPHA];
    for (const p of outline) {
      positions.push(p.x, y, p.z);
      colours.push(colour.r, colour.g, colour.b, FAR_ALPHA);
    }
    const index: number[] = [];
    for (let i = 1; i < outline.length; i++) index.push(0, i, i + 1);
    const g = fan.fill.geometry;
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 4));
    g.setIndex(index);
    g.computeBoundingSphere();

    // Outline: the viewer and the far edge, so the fan reads as a shape even over a busy floor.
    const line = [spec.x, y + 0.005, spec.z, ...outline.flatMap((p) => [p.x, y + 0.005, p.z])];
    fan.edge.geometry.setAttribute('position', new THREE.Float32BufferAttribute(line, 3));
    (fan.edge.material as THREE.LineBasicMaterial).color.copy(colour);
  }

  private remove(id: EntityId, fan: Fan): void {
    this.parent.remove(fan.fill, fan.edge);
    fan.fill.geometry.dispose();
    (fan.fill.material as THREE.Material).dispose();
    fan.edge.geometry.dispose();
    (fan.edge.material as THREE.Material).dispose();
    this.fans.delete(id);
  }

  dispose(): void {
    for (const [id, fan] of [...this.fans]) this.remove(id, fan);
  }
}
