import type { NodeDef, Params, PortDef, PortValues, Vec3, WorldApi } from '../engine/types';
import { gotoStep, type GotoGains, type GotoMemory } from '../world/robot-goto';
import { asBool, asNum, asObject, clamp, numParam, risingEdge, strParam, vec3Param, type EdgeState } from './util';

interface RobotGotoState {
  memory: GotoMemory;
  arrived: EdgeState;
}

const DEFAULT_TARGET: Vec3 = { x: 0, y: 0.5, z: 0 };

const XZ_PORTS: PortDef[] = [
  { id: 'x', type: 'number', label: 'Đích X' },
  { id: 'z', type: 'number', label: 'Đích Z' },
];
const FACE_PORT: PortDef = { id: 'face', type: 'number', label: 'Hướng khi tới' };

type TargetFrom = 'object' | 'point' | 'ports';
function targetFrom(params: Params): TargetFrom {
  const v = strParam(params, 'targetFrom', 'object');
  return v === 'point' || v === 'ports' ? v : 'object';
}
const usesXZ = (params: Params): boolean => targetFrom(params) === 'ports';
const facesOnArrive = (params: Params): boolean => strParam(params, 'faceOnArrive', 'no') === 'yes';

const IDLE = { left: 0, right: 0, arrived: false, arrivedPulse: false, distance: 0, headingError: 0 };

/** Where the settings say the robot should go, or null when there is nowhere to go right now. */
function goalOf(world: WorldApi, i: PortValues, params: Params): { x: number; z: number } | null {
  const from = targetFrom(params);
  if (from === 'point') return vec3Param(params, 'targetPos', DEFAULT_TARGET);
  if (from === 'ports') return { x: asNum(i.x), z: asNum(i.z) };
  const id = asObject(i.target);
  const target = id !== null ? world.getEntity(id) : undefined;
  return target && target.visible ? target.position : null;
}

export function gotoGains(params: Params): GotoGains {
  return {
    power: clamp(numParam(params, 'power', 0.6), 0, 1),
    turnGain: Math.max(0, numParam(params, 'turnGain', 0.02)),
    turnDamp: Math.max(0, numParam(params, 'turnDamp', 0.002)),
    pivotAngle: clamp(numParam(params, 'pivotAngle', 45), 1, 180),
    slowDistance: Math.max(0, numParam(params, 'slowDistance', 1)),
    tolerance: Math.max(0.01, numParam(params, 'tolerance', 0.1)),
    minPower: clamp(numParam(params, 'minPower', 0.08), 0, 1),
  };
}

/**
 * The driver of a two-motor robot: it looks at where the chassis is and which way it faces, and says how much power the
 * left and the right motors should get to reach a point. It is a controller card only: without wires from its two power
 * outputs to "Động cơ" pieces nothing moves, and what the robot then does is decided by the wheels and the ground.
 */
