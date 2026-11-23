import type { NodeDef } from '../engine/types';
import { strParam } from './util';

export const keyNode: NodeDef<{ prev: boolean }> = {
  kind: 'key',
  label: 'Phím bấm',
  category: 'input',
  description:
    'Báo khi bạn giữ một phím. "Đang giữ" bật suốt lúc giữ; "Vừa bấm" chỉ bật đúng một nhịp khi mới nhấn xuống.',
  inputs: [],
  outputs: [
    { id: 'held', type: 'bool', label: 'Đang giữ' },
    { id: 'pressed', type: 'bool', label: 'Vừa bấm' },
  ],
  params: [{ id: 'key', label: 'Phím', kind: 'key', default: 'Space' }],
  create: () => ({ prev: false }),
  evaluate(ctx, _inputs, params, state) {
    const held = ctx.input.keysDown.has(strParam(params, 'key', 'Space'));
    const pressed = held && !state.prev;
    state.prev = held;
    return { held, pressed };
  },
};
