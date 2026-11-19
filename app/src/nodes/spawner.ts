import { ITEM_SHAPES, type EntityId, type ItemShape, type NodeDef, type ParamDef, type Params, type PortDef, type PortValue } from '../engine/types';
import { addToSpawnPool, createSpawnPool, tickSpawnPool, type SpawnPool } from '../world/spawner';
import { TRAFFIC_COLORS } from '../engine/block-styles';
import { MAX_MASS_KG } from '../world/material';
import { materialParams, materialSpec } from './body-params';
import { ITEM_SHAPE_LABELS } from './item';
import { createRng, hashText } from './random';
import { asBool, asObject, numParam, risingEdge, strParam, vec3Param, type EdgeState } from './util';

interface SpawnerState {
  pool: SpawnPool;
  spawn: EdgeState;
  last: EntityId | null;
  /** Picks the class of each new object while "Sinh ngẫu nhiên theo loại" is on. */
  next: () => number;
  /** Class (1-based) and mass (kg) of the latest object made with a random class; 0 before the first one. */
  lastClass: number;
  lastMass: number;
}

const MAX_ALIVE_LIMIT = 50;

const MASS_PORT: PortDef = { id: 'mass', type: 'number', label: 'Khối lượng' };
const CRUSH_PORT: PortDef = { id: 'crushLimit', type: 'number', label: 'Lực chịu nén' };
/** "Khối lượng" 0 means "by kind": a block weighs 10 kg and an item 1 kg. Boards saved before the setting existed read 0. */
const MASS_BY_KIND = 0;
const spawnerMaterialParams = (): ParamDef[] =>
  materialParams('item').map((p) =>
    p.id === 'mass' ? { ...p, label: 'Khối lượng (kg, 0 = theo loại: Vật thể 10, Đồ vật 1)', legacyDefault: MASS_BY_KIND } : p,
  );

export const SPAWNER_MAX_CLASSES = 6;
const MIN_CLASSES = 2;
const DEFAULT_CLASSES = 3;
/** The first three are the colours "Đọc màu" knows as Màu 1, 2, 3. */
const CLASS_COLORS: readonly string[] = [...TRAFFIC_COLORS, '#3b82f6', '#a855f7', '#f97316'];
const CLASS_PORT: PortDef = { id: 'lastClass', type: 'number', label: 'Loại vừa sinh', labelEn: 'Latest class' };
const CLASS_MASS_PORT: PortDef = { id: 'lastMass', type: 'number', label: 'Khối lượng vừa sinh', labelEn: 'Latest mass' };

const randomClasses = (params: Params): boolean => strParam(params, 'randomClass', 'no') === 'yes';
/** Class count as the node uses it: rounded and kept within 2..6. */
export function spawnerClassCount(params: Params): number {
  return Math.min(SPAWNER_MAX_CLASSES, Math.max(MIN_CLASSES, Math.round(numParam(params, 'classCount', DEFAULT_CLASSES))));
}
const classColor = (params: Params, k: number): string => strParam(params, `class${k}Color`, CLASS_COLORS[k - 1] ?? '#ef4444');
const classMass = (params: Params, k: number): number => numParam(params, `class${k}Mass`, k);

// Only the classes in use are listed, and none of them while the toggle is off.
const classParams: ParamDef[] = Array.from({ length: SPAWNER_MAX_CLASSES }, (_, n) => n + 1).flatMap((k): ParamDef[] => {
  const shownWhen = (params: Params): boolean => randomClasses(params) && k <= spawnerClassCount(params);
  return [
    { id: `class${k}Color`, label: `Màu loại ${k}`, kind: 'color', default: CLASS_COLORS[k - 1] ?? '#ef4444', advanced: true, shownWhen },
    { id: `class${k}Mass`, label: `Khối lượng loại ${k} (kg)`, kind: 'number', default: k, min: 0, max: MAX_MASS_KG, step: 0.1, advanced: true, shownWhen },
  ];
});

