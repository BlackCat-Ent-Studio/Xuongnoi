import { appendFileSync, writeFileSync } from 'node:fs';
import type { EntityView, Vec3, World } from '../../src/engine/types';
import { armRegistry } from '../../src/nodes/arm-parts';
import { dirOf, lateralOf, normalOf, type Frame } from '../../src/world/arm-kinematics';
import { linkOutline } from '../../src/world/arm-solid';
import { axesOf, obbOf, obbSeparation, type Obb } from '../../src/world/oriented-box';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';

/** Shared helpers of the measurement spikes: nothing here changes how the engine behaves, it only reads it. */

export const OUT = new URL('./out/', import.meta.url);

export function report(file: string) {
  const url = new URL(file, OUT);
  writeFileSync(url, '');
  return (line = ''): void => {
    appendFileSync(url, `${line}\n`);
    console.log(line);
  };
}

let engine: RapierModule | null = null;
export async function engineOnce(): Promise<RapierModule> {
  engine ??= await loadRapier();
  return engine;
}

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const mm = (m: number): string => (m * 1000).toFixed(1);
export const f2 = (n: number): string => n.toFixed(2);
export const f3 = (n: number): string => n.toFixed(3);

/** Frame at the pivot end of a link (the tip frame of the joint it is mounted on) and the link's exact box. */
export function linkPose(world: World, jointEntity: EntityView, length: number, thickness: number): { frame: Frame; box: Obb } | null {
  const frame = armRegistry(world).frames.get(jointEntity.id);
  if (!frame) return null;
  return { frame, box: linkOutline(frame, length, thickness) };
}

export interface CrateOnTray {
  /** Crate centre from the pivot along the tray / sideways (m). */
  along: number;
  lateral: number;
  /** Gap (m) between the crate's bottom face and the tray top, measured along the tray normal (exact while the crate lies flat on it). */
  gap: number;
  /** How deep the crate sinks into the tray box (m, positive = overlap, negative = clear gap). */
  overlap: number;
  /** Degrees between the crate's up axis and the tray normal, and between the crate's up axis and the world's. */
  tiltToTray: number;
  tiltToWorld: number;
}

export function crateOnTray(pose: { frame: Frame; box: Obb }, thickness: number, crate: EntityView): CrateOnTray {
  const d = sub(crate.position, pose.frame.pos);
  const n = normalOf(pose.frame);
  const up = axesOf(crate.rotation)[1];
  const c = obbOf(crate.position, crate.size, crate.rotation);
  const ang = (v: number): number => (Math.acos(Math.max(-1, Math.min(1, v))) * 180) / Math.PI;
  return {
    along: dot(d, dirOf(pose.frame)),
    lateral: dot(d, lateralOf(pose.frame)),
    gap: dot(d, n) - thickness / 2 - crate.size.y / 2,
    overlap: -obbSeparation(pose.box, c),
    tiltToTray: ang(dot(up, n)),
    tiltToWorld: ang(up.y),
  };
}

export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}
