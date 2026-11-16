import type { EntityId, NodeDef } from '../engine/types';
import { motorRpmStep, motorTargetRpm } from '../world/robot-drive';
import { asNum, asObject, numParam, strParam } from './util';

interface MotorState {
  /** Wheel speed now, revolutions per minute (positive = pushes the robot forward). */
  rpm: number;
  /** Chassis this motor was mounted on last tick, so it can be unplugged when the wire changes. */
  body: EntityId | null;
}

/** Wheel speed below this (rpm) no longer counts as turning. */
const TURNING_RPM = 0.5;

/**
 * One motor with its wheel, mounted on a robot chassis. The power wire sets the wheel speed (-1..1 of the top speed); the
 * wheel pushes the chassis, and the chassis motion comes from ALL motors mounted on it together. Without a power wire
 * the wheel holds still, so the chassis never moves on its own.
 */
export const motorNode: NodeDef<MotorState> = {
  kind: 'motor',
  label: 'Động cơ',
  category: 'action',
  description:
    'Một động cơ gắn bánh xe lên Thân robot. Nối "Thân" tới Thân robot muốn gắn, nối "Công suất" (-1 tới 1) để bánh quay. Mỗi bánh một động cơ: hai động cơ hai bên chạy khác tốc độ thì robot rẽ, ngược chiều nhau thì robot quay tại chỗ. Không nối "Công suất" thì bánh đứng yên.',
  inputs: [
    { id: 'body', type: 'object', label: 'Thân' },
    { id: 'power', type: 'number', label: 'Công suất' },
  ],
  outputs: [
    { id: 'rpm', type: 'number', label: 'Vòng quay' },
    { id: 'turning', type: 'bool', label: 'Đang quay' },
  ],
  params: [
    { id: 'side', label: 'Vị trí ngang trên thân (m, âm = bên trái, dương = bên phải)', kind: 'number', default: 0.4, min: -5, max: 5, step: 0.05 },
    { id: 'forward', label: 'Vị trí dọc trên thân (m, dương = phía trước)', kind: 'number', default: 0, min: -5, max: 5, step: 0.05 },
    { id: 'wheelRadius', label: 'Bán kính bánh (m)', kind: 'number', default: 0.15, min: 0.02, max: 2, step: 0.01 },
    { id: 'maxRpm', label: 'Tốc độ tối đa (vòng/phút)', kind: 'number', default: 120, min: 1, max: 2000, step: 5 },
    { id: 'accel', label: 'Độ tăng tốc (vòng/phút mỗi giây)', kind: 'number', default: 400, min: 10, max: 10000, step: 10 },
    {
      id: 'reverse',
      label: 'Chiều quay',
      kind: 'select',
      default: 'normal',
      options: [
        { value: 'normal', label: 'Bình thường (công suất dương = tiến)' },
        { value: 'reversed', label: 'Đảo chiều (công suất dương = lùi)' },
      ],
    },
  ],
  create() {
    return { rpm: 0, body: null };
  },
  evaluate(ctx, i, params, s) {
    const body = asObject(i.body);
    if (s.body !== null && s.body !== body) ctx.world.setRobotWheel(s.body, ctx.nodeId, null);
    s.body = body;
    // An unwired power input reads 0: the wheel holds still.
    const target = motorTargetRpm(asNum(i.power), numParam(params, 'maxRpm', 120), strParam(params, 'reverse', 'normal') === 'reversed');
    s.rpm = motorRpmStep(s.rpm, target, numParam(params, 'accel', 400), ctx.dt);
    if (body !== null) {
      ctx.world.setRobotWheel(body, ctx.nodeId, {
        side: numParam(params, 'side', 0.4),
        forward: numParam(params, 'forward', 0),
        radius: Math.max(0.02, numParam(params, 'wheelRadius', 0.15)),
        rpm: s.rpm,
      });
    }
    return { rpm: s.rpm, turning: Math.abs(s.rpm) > TURNING_RPM };
  },
};
