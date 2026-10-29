import type { NodeDef, Vec3 } from '../engine/types';
import { asBool, asObject, risingEdge, strParam, vec3Param, type EdgeState } from './util';

interface TeleportState {
  go: EdgeState;
}

const DEFAULT_DEST: Vec3 = { x: 0, y: 1, z: 0 };

export const teleportNode: NodeDef<TeleportState> = {
  kind: 'teleport',
  label: 'Dịch chuyển',
  category: 'action',
  description:
    'Đưa nhân vật, đồ vật hoặc xe tới chỗ khác ngay lập tức mỗi khi "Đi" có nhịp. Nối "Nơi đến (vật)" để đến chỗ một vật, hoặc nhập toạ độ. Nếu chỗ đó bị hộp chặn, sẽ tìm chỗ trống gần nhất. Đồ đang cầm đi theo người cầm; người ngồi trên xe thì cả xe được dịch chuyển.',
  inputs: [
    { id: 'who', type: 'object', label: 'Ai (vật)' },
    { id: 'go', type: 'bool', label: 'Đi' },
    { id: 'dest', type: 'object', label: 'Nơi đến (vật)' },
  ],
  outputs: [{ id: 'done', type: 'bool', label: 'Vừa dịch chuyển' }],
  params: [
    { id: 'position', label: 'Nơi đến (khi không nối vật)', kind: 'vec3', default: DEFAULT_DEST },
    {
      id: 'keepVelocity',
      label: 'Giữ đà đang chạy / rơi',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không (đứng yên khi tới)' },
        { value: 'yes', label: 'Có (giữ nguyên đà)' },
      ],
    },
  ],
  create: () => ({ go: { prev: false } }),
  evaluate(ctx, i, params, s) {
    if (!risingEdge(s.go, asBool(i.go))) return { done: false };
    const who = asObject(i.who);
    if (who === null) return { done: false };
    const destId = asObject(i.dest);
    const destView = destId !== null ? ctx.world.getEntity(destId) : undefined;
    const to = destView && destView.visible ? destView.position : vec3Param(params, 'position', DEFAULT_DEST);
    const moved = ctx.world.teleport(who, to, strParam(params, 'keepVelocity', 'no') === 'yes');
    return { done: moved !== null };
  },
};
