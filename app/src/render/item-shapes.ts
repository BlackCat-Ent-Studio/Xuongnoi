import * as THREE from 'three';
import type { EntityView, ItemShape } from '../engine/types';
import { PartKit } from './character-styles/kit';
import { PackSlot, pickVariant, type PackPool } from './pack-models';
import { ITEM_PACK } from './pack-model-table';

/** A built item figure: fills the unit cube (-0.5..0.5); the scene scales it to the entity size. */
export interface ItemFigure {
  readonly object: THREE.Group;
  setColor(color: string): void;
  dispose(): void;
  /** Pack models only: lay the model into the entity's real size so it keeps its proportions. Absent for code-drawn shapes. */
  update?(view: Pick<EntityView, 'size'>): void;
}

/** Same hue, darker, for frames and teeth. */
export function shade(color: string, factor = 0.6): string {
  return `#${new THREE.Color(color).multiplyScalar(factor).getHexString()}`;
}

/**
 * A MEGA PACK WORLD model fitted inside the unit cube (what a hand holds), with a plain box in the entity color
 * until the model is loaded. In the world, `update` re-lays it into the entity's real size, undoing the scene's
 * non-uniform scale so the model is never stretched.
 */
function buildPackItem(pool: PackPool, shape: ItemShape, color: string, seed: string): ItemFigure {
  const placeholderMat = new THREE.MeshLambertMaterial({ color });
  const placeholder = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), placeholderMat);
  placeholder.castShadow = true;
  const slot = new PackSlot(pickVariant(pool.models, `${shape}|${seed}`), pool, placeholder);
  const inner = new THREE.Group();
  inner.add(slot.object);
  slot.layout({ x: 1, y: 1, z: 1 });
  const object = new THREE.Group();
  object.add(inner);
  return {
    object,
    setColor(c) {
      // Pack models carry their own colours; only the loading box follows the entity.
      placeholderMat.color.set(c);
    },
    update(view) {
      const { x, y, z } = view.size;
      // The placeholder fills the scaled box as it is; a laid model must be un-stretched.
      if (slot.ready) inner.scale.set(1 / Math.max(x, 1e-6), 1 / Math.max(y, 1e-6), 1 / Math.max(z, 1e-6));
      else inner.scale.set(1, 1, 1);
      slot.layout(view.size);
    },
    dispose() {
      slot.dispose();
      placeholder.geometry.dispose();
      placeholderMat.dispose();
    },
  };
}

/**
 * Builds the item. Shapes with a pack pool use pack models (`seed` picks the variant); the rest are built out of
 * boxes, with the main box material following the entity color.
 */
