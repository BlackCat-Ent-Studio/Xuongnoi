import type { EntityId, EntityView, NodeDef, Vec3, ViewMode, WorldApi } from '../engine/types';
import { CONTAINER_LOOK, containerBlocks, containerOfLabel, insideContainer } from './container';
import { asBool, asObject, clamp, numParam, strParam, vec3Param } from './util';

/** What a hitch may take hold of ("Gài được"). */
export const HITCH_WHAT = ['container', 'item', 'both'] as const;
export type HitchWhat = (typeof HITCH_WHAT)[number];

export const HITCH_DEFAULT_REACH = 0.6;
const DEFAULT_OFFSET: Vec3 = { x: 0, y: 0, z: 0 };
/** How the held body is drawn into its place after it is taken: no faster than this (m/s), speeding up and slowing down at `PULL_ACCEL` (m/s2). */
export const HITCH_PULL_SPEED = 0.5;
export const HITCH_PULL_ACCEL = 2;

interface HitchState {
  /** The body held on the last tick. */
  thing: EntityId | null;
  /** Every body that goes with it (a cage: its blocks, the floor plate first). */
  ids: EntityId[];
  /** The carrier that holds it. */
  carrier: EntityId | null;
  /** Where the body is asked to sit against the carrier now, in the carrier's own frame (see `WorldApi.hitch`). */
  offset: Vec3;
  /** How high the body stood against the carrier when it was taken (m). */
  restY: number;
  /** Speed (m/s) the body is being drawn into its place at. */
  pull: number;
}

/** The heading of a carrier as the world reads it: (ahead x, ahead z) on the ground plane. */
function aheadOf(c: EntityView, mode: ViewMode): { x: number; z: number } {
  if (mode === '2d-side') return { x: c.facing && c.facing.x < 0 ? -1 : 1, z: 0 };
  const heading = c.robot?.heading ?? c.vehicle?.heading;
  if (heading !== undefined) return { x: Math.cos(heading), z: Math.sin(heading) };
  const len = c.facing ? Math.hypot(c.facing.x, c.facing.z) : 0;
  return c.facing && len > 1e-9 ? { x: c.facing.x / len, z: c.facing.z / len } : { x: 1, z: 0 };
}

/** Where `body` sits against `carrier` now: metres ahead, above and to the right of the carrier's middle. */
function offsetNow(carrier: EntityView, body: EntityView, mode: ViewMode): Vec3 {
  const f = aheadOf(carrier, mode);
  const dx = body.position.x - carrier.position.x;
  const dz = mode === '2d-side' ? 0 : body.position.z - carrier.position.z;
  return { x: dx * f.x + dz * f.z, y: body.position.y - carrier.position.y, z: dz * f.x - dx * f.z };
}

interface Candidate {
  lead: EntityView;
  ids: EntityId[];
  far: number;
}

/** The free bodies of the wanted kind within reach of the carrier, the nearest first. */
function inReach(world: WorldApi, carrier: EntityView, what: HitchWhat, reach: number, mode: ViewMode): Candidate[] {
  const all = world.listEntities();
  const cages = all.filter((e) => e.kind === 'block' && e.visible && e.look === CONTAINER_LOOK && containerOfLabel(e.label) !== null);
  const out: Candidate[] = [];
  const consider = (e: EntityView, ids: () => EntityId[]): void => {
    const dx = e.position.x - carrier.position.x;
    const dz = mode === '2d-side' ? 0 : e.position.z - carrier.position.z;
    const far = Math.hypot(dx, dz);
    // Up and down, the room between the two bodies counts: a cage on the level above is out of reach.
    const gap = mode === '2d-top' ? 0 : Math.abs(e.position.y - carrier.position.y) - (e.size.y + carrier.size.y) / 2;
    if (far <= reach && gap <= reach) out.push({ lead: e, ids: ids(), far });
  };
  if (what !== 'item') for (const cage of cages) if (cage.id !== carrier.id) consider(cage, () => containerBlocks(world, cage.id));
  if (what !== 'container') {
    for (const e of all) {
      if (e.kind !== 'item' || !e.visible || e.id === carrier.id || e.inHand || e.carried) continue;
      // What lies in a cage belongs to the cage: it is not a loose thing to take.
      if (cages.some((cage) => insideContainer(e, cage, containerOfLabel(cage.label)!, mode))) continue;
      consider(e, () => [e.id]);
    }
  }
  return out.sort((a, b) => a.far - b.far);
}

/** Mass (kg) of the bodies and of everything that lies in or on them. */
function loadedMass(world: WorldApi, ids: readonly EntityId[]): number {
  let kg = 0;
  for (const id of ids) kg += (world.materialOf(id)?.massKg ?? 0) + world.massOn(id);
  return kg;
}

/**
 * A carrier takes hold of a body and carries it: the body follows the carrier's place and keeps its own heading. All the
 * moving is the world's (`WorldApi.hitch`); this piece picks what to take, draws it gently into its place and says what
 * it holds.
 */
