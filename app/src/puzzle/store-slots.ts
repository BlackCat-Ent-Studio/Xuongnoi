import type { EntityView, GraphNode, Vec3 } from '../engine/types';
import { unitToward } from '../nodes/steering';
import { handReach } from './world-options';

/**
 * Store slots: the marked places on a store pad where delivered crates are set down, one crate per slot.
 * The level data holds one definition; the floor marks (blocks) and the delivering robot's route (the brain's
 * params) are both made from it, so what is drawn is exactly where the robot sets crates down.
 */

/** Colour that tells the stage a flat block is a slot mark. */
export const SLOT_COLOR = '#f59e0b';
/** Side of one slot (a crate is 0.6-0.7, so it sits clear of the edge). */
export const SLOT_SIZE = 1.1;
/**
 * Centre-to-centre distance of neighbouring slots. Wide enough that the crate in the next slot is beyond the
 * hands' look-ahead, so the robot never lifts a crate over its neighbour: it just walks up and sets it down.
 */
export const SLOT_STEP = 1.8;

export interface StoreSlotsDef {
  /** Where the robot picks crates up: the far end of its walk (the slots are at the other end). */
  pickup: Vec3;
  /** Centre of the slot filled first (the one farthest from `pickup`). */
  first: { x: number; z: number };
  /** Offset from a slot to the next one to fill (points back toward `pickup`). */
  step: { x: number; z: number };
  count: number;
}

export interface SlotRect {
  x: number;
  z: number;
  size: number;
}

/** A crate counts as sitting in a slot when its middle is this much inside the slot's edge (slack for a drop in flight). */
const SLOT_SLACK = 0.25;

/** True when a loose crate (not carried) has its middle over the slot. */
export function slotIsTaken(slot: SlotRect, items: readonly EntityView[]): boolean {
  const reach = slot.size / 2 + SLOT_SLACK;
  return items.some(
    (it) => it.kind === 'item' && it.visible && !it.carried && !it.inHand && Math.abs(it.position.x - slot.x) <= reach && Math.abs(it.position.z - slot.z) <= reach,
  );
}

/** First slot (in filling order) with no crate over it, or null when the store is full. */
export function nextEmptySlot(slots: readonly SlotRect[], items: readonly EntityView[]): SlotRect | null {
  return slots.find((s) => !slotIsTaken(s, items)) ?? null;
}

/** Slot centres in filling order. */
export function slotCentres(def: Pick<StoreSlotsDef, 'first' | 'step' | 'count'>): { x: number; z: number }[] {
  return Array.from({ length: Math.max(0, Math.floor(def.count)) }, (_, i) => ({ x: def.first.x + def.step.x * i, z: def.first.z + def.step.z * i }));
}

export function slotRects(def: Pick<StoreSlotsDef, 'first' | 'step' | 'count'>): SlotRect[] {
  return slotCentres(def).map((c) => ({ ...c, size: SLOT_SIZE }));
}

/** Flat marks on the floor, one per slot. `cardPos` places each locked card on the wiring board. */
export function slotMarkNodes(def: StoreSlotsDef, cardPos: (i: number) => { x: number; y: number }): GraphNode[] {
  return slotCentres(def).map((c, i) => ({
    id: `slot-${i + 1}`,
    kind: 'block',
    params: { name: `Ô kho ${i + 1}`, position: { x: c.x, y: 0.03, z: c.z }, size: { x: SLOT_SIZE, y: 0.04, z: SLOT_SIZE }, color: SLOT_COLOR, type: 'pickup' },
    pos: cardPos(i),
  }));
}

/** Where the robot must stand so a crate in its hands is over the middle of `slot`, walking in from `pickup`. */
export function parkingSpot(slot: SlotRect, pickup: Vec3, crateSize: Vec3, y: number): Vec3 {
  const dir = unitToward('3d', pickup, { x: slot.x, y, z: slot.z });
  if (!dir) return { x: slot.x, y, z: slot.z };
  const reach = handReach(crateSize);
  return { x: slot.x - dir.ux * reach, y, z: slot.z - dir.uz * reach };
}
