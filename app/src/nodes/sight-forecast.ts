import type { EntityView, NodeDef, SolidBox, Vec3, ViewMode } from '../engine/types';
import { segmentClear } from '../world/line-of-sight';
import { MIN_STOP_DISTANCE, SLOW_RADIUS, planarDelta } from './steering';
import { patrolNoteOf, routeNoteOf, visionNoteOf, type PatrolNote } from './sight-notes';
import { directionOf, insideCone, lookDirection, viewDistance } from './vision-sensor';
import { asObject, clamp, numParam, strParam } from './util';

/** What "Còn" shows when the viewer's sight never reaches the watched place within the looking-ahead time. */
export const NEVER_SEEN = 99;
/** Gap between two watched points along a leg (units). */
const SAMPLE_STEP = 0.4;
/** Time step of the forward play (seconds). */
const LOOK_STEP = 1 / 30;
/** Smallest fraction of its top speed a walker keeps while it eases into a point (same as the steering). */
const MIN_SPEED_FRACTION = 0.3;

export interface ForecastInput {
  mode: ViewMode;
  /** Visible solid blocks that stop sight. */
  boxes: readonly SolidBox[];
  viewer: { position: Vec3; facing: { x: number; z: number }; speed: number };
  /** The viewer's patrol, when it has one; otherwise it is taken to stand still. */
  patrol?: Pick<PatrolNote, 'a' | 'b' | 'heading' | 'waitLeft' | 'wait'>;
  vision: { range: number; angle: number; walls: boolean };
  /** Places that must stay unseen (at their own heights). */
  points: readonly Vec3[];
  /** How far ahead to look (seconds). */
  horizon: number;
}

interface Walker {
  x: number;
  z: number;
  fx: number;
  fz: number;
  heading: 'A' | 'B';
  waitLeft: number;
}

/** One step of the patrol walk, written the way the "Đi tuần" piece steers (straight line, easing in, waiting at each end). */
function patrolStep(w: Walker, mode: ViewMode, patrol: NonNullable<ForecastInput['patrol']>, speed: number, dt: number): void {
  if (w.waitLeft > 0) {
    w.waitLeft = Math.max(0, w.waitLeft - dt);
    return;
  }
  const goal = w.heading === 'A' ? patrol.a : patrol.b;
  const d = planarDelta(mode, { x: w.x, y: 0, z: w.z }, goal);
  const dist = Math.hypot(d.x, d.z);
  if (dist <= MIN_STOP_DISTANCE) {
    w.heading = w.heading === 'A' ? 'B' : 'A';
    w.waitLeft = patrol.wait;
    return;
  }
  const ux = d.x / dist;
  const uz = d.z / dist;
  const mag = clamp(dist / SLOW_RADIUS, MIN_SPEED_FRACTION, 1);
  const move = Math.min(dist, mag * speed * dt);
  w.x += ux * move;
  w.z += uz * move;
  w.fx = ux;
  w.fz = uz;
}

/**
 * Seconds until the viewer's sight first reaches any of `points`, playing its patrol forward with the same sight rules
 * as "Tầm nhìn" (range, cone, walls). 0 when a point is seen right now, null when none is seen within the horizon.
 * Pure: nothing in the world is touched.
 */
export function forecastSight(inp: ForecastInput): number | null {
  const { mode, boxes, vision, points } = inp;
  const half = (clamp(vision.angle, 1, 360) / 2) * (Math.PI / 180);
  const w: Walker = {
    x: inp.viewer.position.x,
    z: inp.viewer.position.z,
    fx: inp.viewer.facing.x,
    fz: inp.viewer.facing.z,
    heading: inp.patrol?.heading ?? 'A',
    waitLeft: inp.patrol?.waitLeft ?? 0,
  };
  const y = inp.viewer.position.y;
  const steps = Math.ceil(inp.horizon / LOOK_STEP);
  for (let k = 0; k <= steps; k++) {
    const dir = directionOf(w.fx, w.fz, mode);
    for (const p of points) {
      const dx = p.x - w.x;
      const dy = p.y - y;
      const dz = p.z - w.z;
      if (viewDistance(mode, dx, dy, dz) > vision.range) continue;
      if (!insideCone(mode, dx, dy, dz, dir, half)) continue;
      if (vision.walls && !segmentClear(boxes, mode, { x: w.x, y, z: w.z }, p)) continue;
      return k * LOOK_STEP;
    }
    if (inp.patrol) patrolStep(w, mode, inp.patrol, inp.viewer.speed, LOOK_STEP);
  }
  return null;
}

/** Places to watch along a leg: both ends and a point every `SAMPLE_STEP`. */
export function legPoints(from: Vec3, to: Vec3): Vec3[] {
  const len = Math.hypot(to.x - from.x, to.z - from.z);
  const n = Math.max(1, Math.ceil(len / SAMPLE_STEP));
  const out: Vec3[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    out.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t });
  }
  return out;
}

