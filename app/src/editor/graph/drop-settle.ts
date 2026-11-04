import { freeSpotNear } from '../../puzzle/ui/board-arrange';
import type { Box, Point } from './graph-geometry';

/** Room kept between a card that slid aside and its neighbours (world px). */
const GAP = 12;
/** Search grid of the slide (world px): fine enough that the card stops right next to what it overlapped. */
const STEP = 4;

const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Where a card ends up after it is dropped at `dropped`. On free space (or only touching an edge) it stays exactly
 * where it was dropped; when it lands on another card it slides to the nearest spot around the drop point where it
 * fits with a small gap. `taken` holds every other card.
 */
export function settleDrop(taken: readonly Box[], dropped: Box): Point {
  if (!taken.some((t) => overlaps(dropped, t))) return { x: dropped.x, y: dropped.y };
  return freeSpotNear(taken, { w: dropped.w, h: dropped.h }, { x: dropped.x + dropped.w / 2, y: dropped.y + dropped.h / 2 }, null, GAP, STEP);
}
