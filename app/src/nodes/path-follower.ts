import type { EntityView, Vec3, WorldApi } from '../engine/types';
import { findPlanePath, findSidePath, planeGridFor, sideGraphFor } from '../world/navigation';

/**
 * Path following for brain nodes: keeps a planned route in the node's `memo`, replans now and then,
 * and says where to head this tick. Planning lives in `src/world/navigation`; this file is the
 * glue between a bot's live position and those pure planners.
 *
 *  - top-down / 3D: A* over a ground-plane grid, straightened by line of sight; waypoints are walked in order.
 *  - side view: A* over platforms; the route says when to walk, jump and drop, and the follower
 *    emits the jump when the bot is at the takeoff spot.
 *  - no path (no blocks, goal unreachable, grid too big): fall back to heading straight for the goal.
 */

/** Per-node scratch space owned by the brain node and handed to `nextWaypoint` (the cached route lives here). */
export type SteerMemo = Record<string, unknown>;

export interface WaypointRequest {
  world: WorldApi;
  self: EntityView;
  /** Where the node ultimately wants to be. */
  goal: Vec3;
  dt: number;
  memo: SteerMemo;
  /** Head straight for the goal without planning (fleeing, edge-turning patrols). */
  straight?: boolean;
}

export interface PathStep {
  waypoint: Vec3;
  /** The route says: jump now. */
  jump: boolean;
  /** Let the steering hop small obstacles and gaps on its own (true only when no route is in control). */
  hop: boolean;
  /** Move at full speed (side view): a jump or drop in progress, or a run-up to one. */
  fullSpeed: boolean;
}

/** Seconds between routine replans. */
export const REPLAN_INTERVAL = 0.5;
/** A moved goal triggers a replan, but never more often than this. */
export const MIN_REPLAN_GAP = 0.15;
/** Planning-grid units used to decide that the goal "moved to another cell". */
const GOAL_CELL = 0.5;
/** Ground-plane waypoint counts as reached inside this distance. */
const PLANE_REACH = 0.3;
/** Side view: a walk step counts as reached this far before its spot. */
const WALK_REACH = 0.15;
const LAND_HEIGHT_TOLERANCE = 0.15;
const LAND_REACH = 0.6;
/** Jump from within this window around the takeoff spot (behind, ahead) in the jump direction. */
const TAKEOFF_BEHIND = 0.15;
const TAKEOFF_AHEAD = 0.35;
/** Default movement when the character has not reported its speed yet. */
const DEFAULT_DRIVE = { speed: 5, jumpPower: 10 };

interface Wp {
  pos: Vec3;
  kind: 'walk' | 'jump' | 'drop';
  /** Side view jumps: where the takeoff happens (body center height). */
  srcX: number;
  srcY: number;
  dir: number;
}

interface NavMemo {
  wps: Wp[];
  idx: number;
  /** Seconds since the last plan. */
  age: number;
  goalKey: string;
  revision: number;
  /** False when the last plan found nothing: the follower then heads straight for the goal. */
  routed: boolean;
  /** 3D: feet height while last on the ground, so a jump does not re-key the grid. */
  groundFeet: number | null;
}

function navMemo(memo: SteerMemo): NavMemo {
  const existing = memo.nav as NavMemo | undefined;
  if (existing) return existing;
  const fresh: NavMemo = { wps: [], idx: 0, age: Infinity, goalKey: '', revision: -1, routed: false, groundFeet: null };
  memo.nav = fresh;
  return fresh;
}

function rawStep(goal: Vec3): PathStep {
  return { waypoint: goal, jump: false, hop: true, fullSpeed: false };
}

function goalKeyFor(world: WorldApi, goal: Vec3): string {
  const cx = Math.floor(goal.x / GOAL_CELL);
  return world.mode === '2d-side' ? `${cx}|${Math.round(goal.y / GOAL_CELL)}` : `${cx}|${Math.floor(goal.z / GOAL_CELL)}`;
}

// ---------- planning ----------

function planSide(world: WorldApi, self: EntityView, goal: Vec3, nav: NavMemo): void {
  const h = self.size.y;
  const graph = sideGraphFor(world, { halfWidth: self.size.x / 2, height: h });
  if (!graph) return;
  const drive = self.drive ?? DEFAULT_DRIVE;
  const res = findSidePath(
    graph,
    { x: self.position.x, feetY: self.position.y - h / 2 },
    { x: goal.x, feetY: goal.y - h / 2 },
    drive,
  );
  if (!res) return;
  const wps: Wp[] = res.steps.map((s) => ({
    pos: { x: s.x, y: s.y + h / 2, z: 0 },
    kind: s.kind,
    srcX: s.srcX,
    srcY: s.srcY + h / 2,
    dir: s.dir,
  }));
  // Finish at the goal itself, on the level of the last spot.
  const last = wps[wps.length - 1];
  const endX = last ? last.pos.x : self.position.x;
  if (!last || Math.abs(goal.x - endX) > 0.05) {
    wps.push({
      pos: { x: goal.x, y: last ? last.pos.y : goal.y, z: 0 },
      kind: 'walk',
      srcX: endX,
      srcY: last ? last.pos.y : self.position.y,
      dir: goal.x >= endX ? 1 : -1,
    });
  }
  nav.wps = wps;
  nav.routed = true;
}

