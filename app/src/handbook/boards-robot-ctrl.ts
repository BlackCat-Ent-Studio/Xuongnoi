import type { Board } from '../engine/types';
import { build, type Spec, type Wire } from './boards-math-object-output';

/**
 * "Thử ngay" boards for the control and measurement pieces. Built only from general pieces:
 * a timer and a map-range make a target that jumps between two places, a character is the machine, the PID drives it
 * and the plot draws target, position and control side by side.
 */

const v = (x: number, y: number, z = 0) => ({ x, y, z });

export interface ChaseOptions {
  kp: number;
  ki: number;
  kd: number;
  /** Seconds the whole back-and-forth takes (the target flips once per half). */
  period: number;
}

/** Specs and wires shared by the boards: start card, flipping target, a character on a floor and the PID wiring. */
export function chaseParts(o: ChaseOptions): { specs: Spec[]; wires: Wire[] } {
  const half = o.period / 2;
  const specs: Spec[] = [
    { id: 'start', kind: 'on-start', col: 0, row: 0 },
    { id: 'clock', kind: 'timer', col: 0, row: 1, params: { seconds: o.period, repeat: 'yes' } },
    // "Giây còn lại" runs from `period` down to 0: above the half it reads one place, below it the other.
    { id: 'target', kind: 'map-range', col: 1, row: 0, params: { inMin: half - 0.01, inMax: half + 0.01, outMin: -5, outMax: 5, clamp: 'yes' } },
    { id: 'robot', kind: 'character', col: 1, row: 1, params: { position: v(-5, 1), look: 'robot', speed: 4 } },
    { id: 'floor', kind: 'block', col: 1, row: 3, params: { position: v(0, -0.5), size: v(24, 1, 1), color: '#65a30d' } },
    { id: 'pid', kind: 'pid', col: 2, row: 0, params: { kp: o.kp, ki: o.ki, kd: o.kd, outMin: -1, outMax: 1 } },
  ];
  const wires: Wire[] = [
    ['start', 'started', 'clock', 'run'],
    ['clock', 'left', 'target', 'value'],
    ['target', 'value', 'pid', 'target'],
    ['robot', 'x', 'pid', 'measured'],
    ['pid', 'out', 'robot', 'moveX'],
  ];
  return { specs, wires };
}

function tryPid(): Board {
  const c = chaseParts({ kp: 0.8, ki: 0, kd: 0, period: 8 });
  return build(
    'Thử: Bộ điều khiển PID',
    '2d-side',
    'Rô-bốt tự đuổi theo vị trí đặt: cứ 4 giây vị trí đặt nhảy từ -5 sang 5 rồi quay lại. Nhìn Đồ thị: đường vàng (rô-bốt) bám theo đường xanh (giá trị đặt). Bấm vào mảnh PID, đổi Kp, Ki, Kd rồi chạy lại để thấy khác biệt.',
    [
      ...c.specs,
      {
        id: 'plot',
        kind: 'signal-plot',
        col: 2,
        row: 1,
        params: { title: 'Đuổi theo mục tiêu', windowSeconds: 10, labelA: 'Giá trị đặt', labelB: 'Vị trí rô-bốt', labelC: 'Điều khiển', corner: 'top-right' },
      },
    ],
    [...c.wires, ['target', 'value', 'plot', 'a'], ['robot', 'x', 'plot', 'b'], ['pid', 'out', 'plot', 'c']],
  );
}

function tryPlot(): Board {
  const c = chaseParts({ kp: 3, ki: 0, kd: 0, period: 8 });
  return build(
    'Thử: Đồ thị tín hiệu',
    '2d-side',
    'Đồ thị vẽ ba tín hiệu cùng lúc: giá trị đặt (xanh), vị trí rô-bốt (vàng) và lệnh điều khiển (hồng). Kp = 3 nên rô-bốt lao tới rất nhanh và lệnh điều khiển bị cắt ở 1. Mở mảnh Đồ thị để đổi tên đường, màu, khoảng thời gian.',
    [
      ...c.specs,
      {
        id: 'plot',
        kind: 'signal-plot',
        col: 2,
        row: 1,
        params: { title: 'Ba tín hiệu', windowSeconds: 8, labelA: 'Giá trị đặt', labelB: 'Vị trí', labelC: 'Điều khiển', autoScale: 'no', min: -6, max: 6 },
      },
    ],
    [...c.wires, ['target', 'value', 'plot', 'a'], ['robot', 'x', 'plot', 'b'], ['pid', 'out', 'plot', 'c']],
  );
}

export const TRY_BOARDS_ROBOT_CTRL: Record<string, () => Board> = {
  pid: tryPid,
  'signal-plot': tryPlot,
};
