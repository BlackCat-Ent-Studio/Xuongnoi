import type { NodeDef } from '../engine/types';
import { asBool, asObject, strParam } from './util';

/** The arrow hides when the target is this close (it has arrived). */
export const GUIDE_ARRIVED_DISTANCE = 1.5;
const DEFAULT_COLOR = '#f59e0b';

export const guideArrowNode: NodeDef<null> = {
  kind: 'guide-arrow',
  label: 'Mũi tên chỉ đường',
  category: 'output',
  description:
    'Vẽ một mũi tên lơ lửng phía trên vật "Từ", chỉ hướng về vật "Tới", kèm số khoảng cách (đơn vị game, làm tròn). Mũi tên tự ẩn khi chưa có "Tới", "Tới" bị ẩn, hoặc đã đến gần (dưới 1,5). Nối "Hiện" để bật tắt mũi tên. Xuất ra "Khoảng cách" để bạn dùng tiếp.',
  inputs: [
    { id: 'from', type: 'object', label: 'Từ', required: true },
    { id: 'to', type: 'object', label: 'Tới' },
    { id: 'show', type: 'bool', label: 'Hiện', default: true },
  ],
  outputs: [{ id: 'distance', type: 'number', label: 'Khoảng cách' }],
  params: [
    { id: 'color', label: 'Màu mũi tên', kind: 'color', default: DEFAULT_COLOR },
    {
      id: 'showDistance',
      label: 'Hiện khoảng cách',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Có' },
        { value: 'no', label: 'Không' },
      ],
    },
  ],
  create: () => null,
  evaluate(ctx, i, params) {
    const from = asObject(i.from);
    const to = asObject(i.to);
    const show = i.show === undefined ? true : asBool(i.show);
    const a = from !== null ? ctx.world.getEntity(from) : undefined;
    const b = to !== null ? ctx.world.getEntity(to) : undefined;
    const usable = a !== undefined && a.visible && b !== undefined && b.visible;
    // Ground-plane distance: height differences do not count (in the side view z is always 0).
    const distance = usable ? Math.hypot(b.position.x - a.position.x, b.position.z - a.position.z) : 0;
    ctx.world.setHud({
      key: ctx.nodeId,
      label: '',
      value: Math.round(distance),
      corner: 'top-left',
      color: strParam(params, 'color', DEFAULT_COLOR),
      ...(from !== null ? { anchor: from } : {}),
      ...(to !== null ? { guide: { to, showDistance: strParam(params, 'showDistance', 'yes') !== 'no' } } : {}),
      hidden: !show || !usable || distance < GUIDE_ARRIVED_DISTANCE,
    });
    return { distance };
  },
};
