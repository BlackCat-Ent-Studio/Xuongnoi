import type { NodeDef } from '../engine/types';
import { asObject, numParam } from './util';

interface AheadState {
  prevBlocked: boolean;
}

export const aheadSensorNode: NodeDef<AheadState> = {
  kind: 'ahead-sensor',
  label: 'Dò phía trước',
  category: 'logic',
  description:
    'Nhìn thẳng về phía trước của một nhân vật hoặc xe (theo hướng nó đang quay mặt) xem có vật cản không: tường, khối rắn, xe hay nhân vật khác. Vật cản phải nằm trong "Tầm xa" tính từ mép của vật. "Khoảng cách" là chỗ trống còn lại trước mặt; khi phía trước thoáng thì bằng đúng "Tầm xa". "Khi gặp vật cản" bật một nhịp lúc vừa có vật cản xuất hiện.',
  inputs: [{ id: 'who', type: 'object', label: 'Đối tượng', required: true }],
  outputs: [
    { id: 'blocked', type: 'bool', label: 'Đang bị chặn' },
    { id: 'distance', type: 'number', label: 'Khoảng cách' },
    { id: 'thing', type: 'object', label: 'Đối tượng bị chặn' },
    { id: 'hit', type: 'bool', label: 'Khi gặp vật cản' },
  ],
  params: [{ id: 'reach', label: 'Tầm xa (ô)', kind: 'number', default: 3, min: 0, max: 50, step: 0.5 }],
  create: () => ({ prevBlocked: false }),
  evaluate(ctx, i, params, s) {
    const id = asObject(i.who);
    const reach = Math.max(0, numParam(params, 'reach', 3));
    const found = id !== null ? ctx.world.probeAhead(id, reach) : null;
    const blocked = found !== null;
    const hit = blocked && !s.prevBlocked;
    s.prevBlocked = blocked;
    return { blocked, distance: found ? found.distance : reach, thing: found ? found.id : null, hit };
  },
};