const takesWiredMaterial = (params: Params): boolean => strParam(params, 'wireMaterial', 'no') === 'yes';
const wired = (v: PortValue | undefined): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

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
  // Only while "Nhận khối lượng từ dây" is on, so a spawner card keeps its size on every old board.
  optionalInputs: { all: [MASS_PORT, CRUSH_PORT], active: (params) => (takesWiredMaterial(params) ? [MASS_PORT, CRUSH_PORT] : []) },
  outputs: [
    { id: 'lastSpawned', type: 'object', label: 'Đối tượng mới nhất' },
    { id: 'count', type: 'number', label: 'Số đang có' },
    { id: 'spawned', type: 'bool', label: 'Khi tạo' },
    { id: 'touched', type: 'bool', label: 'Đang chạm thử' },
  ],
  // Only while "Sinh ngẫu nhiên theo loại" is on, so a spawner card keeps its size on every old board.
  optionalOutputs: { all: [CLASS_PORT, CLASS_MASS_PORT], active: (params) => (randomClasses(params) ? [CLASS_PORT, CLASS_MASS_PORT] : []) },
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
    ...spawnerMaterialParams(),
    {
      id: 'wireMaterial',
      label: 'Hiện ô "Khối lượng" và "Lực chịu nén" (nối dây để mỗi vật mới một khác)',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có (giá trị trên dây lúc tạo thay cho ô nhập)' },
      ],
      advanced: true,
    },
    {
      id: 'randomClass',
      label: 'Sinh ngẫu nhiên theo loại',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có (mỗi vật mới bốc thăm một loại, mỗi loại một màu và một khối lượng)' },
      ],
      advanced: true,
    },
    { id: 'classCount', label: `Số loại (${MIN_CLASSES}-${SPAWNER_MAX_CLASSES})`, kind: 'number', default: DEFAULT_CLASSES, min: MIN_CLASSES, max: SPAWNER_MAX_CLASSES, step: 1, advanced: true, shownWhen: randomClasses },
    ...classParams,
    { id: 'classSeed', label: 'Hạt giống (0 = mỗi lần chạy khác nhau)', kind: 'number', default: 0, step: 1, advanced: true, shownWhen: randomClasses },
  ],
  createOnly: ['classSeed'],
  create(ctx, params) {
    // Same rule as "Số ngẫu nhiên": seed 0 follows the run, any other number repeats the same draws on every run.
    const seed = Math.trunc(numParam(params, 'classSeed', 0));
    const base = seed !== 0 ? seed : ctx.world.runSeed();
    return { pool: createSpawnPool(), spawn: { prev: false }, last: null, next: createRng((base ^ hashText(ctx.nodeId)) >>> 0), lastClass: 0, lastMass: 0 };
  },
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
        const material = materialSpec(params, isBlock ? 'block' : 'item');
        const cls = randomClasses(params) ? 1 + Math.floor(s.next() * spawnerClassCount(params)) : 0;
        if (cls > 0) material.mass = classMass(params, cls);
        if (material.mass === MASS_BY_KIND) material.mass = undefined;
        if (takesWiredMaterial(params)) {
          material.mass = wired(i.mass) ?? material.mass;
          material.crushLimit = wired(i.crushLimit) ?? material.crushLimit;
        }
        const id = world.spawn({
          kind: isBlock ? 'block' : 'item',
          ownerNodeId: ctx.nodeId,
          position: { x: base.x + off.x, y: base.y + off.y, z: base.z + off.z },
          size: vec3Param(params, 'size', { x: 0.7, y: 0.7, z: 0.7 }),
          color: cls > 0 ? classColor(params, cls) : strParam(params, 'color', '#ef4444'),
          solid: isBlock && strParam(params, 'solid', 'solid') !== 'pickup',
          ...(isBlock
            ? {}
            : {
                shape: ((ITEM_SHAPES as readonly string[]).includes(shapeRaw) ? shapeRaw : 'ball') as ItemShape,
                carryable: strParam(params, 'carryable', 'no') === 'yes',
              }),
          ...material,
          disposable: true,
        });
        addToSpawnPool(s.pool, id, numParam(params, 'lifetime', 5));
        s.last = id;
        if (cls > 0) {
          s.lastClass = cls;
          s.lastMass = world.materialOf(id)?.massKg ?? 0;
        }
        spawned = true;
        alive++;
      }
    }

    const toucher = asObject(i.toucher);
    const touched = toucher !== null && s.pool.alive.some((m) => world.isTouching(toucher, m.id));
    return { lastSpawned: s.last !== null && world.getEntity(s.last)?.visible ? s.last : null, count: alive, spawned, touched, lastClass: s.lastClass, lastMass: s.lastMass };
  },
};
