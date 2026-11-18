import type { Vec3, ViewMode } from '../engine/types';
import { dirOf, lateralOf, localToWorld, normalOf, type Frame } from './arm-kinematics';
import { obbBounds, obbOf, quatFromAxes, rotateBy, type Quat } from './oriented-box';

/**
 * The solid body of a gripper (pure maths, no world access): a palm and two fingers, each a box that turns with the hand.
 * The world's solid blocks are axis-aligned, so every box is covered by a row of slices and each slice by its upright bounds
 * (the same cubes a link is built from, see `arm-solid`). A hand standing square to the axes is covered exactly; a tilted one
 * is covered from outside, so a crate is never inside the drawn box (the cover is a few millimetres to centimetres fatter).
 */

/** Palm depth along the arm and finger length (m): the grasp point is the middle of the fingers. */
export const PALM = 0.15;
export const FINGER_LEN = 0.3;
export const FINGER_T = 0.12;
export const GRASP_AT = PALM + FINGER_LEN / 2;
/** Height of the palm block (m), across the closing direction in the side view and up from the arm elsewhere. */
export const PALM_THICK = 0.25;
/** The palm is cut into slices about this wide (m); a finger into `FINGER_SLICES`. */
const PALM_SLICE = 0.25;
export const FINGER_SLICES = 3;

/** One drawn box of the hand, in world space. `size` is along the hand's own axes (x along the arm, y up from it, z sideways). */
export interface HandPart {
  part: 'palm' | 'finger';
  centre: Vec3;
  size: Vec3;
  turn: Quat;
  /** Local axis the cover slices follow, and how many slices there are. */
  along: 'x' | 'y' | 'z';
  slices: number;
}

/** Palm size in the hand's own axes for an opening `width` (m). */
export function palmSizeOf(mode: ViewMode, width: number): Vec3 {
  const span = width + 2 * FINGER_T;
  return mode === '2d-side' ? { x: PALM, y: span, z: PALM_THICK } : { x: PALM, y: PALM_THICK, z: span };
}

/** The turn of the hand: its x axis along the arm, y up from the arm, z sideways. */
export function handTurn(f: Frame): Quat {
  return quatFromAxes(dirOf(f), normalOf(f), lateralOf(f));
}

/** Number of cover cubes a hand with this opening is made of: the palm's slices, then `FINGER_SLICES` for each finger. */
export function handCubeCount(mode: ViewMode, width: number): number {
  return palmSlicesOf(mode, width) + 2 * FINGER_SLICES;
}

function palmSlicesOf(mode: ViewMode, width: number): number {
  const s = palmSizeOf(mode, width);
  return Math.max(1, Math.ceil((mode === '2d-side' ? s.y : s.z) / PALM_SLICE - 1e-9));
}

/**
 * The three boxes of a hand whose wrist frame is `base`. `pads` is where each finger's middle sits along the closing axis
 * (the arm's normal in the side view, sideways elsewhere), measured from the grasp point: +x for finger 1, then finger 2.
 */
export function handBoxes(base: Frame, mode: ViewMode, width: number, pads: readonly [number, number]): HandPart[] {
  const turn = handTurn(base);
  const axis = mode === '2d-side' ? normalOf(base) : lateralOf(base);
  const grasp = localToWorld(base, { x: GRASP_AT, y: 0, z: 0 });
  const palmAlong = mode === '2d-side' ? 'y' : 'z';
  const out: HandPart[] = [
    { part: 'palm', centre: localToWorld(base, { x: PALM / 2, y: 0, z: 0 }), size: palmSizeOf(mode, width), turn, along: palmAlong, slices: palmSlicesOf(mode, width) },
  ];
  for (const k of pads) {
    out.push({
      part: 'finger',
      centre: { x: grasp.x + axis.x * k, y: grasp.y + axis.y * k, z: grasp.z + axis.z * k },
      size: { x: FINGER_LEN, y: FINGER_T, z: FINGER_T },
      turn,
      along: 'x',
      slices: FINGER_SLICES,
    });
  }
  return out;
}

/** The upright cubes that cover one box: its slices along `along`, each as the bounds of that slice's real outline. */
export function coverCubes(b: HandPart): { pos: Vec3; size: Vec3 }[] {
  const full = b.size[b.along];
  const cut = full / b.slices;
  const local: Vec3 = { x: 0, y: 0, z: 0 };
  const sliceSize: Vec3 = { ...b.size, [b.along]: cut };
  const out: { pos: Vec3; size: Vec3 }[] = [];
  for (let k = 0; k < b.slices; k++) {
    local[b.along] = -full / 2 + cut * (k + 0.5);
    const at = rotateBy(b.turn, local);
    out.push(obbBounds(obbOf({ x: b.centre.x + at.x, y: b.centre.y + at.y, z: b.centre.z + at.z }, sliceSize, b.turn)));
  }
  return out;
}

/** Every cover cube of the hand, palm first, then finger 1 and finger 2 (a fixed number and order for a given opening). */
export function handCubes(base: Frame, mode: ViewMode, width: number, pads: readonly [number, number]): { pos: Vec3; size: Vec3 }[] {
  return handBoxes(base, mode, width, pads).flatMap(coverCubes);
}
