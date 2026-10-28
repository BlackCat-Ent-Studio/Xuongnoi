import * as THREE from 'three';
import type { EntityView, ViewMode } from '../engine/types';

export const SIDE_VIEW_HEIGHT = 16;
export const MIN_PITCH = 0.1;
export const MAX_PITCH = 1.45;
const FAR = 200;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function clampPitch(p: number): number {
  return clamp(p, MIN_PITCH, MAX_PITCH);
}

/** Frame-rate independent exponential smoothing toward a target. */
export function smoothValue(current: number, target: number, dt: number, rate = 8): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

/** Direction the 3d camera looks horizontally. yaw 0 = toward -Z. */
export function yawForward(yaw: number): { x: number; z: number } {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

/** Offset from the orbit target to the camera position (camera sits behind the look direction). */
export function orbitOffset(yaw: number, pitch: number, dist: number): THREE.Vector3 {
  const f = yawForward(yaw);
  const h = Math.cos(pitch) * dist;
  return new THREE.Vector3(-f.x * h, Math.sin(pitch) * dist, -f.z * h);
}

export interface Bounds {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export function entityBounds(entities: readonly EntityView[]): Bounds | null {
  let any = false;
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const e of entities) {
    if (!e.visible) continue;
    any = true;
    min.x = Math.min(min.x, e.position.x - e.size.x / 2);
    min.y = Math.min(min.y, e.position.y - e.size.y / 2);
    min.z = Math.min(min.z, e.position.z - e.size.z / 2);
    max.x = Math.max(max.x, e.position.x + e.size.x / 2);
    max.y = Math.max(max.y, e.position.y + e.size.y / 2);
    max.z = Math.max(max.z, e.position.z + e.size.z / 2);
  }
  return any ? { min, max } : null;
}

/** Visible height of an orthographic view that fits a w x h area at the given aspect. */
export function fitOrthoHeight(w: number, h: number, aspect: number): number {
  return Math.max(SIDE_VIEW_HEIGHT, h + 4, (w + 4) / Math.max(aspect, 0.01));
}

/**
 * Owns the three.js camera for one view mode. `update` is called every rendered frame;
 * `follow` = true tracks the first character, false frames all entities.
 */
export class CameraRig {
  readonly mode: ViewMode;
  readonly camera: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  yaw = 0;
  pitch = 0.6;
  distance = 14;
  private aspect = 1;
  private orthoHeight = SIDE_VIEW_HEIGHT;
  private target = new THREE.Vector3();
  private snapNext = true;

  constructor(mode: ViewMode) {
    this.mode = mode;
    this.camera =
      mode === '3d'
        ? new THREE.PerspectiveCamera(50, 1, 0.1, FAR)
        : new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, FAR);
    this.applyFrustum();
  }

  resize(width: number, height: number): void {
    this.aspect = width > 0 && height > 0 ? width / height : 1;
    this.applyFrustum();
  }

  /** Next update jumps to the target instead of smoothing. */
  snap(): void {
    this.snapNext = true;
  }

  rotate(dx: number, dy: number): void {
    if (this.mode !== '3d') return;
    this.yaw -= dx * 0.005;
    this.pitch = clampPitch(this.pitch + dy * 0.005);
  }

  zoom(deltaY: number): void {
    const f = Math.exp(deltaY * 0.001);
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.distance = clamp(this.distance * f, 4, 80);
    } else {
      this.orthoHeight = clamp(this.orthoHeight * f, 6, 80);
      this.applyFrustum();
    }
  }

  update(entities: readonly EntityView[], dt: number, follow: boolean): void {
    const bounds = entityBounds(entities);
    const character = follow ? entities.find((e) => e.kind === 'character' && e.visible) : undefined;
    let goal: THREE.Vector3;
    if (character) {
      goal = new THREE.Vector3(character.position.x, character.position.y, character.position.z);
    } else if (bounds) {
      goal = bounds.min.clone().add(bounds.max).multiplyScalar(0.5);
      if (!follow) this.fitToBounds(bounds);
    } else {
      goal = new THREE.Vector3(0, this.mode === '3d' ? 2 : 0, 0);
    }
    if (this.snapNext) {
      this.target.copy(goal);
      this.snapNext = false;
    } else {
      this.target.set(
        smoothValue(this.target.x, goal.x, dt),
        smoothValue(this.target.y, goal.y, dt),
        smoothValue(this.target.z, goal.z, dt),
      );
    }
    this.place();
  }

  private fitToBounds(b: Bounds): void {
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const size = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
      this.distance = clamp(size * 1.4, 14, 80);
    } else if (this.mode === '2d-side') {
      this.orthoHeight = fitOrthoHeight(b.max.x - b.min.x, b.max.y - b.min.y, this.aspect);
      this.applyFrustum();
    } else {
      this.orthoHeight = fitOrthoHeight(b.max.x - b.min.x, b.max.z - b.min.z, this.aspect);
      this.applyFrustum();
    }
  }

  private place(): void {
    const t = this.target;
    const cam = this.camera;
    if (this.mode === '2d-side') {
      cam.position.set(t.x, t.y, 50);
      cam.up.set(0, 1, 0);
      cam.lookAt(t.x, t.y, 0);
    } else if (this.mode === '2d-top') {
      cam.position.set(t.x, 50, t.z);
      cam.up.set(0, 0, -1);
      cam.lookAt(t.x, 0, t.z);
    } else {
      const look = new THREE.Vector3(t.x, t.y + 1, t.z);
      cam.position.copy(look).add(orbitOffset(this.yaw, this.pitch, this.distance));
      cam.up.set(0, 1, 0);
      cam.lookAt(look);
    }
    cam.updateMatrixWorld();
  }

  private applyFrustum(): void {
    const cam = this.camera;
    if (cam instanceof THREE.PerspectiveCamera) {
      cam.aspect = this.aspect;
    } else {
      const h = this.orthoHeight / 2;
      cam.left = -h * this.aspect;
      cam.right = h * this.aspect;
      cam.top = h;
      cam.bottom = -h;
    }
    cam.updateProjectionMatrix();
  }
}
