import type { EntityId, NodeDef, Vec3 } from '../engine/types';
import { extentAlong, lateralOf, localToWorld, normalOf } from '../world/arm-kinematics';
import { gripHolds, weight } from '../world/mechanics';
import { armRegistry, baseFrame, placeBox } from './arm-parts';
import { asBool, asObject, clamp, numParam, strParam } from './util';

interface GripperState {
  palm: EntityId;
  fingers: [EntityId, EntityId];
  /** The object between the fingers, and where it sits relative to the grasp point (kept so it does not jump when grabbed). */
  held: EntityId | null;
  offset: Vec3;
  /** After a slip the gripper must be opened before it tries again, so a dropped object is not grabbed back in mid-air. */
  latched: boolean;
}

/** Palm depth along the arm and finger length (m): the grasp point is the middle of the fingers. */
const PALM = 0.15;
const FINGER_LEN = 0.3;
const FINGER_T = 0.12;
const GRASP_AT = PALM + FINGER_LEN / 2;
/** Gap (m) between fingers closed on nothing. */
const SHUT_GAP = 0.02;

/** Gripper finger friction against an object's own surface: the weaker of the two limits the grip. */
export function combinedMu(fingerMu: number, objectMu: number): number {
  return Math.min(Math.max(0, fingerMu), Math.max(0, objectMu));
}

