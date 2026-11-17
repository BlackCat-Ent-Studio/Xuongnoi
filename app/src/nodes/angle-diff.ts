import type { NodeDef } from '../engine/types';
import { asNum } from './util';

/** A - B in degrees, wrapped to (-180, 180]. */
export function angleDifference(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360;
  if (!Number.isFinite(d)) return 0;
  return d > 180 ? d - 360 : d;
}

export const angleDiffNode: NodeDef<undefined> = {
  kind: 'angle-diff',
  label: 'Chênh lệch góc',
  category: 'math',
  description:
    'Tính góc A trừ góc B (đơn vị độ) rồi đưa về khoảng từ -180 đến 180. Ví dụ 350 trừ 10 ra -20 chứ không phải 340: đây là hướng quay ngắn nhất từ B tới A.',
  inputs: [
    { id: 'a', type: 'number', label: 'Góc A' },
    { id: 'b', type: 'number', label: 'Góc B' },
  ],
  outputs: [{ id: 'diff', type: 'number', label: 'Chênh lệch' }],
  params: [],
  evaluate(_ctx, i) {
    return { diff: angleDifference(asNum(i.a), asNum(i.b)) };
  },
};
