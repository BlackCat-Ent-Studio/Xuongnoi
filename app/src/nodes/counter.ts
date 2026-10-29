import type { NodeDef } from '../engine/types';
import { asBool, asNum, numParam, risingEdge, type EdgeState } from './util';

interface CounterState {
  value: number;
  up: EdgeState;
  down: EdgeState;
  reset: EdgeState;
  add: EdgeState;
  set: EdgeState;
}

export const counterNode: NodeDef<CounterState> = {
  kind: 'counter',
  label: 'Bộ đếm',
  category: 'math',
  description:
    'Đếm số lần. Mỗi lần "Cộng 1" bật thì +1, "Trừ 1" bật thì −1, "Về đầu" đưa về số bắt đầu. Có thể cộng thêm một số bất kỳ (cả số âm) hoặc đặt thẳng về một số. Báo khi đếm đủ mục tiêu.',
  inputs: [
    { id: 'up', type: 'bool', label: 'Cộng 1' },
    { id: 'down', type: 'bool', label: 'Trừ 1' },
    { id: 'reset', type: 'bool', label: 'Về đầu' },
    { id: 'addAmount', type: 'number', label: 'Số cộng thêm' },
    { id: 'add', type: 'bool', label: 'Cộng số' },
    { id: 'setAmount', type: 'number', label: 'Số đặt' },
    { id: 'set', type: 'bool', label: 'Đặt số' },
  ],
  outputs: [
    { id: 'value', type: 'number', label: 'Số đếm' },
    { id: 'reached', type: 'bool', label: 'Đã đủ' },
  ],
  params: [
    { id: 'start', label: 'Bắt đầu từ', kind: 'number', default: 0, step: 1 },
    { id: 'target', label: 'Mục tiêu', kind: 'number', default: 5, step: 1 },
  ],
  createOnly: ['start'],
  create: (_ctx, params) => ({
    value: numParam(params, 'start', 0),
    up: { prev: false },
    down: { prev: false },
    reset: { prev: false },
    add: { prev: false },
    set: { prev: false },
  }),
  evaluate(_ctx, i, params, s) {
    const up = risingEdge(s.up, asBool(i.up));
    const down = risingEdge(s.down, asBool(i.down));
    const reset = risingEdge(s.reset, asBool(i.reset));
    if (up) s.value += 1;
    if (down) s.value -= 1;
    if (reset) s.value = numParam(params, 'start', 0);
    // Number-driven edits come last so "Đặt số" wins over the +1/-1 buttons on the same tick.
    if (risingEdge(s.add, asBool(i.add))) s.value += asNum(i.addAmount);
    if (risingEdge(s.set, asBool(i.set))) s.value = asNum(i.setAmount);
    return { value: s.value, reached: s.value >= numParam(params, 'target', 5) };
  },
};
