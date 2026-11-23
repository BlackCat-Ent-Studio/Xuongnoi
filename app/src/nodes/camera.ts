import type { NodeDef, PlayCameraCommand } from '../engine/types';
import { asBool, asNum, asObject, clamp, numParam, risingEdge, strParam, vec3Param, type EdgeState } from './util';

interface CameraState {
  shakeEdge: EdgeState;
  shakeLeft: number;
  shakeTotal: number;
}

export const CAMERA_MIN_ZOOM = 0.3;
export const CAMERA_MAX_ZOOM = 4;

export const cameraNode: NodeDef<CameraState> = {
  kind: 'camera',
  label: 'Máy quay',
  category: 'action',
  description:
    'Điều khiển góc nhìn khi chơi (không đổi góc nhìn lúc chỉnh sửa). Có thể bám theo một vật hoặc đứng yên nhìn một điểm, phóng to / thu nhỏ, và rung màn hình khi có nhịp "Rung". Nhiều Máy quay cùng bật thì cái mới bật sau cùng được dùng; không có cái nào bật thì camera tự bám nhân vật như thường.',
  inputs: [
    { id: 'on', type: 'bool', label: 'Bật', default: true },
    { id: 'target', type: 'object', label: 'Bám theo (vật)' },
    { id: 'zoom', type: 'number', label: 'Phóng to (0 = theo cài đặt)' },
    { id: 'shake', type: 'bool', label: 'Rung' },
  ],
  outputs: [{ id: 'active', type: 'bool', label: 'Đang dùng' }],
  params: [
    {
      id: 'mode',
      label: 'Kiểu',
      kind: 'select',
      default: 'follow',
      options: [
        { value: 'follow', label: 'Bám theo vật' },
        { value: 'fixed', label: 'Đứng yên nhìn một điểm' },
      ],
    },
    {
      id: 'point',
      label: 'Điểm nhìn / Lệch so với vật',
      kind: 'vec3',
      default: { x: 0, y: 0, z: 0 },
    },
    { id: 'zoom', label: 'Phóng to mặc định', kind: 'number', default: 1, min: CAMERA_MIN_ZOOM, max: CAMERA_MAX_ZOOM, step: 0.1 },
    { id: 'smoothness', label: 'Độ mượt (0 = tức thì)', kind: 'number', default: 5, min: 0, max: 20, step: 0.5 },
    { id: 'shakeTime', label: 'Rung kéo dài (giây)', kind: 'number', default: 0.5, min: 0.1, max: 5, step: 0.1 },
    { id: 'shakeStrength', label: 'Độ mạnh khi rung', kind: 'number', default: 1, min: 0, max: 5, step: 0.1 },
  ],
  create: () => ({ shakeEdge: { prev: false }, shakeLeft: 0, shakeTotal: 1 }),
  evaluate(ctx, i, params, s) {
    const on = i.on === undefined ? true : asBool(i.on);
    if (!on) {
      risingEdge(s.shakeEdge, false);
      s.shakeLeft = 0;
      ctx.world.setCamera(ctx.nodeId, null);
      return { active: false };
    }
    if (risingEdge(s.shakeEdge, asBool(i.shake))) {
      s.shakeTotal = Math.max(0.05, numParam(params, 'shakeTime', 0.5));
      s.shakeLeft = s.shakeTotal;
    }
    const strength = Math.max(0, numParam(params, 'shakeStrength', 1));
    const shake = s.shakeLeft > 0 ? strength * (s.shakeLeft / s.shakeTotal) : 0;
    s.shakeLeft = Math.max(0, s.shakeLeft - ctx.dt);
    const wired = asNum(i.zoom);
    const cmd: PlayCameraCommand = {
      mode: strParam(params, 'mode', 'follow') === 'fixed' ? 'fixed' : 'follow',
      target: asObject(i.target),
      point: vec3Param(params, 'point', { x: 0, y: 0, z: 0 }),
      zoom: clamp(wired > 0 ? wired : numParam(params, 'zoom', 1), CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM),
      smoothness: Math.max(0, numParam(params, 'smoothness', 5)),
      shake,
    };
    ctx.world.setCamera(ctx.nodeId, cmd);
    return { active: true };
  },
};