export const robotGotoNode: NodeDef<RobotGotoState> = {
  kind: 'robot-goto',
  label: 'Đi tới điểm',
  category: 'brain',
  description:
    'Bộ lái cho robot hai động cơ: nhìn vị trí và hướng mũi của Thân robot rồi tính công suất cho động cơ bên trái và bên phải để robot chạy tới đích. Nối "Robot" tới Thân robot, "Đích" tới một Mốc sàn (hoặc vật bất kỳ; trong phần chỉnh có thể đổi sang một điểm đặt sẵn hay hai con số X, Z), "Chạy" tới tín hiệu cho phép đi, rồi nối "Trái" và "Phải" sang "Công suất" của hai Động cơ. Lệch hướng nhiều thì robot quay tại chỗ trước; gần tới thì chậm lại; tới nơi thì dừng và bật "Đã tới". Chưa có đích thì robot đứng chờ. Mảnh này không tự đẩy robot: không nối sang Động cơ thì robot đứng yên.',
  inputs: [
    { id: 'robot', type: 'object', label: 'Robot', required: true },
    { id: 'target', type: 'object', label: 'Đích' },
    { id: 'go', type: 'bool', label: 'Chạy' },
  ],
  optionalInputs: {
    all: [...XZ_PORTS, FACE_PORT],
    active: (params) => [...(usesXZ(params) ? XZ_PORTS : []), ...(facesOnArrive(params) ? [FACE_PORT] : [])],
  },
  outputs: [
    { id: 'left', type: 'number', label: 'Trái' },
    { id: 'right', type: 'number', label: 'Phải' },
    { id: 'arrived', type: 'bool', label: 'Đã tới' },
    { id: 'arrivedPulse', type: 'bool', label: 'Khi tới nơi' },
    { id: 'distance', type: 'number', label: 'Còn cách' },
    { id: 'headingError', type: 'number', label: 'Lệch hướng' },
  ],
  params: [
    {
      id: 'targetFrom',
      label: 'Đích lấy từ',
      kind: 'select',
      default: 'object',
      options: [
        { value: 'object', label: 'Vật nối vào cổng "Đích" (Mốc sàn, thùng hàng...)' },
        { value: 'point', label: 'Điểm đặt sẵn bên dưới' },
        { value: 'ports', label: 'Hai con số nối vào cổng "Đích X" và "Đích Z"' },
      ],
    },
    { id: 'targetPos', label: 'Điểm đặt sẵn (chỉ dùng x và z)', kind: 'vec3', default: DEFAULT_TARGET, place: 'point', shownWhen: (params) => targetFrom(params) === 'point' },
    { id: 'power', label: 'Công suất chạy tối đa (0 đến 1)', kind: 'number', default: 0.6, min: 0, max: 1, step: 0.05 },
    { id: 'tolerance', label: 'Coi như đã tới khi còn cách (m)', kind: 'number', default: 0.1, min: 0.01, max: 5, step: 0.01 },
    { id: 'slowDistance', label: 'Bắt đầu chậm lại khi còn cách (m)', kind: 'number', default: 1, min: 0, max: 20, step: 0.1 },
    { id: 'turnGain', label: 'Độ nhạy rẽ (công suất cho mỗi độ lệch hướng)', kind: 'number', default: 0.02, min: 0, max: 1, step: 0.005 },
    { id: 'pivotAngle', label: 'Quay tại chỗ khi lệch hướng từ (độ)', kind: 'number', default: 45, min: 1, max: 180, step: 5 },
    { id: 'turnDamp', label: 'Giảm lắc mũi (công suất trừ đi cho mỗi độ/giây đang quay)', kind: 'number', default: 0.002, min: 0, max: 0.1, step: 0.001, advanced: true },
    { id: 'minPower', label: 'Công suất nhỏ nhất khi còn đang đi (0 đến 1)', kind: 'number', default: 0.08, min: 0, max: 1, step: 0.01, advanced: true },
    {
      id: 'faceOnArrive',
      label: 'Tới nơi thì quay mũi về một hướng',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không (dừng theo hướng đang chạy tới)' },
        { value: 'yes', label: 'Có (hiện cổng "Hướng khi tới", độ: 0 = sang phải, 90 = xuống dưới)' },
      ],
      advanced: true,
    },
  ],
  create: () => ({ memory: { near: false, faced: false, last: null }, arrived: { prev: false } }),
  evaluate(ctx, i, params, s) {
    const id = asObject(i.robot);
    const self = id !== null ? ctx.world.getEntity(id) : undefined;
    if (!self || !self.visible || !self.robot) {
      s.memory = { near: false, faced: false, last: null };
      risingEdge(s.arrived, false);
      return { ...IDLE };
    }
    const goal = goalOf(ctx.world, i, params);
    // No goal (nothing wired to "Đích", the object is hidden, "Tìm mốc sàn" found no marker): the robot waits where it is.
    if (!goal) {
      s.memory = { near: false, faced: false, last: null };
      risingEdge(s.arrived, false);
      return { ...IDLE };
    }
    const pose = { x: self.position.x, z: self.position.z, heading: self.robot.heading, turnRate: self.robot.turnRate };
    const cmd = gotoStep(pose, goal, gotoGains(params), s.memory, asBool(i.go), ctx.mode === '2d-side', facesOnArrive(params) ? asNum(i.face) : null);
    return {
      left: cmd.left,
      right: cmd.right,
      arrived: cmd.arrived,
      arrivedPulse: risingEdge(s.arrived, cmd.arrived),
      distance: cmd.distance,
      headingError: cmd.headingError,
    };
  },
};
