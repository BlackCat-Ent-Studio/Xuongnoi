import type { NodeDef, Vec3 } from '../engine/types';
import {
  STILL,
  distanceFor,
  followPath,
  hasArrived,
  liveCharacter,
  unitToward,
  visiblePosition,
  type SteerMemo,
} from './steering';
import { PATHFIND_PARAM, pathfindOn } from './pathfind-param';
import { asObject, numParam, strParam } from './util';

interface ChaseState {
  /** True while the bot has noticed the target and has not yet given up. */
  engaged: boolean;
  memo: SteerMemo;
}

/** How far away a fleeing bot aims, along the line from the target through itself. */
const FLEE_REACH = 4;
/** A chasing bot stops this close to its target instead of jittering on top of it. */
const CATCH_DISTANCE = 0.4;

export const chaseNode: NodeDef<ChaseState> = {
  kind: 'chase',
  label: 'Đuổi theo / Tránh xa',
  category: 'brain',
  description:
    'Bot để mắt tới một vật: thấy trong tầm nhìn thì đuổi theo (hoặc chạy trốn), ra xa quá tầm bỏ cuộc thì thôi. Nối "Đi ngang" / "Đi dọc" / "Nhảy" vào nhân vật bot.',
  inputs: [
    { id: 'self', type: 'object', label: 'Bot', required: true },
    { id: 'target', type: 'object', label: 'Mục tiêu', required: true },
  ],
  outputs: [
    { id: 'moveX', type: 'number', label: 'Đi ngang' },
    { id: 'moveY', type: 'number', label: 'Đi dọc' },
    { id: 'jump', type: 'bool', label: 'Nhảy' },
    { id: 'seeing', type: 'bool', label: 'Đang thấy mục tiêu' },
  ],
  params: [
    {
      id: 'mode',
      label: 'Cách làm',
      kind: 'select',
      default: 'chase',
      options: [
        { value: 'chase', label: 'Đuổi theo' },
        { value: 'flee', label: 'Tránh xa' },
      ],
    },
    { id: 'sightRange', label: 'Tầm nhìn', kind: 'number', default: 6, min: 0, max: 50, step: 0.5 },
    { id: 'giveUpRange', label: 'Bỏ cuộc khi xa hơn', kind: 'number', default: 9, min: 0, max: 80, step: 0.5 },
    PATHFIND_PARAM,
  ],
  create: () => ({ engaged: false, memo: {} }),
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    const self = liveCharacter(world, asObject(i.self));
    const targetPos = visiblePosition(world, asObject(i.target));
    if (!self || !targetPos) {
      s.engaged = false;
      return { ...STILL, seeing: false };
    }

    const sight = Math.max(0, numParam(params, 'sightRange', 6));
    const giveUp = Math.max(sight, numParam(params, 'giveUpRange', 9));
    const dist = distanceFor(world.mode, self.position, targetPos);
    if (!s.engaged && dist <= sight) s.engaged = true;
    else if (s.engaged && dist > giveUp) s.engaged = false;
    if (!s.engaged) return { ...STILL, seeing: false };

    const fleeing = strParam(params, 'mode', 'chase') === 'flee';
    let goal: Vec3 = targetPos;
    if (fleeing) {
      const away = unitToward(world.mode, targetPos, self.position) ?? { ux: 1, uz: 0, dist: 0 };
      goal = { x: self.position.x + away.ux * FLEE_REACH, y: self.position.y, z: self.position.z + away.uz * FLEE_REACH };
    } else if (hasArrived(world.mode, self.position, targetPos, CATCH_DISTANCE)) {
      return { ...STILL, seeing: true };
    }

    // Fleeing runs straight away from the threat: a route to a point behind a wall could lead past the chaser.
    const steer = followPath({ world, self, goal, dt: ctx.dt, memo: s.memo, straight: fleeing || !pathfindOn(params) }, { avoidFall: fleeing });
    return { ...steer, seeing: true };
  },
};
