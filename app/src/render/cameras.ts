import * as THREE from 'three';
import type { EntityView, PlayCameraCommand, ViewMode } from '../engine/types';
import { CameraDirector } from './camera-director';

export const SIDE_VIEW_HEIGHT = 16;
/** The default framing is this many times closer than the raw fit. */
export const VIEW_CLOSENESS = 1.5;
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 4;
export const MIN_PITCH = 0.1;
export const MAX_PITCH = 1.45;
const DEFAULT_DISTANCE = 14;
const FAR = 200;
const FIT_PAD = 2.5;
const FIT_MIN_HEIGHT = 8;

/** Fractions of the canvas height covered at the top (HUD) and bottom (task box); `pitch` = fixed 3D tilt. */
export interface StageFit {
  top: number;
  bottom: number;
  pitch?: number;
  /** Owner node id of the character to close in on; absent / null = whole-scene overview. */
  follow?: string | null;
}

interface OverviewFrame {
  target: THREE.Vector3;
  size: number;
  bounds: Bounds;
}

/** Followed character fills about this share of the visible stage height. */
const FOLLOW_FRACTION = 0.3;
const FOLLOW_MIN_DISTANCE = 3.5;
const FIT_EASE = 5;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function clampPitch(p: number): number {
  return clamp(p, MIN_PITCH, MAX_PITCH);
}

export function clampZoom(m: number): number {
  return clamp(m, MIN_ZOOM, MAX_ZOOM);
}

/** Zoom magnification after a wheel step (deltaY > 0 zooms out), clamped. */
export function zoomAfterWheel(current: number, deltaY: number): number {
  return clampZoom(current * Math.exp(-deltaY * 0.001));
}

/**
 * New view centre (screen-plane axes u = right, v = up) so the world point under the cursor
 * (`ndc`, -1..1) stays under the cursor while the visible height changes from `oldSize` to `newSize`.
 */
export function zoomCenter(
  center: { u: number; v: number },
  ndc: { x: number; y: number },
  aspect: number,
  oldSize: number,
  newSize: number,
): { u: number; v: number } {
  return {
    u: center.u + (ndc.x * aspect * (oldSize - newSize)) / 2,
    v: center.v + (ndc.y * (oldSize - newSize)) / 2,
  };
}

/** Centre shift (u right, v up) for dragging an orthographic view by (dx, dy) screen pixels. */
export function panOrthoDelta(
  dx: number,
  dy: number,
  viewHeight: number,
  canvasHeightPx: number,
): { u: number; v: number } {
  const wpp = viewHeight / Math.max(canvasHeightPx, 1);
  return { u: -dx * wpp, v: dy * wpp };
}

