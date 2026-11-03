import type { EntityView, ParamValue, PortValues, Vec3, WorldApi } from '../engine/types';
import { noteRoute } from './sight-notes';
import { SLOW_RADIUS, hasArrived, planarDelta, steerToward } from './steering';
import { clamp, numParam, strParam } from './util';

/**
 * "Chạy từng chặng" for the route piece: the walker stands at a point until "Chạy" is on, then dashes straight to the
 * next point (the dash is never cancelled half way). When it gets there and "Chạy" is still on, it runs on at once, so
 * a chain of safe legs is one smooth run; otherwise it waits there.
 */

/** Walkers count as at a point inside this distance unless the piece sets its own radius. */
const DEFAULT_ARRIVE = 0.5;

export interface LegState {
  idx: number | null;
  dir: 1 | -1;
  /** 'wait' = standing at a point, 'ready' = decided to go and getting set, 'dash' = running to points[idx]. Null until the first tick. */
  phase: 'wait' | 'ready' | 'dash' | null;
  /** Seconds of getting set still left in 'ready'. */
  readyLeft: number;
}

export interface LegArgs {
  world: WorldApi;
  self: EntityView;
  params: Record<string, ParamValue>;
  s: LegState;
  points: readonly Vec3[];
  go: boolean;
  halted: boolean;
  blocked: boolean;
  dt: number;
  tick: number;
  shown: () => number;
}

/** The point after `idx` (and the walking direction after it), by the route's own style. Does not touch the state. */
function after(points: readonly Vec3[], idx: number, dir: 1 | -1, pingpong: boolean): { idx: number; dir: 1 | -1 } {
  if (!pingpong) return { idx: (idx + 1) % points.length, dir };
  const d = idx + dir < 0 || idx + dir >= points.length ? (dir === 1 ? -1 : 1) : dir;
  return { idx: idx + d, dir: d };
}

const flat = (world: WorldApi, a: Vec3, b: Vec3): number => {
  const d = planarDelta(world.mode, a, b);
  return Math.hypot(d.x, d.z);
};

export function legsEvaluate(args: LegArgs): PortValues {
  const { world, self, params, s, points, go, halted, blocked } = args;
  const pingpong = strParam(params, 'style', 'loop') === 'pingpong';
  const arriveParam = Math.max(0, numParam(params, 'arriveRadius', 0));
  const arriveRadius = arriveParam > 0 ? arriveParam : DEFAULT_ARRIVE;
  const asked = clamp(numParam(params, 'speed', 5), 0.5, 30);
  // The walker cannot run faster than its own top speed, so that is the speed the time estimate uses.
  const top = self.drive?.speed ?? 0;
  const speed = top > 0 ? Math.min(asked, top) : asked;
  const advance = (): void => {
    const nxt = after(points, s.idx!, s.dir, pingpong);
    s.idx = nxt.idx;
    s.dir = nxt.dir;
  };

  let reached = false;
  // Running on through a point (the signal is still on when it gets there) needs no getting set.
  let ranOn = false;
  if (s.phase === null) {
    s.phase = 'wait';
    // Standing on a point at the start: it is already "reached", the first dash goes to the one after it.
    if (hasArrived(world.mode, self.position, points[s.idx!]!, arriveRadius)) advance();
  } else if (s.phase === 'dash' && hasArrived(world.mode, self.position, points[s.idx!]!, arriveRadius)) {
    reached = true;
    advance();
    s.phase = 'wait';
    ranOn = go;
  }
  if (s.phase === 'wait' && go) {
    const ready = Math.max(0, numParam(params, 'readyFor', 0));
    s.phase = ready > 0 && !ranOn ? 'ready' : 'dash';
    s.readyLeft = ready;
  }
  if (s.phase === 'ready') {
    s.readyLeft -= args.dt;
    if (s.readyLeft <= 0) s.phase = 'dash';
  }

  const goal = points[s.idx!]!;
  const toGoal = flat(world, self.position, goal);
  const upcoming = points[after(points, s.idx!, s.dir, pingpong).idx]!;
  // While waiting the leg to decide on starts here; while dashing it is the one after the point being run to.
  // Getting set counts as part of the dash for what the outputs say: the walker has chosen to go.
  const dashing = s.phase !== 'wait';
  const running = s.phase === 'dash';
  const legFrom = dashing ? goal : self.position;
  const legTo = dashing ? upcoming : goal;
  // Time to run what is left of the dash (if any) plus the leg itself.
  const need = ((dashing ? toGoal : 0) + flat(world, legFrom, legTo)) / speed;
  const info = {
    reached,
    index: args.shown(),
    atPoint: !dashing,
  };
  // The forecast piece reads the leg to watch from here, so the player does not have to carry numbers over.
  noteRoute(world, self.id, { from: { x: legFrom.x, z: legFrom.z }, to: { x: legTo.x, z: legTo.z }, need, tick: args.tick });
  if (!running || halted) return { moveX: 0, moveY: 0, jump: false, blocked, ...info };

  const steer = steerToward(world, self, goal, { slowRadius: clamp(numParam(params, 'slowRadius', SLOW_RADIUS), 0.2, 5) });
  const k = top > 0 ? clamp(asked / top, 0.1, 1) : 1;
  return { moveX: steer.moveX * k, moveY: steer.moveY * k, jump: steer.jump, blocked, ...info };
}
