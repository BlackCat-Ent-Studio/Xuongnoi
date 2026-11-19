import type { NodeDef } from '../engine/types';
import { markerByNumber } from './floor-marker';
import { asNum } from './util';

/** Turns a number into the floor marker that carries it: "go to door 3" becomes a place. */
export const floorMarkerFindNode: NodeDef<undefined> = {
  kind: 'floor-marker-find',
  label: 'Tìm mốc sàn',
  category: 'logic',
  description:
    'Đổi một con số thành Mốc sàn mang số đó: nối "Mốc" sang "Đích" của mảnh "Đi tới điểm" là robot biết phải tới đâu. Cũng cho ra X, Z của mốc. Không có mốc nào mang số đó (ví dụ số 0) thì "Có mốc" tắt, "Mốc" để trống và X, Z là 0. Hai mốc trùng số thì lấy mốc được tạo trước.',
  inputs: [{ id: 'number', type: 'number', label: 'Số mốc' }],
  outputs: [
    { id: 'marker', type: 'object', label: 'Mốc' },
    { id: 'x', type: 'number', label: 'X' },
    { id: 'z', type: 'number', label: 'Z' },
    { id: 'found', type: 'bool', label: 'Có mốc' },
  ],
  params: [],
  evaluate(ctx, i) {
    const found = markerByNumber(ctx.world, Math.round(asNum(i.number)));
    return { marker: found?.id ?? null, x: found?.x ?? 0, z: found?.z ?? 0, found: found !== null };
  },
};
