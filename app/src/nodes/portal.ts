import type { EntityId, NodeDef } from '../engine/types';
import { asBool, asObject, numParam, strParam, vec3Param } from './util';

export const portalNode: NodeDef<{ id: EntityId }> = {
  kind: 'portal',
  label: 'Cổng dịch chuyển',
  category: 'object',
  description:
    'Một cổng phát sáng: ai chạm vào sẽ được đưa tới cổng còn lại của cặp (phải bước ra khỏi cổng mới đi lại được). Ghép đôi bằng cách nối "Cổng đối diện" tới mảnh ghép Cổng kia, hoặc đặt cùng một "Mã cặp" cho hai cổng. Người, đồ vật và xe đều đi qua được.',
  inputs: [
    { id: 'partner', type: 'object', label: 'Cổng đối diện' },
    { id: 'on', type: 'bool', label: 'Bật' },
  ],
  outputs: [
    { id: 'self', type: 'object', label: 'Cổng' },
    { id: 'used', type: 'bool', label: 'Vừa có người vào' },
    { id: 'who', type: 'object', label: 'Người vừa vào' },
  ],
  params: [
    { id: 'position', label: 'Vị trí', kind: 'vec3', default: { x: 0, y: 1, z: 0 } },
    { id: 'size', label: 'Kích thước', kind: 'vec3', default: { x: 1.2, y: 2, z: 1.2 } },
    { id: 'color', label: 'Màu', kind: 'color', default: '#8b5cf6' },
    { id: 'pair', label: 'Mã cặp (hai cổng cùng mã thì nối với nhau)', kind: 'text', default: '' },
    { id: 'cooldown', label: 'Nghỉ sau khi dùng (giây)', kind: 'number', default: 0.5, min: 0, max: 10, step: 0.1 },
  ],
  createOnly: ['position', 'size', 'color'],
  liveApply: {
    color: (ctx, p, s) => ctx.world.setEntityStyle(s.id, { color: String(p.color) }),
  },
  create(ctx, params) {
    const id = ctx.world.spawn({
      kind: 'block',
      ownerNodeId: ctx.nodeId,
      position: vec3Param(params, 'position', { x: 0, y: 1, z: 0 }),
      size: vec3Param(params, 'size', { x: 1.2, y: 2, z: 1.2 }),
      color: strParam(params, 'color', '#8b5cf6'),
      look: 'portal',
      solid: false,
    });
    return { id };
  },
  evaluate(ctx, i, params, s) {
    ctx.world.setPortal(s.id, {
      partner: asObject(i.partner),
      pair: strParam(params, 'pair', ''),
      enabled: asBool(i.on),
      cooldown: numParam(params, 'cooldown', 0.5),
    });
    const who = ctx.world.portalUser(s.id);
    return { self: s.id, used: who !== null, who };
  },
};
