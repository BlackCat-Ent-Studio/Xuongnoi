import * as THREE from 'three';
import type { EntityView, ViewMode } from '../engine/types';
import { clamp, smoothValue } from './cameras';

// ---------- pure pose math ----------

/** Limb rotations about the lateral axis (positive = swing toward the facing direction). */
export interface Pose {
  armL: number;
  armR: number;
  legL: number;
  legR: number;
  /** Fractional vertical stretch of the upper body (breathing). */
  breathe: number;
}

export const IDLE_POSE: Pose = { armL: 0, armR: 0, legL: 0, legR: 0, breathe: 0 };

/** Horizontal speed (units/s) below which the figure counts as standing still. */
export const WALK_SPEED_MIN = 0.3;
/** Smoothed |vertical speed| (units/s) above which the figure counts as airborne. */
export const AIRBORNE_SPEED_MIN = 0.8;
const WALK_SPEED_FULL = 3;
const WALK_AMPLITUDE = 0.85;
const ARMS_UP = 2.4;
const LEG_TUCK_FRONT = 0.9;
const LEG_TUCK_BACK = -0.5;
/** Frame position jumps larger than this are teleports (restart, respawn), not movement. */
const TELEPORT_DISTANCE = 4;

export function walkPhaseRate(speed: number): number {
  return 6 + Math.max(0, speed) * 1.2;
}

/** Pose the figure is heading toward for the given motion state. */
export function targetPose(speed: number, airborne: boolean, phase: number, time: number): Pose {
  if (airborne) {
    return { armL: ARMS_UP, armR: ARMS_UP, legL: LEG_TUCK_FRONT, legR: LEG_TUCK_BACK, breathe: 0 };
  }
  const amp = WALK_AMPLITUDE * clamp(speed / WALK_SPEED_FULL, 0, 1);
  if (speed < WALK_SPEED_MIN) {
    const sway = Math.sin(time * 1.6) * 0.04;
    return { armL: sway, armR: -sway, legL: 0, legR: 0, breathe: Math.sin(time * 2) * 0.012 };
  }
  const swing = Math.sin(phase) * amp;
  return { armL: -swing * 0.9, armR: swing * 0.9, legL: swing, legR: -swing, breathe: 0 };
}

export function blendPose(current: Pose, target: Pose, dt: number, rate = 14): Pose {
  return {
    armL: smoothValue(current.armL, target.armL, dt, rate),
    armR: smoothValue(current.armR, target.armR, dt, rate),
    legL: smoothValue(current.legL, target.legL, dt, rate),
    legR: smoothValue(current.legR, target.legR, dt, rate),
    breathe: smoothValue(current.breathe, target.breathe, dt, rate),
  };
}

/** Yaw (rotation about Y) that makes a figure built facing +X look along (dx, dz). */
export function yawToward(dx: number, dz: number): number {
  return Math.atan2(-dz, dx);
}

/** Facing used before the figure has ever moved: +X in side view, toward the camera otherwise. */
export function defaultYaw(mode: ViewMode): number {
  return mode === '2d-side' ? 0 : yawToward(0, 1);
}

/** Wrap an angle difference into (-PI, PI]. */
export function shortestAngle(delta: number): number {
  const twoPi = Math.PI * 2;
  let d = delta % twoPi;
  if (d > Math.PI) d -= twoPi;
  else if (d <= -Math.PI) d += twoPi;
  return d;
}

export function smoothAngle(current: number, target: number, dt: number, rate = 12): number {
  return current + shortestAngle(target - current) * (1 - Math.exp(-rate * dt));
}

/** Yaw to turn toward given horizontal velocity; keeps `current` while (nearly) still. */
export function facingTarget(mode: ViewMode, vx: number, vz: number, current: number): number {
  if (mode === '2d-side') {
    if (Math.abs(vx) < WALK_SPEED_MIN) return current;
    return vx > 0 ? 0 : Math.PI;
  }
  if (Math.hypot(vx, vz) < WALK_SPEED_MIN) return current;
  return yawToward(vx, vz);
}

// ---------- figure ----------

const LEG_LENGTH = 0.4;
const FOOT_BACK = -0.08;
const FOOT_FRONT = 0.14;
/** Lowest foot point, relative to the hip, when the legs hang straight. */
const FOOT_FLOOR = -LEG_LENGTH;

/** Lowest y (relative to the hip) of the shoe's bottom corners for a leg rotated by `angle`. */
export function footDrop(angle: number): number {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  return Math.min(FOOT_BACK * s, FOOT_FRONT * s) - LEG_LENGTH * c;
}

const SKIN = '#f1c27d';
const PANTS = '#3b4a6b';
const SHOES = '#2b2b33';
const EYES = '#1d1d24';

/** Blocky humanoid built from boxes, fitted inside the entity's collision box, feet on its floor. */
export class Humanoid {
  readonly object = new THREE.Group();

  private readonly yawGroup = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly upper = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly shirt: THREE.MeshLambertMaterial;
  private readonly materials: THREE.MeshLambertMaterial[] = [];

  private colorHex: string;
  private mode: ViewMode;
  private yaw: number;
  private pose: Pose = { ...IDLE_POSE };
  private phase = 0;
  private time = 0;
  private prev: { x: number; y: number; z: number } | null = null;
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private bodyScaleY = 1;

