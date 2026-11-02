import type { NodeDef } from '../engine/types';
import { CORNER_OPTIONS, cornerParam, uiText } from './ui-util';
import { strParam } from './util';

const DEFAULT_COLOR = '#2b6cff';

export const uiButtonNode: NodeDef<null> = {
  kind: 'ui-button',
  label: 'Nút bấm',
  category: 'input',
  description:
    'Hiện một nút bấm trên màn hình game. "Vừa bấm" bật một nhịp mỗi lần người chơi bấm nút, "Đang giữ chuột" bật khi còn giữ chuột. Nối "Hiện" để bật tắt nút.',
  inputs: [{ id: 'show', type: 'bool', label: 'Hiện', default: true }],
  outputs: [
    { id: 'pressed', type: 'bool', label: 'Vừa bấm' },
    { id: 'held', type: 'bool', label: 'Đang giữ chuột' },
  ],
  params: [
    { id: 'text', label: 'Chữ trên nút', kind: 'text', default: 'Bấm vào đây' },
    { id: 'color', label: 'Màu nút', kind: 'color', default: DEFAULT_COLOR },
    { id: 'corner', label: 'Góc màn hình', kind: 'select', default: 'bottom-right', options: CORNER_OPTIONS },
  ],
  create: () => null,
  evaluate(ctx, i, params) {
    const show = i.show === undefined ? true : i.show === true;
    ctx.world.setHud({
      key: ctx.nodeId,
      label: '',
      value: 0,
      corner: cornerParam(params, 'bottom-right'),
      color: strParam(params, 'color', DEFAULT_COLOR),
      hidden: !show,
      widget: { type: 'button', text: uiText(params, 'text', 'Bấm vào đây') },
    });
    const ui = ctx.input.ui;
    return { pressed: show && ui?.clicked.has(ctx.nodeId) === true, held: show && ui?.held.has(ctx.nodeId) === true };
  },
};