export const hitchNode: NodeDef<HitchState> = {
  kind: 'hitch',
  label: 'Chốt gài',
  category: 'action',
  description:
    'Gài một vật vào xe để xe chở vật đó đi. Nối thân xe (thường là "Đối tượng" của Thân robot) vào "Xe". Khi "Gài" bật, chốt tìm vật còn tự do gần xe nhất trong "Tầm gài" và giữ lấy: Lồng chứa, đồ vật rời, hoặc cả hai tuỳ mục "Gài được". Vật được kéo nhẹ về đúng "Vị trí vật so với xe" (mặc định: nằm ngay giữa xe, dành cho xe chui gầm) rồi đi cùng xe từng nhịp. Vật chỉ đổi chỗ, không xoay theo xe: xe rẽ thì lồng vẫn giữ nguyên hướng, các thùng thật trong lồng đi theo lồng. "Gài" tắt thì chốt nhả: vật nằm lại đúng chỗ đang đứng. "Đang gài" bật suốt lúc giữ vật, "Vật đang gài" đưa ra vật đó (với lồng là tấm đáy), "Khi gài" và "Khi nhả" bật đúng một nhịp. Một vật đang bị chốt khác giữ thì không gài được nữa. Vật đang gài không đi xuyên khối rắn: nó chạm tường hay chạm lồng khác thì xe dừng lại cùng với nó. Bật công tắc "Vật lý thật" thì vật đang gài và mọi thứ nằm trong nó đè lên xe ("Khối lượng đang chở" của Thân robot tăng, xe tăng tốc chậm hơn); tắt thì xe vẫn gài, chở và nhả như vậy nhưng không bị đè nặng. Ở góc nhìn từ trên xuống, lồng chỉ là một ô vẽ trên nền nên không gài được; đồ vật rời vẫn gài được.',
  inputs: [
    { id: 'carrier', type: 'object', label: 'Xe', required: true },
    { id: 'on', type: 'bool', label: 'Gài' },
  ],
  outputs: [
    { id: 'holding', type: 'bool', label: 'Đang gài' },
    { id: 'thing', type: 'object', label: 'Vật đang gài' },
    { id: 'took', type: 'bool', label: 'Khi gài' },
    { id: 'released', type: 'bool', label: 'Khi nhả' },
  ],
  params: [
    { id: 'reach', label: 'Tầm gài (m, từ tâm xe tới tâm vật)', kind: 'number', default: HITCH_DEFAULT_REACH, min: 0.05, max: 10, step: 0.05 },
    {
      id: 'what',
      label: 'Gài được',
      kind: 'select',
      default: 'container',
      options: [
        { value: 'container', label: 'Lồng chứa' },
        { value: 'item', label: 'Đồ vật rời (không nằm trong lồng)' },
        { value: 'both', label: 'Cả hai' },
      ],
    },
    { id: 'offset', label: 'Vị trí vật so với xe (m: x = ra phía mũi xe, y = nâng lên, z = sang phải xe)', kind: 'vec3', default: DEFAULT_OFFSET },
    { id: 'maxMass', label: 'Nặng nhất gài được (kg, tính cả đồ bên trong; 0 = không giới hạn)', kind: 'number', default: 0, min: 0, max: 100000, step: 1, advanced: true },
  ],
  create: () => ({ thing: null, ids: [], carrier: null, offset: { ...DEFAULT_OFFSET }, restY: 0, pull: 0 }),
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    const owner = ctx.nodeId;
    const carrierId = asObject(i.carrier);
    const carrier = carrierId !== null ? world.getEntity(carrierId) : undefined;
    const want = asBool(i.on) && carrier !== undefined && carrier.visible;
    // The world ends a hold by itself when the carrier or the body is hidden.
    let held = world.hitched(owner);
    // Another carrier on the wire is a new hold: the old one ends first.
    if (held !== null && (!want || s.carrier !== carrierId)) {
      world.unhitch(owner);
      held = null;
    }
    const released = s.thing !== null && held === null;
    let took = false;
    if (want && held === null && !released) {
      const what = strParam(params, 'what', 'container') as HitchWhat;
      const reach = clamp(numParam(params, 'reach', HITCH_DEFAULT_REACH), 0, 10);
      const maxMass = Math.max(0, numParam(params, 'maxMass', 0));
      for (const c of inReach(world, carrier, HITCH_WHAT.includes(what) ? what : 'container', reach, ctx.mode)) {
        if (maxMass > 0 && loadedMass(world, c.ids) > maxMass) continue;
        // Taken where it stands: it is drawn into its place over the next ticks, never thrown there.
        const from = offsetNow(carrier, c.lead, ctx.mode);
        if (!world.hitch(owner, carrier.id, c.ids, from)) continue;
        held = c.lead.id;
        took = true;
        s.ids = c.ids;
        s.carrier = carrier.id;
        s.offset = from;
        s.restY = from.y;
        s.pull = 0;
        break;
      }
    } else if (want && held !== null) {
      const set = vec3Param(params, 'offset', DEFAULT_OFFSET);
      // Up and down the body keeps the height it stood at against the carrier when it was taken; "y" lifts it from there.
      const to = { x: set.x, y: s.restY + set.y, z: set.z };
      const dx = to.x - s.offset.x;
      const dy = to.y - s.offset.y;
      const dz = to.z - s.offset.z;
      const left = Math.hypot(dx, dy, dz);
      if (left > 1e-9) {
        s.pull = Math.min(s.pull + HITCH_PULL_ACCEL * ctx.dt, HITCH_PULL_SPEED, Math.sqrt(2 * HITCH_PULL_ACCEL * left));
        const step = s.pull * ctx.dt;
        s.offset = step >= left ? to : { x: s.offset.x + (dx / left) * step, y: s.offset.y + (dy / left) * step, z: s.offset.z + (dz / left) * step };
        if (step >= left) s.pull = 0;
        world.hitch(owner, carrier.id, s.ids, s.offset);
      }
    }
    s.thing = held;
    if (held === null) {
      s.ids = [];
      s.carrier = null;
    }
    return { holding: held !== null, thing: held, took, released };
  },
};
