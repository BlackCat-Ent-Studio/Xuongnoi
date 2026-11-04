import type { NodeDef } from '../engine/types';
import {
  STILL,
  distanceFor,
  followPath,
  hasArrived,
  liveCharacter,
  moveForDirection,
  unitToward,
  visiblePosition,
  type SteerMemo,
} from './steering';
import { asBool, asObject, numParam } from './util';

interface FightState {
  memo: SteerMemo;
  /** Seconds until the next attack may start. */
  cooldown: number;
  /** Seconds left of stepping back after an attack. */
  backoff: number;
}

/** After each attack the bot steps back this long before closing in again. */
const BACKOFF_SECONDS = 0.25;
/** Stick strength used to keep facing the target while standing in range (too small to move the body). */
const FACE_NUDGE = 0.02;

export const fightNode: NodeDef<FightState> = {
  kind: 'fight',
  label: 'Đánh địch',
  category: 'brain',
  description:
    'Bot tìm đường tới mục tiêu và ra đòn khi đã đủ gần: tín hiệu "Ra đòn" nối vào "Dùng" của node Cầm dụng cụ (có dụng cụ thì đòn mạnh hơn). Đánh xong lùi lại một chút rồi vào tiếp. Nối tín hiệu vào "Bật" thì bot mới hoạt động, rồi nối "Đi ngang" / "Đi dọc" / "Nhảy" vào nhân vật bot.',
  inputs: [
    { id: 'self', type: 'object', label: 'Bot', required: true },
    { id: 'target', type: 'object', label: 'Mục tiêu', required: true },
    { id: 'go', type: 'bool', label: 'Bật' },
  ],
  outputs: [
    { id: 'moveX', type: 'number', label: 'Đi ngang' },
    { id: 'moveY', type: 'number', label: 'Đi dọc' },
    { id: 'jump', type: 'bool', label: 'Nhảy' },
    { id: 'attack', type: 'bool', label: 'Ra đòn' },
  ],
  params: [
    { id: 'range', label: 'Tầm đánh', kind: 'number', default: 1.2, min: 0.3, max: 5, step: 0.1 },
    { id: 'attackCooldown', label: 'Nghỉ giữa các đòn (giây)', kind: 'number', default: 0.8, min: 0.1, max: 10, step: 0.1 },
    { id: 'sightRange', label: 'Tầm nhìn', kind: 'number', default: 8, min: 0, max: 50, step: 0.5 },
    { id: 'backoffSeconds', label: 'Thời gian lùi sau mỗi đòn (giây)', kind: 'number', default: 0.25, min: 0, max: 3, step: 0.05, advanced: true },
  ],
  create: () => ({ memo: {}, cooldown: 0, backoff: 0 }),
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    s.cooldown = Math.max(0, s.cooldown - ctx.dt);
    s.backoff = Math.max(0, s.backoff - ctx.dt);

    const selfId = asObject(i.self);
    const targetId = asObject(i.target);
    const self = liveCharacter(world, selfId);
    const targetPos = visiblePosition(world, targetId);
    const idle = { ...STILL, attack: false };
    if (!asBool(i.go) || !self || !selfId || !targetPos || !targetId) return idle;
    if (world.healthOf(selfId)?.dead || world.healthOf(targetId)?.dead) return idle;

    const sight = Math.max(0, numParam(params, 'sightRange', 8));
    if (distanceFor(world.mode, self.position, targetPos) > sight) return idle;

    const range = Math.max(0.3, numParam(params, 'range', 1.2));
    const toward = unitToward(world.mode, self.position, targetPos);

    if (s.backoff > 0 && toward) {
      const away = followPath(
        {
          world,
          self,
          goal: { x: self.position.x - toward.ux * 3, y: self.position.y, z: self.position.z - toward.uz * 3 },
          dt: ctx.dt,
          memo: s.memo,
          straight: true,
        },
        { avoidFall: true },
      );
      return { ...away, attack: false };
    }

    if (hasArrived(world.mode, self.position, targetPos, range)) {
      // Close enough: stand and strike. A tiny push toward the target keeps the bot facing it.
      const face = toward ? moveForDirection(world.mode, world.cameraYaw(), toward.ux, toward.uz, FACE_NUDGE) : STILL;
      const attack = s.cooldown <= 0;
      if (attack) {
        s.cooldown = Math.max(0.1, numParam(params, 'attackCooldown', 0.8));
        s.backoff = Math.max(0, numParam(params, 'backoffSeconds', BACKOFF_SECONDS));
      }
      return { moveX: face.moveX, moveY: face.moveY, jump: false, attack };
    }

    const steer = followPath({ world, self, goal: targetPos, dt: ctx.dt, memo: s.memo });
    return { ...steer, attack: false };
  },
};
