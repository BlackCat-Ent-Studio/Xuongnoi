import type { EntityView, NodeDef, ParamDef, PortValues, Vec3, WorldApi } from '../engine/types';
import {
  hasArrived,
  moveForDirection,
  planarDelta,
  steerToward,
  unitToward,
  liveCharacter,
} from './steering';
import { buildRail, nearestS, railAt, upcomingPoint, type Rail } from './route-rail';
import { GRAB_REACH } from './carry';
import { asBool, asObject, clamp, numParam, strParam, vec3Param } from './util';

export const ROUTE_MAX_POINTS = 32;
/** Points 1..8 as they always were; points 9..32 are folded under "Nâng cao". */
const CLASSIC_POINTS = 8;
const ROUTE_MIN_POINTS = 2;
/** A vehicle counts as "at" a route point inside this planar distance (it never stops there, it just turns for the next one). */
const VEHICLE_ARRIVE = 1.2;
/** Walkers stop this close to a point before heading to the next. */
const WALKER_ARRIVE = 0.5;
/** Steering wheel gain for throttle-steered vehicles (full lock at about 30 degrees off). */
const STEER_GAIN = 2;
/** Beyond this misalignment (radians) a throttle-steered vehicle eases off the gas while it turns. */
const SHARP_TURN = 1.2;
const SHARP_TURN_GAS = 0.35;
/**
 * Stick push, for the one tick a stop begins, that turns a walker toward the thing beside it without really moving it
 * (about 0.02 units/s, far below the speed sensor's "standing still" limit).
 */
const TURN_PUSH = 0.004;

interface RouteState {
  /** Index of the point being approached; null until the first tick picks the nearest one. */
  idx: number | null;
  /** +1 walking the list forward, -1 back (ping-pong only). */
  dir: 1 | -1;
  /** Rail mode: the track built from the points, and how far along it the walker is (null until placed). */
  rail: { key: string; track: Rail } | null;
  pos: number | null;
  /** Seconds left of a stop at the point just reached ("Dừng ở mỗi điểm"). */
  waitLeft: number;
  /** True until the first tick of a stop has turned the walker toward what is beside it. */
  turnPending: boolean;
}

/** Rail mode lets go of its place on the track when the body is this far off it (blocked by a wall, say). */
const RAIL_HOLD_ERROR = 1.5;

const DEFAULT_POINTS: readonly Vec3[] = [
  { x: -6, y: 0.5, z: -6 },
  { x: 6, y: 0.5, z: -6 },
  { x: 6, y: 0.5, z: 6 },
  { x: -6, y: 0.5, z: 6 },
  ...Array.from({ length: ROUTE_MAX_POINTS - 4 }, () => ({ x: 0, y: 0.5, z: 0 })),
];

const POINT_PARAMS: ParamDef[] = DEFAULT_POINTS.map((p, i) => ({
  id: `p${i + 1}`,
  label: `Điểm ${i + 1}`,
  kind: 'vec3',
  default: p,
  ...(i >= CLASSIC_POINTS ? { advanced: true } : {}),
}));

function readPoints(params: Parameters<typeof numParam>[0]): Vec3[] {
  const n = Math.round(clamp(numParam(params, 'count', 4), ROUTE_MIN_POINTS, ROUTE_MAX_POINTS));
  const out: Vec3[] = [];
  for (let k = 0; k < n; k++) out.push(vec3Param(params, `p${k + 1}`, DEFAULT_POINTS[k]!));
  return out;
}

function nearestIndex(world: WorldApi, from: Vec3, points: readonly Vec3[]): number {
  let best = 0;
  let bestD = Infinity;
  points.forEach((p, k) => {
    const d = planarDelta(world.mode, from, p);
    const dist = Math.hypot(d.x, d.z);
    if (dist < bestD) {
      bestD = dist;
      best = k;
    }
  });
  return best;
}

/** Stick values that point a walker toward the nearest loose item within hand reach, or null when none is there. */
function turnTowardNearbyItem(world: WorldApi, self: EntityView): { moveX: number; moveY: number } | null {
  const held = world.heldItem(self.id);
  let best: { ux: number; uz: number; dist: number } | null = null;
  for (const it of world.listEntities()) {
    if (it.kind !== 'item' || !it.visible || it.carried || it.inHand || it.id === held) continue;
    const toward = unitToward(world.mode, self.position, it.position);
    if (toward && toward.dist <= GRAB_REACH && (best === null || toward.dist < best.dist)) best = toward;
  }
  return best ? moveForDirection(world.mode, world.cameraYaw(), best.ux, best.uz, TURN_PUSH) : null;
}

