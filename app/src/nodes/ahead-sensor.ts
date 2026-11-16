import type { NodeDef, ProbeAim } from '../engine/types';
import { asObject, clamp, numParam } from './util';

const MAX_MOUNT = 20;

interface AheadState {
  prevBlocked: boolean;
}

export const aheadSensorNode: NodeDef<AheadState> = {
  kind: 'ahead-sensor',
  label: 'Dò phía trước',
  category: 'logic',
  description:
    'Nhìn thẳng về phía trước của một nhân vật, xe hoặc thân robot (theo hướng nó đang quay mặt) xem có vật cản không: tường, khối rắn, xe, robot hay nhân vật khác. Robot quay thế nào thì cảm biến quay theo. Ở mục Nâng cao có thể dời chỗ gắn cảm biến (lệch ngang, lệch trước) và xoay hướng nhìn (ví dụ gắn một mắt siêu âm nhìn sang trái); khi đó "Khoảng cách" tính từ chỗ tia ra khỏi thân. Vật cản phải nằm trong "Tầm xa" tính từ mép của vật. "Khoảng cách" là chỗ trống còn lại trước mặt; khi phía trước thoáng thì bằng đúng "Tầm xa". "Khi gặp vật cản" bật một nhịp lúc vừa có vật cản xuất hiện.',
  inputs: [{ id: 'who', type: 'object', label: 'Đối tượng', required: true }],
  outputs: [
    { id: 'blocked', type: 'bool', label: 'Đang bị chặn' },
    { id: 'distance', type: 'number', label: 'Khoảng cách' },
    { id: 'thing', type: 'object', label: 'Đối tượng bị chặn' },
    { id: 'hit', type: 'bool', label: 'Khi gặp vật cản' },
  ],
  params: [
    { id: 'reach', label: 'Tầm xa (ô)', kind: 'number', default: 3, min: 0, max: 50, step: 0.5 },
    { id: 'mountSide', label: 'Gắn lệch ngang (m; âm = trái, dương = phải)', kind: 'number', default: 0, min: -MAX_MOUNT, max: MAX_MOUNT, step: 0.05, advanced: true },
    { id: 'mountForward', label: 'Gắn lệch trước (m; âm = ra sau)', kind: 'number', default: 0, min: -MAX_MOUNT, max: MAX_MOUNT, step: 0.05, advanced: true },
    { id: 'lookAngle', label: 'Xoay hướng nhìn (độ; âm = sang trái, dương = sang phải)', kind: 'number', default: 0, min: -180, max: 180, step: 5, advanced: true },
    { id: 'beam', label: 'Độ rộng tia (m; 0 = rộng bằng vật)', kind: 'number', default: 0, min: 0, max: MAX_MOUNT, step: 0.05, advanced: true },
  ],
  create: () => ({ prevBlocked: false }),
  evaluate(ctx, i, params, s) {
    const id = asObject(i.who);
    const reach = Math.max(0, numParam(params, 'reach', 3));
    const aim: ProbeAim = {
      side: clamp(numParam(params, 'mountSide', 0), -MAX_MOUNT, MAX_MOUNT),
      forward: clamp(numParam(params, 'mountForward', 0), -MAX_MOUNT, MAX_MOUNT),
      angle: clamp(numParam(params, 'lookAngle', 0), -180, 180),
      beam: clamp(numParam(params, 'beam', 0), 0, MAX_MOUNT),
    };
    const moved = aim.side !== 0 || aim.forward !== 0 || aim.angle !== 0 || (aim.beam ?? 0) > 0;
    const found = id !== null ? (moved ? ctx.world.probeAhead(id, reach, aim) : ctx.world.probeAhead(id, reach)) : null;
    const blocked = found !== null;
    const hit = blocked && !s.prevBlocked;
    s.prevBlocked = blocked;
    return { blocked, distance: found ? found.distance : reach, thing: found ? found.id : null, hit };
  },
};
