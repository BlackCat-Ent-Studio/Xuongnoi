import type { NodeDef } from '../engine/types';
import { markerUnder } from './floor-marker';
import { asObject } from './util';

interface MarkerSensorState {
  /** Marker number read last tick (0 = none). */
  prev: number;
}

/** Reads the floor marker under the middle of an object, like a robot reading the code tag it drives over. */
export const floorMarkerSensorNode: NodeDef<MarkerSensorState> = {
  kind: 'floor-marker-sensor',
  label: 'Đọc mốc sàn',
  category: 'logic',
  description:
    'Cho biết một vật (thân robot, xe, nhân vật) đang đứng trên Mốc sàn số mấy, giống robot kho hàng đọc mã dán dưới sàn. Tâm của vật phải nằm trong ô của mốc. Không đứng trên mốc nào thì "Số mốc" là 0. "Khi vào mốc" bật một nhịp mỗi lần vật vừa vào một mốc khác.',
  inputs: [{ id: 'who', type: 'object', label: 'Đối tượng', required: true }],
  outputs: [
    { id: 'number', type: 'number', label: 'Số mốc' },
    { id: 'on', type: 'bool', label: 'Đang trên mốc' },
    { id: 'entered', type: 'bool', label: 'Khi vào mốc' },
    { id: 'marker', type: 'object', label: 'Mốc' },
  ],
  params: [],
  create: () => ({ prev: 0 }),
  evaluate(ctx, i, _params, s) {
    const id = asObject(i.who);
    const self = id !== null ? ctx.world.getEntity(id) : undefined;
    const found = self && self.visible ? markerUnder(ctx.world, ctx.mode, self.position, self.position.y - self.size.y / 2) : null;
    const number = found?.number ?? 0;
    const entered = number !== 0 && number !== s.prev;
    s.prev = number;
    return { number, on: number !== 0, entered, marker: found?.id ?? null };
  },
};
