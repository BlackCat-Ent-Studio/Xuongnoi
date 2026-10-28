import type { NodeDef } from '../engine/types';
import { asObject, risingEdge, type EdgeState } from './util';

export const touchNode: NodeDef<EdgeState> = {
  kind: 'touch',
  label: 'Cảm biến chạm',
  category: 'logic',
  description: 'Kiểm tra hai vật có đang chạm nhau không. "Vừa chạm" chỉ bật một nhịp ở lúc mới chạm.',
  inputs: [
    { id: 'a', type: 'object', label: 'Vật A' },
    { id: 'b', type: 'object', label: 'Vật B' },
  ],
  outputs: [
    { id: 'touching', type: 'bool', label: 'Đang chạm' },
    { id: 'began', type: 'bool', label: 'Vừa chạm' },
  ],
  params: [],
  create: () => ({ prev: false }),
  evaluate(ctx, i, _params, s) {
    const a = asObject(i.a);
    const b = asObject(i.b);
    const touching = a !== null && b !== null && ctx.world.isTouching(a, b);
    return { touching, began: risingEdge(s, touching) };
  },
};
