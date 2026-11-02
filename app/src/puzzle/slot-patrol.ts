import type { EntityView, NodeDef, Vec3, WorldApi } from '../engine/types';
import { STILL, followPath, liveCharacter, planarDelta, unitToward, hasArrived, MIN_STOP_DISTANCE, type SteerMemo } from '../nodes/steering';
import { asBool, asObject, numParam } from '../nodes/util';
import { nextEmptySlot, readSlotParams, type SlotRect } from './store-slots';
import { handReach } from './world-options';

/**
 * "Đi tuần về kho": a delivery brain for the puzzle levels. Like the patrol it walks between two ends and says
 * "Vừa tới đầu mút" on reaching one, but the store end is not a fixed point: it is the approach point of the next
 * EMPTY slot of the store, parked so the crate in the robot's hands is right over that slot's middle. Level data
 * only; it is registered by the puzzle game and never appears in the editor.
 */

interface SlotPatrolState {
  heading: 'pickup' | 'store' | null;
  waitLeft: number;
  memo: SteerMemo;
}

/** How close (on the floor) the robot parks to its spot: the crate ends within this of the slot's middle. */
const PARK_DISTANCE = 0.03;
/** Half-size assumed for the crate while the hands are empty (the robot still walks to the store and back). */
const DEFAULT_CRATE = 0.35;

/** Where the robot must stand so a crate in its hands is over the middle of `slot`, walking in from `pickup`. */
export function parkingSpot(slot: SlotRect, pickup: Vec3, crateSize: Vec3, y: number): Vec3 {
  const dir = unitToward('3d', pickup, { x: slot.x, y, z: slot.z });
  if (!dir) return { x: slot.x, y, z: slot.z };
  const reach = handReach(crateSize);
  return { x: slot.x - dir.ux * reach, y, z: slot.z - dir.uz * reach };
}

function heldCrateSize(world: WorldApi, self: EntityView): Vec3 {
  const id = world.heldItem(self.id);
  const held = id !== null ? world.getEntity(id) : undefined;
  return held ? held.size : { x: DEFAULT_CRATE * 2, y: DEFAULT_CRATE * 2, z: DEFAULT_CRATE * 2 };
}

export const slotPatrolNode: NodeDef<SlotPatrolState> = {
  kind: 'slot-patrol',
  label: 'Đi tuần về kho',
  category: 'brain',
  description:
    'Bot đi qua đi lại giữa chỗ lấy thùng và kho. Ở kho, bot tự đi tới ô trống kế tiếp, quay mặt vào ô và dừng sao cho thùng nằm giữa ô. Kho đầy thì bot đứng yên.',
  modes: ['3d'],
  inputs: [
    { id: 'self', type: 'object', label: 'Bot', required: true },
    { id: 'on', type: 'bool', label: 'Hoạt động', default: true },
  ],
  outputs: [
    { id: 'moveX', type: 'number', label: 'Đi ngang' },
    { id: 'moveY', type: 'number', label: 'Đi dọc' },
    { id: 'atEnd', type: 'bool', label: 'Vừa tới đầu' },
    { id: 'atStore', type: 'bool', label: 'Vừa tới ô kho' },
  ],
  params: [
    { id: 'pickup', label: 'Chỗ lấy thùng', kind: 'vec3', default: { x: 0, y: 0.5, z: 0 } },
    { id: 'slotFirst', label: 'Ô kho đầu tiên', kind: 'vec3', default: { x: 0, y: 0.5, z: 0 } },
    { id: 'slotStep', label: 'Từ ô này sang ô kế', kind: 'vec3', default: { x: 1.8, y: 0, z: 0 } },
    { id: 'slotCount', label: 'Số ô kho', kind: 'number', default: 1, min: 1, max: 12, step: 1 },
    { id: 'wait', label: 'Chờ ở mỗi đầu (giây)', kind: 'number', default: 0.5, min: 0, max: 30, step: 0.5 },
  ],
  create: () => ({ heading: null, waitLeft: 0, memo: {} }),
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    const still = { ...STILL, atEnd: false, atStore: false };
    const self = liveCharacter(world, asObject(i.self));
    const on = i.on === undefined ? true : asBool(i.on);
    if (!self || !on) return still;

    const { pickup, slots } = readSlotParams(params);
    const items = world.listEntities().filter((e) => e.kind === 'item');
    const slot = nextEmptySlot(slots, items);
    // The store end: the next empty slot's parking spot (for the first look, where the first slot would be).
    const storeGoal = parkingSpot(slot ?? slots[0] ?? { x: pickup.x, z: pickup.z, size: 0 }, pickup, heldCrateSize(world, self), pickup.y);

    if (s.heading === null) {
      s.heading = planarGap(world, self.position, pickup) >= planarGap(world, self.position, storeGoal) ? 'pickup' : 'store';
    }
    if (s.waitLeft > 0) {
      s.waitLeft = Math.max(0, s.waitLeft - ctx.dt);
      return still;
    }
    // A full store means there is nowhere left to set a crate down: the robot stays where it is.
    if (s.heading === 'store' && slot === null) return still;

    const turn = (): void => {
      s.heading = s.heading === 'pickup' ? 'store' : 'pickup';
      s.waitLeft = Math.max(0, numParam(params, 'wait', 0.5));
    };
    const goal = s.heading === 'pickup' ? pickup : storeGoal;
    const arrived = s.heading === 'pickup' ? hasArrived(world.mode, self.position, goal, MIN_STOP_DISTANCE) : planarGap(world, self.position, goal) <= PARK_DISTANCE;
    if (arrived) {
      turn();
      return { ...still, atEnd: true, atStore: s.heading === 'pickup' };
    }
    const steer = followPath({ world, self, goal, dt: ctx.dt, memo: s.memo, straight: true });
    return { moveX: steer.moveX, moveY: steer.moveY, atEnd: false, atStore: false };
  },
};

function planarGap(world: WorldApi, a: Vec3, b: Vec3): number {
  const d = planarDelta(world.mode, a, b);
  return Math.hypot(d.x, d.z);
}
