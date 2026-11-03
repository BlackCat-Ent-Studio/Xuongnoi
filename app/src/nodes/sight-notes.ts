import type { EntityId, Vec3, WorldApi } from '../engine/types';

/**
 * What "Tầm nhìn" and "Đi tuần" tell the "Dự đoán tầm nhìn" piece about the person they drive, so the forecast can play
 * the same rules forward without asking the player to type them twice. The notes live next to the world (never in it),
 * are rewritten every tick by their owner, and a note that is no longer renewed is ignored.
 */

export interface VisionNote {
  range: number;
  /** Full cone angle in degrees. */
  angle: number;
  walls: boolean;
  /** True when the sensor sees something this tick (the stage paints the fan red). */
  seen: boolean;
  tick: number;
}

export interface PatrolNote {
  a: Vec3;
  b: Vec3;
  /** End being walked to. */
  heading: 'A' | 'B';
  /** Seconds of waiting still left at the end just reached. */
  waitLeft: number;
  /** Seconds waited at each end. */
  wait: number;
  tick: number;
}

/** The leg a walker running its route "từng chặng" would decide on next (see the route piece). */
export interface RouteNote {
  /** Where the leg starts and ends on the ground (the reader adds the walker's own height). */
  from: { x: number; z: number };
  to: { x: number; z: number };
  /** Seconds the walker needs to run what is left of its dash plus this leg. */
  need: number;
  tick: number;
}

interface Notes {
  vision: Map<EntityId, VisionNote>;
  patrol: Map<EntityId, PatrolNote>;
  route: Map<EntityId, RouteNote>;
}

/** A note counts while its owner renewed it within this many ticks. */
export const NOTE_LIFETIME_TICKS = 3;

const books = new WeakMap<WorldApi, Notes>();

function book(world: WorldApi): Notes {
  let b = books.get(world);
  if (!b) {
    b = { vision: new Map(), patrol: new Map(), route: new Map() };
    books.set(world, b);
  }
  return b;
}

export function noteVision(world: WorldApi, viewer: EntityId, note: VisionNote): void {
  book(world).vision.set(viewer, note);
}

export function notePatrol(world: WorldApi, walker: EntityId, note: PatrolNote): void {
  book(world).patrol.set(walker, note);
}

export function noteRoute(world: WorldApi, walker: EntityId, note: RouteNote): void {
  book(world).route.set(walker, note);
}

export function visionNoteOf(world: WorldApi, viewer: EntityId, tick: number): VisionNote | undefined {
  const n = books.get(world)?.vision.get(viewer);
  return n && tick - n.tick <= NOTE_LIFETIME_TICKS ? n : undefined;
}

export function patrolNoteOf(world: WorldApi, walker: EntityId, tick: number): PatrolNote | undefined {
  const n = books.get(world)?.patrol.get(walker);
  return n && tick - n.tick <= NOTE_LIFETIME_TICKS ? n : undefined;
}

/** Every viewer whose eyes reported lately, for the stage to draw their sight. */
export function liveVisionNotes(world: WorldApi, tick: number): { viewer: EntityId; note: VisionNote }[] {
  const out: { viewer: EntityId; note: VisionNote }[] = [];
  for (const [viewer, note] of books.get(world)?.vision ?? []) if (tick - note.tick <= NOTE_LIFETIME_TICKS) out.push({ viewer, note });
  return out;
}

export function routeNoteOf(world: WorldApi, walker: EntityId, tick: number): RouteNote | undefined {
  const n = books.get(world)?.route.get(walker);
  return n && tick - n.tick <= NOTE_LIFETIME_TICKS ? n : undefined;
}
