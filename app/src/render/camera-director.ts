import type { EntityView, PlayCameraCommand, Vec3 } from '../engine/types';

/** Smoothing rate of the default follow camera (per second). */
export const DEFAULT_FOLLOW_RATE = 8;
/** Peak shake offset as a share of the visible height (ortho) / orbit distance (3d) at strength 1. */
const SHAKE_SHARE = 0.04;

/** Exponential smoothing rate for a node's "smoothness" setting (5 = the default follow feel, 0 = instant). */
export function rateForSmoothness(smoothness: number): number {
  return smoothness <= 0 ? 1000 : 40 / smoothness;
}

/**
 * Play-camera overrides requested by camera nodes: where to look, how far in, and how much to shake.
 * Pure state around a rig; the edit camera never goes through it.
 */
export class CameraDirector {
  private zoomNow = 1;
  private time = 0;
  private shakeNow = 0;

  /** Current (smoothed) magnification multiplier. */
  get zoom(): number {
    return this.zoomNow;
  }

  /** Back to neutral (edit camera, new session). */
  reset(): void {
    this.zoomNow = 1;
    this.shakeNow = 0;
  }

  update(cmd: PlayCameraCommand | null, dt: number, snap: boolean): void {
    this.time += dt;
    const goal = cmd ? cmd.zoom : 1;
    const rate = cmd ? rateForSmoothness(cmd.smoothness) : DEFAULT_FOLLOW_RATE;
    this.zoomNow = snap ? goal : this.zoomNow + (goal - this.zoomNow) * (1 - Math.exp(-rate * dt));
    this.shakeNow = cmd ? Math.max(0, cmd.shake) : 0;
  }

  /** Smoothing rate of the camera's centre while this request is active. */
  rate(cmd: PlayCameraCommand | null): number {
    return cmd ? rateForSmoothness(cmd.smoothness) : DEFAULT_FOLLOW_RATE;
  }

  /** The point the camera centres on; `fallback` is where the default follow would aim. */
  goal(cmd: PlayCameraCommand | null, entities: readonly EntityView[], fallback: Vec3): Vec3 {
    if (!cmd) return fallback;
    if (cmd.mode === 'fixed') return { ...cmd.point };
    const subject = cmd.target !== null ? entities.find((e) => e.id === cmd.target && e.visible) : undefined;
    const base = subject ? subject.position : fallback;
    return { x: base.x + cmd.point.x, y: base.y + cmd.point.y, z: base.z + cmd.point.z };
  }

  /** Screen-plane shake offset (right, up) in world units for the given visible size; zero when still. */
  shakeOffset(size: number): { right: number; up: number } {
    if (this.shakeNow <= 0) return { right: 0, up: 0 };
    const amp = this.shakeNow * SHAKE_SHARE * size;
    const t = this.time;
    return {
      right: amp * (Math.sin(t * 61.3) * 0.6 + Math.sin(t * 37.1 + 1.7) * 0.4),
      up: amp * (Math.sin(t * 53.9 + 0.9) * 0.6 + Math.sin(t * 29.3 + 2.4) * 0.4),
    };
  }
}
