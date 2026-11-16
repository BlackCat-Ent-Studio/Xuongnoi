import type { NodeDef, Params, PortDef, PortValues } from '../engine/types';
import { DEFAULT_PID_CONFIG, createPidState, pidHold, pidStep, resetPid, type PidState } from './pid-math';
import { asBool, asNum, numParam, risingEdge, strParam, type EdgeState } from './util';

interface PidNodeState {
  pid: PidState;
  reset: EdgeState;
}

const YES_NO = [
  { value: 'yes', label: 'Có' },
  { value: 'no', label: 'Không' },
];

const PART_PORTS: PortDef[] = [
  { id: 'p', type: 'number', label: 'Phần tỉ lệ (P)' },
  { id: 'i', type: 'number', label: 'Phần tích lũy (I)' },
  { id: 'd', type: 'number', label: 'Phần dự đoán (D)' },
];

const isYes = (params: Params, id: string, fallback: 'yes' | 'no'): boolean => strParam(params, id, fallback) === 'yes';

export const pidNode: NodeDef<PidNodeState> = {
  kind: 'pid',
  label: 'Bộ điều khiển PID',
  category: 'math',
  description:
    'Tự chỉnh một đầu ra để giá trị đo được tiến về giá trị đặt rồi giữ nguyên ở đó (ga xe, vị trí, nhiệt độ...). Tỉ lệ (Kp) đẩy theo độ lệch, tích lũy (Ki) xóa độ lệch còn sót, dự đoán (Kd) hãm bớt khi đang tới nhanh.',
  inputs: [
    { id: 'measured', type: 'number', label: 'Giá trị đo' },
    // NaN marks "no wire": the piece then uses the "Giá trị đặt" setting. A wired number is never NaN.
    { id: 'target', type: 'number', label: 'Giá trị đặt', default: Number.NaN },
    // A computing piece does nothing to the world, so it is on until a wire switches it off.
    { id: 'enable', type: 'bool', label: 'Bật', default: true },
    { id: 'reset', type: 'bool', label: 'Đặt lại' },
  ],
  outputs: [
    { id: 'out', type: 'number', label: 'Điều khiển' },
    { id: 'error', type: 'number', label: 'Sai lệch' },
    { id: 'saturated', type: 'bool', label: 'Chạm giới hạn' },
  ],
  optionalOutputs: { all: PART_PORTS, active: (params) => (strParam(params, 'showParts', 'no') === 'yes' ? PART_PORTS : []) },
  params: [
    { id: 'kp', label: 'Kp (tỉ lệ)', kind: 'number', default: DEFAULT_PID_CONFIG.kp, step: 0.1 },
    { id: 'ki', label: 'Ki (tích lũy)', kind: 'number', default: DEFAULT_PID_CONFIG.ki, step: 0.1 },
    { id: 'kd', label: 'Kd (dự đoán)', kind: 'number', default: DEFAULT_PID_CONFIG.kd, step: 0.05 },
    { id: 'target', label: 'Giá trị đặt (khi không nối dây)', kind: 'number', default: 0, step: 1 },
    { id: 'outMin', label: 'Điều khiển nhỏ nhất', kind: 'number', default: DEFAULT_PID_CONFIG.outMin, step: 0.5 },
    { id: 'outMax', label: 'Điều khiển lớn nhất', kind: 'number', default: DEFAULT_PID_CONFIG.outMax, step: 0.5 },
    { id: 'antiWindup', label: 'Chống tích lũy quá đà', kind: 'select', default: 'yes', options: YES_NO, advanced: true },
    { id: 'dFilter', label: 'Làm mượt phần D (0 đến 1)', kind: 'number', default: DEFAULT_PID_CONFIG.dFilter, min: 0, max: 1, step: 0.1, advanced: true },
    {
      id: 'dOnMeasurement',
      label: 'D tính trên giá trị đo',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Có (không giật khi đổi giá trị đặt)' },
        { value: 'no', label: 'Không (tính trên sai lệch)' },
      ],
      advanced: true,
    },
    {
      id: 'showParts',
      label: 'Hiện ba phần P, I, D',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có (hiện thêm ô ra P, I, D)' },
      ],
      advanced: true,
    },
  ],
  create: () => ({ pid: createPidState(), reset: { prev: false } }),
  evaluate(ctx, i, params, s) {
    if (risingEdge(s.reset, asBool(i.reset))) resetPid(s.pid);
    const measured = asNum(i.measured);
    const target = typeof i.target === 'number' && Number.isFinite(i.target) ? i.target : numParam(params, 'target', 0);
    const r = asBool(i.enable)
      ? pidStep(
          s.pid,
          {
            kp: numParam(params, 'kp', DEFAULT_PID_CONFIG.kp),
            ki: numParam(params, 'ki', DEFAULT_PID_CONFIG.ki),
            kd: numParam(params, 'kd', DEFAULT_PID_CONFIG.kd),
            outMin: numParam(params, 'outMin', DEFAULT_PID_CONFIG.outMin),
            outMax: numParam(params, 'outMax', DEFAULT_PID_CONFIG.outMax),
            antiWindup: isYes(params, 'antiWindup', 'yes'),
            dFilter: numParam(params, 'dFilter', DEFAULT_PID_CONFIG.dFilter),
            dOnMeasurement: isYes(params, 'dOnMeasurement', 'yes'),
            dt: ctx.dt,
          },
          measured,
          target,
        )
      : pidHold(s.pid, measured, target);
    const out: PortValues = { out: r.out, error: r.error, saturated: r.saturated, p: r.p, i: r.i, d: r.d };
    return out;
  },
};
