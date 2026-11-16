import type { EntityView } from '../engine/types';
import { shortestAngle } from './character-motion';

/** A tick step longer than this (world units) is a teleport (respawn, portal, pickup snap): drawn as it is, never slid. */
export const BLEND_MAX_STEP = 2;

interface Pose {
  x: number;
  y: number;
  z: number;
  angle: number | undefined;
  tilt: number | undefined;
}

function poseOf(e: EntityView): Pose {
  return { x: e.position.x, y: e.position.y, z: e.position.z, angle: e.angle, tilt: e.tilt };
}

/**
 * Draws the fixed-step world between its last two ticks. The world moves in 1/60 s jumps; a screen that
 * refreshes at another rate (or with uneven frames) would show those jumps as stutter. Blending the last
 * two tick poses by the unspent share of a tick (alpha 0..1) turns them into steady motion, at the price
 * of showing the world up to one tick late. Rendering only: the simulation is never touched.
 */
export class TickBlender {
  private prev = new Map<string, Pose>();
  private curr = new Map<string, Pose>();

  /** Forget everything (new play session). */
  clear(): void {
    this.prev = new Map();
    this.curr = new Map();
  }

  /** Remember the poses after a simulation step. */
  capture(entities: readonly EntityView[]): void {
    this.prev = this.curr;
    const next = new Map<string, Pose>();
    for (const e of entities) if (e.visible) next.set(e.id, poseOf(e));
    this.curr = next;
  }

  /** The entities as drawn `alpha` of the way from the previous tick to the latest one. */
  blend(entities: readonly EntityView[], alpha: number): readonly EntityView[] {
    const a = Math.min(Math.max(alpha, 0), 1);
    if (a >= 1) return entities;
    return entities.map((e) => {
      const from = this.prev.get(e.id);
      const to = this.curr.get(e.id);
      if (!from || !to || !e.visible) return e;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dz = to.z - from.z;
      if (dx === 0 && dy === 0 && dz === 0 && from.angle === to.angle && from.tilt === to.tilt) return e;
      if (Math.hypot(dx, dy, dz) > BLEND_MAX_STEP) return e;
      const out: EntityView = { ...e, position: { x: from.x + dx * a, y: from.y + dy * a, z: from.z + dz * a } };
      if (from.angle !== undefined && to.angle !== undefined) {
        out.angle = from.angle + shortestAngle(to.angle - from.angle) * a;
      }
      if (from.tilt !== undefined && to.tilt !== undefined) out.tilt = from.tilt + (to.tilt - from.tilt) * a;
      return out;
    });
  }
}
