import type { EntityView, NodeDef, Vec3, WorldApi } from '../engine/types';
import { STILL, followPath, liveCharacter, planarDelta, unitToward, moveForDirection, hasArrived, MIN_STOP_DISTANCE, type SteerMemo } from '../nodes/steering';
import { asBool, asObject, numParam } from '../nodes/util';
import { parkingSpot } from './slot-patrol';
import { nextEmptySlot, readSlotParams, slotIsTaken, type SlotRect } from './store-slots';

/**
 * "Đi tuần dọc hàng thùng": a delivery brain for a row of crates that wait beside the walking line. The robot walks
 * the row outward from the store and stands still for a moment at EVERY pad that still has a crate (the player's
 * wiring decides whether the hands take it). The moment the hands hold a crate it heads straight for the next EMPTY
 * store slot (same parking as 'slot-patrol') and says "Vừa tới ô kho" so the hands let go; then it walks out again
 * to the next pad past the one it last stood at. Pads it has already passed are not visited again, so a crate the
 * player chose to leave is left alone. Level data only; registered by the puzzle game and never shown in the editor.
 */

interface PadPatrolState {
  waitLeft: number;
  memo: SteerMemo;
  /** The pad (x of its crate) the robot last stopped at; the next stop is a crate farther out than this. */
  passed: number;
  /** True while the robot stands at a pad waiting out the stop. */
  atPad: boolean;
  /** Which target the current goal belongs to, and the goal itself (fixed for the whole leg so it cannot wobble). */
  leg: { key: string; goal: Vec3 } | null;
}

/** How close (on the floor) the robot parks to a slot: the crate ends within this of the slot's middle. */
const PARK_DISTANCE = 0.03;
/** Margin so the crate the robot just stood at does not count as "farther out". */
const PAD_SLACK = 0.5;
/** Stick push, for the one tick the robot reaches a pad, that turns it toward the crate without moving it (the crate is right there). */
const TURN_PUSH = 0.02;

function planarGap(world: WorldApi, a: Vec3, b: Vec3): number {
  const d = planarDelta(world.mode, a, b);
  return Math.hypot(d.x, d.z);
}

/** The loose crate outside the store, past the last pad visited, that is closest to the store along the row. */
function nextPadCrate(items: readonly EntityView[], slots: readonly SlotRect[], passed: number): EntityView | null {
  let best: EntityView | null = null;
  for (const it of items) {
    if (!it.visible || it.carried || it.inHand) continue;
    if (slots.some((s) => slotIsTaken(s, [it]))) continue;
    if (it.position.x <= passed + PAD_SLACK) continue;
    if (best === null || it.position.x < best.position.x - 1e-6 || (Math.abs(it.position.x - best.position.x) <= 1e-6 && it.id < best.id)) best = it;
  }
  return best;
}

export const padPatrolNode: NodeDef<PadPatrolState> = {
  kind: 'pad-patrol',
  label: 'Đi tuần dọc hàng thùng',
  category: 'brain',
  description:
    'Bot đi dọc hàng thùng từ kho ra ngoài, dừng lại ở mỗi ô còn thùng. Khi tay đã cầm thùng, bot đi thẳng về ô kho trống kế tiếp, thả thùng rồi lại đi ra ô kế tiếp. Hết thùng thì bot đứng yên.',
  modes: ['3d'],
  inputs: [
    { id: 'self', type: 'object', label: 'Bot', required: true },
    { id: 'on', type: 'bool', label: 'Hoạt động', default: true },
  ],
  outputs: [
    { id: 'moveX', type: 'number', label: 'Đi ngang' },
    { id: 'moveY', type: 'number', label: 'Đi dọc' },
    { id: 'atStore', type: 'bool', label: 'Vừa tới ô kho' },
  ],
  params: [
    { id: 'pickup', label: 'Đường đi của bot (đầu ngoài)', kind: 'vec3', default: { x: 0, y: 0.5, z: 0 } },
    { id: 'slotFirst', label: 'Ô kho đầu tiên', kind: 'vec3', default: { x: 0, y: 0.5, z: 0 } },
    { id: 'slotStep', label: 'Từ ô này sang ô kế', kind: 'vec3', default: { x: 1.8, y: 0, z: 0 } },
    { id: 'slotCount', label: 'Số ô kho', kind: 'number', default: 1, min: 1, max: 12, step: 1 },
    { id: 'wait', label: 'Dừng ở mỗi ô (giây)', kind: 'number', default: 0.5, min: 0, max: 30, step: 0.5 },
  ],
  create: () => ({ waitLeft: 0, memo: {}, passed: -Infinity, atPad: false, leg: null }),
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    const still = { ...STILL, atStore: false };
    const self = liveCharacter(world, asObject(i.self));
    const on = i.on === undefined ? true : asBool(i.on);
    if (!self || !on) return still;

    const wait = Math.max(0, numParam(params, 'wait', 0.5));
    const { pickup, slots } = readSlotParams(params);
    const items = world.listEntities().filter((e) => e.kind === 'item');
    const heldId = world.heldItem(self.id);
    const held = heldId !== null ? world.getEntity(heldId) : undefined;

    if (held) {
      // Hands full: straight to the next empty slot, whatever else was going on.
      s.atPad = false;
      const slot = nextEmptySlot(slots, items);
      if (!slot) return still; // store full: nowhere left to set the crate down
      if (s.waitLeft > 0) {
        s.waitLeft = Math.max(0, s.waitLeft - ctx.dt);
        return still;
      }
      const key = `store:${slots.indexOf(slot)}`;
      const leg = s.leg?.key === key ? s.leg : { key, goal: parkingSpot(slot, pickup, held.size, pickup.y) };
      s.leg = leg;
      if (planarGap(world, self.position, leg.goal) <= PARK_DISTANCE) {
        s.waitLeft = wait;
        s.leg = null;
        return { ...still, atStore: true };
      }
      const steer = followPath({ world, self, goal: leg.goal, dt: ctx.dt, memo: s.memo, straight: true });
      return { moveX: steer.moveX, moveY: steer.moveY, atStore: false };
    }

    // Hands empty: wait out a stop at a pad (the hands may take the crate meanwhile) or a pause after letting go.
    if (s.waitLeft > 0) {
      s.waitLeft = Math.max(0, s.waitLeft - ctx.dt);
      return still;
    }
    s.atPad = false;

    const crate = nextPadCrate(items, slots, s.passed);
    if (!crate) return still; // nothing left to bring
    const key = `crate:${crate.id}`;
    // The robot keeps to its own line (the row's z) and stops level with the crate.
    const leg = s.leg?.key === key ? s.leg : { key, goal: { x: crate.position.x, y: self.position.y, z: pickup.z } };
    s.leg = leg;
    if (hasArrived(world.mode, self.position, leg.goal, MIN_STOP_DISTANCE)) {
      s.passed = crate.position.x;
      s.atPad = true;
      s.waitLeft = wait;
      s.leg = null;
      const toCrate = unitToward(world.mode, self.position, crate.position);
      const turn = toCrate ? moveForDirection(world.mode, world.cameraYaw(), toCrate.ux, toCrate.uz, TURN_PUSH) : STILL;
      return { moveX: turn.moveX, moveY: turn.moveY, atStore: false };
    }
    const steer = followPath({ world, self, goal: leg.goal, dt: ctx.dt, memo: s.memo, straight: true });
    return { moveX: steer.moveX, moveY: steer.moveY, atStore: false };
  },
};
