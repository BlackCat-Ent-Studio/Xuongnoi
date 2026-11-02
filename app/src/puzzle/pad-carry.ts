import type { NodeDef, PortValues } from '../engine/types';
import { carryNode } from '../nodes/carry';
import { asObject } from '../nodes/util';

/**
 * "Khiêng đồ" for a level where the bot only takes a crate while it stands still at a pad: exactly the normal carry
 * node, except that with empty hands the "Nhấc lên" signal counts only on a tick when the character did not move
 * since the tick before. A grab signal that is true while walking is held back until the character stops, so the
 * crate is lifted in front of the robot instead of flying to it. With full hands the signal passes untouched (in
 * toggle mode it still lets go), so a wiring that forgets to check "Đang khiêng" still drops the crate it carries. Level data only; registered by the puzzle game and never shown in the editor.
 */

interface PadCarryState {
  inner: unknown;
  prev: { x: number; z: number } | null;
}

/** Planar distance per tick below which the character counts as standing still (0.6 units/s at 60 ticks/s). */
const STILL_STEP = 0.01;

export const PAD_CARRY_KIND = 'pad-carry';

/** Built on demand so it copies the carry node as it is named once all nodes are registered. */
export function makePadCarryNode(): NodeDef<PadCarryState> {
  const base = carryNode as NodeDef<unknown>;
  return {
    ...base,
    kind: PAD_CARRY_KIND,
    create: (ctx, params) => ({ inner: base.create?.(ctx, params), prev: null }),
    evaluate(ctx, i, params, s): PortValues {
      const id = asObject(i.character);
      const self = id !== null ? ctx.world.getEntity(id) : undefined;
      let still = false;
      if (self) {
        const pos = { x: self.position.x, z: self.position.z };
        still = s.prev !== null && Math.hypot(pos.x - s.prev.x, pos.z - s.prev.z) < STILL_STEP;
        s.prev = pos;
      }
      return base.evaluate(ctx, { ...i, grab: i.grab === true && (still || (id !== null && ctx.world.heldItem(id) !== null)) }, params, s.inner);
    },
  };
}
