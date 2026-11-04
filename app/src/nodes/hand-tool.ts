import type { NodeDef } from '../engine/types';
import { asBool, asObject, numParam, risingEdge, type EdgeState } from './util';

interface HandToolState {
  toggle: EdgeState;
  equip: EdgeState;
  unequip: EdgeState;
  use: EdgeState;
}

export const handToolNode: NodeDef<HandToolState> = {
  kind: 'hand-tool',
  label: 'Cầm dụng cụ',
  category: 'action',
  description:
    'Cầm một dụng cụ (kiếm, cuốc, búa...) trên tay, tách riêng với món khiêng trên đầu. Bật "Cầm" để nhặt món gần nhất, bật "Cất" để cất xuống ("Cầm / Cất (cũ)" là cổng cũ làm cả hai việc, chỉ để game cũ vẫn chạy). Bật "Dùng" để vung tay: thứ nằm ngay phía trước sẽ nhận một tín hiệu "Khi bị dùng lên".',
  inputs: [
    { id: 'character', type: 'object', label: 'Nhân vật', required: true },
    { id: 'equip', type: 'bool', label: 'Cầm' },
    { id: 'unequip', type: 'bool', label: 'Cất' },
    { id: 'toggle', type: 'bool', label: 'Cầm / Cất (cũ)', legacy: true },
    { id: 'use', type: 'bool', label: 'Dùng' },
  ],
  outputs: [
    { id: 'holding', type: 'bool', label: 'Đang cầm' },
    { id: 'tool', type: 'object', label: 'Dụng cụ đang cầm' },
    { id: 'used', type: 'bool', label: 'Khi dùng' },
    { id: 'hit', type: 'object', label: 'Khi trúng' },
  ],
  params: [{ id: 'reach', label: 'Tầm với', kind: 'number', default: 1.3, min: 0, max: 10, step: 0.1 }],
  create: () => ({ toggle: { prev: false }, equip: { prev: false }, unequip: { prev: false }, use: { prev: false } }),
  evaluate(ctx, i, params, s) {
    const who = asObject(i.character);
    const reach = numParam(params, 'reach', 1.3);
    const toggled = risingEdge(s.toggle, asBool(i.toggle));
    const equip = risingEdge(s.equip, asBool(i.equip));
    const unequip = risingEdge(s.unequip, asBool(i.unequip));
    const used = risingEdge(s.use, asBool(i.use));
    let swung = false;
    let hit: string | null = null;
    if (who !== null) {
      if (toggled) {
        if (ctx.world.handItem(who) === null) ctx.world.equip(who, reach);
        else ctx.world.unequip(who);
      }
      if (equip && ctx.world.handItem(who) === null) ctx.world.equip(who, reach);
      if (unequip && ctx.world.handItem(who) !== null) ctx.world.unequip(who);
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
