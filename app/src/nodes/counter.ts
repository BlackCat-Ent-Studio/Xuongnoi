import type { NodeDef } from '../engine/types';
import { asBool, numParam, risingEdge, type EdgeState } from './util';

interface CounterState {
  value: number;
  up: EdgeState;
  down: EdgeState;
  reset: EdgeState;
}

export const counterNode: NodeDef<CounterState> = {
  kind: 'counter',
  label: 'Bộ đếm',
  category: 'math',
  description:
    'Đếm số lần. Mỗi lần "Cộng 1" bật thì +1, "Trừ 1" bật thì −1, "Về đầu" đưa về số bắt đầu. Báo khi đếm đủ mục tiêu.',
  inputs: [
    { id: 'up', type: 'bool', label: 'Cộng 1' },
    { id: 'down', type: 'bool', label: 'Trừ 1' },
    { id: 'reset', type: 'bool', label: 'Về đầu' },
  ],
  outputs: [
    { id: 'value', type: 'number', label: 'Số đếm' },
    { id: 'reached', type: 'bool', label: 'Đã đủ' },
  ],
  params: [
    { id: 'start', label: 'Bắt đầu từ', kind: 'number', default: 0, step: 1 },
    { id: 'target', label: 'Mục tiêu', kind: 'number', default: 5, step: 1 },
  ],
  create: (_ctx, params) => ({
    value: numParam(params, 'start', 0),
    up: { prev: false },
    down: { prev: false },
    reset: { prev: false },
  }),
  evaluate(_ctx, i, params, s) {
    const up = risingEdge(s.up, asBool(i.up));
    const down = risingEdge(s.down, asBool(i.down));
    const reset = risingEdge(s.reset, asBool(i.reset));
    if (up) s.value += 1;
    if (down) s.value -= 1;
    if (reset) s.value = numParam(params, 'start', 0);
    return { value: s.value, reached: s.value >= numParam(params, 'target', 5) };
  },
};