function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  let d = a % twoPi;
  if (d > Math.PI) d -= twoPi;
  else if (d <= -Math.PI) d += twoPi;
  return d;
}

/** Stick values that make a driverless vehicle roll toward `goal` at about `speed` units/s. */
function vehicleSticks(world: WorldApi, self: EntityView, goal: Vec3, speed: number, gain: number): { moveX: number; moveY: number } {
  const toward = unitToward(world.mode, self.position, goal);
  if (!toward) return { moveX: 0, moveY: 0 };
  const top = self.drive?.speed ?? 1;
  const mag = clamp(speed / Math.max(top, 1e-6), 0.1, 1);
  if (world.mode === '2d-side') return { moveX: Math.sign(toward.ux) * mag, moveY: 0 };
  if (self.vehicle?.steerMode === 'throttle') return throttleSticks(self, toward, mag, gain);
  // Direction steering: the stick simply points where the vehicle should go.
  return moveForDirection(world.mode, world.cameraYaw(), toward.ux, toward.uz, mag);
}

/** Gas and wheel for a throttle-steered vehicle: wheel from the heading error, gas from the wanted speed. */
function throttleSticks(self: EntityView, toward: { ux: number; uz: number }, mag: number, gain: number): { moveX: number; moveY: number } {
  const body = self.vehicle;
  if (!body) return { moveX: 0, moveY: 0 };
  const diff = wrapAngle(Math.atan2(toward.uz, toward.ux) - body.heading);
  return {
    moveX: clamp(diff * gain, -1, 1),
    moveY: Math.abs(diff) > SHARP_TURN ? mag * SHARP_TURN_GAS : mag,
  };
}

/** Rail mode for one tick: moves along the track at `speed` and puts the body on it. */
function railTick(args: {
  world: WorldApi;
  self: EntityView;
  s: RouteState;
  points: readonly Vec3[];
  loop: boolean;
  fillet: number;
  speed: number;
  dt: number;
  halted: boolean;
}): { reached: boolean; moving: boolean; goal: Vec3 | null } {
  const { world, self, s, points, loop, fillet, speed, dt, halted } = args;
  const key = `${loop}|${fillet}|${points.map((p) => `${p.x},${p.z}`).join(';')}`;
  if (!s.rail || s.rail.key !== key) {
    s.rail = { key, track: buildRail(points, loop, fillet) };
    if (s.pos !== null) s.pos = Math.min(s.pos, s.rail.track.total);
  }
  const track = s.rail.track;
  if (track.total <= 0) return { reached: false, moving: false, goal: null };
  const placing = s.pos === null;
  if (s.pos === null) {
    s.pos = nearestS(track, self.position.x, self.position.z);
    s.idx = null;
  }
  const here = railAt(track, s.pos);
  const err = Math.hypot(self.position.x - here.x, self.position.z - here.z);
  let moving = false;
  let reached = false;
  if (!halted && (placing || err <= RAIL_HOLD_ERROR)) {
    s.pos += s.dir * speed * dt;
    moving = true;
    if (loop) {
      s.pos = ((s.pos % track.total) + track.total) % track.total;
    } else if (s.pos >= track.total) {
      s.pos = 2 * track.total - s.pos;
      s.dir = -1;
    } else if (s.pos <= 0) {
      s.pos = -s.pos;
      s.dir = 1;
    }
    const next = upcomingPoint(track, s.pos, s.dir);
    if (s.idx !== null && next !== s.idx) reached = true;
    s.idx = next;
  } else if (s.idx === null || placing) {
    s.idx = upcomingPoint(track, s.pos, s.dir);
  }
  const pose = railAt(track, s.pos);
  if (self.kind === 'vehicle') {
    world.setVehicleTrack(self.id, { x: pose.x, z: pose.z, heading: pose.heading, speed: moving ? s.dir * speed : 0 });
    return { reached, moving, goal: null };
  }
  return { reached, moving, goal: { x: pose.x, y: self.position.y, z: pose.z } };
}

