import { ITEM_SHAPES, type EntityId, type ItemShape, type NodeDef } from '../engine/types';
import { addToSpawnPool, createSpawnPool, tickSpawnPool, type SpawnPool } from '../world/spawner';
import { ITEM_SHAPE_LABELS } from './item';
import { asBool, asObject, numParam, risingEdge, strParam, vec3Param, type EdgeState } from './util';

interface SpawnerState {
  pool: SpawnPool;
  spawn: EdgeState;
  last: EntityId | null;
}

const MAX_ALIVE_LIMIT = 50;

export const spawnerNode: NodeDef<SpawnerState> = {
  kind: 'spawner',
  label: 'Tạo đối tượng',
  category: 'action',
  description:
    'Mỗi lần "Tạo" bật, tạo thêm một hộp hoặc đồ vật mới (tối đa theo "Số lượng tối đa", mỗi cái tồn tại "Sống bao lâu"). Nối vật vào "Tại đối tượng" thì nó xuất hiện cạnh vật đó (cộng "Vị trí / lệch"). Nối "Đối tượng mới nhất" vào các node khác (ví dụ Va chạm); hoặc nối nhân vật vào "Chạm thử với" để biết có bản nào đang chạm người đó.',
  inputs: [
    { id: 'spawn', type: 'bool', label: 'Tạo', required: true },
    { id: 'at', type: 'object', label: 'Tại đối tượng' },
    { id: 'toucher', type: 'object', label: 'Chạm thử với' },
  ],
  outputs: [
    { id: 'lastSpawned', type: 'object', label: 'Đối tượng mới nhất' },
    { id: 'count', type: 'number', label: 'Số đang có' },
    { id: 'spawned', type: 'bool', label: 'Khi tạo' },
    { id: 'touched', type: 'bool', label: 'Đang chạm thử' },
  ],
  params: [
    {
      id: 'template',
      label: 'Loại',
      kind: 'select',
      default: 'item',
      options: [
        { value: 'block', label: 'Vật thể' },
        { value: 'item', label: 'Đồ vật (rơi xuống đất)' },
      ],
    },
    { id: 'position', label: 'Vị trí / lệch so với "Tại đối tượng"', kind: 'vec3', default: { x: 0, y: 5, z: 0 } },
    { id: 'size', label: 'Kích thước', kind: 'vec3', default: { x: 0.7, y: 0.7, z: 0.7 } },
    { id: 'color', label: 'Màu', kind: 'color', default: '#ef4444' },
    {
      id: 'shape',
      label: 'Hình dạng (đồ vật)',
      kind: 'select',
      default: 'ball',
      options: ITEM_SHAPES.map((value) => ({ value, label: ITEM_SHAPE_LABELS[value] })),
    },
    {
      id: 'solid',
      label: 'Vật thể rắn không',
      kind: 'select',
      default: 'solid',
      options: [
        { value: 'solid', label: 'Rắn (chặn đường)' },
        { value: 'pickup', label: 'Đi xuyên qua' },
      ],
    },
    {
      id: 'carryable',
      label: 'Đồ vật cầm được không',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Cầm được' },
      ],
    },
    { id: 'maxAlive', label: 'Số lượng tối đa', kind: 'number', default: 3, min: 1, max: MAX_ALIVE_LIMIT, step: 1 },
    { id: 'lifetime', label: 'Sống bao lâu (giây, 0 = mãi)', kind: 'number', default: 5, min: 0, max: 600, step: 0.5 },
  ],
  create: () => ({ pool: createSpawnPool(), spawn: { prev: false }, last: null }),
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    let alive = tickSpawnPool(s.pool, ctx.dt, world);
    let spawned = false;

    if (risingEdge(s.spawn, asBool(i.spawn))) {
      const max = Math.min(MAX_ALIVE_LIMIT, Math.max(1, Math.floor(numParam(params, 'maxAlive', 3))));
      const anchor = asObject(i.at);
      const anchorView = anchor ? world.getEntity(anchor) : undefined;
      if (alive < max && (anchor === null || anchorView?.visible)) {
        const off = vec3Param(params, 'position', { x: 0, y: 5, z: 0 });
        const base = anchorView ? anchorView.position : { x: 0, y: 0, z: 0 };
        const isBlock = strParam(params, 'template', 'item') === 'block';
        const shapeRaw = strParam(params, 'shape', 'ball');
        const id = world.spawn({
          kind: isBlock ? 'block' : 'item',
          ownerNodeId: ctx.nodeId,
          position: { x: base.x + off.x, y: base.y + off.y, z: base.z + off.z },
          size: vec3Param(params, 'size', { x: 0.7, y: 0.7, z: 0.7 }),
          color: strParam(params, 'color', '#ef4444'),
          solid: isBlock && strParam(params, 'solid', 'solid') !== 'pickup',
          ...(isBlock
            ? {}
            : {
                shape: ((ITEM_SHAPES as readonly string[]).includes(shapeRaw) ? shapeRaw : 'ball') as ItemShape,
                carryable: strParam(params, 'carryable', 'no') === 'yes',
              }),
          disposable: true,
        });
        addToSpawnPool(s.pool, id, numParam(params, 'lifetime', 5));
        s.last = id;
        spawned = true;
        alive++;
      }
    }

    const toucher = asObject(i.toucher);
    const touched = toucher !== null && s.pool.alive.some((m) => world.isTouching(toucher, m.id));
    return { lastSpawned: s.last !== null && world.getEntity(s.last)?.visible ? s.last : null, count: alive, spawned, touched };
  },
};
