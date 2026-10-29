import type { NodeDef } from '../engine/types';
import { asBool, numParam, risingEdge, type EdgeState } from './util';

interface TimerState {
  left: number;
  reset: EdgeState;
}

/** Absorbs floating-point drift from repeated 1/60 subtraction. */
const EPS = 1e-9;

export const timerNode: NodeDef<TimerState> = {
  kind: 'timer',
  label: 'Hẹn giờ',
  category: 'math',
  description: 'Đếm ngược số giây đã đặt. Hết giờ thì "Hết giờ" bật. Bật "Đếm lại" để bắt đầu lại từ đầu.',
  inputs: [
    { id: 'run', type: 'bool', label: 'Chạy', default: true },
    { id: 'reset', type: 'bool', label: 'Đếm lại' },
  ],
  outputs: [
    { id: 'left', type: 'number', label: 'Giây còn lại' },
    { id: 'done', type: 'bool', label: 'Hết giờ' },
  ],
  params: [{ id: 'seconds', label: 'Số giây', kind: 'number', default: 30, min: 0, step: 1 }],
  createOnly: ['seconds'],
  liveApply: {
    seconds: (_ctx, p, s, prev) => {
      // Keep the time already elapsed: only the total changes.
      s.left = Math.max(0, s.left + Math.max(0, numParam(p, 'seconds', 30)) - Math.max(0, Number(prev)));
    },
  },
  create: (_ctx, params) => ({
    left: Math.max(0, numParam(params, 'seconds', 30)),
    reset: { prev: false },
  }),
  evaluate(ctx, i, params, s) {
    if (risingEdge(s.reset, asBool(i.reset))) {
      s.left = Math.max(0, numParam(params, 'seconds', 30));
    }
    // The engine resolves an unwired run port to its default (true); treat a missing key the same way.
    const run = i.run === undefined ? true : asBool(i.run);
    if (run && s.left > 0) {
      s.left -= ctx.dt;
      if (s.left < EPS) s.left = 0;
    }
    return { left: s.left, done: s.left === 0 };
  },
};