  constructor(color: string, mode: ViewMode) {
    this.colorHex = color;
    this.mode = mode;
    this.yaw = defaultYaw(mode);
    this.shirt = this.material(color);
    const skin = this.material(SKIN);
    const pants = this.material(PANTS);
    const shoes = this.material(SHOES);
    const eyes = this.material(EYES);

    // Figure is 1 unit tall, centered on the origin (y -0.5 feet .. 0.5 head), facing +X.
    this.object.add(this.yawGroup);
    this.yawGroup.add(this.body);

    const hipY = -0.1;
    const shoulderY = 0.22;
    for (const [leg, z] of [
      [this.legL, 0.09],
      [this.legR, -0.09],
    ] as const) {
      leg.position.set(0, hipY, z);
      this.part(leg, pants, [0.16, 0.4, 0.16], [0, -0.2, 0]);
      this.part(leg, shoes, [0.22, 0.08, 0.17], [0.03, -0.36, 0]);
      this.body.add(leg);
    }

    this.upper.position.set(0, hipY, 0);
    this.body.add(this.upper);
    this.part(this.upper, this.shirt, [0.2, 0.34, 0.36], [0, 0.17, 0]);
    this.part(this.upper, skin, [0.26, 0.26, 0.26], [0, 0.445, 0]);
    this.part(this.upper, eyes, [0.02, 0.045, 0.045], [0.131, 0.47, 0.065]);
    this.part(this.upper, eyes, [0.02, 0.045, 0.045], [0.131, 0.47, -0.065]);
    for (const [arm, z] of [
      [this.armL, 0.25],
      [this.armR, -0.25],
    ] as const) {
      arm.position.set(0, shoulderY - hipY, z);
      this.part(arm, this.shirt, [0.14, 0.24, 0.14], [0, -0.12, 0]);
      this.part(arm, skin, [0.13, 0.1, 0.13], [0, -0.29, 0]);
      this.upper.add(arm);
    }
    this.applyPose();
    this.applyYaw();
  }

  private material(color: string): THREE.MeshLambertMaterial {
    const m = new THREE.MeshLambertMaterial({ color });
    this.materials.push(m);
    return m;
  }

  private part(
    parent: THREE.Object3D,
    mat: THREE.MeshLambertMaterial,
    size: [number, number, number],
    pos: [number, number, number],
  ): void {
    const mesh = new THREE.Mesh(this.geometry, mat);
    mesh.scale.set(size[0], size[1], size[2]);
    mesh.position.set(pos[0], pos[1], pos[2]);
    parent.add(mesh);
  }

  setMode(mode: ViewMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.yaw = defaultYaw(mode);
    this.applyYaw();
  }

  /** Sync transform, shirt color and owner, then advance the animation by `dt` seconds. */
  update(view: EntityView, dt: number): void {
    if (view.color !== this.colorHex) {
      this.shirt.color.set(view.color);
      this.colorHex = view.color;
    }
    const p = view.position;
    this.object.position.set(p.x, p.y, p.z);
    // Uniform horizontal scale keeps the figure inside the box under any yaw.
    const h = Math.min(view.size.x, view.size.z);
    this.bodyScaleY = view.size.y;
    this.body.scale.set(h, view.size.y, h);
    this.object.traverse((o) => {
      o.userData.ownerNodeId = view.ownerNodeId;
    });

    if (dt > 0) this.animate(p, dt);
    this.object.updateMatrixWorld(true);
  }

  private animate(p: { x: number; y: number; z: number }, dt: number): void {
    const prev = this.prev;
    this.prev = { x: p.x, y: p.y, z: p.z };
    if (prev) {
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const dz = p.z - prev.z;
      if (Math.hypot(dx, dy, dz) > TELEPORT_DISTANCE) {
        this.vx = this.vy = this.vz = 0;
      } else {
        this.vx = smoothValue(this.vx, dx / dt, dt, 20);
        this.vy = smoothValue(this.vy, dy / dt, dt, 20);
        this.vz = smoothValue(this.vz, dz / dt, dt, 20);
      }
    }
    const speed = this.mode === '2d-side' ? Math.abs(this.vx) : Math.hypot(this.vx, this.vz);
    const airborne = Math.abs(this.vy) > AIRBORNE_SPEED_MIN;
    this.time += dt;
    this.phase += dt * walkPhaseRate(speed);
    this.yaw = smoothAngle(this.yaw, facingTarget(this.mode, this.vx, this.vz, this.yaw), dt);
    this.pose = blendPose(this.pose, targetPose(speed, airborne, this.phase, this.time), dt);
    this.applyYaw();
    this.applyPose();
  }

  private applyYaw(): void {
    this.yawGroup.rotation.y = this.yaw;
  }

  private applyPose(): void {
    this.armL.rotation.z = this.pose.armL;
    this.armR.rotation.z = this.pose.armR;
    this.legL.rotation.z = this.pose.legL;
    this.legR.rotation.z = this.pose.legR;
    this.upper.scale.y = 1 + this.pose.breathe;
    // Rotated shoe corners swing slightly below the floor line; lift the body so feet never sink.
    const lowest = Math.min(footDrop(this.pose.legL), footDrop(this.pose.legR));
    this.body.position.y = Math.max(0, FOOT_FLOOR - lowest) * this.bodyScaleY;
  }

  dispose(): void {
    this.geometry.dispose();
    for (const m of this.materials) m.dispose();
  }
}
