import type { NodeDef } from '../engine/types';
import { asBool, asObject, numParam, risingEdge, strParam, type EdgeState } from './util';

/** How far (from the character's center) an item can be and still be picked up. */
export const GRAB_REACH = 1.2;

interface CarryState {
  grab: EdgeState;
  drop: EdgeState;
  throw: EdgeState;
}

export const carryNode: NodeDef<CarryState> = {
  kind: 'carry',
  label: 'Khiêng đồ',
  category: 'action',
  description:
    'Cho nhân vật cầm đồ vật ở gần, thả xuống hoặc ném đi. Mỗi lần bật một tín hiệu mới tính một lần bấm. Mỗi nhân vật chỉ cầm được một món.',
  inputs: [
    { id: 'character', type: 'object', label: 'Nhân vật', required: true },
    { id: 'grab', type: 'bool', label: 'Nhấc lên' },
    { id: 'drop', type: 'bool', label: 'Thả' },
    { id: 'throw', type: 'bool', label: 'Ném' },
  ],
  outputs: [
    { id: 'holding', type: 'bool', label: 'Đang khiêng' },
    { id: 'heldItem', type: 'object', label: 'Đồ đang khiêng' },
  ],
  params: [
    {
      id: 'mode',
      label: 'Cách dùng',
      kind: 'select',
      default: 'separate',
      options: [
        { value: 'separate', label: '2 phím riêng (cầm / thả)' },
        { value: 'toggle', label: '1 phím cầm-thả (bấm lần nữa để thả)' },
      ],
    },
    { id: 'throwPower', label: 'Sức ném', kind: 'number', default: 8, min: 0, max: 30, step: 1 },
    { id: 'dropDistance', label: 'Thả cách người bao xa (0 = sát người)', kind: 'number', default: 0, min: 0, max: 5, step: 0.1, advanced: true },
    { id: 'throwLift', label: 'Độ ném hướng lên (0 = ném thẳng)', kind: 'number', default: 0.5, min: 0, max: 2, step: 0.1, advanced: true },
  ],
  create: () => ({ grab: { prev: false }, drop: { prev: false }, throw: { prev: false } }),
  evaluate(ctx, i, params, s) {
    const who = asObject(i.character);
    const grab = risingEdge(s.grab, asBool(i.grab));
    const drop = risingEdge(s.drop, asBool(i.drop));
    const toss = risingEdge(s.throw, asBool(i.throw));
    if (who !== null) {
      const toggle = strParam(params, 'mode', 'separate') === 'toggle';
      if (toss) {
        ctx.world.throwHeld(who, numParam(params, 'throwPower', 8), numParam(params, 'throwLift', 0.5));
      } else if (drop || (toggle && grab && ctx.world.heldItem(who) !== null)) {
        ctx.world.drop(who, numParam(params, 'dropDistance', 0));
      } else if (grab) {
        ctx.world.grab(who, GRAB_REACH);
      }
    }
    const held = who !== null ? ctx.world.heldItem(who) : null;
    return { holding: held !== null, heldItem: held };
  },
};
