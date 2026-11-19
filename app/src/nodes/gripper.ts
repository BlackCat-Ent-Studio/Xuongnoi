import type { EntityId, EntityView, EvalCtx, NodeDef, PortDef, Vec3 } from '../engine/types';
import { dirOf, extentAlong, lateralOf, localToWorld, normalOf, type Frame } from '../world/arm-kinematics';
import { resolveTurn } from '../world/arm-solid';
import { fitInHand, type GripFit, type HandBox } from '../world/grip-fit';
import { FINGER_LEN, FINGER_T, GRASP_AT, handBoxes, handCubes, handSweep, PALM, palmSizeOf, partSweep } from '../world/hand-solid';
import { gripHolds, weight } from '../world/mechanics';
import { conjQuat, extentOn, isTurned, mulQuat, obbOf, obbSeparation, quatFromAxes, rotateBy, sensedTurn, type Quat } from '../world/oriented-box';
import { armRegistry, baseFrame, placeBox, placeSolidCubes } from './arm-parts';
import { pushBodiesOf } from './linear-actuator';
import { ARM_LOOKS, CLASSIC_LOOK, lookSpec } from '../engine/factory-looks';
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
   * and swings with the hand and keeps that turn when let go. It is clamped between the pads (see `fitInHand`): `across` is its
   * width between them. Null for anything that cannot turn.
   */
  grip: { offset: Vec3; turn: Quat; across: number; shift: number } | null;
  /** After a slip the gripper must be opened before it tries again, so a dropped object is not grabbed back in mid-air. */
  latched: boolean;
  /**
   * Real physics on: where each finger's middle is along the closing axis, measured from the grasp point (null until the first
   * placement). The fingers travel there at `FINGER_SPEED`; a finger that meets a crate it cannot move stops where it is.
   */
  pads: [number, number] | null;
  /** The invisible solid cubes that cover the palm and the fingers (see `hand-solid`), once real physics is on. */
  cubes: EntityId[];
  /** The crate the engine was told this hand holds (so it can be told when the hand lets go). */
  gripped: EntityId | null;
  /**
   * Real physics on: the crate the pads are closing on. It counts as held only when both pads touch its faces; until then it is a
   * free body that a closing finger may push. Null when closing found nothing to clamp.
   */
  pending: EntityId | null;
  /** Last tick's finger report: a finger that wants to move and cannot, and the force (N) the fingers press with. */
  stalled: boolean;
  pressN: number;
}

/** Speed (m/s) at which a finger closes or opens with real physics on (the param's default; without real physics the fingers jump to their place). */
const FINGER_SPEED = 1;
/**
 * A pad closing on a crate stops this far (m) short of its face, and counts as touching from there: a pad that lands exactly on a face
 * gives the crate a push (the engine's contact is soft, a 2 kg crate was shoved 8 mm at 1 m/s), one that stops a hair short does not.
 * The clamp then takes up the last fraction of a millimetre.
 */
const STAND_OFF = 4e-4;
/** How close (m) to its stopping place a pad must be for the crate to count as held. */
const ARRIVED = 1e-4;
/** The two read-outs behind "Hiện báo ngón bị chặn". */
const FINGER_PORTS: PortDef[] = [
  { id: 'fingerStalled', type: 'bool', label: 'Ngón bị chặn', labelEn: 'Finger blocked' },
  { id: 'fingerForce', type: 'number', label: 'Lực ngón đang ép', labelEn: 'Finger press force' },
];
/** Gap (m) between fingers closed on nothing. */
const SHUT_GAP = 0.02;
/** Overlap (m) of a pad or the palm with a solid block that makes a grip impossible. */
const SINK = 0.001;
/** How far (m) a solid may keep a clamped crate from where the hand wants it before the pads let go. */
const BLOCKED = 0.02;

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

interface Grippable {
  id: EntityId;
  d: number;
  offset: Vec3;
  /** Where a rigid crate clamps in the hand; null for what cannot turn (old rules). */
  fit: GripFit | null;
  /** Width (m) of the crate as it stands now across the closing axis: where the pads' faces meet it. */
  closeExtent: number;
}

/**
 * The free item closest to the grasp point that closing would grab. A crate that can turn (real physics) is taken only when the
 * pads can really clamp it (`fit`, the same rule under either setting); anything else under "between" is the one lying between
 * the open fingers, under "reach" any one whose centre is within `reach` and that is no wider than the opening (`width`).
 */
