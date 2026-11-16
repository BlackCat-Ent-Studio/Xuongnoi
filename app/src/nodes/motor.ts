import type { EntityId, NodeDef, Params, PortDef } from '../engine/types';
import { motorRpmStep, motorTargetRpm } from '../world/robot-drive';
import { asBool, asNum, asObject, numParam, risingEdge, strParam, type EdgeState } from './util';

interface MotorState {
  /** Wheel speed now, revolutions per minute (positive = pushes the robot forward). */
  rpm: number;
  /** Revolutions the wheel has turned since the start or the last reset (signed, like an encoder count). */
  turns: number;
  reset: EdgeState;
  /** Chassis this motor was mounted on last tick, so it can be unplugged when the wire changes. */
  body: EntityId | null;
}

const TURNS_PORT: PortDef = { id: 'turns', type: 'number', label: 'Số vòng đã quay' };
const RESET_TURNS_PORT: PortDef = { id: 'resetTurns', type: 'bool', label: 'Đặt lại vòng' };
const showsTurns = (params: Params): boolean => strParam(params, 'showTurns', 'no') === 'yes';

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
  // Only while "Hiện bộ đếm vòng" is on, so a motor card keeps its size on every old board.
  optionalInputs: { all: [RESET_TURNS_PORT], active: (params) => (showsTurns(params) ? [RESET_TURNS_PORT] : []) },
  outputs: [
    { id: 'rpm', type: 'number', label: 'Vòng quay' },
    { id: 'turning', type: 'bool', label: 'Đang quay' },
  ],
  optionalOutputs: { all: [TURNS_PORT], active: (params) => (showsTurns(params) ? [TURNS_PORT] : []) },
  params: [
    { id: 'side', label: 'Vị trí ngang trên thân (m, âm = bên trái, dương = bên phải)', kind: 'number', default: 0.4, min: -5, max: 5, step: 0.05 },
    { id: 'forward', label: 'Vị trí dọc trên thân (m, dương = phía trước)', kind: 'number', default: 0, min: -5, max: 5, step: 0.05 },
    { id: 'wheelRadius', label: 'Bán kính bánh (m)', kind: 'number', default: 0.15, min: 0.02, max: 2, step: 0.01 },
    { id: 'maxRpm', label: 'Tốc độ tối đa (vòng/phút)', kind: 'number', default: 120, min: 1, max: 2000, step: 5 },
    { id: 'accel', label: 'Độ tăng tốc (vòng/phút mỗi giây)', kind: 'number', default: 400, min: 10, max: 10000, step: 10 },
    { id: 'maxForce', label: 'Lực kéo tối đa (N, khi robot đẩy vật; nhân với công suất)', kind: 'number', default: 30, min: 0, max: 1000000, step: 5 },
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
    {
      id: 'showTurns',
      label: 'Hiện bộ đếm vòng ("Số vòng đã quay" và "Đặt lại vòng")',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có (đếm vòng bánh đã quay, như bộ mã hóa vòng quay encoder)' },
      ],
      advanced: true,
    },
  ],
  create() {
    return { rpm: 0, turns: 0, reset: { prev: false }, body: null };
  },
  evaluate(ctx, i, params, s) {
    const body = asObject(i.body);
    if (s.body !== null && s.body !== body) ctx.world.setRobotWheel(s.body, ctx.nodeId, null);
    s.body = body;
    // An unwired power input reads 0: the wheel holds still.
    const target = motorTargetRpm(asNum(i.power), numParam(params, 'maxRpm', 120), strParam(params, 'reverse', 'normal') === 'reversed');
    s.rpm = motorRpmStep(s.rpm, target, numParam(params, 'accel', 400), ctx.dt);
    // Encoder: the wheel's own revolutions, whether or not the robot is held back by a wall.
    if (risingEdge(s.reset, asBool(i.resetTurns))) s.turns = 0;
    else s.turns += (s.rpm / 60) * ctx.dt;
    if (body !== null) {
      const maxRpm = Math.max(1, numParam(params, 'maxRpm', 120));
      ctx.world.setRobotWheel(body, ctx.nodeId, {
        pushN: Math.max(0, numParam(params, 'maxForce', 30)) * Math.min(1, Math.abs(s.rpm) / maxRpm),
        side: numParam(params, 'side', 0.4),
        forward: numParam(params, 'forward', 0),
        radius: Math.max(0.02, numParam(params, 'wheelRadius', 0.15)),
        rpm: s.rpm,
      });
    }
    return { rpm: s.rpm, turning: Math.abs(s.rpm) > TURNING_RPM, turns: s.turns };
  },
};
