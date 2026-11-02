import type { EntityView, NodeDef, Vec3, WorldApi } from '../engine/types';
import { STILL, followPath, liveCharacter, planarDelta, unitToward, hasArrived, MIN_STOP_DISTANCE, type SteerMemo } from '../nodes/steering';
import { asBool, asObject, numParam } from '../nodes/util';
import { parkingSpot } from './slot-patrol';
import { nextEmptySlot, readSlotParams, slotIsTaken, type SlotRect } from './store-slots';

/**
 * "Đi lấy thùng về kho": a delivery brain for crates scattered over the floor. The robot walks to the nearest crate
 * that is still loose and outside the store, stops just in front of it (facing it) and says "Vừa tới chỗ" so the
 * hands grab it; then it walks to the next EMPTY slot, parks so the crate is over the slot's middle and says it again
 * so the hands let go. It repeats until no crate is left outside the store or the store is full. What it does next is
 * always read from the world (hands full or empty), so a grab or drop that did not take is simply tried again.
 * Level data only; registered by the puzzle game and never shown in the editor.
 */

interface FetchStoreState {
  waitLeft: number;
  memo: SteerMemo;
  /** Which target the goal belongs to, and the goal itself (fixed for the whole leg so it cannot wobble). */
  leg: { key: string; goal: Vec3 } | null;
}

/** How far in front of a crate the robot stops: inside the hands' reach, clear of the robot's own box. */
const APPROACH_GAP = 0.85;
/** How close (on the floor) the robot parks to a slot: the crate ends within this of the slot's middle. */
const PARK_DISTANCE = 0.03;

function planarGap(world: WorldApi, a: Vec3, b: Vec3): number {
  const d = planarDelta(world.mode, a, b);
  return Math.hypot(d.x, d.z);
}

/** The loose crate nearest to `from` that is not already sitting in a slot, or null. */
export function nextCrateToFetch(world: WorldApi, from: Vec3, slots: readonly SlotRect[], items: readonly EntityView[]): EntityView | null {
  let best: EntityView | null = null;
  let bestGap = Infinity;
  for (const it of items) {
    if (!it.visible || it.carried || it.inHand) continue;
    if (slots.some((s) => slotIsTaken(s, [it]))) continue;
    const gap = planarGap(world, from, it.position);
    if (gap < bestGap - 1e-6 || (Math.abs(gap - bestGap) <= 1e-6 && best !== null && it.id < best.id)) {
      best = it;
      bestGap = gap;
    }
  }
  return best;
}

/** Where the robot stands to grab `crate` when it comes from `from`: in front of the crate, on the side it arrives from. */
export function approachSpot(crate: Vec3, from: Vec3, mode: WorldApi['mode'], y: number): Vec3 {
  const dir = unitToward(mode, from, crate);
  if (!dir) return { x: crate.x, y, z: crate.z };
  return { x: crate.x - dir.ux * APPROACH_GAP, y, z: crate.z - dir.uz * APPROACH_GAP };
}

export const fetchStoreNode: NodeDef<FetchStoreState> = {
  kind: 'fetch-store',
  label: 'Đi lấy thùng về kho',
  category: 'brain',
  description:
    'Bot lần lượt đi tới từng thùng còn nằm trên sàn, nhấc lên, mang tới ô kho trống kế tiếp và đặt vào giữa ô, rồi đi lấy thùng tiếp theo. Hết thùng hoặc kho đầy thì bot đứng yên.',
  modes: ['3d'],
  inputs: [
    { id: 'self', type: 'object', label: 'Bot', required: true },
    { id: 'on', type: 'bool', label: 'Hoạt động', default: true },
  ],
  outputs: [
    { id: 'moveX', type: 'number', label: 'Đi ngang' },
    { id: 'moveY', type: 'number', label: 'Đi dọc' },
    { id: 'atEnd', type: 'bool', label: 'Vừa tới chỗ (nhấc hoặc thả)' },
  ],
  params: [
    { id: 'slotFirst', label: 'Ô kho đầu tiên', kind: 'vec3', default: { x: 0, y: 0.5, z: 0 } },
    { id: 'slotStep', label: 'Từ ô này sang ô kế', kind: 'vec3', default: { x: 1.8, y: 0, z: 0 } },
    { id: 'slotCount', label: 'Số ô kho', kind: 'number', default: 1, min: 1, max: 12, step: 1 },
    { id: 'wait', label: 'Chờ sau mỗi lần nhấc/thả (giây)', kind: 'number', default: 0.5, min: 0, max: 30, step: 0.5 },
  ],
  create: () => ({ waitLeft: 0, memo: {}, leg: null }),
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    const still = { ...STILL, atEnd: false };
    const self = liveCharacter(world, asObject(i.self));
    const on = i.on === undefined ? true : asBool(i.on);
    if (!self || !on) return still;
    if (s.waitLeft > 0) {
      s.waitLeft = Math.max(0, s.waitLeft - ctx.dt);
      return still;
    }

    const { slots } = readSlotParams(params);
    const items = world.listEntities().filter((e) => e.kind === 'item');
    const heldId = world.heldItem(self.id);
    const held = heldId !== null ? world.getEntity(heldId) : undefined;

    let leg: { key: string; goal: Vec3 };
    let exact: boolean;
    if (held) {
      const slot = nextEmptySlot(slots, items);
      if (!slot) return still; // store full: nowhere left to set the crate down
      const key = `store:${slots.indexOf(slot)}`;
      leg = s.leg?.key === key ? s.leg : { key, goal: parkingSpot(slot, self.position, held.size, self.position.y) };
      exact = true;
    } else {
      const crate = nextCrateToFetch(world, self.position, slots, items);
      if (!crate) return still; // nothing left to bring
      const key = `crate:${crate.id}`;
      leg = s.leg?.key === key ? s.leg : { key, goal: approachSpot(crate.position, self.position, world.mode, self.position.y) };
      exact = false;
    }
    s.leg = leg;

    const arrived = exact ? planarGap(world, self.position, leg.goal) <= PARK_DISTANCE : hasArrived(world.mode, self.position, leg.goal, MIN_STOP_DISTANCE);
    if (arrived) {
      s.waitLeft = Math.max(0, numParam(params, 'wait', 0.5));
      s.leg = null;
      return { ...still, atEnd: true };
    }
    const steer = followPath({ world, self, goal: leg.goal, dt: ctx.dt, memo: s.memo, straight: true });
    return { moveX: steer.moveX, moveY: steer.moveY, atEnd: false };
  },
};
