import type { NodeDef } from '../engine/types';
import { asObject } from './util';

export const uiPickNode: NodeDef<null> = {
  kind: 'ui-pick',
  label: 'Bấm vào đối tượng',
  category: 'input',
  description:
    'Báo một nhịp "Khi bấm" khi người chơi bấm chuột (hoặc chạm) vào vật được nối ở cổng "Đối tượng". Dùng được cả game 2D và 3D. Vật bị ẩn thì không bấm được.',
  inputs: [{ id: 'target', type: 'object', label: 'Đối tượng', required: true }],
  outputs: [{ id: 'pressed', type: 'bool', label: 'Khi bấm' }],
  params: [],
  create: () => null,
  evaluate(ctx, i) {
    const target = asObject(i.target);
    if (target === null || ctx.input.ui?.picked.has(target) !== true) return { pressed: false };
    return { pressed: ctx.world.getEntity(target)?.visible === true };
  },
};
