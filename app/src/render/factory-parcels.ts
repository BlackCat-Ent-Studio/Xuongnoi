import * as THREE from 'three';
import { PARCEL_LOOK_PREFIX } from '../engine/factory-looks';
import { codeNeedsUnderline, splitLookCode } from '../engine/parcel-code';
import type { EntityView, Vec3 } from '../engine/types';
import { VERTEX_TOON, bakedMesh, box, canvasTexture, cyl, rbox, sizeKey, type Part } from './factory-kit';
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
 *
 * A carton whose look carries a code (`parcel-carton#7`) prints that number on a white tile on its top and on its two
 * long sides; the tape keeps the item's colour. A carton without a code is drawn exactly as before. A carton that also
 * shows its "N kg" tag (see load-tag.ts: front and back faces) carries the side numbers on its two end faces instead, so
 * neither covers the other.
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

/** Whether an item's look is one of the parcel looks drawn here (a carton may carry its code after a `#`). */
export function isParcelLook(look: string | undefined): look is string {
  if (look === undefined || !look.startsWith(PARCEL_LOOK_PREFIX)) return false;
  const plain = splitLookCode(look).look;
  return plain === CARTON_LOOK || plain === MIX_LOOK || plain in PARCEL_MODELS;
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

const INK = '#23252b';
const codeMats = new Map<number, THREE.MeshBasicMaterial | null>();
/**
 * The printed code: a white tile with a dark rim and a bold number, unlit so it stays white in any light. A number that
 * reads as another one upside down (6 and 9, 18 and 81) gets a line under it. Null where there is no canvas.
 */
function codeMaterial(code: number): THREE.MeshBasicMaterial | null {
  if (codeMats.has(code)) return codeMats.get(code) ?? null;
  const tex = canvasTexture(`parcel-code|${code}`, 256, 256, (g, W, H) => {
    g.fillStyle = INK;
    g.beginPath();
    g.roundRect(4, 4, W - 8, H - 8, 52);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.roundRect(20, 20, W - 40, H - 40, 38);
    g.fill();
    g.fillStyle = INK;
    const text = String(code);
    let px = 188;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 ${px}px "Segoe UI",Arial,sans-serif`;
    const wide = g.measureText(text).width;
    if (wide > 176) {
      px = (px * 176) / wide;
      g.font = `800 ${px}px "Segoe UI",Arial,sans-serif`;
    }
    g.fillText(text, W / 2, H * 0.5);
    if (codeNeedsUnderline(code)) {
      const line = Math.min(176, Math.max(92, wide * 0.9));
      g.fillRect(W / 2 - line / 2, H - 52, line, 14);
    }
  });
  const mat = tex ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) : null;
  codeMats.set(code, mat);
  return mat;
}

const tiles = new Map<string, THREE.PlaneGeometry>();
function tileGeo(side: number): THREE.PlaneGeometry {
  const key = side.toFixed(4);
  let g = tiles.get(key);
  if (!g) {
    g = new THREE.PlaneGeometry(side, side);
    tiles.set(key, g);
  }
  return g;
}

/**
 * Where the code tiles of a carton sit: one on the top, one on each of the two long sides (the faces across the shorter
 * side). `frontTaken`: the front and back faces already show the mass tag, so the side tiles go on the other two faces.
 */
export function codeTilePlaces(size: Vec3, frontTaken = false): { side: number; at: [number, number, number]; turn: [number, number, number] }[] {
  const top = Math.min(size.x, size.z) * 0.71;
  const alongX = size.x >= size.z && !frontTaken;
  const flank = Math.min(alongX ? size.x : size.z, size.y) * 0.69;
  const out = alongX ? size.z / 2 + 0.003 : size.x / 2 + 0.003;
  return [
    { side: top, at: [0, size.y / 2 + 0.005, 0], turn: [-Math.PI / 2, 0, 0] },
    ...[1, -1].map((s): { side: number; at: [number, number, number]; turn: [number, number, number] } =>
      alongX ? { side: flank, at: [0, 0, s * out], turn: [0, s > 0 ? 0 : Math.PI, 0] } : { side: flank, at: [s * out, 0, 0], turn: [0, (s * Math.PI) / 2, 0] },
    ),
  ];
}

/** The code tiles of a carton; an empty list where pictures cannot be drawn. */
function codeTiles(size: Vec3, code: number, frontTaken: boolean): THREE.Mesh[] {
  const mat = codeMaterial(code);
  if (!mat) return [];
  return codeTilePlaces(size, frontTaken).map((p) => {
    const tile = new THREE.Mesh(tileGeo(p.side), mat);
    tile.position.set(...p.at);
    tile.rotation.set(...p.turn);
    tile.userData.parcelCode = code;
    return tile;
  });
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
  const { look: plain, code } = splitLookCode(look);
  const path = parcelModelOf(plain, seed);
  let tint = hexOf(color);
  let size: Vec3 | null = null;
  let massTag = false;
  let laid = '';

  const layout = (): void => {
    if (!size) return;
    const template = path ? packTemplate(path) : null;
    const key = `${sizeKey(size)}|${tint}|${template ? 'model' : 'carton'}|${massTag ? 'kg' : ''}`;
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
      if (code > 0) for (const tile of codeTiles(s, code, massTag)) inner.add(tile);
    }
    const owner: unknown = object.userData.ownerNodeId;
    inner.traverse((o) => {
      if (owner !== undefined) o.userData.ownerNodeId = owner;
      if (o instanceof THREE.Mesh && o.userData.parcelCode === undefined) o.castShadow = true;
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
    update(view: Pick<EntityView, 'size'> & Partial<Pick<EntityView, 'mass' | 'shape'>>) {
      // Same rule as the mass tag layer: a box or crate with a mass the user set shows "N kg" on its front and back.
      massTag = code > 0 && view.mass !== undefined && (view.shape === undefined || view.shape === 'box' || view.shape === 'crate');
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