interface ForecastState {
  revision: number;
  boxes: readonly SolidBox[];
}

const UNSURE = { window: 0, safe: false, need: 0 };

export const sightForecastNode: NodeDef<ForecastState> = {
  kind: 'sight-forecast',
  label: 'Dự đoán tầm nhìn',
  category: 'logic',
  description:
    'Đoán trước xem bao lâu nữa người nhìn sẽ thấy một chỗ, mà không cần chờ tới lúc đó. Nối "Người nhìn" (nhân vật có mảnh Tầm nhìn, và có thể có mảnh Đi tuần) và "Mục tiêu". Nó chơi thử trước đường đi tuần và tầm nhìn của người đó bằng đúng luật của mảnh Tầm nhìn (xa, góc, tường che). "Còn" là số giây tới lần đầu người nhìn thấy chỗ đó; "An toàn" bật khi trong thời gian dự đoán vẫn chưa bị thấy. Chọn "Chặng kế của Mục tiêu" để canh cả chặng đường kế tiếp mà Mục tiêu (đang chạy từng chặng theo mảnh Chạy theo tuyến) sắp chạy; lúc đó "Cần" là số giây Mục tiêu cần để chạy hết chặng đó.',
  inputs: [
    { id: 'viewer', type: 'object', label: 'Người nhìn', required: true },
    { id: 'target', type: 'object', label: 'Mục tiêu' },
  ],
  outputs: [
    { id: 'window', type: 'number', label: 'Còn (giây)' },
    { id: 'safe', type: 'bool', label: 'An toàn' },
    { id: 'need', type: 'number', label: 'Cần (giây)' },
  ],
  params: [
    {
      id: 'watch',
      label: 'Canh chừng',
      kind: 'select',
      default: 'point',
      options: [
        { value: 'point', label: 'Một chỗ (chỗ của Mục tiêu)' },
        { value: 'leg', label: 'Chặng kế của Mục tiêu (nó đang chạy từng chặng theo mảnh Chạy theo tuyến)' },
      ],
    },
    { id: 'horizon', label: 'Nhìn trước tối đa (giây)', kind: 'number', default: 12, min: 1, max: 60, step: 1, advanced: true },
  ],
  create: () => ({ revision: -1, boxes: [] }),
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    const viewerId = asObject(i.viewer);
    const viewer: EntityView | undefined = viewerId !== null ? world.getEntity(viewerId) : undefined;
    // No viewer wired (or not there yet): nothing can be promised, so the careful answer.
    if (!viewer) return { ...UNSURE };
    // Nobody to be seen by: a viewer that is gone or hidden sees nothing.
    if (!viewer.visible || viewer.seatedIn !== undefined) return { window: NEVER_SEEN, safe: true, need: 0 };

    const vision = visionNoteOf(world, viewer.id, ctx.tick);
    // The first tick may run before the eyes have reported in; staying unsure (not safe) is the careful answer.
    if (!vision) return ctx.tick === 0 ? { ...UNSURE } : { window: NEVER_SEEN, safe: true, need: 0 };
    const patrol = patrolNoteOf(world, viewer.id, ctx.tick);
    if (!patrol && ctx.tick === 0) return { ...UNSURE };

    const targetId = asObject(i.target);
    const target = targetId !== null ? world.getEntity(targetId) : undefined;
    const leg = strParam(params, 'watch', 'point') === 'leg';
    const y = (target ?? viewer).position.y;
    let points: Vec3[];
    let need = 0;
    if (leg) {
      // The leg comes from the target's own route piece; with none running, the target's spot is watched instead.
      const route = target ? routeNoteOf(world, target.id, ctx.tick) : undefined;
      if (!route) {
        if (ctx.tick === 0) return { ...UNSURE };
        if (!target || !target.visible) return { window: NEVER_SEEN, safe: true, need: 0 };
        points = [{ ...target.position }];
      } else {
        need = route.need;
        points = legPoints({ x: route.from.x, y, z: route.from.z }, { x: route.to.x, y, z: route.to.z });
      }
    } else {
      if (!target || !target.visible) return { window: NEVER_SEEN, safe: true, need: 0 };
      points = [{ ...target.position }];
    }

    if (s.revision !== world.solidRevision()) {
      s.boxes = world.solidBoxes();
      s.revision = world.solidRevision();
    }
    const dir = lookDirection(viewer, ctx.mode);
    const seen = forecastSight({
      mode: ctx.mode,
      boxes: s.boxes,
      viewer: { position: viewer.position, facing: viewer.facing ?? { x: dir.a, z: dir.b }, speed: viewer.drive?.speed ?? 0 },
      patrol,
      vision,
      points,
      horizon: clamp(numParam(params, 'horizon', 12), 1, 60),
    });
    return seen === null ? { window: NEVER_SEEN, safe: true, need } : { window: seen, safe: false, need };
  },
};