export function buildItem(shape: ItemShape, color: string, seed = ''): ItemFigure {
  const pool = ITEM_PACK[shape];
  if (pool) return buildPackItem(pool, shape, color, seed);
  const kit = new PartKit(color);
  const object = new THREE.Group();
  let dark = kit.mat(shade(color));
  const darkParts: THREE.Mesh[] = [];
  const wood = kit.mat('#9a6a3a');
  const steel = kit.mat('#d5dce6');
  const main = kit.main;
  const part = (mat: THREE.Material, size: [number, number, number], pos: [number, number, number]) =>
    kit.box(object, mat, size, pos);

  switch (shape) {
    // Hand tools are drawn upright: grip at the bottom, working end at the top.
    case 'sword': {
      part(wood, [0.1, 0.26, 0.1], [0, -0.37, 0]);
      part(main, [0.1, 0.1, 0.1], [0, -0.5 + 0.05, 0]);
      part(main, [0.36, 0.07, 0.14], [0, -0.21, 0]);
      part(steel, [0.14, 0.62, 0.05], [0, 0.13, 0]);
      part(steel, [0.08, 0.08, 0.05], [0, 0.48, 0]);
      break;
    }
    case 'pickaxe': {
      part(wood, [0.1, 0.96, 0.1], [0, 0, 0]);
      part(main, [0.92, 0.14, 0.14], [0, 0.36, 0]);
      for (const x of [-0.42, 0.42]) part(main, [0.12, 0.22, 0.14], [x, 0.28, 0]);
      darkParts.push(part(dark, [0.16, 0.18, 0.16], [0, 0.36, 0]));
      break;
    }
    case 'hammer': {
      part(wood, [0.1, 0.84, 0.1], [0, -0.08, 0]);
      part(main, [0.62, 0.32, 0.32], [0, 0.34, 0]);
      for (const x of [-0.3, 0.3]) darkParts.push(part(dark, [0.08, 0.36, 0.36], [x, 0.34, 0]));
      break;
    }
    case 'torch': {
      part(wood, [0.12, 0.62, 0.12], [0, -0.2, 0]);
      part(main, [0.22, 0.14, 0.22], [0, 0.14, 0]);
      part(kit.glow('#ff8a1f'), [0.24, 0.24, 0.24], [0, 0.31, 0]);
      part(kit.glow('#ffd84a'), [0.14, 0.18, 0.14], [0, 0.44, 0]);
      break;
    }
    case 'wand': {
      part(wood, [0.08, 0.82, 0.08], [0, -0.09, 0]);
      part(main, [0.22, 0.22, 0.22], [0, 0.38, 0]);
      part(kit.glow('#fff3a8'), [0.36, 0.07, 0.07], [0, 0.38, 0]);
      part(kit.glow('#fff3a8'), [0.07, 0.36, 0.07], [0, 0.38, 0]);
      break;
    }
    case 'lock': {
      // Padlock: wide body with a dark keyhole, steel U-shaped shackle on top.
      part(main, [0.84, 0.56, 0.5], [0, -0.2, 0]);
      darkParts.push(part(dark, [0.86, 0.1, 0.52], [0, -0.38, 0]));
      darkParts.push(part(dark, [0.12, 0.2, 0.52], [0, -0.17, 0]));
      darkParts.push(part(dark, [0.2, 0.1, 0.52], [0, -0.1, 0]));
      for (const x of [-0.26, 0.26]) part(steel, [0.13, 0.36, 0.2], [x, 0.26, 0]);
      part(steel, [0.65, 0.13, 0.2], [0, 0.43, 0]);
      break;
    }
    default:
      part(main, [1, 1, 1], [0, 0, 0]);
      darkParts.push(part(dark, [0.5, 0.12, 1.02], [0, 0.2, 0]));
  }

  return {
    object,
    setColor(c) {
      kit.setMainColor(c);
      dark = kit.mat(shade(c));
      for (const m of darkParts) m.material = dark;
    },
    dispose() {
      kit.dispose();
    },
  };
}

/** Anything held in a hand is drawn this much smaller than its size on the ground. */
export const IN_HAND_SCALE = 0.65;

/** Long thin tools are drawn lying flat when they are not in a hand. */
const LIES_FLAT: ReadonlySet<ItemShape> = new Set<ItemShape>(['sword', 'pickaxe', 'hammer', 'torch', 'wand']);
export function liesFlat(shape: ItemShape): boolean {
  return LIES_FLAT.has(shape);
}

/** How a shape sits in a hand: tilt about the lateral axis (0 = upright), shift along its length, size factor. */
export interface HandGrip {
  tilt: number;
  /** Shift (in item units) that puts the grip point at the hand. */
  dy: number;
  scale: number;
}

const FORWARD_TILT = -1.25;
const TOOL_GRIPS: Partial<Record<ItemShape, HandGrip>> = {
  sword: { tilt: FORWARD_TILT, dy: 0.38, scale: 1.1 },
  pickaxe: { tilt: FORWARD_TILT, dy: 0.2, scale: 1.1 },
  hammer: { tilt: FORWARD_TILT, dy: 0.34, scale: 1 },
  torch: { tilt: -0.5, dy: 0.4, scale: 1 },
  wand: { tilt: -1, dy: 0.34, scale: 1 },
  bucket: { tilt: 0, dy: -0.38, scale: 0.75 },
};
/** Non-tool items carried in hand are just held out small. */
const PLAIN_GRIP: HandGrip = { tilt: 0, dy: 0, scale: 0.6 };

export function handGrip(shape: ItemShape): HandGrip {
  return TOOL_GRIPS[shape] ?? PLAIN_GRIP;
}
