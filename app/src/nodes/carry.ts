import type { NodeDef, PortDef } from '../engine/types';
import { asBool, asObject, numParam, risingEdge, strParam, type EdgeState } from './util';

/** How far (from the character's center) an item can be and still be picked up. */
export const GRAB_REACH = 1.2;

interface CarryState {
  grab: EdgeState;
  drop: EdgeState;
  throw: EdgeState;
  /** True from a lift attempt that failed on weight until the next attempt, pickup or drop. */
  tooHeavy: boolean;
}

/** Only while "Báo quá nặng" is on: a signal that stays on after a lift failed because the item is heavier than "Sức nâng tối đa". */
const TOO_HEAVY_PORTS: PortDef[] = [{ id: 'tooHeavy', type: 'bool', label: 'Quá nặng' }];

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
  optionalOutputs: { all: TOO_HEAVY_PORTS, active: (params) => (strParam(params, 'showTooHeavyOut', 'no') === 'yes' ? TOO_HEAVY_PORTS : []) },
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
    { id: 'strength', label: 'Sức nâng tối đa (kg, 0 = không giới hạn)', kind: 'number', default: 0, min: 0, max: 100000, step: 1, advanced: true },
    {
      id: 'showTooHeavyOut',
      label: 'Báo quá nặng',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có (hiện ô ra "Quá nặng": bật khi món định nhấc nặng hơn "Sức nâng tối đa")' },
      ],
      advanced: true,
    },
  ],
  create: () => ({ grab: { prev: false }, drop: { prev: false }, throw: { prev: false }, tooHeavy: false }),
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
        const cap = Math.max(0, numParam(params, 'strength', 0));
        const lifted = ctx.world.grab(who, GRAB_REACH, cap);
        s.tooHeavy = lifted === null && cap > 0 && ctx.world.tooHeavyToGrab(who, GRAB_REACH, cap);
      }
      if (drop || toss) s.tooHeavy = false;
    }
    const held = who !== null ? ctx.world.heldItem(who) : null;
    if (held !== null) s.tooHeavy = false;
    return { holding: held !== null, heldItem: held, ...(strParam(params, 'showTooHeavyOut', 'no') === 'yes' ? { tooHeavy: s.tooHeavy } : {}) };
  },
};
