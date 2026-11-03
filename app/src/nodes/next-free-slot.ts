import type { EntityView, NodeDef, WorldApi } from '../engine/types';
import { asObject } from './util';

/** Number of marker inputs ("Ô 1".."Ô 4"). */
export const SLOT_INPUTS = 4;
/** A loose item counts as sitting on a marker when its middle is this far inside the marker's edge (slack for an item still settling). */
const SLOT_SLACK = 0.25;

export const SLOT_PORTS = Array.from({ length: SLOT_INPUTS }, (_, k) => ({ id: `s${k + 1}`, type: 'object' as const, label: `Ô ${k + 1}` }));

/** True when a loose item (not carried, not in a hand, visible) has its middle over the marker. */
export function isTaken(world: WorldApi, marker: EntityView, items: readonly EntityView[]): boolean {
  const reachX = marker.size.x / 2 + SLOT_SLACK;
  const reachZ = marker.size.z / 2 + SLOT_SLACK;
  return items.some(
    (it) =>
      it.visible &&
      !it.carried &&
      !it.inHand &&
      !world.isHeld(it.id) &&
      Math.abs(it.position.x - marker.position.x) <= reachX &&
      Math.abs(it.position.z - marker.position.z) <= (world.mode === '2d-side' ? Infinity : reachZ),
  );
}

export const nextFreeSlotNode: NodeDef<null> = {
  kind: 'next-free-slot',
  label: 'Ô trống kế tiếp',
  category: 'logic',
  description:
    'Nhìn các ô đánh dấu trên sàn (nối vật thể làm ô vào "Ô 1", "Ô 2"...) và cho biết ô nào còn trống. Ô trống đầu tiên, theo thứ tự Ô 1, Ô 2..., ra ở "Ô trống" để nối vào "Đích" của mảnh Đi tới. Một ô là "có đồ" khi tâm của một món đồ đang nằm yên trên đó; đồ đang được khiêng không tính. Hết ô trống thì "Đầy" bật.',
  inputs: SLOT_PORTS,
  outputs: [
    { id: 'slot', type: 'object', label: 'Ô trống' },
    { id: 'full', type: 'bool', label: 'Đầy' },
  ],
  params: [],
  evaluate(ctx, i) {
    const world = ctx.world;
    const markers: EntityView[] = [];
    for (const port of SLOT_PORTS) {
      const id = asObject(i[port.id]);
      const e = id !== null ? world.getEntity(id) : undefined;
      if (e && e.visible) markers.push(e);
    }
    if (markers.length === 0) return { slot: null, full: false };
    const items = world.listEntities().filter((e) => e.kind === 'item');
    const free = markers.find((m) => !isTaken(world, m, items));
    return { slot: free ? free.id : null, full: free === undefined };
  },
};
