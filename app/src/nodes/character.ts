import type { EntityId, NodeDef } from '../engine/types';
import { asBool, asNum, clamp, numParam, strParam, vec3Param } from './util';

export const characterNode: NodeDef<{ id: EntityId }> = {
  kind: 'character',
  label: 'Nhân vật',
  category: 'object',
  description: 'Nhân vật của bạn trong thế giới game. Nối hướng đi và nút nhảy vào để điều khiển.',
  inputs: [
    { id: 'moveX', type: 'number', label: 'Đi ngang' },
    { id: 'moveY', type: 'number', label: 'Đi dọc' },
    { id: 'jump', type: 'bool', label: 'Nhảy' },
  ],
  outputs: [
    { id: 'self', type: 'object', label: 'Nhân vật' },
    { id: 'onGround', type: 'bool', label: 'Đang chạm đất' },
    { id: 'x', type: 'number', label: 'Vị trí X' },
    { id: 'y', type: 'number', label: 'Vị trí Y' },
    { id: 'z', type: 'number', label: 'Vị trí Z' },
  ],
  params: [
    { id: 'position', label: 'Vị trí xuất hiện', kind: 'vec3', default: { x: 0, y: 1, z: 0 } },
    { id: 'speed', label: 'Tốc độ chạy', kind: 'number', default: 5, min: 0, step: 0.5 },
    { id: 'jumpPower', label: 'Sức nhảy', kind: 'number', default: 10, min: 0, step: 0.5 },
    { id: 'color', label: 'Màu', kind: 'color', default: '#3b82f6' },
    {
      id: 'look',
      label: 'Kiểu dáng',
      kind: 'select',
      default: 'human',
      options: [
        { value: 'human', label: 'Người khối' },
        { value: 'robot', label: 'Rô-bốt' },
        { value: 'cat', label: 'Mèo' },
        { value: 'chick', label: 'Gà con' },
        { value: 'jelly', label: 'Thạch nhún' },
        { value: 'dino', label: 'Khủng long nhỏ' },
      ],
    },
  ],
  create(ctx, params) {
    const id = ctx.world.spawn({
      kind: 'character',
      ownerNodeId: ctx.nodeId,
      position: vec3Param(params, 'position', { x: 0, y: 1, z: 0 }),
      size: { x: 1, y: 1, z: 1 },
      color: strParam(params, 'color', '#3b82f6'),
      look: strParam(params, 'look', 'human'),
      solid: true,
    });
    return { id };
  },
  evaluate(ctx, i, params, s) {
    ctx.world.setCharacterIntent(s.id, {
      moveX: clamp(asNum(i.moveX), -1, 1),
      moveY: clamp(asNum(i.moveY), -1, 1),
      jump: asBool(i.jump),
      speed: numParam(params, 'speed', 5),
      jumpPower: numParam(params, 'jumpPower', 10),
    });
    const e = ctx.world.getEntity(s.id);
    return {
      self: s.id,
      onGround: ctx.world.isOnGround(s.id),
      x: e?.position.x ?? 0,
      y: e?.position.y ?? 0,
      z: e?.position.z ?? 0,
    };
  },
};
