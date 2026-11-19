import type { PortType } from '../../engine/types';
import type { Box } from './graph-geometry';

/**
 * Where the value badge of a running wire goes. The badge used to sit at the middle of its wire whatever was there; a wire
 * that runs behind a card (back to an earlier card, or under its own card) then put its badge on that card's port names and
 * value pills. Here the badge slides along its wire to the nearest place to the middle that is clear of every card and of
 * the badges already placed.
 */

interface Point {
  x: number;
  y: number;
}

/** Air kept between a badge and a card or another badge (px, board units). */
const GAP = 4;
const HEIGHT = 24;
/** Places tried along the wire, as fractions of its length: the middle first, then further out to both sides in turn. */
const TRIES: readonly number[] = (() => {
  const out = [0.5];
  for (let d = 0.04; d <= 0.44 + 1e-9; d += 0.04) out.push(0.5 - d, 0.5 + d);
  return out;
})();

/** Room a badge takes: an object badge shows a name ("Thân robot"), the others a short number or Đúng / Sai. */
export function badgeSize(type: PortType): { w: number; h: number } {
  return { w: type === 'object' ? 100 : 60, h: HEIGHT };
}

const boxAround = (p: Point, size: { w: number; h: number }): Box => ({ x: p.x - size.w / 2, y: p.y - size.h / 2, w: size.w, h: size.h });
const touches = (a: Box, b: Box): boolean => a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;

/**
 * The centre for a badge of `size` on a wire. `pointAt(f)` gives the point at fraction `f` (0..1) of the wire's length.
 * Returns the place nearest the middle whose box touches none of `cards` and none of `taken` (boxes of badges placed
 * before), and adds its box to `taken`. Null when the wire has no such place: the badge is then left out rather than drawn
 * over a name (number values still show in the pills at both ends of the wire).
 */
export function placeBadge(pointAt: (fraction: number) => Point, size: { w: number; h: number }, cards: readonly Box[], taken: Box[]): Point | null {
  for (const f of TRIES) {
    const p = pointAt(f);
    const box = boxAround(p, size);
    if (cards.some((c) => touches(box, c)) || taken.some((t) => touches(box, t))) continue;
    taken.push(box);
    return p;
  }
  return null;
}
