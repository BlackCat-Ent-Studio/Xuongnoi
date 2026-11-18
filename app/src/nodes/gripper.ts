import type { EntityId, EntityView, NodeDef, Vec3 } from '../engine/types';
import { dirOf, extentAlong, lateralOf, localToWorld, normalOf, type Frame } from '../world/arm-kinematics';
import { gripHolds, weight } from '../world/mechanics';
import { conjQuat, extentOn, isTurned, mulQuat, obbOf, quatFromAxes, rotateBy, sensedTurn, type Quat } from '../world/oriented-box';
import { armRegistry, baseFrame, placeBox } from './arm-parts';
import { setArmHint } from '../engine/render-hints';
import { asBool, asObject, clamp, numParam, strParam } from './util';

interface GripperState {
  palm: EntityId;
  fingers: [EntityId, EntityId];
  /** The object between the fingers, and where it sits relative to the grasp point (kept so it does not jump when grabbed). */
  held: EntityId | null;
  offset: Vec3;
  /**
   * A crate that can turn (real physics): where it sits in the hand and how it is turned, both in the arm's own frame, so it turns
   * and swings with the hand and keeps that turn when let go. Null for anything that cannot turn.
   */
  grip: { offset: Vec3; turn: Quat } | null;
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

/** How the gripper decides what closing would grab (the "Cách kẹp" setting). */
export type GripRule = 'between' | 'reach';

/** Old boards have no setting and keep the reach rule; see the param's `legacyDefault`. */
const gripRuleOf = (v: string): GripRule => (v === 'between' ? 'between' : 'reach');

/** The directions the fingers work along: where the arm points, across which they close, and (3D only) the third one. */
interface FingerAxes {
  approach: Vec3;
  close: Vec3;
  /** Perpendicular to both; null in the flat views, which have no such direction. */
  rise: Vec3 | null;
}

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

/** Length of the object's shadow on `axis`: a crate that tipped over is measured by its real outline, not by the upright box. */
function extentOf(axis: Vec3, size: Vec3, rotation: Quat | undefined): number {
  return isTurned(rotation) ? extentOn(obbOf(ORIGIN, size, rotation), axis) : extentAlong(axis, size);
}

/** The turn of the arm's frame: its x axis along the arm, y up from the arm, z sideways. */
function frameTurn(f: Frame): Quat {
  return quatFromAxes(dirOf(f), normalOf(f), lateralOf(f));
}

/**
 * True when the object lies between the open fingers: the grasp point is inside the object's extent along the arm and
 * (in 3D) along the third direction, and the whole object fits between the fingers across the closing direction.
 */
export function betweenFingers(grasp: Vec3, size: Vec3, centre: Vec3, axes: FingerAxes, width: number, rotation?: Quat): boolean {
  const d = { x: centre.x - grasp.x, y: centre.y - grasp.y, z: centre.z - grasp.z };
  const EPS = 1e-9;
  if (Math.abs(dot(d, axes.approach)) > extentOf(axes.approach, size, rotation) / 2 + EPS) return false;
  if (axes.rise && Math.abs(dot(d, axes.rise)) > extentOf(axes.rise, size, rotation) / 2 + EPS) return false;
  return Math.abs(dot(d, axes.close)) + extentOf(axes.close, size, rotation) / 2 <= width / 2 + EPS;
}

/**
 * The free item closest to the grasp point that closing would grab: under "between" the one lying between the open
 * fingers, under "reach" any one whose centre is within `reach` and that is no wider than the opening (`width`).
 */
function nearestGrippable(
  entities: readonly EntityView[],
  grasp: Vec3,
  axes: FingerAxes,
  rule: GripRule,
  reach: number,
  width: number,
): { id: EntityId; d: number; offset: Vec3; rotation: Quat | undefined } | null {
  let best: { id: EntityId; d: number; offset: Vec3; rotation: Quat | undefined } | null = null;
  for (const e of entities) {
    if (e.kind !== 'item' || !e.visible || e.carried || e.inHand) continue;
    const dx = e.position.x - grasp.x;
    const dy = e.position.y - grasp.y;
    const dz = e.position.z - grasp.z;
    const d = Math.hypot(dx, dy, dz);
    const turn = sensedTurn(e.rotation, e.shape);
    if (extentOf(axes.close, e.size, turn) > width + 1e-9) continue;
    if (rule === 'reach' ? d > reach : !betweenFingers(grasp, e.size, e.position, axes, width, turn)) continue;
    if (!best || d < best.d) best = { id: e.id, d, offset: { x: dx, y: dy, z: dz }, rotation: e.rotation };
  }
  return best;
}

export const gripperNode: NodeDef<GripperState> = {
  kind: 'gripper',
  label: 'Tay kẹp',
  labelEn: 'Gripper',
  category: 'action',
  description:
    'Tay kẹp cuối cánh tay: kẹp món đồ vật nằm giữa hai ngón (điểm kẹp nằm trong thân món đó và món đó lọt giữa hai ngón đang mở) bằng lực bạn chọn, nên phải đưa tay tới đúng tư thế. "Cách kẹp" có thể đổi sang kiểu cũ: món gần nhất trong tầm với. Giữ được khi số ngón × μ × lực ≥ khối lượng × 9,81, kẹp quá mạnh thì món đồ bị hỏng.',
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
    { id: 'inReach', type: 'bool', label: 'Có vật trong tầm' },
    { id: 'candidate', type: 'object', label: 'Vật trong tầm' },
  ],
  params: [
    { id: 'defaultForce', label: 'Lực kẹp mặc định (N mỗi ngón)', kind: 'number', default: 20, min: 0, max: 100000, step: 1 },
    { id: 'maxForce', label: 'Lực kẹp tối đa (N mỗi ngón)', kind: 'number', default: 120, min: 0, max: 100000, step: 5 },
    { id: 'fingerMu', label: 'Ma sát của ngón μ', kind: 'number', default: 0.8, min: 0, max: 1.5, step: 0.05 },
    { id: 'width', label: 'Độ mở (m)', kind: 'number', default: 1, min: 0.05, max: 10, step: 0.05 },
    {
      id: 'grip',
      label: 'Cách kẹp',
      kind: 'select',
      default: 'between',
      legacyDefault: 'reach',
      options: [
        { value: 'between', label: 'Vật nằm giữa hai ngón' },
        { value: 'reach', label: 'Vật trong tầm với' },
      ],
    },
    { id: 'reach', label: 'Tầm với (m, chỉ khi kẹp kiểu "trong tầm với")', kind: 'number', default: 0.5, min: 0.05, max: 10, step: 0.05 },
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
    setArmHint(ctx.nodeId, palm, { part: 'palm' });
    setArmHint(ctx.nodeId, f1, { part: 'finger', side: 1 });
    setArmHint(ctx.nodeId, f2, { part: 'finger', side: -1 });
    return { palm, fingers: [f1, f2], held: null, offset: { x: 0, y: 0, z: 0 }, grip: null, latched: false };
  },
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    const reg = armRegistry(world);
    const baseId = asObject(i.base);
    const base = baseFrame(ctx, baseId, { x: 0, y: 0, z: 0 });
    const idle = { holding: false, held: null, gripForce: 0, slipped: false, crushedOut: false, inReach: false, candidate: null };
    if (!base) {
      reg.parts.delete(ctx.nodeId);
      s.held = null;
      s.grip = null;
      return idle;
    }
    const grasp = localToWorld(base, { x: GRASP_AT, y: 0, z: 0 });
    const axis = ctx.mode === '2d-side' ? normalOf(base) : lateralOf(base);
    const axes: FingerAxes = { approach: dirOf(base), close: axis, rise: ctx.mode === '3d' ? normalOf(base) : null };
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
      s.grip = null;
      s.latched = false;
    }

    // The nearest free object inside reach whose width fits between the open fingers: what closing would grab right now.
    const rule = gripRuleOf(strParam(params, 'grip', 'reach'));
    const best = nearestGrippable(world.listEntities(), grasp, axes, rule, Math.max(0, numParam(params, 'reach', 0.5)), width);
    if (closeCmd && s.held === null && !s.latched) {
      if (best) {
        s.held = best.id;
        s.offset = best.offset;
        // A crate that can turn is carried by the hand: remember its place and turn in the hand's own frame.
        if (best.rotation) {
          const hand = frameTurn(base);
          s.grip = { offset: rotateBy(conjQuat(hand), best.offset), turn: mulQuat(conjQuat(hand), best.rotation) };
        } else {
          s.grip = null;
        }
      }
    }

    let carriedKg = 0;
    let gap = closeCmd ? SHUT_GAP : width / 2;
    if (s.held !== null) {
      const view = world.getEntity(s.held);
      const mat = world.materialOf(s.held);
      if (!view || !mat || !view.visible || view.carried || view.inHand) {
        s.held = null;
        s.grip = null;
      } else {
        // A resting object is held up by what it rests on; only a lifted one hangs on the fingers.
        const supported = world.isOnGround(s.held);
        const grip = gripHolds({ gripForceN: force, mu: combinedMu(numParam(params, 'fingerMu', 0.8), mat.mu), fingers, weightN: weight(mat.massKg) });
        if (!supported && !grip.holds) {
          s.held = null;
          s.grip = null;
          s.latched = true;
          slipped = true;
        } else {
          const wasDamaged = mat.damaged;
          const nowDamaged = world.applySqueeze(s.held, fingers * force, axis);
          crushedOut = nowDamaged && !wasDamaged;
          carriedKg = supported ? 0 : mat.massKg;
          gap = extentOf(axis, view.size, sensedTurn(view.rotation, view.shape)) / 2;
          let at = s.offset;
          if (s.grip) {
            // The crate turns and swings with the hand (when the arm turns, so does the crate).
            const hand = frameTurn(base);
            at = rotateBy(hand, s.grip.offset);
            world.setItemRotation(s.held, mulQuat(hand, s.grip.turn));
          }
          world.teleport(s.held, { x: grasp.x + at.x, y: grasp.y + at.y, z: grasp.z + at.z }, false);
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
      // While holding, the held object is the one in reach; otherwise whatever closing would grab now.
      inReach: s.held !== null || best !== null,
      candidate: s.held ?? best?.id ?? null,
    };
  },
};
