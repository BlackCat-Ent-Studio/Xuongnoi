import type { EntityView, NodeDef } from '../engine/types';
import { SLOT_PORTS, isTaken } from './next-free-slot';
import { asBool, asObject, strParam } from './util';

/** Ports "Bỏ qua ô 1".."4": markers whose resting items are not offered. */
const IGNORE_PORTS = SLOT_PORTS.map((_, k) => ({ id: `i${k + 1}`, type: 'object' as const, label: `Bỏ qua ô ${k + 1}` }));

export const nearestItemNode: NodeDef<null> = {
  kind: 'nearest-item',
  label: 'Tìm đồ gần nhất',
  category: 'logic',
  description:
    'Nhìn khắp sàn và chỉ ra món đồ nằm rời, không ai khiêng, gần "Đối tượng" nhất. Món đó ra ở "Đồ gần nhất" để nối vào "Điểm đến" của mảnh Di chuyển; "Đã tìm thấy" bật khi tìm thấy, "Khoảng cách" là đường tới món đó. Muốn bỏ qua đồ đã cất vào ô đánh dấu thì nối các ô đó vào "Bỏ qua đồ trên ô". "Chỉ tìm loại hàng" lọc theo loại hàng. Bật "Tạm nghỉ" thì nó không tìm gì (Có tắt).',
  inputs: [{ id: 'who', type: 'object', label: 'Đối tượng', required: true }, { id: 'pause', type: 'bool', label: 'Tạm nghỉ' }, ...IGNORE_PORTS],
  outputs: [
    { id: 'item', type: 'object', label: 'Đồ gần nhất' },
    { id: 'found', type: 'bool', label: 'Đã tìm thấy' },
    { id: 'distance', type: 'number', label: 'Khoảng cách' },
  ],
  params: [{ id: 'goods', label: 'Chỉ tìm loại hàng (để trống = mọi món)', kind: 'text', default: '' }],
  evaluate(ctx, i, params) {
    const none = { item: null, found: false, distance: 0 };
    const world = ctx.world;
    if (asBool(i.pause)) return none;
    const whoId = asObject(i.who);
    const who = whoId !== null ? world.getEntity(whoId) : undefined;
    if (!who || !who.visible) return none;

    const markers: EntityView[] = [];
    for (const port of IGNORE_PORTS) {
      const id = asObject(i[port.id]);
      const e = id !== null ? world.getEntity(id) : undefined;
      if (e && e.visible) markers.push(e);
    }
    const goods = strParam(params, 'goods', '');
    const items = world.listEntities().filter((e) => e.kind === 'item');
    const flat = world.mode === '2d-side';

    let best: EntityView | null = null;
    let bestGap = Infinity;
    for (const it of items) {
      if (!it.visible || it.carried || it.inHand || world.isHeld(it.id)) continue;
      if (goods !== '' && world.tagOf(it.id) !== goods) continue;
      if (markers.some((m) => isTaken(world, m, [it]))) continue;
      const gap = Math.hypot(it.position.x - who.position.x, flat ? 0 : it.position.z - who.position.z);
      if (gap < bestGap - 1e-6 || (Math.abs(gap - bestGap) <= 1e-6 && best !== null && it.id < best.id)) {
        best = it;
        bestGap = gap;
      }
    }
    return best ? { item: best.id, found: true, distance: bestGap } : none;
  },
};
