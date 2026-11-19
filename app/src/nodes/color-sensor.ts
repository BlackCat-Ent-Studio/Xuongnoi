import type { EntityView, NodeDef, ParamDef, ViewMode, WorldApi } from '../engine/types';
import { PALETTE_COLORS } from './color-palette';
import { asObject, clamp, numParam, strParam } from './util';

/** How many numbered colours the sensor knows (Màu 1..6). */
const COLOR_COUNT = PALETTE_COLORS.length;

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
    'Đọc màu ra một số từ 1 đến 6. Nối "Đối tượng" (nhân vật hoặc Thân robot) để đọc màu của hộp dưới chân nó hoặc ngay phía trước nó. Hoặc nối một vật vào "Vật cần đọc" (ví dụ "Đối tượng đầu tiên" của Vùng kích hoạt) để đọc màu của chính vật đó, dù là hộp, đồ vật hay thùng hàng; cổng này đang có vật thì cảm biến đọc vật đó. "Chỉ số màu" ra 1 đến 6 khi thứ được đọc mang đúng Màu 1 đến Màu 6 (mặc định đỏ, vàng, xanh lá, xanh dương, tím, cam: trùng Màu 1, 2, 3 của mảnh Vật thể và màu loại 1 đến 6 của mảnh Tạo đối tượng); mang màu khác hoặc không có gì để đọc thì ra 0. "Đúng màu" bật khi "Chỉ số màu" trùng "Màu cần tìm". Nếu đã đổi màu ở các mảnh kia, hãy đặt cùng màu đó ở mục Nâng cao của cảm biến này.',
  // Either input is enough on its own, so neither is marked as required.
  inputs: [
    { id: 'who', type: 'object', label: 'Đối tượng' },
    { id: 'thing', type: 'object', label: 'Vật cần đọc' },
  ],
  outputs: [
    { id: 'index', type: 'number', label: 'Chỉ số màu' },
    { id: 'match', type: 'bool', label: 'Đúng màu' },
  ],
  params: [
    {
      id: 'where',
      label: 'Đọc ở (khi dùng "Đối tượng")',
      kind: 'select',
      default: 'feet',
      options: [
        { value: 'feet', label: 'Dưới chân' },
        { value: 'ahead', label: 'Phía trước' },
      ],
    },
    { id: 'want', label: `Màu cần tìm (1 đến ${COLOR_COUNT})`, kind: 'number', default: 1, min: 1, max: COLOR_COUNT, step: 1 },
    { id: 'reach', label: 'Đọc xa bao nhiêu (ô, khi đọc phía trước)', kind: 'number', default: 1.5, min: 0, max: 20, step: 0.5, advanced: true },
    ...PALETTE_COLORS.map((color, n): ParamDef => ({ id: `color${n + 1}`, label: `Màu ${n + 1}`, kind: 'color', default: color, advanced: true })),
  ],
  evaluate(ctx, i, params) {
    // A thing on "Vật cần đọc" is read itself, whatever its kind; with none there the sensor looks from "Đối tượng" as it always did.
    const named = asObject(i.thing);
    const thing = named !== null ? ctx.world.getEntity(named) : undefined;
    const id = asObject(i.who);
    const self = id !== null ? ctx.world.getEntity(id) : undefined;
    let seen: EntityView | null | undefined = null;
    if (thing && thing.visible) {
      seen = thing;
    } else if (self && self.visible) {
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
      for (let k = 1; k <= COLOR_COUNT; k++) {
        if (same(seen.color, strParam(params, `color${k}`, PALETTE_COLORS[k - 1] ?? ''))) {
          index = k;
          break;
        }
      }
    }
    const want = Math.round(clamp(numParam(params, 'want', 1), 1, COLOR_COUNT));
    return { index, match: index !== 0 && index === want };
  },
};
