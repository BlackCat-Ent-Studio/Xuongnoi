import type { HudCorner, NodeDef } from '../engine/types';
import { asObject, strParam } from './util';

const CORNERS: readonly HudCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
export const SHOW_TEXT_MAX_LENGTH = 120;
const DEFAULT_COLOR = '#1d2330';

export const showTextNode: NodeDef<null> = {
  kind: 'show-text',
  label: 'Hiện chữ',
  category: 'output',
  description:
    'Hiện một dòng chữ lên màn hình game: ở góc màn hình, hoặc lơ lửng phía trên một vật nếu bạn nối cổng "Gắn vào vật" (chữ đi theo vật, vật bị ẩn thì chữ cũng ẩn). Không nối "Hiện" thì chữ luôn hiện; nối vào để bật tắt chữ.',
  inputs: [
    { id: 'show', type: 'bool', label: 'Hiện' },
    { id: 'anchor', type: 'object', label: 'Gắn vào vật' },
  ],
  outputs: [],
  params: [
    { id: 'text', label: 'Chữ', kind: 'text', default: 'Xin chào!' },
    { id: 'color', label: 'Màu chữ', kind: 'color', default: DEFAULT_COLOR },
    {
      id: 'corner',
      label: 'Góc màn hình (khi không gắn vào vật)',
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
    const anchor = asObject(i.anchor);
    const show = i.show === true;
    ctx.world.setHud({
      key: ctx.nodeId,
      label: '',
      value: 0,
      corner,
      text: strParam(params, 'text', 'Xin chào!').slice(0, SHOW_TEXT_MAX_LENGTH),
      color: strParam(params, 'color', DEFAULT_COLOR),
      ...(anchor !== null ? { anchor } : {}),
      hidden: !show,
    });
    return {};
  },
};
