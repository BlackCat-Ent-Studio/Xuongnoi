import * as THREE from 'three';
import type { EntityView } from '../engine/types';
import { deckSize, frameOfLabel, holeCentres, type DeckFrame } from '../nodes/raised-deck';
import { bakedMesh, box, rbox, sizeKey, type Part } from './factory-kit';

/**
 * A plate of a raised deck ("Sàn nâng có lỗ"): a flat steel plate exactly as big as its solid box. The first plate of a
 * deck also carries the trim of the whole deck, drawn only: a yellow band round every hole, a blue beam along the outer
 * edge and steel legs down to the ground. Colours and proportions follow the open-frame belt (blue rail, steel legs,
 * dark feet), so the two read as one factory.
 */

const STEEL = '#8f97a3';
const FOOT = '#23252b';
const YELLOW = '#ffc21a';
const BEAM_BLUE = '#2f7fe0';

/** Width of the yellow band round a hole and how far it stands above the floor (m). */
export const HOLE_BAND = 0.06;
const BAND_UP = 0.006;
/** The edge beam: how far it stands out from the edge and above the floor (m). */
export const EDGE_BEAM = 0.03;
const BEAM_UP = 0.012;
/** Legs: side of the square post, how far its middle sits inside the edge, and the widest gap between two legs (m). */
const LEG = 0.1;
const LEG_INSET = 0.12;
const LEG_SPAN = 3;
/** Thickness of the top layer of a plate, the only part that takes shadows (m). */
const SKIN = 0.004;
const TRIM_NAME = 'deck-trim';

/** Leg positions along one edge of length `side`: both ends, and enough between them to keep every gap under `LEG_SPAN`. */
function legStops(side: number): number[] {
  const run = Math.max(side - 2 * LEG_INSET, 0);
  const gaps = Math.max(1, Math.ceil(run / LEG_SPAN));
  return Array.from({ length: gaps + 1 }, (_, i) => -run / 2 + (run * i) / gaps);
}

/** Where the legs of a deck stand, measured from its middle: all round the outer edge, none under the floor itself. */
export function deckLegSpots(f: DeckFrame): { x: number; z: number }[] {
  const size = deckSize(f);
  const xs = legStops(size.x);
  const zs = legStops(size.z);
  const out: { x: number; z: number }[] = [];
  for (const x of xs) for (const z of [zs[0]!, zs[zs.length - 1]!]) out.push({ x, z });
  for (const z of zs.slice(1, -1)) for (const x of [xs[0]!, xs[xs.length - 1]!]) out.push({ x, z });
  return out;
}

/** The trim of a deck around its middle, with y = 0 on the top of the floor. */
function frameParts(f: DeckFrame): Part[] {
  const size = deckSize(f);
  const parts: Part[] = [];
  const reach = f.hole / 2 + HOLE_BAND / 2;
  for (const x of holeCentres(f.cols, f.pitch)) {
    for (const z of holeCentres(f.rows, f.pitch)) {
      for (const s of [-1, 1]) {
        parts.push({ geo: box(f.hole + 2 * HOLE_BAND, BAND_UP, HOLE_BAND), color: YELLOW, at: [x, BAND_UP / 2, z + s * reach] });
        parts.push({ geo: box(HOLE_BAND, BAND_UP, f.hole), color: YELLOW, at: [x + s * reach, BAND_UP / 2, z] });
      }
    }
  }
  const beamH = f.thickness + BEAM_UP + 0.01;
  const beamY = BEAM_UP - beamH / 2;
  for (const s of [-1, 1]) {
    parts.push({ geo: rbox(size.x + 2 * EDGE_BEAM, beamH, EDGE_BEAM, 0.008), color: BEAM_BLUE, at: [0, beamY, s * (size.z / 2 + EDGE_BEAM / 2)] });
    parts.push({ geo: rbox(EDGE_BEAM, beamH, size.z + 2 * EDGE_BEAM, 0.008), color: BEAM_BLUE, at: [s * (size.x / 2 + EDGE_BEAM / 2), beamY, 0] });
  }
  if (f.legs > 0.05) {
    for (const { x, z } of deckLegSpots(f)) {
      parts.push({ geo: rbox(LEG, f.legs, LEG, 0.012), color: STEEL, at: [x, -f.thickness - f.legs / 2, z] });
      parts.push({ geo: rbox(LEG * 2, 0.03, LEG * 2, 0.01), color: FOOT, at: [x, -f.thickness - f.legs + 0.015, z] });
    }
  }
  return parts;
}

const hexOf = (color: string): string => `#${new THREE.Color(color).getHexString()}`;

export class RaisedDeckFigure {
  readonly object = new THREE.Group();
  private key = '';

  constructor(view: EntityView) {
    this.update(view);
  }

  private build(view: EntityView, color: string): void {
    this.object.clear();
    const size = view.size;
    // Only the walked-on face takes shadows: the underside and the sides face away from the sun and stay evenly dark.
    const skin = Math.min(SKIN, size.y / 2);
    const top = bakedMesh(`deck-skin|${sizeKey({ x: size.x, y: skin, z: size.z })}|${color}`, () => [{ geo: box(size.x, skin, size.z), color }], undefined, true);
    top.position.y = size.y / 2 - skin / 2;
    const body = bakedMesh(`deck-body|${sizeKey({ x: size.x, y: size.y - skin, z: size.z })}|${color}`, () => [{ geo: box(size.x, size.y - skin, size.z), color }]);
    body.position.y = -skin / 2;
    this.object.add(top, body);
    const frame = frameOfLabel(view.label);
    if (frame) {
      // The first plate is the strip before the first row of holes: the middle of the deck lies half a deck further along z.
      const trim = bakedMesh(`deck-frame|${view.label}`, () => frameParts(frame));
      trim.position.set(0, size.y / 2, deckSize(frame).z / 2 - size.z / 2);
      trim.name = TRIM_NAME;
      this.object.add(trim);
    }
    this.object.traverse((o) => {
      o.userData.ownerNodeId = view.ownerNodeId;
    });
  }

  update(view: EntityView): void {
    const color = hexOf(view.color);
    const key = `${sizeKey(view.size)}|${color}|${view.label ?? ''}`;
    if (key !== this.key) {
      this.key = key;
      this.build(view, color);
    }
    this.object.position.set(view.position.x, view.position.y, view.position.z);
  }

  /** True for the one plate of a deck that also draws the trim and the legs. */
  get hasTrim(): boolean {
    return this.object.getObjectByName(TRIM_NAME) !== undefined;
  }

  /** The baked shapes are shared by every deck of the same size and stay for the life of the page. */
  dispose(): void {
    this.object.clear();
  }
}
