import type { HudCorner, NodeDef } from '../engine/types';
import { asNum, strParam } from './util';

const CORNERS: readonly HudCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

export const showNumberNode: NodeDef<null> = {
  kind: 'show-number',
  label: 'Hiện số',
  category: 'output',
  description: 'Hiện một con số lên màn hình game, ví dụ điểm số hoặc số giây còn lại.',
  inputs: [{ id: 'value', type: 'number', label: 'Số cần hiện' }],
  outputs: [],
  params: [
    { id: 'label', label: 'Tên hiển thị', kind: 'text', default: 'Điểm' },
    {
      id: 'corner',
      label: 'Góc màn hình',
      kind: 'select',
      default: 'top-left',
      options: [
        { value: 'top-left', label: 'Trên trái' },
        { value: 'top-right', label: 'Trên phải' },
        { value: 'bottom-left', label: 'Dưới trái' },
        { value: 'bottom-right', label: 'Dưới phải' },
      ],
    },
  ],
  create: () => null,
  evaluate(ctx, i, params) {
    const c = strParam(params, 'corner', 'top-left');
    const corner = CORNERS.find((x) => x === c) ?? 'top-left';
    ctx.world.setHud({
      key: ctx.nodeId,
      label: strParam(params, 'label', 'Điểm'),
      value: asNum(i.value),
      corner,
    });
    return {};
  },
};
