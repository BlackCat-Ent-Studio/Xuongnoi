import type { NodeDef } from '../engine/types';
import { asBool, risingEdge, strParam, type EdgeState } from './util';

interface LatchState {
  on: boolean;
  set: EdgeState;
  reset: EdgeState;
  toggle: EdgeState;
}

export const latchNode: NodeDef<LatchState> = {
  kind: 'latch',
  label: 'Công tắc nhớ',
  category: 'logic',
  description:
    'Nhớ trạng thái bật/tắt. "Bật" thì giữ bật, "Tắt" thì giữ tắt, "Đảo" thì bật thành tắt và ngược lại. Chỉ cần một nhịp ngắn là nó nhớ mãi. Nếu "Bật" và "Tắt" cùng lúc thì "Tắt" thắng.',
  inputs: [
    { id: 'set', type: 'bool', label: 'Bật' },
    { id: 'reset', type: 'bool', label: 'Tắt' },
    { id: 'toggle', type: 'bool', label: 'Đảo' },
  ],
  outputs: [{ id: 'on', type: 'bool', label: 'Đang bật' }],
  params: [
    {
      id: 'start',
      label: 'Lúc đầu',
      kind: 'select',
      default: 'off',
      options: [
        { value: 'off', label: 'Tắt' },
        { value: 'on', label: 'Bật' },
      ],
    },
  ],
  createOnly: ['start'],
  create: (_ctx, params) => ({
    on: strParam(params, 'start', 'off') === 'on',
    set: { prev: false },
    reset: { prev: false },
    toggle: { prev: false },
  }),
  evaluate(_ctx, i, _params, s) {
    const set = risingEdge(s.set, asBool(i.set));
    const reset = risingEdge(s.reset, asBool(i.reset));
    const toggle = risingEdge(s.toggle, asBool(i.toggle));
    if (toggle) s.on = !s.on;
    if (set) s.on = true;
    if (reset) s.on = false;
    return { on: s.on };
  },
};