function planPlane(world: WorldApi, self: EntityView, goal: Vec3, nav: NavMemo): void {
  const h = self.size.y;
  const feet = self.position.y - h / 2;
  let planFeet = feet;
  if (world.mode === '3d') {
    if (world.isOnGround(self.id)) nav.groundFeet = feet;
    planFeet = nav.groundFeet ?? feet;
  }
  const grid = planeGridFor(world, { halfWidth: Math.max(self.size.x, self.size.z) / 2, height: h }, planFeet);
  if (!grid) return;
  const res = findPlanePath(grid, { x: self.position.x, z: self.position.z }, { x: goal.x, z: goal.z });
  if (!res || res.points.length === 0) return;
  nav.wps = res.points.map((p, i) => ({
    pos: { x: p.x, y: i === res.points.length - 1 ? goal.y : self.position.y, z: p.z },
    kind: 'walk' as const,
    srcX: 0,
    srcY: 0,
    dir: 1,
  }));
  nav.routed = true;
}

function replan(world: WorldApi, self: EntityView, goal: Vec3, nav: NavMemo): void {
  nav.wps = [];
  nav.idx = 0;
  nav.routed = false;
  nav.age = 0;
  nav.goalKey = goalKeyFor(world, goal);
  nav.revision = world.solidRevision();
  if (world.mode === '2d-side') planSide(world, self, goal, nav);
  else planPlane(world, self, goal, nav);
}

// ---------- following ----------

function followPlane(nav: NavMemo, self: EntityView, goal: Vec3): PathStep {
  while (nav.idx < nav.wps.length) {
    const p = nav.wps[nav.idx]!.pos;
    if (Math.hypot(p.x - self.position.x, p.z - self.position.z) >= PLANE_REACH) break;
    nav.idx++;
  }
  const wp = nav.wps[nav.idx];
  return { waypoint: wp ? wp.pos : goal, jump: false, hop: !wp, fullSpeed: false };
}

function followSide(world: WorldApi, nav: NavMemo, self: EntityView, goal: Vec3): PathStep {
  const sx = self.position.x;
  const sy = self.position.y;
  const grounded = world.isOnGround(self.id);

  for (; nav.idx < nav.wps.length; nav.idx++) {
    const wp = nav.wps[nav.idx]!;
    const dy = Math.abs(sy - wp.pos.y);
    const reached =
      wp.kind === 'walk'
        ? (sx - wp.pos.x) * wp.dir >= -WALK_REACH && dy <= 0.3
        : grounded && dy <= LAND_HEIGHT_TOLERANCE && Math.abs(sx - wp.pos.x) <= LAND_REACH;
    if (!reached) break;
  }
  const wp = nav.wps[nav.idx];
  if (!wp) return rawStep(goal);

  if (wp.kind === 'walk') {
    // Walk the whole flat run toward its end: steering slows down near a target, so aiming at each column crawls.
    let end = nav.idx;
    while (nav.wps[end + 1]?.kind === 'walk') end++;
    const after = nav.wps[end + 1];
    return { waypoint: nav.wps[end]!.pos, jump: false, hop: false, fullSpeed: after !== undefined };
  }
  if (wp.kind === 'drop') return { waypoint: wp.pos, jump: false, hop: false, fullSpeed: true };

  // Jump: airborne = keep flying toward the landing; grounded = run to the takeoff spot, then leave the ground.
  if (!grounded) return { waypoint: wp.pos, jump: false, hop: false, fullSpeed: true };
  if (Math.abs(sy - wp.srcY) > 0.3) {
    nav.age = Math.max(nav.age, REPLAN_INTERVAL); // not where the route thought: plan again from here
    return { waypoint: wp.pos, jump: false, hop: false, fullSpeed: false };
  }
  const along = (sx - wp.srcX) * wp.dir;
  if (along >= -TAKEOFF_BEHIND && along <= TAKEOFF_AHEAD) return { waypoint: wp.pos, jump: true, hop: false, fullSpeed: true };
  return { waypoint: { x: wp.srcX, y: wp.srcY, z: 0 }, jump: false, hop: false, fullSpeed: false };
}

/**
 * Decides where to head this tick, and whether a planned jump is due.
 * Replans when there is no route yet, every `REPLAN_INTERVAL`, when the goal moves to another cell
 * (at most every `MIN_REPLAN_GAP`), or when blocks appeared or vanished.
 */
export function pathStep(req: WaypointRequest): PathStep {
  const { world, self, goal, dt, memo } = req;
  if (req.straight) return rawStep(goal);
  const nav = navMemo(memo);
  nav.age += dt;
  const moved = goalKeyFor(world, goal) !== nav.goalKey;
  // A jump or drop in flight finishes first: a plan made from mid-air would start from whatever floor lies below.
  const inFlight = nav.routed && world.mode === '2d-side' && !world.isOnGround(self.id);
  if (
    !inFlight &&
    (nav.age >= REPLAN_INTERVAL || world.solidRevision() !== nav.revision || (moved && nav.age >= MIN_REPLAN_GAP))
  ) {
    replan(world, self, goal, nav);
  }
  if (!nav.routed) return rawStep(goal);
  return world.mode === '2d-side' ? followSide(world, nav, self, goal) : followPlane(nav, self, goal);
}
