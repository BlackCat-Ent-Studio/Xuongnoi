import type { NodeDef } from '../engine/types';
import { asBool, asObject, numParam, risingEdge, type EdgeState } from './util';

interface HandToolState {
  toggle: EdgeState;
  use: EdgeState;
}

export const handToolNode: NodeDef<HandToolState> = {
  kind: 'hand-tool',
  label: 'Cầm tay',
  category: 'action',
  description:
    'Cầm một dụng cụ (kiếm, cuốc, búa...) trên tay, tách riêng với món khiêng trên đầu. Bật "Cầm/Cất" để nhặt món gần nhất hoặc cất xuống. Bật "Dùng" để vung tay: thứ nằm ngay phía trước sẽ nhận một tín hiệu "Vừa bị dùng lên".',
  inputs: [
    { id: 'character', type: 'object', label: 'Nhân vật', required: true },
    { id: 'toggle', type: 'bool', label: 'Cầm/Cất' },
    { id: 'use', type: 'bool', label: 'Dùng' },
  ],
  outputs: [
    { id: 'holding', type: 'bool', label: 'Đang cầm tay' },
    { id: 'tool', type: 'object', label: 'Món trên tay' },
    { id: 'used', type: 'bool', label: 'Vừa dùng' },
    { id: 'hit', type: 'object', label: 'Trúng' },
  ],
  params: [{ id: 'reach', label: 'Tầm với', kind: 'number', default: 1.3, min: 0, max: 10, step: 0.1 }],
  create: () => ({ toggle: { prev: false }, use: { prev: false } }),
  evaluate(ctx, i, params, s) {
    const who = asObject(i.character);
    const reach = numParam(params, 'reach', 1.3);
    const toggled = risingEdge(s.toggle, asBool(i.toggle));
    const used = risingEdge(s.use, asBool(i.use));
    let swung = false;
    let hit: string | null = null;
    if (who !== null) {
      if (toggled) {
        if (ctx.world.handItem(who) === null) ctx.world.equip(who, reach);
        else ctx.world.unequip(who);
      }
      if (used) {
        const res = ctx.world.useTool(who, reach);
        swung = res !== null;
        hit = res ? res.target : null;
      }
    }
    const tool = who !== null ? ctx.world.handItem(who) : null;
    return { holding: tool !== null, tool, used: swung, hit };
  },
};
