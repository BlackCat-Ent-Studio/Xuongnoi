import type { NodeDef, Vec3 } from '../engine/types';
import { asObject, numParam, strParam } from './util';

interface SpeedState {
  /** Object and place seen on the previous tick; null until the first sighting. */
  prevId: string | null;
  prev: Vec3 | null;
}

/** Slower than this (units per second) counts as standing still, so tiny physics jitter does not read as moving. */
const STILL_BELOW = 0.05;

export const speedSensorNode: NodeDef<SpeedState> = {
  kind: 'speed-sensor',
  label: 'Đo tốc độ',
  category: 'logic',
  description:
    'Đo vật đang chạy nhanh cỡ nào, tính bằng ô mỗi giây, từ việc vật đổi chỗ giữa hai nhịp. "Đang đứng yên" bật khi gần như không nhúc nhích; "Vượt ngưỡng" bật khi tốc độ lớn hơn "Ngưỡng". Nhịp đầu tiên, hoặc khi chưa nối vật, tốc độ là 0. Mặc định chỉ tính chuyển động ngang nên nhảy lên xuống tại chỗ vẫn là đứng yên; mục Nâng cao cho tính cả lên xuống.',
  inputs: [{ id: 'who', type: 'object', label: 'Đối tượng', required: true }],
  outputs: [
    { id: 'speed', type: 'number', label: 'Tốc độ' },
    { id: 'still', type: 'bool', label: 'Đang đứng yên' },
    { id: 'fast', type: 'bool', label: 'Vượt ngưỡng' },
  ],
  params: [
    { id: 'threshold', label: 'Ngưỡng (ô/giây)', kind: 'number', default: 3, min: 0, step: 0.5 },
    {
      id: 'axes',
      label: 'Tính theo',
      kind: 'select',
      default: 'flat',
      options: [
        { value: 'flat', label: 'Chỉ chuyển động ngang' },
        { value: 'all', label: 'Mọi hướng (cả lên xuống)' },
      ],
      advanced: true,
    },
  ],
  create: () => ({ prevId: null, prev: null }),
  evaluate(ctx, i, params, s) {
    const id = asObject(i.who);
    const e = id !== null ? ctx.world.getEntity(id) : undefined;
    if (id === null || !e || !e.visible) {
      s.prevId = null;
      s.prev = null;
      return { speed: 0, still: false, fast: false };
    }
    const here = { ...e.position };
    let speed = 0;
    if (s.prev !== null && s.prevId === id && ctx.dt > 0) {
      const all = strParam(params, 'axes', 'flat') === 'all';
      // Flat views only have two axes; the unseen one never counts.
      const dx = here.x - s.prev.x;
      const dy = all && ctx.mode !== '2d-top' ? here.y - s.prev.y : 0;
      const dz = ctx.mode === '2d-side' ? 0 : here.z - s.prev.z;
      speed = Math.hypot(dx, dy, dz) / ctx.dt;
    }
    s.prevId = id;
    s.prev = here;
    return { speed, still: speed < STILL_BELOW, fast: speed > Math.max(0, numParam(params, 'threshold', 3)) };
  },
};
