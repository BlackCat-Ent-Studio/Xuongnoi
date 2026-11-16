import type { EntityId, NodeDef } from '../engine/types';
import { BODY_PARAMS, BODY_PARAM_IDS, bodySpec } from './body-params';
import { numParam, strParam, vec3Param } from './util';

const DEG = 180 / Math.PI;

interface RobotBodyState {
  id: EntityId;
}

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
  outputs: [
    { id: 'self', type: 'object', label: 'Đối tượng' },
    { id: 'speed', type: 'number', label: 'Tốc độ' },
    { id: 'heading', type: 'number', label: 'Hướng' },
    { id: 'turnRate', type: 'number', label: 'Tốc độ quay' },
  ],
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
      robot: { length, width, mass: numParam(params, 'mass', 2), friction: numParam(params, 'friction', 0.8) },
      heading: numParam(params, 'heading', 0) / DEG,
      ...bodySpec(params),
    });
    return { id };
  },
  evaluate(ctx, _i, params, s) {
    // Mass and grip can be changed while playing.
    ctx.world.setRobotTuning(s.id, { mass: numParam(params, 'mass', 2), friction: numParam(params, 'friction', 0.8) });
    const view = ctx.world.getEntity(s.id)?.robot;
    return {
      self: s.id,
      speed: view?.speed ?? 0,
      heading: (view?.heading ?? 0) * DEG,
      turnRate: (view?.turnRate ?? 0) * DEG,
    };
  },
};
