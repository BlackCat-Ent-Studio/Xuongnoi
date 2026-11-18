import type { NodeDef } from '../engine/types';
import { viewDistance } from '../world/view-gap';
import { asObject, numParam } from './util';

export const distanceNode: NodeDef<undefined> = {
  kind: 'distance',
  label: 'Đo khoảng cách',
  category: 'logic',
  description:
    'Đo khoảng cách giữa tâm hai vật (đơn vị = 1 ô). Riêng thùng rời khi bật "Vật lý thật": đo tới điểm gần nhất trên mặt thùng, đúng hình thùng đang nghiêng hay nằm, không đo tới tâm. "Trong tầm" bật khi khoảng cách nhỏ hơn hoặc bằng ngưỡng. Chưa nối đủ hai vật thì ra 0 và "Trong tầm" tắt.',
  inputs: [
    { id: 'a', type: 'object', label: 'Đối tượng A', required: true },
    { id: 'b', type: 'object', label: 'Đối tượng B', required: true },
  ],
  outputs: [
    { id: 'distance', type: 'number', label: 'Khoảng cách' },
    { id: 'within', type: 'bool', label: 'Trong tầm' },
  ],
  params: [{ id: 'threshold', label: 'Ngưỡng "đủ gần"', kind: 'number', default: 3, min: 0, step: 0.5 }],
  evaluate(ctx, i, params) {
    const a = asObject(i.a);
    const b = asObject(i.b);
    const ea = a !== null ? ctx.world.getEntity(a) : undefined;
    const eb = b !== null ? ctx.world.getEntity(b) : undefined;
    if (!ea || !eb || !ea.visible || !eb.visible) return { distance: 0, within: false };
    // Flat views measure on their own plane only. A loose crate under real physics is measured to its nearest surface point.
    const distance = viewDistance(ea, eb, ctx.mode);
    return { distance, within: distance <= numParam(params, 'threshold', 3) };
  },
};
