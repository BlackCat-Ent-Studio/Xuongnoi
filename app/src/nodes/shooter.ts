import type { EntityId, NodeDef } from '../engine/types';
import { asBool, asObject, numParam, risingEdge, strParam, type EdgeState } from './util';

interface ShooterState {
  fire: EdgeState;
  /** Seconds until the next shot may leave. */
  cooldown: number;
  lastHit: EntityId | null;
}

export const shooterNode: NodeDef<ShooterState> = {
  kind: 'shooter',
  label: 'Bắn đạn',
  category: 'action',
  description:
    'Mỗi lần "Bắn" bật, vật nối vào "Người bắn" phóng ra một viên đạn theo hướng nó đang nhìn (hoặc nhắm vào "Mục tiêu" nếu có nối). Đạn dừng khi đụng hộp rắn, hết "Bay bao lâu", hoặc trúng một nhân vật khác: có node Máu thì nhân vật mất máu. "Trúng" bật một nhịp, "Vừa trúng" là nhân vật bị trúng gần nhất.',
  inputs: [
    { id: 'shooter', type: 'object', label: 'Người bắn' },
    { id: 'target', type: 'object', label: 'Mục tiêu (tuỳ chọn)' },
    { id: 'fire', type: 'bool', label: 'Bắn' },
  ],
  outputs: [
    { id: 'hit', type: 'bool', label: 'Trúng' },
    { id: 'lastHit', type: 'object', label: 'Vừa trúng' },
  ],
  params: [
    { id: 'speed', label: 'Tốc độ đạn', kind: 'number', default: 14, min: 1, max: 60, step: 1 },
    { id: 'lifetime', label: 'Bay bao lâu (giây)', kind: 'number', default: 1.2, min: 0.1, max: 10, step: 0.1 },
    { id: 'damage', label: 'Sát thương', kind: 'number', default: 1, min: 0, max: 100, step: 1 },
    { id: 'size', label: 'Cỡ đạn', kind: 'number', default: 0.25, min: 0.1, max: 2, step: 0.05 },
    { id: 'color', label: 'Màu đạn', kind: 'color', default: '#f97316' },
    {
      id: 'gravity',
      label: 'Rơi theo đường cong',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không (bay thẳng)' },
        { value: 'yes', label: 'Có (đạn rơi dần)' },
      ],
    },
    { id: 'cooldown', label: 'Nghỉ giữa các phát (giây)', kind: 'number', default: 0.3, min: 0, max: 10, step: 0.1 },
  ],
  create: () => ({ fire: { prev: false }, cooldown: 0, lastHit: null }),
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    s.cooldown = Math.max(0, s.cooldown - ctx.dt);
    const who = asObject(i.shooter);
    const fire = risingEdge(s.fire, asBool(i.fire));
    if (who === null) return { hit: false, lastHit: s.lastHit };

    if (fire && s.cooldown <= 0) {
      const shot = world.shoot(who, {
        ownerNodeId: ctx.nodeId,
        speed: numParam(params, 'speed', 14),
        lifetime: numParam(params, 'lifetime', 1.2),
        damage: numParam(params, 'damage', 1),
        size: numParam(params, 'size', 0.25),
        color: strParam(params, 'color', '#f97316'),
        gravity: strParam(params, 'gravity', 'no') === 'yes',
        aimAt: asObject(i.target),
      });
      if (shot !== null) s.cooldown = Math.max(0, numParam(params, 'cooldown', 0.3));
    }

    const hits = world.shotHits(who);
    if (hits.length > 0) s.lastHit = hits[hits.length - 1] ?? s.lastHit;
    return { hit: hits.length > 0, lastHit: s.lastHit };
  },
};
