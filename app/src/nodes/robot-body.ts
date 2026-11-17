import type { EntityId, NodeDef, Params, PortDef } from '../engine/types';
import { BODY_PARAMS, BODY_PARAM_IDS, bodySpec } from './body-params';
import { asBool, numParam, risingEdge, strParam, vec3Param, type EdgeState } from './util';

const DEG = 180 / Math.PI;

interface RobotBodyState {
  id: EntityId;
  /** Metres the chassis has travelled since the start or the last reset. */
  distance: number;
  /** Where the chassis was last tick, to measure how far it moved (null before the first tick). */
  last: { x: number; z: number } | null;
  reset: EdgeState;
}

const DISTANCE_PORT: PortDef = { id: 'distance', type: 'number', label: 'Quãng đường' };
const RESET_DISTANCE_PORT: PortDef = { id: 'resetDistance', type: 'bool', label: 'Đặt lại quãng đường' };
const PAYLOAD_PORTS: PortDef[] = [
  { id: 'payload', type: 'number', label: 'Khối lượng đang chở' },
  { id: 'overloaded', type: 'bool', label: 'Quá tải' },
];

const PUSH_PORTS: PortDef[] = [
  { id: 'pushing', type: 'bool', label: 'Đang đẩy vật' },
  { id: 'pushForce', type: 'number', label: 'Lực đang đẩy' },
];

const showsDistance = (params: Params): boolean => strParam(params, 'showDistance', 'no') === 'yes';
const showsPayload = (params: Params): boolean => strParam(params, 'showPayload', 'no') === 'yes';
/** Whether the chassis shoves loose items; the default is the one value that keeps every older board unchanged. */
const PUSH_DEFAULT = 'yes';
const pushes = (params: Params): boolean => strParam(params, 'pushObjects', PUSH_DEFAULT) === 'yes';
const showsPush = (params: Params): boolean => strParam(params, 'showPush', 'no') === 'yes';

/**
 * The chassis of a robot: a rigid box on the ground that never moves by itself. Motors mounted on it (the "Motor"
 * piece, one per wheel) are the only thing that pushes it. Collision uses a square footprint as wide as the chassis
 * is long, so turning never snags it on a wall.
 */