function railEvaluate(
  dt: number,
  world: WorldApi,
  self: EntityView,
  params: Parameters<typeof numParam>[0],
  s: RouteState,
  points: readonly Vec3[],
  shown: () => number,
  stop: boolean,
): PortValues {
  const reach = numParam(params, 'lookAhead', 2.5);
  const blocked = reach > 0 && world.probeAhead(self.id, reach) !== null;
  const halted = blocked || stop;
  const speed = clamp(numParam(params, 'speed', 5), 0.5, 30);
  const loop = strParam(params, 'style', 'loop') !== 'pingpong';
  const fillet = clamp(numParam(params, 'railCorner', 1.5), 0, 10);
  const r = railTick({ world, self, s, points, loop, fillet, speed, dt, halted });
  const out = { jump: false, blocked, reached: r.reached, index: shown(), atPoint: false };
  if (self.kind === 'vehicle') {
    if (halted) world.setVehicleInput(self.id, 0, 0, true);
    const top = self.drive?.speed ?? 1;
    return { ...out, moveX: 0, moveY: r.moving ? clamp(speed / Math.max(top, 1e-6), 0, 1) : 0 };
  }
  if (!r.goal || halted) return { ...out, moveX: 0, moveY: 0 };
  const steer = steerToward(world, self, r.goal);
  const top = self.drive?.speed ?? 0;
  const k = top > 0 ? clamp(speed / top, 0.1, 1) : 1;
  return { ...out, moveX: steer.moveX * k, moveY: steer.moveY * k, jump: steer.jump };
}

const IDLE: Record<string, number | boolean> = { moveX: 0, moveY: 0, jump: false, blocked: false, reached: false, index: 0, atPoint: false };