function nearestGrippable(
  entities: readonly EntityView[],
  grasp: Vec3,
  axes: FingerAxes,
  rule: GripRule,
  reach: number,
  width: number,
  fitOf: (e: EntityView, offset: Vec3) => GripFit | null,
  /** The crate the pads are already closing on: kept while it can still be clamped, even when another one is nearer. */
  prefer: EntityId | null = null,
): Grippable | null {
  let best: Grippable | null = null;
  for (const e of entities) {
    if (e.kind !== 'item' || !e.visible || e.carried || e.inHand) continue;
    const dx = e.position.x - grasp.x;
    const dy = e.position.y - grasp.y;
    const dz = e.position.z - grasp.z;
    const d = Math.hypot(dx, dy, dz);
    const offset = { x: dx, y: dy, z: dz };
    let fit: GripFit | null = null;
    if (e.rotation !== undefined) {
      // The grasp point has to be inside the crate, so nothing farther than its half diagonal can be clamped.
      if (d > Math.hypot(e.size.x, e.size.y, e.size.z) / 2 + 1e-9) continue;
      fit = fitOf(e, offset);
      if (!fit) continue;
    } else {
      if (extentOf(axes.close, e.size, undefined) > width + 1e-9) continue;
      if (rule === 'reach' ? d > reach : !betweenFingers(grasp, e.size, e.position, axes, width, undefined)) continue;
    }
    const cand = { id: e.id, d, offset, fit, closeExtent: extentOf(axes.close, e.size, sensedTurn(e.rotation, e.shape)) };
    if (e.id === prefer) return cand;
    if (!best || d < best.d) best = cand;
  }
  return best;
}

/** Tells the engine which crate this hand holds (and that it let go of the one it held before). */
function setGrip(s: GripperState, world: EvalCtx['world'], nodeId: string, held: EntityId | null): void {
  if (s.gripped === held) return;
  if (s.gripped !== null) world.setItemGrip(s.gripped, null);
  if (held !== null) world.setItemGrip(held, nodeId);
  s.gripped = held;
}

/**
 * Real physics: the cover cubes ride along with the hand, then each finger travels toward its place along the closing axis, at the "Tốc độ khép ngón" speed.
 * A finger is a pusher like a piston head: a crate it meets is pushed (tipped or slid, see `planPush`) with at most the grip
 * force, and the finger stops where that is not enough or where a solid (a wall, the other finger) is in the way.
 * The crate the hand holds is part of the hand and is not pushed. The sweep is the one the joints use, with a lever of 1 m so
 * that its "torque" reads as the force in newtons.
 */
function moveFingers(
  ctx: EvalCtx,
  s: GripperState,
  base: Frame,
  width: number,
  want: readonly [number, number],
  forceN: number,
  held: EntityId | null,
  speed: number,
): { stalled: boolean; pressN: number } {
  const world = ctx.world;
  const place = (): void => placeSolidCubes(world, ctx.nodeId, s.cubes, handCubes(base, ctx.mode, width, s.pads!), true);
  if (!s.pads) {
    s.pads = [want[0], want[1]];
    for (const id of s.cubes) world.show(id);
    place();
    return { stalled: false, pressN: 0 };
  }
  place();
  const limit = speed * ctx.dt;
  const flat = ctx.mode === '2d-top' ? 'y' : ctx.mode === '2d-side' ? 'z' : null;
  const pads = s.pads;
  let moved = false;
  let stalled = false;
  let pressN = 0;
  for (const n of [0, 1] as const) {
    const delta = want[n] - pads[n];
    if (Math.abs(delta) < 1e-9) continue;
    const step = Math.sign(delta) * Math.min(Math.abs(delta), limit);
    const cubesAt = (k: number) => partSweep(handBoxes(base, ctx.mode, width, n === 0 ? [pads[0] + k, pads[1]] : [pads[0], pads[1] + k])[1 + n]!);
    const parts = handBoxes(base, ctx.mode, width, pads);
    // The other finger is a solid a pushed crate cannot be squeezed into. The palm is not: it sits behind the fingers, never in their way.
    const others = partSweep(parts[2 - n]!).filter((b) => !b.exact);
    const resolved = resolveTurn(0, step, cubesAt, {
      levers: cubesAt(0).map(() => 1),
      // A finger touches a crate when the faces meet (no contact margin): a pad that stops at a face is not pushing it.
      bodies: pushBodiesOf(world, null, held === null ? null : new Set([held])).map(({ skin: _skin, ...b }) => b),
      solids: [...world.solidBoxes().map((b) => ({ pos: b.position, size: b.size })), ...others],
      flat,
      availableNm: forceN,
    });
    // Newtons: the sweep's lever is 1 m. A finger that cannot go on presses with all it has; one that pushes a crate along, with what that takes.
    if (resolved.blocked) {
      stalled = true;
      pressN = Math.max(pressN, forceN);
    } else if (resolved.rigidNm > 0) pressN = Math.max(pressN, resolved.rigidNm);
    for (const [id, d] of resolved.moves) {
      const e = world.getEntity(id);
      if (e && !world.isRigidCrate(id)) world.teleport(id, { x: e.position.x + d.x, y: e.position.y + d.y, z: e.position.z + d.z }, false);
    }
    if (resolved.angle !== 0) {
      pads[n] += resolved.angle;
      moved = true;
    }
  }
  if (moved) place();
  return { stalled, pressN };
}

