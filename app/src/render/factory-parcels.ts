import * as THREE from 'three';
import { PARCEL_LOOK_PREFIX } from '../engine/factory-looks';
import type { EntityView, Vec3 } from '../engine/types';
import { VERTEX_TOON, bakedMesh, box, cyl, rbox, sizeKey, type Part } from './factory-kit';
import type { ItemFigure } from './item-shapes';
import { applyPlacement, clonePack, onPackLoaded, packTemplate, pickVariant, type Bounds3, type Placement } from './pack-models';

/**
 * Parcel looks of a loose item ("Kiểu kiện hàng"): a code-drawn carton, or one chosen model of the pack.
 *
 * Both are laid into the item's REAL box: the carton is built at that size, a pack model is stretched along each axis
 * until it fills it (its longer side turned along the box's longer side). So a parcel is seen resting on what really
 * carries it and touching the fingers that really hold it.
 *
 * The item's colour stays readable on every look, so a spawner that colours its classes can be read by eye:
 * - carton: the tape band is the item's colour;
 * - pack model: the model keeps its own painted colours (all pack models share one palette material, so a tint would
 *   turn them muddy); a round sticker in the item's colour, on a dark backing, sits on the top and on both ends.
 * A pack model shows the carton until it has loaded (and for good if it cannot load).
 */

const CARTON = '#cf9f62';
const STICKER_BACK = '#23252b';

const PARCEL_MODELS: Readonly<Record<string, string>> = {
  'parcel-1': 'Exteriors/City/City_14_Parcel_1.glb',
  'parcel-2': 'Exteriors/City/City_14_Parcel_2.glb',
  'parcel-3': 'Exteriors/City/City_14_Parcel_3.glb',
  'parcel-4': 'Exteriors/City/City_14_Parcel_4.glb',
  'parcel-5': 'Exteriors/City/City_14_Parcel_5.glb',
  'parcel-box': 'Exteriors/City/City_4_Box_1.glb',
};
const CARTON_LOOK = 'parcel-carton';
const MIX_LOOK = 'parcel-mix';

/** Whether an item's look is one of the parcel looks drawn here. */
export function isParcelLook(look: string | undefined): look is string {
  return look !== undefined && look.startsWith(PARCEL_LOOK_PREFIX) && (look === CARTON_LOOK || look === MIX_LOOK || look in PARCEL_MODELS);
}

/** The pack model a parcel look draws (null for the carton); the mix picks one per item, always the same for the same seed. */
export function parcelModelOf(look: string, seed: string): string | null {
  if (look === MIX_LOOK) return pickVariant(Object.values(PARCEL_MODELS), seed);
  return PARCEL_MODELS[look] ?? null;
}

const hexOf = (color: string): string => `#${new THREE.Color(color).getHexString()}`;

function cartonParts(size: Vec3, tape: string): Part[] {
  const r = Math.min(0.03, Math.max(0.008, Math.min(size.x, size.y, size.z) * 0.05));
  return [
    { geo: rbox(size.x, size.y, size.z, r), color: CARTON },
    { geo: box(size.x + 0.004, size.y + 0.004, size.z * 0.16), color: tape },
  ];
}

function stickerParts(size: Vec3, color: string): Part[] {
  const top = Math.min(size.x, size.z) * 0.2;
  const end = Math.min(size.y, size.z) * 0.2;
  const parts: Part[] = [
    { geo: cyl('y', top * 1.2, 0.004, 20), color: STICKER_BACK, at: [0, size.y / 2 + 0.002, 0] },
    { geo: cyl('y', top, 0.004, 20), color, at: [0, size.y / 2 + 0.005, 0] },
  ];
  for (const s of [-1, 1]) {
    parts.push({ geo: cyl('x', end * 1.2, 0.004, 20), color: STICKER_BACK, at: [s * (size.x / 2 + 0.002), 0, 0] });
    parts.push({ geo: cyl('x', end, 0.004, 20), color, at: [s * (size.x / 2 + 0.005), 0, 0] });
  }
  return parts;
}

/** Stretch that makes a model fill the box exactly, its longer horizontal side along the box's longer one. */
export function fillPlacement(bounds: Bounds3, size: Vec3): Placement {
  const sx = Math.max(bounds.max.x - bounds.min.x, 1e-6);
  const sy = Math.max(bounds.max.y - bounds.min.y, 1e-6);
  const sz = Math.max(bounds.max.z - bounds.min.z, 1e-6);
  const cx = (bounds.min.x + bounds.max.x) / 2;
  const cz = (bounds.min.z + bounds.max.z) / 2;
  const ky = size.y / sy;
  const y = -size.y / 2 - bounds.min.y * ky;
  if (sx >= sz === size.x >= size.z) {
    const kx = size.x / sx;
    const kz = size.z / sz;
    return { position: { x: -cx * kx, y, z: -cz * kz }, rotationY: 0, scale: { x: kx, y: ky, z: kz } };
  }
  // A quarter turn: the model's x runs along the box's z.
  const kx = size.z / sx;
  const kz = size.x / sz;
  return { position: { x: -cz * kz, y, z: cx * kx }, rotationY: Math.PI / 2, scale: { x: kx, y: ky, z: kz } };
}

/** The parcel figure of an item. Like every item figure it sits in the unit cube and the scene scales it to the item's size. */
export function buildParcel(look: string, color: string, seed = ''): ItemFigure {
  const object = new THREE.Group();
  // The scene stretches `object` to the item's size; `inner` undoes that, so everything below is in real units.
  const inner = new THREE.Group();
  object.add(inner);
  const path = parcelModelOf(look, seed);
  let tint = hexOf(color);
  let size: Vec3 | null = null;
  let laid = '';

  const layout = (): void => {
    if (!size) return;
    const template = path ? packTemplate(path) : null;
    const key = `${sizeKey(size)}|${tint}|${template ? 'model' : 'carton'}`;
    if (key === laid) return;
    laid = key;
    inner.clear();
    const s = size;
    const c = tint;
    if (template) {
      const copy = clonePack(template);
      applyPlacement(copy, fillPlacement(template.bounds, s));
      inner.add(copy);
      inner.add(bakedMesh(`parcel-sticker|${sizeKey(s)}|${c}`, () => stickerParts(s, c)));
    } else {
      inner.add(bakedMesh(`carton|${sizeKey(s)}|${c}`, () => cartonParts(s, c), VERTEX_TOON, true));
    }
    const owner: unknown = object.userData.ownerNodeId;
    inner.traverse((o) => {
      if (owner !== undefined) o.userData.ownerNodeId = owner;
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    inner.updateMatrixWorld(true);
  };
  const unsubscribe = path ? onPackLoaded(layout) : () => undefined;

  return {
    object,
    setColor(c) {
      tint = hexOf(c);
      layout();
    },
    update(view: Pick<EntityView, 'size'>) {
      const { x, y, z } = view.size;
      if (!size || size.x !== x || size.y !== y || size.z !== z) {
        size = { x, y, z };
        inner.scale.set(1 / Math.max(x, 1e-6), 1 / Math.max(y, 1e-6), 1 / Math.max(z, 1e-6));
      }
      layout();
    },
    dispose() {
      unsubscribe();
      inner.clear();
    },
  };
}