export const robotBodyNode: NodeDef<RobotBodyState> = {
  kind: 'robot-body',
  label: 'Thân robot',
  category: 'object',
  description:
    'Thân của một robot: một khối nằm trên mặt đất, tự nó không chạy. Gắn các mảnh ghép "Động cơ" (mỗi bánh một cái) vào Thân, nối "Công suất" cho từng động cơ thì Thân mới chạy và quay. Có khối lượng, độ bám mặt đất và kích thước để chỉnh.',
  inputs: [],
  // Only while the matching setting below is on, so a chassis card keeps its size on every old board.
  optionalInputs: { all: [RESET_DISTANCE_PORT], active: (params) => (showsDistance(params) ? [RESET_DISTANCE_PORT] : []) },
  outputs: [
    { id: 'self', type: 'object', label: 'Đối tượng' },
    { id: 'speed', type: 'number', label: 'Tốc độ' },
    { id: 'heading', type: 'number', label: 'Hướng' },
    { id: 'turnRate', type: 'number', label: 'Tốc độ quay' },
  ],
  optionalOutputs: {
    all: [DISTANCE_PORT, ...PAYLOAD_PORTS, ...PUSH_PORTS],
    active: (params) => [
      ...(showsDistance(params) ? [DISTANCE_PORT] : []),
      ...(showsPayload(params) ? PAYLOAD_PORTS : []),
      ...(showsPush(params) ? PUSH_PORTS : []),
    ],
  },
  params: [
    { id: 'position', label: 'Vị trí xuất hiện', kind: 'vec3', default: { x: 0, y: 0.5, z: 0 } },
    { id: 'heading', label: 'Hướng mũi lúc đầu (độ, 0 = sang phải, 90 = xuống dưới)', kind: 'number', default: 0, min: -360, max: 360, step: 5 },
    { id: 'length', label: 'Chiều dài (m)', kind: 'number', default: 1, min: 0.2, max: 6, step: 0.05 },
    { id: 'width', label: 'Chiều rộng (m)', kind: 'number', default: 0.7, min: 0.2, max: 6, step: 0.05 },
    { id: 'height', label: 'Chiều cao (m)', kind: 'number', default: 0.3, min: 0.1, max: 3, step: 0.05 },
    { id: 'mass', label: 'Khối lượng (kg)', kind: 'number', default: 2, min: 0.1, max: 500, step: 0.1 },
    { id: 'friction', label: 'Độ bám / ma sát mặt đất (nhỏ = trượt xa mới dừng)', kind: 'number', default: 0.8, min: 0.02, max: 2, step: 0.02 },
    { id: 'color', label: 'Màu', kind: 'color', default: '#3b82f6' },
    {
      id: 'solid',
      label: 'Chặn người đi bộ',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Có (không đi xuyên qua robot)' },
        { value: 'no', label: 'Không' },
      ],
    },
    {
      id: 'maxPayload',
      label: 'Tải tối đa (kg, 0 = không giới hạn; chở nặng hơn thì động cơ không đẩy nổi)',
      kind: 'number',
      default: 0,
      min: 0,
      max: 500,
      step: 0.5,
      advanced: true,
    },
    {
      id: 'showDistance',
      label: 'Hiện ô "Quãng đường" và "Đặt lại quãng đường"',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có (đếm quãng đường robot đã đi, như đồng hồ đo quãng đường)' },
      ],
      advanced: true,
    },
    {
      id: 'showPayload',
      label: 'Hiện ô "Khối lượng đang chở" và "Quá tải"',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có (cân hàng đang nằm trên thân robot)' },
      ],
      advanced: true,
    },
    {
      id: 'pushObjects',
      label: 'Đẩy được vật (thùng, đồ vật nằm trên sàn chắn đường)',
      kind: 'select',
      default: PUSH_DEFAULT,
      options: [
        { value: 'yes', label: 'Có (đẩy vật đi theo; vật nặng quá thì robot đứng lại, cần "Lực kéo động cơ")' },
        { value: 'no', label: 'Không (robot đi xuyên qua vật như cũ)' },
      ],
      advanced: true,
    },
    {
      id: 'showPush',
      label: 'Hiện ô "Đang đẩy vật" và "Lực đang đẩy"',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có (robot có đang đẩy vật không, và đẩy bằng bao nhiêu N)' },
      ],
      advanced: true,
    },
    ...BODY_PARAMS,
  ],
  createOnly: ['position', 'heading', 'length', 'width', 'height', 'color', 'solid', ...BODY_PARAM_IDS],
  liveApply: {
    color: (ctx, p, s) => ctx.world.setEntityStyle(s.id, { color: String(p.color) }),
  },
  create(ctx, params) {
    const length = Math.max(0.2, numParam(params, 'length', 1));
    const width = Math.max(0.2, numParam(params, 'width', 0.7));
    const id = ctx.world.spawn({
      kind: 'robot',
      ownerNodeId: ctx.nodeId,
      position: vec3Param(params, 'position', { x: 0, y: 0.5, z: 0 }),
      // The collision box is a square so a turning chassis never catches a corner on a wall.
      size: { x: Math.max(length, width), y: Math.max(0.1, numParam(params, 'height', 0.3)), z: Math.max(length, width) },
      color: strParam(params, 'color', '#3b82f6'),
      solid: strParam(params, 'solid', 'yes') !== 'no',
      robot: { length, width, mass: numParam(params, 'mass', 2), friction: numParam(params, 'friction', 0.8), ...(pushes(params) ? { pushObjects: true } : {}) },
      heading: numParam(params, 'heading', 0) / DEG,
      ...bodySpec(params),
    });
    return { id, distance: 0, last: null, reset: { prev: false } };
  },
  evaluate(ctx, i, params, s) {
    // Mass, grip and the load limit can be changed while playing.
    ctx.world.setRobotTuning(s.id, {
      mass: numParam(params, 'mass', 2),
      friction: numParam(params, 'friction', 0.8),
      maxPayload: Math.max(0, numParam(params, 'maxPayload', 0)),
      pushObjects: pushes(params),
    });
    const entity = ctx.world.getEntity(s.id);
    const view = entity?.robot;
    // Odometer: the ground path the chassis really covered (turning on the spot adds nothing).
    const at = entity ? { x: entity.position.x, z: ctx.mode === '2d-side' ? 0 : entity.position.z } : null;
    if (risingEdge(s.reset, asBool(i.resetDistance))) s.distance = 0;
    else if (at && s.last) s.distance += Math.hypot(at.x - s.last.x, at.z - s.last.z);
    s.last = at;
    return {
      self: s.id,
      speed: view?.speed ?? 0,
      heading: (view?.heading ?? 0) * DEG,
      turnRate: (view?.turnRate ?? 0) * DEG,
      distance: s.distance,
      payload: view?.payload ?? 0,
      overloaded: view?.overloaded === true,
      pushing: view?.pushing === true,
      pushForce: view?.pushForce ?? 0,
    };
  },
};
