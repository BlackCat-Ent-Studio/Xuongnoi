import type { NodeDef, Vec3 } from '../engine/types';
import {
  MIN_STOP_DISTANCE,
  SLOW_RADIUS,
  STILL,
  followPath,
  hasArrived,
  liveCharacter,
  visiblePosition,
  type SteerMemo,
} from './steering';
import { PATHFIND_PARAM, pathfindOn } from './pathfind-param';
import { asBool, asObject, numParam, risingEdge, vec3Param, type EdgeState } from './util';

interface GoToState {
  arrived: EdgeState;
  memo: SteerMemo;
}

const DEFAULT_TARGET: Vec3 = { x: 0, y: 1, z: 0 };

export const goToNode: NodeDef<GoToState> = {
  kind: 'go-to',
  label: 'Đi tới',
  category: 'brain',
  description:
    'Cho bot đi tới một vật hoặc một điểm, rồi dừng lại và báo "Đã tới". Nối "Đi ngang" / "Đi dọc" / "Nhảy" vào nhân vật bot. Nếu không nối "Đích" thì bot đi tới điểm đã đặt.',
  inputs: [
    { id: 'self', type: 'object', label: 'Bot', required: true },
    { id: 'target', type: 'object', label: 'Đích (vật)' },
    { id: 'go', type: 'bool', label: 'Cho đi', default: true },
  ],
  outputs: [
    { id: 'moveX', type: 'number', label: 'Đi ngang' },
    { id: 'moveY', type: 'number', label: 'Đi dọc' },
    { id: 'jump', type: 'bool', label: 'Nhảy' },
    { id: 'arrived', type: 'bool', label: 'Đã tới' },
    { id: 'arrivedPulse', type: 'bool', label: 'Vừa tới' },
  ],
  params: [
    { id: 'targetPos', label: 'Điểm đến (khi không nối Đích)', kind: 'vec3', default: DEFAULT_TARGET },
    {
      id: 'stopDistance',
      label: 'Dừng cách đích',
      kind: 'number',
      default: 0.5,
      min: MIN_STOP_DISTANCE,
      max: 20,
      step: 0.1,
    },
    { id: 'slowRadius', label: 'Chậm lại khi gần tới', kind: 'number', default: SLOW_RADIUS, min: 0.1, max: 5, step: 0.1, advanced: true },
    PATHFIND_PARAM,
  ],
  create: () => ({ arrived: { prev: false }, memo: {} }),
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    const go = i.go === undefined ? true : asBool(i.go);
    const self = liveCharacter(world, asObject(i.self));
    if (!self) {
      risingEdge(s.arrived, false);
      return { ...STILL, arrived: false, arrivedPulse: false };
    }
    // A wired object that has vanished (hidden crate...) falls back to the fixed point.
    const goal = visiblePosition(world, asObject(i.target)) ?? vec3Param(params, 'targetPos', DEFAULT_TARGET);
    const near = hasArrived(world.mode, self.position, goal, numParam(params, 'stopDistance', 0.5));
    const arrived = go && near;
    const arrivedPulse = risingEdge(s.arrived, arrived);
    if (!go || near) return { ...STILL, arrived, arrivedPulse };

    const steer = followPath({ world, self, goal, dt: ctx.dt, memo: s.memo, straight: !pathfindOn(params) }, { slowRadius: numParam(params, 'slowRadius', SLOW_RADIUS) });
    return { ...steer, arrived, arrivedPulse };
  },
};
