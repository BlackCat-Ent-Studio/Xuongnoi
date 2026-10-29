import type { NodeDef } from '../engine/types';
import { asObject, numParam } from './util';

export const distanceNode: NodeDef<undefined> = {
  kind: 'distance',
  label: 'Khoảng cách',
  category: 'logic',
  description:
    'Đo khoảng cách giữa tâm hai vật (đơn vị = 1 khối). "Đủ gần" bật khi khoảng cách nhỏ hơn hoặc bằng ngưỡng. Chưa nối đủ hai vật thì ra 0 và "Đủ gần" tắt.',
  inputs: [
    { id: 'a', type: 'object', label: 'Vật A' },
    { id: 'b', type: 'object', label: 'Vật B' },
  ],
  outputs: [
    { id: 'distance', type: 'number', label: 'Khoảng cách' },
    { id: 'within', type: 'bool', label: 'Đủ gần' },
  ],
  params: [{ id: 'threshold', label: 'Ngưỡng "đủ gần"', kind: 'number', default: 3, min: 0, step: 0.5 }],
  evaluate(ctx, i, params) {
    const a = asObject(i.a);
    const b = asObject(i.b);
    const ea = a !== null ? ctx.world.getEntity(a) : undefined;
    const eb = b !== null ? ctx.world.getEntity(b) : undefined;
    if (!ea || !eb || !ea.visible || !eb.visible) return { distance: 0, within: false };
    // Flat views measure on their own plane only.
    const dx = ea.position.x - eb.position.x;
    const dy = ctx.mode === '2d-top' ? 0 : ea.position.y - eb.position.y;
    const dz = ctx.mode === '2d-side' ? 0 : ea.position.z - eb.position.z;
    const distance = Math.hypot(dx, dy, dz);
    return { distance, within: distance <= numParam(params, 'threshold', 3) };
  },
};