export const routeFollowNode: NodeDef<RouteState> = {
  kind: 'route-follow',
  label: 'Chạy theo tuyến',
  category: 'brain',
  description:
    'Cho xe (không cần người lái) hoặc nhân vật bot chạy qua các điểm Điểm 1, 2, 3... theo vòng lặp hoặc đi rồi quay lại. Nối "Ai" từ ô "Xe" của mảnh ghép Xe (hoặc từ nhân vật). Tự dừng khi có xe, người hay vật cản phía trước trong tầm "Dừng khi có vật phía trước". Muốn dừng ở đèn đỏ: nối tín hiệu đèn đỏ (ví dụ vùng cảm biến) vào "Dừng". Bot đi thẳng tới từng điểm, nên hãy đặt các điểm dọc theo đường.',
  inputs: [
    { id: 'self', type: 'object', label: 'Ai', required: true },
    { id: 'on', type: 'bool', label: 'Bật', default: true },
    { id: 'stop', type: 'bool', label: 'Dừng' },
  ],
  outputs: [
    { id: 'moveX', type: 'number', label: 'Đi ngang' },
    { id: 'moveY', type: 'number', label: 'Đi dọc' },
    { id: 'jump', type: 'bool', label: 'Nhảy' },
    { id: 'blocked', type: 'bool', label: 'Đang bị chặn' },
    { id: 'reached', type: 'bool', label: 'Tới điểm' },
    { id: 'index', type: 'number', label: 'Điểm hiện tại' },
    { id: 'atPoint', type: 'bool', label: 'Đang ở điểm' },
  ],
  params: [
    { id: 'count', label: 'Số điểm (2 đến 32)', kind: 'number', default: 4, min: ROUTE_MIN_POINTS, max: ROUTE_MAX_POINTS, step: 1 },
    ...POINT_PARAMS,
    {
      id: 'style',
      label: 'Kiểu',
      kind: 'select',
      default: 'loop',
      options: [
        { value: 'loop', label: 'Vòng lặp (hết điểm cuối quay về điểm 1)' },
        { value: 'pingpong', label: 'Đi rồi quay lại' },
      ],
    },
    {
      id: 'follow',
      label: 'Cách chạy',
      kind: 'select',
      default: 'steer',
      options: [
        { value: 'steer', label: 'Lái tới từng điểm (như cũ)' },
        { value: 'rail', label: 'Bám ray (chạy đúng đường nối các điểm, mượt ở góc, không trôi lệch)' },
      ],
    },
    { id: 'speed', label: 'Tốc độ', kind: 'number', default: 5, min: 0.5, max: 30, step: 0.5 },
    {
      id: 'lookAhead',
      label: 'Dừng khi có vật phía trước (đơn vị)',
      kind: 'number',
      default: 2.5,
      min: 0,
      max: 20,
      step: 0.5,
    },
    {
      id: 'arriveRadius',
      label: 'Bán kính tới điểm (0 = tự chọn: xe rộng hơn người)',
      kind: 'number',
      default: 0,
      min: 0,
      max: 10,
      step: 0.1,
      advanced: true,
    },
    { id: 'railCorner', label: 'Độ bo góc khi bám ray (0 = góc nhọn)', kind: 'number', default: 1.5, min: 0, max: 10, step: 0.1, advanced: true },
    { id: 'steerGain', label: 'Độ gắt khi cua (xe lái bằng ga - lái)', kind: 'number', default: 2, min: 0.5, max: 8, step: 0.5, advanced: true },
    { id: 'stopFor', label: 'Dừng ở mỗi điểm (giây, 0 = không dừng; chỉ khi chạy kiểu "Lái tới từng điểm")', kind: 'number', default: 0, min: 0, max: 30, step: 0.5, advanced: true },
    {
      id: 'faceAtStop',
      label: 'Khi dừng, quay mặt về',
      kind: 'select',
      default: 'none',
      options: [
        { value: 'none', label: 'Không quay (giữ hướng đang đi)' },
        { value: 'item', label: 'Vật ở gần nhất trong tầm tay' },
      ],
      advanced: true,
    },
  ],
  create: () => ({ idx: null, dir: 1, rail: null, pos: null, waitLeft: 0, turnPending: false }),
  evaluate(ctx, i, params, s): PortValues {
    const world = ctx.world;
    const self = liveCharacter(world, asObject(i.self));
    if (!self) return { ...IDLE };
    const points = readPoints(params);
    if (s.idx === null || s.idx >= points.length) s.idx = nearestIndex(world, self.position, points);
    const shown = (): number => (s.idx ?? 0) + 1;
    if (i.on !== undefined && !asBool(i.on)) {
      s.waitLeft = 0;
      return { ...IDLE, index: shown() };
    }

    const isVehicle = self.kind === 'vehicle';
    if (strParam(params, 'follow', 'steer') === 'rail') return railEvaluate(ctx.dt, world, self, params, s, points, shown, asBool(i.stop));
    // 0 = automatic: vehicles use a wide circle (they never stop at a point), walkers a tight one.
    const arriveParam = Math.max(0, numParam(params, 'arriveRadius', 0));
    const arriveRadius = arriveParam > 0 ? arriveParam : isVehicle ? VEHICLE_ARRIVE : WALKER_ARRIVE;
    // Reaching a point selects the next one at once, so the vehicle keeps rolling through the corner.
    let reached = false;
    const arrived = (p: Vec3): boolean => {
      if (!isVehicle) return hasArrived(world.mode, self.position, p, arriveRadius);
      const d = planarDelta(world.mode, self.position, p);
      return Math.hypot(d.x, d.z) <= arriveRadius;
    };
    if (arrived(points[s.idx]!)) {
      reached = true;
      if (strParam(params, 'style', 'loop') === 'pingpong') {
        if (s.idx + s.dir < 0 || s.idx + s.dir >= points.length) s.dir = s.dir === 1 ? -1 : 1;
        s.idx += s.dir;
      } else {
        s.idx = (s.idx + 1) % points.length;
      }
      const stopFor = Math.max(0, numParam(params, 'stopFor', 0));
      if (stopFor > 0 && !isVehicle) {
        s.waitLeft = stopFor;
        s.turnPending = strParam(params, 'faceAtStop', 'none') === 'item';
      }
    }
    if (s.waitLeft > 0) {
      // Stopped at the point: stand still (one tiny push first, to look at what is beside the walker).
      s.waitLeft = Math.max(0, s.waitLeft - ctx.dt);
      const turn = s.turnPending ? turnTowardNearbyItem(world, self) : null;
      s.turnPending = false;
      return { moveX: turn?.moveX ?? 0, moveY: turn?.moveY ?? 0, jump: false, blocked: false, reached, index: shown(), atPoint: true };
    }
    const goal = points[s.idx]!;

    const reach = numParam(params, 'lookAhead', 2.5);
    const blocked = reach > 0 && world.probeAhead(self.id, reach) !== null;
    const halted = blocked || asBool(i.stop);
    const speed = clamp(numParam(params, 'speed', 5), 0.5, 30);

    if (halted) {
      if (isVehicle) world.setVehicleInput(self.id, 0, 0, true);
      return { moveX: 0, moveY: 0, jump: false, blocked, reached, index: shown(), atPoint: false };
    }

    if (isVehicle) {
      const sticks = vehicleSticks(world, self, goal, speed, clamp(numParam(params, 'steerGain', STEER_GAIN), 0.5, 8));
      world.setVehicleInput(self.id, sticks.moveX, sticks.moveY);
      return { moveX: sticks.moveX, moveY: sticks.moveY, jump: false, blocked, reached, index: shown(), atPoint: false };
    }

    const steer = steerToward(world, self, goal);
    const top = self.drive?.speed ?? 0;
    const k = top > 0 ? clamp(speed / top, 0.1, 1) : 1;
    return { moveX: steer.moveX * k, moveY: steer.moveY * k, jump: steer.jump, blocked, reached, index: shown(), atPoint: false };
  },
};