/** Ground-plane (x, z) shift of the 3d orbit target for a drag of (dx, dy) pixels; `scale` = world units per pixel. */
export function panGroundDelta(yaw: number, dx: number, dy: number, scale: number): { x: number; z: number } {
  const f = yawForward(yaw);
  const rx = -f.z;
  const rz = f.x;
  return { x: (-rx * dx + f.x * dy) * scale, z: (-rz * dx + f.z * dy) * scale };
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

const GROUND_MIN_SPAN = 12;
const GROUND_MAX_THICKNESS = 1.2;
const GROUND_MARGIN = 3;

/**
 * Scene box for the puzzle stage. A wide, flat block is ground: it only widens the box by a margin around
 * the other objects (so a 30-unit floor does not shrink everything), but its height still counts.
 */
export function stageBounds(entities: readonly EntityView[]): Bounds | null {
  const isGround = (e: EntityView): boolean =>
    e.kind === 'block' && e.size.y <= GROUND_MAX_THICKNESS && e.size.x >= GROUND_MIN_SPAN;
  const core = entityBounds(entities.filter((e) => !isGround(e)));
  const ground = entityBounds(entities.filter(isGround));
  if (!core || !ground) return entityBounds(entities);
  const m = (lo: number, hi: number): number => Math.max(GROUND_MARGIN, (hi - lo) * 0.1);
  const mx = m(core.min.x, core.max.x);
  const mz = m(core.min.z, core.max.z);
  const min = core.min.clone();
  const max = core.max.clone();
  min.x = Math.max(ground.min.x, min.x - mx);
  max.x = Math.min(ground.max.x, max.x + mx);
  min.z = Math.max(ground.min.z, min.z - mz);
  max.z = Math.min(ground.max.z, max.z + mz);
  min.y = Math.min(min.y, ground.min.y);
  max.y = Math.max(max.y, ground.max.y);
  return { min, max };
}

/** The character the play camera follows: the first visible player, else the first visible character (bots only). */
export function pickFollowTarget(entities: readonly EntityView[]): EntityView | undefined {
  const characters = entities.filter((e) => e.kind === 'character' && e.visible);
  return characters.find((e) => e.role !== 'bot') ?? characters[0];
}

/** Visible height of an orthographic view that fits a w x h area at the given aspect. */
export function fitOrthoHeight(w: number, h: number, aspect: number): number {
  return Math.max(SIDE_VIEW_HEIGHT, h + 4, (w + 4) / Math.max(aspect, 0.01));
}

interface ViewState {
  target: THREE.Vector3;
  mag: number;
  /** Visible height (ortho) or orbit distance (3d) at magnification 1. */
  homeSize: number;
  /** True until the default framing has been computed from real content. */
  homePending: boolean;
}

/**
 * Owns the three.js camera for one view mode. `update` is called every rendered frame.
 * `follow` = true tracks the first character (play); false is the free edit camera whose
 * position and zoom persist until `resetView`.
 */
export class CameraRig {
  readonly mode: ViewMode;
  readonly camera: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  yaw = 0;
  pitch = 0.6;
  private aspect = 1;
  private canvasHeight = 1;
  private view: ViewState;
  private saved: ViewState | null = null;
  private following = false;
  private target = new THREE.Vector3();
  private snapNext = true;
  private readonly director = new CameraDirector();
  /** Puzzle stage: frame the whole scene inside the part of the canvas left uncovered by the HUD and task box. */
  private fit: StageFit | null = null;
  private fitDirty = true;
  private overview: OverviewFrame | null = null;
  private cur: { target: THREE.Vector3; size: number } | null = null;

  constructor(mode: ViewMode) {
    this.mode = mode;
    this.camera =
      mode === '3d'
        ? new THREE.PerspectiveCamera(50, 1, 0.1, FAR)
        : new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, FAR);
    this.view = this.freshView();
    this.applySize();
  }

  private freshView(): ViewState {
    return {
      target: new THREE.Vector3(0, this.mode === '3d' ? 2 : 0, 0),
      mag: 1,
      homeSize: (this.mode === '3d' ? DEFAULT_DISTANCE : SIDE_VIEW_HEIGHT) / VIEW_CLOSENESS,
      homePending: true,
    };
  }

  /** Visible height (ortho) or orbit distance (3d) at the current zoom. */
  get size(): number {
    return this.view.homeSize / (this.view.mag * (this.following ? this.director.zoom : 1));
  }

  /** The point the camera orbits / centres on (ground level of the followed subject). */
  get focus(): { x: number; y: number; z: number } {
    return this.target;
  }

  get zoomMagnification(): number {
    return this.view.mag;
  }

  resize(width: number, height: number): void {
    this.aspect = width > 0 && height > 0 ? width / height : 1;
    this.canvasHeight = Math.max(height, 1);
    this.applySize();
  }

  /** Next update jumps to the target instead of smoothing. */
  snap(): void {
    this.snapNext = true;
    this.fitDirty = true;
  }

  /** Switches the fixed "fit the scene" framing on (with the covered fractions of the canvas) or off. */
  setFit(fit: StageFit | null): void {
    if (JSON.stringify(fit) === JSON.stringify(this.fit)) return;
    this.fit = fit;
    this.fitDirty = true;
    this.following = false;
    if (fit && this.mode === '3d' && fit.pitch !== undefined) this.pitch = clampPitch(fit.pitch);
    this.applySize();
  }

  /** Share of the canvas height that stays visible when `fit` is on. */
  private get visibleFrac(): number {
    return this.fit ? Math.max(0.2, 1 - this.fit.top - this.fit.bottom) : 1;
  }

  /** Back to the default framing of the current content. */
  resetView(): void {
    this.view = this.freshView();
    if (this.following) this.view.homePending = false;
    else this.saved = null;
    this.snapNext = true;
    this.applySize();
  }

  rotate(dx: number, dy: number): void {
    if (this.mode !== '3d' || this.fit) return;
    this.yaw -= dx * 0.005;
    this.pitch = clampPitch(this.pitch + dy * 0.005);
  }

  /**
   * Wheel zoom. `ndc` = cursor in -1..1 canvas coords; the 2d edit camera keeps the world point under
   * the cursor fixed. While following, the centre stays on the character.
   */
  zoom(deltaY: number, ndc: { x: number; y: number } = { x: 0, y: 0 }): void {
    if (this.fit) return;
    const v = this.view;
    const oldSize = this.size;
    v.mag = zoomAfterWheel(v.mag, deltaY);
    if (this.mode !== '3d' && !this.following) {
      const side = this.mode === '2d-side';
      const c = zoomCenter({ u: v.target.x, v: side ? v.target.y : -v.target.z }, ndc, this.aspect, oldSize, this.size);
      v.target.x = c.u;
      if (side) v.target.y = c.v;
      else v.target.z = -c.v;
    }
    this.applySize();
  }

  /** Drag-pan by screen pixels (edit camera only). */
  pan(dx: number, dy: number): void {
    if (this.following || this.fit) return;
    const t = this.view.target;
    if (this.mode === '3d') {
      const d = panGroundDelta(this.yaw, dx, dy, this.size * 0.0016);
      t.x += d.x;
      t.z += d.z;
    } else {
      const d = panOrthoDelta(dx, dy, this.size, this.canvasHeight);
      t.x += d.u;
      if (this.mode === '2d-side') t.y += d.v;
      else t.z -= d.v;
    }
  }

  update(entities: readonly EntityView[], dt: number, follow: boolean, playCamera: PlayCameraCommand | null = null): void {
    if (this.fit) {
      this.updateFit(entities, dt);
      return;
    }
    this.syncFollow(follow);
    const cmd = follow ? playCamera : null;
    this.director.update(cmd, dt, this.snapNext || !follow);
    if (this.mode === '3d' && cmd?.pitch !== undefined) {
      const goal = clampPitch(cmd.pitch);
      this.pitch = this.snapNext ? goal : smoothValue(this.pitch, goal, dt, this.director.rate(cmd));
    }
    const bounds = entityBounds(entities);
    if (follow) {
      const character = pickFollowTarget(entities);
      let base: THREE.Vector3;
      if (character) base = new THREE.Vector3(character.position.x, character.position.y, character.position.z);
      else if (bounds) base = bounds.min.clone().add(bounds.max).multiplyScalar(0.5);
      else base = new THREE.Vector3(0, this.mode === '3d' ? 2 : 0, 0);
      const goal = this.director.goal(cmd, entities, base);
      if (this.snapNext) this.target.set(goal.x, goal.y, goal.z);
      else {
        const rate = this.director.rate(cmd);
        this.target.set(
          smoothValue(this.target.x, goal.x, dt, rate),
          smoothValue(this.target.y, goal.y, dt, rate),
          smoothValue(this.target.z, goal.z, dt, rate),
        );
      }
    } else {
      if (this.view.homePending && bounds) {
        this.view.homeSize = this.homeFor(bounds);
        this.view.target.copy(bounds.min.clone().add(bounds.max).multiplyScalar(0.5));
        this.view.homePending = false;
      }
      this.target.copy(this.view.target);
    }
    this.snapNext = false;
    this.applySize();
    this.place();
  }

  /** Fixed framing of the whole scene: same view before and during play, recomputed on snap() only. */
  private updateFit(entities: readonly EntityView[], dt: number): void {
    const bounds = this.fitDirty ? stageBounds(entities) : null;
    if (this.fitDirty && bounds) {
      this.fitDirty = false;
      const centre = bounds.min.clone().add(bounds.max).multiplyScalar(0.5);
      const w = bounds.max.x - bounds.min.x;
      const virtAspect = this.aspect / this.visibleFrac;
      this.view.mag = 1;
      let target: THREE.Vector3;
      let size: number;
      if (this.mode === '3d') {
        target = new THREE.Vector3(centre.x, centre.y - 1, centre.z);
        size = this.fitDistance(bounds, centre, virtAspect);
      } else {
        const side = this.mode === '2d-side';
        const h = side ? bounds.max.y - bounds.min.y : bounds.max.z - bounds.min.z;
        target = new THREE.Vector3(centre.x, side ? centre.y : 0, side ? 0 : centre.z);
        size = Math.max(FIT_MIN_HEIGHT, h + FIT_PAD, (w + FIT_PAD) / virtAspect);
      }
      this.overview = { target, size, bounds };
    }
    const ov = this.overview;
    if (ov) {
      const goal = this.followGoal(entities, ov) ?? { target: ov.target, size: ov.size };
      // dt 0 = a still redraw (preview, resize, toggle): jump. While playing: ease toward the goal.
      if (!this.cur || dt <= 0) {
        this.cur = { target: goal.target.clone(), size: goal.size };
      } else {
        const k = 1 - Math.exp(-FIT_EASE * Math.min(dt, 0.1));
        this.cur.target.lerp(goal.target, k);
        this.cur.size += (goal.size - this.cur.size) * k;
      }
      this.view.target.copy(this.cur.target);
      this.view.homeSize = this.cur.size;
    }
    this.target.copy(this.view.target);
    this.snapNext = false;
    this.applySize();
    this.place();
  }

  /** Close-up on the followed character, kept inside the scene box; null when not following. */
  private followGoal(entities: readonly EntityView[], ov: OverviewFrame): { target: THREE.Vector3; size: number } | null {
    const id = this.fit?.follow;
    const e = id ? entities.find((x) => x.ownerNodeId === id && x.visible) : undefined;
    if (!e) return null;
    const b = ov.bounds;
    const virtAspect = this.aspect / this.visibleFrac;
    const hero = Math.max(e.size.y, e.size.x, e.size.z, 1);
    const clampTo = (v: number, lo: number, hi: number, half: number): number => (hi - lo <= 2 * half ? (lo + hi) / 2 : clamp(v, lo + half, hi - half));
    if (this.mode === '3d') {
      const tanV = Math.tan(THREE.MathUtils.degToRad(25));
      const size = clamp(hero / (2 * tanV * FOLLOW_FRACTION), FOLLOW_MIN_DISTANCE, ov.size);
      // Visible ground half-extent is about the distance times the frame's tangent; keep that inside the box.
      const halfX = size * tanV * virtAspect * 0.8;
      const halfZ = size * tanV * 0.8;
      const t = new THREE.Vector3(clampTo(e.position.x, b.min.x, b.max.x, halfX), ov.target.y, clampTo(e.position.z, b.min.z, b.max.z, halfZ));
      return { target: t, size };
    }
    const side = this.mode === '2d-side';
    const size = clamp(hero / FOLLOW_FRACTION, FIT_MIN_HEIGHT * 0.5, ov.size);
    const halfX = (size * virtAspect) / 2;
    const half = size / 2;
    const x = clampTo(e.position.x, b.min.x, b.max.x, halfX);
    if (side) return { target: new THREE.Vector3(x, clampTo(e.position.y, b.min.y, b.max.y, half), 0), size };
    return { target: new THREE.Vector3(x, 0, clampTo(e.position.z, b.min.z, b.max.z, half)), size };
  }

  /** Orbit distance at which all eight corners of the scene box fit the (virtual) frame. */
  private fitDistance(b: Bounds, centre: THREE.Vector3, aspect: number): number {
    const fwd = orbitOffset(this.yaw, this.pitch, 1).negate();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const tanV = Math.tan(THREE.MathUtils.degToRad(25));
    const tanH = tanV * aspect;
    let d = 0;
    for (const x of [b.min.x, b.max.x]) {
      for (const y of [b.min.y, b.max.y]) {
        for (const z of [b.min.z, b.max.z]) {
          const rel = new THREE.Vector3(x, y, z).sub(centre);
          const along = rel.dot(fwd);
          d = Math.max(d, Math.abs(rel.dot(right)) / tanH - along, Math.abs(rel.dot(up)) / tanV - along);
        }
      }
    }
    return clamp(d * 1.06, 6, FAR * 0.8);
  }

  /** Entering play swaps in a default follow view; leaving restores the edit camera. */
  private syncFollow(follow: boolean): void {
    if (follow === this.following) return;
    this.following = follow;
    if (follow) {
      this.saved = this.view;
      this.view = this.freshView();
      this.view.homePending = false;
      this.snapNext = true;
    } else if (this.saved) {
      this.view = this.saved;
      this.saved = null;
    }
  }

  private homeFor(b: Bounds): number {
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const size = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
      return clamp(size * 1.4, DEFAULT_DISTANCE, 80) / VIEW_CLOSENESS;
    }
    const raw =
      this.mode === '2d-side'
        ? fitOrthoHeight(b.max.x - b.min.x, b.max.y - b.min.y, this.aspect)
        : fitOrthoHeight(b.max.x - b.min.x, b.max.z - b.min.z, this.aspect);
    return raw / VIEW_CLOSENESS;
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
      cam.position.copy(look).add(orbitOffset(this.yaw, this.pitch, this.size));
      cam.up.set(0, 1, 0);
      cam.lookAt(look);
    }
    const shake = this.following ? this.director.shakeOffset(this.size) : null;
    if (shake && (shake.right !== 0 || shake.up !== 0)) {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      cam.position.addScaledVector(right, shake.right).addScaledVector(up, shake.up);
    }
    cam.updateMatrixWorld();
  }

  private applySize(): void {
    const cam = this.camera;
    // With a stage fit the frame is virtually taller than the canvas, then shifted so the canvas
    // shows only the uncovered part of it.
    const a = this.aspect / this.visibleFrac;
    if (cam instanceof THREE.PerspectiveCamera) {
      cam.aspect = a;
    } else {
      const h = this.size / 2;
      cam.left = -h * a;
      cam.right = h * a;
      cam.top = h;
      cam.bottom = -h;
    }
    if (this.fit) {
      const full = 1000;
      cam.setViewOffset(full, full / a, 0, (-this.fit.top * full) / this.aspect, full, full / this.aspect);
    } else {
      cam.clearViewOffset();
    }
    cam.updateProjectionMatrix();
  }
}
