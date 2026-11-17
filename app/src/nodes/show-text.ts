import type { HudCorner, NodeDef, Params, PortDef, PortValue } from '../engine/types';
import { asObject, strParam } from './util';

const CORNERS: readonly HudCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
export const SHOW_TEXT_MAX_LENGTH = 120;
const DEFAULT_COLOR = '#1d2330';

const LINE_PORT: PortDef = { id: 'line', type: 'number', label: 'Dòng số' };
const hasLines = (params: Params): boolean => strParam(params, 'lines', '').trim() !== '';

/** The message the card shows: the wired line of "Các dòng chữ" (1-based, rounded; out of range = null: the card hides), else "Chữ". */
function messageOf(params: Params, line: PortValue | undefined): string | null {
  if (typeof line === 'number' && Number.isFinite(line) && hasLines(params)) {
    const rows = strParam(params, 'lines', '').split(/\r?\n/);
    return rows[Math.round(line) - 1] ?? null;
  }
  return strParam(params, 'text', 'Xin chào!');
}

export const showTextNode: NodeDef<null> = {
  kind: 'show-text',
  label: 'Hiện chữ',
  category: 'output',
  description:
    'Hiện một dòng chữ lên màn hình game: ở góc màn hình, hoặc lơ lửng phía trên một vật nếu bạn nối cổng "Gắn vào đối tượng" (chữ đi theo vật, vật bị ẩn thì chữ cũng ẩn). Không nối "Hiện" thì chữ luôn hiện; nối vào để bật tắt chữ.',
  inputs: [
    { id: 'show', type: 'bool', label: 'Hiện' },
    { id: 'anchor', type: 'object', label: 'Gắn vào đối tượng' },
  ],
  // Only while "Các dòng chữ" has text, so a card keeps its size on every old board.
  optionalInputs: { all: [LINE_PORT], active: (params) => (hasLines(params) ? [LINE_PORT] : []) },
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
    {
      id: 'lines',
      label: 'Các dòng chữ (mỗi dòng một câu; nối "Dòng số" để chọn câu)',
      kind: 'text',
      multiline: true,
      default: '',
      advanced: true,
    },
  ],
  create: () => null,
  evaluate(ctx, i, params) {
    const c = strParam(params, 'corner', 'top-left');
    const corner = CORNERS.find((x) => x === c) ?? 'top-left';
    const anchor = asObject(i.anchor);
    const show = i.show === true;
    const picked = messageOf(params, i.line);
    const message = picked === null ? null : picked.slice(0, SHOW_TEXT_MAX_LENGTH);
    ctx.world.setHud({
      key: ctx.nodeId,
      label: '',
      value: 0,
      corner,
      text: message ?? '',
      color: strParam(params, 'color', DEFAULT_COLOR),
      ...(anchor !== null ? { anchor } : {}),
      hidden: !show || message === null,
    });
    return {};
  },
};
