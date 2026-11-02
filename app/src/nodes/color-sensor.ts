import { TRAFFIC_COLORS } from '../engine/block-styles';
import type { EntityView, NodeDef, ViewMode, WorldApi } from '../engine/types';
import { asObject, clamp, numParam, strParam } from './util';

/** A block counts as "under the feet" when its top is no higher than this above the feet. */
const STEP_UP = 0.15;

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The block the object stands on: the highest visible solid block below its feet that covers its centre. */
function blockUnder(world: WorldApi, self: EntityView, mode: ViewMode): EntityView | null {
  const feet = self.position.y - self.size.y / 2;
  let best: EntityView | null = null;
  let bestTop = -Infinity;
  for (const e of world.listEntities()) {
    if (e.kind !== 'block' || !e.visible || e.zone || e.id === self.id) continue;
    const pos = e.collider?.position ?? e.position;
    const size = e.collider?.size ?? e.size;
    if (Math.abs(self.position.x - pos.x) > size.x / 2) continue;
    if (mode !== '2d-side' && Math.abs(self.position.z - pos.z) > size.z / 2) continue;
    const top = pos.y + size.y / 2;
    if (top > feet + STEP_UP || top <= bestTop) continue;
    best = e;
    bestTop = top;
  }
  return best;
}

export const colorSensorNode: NodeDef<undefined> = {
  kind: 'color-sensor',
  label: 'Đọc màu',
  category: 'logic',
  description:
    'Đọc màu của hộp mà vật đang đứng trên hoặc đang nhìn thấy ngay phía trước. "Số màu" là 1, 2 hoặc 3 nếu hộp đang mang đúng Màu 1, 2 hay 3 (là màu hộp được đổi bằng cổng "Đổi màu" của mảnh Hộp, mặc định đỏ, vàng, xanh); hộp mang màu khác, chưa được đổi màu, hoặc không có hộp thì ra 0. "Đúng màu" bật khi "Số màu" trùng "Màu cần tìm". Nếu bạn đã đổi Màu 1, 2, 3 trong mảnh Hộp, hãy đặt cùng màu đó ở mục Nâng cao của cảm biến này.',
  inputs: [{ id: 'who', type: 'object', label: 'Vật', required: true }],
  outputs: [
    { id: 'index', type: 'number', label: 'Số màu' },
    { id: 'match', type: 'bool', label: 'Đúng màu' },
  ],
  params: [
    {
      id: 'where',
      label: 'Đọc ở',
      kind: 'select',
      default: 'feet',
      options: [
        { value: 'feet', label: 'Dưới chân' },
        { value: 'ahead', label: 'Phía trước' },
      ],
    },
    { id: 'want', label: 'Màu cần tìm (1, 2 hoặc 3)', kind: 'number', default: 1, min: 1, max: 3, step: 1 },
    { id: 'reach', label: 'Đọc xa bao nhiêu (ô, khi đọc phía trước)', kind: 'number', default: 1.5, min: 0, max: 20, step: 0.5, advanced: true },
    { id: 'color1', label: 'Màu 1', kind: 'color', default: TRAFFIC_COLORS[0], advanced: true },
    { id: 'color2', label: 'Màu 2', kind: 'color', default: TRAFFIC_COLORS[1], advanced: true },
    { id: 'color3', label: 'Màu 3', kind: 'color', default: TRAFFIC_COLORS[2], advanced: true },
  ],
  evaluate(ctx, i, params) {
    const id = asObject(i.who);
    const self = id !== null ? ctx.world.getEntity(id) : undefined;
    let seen: EntityView | null | undefined = null;
    if (self && self.visible) {
      if (strParam(params, 'where', 'feet') === 'ahead') {
        const hit = ctx.world.probeAhead(self.id, Math.max(0, numParam(params, 'reach', 1.5)));
        const e = hit ? ctx.world.getEntity(hit.id) : undefined;
        seen = e && e.kind === 'block' ? e : null;
      } else {
        seen = blockUnder(ctx.world, self, ctx.mode);
      }
    }
    let index = 0;
    if (seen) {
      for (let k = 1; k <= 3; k++) {
        if (same(seen.color, strParam(params, `color${k}`, TRAFFIC_COLORS[k - 1] ?? ''))) {
          index = k;
          break;
        }
      }
    }
    const want = Math.round(clamp(numParam(params, 'want', 1), 1, 3));
    return { index, match: index !== 0 && index === want };
  },
};