export const gripperNode: NodeDef<GripperState> = {
  kind: 'gripper',
  label: 'Tay kẹp',
  labelEn: 'Gripper',
  category: 'action',
  description:
    'Tay kẹp cuối cánh tay: kẹp món đồ vật nằm giữa hai ngón (điểm kẹp nằm trong thân món đó và món đó lọt giữa hai ngón đang mở) bằng lực bạn chọn, nên phải đưa tay tới đúng tư thế. "Cách kẹp" có thể đổi sang kiểu cũ: món gần nhất trong tầm với. Với "Vật lý thật" thùng rắn chỉ được kẹp khi hai ngón ôm được nó (lòng bàn tay không lún vào thùng, mặt thùng hướng vào hai ngón) và mỗi ngón khép tới khi chạm mặt thùng. Giữ được khi số ngón × μ × lực ≥ khối lượng × 9,81, kẹp quá mạnh thì món đồ bị hỏng. Với "Vật lý thật" lòng bàn tay và hai ngón là vật rắn: thùng nằm trên đường đi bị đẩy, đổ hoặc chặn lại, hai ngón khép với "Tốc độ khép ngón" (mặc định 1 m/s) và đẩy thùng chưa kẹp bằng lực không quá "Lực kẹp"; thùng chỉ được tính là đang kẹp khi cả hai ngón đã chạm hai mặt thùng.',
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
  optionalOutputs: { all: FINGER_PORTS, active: (params) => (strParam(params, 'showFingerOuts', 'no') === 'yes' ? FINGER_PORTS : []) },
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
    // Draw only: the palm and finger boxes and the grip are the same whatever the look.
    { id: 'look', label: 'Kiểu dáng (chỉ đổi hình vẽ)', kind: 'select', default: CLASSIC_LOOK, options: [...ARM_LOOKS], advanced: true },
    { id: 'fingerSpeed', label: 'Tốc độ khép ngón (m/s)', kind: 'number', default: FINGER_SPEED, min: 0.05, max: 5, step: 0.05, advanced: true },
    {
      id: 'showFingerOuts',
      label: 'Hiện báo ngón bị chặn',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có (hiện thêm ô ra "Ngón bị chặn" và "Lực ngón đang ép")' },
      ],
      advanced: true,
    },
  ],
  createOnly: ['width', 'color', 'look'],
  liveApply: {
    color: (ctx, p, s) => {
      for (const id of [s.palm, ...s.fingers]) ctx.world.setEntityStyle(id, { color: String(p.color) });
    },
  },
  create(ctx, params) {
    const width = Math.max(0.05, numParam(params, 'width', 1));
    const color = strParam(params, 'color', '#f59e0b');
    const spawn = (size: Vec3): EntityId =>
      ctx.world.spawn({ kind: 'block', ownerNodeId: ctx.nodeId, position: { x: 0, y: -1000, z: 0 }, size, color, solid: false, ...lookSpec(params.look, ARM_LOOKS) });
    // The fingers close along the arm's normal in the side view and sideways elsewhere.
    const palm = spawn(palmSizeOf(ctx.mode, width));
    const f1 = spawn({ x: FINGER_LEN, y: FINGER_T, z: FINGER_T });
    const f2 = spawn({ x: FINGER_LEN, y: FINGER_T, z: FINGER_T });
    setArmHint(ctx.nodeId, palm, { part: 'palm' });
    setArmHint(ctx.nodeId, f1, { part: 'finger', side: 1 });
    setArmHint(ctx.nodeId, f2, { part: 'finger', side: -1 });
    return { palm, fingers: [f1, f2], held: null, offset: { x: 0, y: 0, z: 0 }, grip: null, latched: false, pads: null, cubes: [], gripped: null, pending: null, stalled: false, pressN: 0 };
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
      s.pending = null;
      // A hand that is not mounted on anything is not a body: it lets go of its crate and its cubes leave the world until it is mounted again.
      setGrip(s, world, ctx.nodeId, null);
      for (const id of s.cubes) world.hide(id);
      world.setExactBodies(ctx.nodeId, null);
      s.pads = null;
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
    /** Real physics on: palm and fingers are solid bodies that push, tip or stop crates (see `hand-solid`). */
    const solid = world.realPhysicsOn();

    let slipped = false;
    let crushedOut = false;

    if (!closeCmd) {
      s.held = null;
      s.grip = null;
      s.latched = false;
      s.pending = null;
    }

    // The nearest free object inside reach whose width fits between the open fingers: what closing would grab right now.
    const rule = gripRuleOf(strParam(params, 'grip', 'reach'));
    const handTurn = frameTurn(base);
    const close = ctx.mode === '2d-side' ? 'y' : 'z';
    // What a clamped crate must stay clear of, in the hand's frame: the palm, and the link the hand hangs on.
    const clear: HandBox[] = [{ centre: { x: PALM / 2 - GRASP_AT, y: 0, z: 0 }, size: palmSizeOf(ctx.mode, width) }];
    const baseView = baseId !== null && reg.frames.has(baseId) ? world.getEntity(baseId) : undefined;
    if (baseView) {
      clear.push({ centre: rotateBy(conjQuat(handTurn), { x: baseView.position.x - grasp.x, y: baseView.position.y - grasp.y, z: baseView.position.z - grasp.z }), size: baseView.size });
    }
    // Real physics: the crate has to fit between the fingers as they stand now (closed fingers leave no room), and the pads, on its
    // faces, must not be inside a solid (a finger cannot go under a crate that lies flat on a table).
    const opening = solid && s.pads ? Math.min(width, 2 * Math.min(s.pads[0], -s.pads[1]) - FINGER_T) : width;
    const solids = solid ? world.solidBoxes() : [];
    const fitOf = (e: EntityView, offset: Vec3): GripFit | null => {
      // The crate the pads are already closing on was accepted when the fingers stood open: it stays so while they close on it.
      const fit = fitInHand({ hand: handTurn, offset, size: e.size, rotation: sensedTurn(e.rotation, e.shape), width: e.id === s.pending ? width : opening, close, clear });
      if (!fit || solids.length === 0) return fit;
      const at = [fit.shift + fit.across / 2 + FINGER_T / 2, fit.shift - fit.across / 2 - FINGER_T / 2] as const;
      const parts = handBoxes(base, ctx.mode, width, at).map((b) => obbOf(b.centre, b.size, b.turn));
      const sunk = solids.some((b) => {
        const box = obbOf(b.position, b.size);
        return parts.some((p) => obbSeparation(p, box) < -SINK);
      });
      return sunk ? null : fit;
    };
    const best = nearestGrippable(world.listEntities(), grasp, axes, rule, Math.max(0, numParam(params, 'reach', 0.5)), opening, fitOf, s.pending);
    const speed = clamp(numParam(params, 'fingerSpeed', FINGER_SPEED), 0.05, 5);
    // Where the pads must be to touch the crate they are closing on: its faces as it stands now, middle on its centre.
    const wantOn = (c: Grippable): [number, number] => {
      const half = c.closeExtent / 2 + FINGER_T / 2;
      return [c.fit!.shift + half + STAND_OFF, c.fit!.shift - half - STAND_OFF];
    };
    if (closeCmd && s.held === null && !s.latched) {
      let take = false;
      if (best && solid && best.fit) {
        // Real physics: a rigid crate is held from the moment both pads touch its faces; until then it is a free body the fingers may push.
        s.pending = best.id;
        const at = wantOn(best);
        take = s.pads !== null && Math.abs(s.pads[0] - at[0]) < ARRIVED && Math.abs(s.pads[1] - at[1]) < ARRIVED;
      } else {
        s.pending = null;
        take = best !== null;
      }
      if (best && take) {
        s.pending = null;
        s.held = best.id;
        s.offset = best.offset;
        // A crate that can turn is clamped by the pads and carried by the hand: its place and turn in the hand's own frame.
        s.grip = best.fit ? { offset: best.fit.offset, turn: best.fit.turn, across: best.fit.across, shift: best.fit.shift } : null;
      }
    }
    const closingOn = s.pending !== null && best !== null && best.id === s.pending ? best : null;

    let carriedKg = 0;
    // A hand whose grip failed lets go (real physics): pads that kept closing on the crate it dropped would wedge or squeeze it.
    let gap = closeCmd && !(solid && s.latched) ? SHUT_GAP : width / 2;
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
          if (solid) gap = width / 2;
        } else {
          const wasDamaged = mat.damaged;
          const nowDamaged = world.applySqueeze(s.held, fingers * force, axis);
          crushedOut = nowDamaged && !wasDamaged;
          carriedKg = supported ? 0 : mat.massKg;
          gap = s.grip ? s.grip.across / 2 : extentOf(axis, view.size, sensedTurn(view.rotation, view.shape)) / 2;
          let at = s.offset;
          if (s.grip) {
            // The crate turns and swings with the hand (when the arm turns, so does the crate).
            at = rotateBy(handTurn, s.grip.offset);
            world.setItemRotation(s.held, mulQuat(handTurn, s.grip.turn));
          }
          const want = { x: grasp.x + at.x, y: grasp.y + at.y, z: grasp.z + at.z };
          if (solid) setGrip(s, world, ctx.nodeId, s.held);
          const placed = world.teleport(s.held, want, false);
          // A clamped crate the hand drives into a solid cannot follow: the pads slide off it (it is let go where it is) instead of
          // being carried sunk into the solid or thrown clear of it.
          if (s.grip && (!placed || Math.hypot(placed.x - want.x, placed.y - want.y, placed.z - want.z) > BLOCKED)) {
            s.held = null;
            s.grip = null;
            s.latched = true;
            slipped = true;
            carriedKg = 0;
            gap = width / 2;
          }
        }
      }
    }

    // Pieces: palm at the base, two fingers either side of the grasp point.
    placeBox(world, ctx.mode, s.palm, localToWorld(base, { x: PALM / 2, y: 0, z: 0 }), base);
    const half = gap + FINGER_T / 2;
    // Each finger closes until it touches: on a clamped crate the pads' middle is the crate's centre, not necessarily the grasp point.
    const mid = s.held !== null && s.grip ? s.grip.shift : 0;
    let wantPads: [number, number] = [mid + half, mid - half];
    // Closing on a crate that is not held yet: the pads go to its faces and push it on the way if it is not where they will meet.
    if (s.held === null && closingOn?.fit) wantPads = wantOn(closingOn);
    // Real physics: the hand is solid, so the fingers travel to their place and meet what is in the way; otherwise they jump there.
    let report = { stalled: false, pressN: 0 };
    if (solid) {
      report = moveFingers(ctx, s, base, width, wantPads, force, s.held, speed);
      setGrip(s, world, ctx.nodeId, s.held);
    }
    // A clamped crate squeezes with the grip force from each pad.
    if (s.held !== null && s.grip && solid) report.pressN = Math.max(report.pressN, force);
    s.stalled = report.stalled;
    s.pressN = report.pressN;
    const pads = solid && s.pads ? s.pads : wantPads;
    // The crate engine meets the hand by its real boxes (palm and both fingers, turned with the hand), not by the upright cover cubes.
    if (solid) world.setExactBodies(ctx.nodeId, handBoxes(base, ctx.mode, width, pads).map((b) => ({ centre: b.centre, size: b.size, rot: b.turn })));
    s.fingers.forEach((id, n) => {
      const k = pads[n]!;
      const at = { x: grasp.x + axis.x * k, y: grasp.y + axis.y * k, z: grasp.z + axis.z * k };
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
      holds: s.held,
      // A joint turning the arm asks where the palm and fingers would be: they are solid cubes it must push through (or stop at).
      ...(solid ? { shape: (from: Frame, mode: EvalCtx['mode']) => ({ out: null, solids: handSweep(from, mode, width, s.pads ?? wantPads) }) } : {}),
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
      ...(strParam(params, 'showFingerOuts', 'no') === 'yes' ? { fingerStalled: s.stalled, fingerForce: s.pressN } : {}),
    };
  },
};
