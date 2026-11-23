import { PARCEL_CODE_MAX, PARCEL_CODE_MIN, parcelCodeOfTag } from '../engine/parcel-code';
import type { EntityId, EvalCtx, NodeDef, Params } from '../engine/types';
import { asObject, strParam, vec3Param } from './util';

/** Block style of the little screen that shows the last code read. */
export const CODE_DISPLAY_STYLE = 'code-display';
/** The screen is a small box (m): about the size of the reader head of a scan gate. */
export const CODE_DISPLAY_SIZE = { x: 0.22, y: 0.18, z: 0.22 } as const;
const DISPLAY_AT = { x: 0, y: 1.3, z: 0 };

interface CodeReaderState {
  /** The screen in the world; null while "Màn hình hiện mã" is off. */
  display: EntityId | null;
  /** The object whose code is on the screen now; null once nothing with a code is in front of the reader. */
  reading: EntityId | null;
}

const hasDisplay = (params: Params): boolean => strParam(params, 'display', 'no') === 'yes';

/** A screen showing `text` ('' = nothing read yet). It never blocks anything. */
function spawnDisplay(ctx: Pick<EvalCtx, 'world' | 'nodeId'>, params: Params, text: string): EntityId {
  return ctx.world.spawn({
    kind: 'block',
    ownerNodeId: ctx.nodeId,
    position: vec3Param(params, 'displayAt', DISPLAY_AT),
    size: { ...CODE_DISPLAY_SIZE },
    color: '#a3a3a3',
    solid: false,
    blockStyle: CODE_DISPLAY_STYLE,
    ...(text ? { label: text } : {}),
    disposable: true,
  });
}

export const codeReaderNode: NodeDef<CodeReaderState> = {
  kind: 'code-reader',
  label: 'Đọc mã',
  category: 'logic',
  description: `Đọc mã số của một vật. Nối một vật vào "Vật cần đọc" (ví dụ "Đối tượng đầu tiên" của Vùng kích hoạt đặt ở cổng quét): "Mã" ra số ${PARCEL_CODE_MIN} đến ${PARCEL_CODE_MAX} mà vật đó mang, "Có mã" bật. Không có vật, hoặc vật không mang mã, thì "Mã" ra 0 và "Có mã" tắt. Vật mang mã là đồ vật do mảnh Tạo đối tượng tạo ra khi bật "Gắn mã cho vật mới", hoặc mảnh Đồ vật có "Loại hàng" là một số. Bật "Màn hình hiện mã" để có một màn hình nhỏ giữ mã vừa đọc.`,
  inputs: [{ id: 'thing', type: 'object', label: 'Vật cần đọc', required: true }],
  outputs: [
    { id: 'code', type: 'number', label: 'Mã' },
    { id: 'has', type: 'bool', label: 'Có mã' },
  ],
  params: [
    {
      id: 'display',
      label: 'Màn hình hiện mã',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có (hộp đen nhỏ, giữ mã vừa đọc)' },
      ],
    },
    { id: 'displayAt', label: 'Vị trí màn hình', kind: 'vec3', default: DISPLAY_AT, place: 'point', shownWhen: hasDisplay },
  ],
  createOnly: ['display', 'displayAt'],
  create(ctx, params) {
    return { display: hasDisplay(params) ? spawnDisplay(ctx, params, '') : null, reading: null };
  },
  evaluate(ctx, i, params, s) {
    const named = asObject(i.thing);
    const thing = named !== null ? ctx.world.getEntity(named) : undefined;
    const code = named !== null && thing?.visible ? parcelCodeOfTag(ctx.world.tagOf(named)) : 0;
    if (code === 0) {
      s.reading = null;
    } else if (named !== s.reading) {
      s.reading = named;
      // The screen cannot be repainted, so each read swaps it for one that shows the new code; it then stays until the next read.
      if (s.display !== null) {
        ctx.world.hide(s.display);
        s.display = spawnDisplay(ctx, params, String(code));
      }
    }
    return { code, has: code > 0 };
  },
};
