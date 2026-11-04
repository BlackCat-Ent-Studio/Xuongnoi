import type { EntityView, NodeDef } from '../engine/types';
import { asObject, numParam, strParam } from './util';

interface TouchState {
  /** Previous reported "Đang chạm" value, for the began / ended pulses. */
  prev: boolean;
  /** Seconds the condition has held continuously. */
  held: number;
}

type TouchMode = 'edge' | 'center' | 'inside';

/** Geometric test on the axes the current view uses; grow > 0 widens A's box, < 0 shrinks it. */
function boxTest(viewA: EntityView, viewB: EntityView, mode: TouchMode, grow: number, useY: boolean, useZ: boolean): boolean {
  // Objects with a custom collision box are tested by that box, not by what is drawn.
  const a = { position: viewA.collider?.position ?? viewA.position, size: viewA.collider?.size ?? viewA.size };
  const b = { position: viewB.collider?.position ?? viewB.position, size: viewB.collider?.size ?? viewB.size };
  const axes: ('x' | 'y' | 'z')[] = ['x'];
  if (useY) axes.push('y');
  if (useZ) axes.push('z');
  for (const k of axes) {
    const d = Math.abs(a.position[k] - b.position[k]);
    const halfA = Math.max(0, a.size[k] / 2 + grow);
    const halfB = Math.abs(b.size[k]) / 2;
    if (mode === 'edge' && d >= halfA + halfB) return false;
    // A's centre is a point, so the grow value widens B's tolerance instead.
    if (mode === 'center' && d > halfB + grow) return false;
    if (mode === 'inside' && d + halfA > halfB) return false;
  }
  return true;
}

export const touchNode: NodeDef<TouchState> = {
  kind: 'touch',
  label: 'Va chạm',
  category: 'logic',
  description:
    'Kiểm tra hai vật có đang chạm nhau không. "Bắt đầu chạm" chỉ bật một nhịp ở lúc mới chạm, "Kết thúc chạm" bật một nhịp lúc hết chạm. Có thể nới / thu vùng chạm của vật A, chọn cách tính (chạm mép, tâm A vào trong B, A nằm trọn trong B) và bắt phải chạm đủ lâu mới tính.',
  inputs: [
    { id: 'a', type: 'object', label: 'Đối tượng A', required: true },
    { id: 'b', type: 'object', label: 'Đối tượng B', required: true },
  ],
  outputs: [
    { id: 'touching', type: 'bool', label: 'Đang chạm' },
    { id: 'began', type: 'bool', label: 'Bắt đầu chạm' },
    { id: 'ended', type: 'bool', label: 'Kết thúc chạm' },
  ],
  params: [
    { id: 'grow', label: 'Nới / thu vùng chạm', kind: 'number', default: 0, min: -5, max: 5, step: 0.1 },
    {
      id: 'mode',
      label: 'Tính khi nào',
      kind: 'select',
      default: 'edge',
      options: [
        { value: 'edge', label: 'Chạm mép' },
        { value: 'center', label: 'Tâm A vào trong B' },
        { value: 'inside', label: 'A nằm trọn trong B' },
      ],
    },
    { id: 'hold', label: 'Chạm bao lâu mới tính (giây)', kind: 'number', default: 0, min: 0, max: 30, step: 0.1 },
  ],
  create: () => ({ prev: false, held: 0 }),
  evaluate(ctx, i, params, s) {
    const a = asObject(i.a);
    const b = asObject(i.b);
    const grow = numParam(params, 'grow', 0);
    const mode = strParam(params, 'mode', 'edge') as TouchMode;
    const hold = Math.max(0, numParam(params, 'hold', 0));

    let raw = false;
    if (a !== null && b !== null) {
      if (grow === 0 && mode === 'edge') {
        raw = ctx.world.isTouching(a, b);
      } else {
        const ea = ctx.world.getEntity(a);
        const eb = ctx.world.getEntity(b);
        raw = !!ea && !!eb && boxTest(ea, eb, mode, grow, ctx.mode !== '2d-top', ctx.mode !== '2d-side');
      }
    }

    s.held = raw ? s.held + ctx.dt : 0;
    const touching = raw && s.held >= hold;
    const began = touching && !s.prev;
    const ended = !touching && s.prev;
    s.prev = touching;
    return { touching, began, ended };
  },
};