export const gripperNode: NodeDef<GripperState> = {
  kind: 'gripper',
  label: 'Tay kẹp',
  labelEn: 'Gripper',
  category: 'action',
  description:
    'Tay kẹp cuối cánh tay. Gắn vào đầu thanh nối hoặc đầu khớp. Khi "Kẹp" bật, nó kẹp món đồ vật gần nhất trong "Tầm với" mà bề ngang không quá "Độ mở". Mỗi ngón ép với "Lực kẹp" (N; chưa nối thì lấy lực mặc định, không vượt lực tối đa). Ma sát kẹp μ = số nhỏ hơn giữa μ của ngón và μ của món đồ. Kẹp giữ được khi số ngón × μ × lực mỗi ngón ≥ trọng lượng m × 9,81; nếu không món đồ TUỘT và rơi xuống (xung "Khi vật tuột"); phải nhả rồi kẹp lại. Tổng lực ép = số ngón × lực mỗi ngón; vượt "Lực chịu nén tối đa" của món đồ thì nó bị HỎNG (méo, sẫm màu; xung "Khi làm hỏng vật") nhưng vẫn kẹp được. Món đang kẹp đi theo tay và khối lượng của nó đè lên mọi khớp phía sau. Món đồ đang nằm trên bàn thì bàn đỡ, chưa cần ma sát cho tới khi nhấc lên. Chưa tính gia tốc của tay.',
  inputs: [
    { id: 'base', type: 'object', label: 'Gắn vào', required: true },
    { id: 'close', type: 'bool', label: 'Kẹp' },
    { id: 'force', type: 'number', label: 'Lực kẹp', default: Number.NaN },
  ],
  outputs: [
    { id: 'holding', type: 'bool', label: 'Đang giữ' },
    { id: 'held', type: 'object', label: 'Vật đang giữ' },
    { id: 'gripForce', type: 'number', label: 'Lực đang kẹp' },
    { id: 'slipped', type: 'bool', label: 'Khi vật tuột' },
    { id: 'crushedOut', type: 'bool', label: 'Khi làm hỏng vật' },
  ],
  params: [
    { id: 'defaultForce', label: 'Lực kẹp mặc định (N mỗi ngón)', kind: 'number', default: 20, min: 0, max: 100000, step: 1 },
    { id: 'maxForce', label: 'Lực kẹp tối đa (N mỗi ngón)', kind: 'number', default: 120, min: 0, max: 100000, step: 5 },
    { id: 'fingerMu', label: 'Ma sát của ngón μ', kind: 'number', default: 0.8, min: 0, max: 1.5, step: 0.05 },
    { id: 'width', label: 'Độ mở (m)', kind: 'number', default: 1, min: 0.05, max: 10, step: 0.05 },
    { id: 'reach', label: 'Tầm với (m)', kind: 'number', default: 0.5, min: 0.05, max: 10, step: 0.05 },
    { id: 'mass', label: 'Khối lượng tay kẹp (kg)', kind: 'number', default: 0.5, min: 0, max: 100000, step: 0.1 },
    { id: 'fingers', label: 'Số ngón', kind: 'number', default: 2, min: 1, max: 4, step: 1 },
    { id: 'color', label: 'Màu', kind: 'color', default: '#f59e0b', advanced: true },
  ],
  createOnly: ['width', 'color'],
  liveApply: {
    color: (ctx, p, s) => {
      for (const id of [s.palm, ...s.fingers]) ctx.world.setEntityStyle(id, { color: String(p.color) });
    },
  },
  create(ctx, params) {
    const width = Math.max(0.05, numParam(params, 'width', 1));
    const color = strParam(params, 'color', '#f59e0b');
    const spawn = (size: Vec3): EntityId =>
      ctx.world.spawn({ kind: 'block', ownerNodeId: ctx.nodeId, position: { x: 0, y: -1000, z: 0 }, size, color, solid: false });
    const span = width + 2 * FINGER_T;
    // The fingers close along the arm's normal in the side view and sideways elsewhere.
    const palmSize = ctx.mode === '2d-side' ? { x: PALM, y: span, z: 0.25 } : { x: PALM, y: 0.25, z: span };
    const palm = spawn(palmSize);
    const f1 = spawn({ x: FINGER_LEN, y: FINGER_T, z: FINGER_T });
    const f2 = spawn({ x: FINGER_LEN, y: FINGER_T, z: FINGER_T });
    return { palm, fingers: [f1, f2], held: null, offset: { x: 0, y: 0, z: 0 }, latched: false };
  },
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    const reg = armRegistry(world);
    const baseId = asObject(i.base);
    const base = baseFrame(ctx, baseId, { x: 0, y: 0, z: 0 });
    const idle = { holding: false, held: null, gripForce: 0, slipped: false, crushedOut: false };
    if (!base) {
      reg.parts.delete(ctx.nodeId);
      s.held = null;
      return idle;
    }
    const grasp = localToWorld(base, { x: GRASP_AT, y: 0, z: 0 });
    const axis = ctx.mode === '2d-side' ? normalOf(base) : lateralOf(base);
    const closeCmd = asBool(i.close);
    const maxForce = Math.max(0, numParam(params, 'maxForce', 120));
    const wired = typeof i.force === 'number' && Number.isFinite(i.force);
    const force = clamp(wired ? (i.force as number) : numParam(params, 'defaultForce', 20), 0, maxForce);
    const fingers = Math.max(1, Math.round(numParam(params, 'fingers', 2)));
    const width = Math.max(0.05, numParam(params, 'width', 1));

    let slipped = false;
    let crushedOut = false;

    if (!closeCmd) {
      s.held = null;
      s.latched = false;
    }

    // Look for something to grab: the nearest free object inside reach whose width fits between the open fingers.
    if (closeCmd && s.held === null && !s.latched) {
      const reach = Math.max(0, numParam(params, 'reach', 0.5));
      let best: { id: EntityId; d: number; offset: Vec3 } | null = null;
      for (const e of world.listEntities()) {
        if (e.kind !== 'item' || !e.visible || e.carried || e.inHand) continue;
        const dx = e.position.x - grasp.x;
        const dy = e.position.y - grasp.y;
        const dz = e.position.z - grasp.z;
        const d = Math.hypot(dx, dy, dz);
        if (d > reach || extentAlong(axis, e.size) > width + 1e-9) continue;
        if (!best || d < best.d) best = { id: e.id, d, offset: { x: dx, y: dy, z: dz } };
      }
      if (best) {
        s.held = best.id;
        s.offset = best.offset;
      }
    }

    let carriedKg = 0;
    let gap = closeCmd ? SHUT_GAP : width / 2;
    if (s.held !== null) {
      const view = world.getEntity(s.held);
      const mat = world.materialOf(s.held);
      if (!view || !mat || !view.visible || view.carried || view.inHand) {
        s.held = null;
      } else {
        // A resting object is held up by what it rests on; only a lifted one hangs on the fingers.
        const supported = world.isOnGround(s.held);
        const grip = gripHolds({ gripForceN: force, mu: combinedMu(numParam(params, 'fingerMu', 0.8), mat.mu), fingers, weightN: weight(mat.massKg) });
        if (!supported && !grip.holds) {
          s.held = null;
          s.latched = true;
          slipped = true;
        } else {
          const wasDamaged = mat.damaged;
          const nowDamaged = world.applySqueeze(s.held, fingers * force);
          crushedOut = nowDamaged && !wasDamaged;
          carriedKg = supported ? 0 : mat.massKg;
          gap = extentAlong(axis, view.size) / 2;
          world.teleport(s.held, { x: grasp.x + s.offset.x, y: grasp.y + s.offset.y, z: grasp.z + s.offset.z }, false);
        }
      }
    }

    // Pieces: palm at the base, two fingers either side of the grasp point.
    placeBox(world, ctx.mode, s.palm, localToWorld(base, { x: PALM / 2, y: 0, z: 0 }), base);
    const half = gap + FINGER_T / 2;
    s.fingers.forEach((id, n) => {
      const sign = n === 0 ? 1 : -1;
      const at = { x: grasp.x + axis.x * half * sign, y: grasp.y + axis.y * half * sign, z: grasp.z + axis.z * half * sign };
      placeBox(world, ctx.mode, id, at, base);
    });

    reg.parts.set(ctx.nodeId, {
      tick: ctx.tick,
      baseId,
      tipId: null,
      masses: [
        { kg: Math.max(0, numParam(params, 'mass', 0.5)), point: grasp },
        ...(carriedKg > 0 ? [{ kg: carriedKg, point: grasp }] : []),
      ],
    });
    return {
      holding: s.held !== null,
      held: s.held,
      gripForce: closeCmd ? force : 0,
      slipped,
      crushedOut,
    };
  },
};
