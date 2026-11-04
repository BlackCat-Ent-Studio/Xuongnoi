import type { NodeDef, Vec3 } from '../engine/types';
import {
  MIN_STOP_DISTANCE,
  STILL,
  distanceFor,
  edgeAhead,
  hasArrived,
  followPath,
  liveCharacter,
  unitToward,
  type SteerMemo,
} from './steering';
import { PATHFIND_PARAM, pathfindOn } from './pathfind-param';
import { notePatrol } from './sight-notes';
import { asBool, asObject, numParam, strParam, vec3Param } from './util';

interface PatrolState {
  /** Which end the bot is walking to; null until the first tick decides. */
  heading: 'A' | 'B' | null;
  /** Seconds of waiting left at the end just reached. */
  waitLeft: number;
  memo: SteerMemo;
}

const DEFAULT_A: Vec3 = { x: -3, y: 1, z: 0 };
const DEFAULT_B: Vec3 = { x: 3, y: 1, z: 0 };

export const patrolNode: NodeDef<PatrolState> = {
  kind: 'patrol',
  label: 'Đi tuần',
  category: 'brain',
  description:
    'Cho bot đi qua đi lại giữa hai điểm A và B, dừng chờ một lúc ở mỗi đầu. Nối "Đi ngang" / "Đi dọc" vào nhân vật bot. Phải nối tín hiệu vào "Bật" thì bot mới đi. Có thể quay đầu khi gặp mép vực. "Tuyến đi tuần" nối vào mảnh Dự đoán tầm nhìn để nó biết bot này đi đường nào.',
  inputs: [
    { id: 'self', type: 'object', label: 'Bot', required: true },
    { id: 'on', type: 'bool', label: 'Bật' },
  ],
  outputs: [
    { id: 'moveX', type: 'number', label: 'Đi ngang' },
    { id: 'moveY', type: 'number', label: 'Đi dọc' },
    { id: 'atEnd', type: 'bool', label: 'Khi tới điểm cuối' },
    { id: 'route', type: 'object', label: 'Tuyến đi tuần' },
  ],
  params: [
    { id: 'pointA', label: 'Điểm A', kind: 'vec3', default: DEFAULT_A },
    { id: 'pointB', label: 'Điểm B', kind: 'vec3', default: DEFAULT_B },
    { id: 'wait', label: 'Chờ ở mỗi đầu (giây)', kind: 'number', default: 1, min: 0, max: 30, step: 0.5 },
    {
      id: 'turnAtEdge',
      label: 'Quay đầu ở mép vực',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có' },
      ],
    },
    PATHFIND_PARAM,
  ],
  create: () => ({ heading: null, waitLeft: 0, memo: {} }),
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    const self = liveCharacter(world, asObject(i.self));
    // "Tuyến đi tuần" names the walker whose patrol a forecast may read; it is wired, never guessed.
    const still = { ...STILL, atEnd: false, route: self?.id ?? null };
    const on = asBool(i.on);
    if (!self || !on) return still;

    const a = vec3Param(params, 'pointA', DEFAULT_A);
    const b = vec3Param(params, 'pointB', DEFAULT_B);
    if (s.heading === null) {
      s.heading = distanceFor(world.mode, self.position, a) >= distanceFor(world.mode, self.position, b) ? 'A' : 'B';
    }
    notePatrol(world, self.id, { a, b, heading: s.heading, waitLeft: s.waitLeft, wait: Math.max(0, numParam(params, 'wait', 1)), tick: ctx.tick });
    if (s.waitLeft > 0) {
      s.waitLeft = Math.max(0, s.waitLeft - ctx.dt);
      return still;
    }

    const turn = (): void => {
      s.heading = s.heading === 'A' ? 'B' : 'A';
      s.waitLeft = Math.max(0, numParam(params, 'wait', 1));
    };
    const goal = s.heading === 'A' ? a : b;
    if (hasArrived(world.mode, self.position, goal, MIN_STOP_DISTANCE)) {
      turn();
      return { ...still, atEnd: true };
    }

    const turnAtEdge = strParam(params, 'turnAtEdge', 'no') === 'yes';
    if (turnAtEdge && world.isOnGround(self.id)) {
      const toward = unitToward(world.mode, self.position, goal);
      if (toward && edgeAhead(world, self, toward.ux, toward.uz)) {
        turn();
        return { ...still, atEnd: true };
      }
    }

    // A patrol told to turn at ledges walks straight; otherwise it routes around walls and over platforms.
    const steer = followPath({ world, self, goal, dt: ctx.dt, memo: s.memo, straight: turnAtEdge || !pathfindOn(params) }, { avoidFall: turnAtEdge });
    return { moveX: steer.moveX, moveY: steer.moveY, atEnd: false, route: self.id };
  },
};
