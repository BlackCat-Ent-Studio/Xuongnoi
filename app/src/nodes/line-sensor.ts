import { TRAFFIC_COLORS } from '../engine/block-styles';
import type { EntityId, EntityView, LineTrackSpec, NodeDef, ViewMode, WorldApi } from '../engine/types';
import { LINE_DOT_LOOK, trackCoverage } from '../world/line-track';
import { asObject, clamp, numParam, strParam } from './util';

const DOT_OFF = '#9ca3af';
const DOT_ON = TRAFFIC_COLORS[2];
/** The marker floats this far above the floor so it is never hidden by the painted line. */
const DOT_LIFT = 0.03;
const MAX_OFFSET = 20;
const MAX_SPOT = 5;

interface SensorState {
  /** The marker dot; made the first time the eye has an object to sit on. */
  dot: EntityId | null;
  dotShown: boolean;
  dotOn: boolean;
  prevOn: boolean;
}

/**
 * Unit direction on the ground plane the object faces: a character's facing, a vehicle's nose, else along +x.
 * In the side view only left or right counts.
 */
export function headingOf(view: EntityView, mode: ViewMode): { x: number; z: number } {
  let x = 1;
  let z = 0;
  if (view.facing && Math.hypot(view.facing.x, view.facing.z) > 1e-6) {
    x = view.facing.x;
    z = view.facing.z;
  } else if (view.vehicle && Number.isFinite(view.vehicle.heading)) {
    x = Math.cos(view.vehicle.heading);
    z = Math.sin(view.vehicle.heading);
  }
  if (mode === '2d-side') return { x: x < 0 ? -1 : 1, z: 0 };
  const len = Math.hypot(x, z);
  return { x: x / len, z: z / len };
}

/**
 * Centre of the sensing spot in the plane of the view (x and z, or x and floor height in the side view).
 * Forward goes where the object faces; side goes to its right (negative = left) as seen from above.
 */
export function spotCentre(view: EntityView, mode: ViewMode, forward: number, side: number): { u: number; v: number } {
  const f = headingOf(view, mode);
  if (mode === '2d-side') return { u: view.position.x + f.x * forward, v: view.position.y - view.size.y / 2 };
  return { u: view.position.x + f.x * forward - f.z * side, v: view.position.z + f.z * forward + f.x * side };
}

/** The visible painted lines the eye may read: only the wired one, or every one. */
function tracksFor(world: WorldApi, only: string | null): EntityView[] {
  if (only !== null) {
    const e = world.getEntity(only);
    return e && e.visible && e.track ? [e] : [];
  }
  return world.listEntities().filter((e) => e.visible && e.track);
}

export const lineSensorNode: NodeDef<SensorState> = {
  kind: 'line-sensor',
  label: 'Cảm biến dò line',
  category: 'logic',
  description:
    'Một "mắt" gắn dưới vật (nhân vật, xe, thân robot) nhìn xuống sàn xem có vạch line không, giống mắt hồng ngoại của xe dò đường. Vị trí mắt = vị trí vật, dịch ra trước (Lệch trước) và sang bên (Lệch ngang), và xoay theo hướng vật đang quay mặt. "Độ đậm" là phần của vòng đọc đang nằm trên vạch (0 đến 1). Đặt 2 hoặc 3 mắt lệch ngang khác nhau để bám theo line.',
  inputs: [
    { id: 'who', type: 'object', label: 'Đối tượng', required: true },
    { id: 'track', type: 'object', label: 'Đường line' },
  ],
  outputs: [
    { id: 'onLine', type: 'bool', label: 'Thấy line' },
    { id: 'level', type: 'number', label: 'Độ đậm' },
    { id: 'entered', type: 'bool', label: 'Khi gặp line' },
    { id: 'left', type: 'bool', label: 'Khi rời line' },
  ],
  params: [
    { id: 'side', label: 'Lệch ngang (m; âm = trái, dương = phải)', kind: 'number', default: 0, min: -MAX_OFFSET, max: MAX_OFFSET, step: 0.05 },
    { id: 'forward', label: 'Lệch trước (m; âm = ra sau)', kind: 'number', default: 0.6, min: -MAX_OFFSET, max: MAX_OFFSET, step: 0.05 },
    { id: 'spot', label: 'Cỡ vòng đọc (m, đường kính)', kind: 'number', default: 0.3, min: 0, max: MAX_SPOT, step: 0.05 },
    { id: 'threshold', label: 'Ngưỡng thấy line (0 đến 1)', kind: 'number', default: 0.5, min: 0, max: 1, step: 0.05 },
    {
      id: 'invert',
      label: 'Đảo ngược (đọc nền thay vì vạch)',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có (Độ đậm = 1 trừ phần nằm trên vạch)' },
      ],
    },
  ],
  create: () => ({ dot: null, dotShown: false, dotOn: false, prevOn: false }),
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    const id = asObject(i.who);
    const self = id !== null ? world.getEntity(id) : undefined;
    let level = 0;
    let on = false;
    if (self && self.visible) {
      const forward = clamp(numParam(params, 'forward', 0.6), -MAX_OFFSET, MAX_OFFSET);
      const side = clamp(numParam(params, 'side', 0), -MAX_OFFSET, MAX_OFFSET);
      const spot = clamp(numParam(params, 'spot', 0.3), 0, MAX_SPOT);
      const c = spotCentre(self, ctx.mode, forward, side);
      const lines = tracksFor(world, asObject(i.track));
      const covered = trackCoverage(lines.map((e) => e.track as LineTrackSpec), c, spot, ctx.mode === '2d-side');
      level = strParam(params, 'invert', 'no') === 'yes' ? 1 - covered : covered;
      on = level > 0 && level >= clamp(numParam(params, 'threshold', 0.5), 0, 1);
      // Just above the floor under the object, or above the paint when that lies higher, so the paint never covers the dot.
      const floor = Math.max(self.position.y - self.size.y / 2, ...lines.map((e) => e.position.y)) + DOT_LIFT;
      const at = { x: c.u, y: floor, z: ctx.mode === '2d-side' ? 0 : c.v };
      if (s.dot === null) {
        const size = Math.max(0.1, spot);
        s.dot = world.spawn({ kind: 'block', ownerNodeId: ctx.nodeId, position: at, size: { x: size, y: 0.02, z: size }, color: DOT_OFF, look: LINE_DOT_LOOK, solid: false, zone: true });
        s.dotShown = true;
        s.dotOn = false;
      } else if (!s.dotShown) {
        s.dotShown = true;
        world.show(s.dot);
      }
      world.moveBlock(s.dot, at);
      if (on !== s.dotOn) {
        s.dotOn = on;
        world.setEntityStyle(s.dot, { color: on ? DOT_ON : DOT_OFF });
      }
    } else if (s.dot !== null && s.dotShown) {
      s.dotShown = false;
      world.hide(s.dot);
    }
    const entered = on && !s.prevOn;
    const left = !on && s.prevOn;
    s.prevOn = on;
    return { onLine: on, level, entered, left };
  },
};
