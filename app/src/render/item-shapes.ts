import * as THREE from 'three';
import type { ItemShape } from '../engine/types';
import { PartKit } from './character-styles/kit';

/** A built item figure: fills the unit cube (-0.5..0.5); the scene scales it to the entity size. */
export interface ItemFigure {
  readonly object: THREE.Group;
  setColor(color: string): void;
  dispose(): void;
}

/** Same hue, darker, for frames and teeth. */
export function shade(color: string, factor = 0.6): string {
  return `#${new THREE.Color(color).multiplyScalar(factor).getHexString()}`;
}

/** Builds the item out of boxes only. The main box material follows the entity color. */
export function buildItem(shape: ItemShape, color: string): ItemFigure {
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
    case 'key': {
      // Ring head on the left, long shaft, two teeth hanging down on the right.
      part(main, [0.34, 0.1, 0.3], [-0.33, 0.17, 0]);
      part(main, [0.34, 0.1, 0.3], [-0.33, -0.17, 0]);
      part(main, [0.1, 0.34, 0.3], [-0.45, 0, 0]);
      part(main, [0.1, 0.34, 0.3], [-0.21, 0, 0]);
      part(main, [0.62, 0.12, 0.2], [0.17, 0, 0]);
      darkParts.push(part(dark, [0.1, 0.24, 0.2], [0.2, -0.16, 0]));
      darkParts.push(part(dark, [0.1, 0.18, 0.2], [0.38, -0.13, 0]));
      break;
    }
    case 'ball': {
      // A cube with all edges and corners shaved, so it reads as round at block scale.
      part(main, [0.78, 0.78, 0.78], [0, 0, 0]);
      part(main, [1, 0.6, 0.6], [0, 0, 0]);
      part(main, [0.6, 1, 0.6], [0, 0, 0]);
      part(main, [0.6, 0.6, 1], [0, 0, 0]);
      darkParts.push(part(dark, [0.12, 0.12, 0.12], [-0.2, 0.36, 0.34]));
      break;
    }
    case 'crate': {
      // Body plus four darker planks on each side face.
      part(main, [1, 1, 1], [0, 0, 0]);
      for (const y of [-0.38, 0.38]) darkParts.push(part(dark, [1.04, 0.2, 1.04], [0, y, 0]));
      for (const x of [-0.38, 0.38]) darkParts.push(part(dark, [0.2, 1.04, 1.04], [x, 0, 0]));
      break;
    }
    case 'veggie': {
      // A bunch of leafy greens tied with a band: three stalks fanning out of a dark tie.
      const stem = kit.mat('#a7d86a');
      for (const [x, tilt] of [[-0.2, 0.28], [0, 0], [0.2, -0.28]] as const) {
        const s = part(stem, [0.1, 0.5, 0.1], [x * 0.55, -0.2, 0]);
        s.rotation.z = tilt;
      }
      darkParts.push(part(dark, [0.36, 0.1, 0.2], [0, -0.28, 0]));
      for (const [x, y, w] of [[-0.27, 0.12, 0.34], [0, 0.22, 0.42], [0.27, 0.12, 0.34]] as const) {
        part(main, [w, 0.34, 0.36], [x, y, 0]);
      }
      part(main, [0.2, 0.12, 0.2], [0, 0.42, 0]);
      break;
    }
    case 'ore': {
      // A rough rock with ore crystals poking out.
      part(kit.mat('#7b8089'), [0.84, 0.5, 0.74], [0, -0.25, 0]);
      part(kit.mat('#666b74'), [0.6, 0.34, 0.56], [0.05, 0.08, 0]).rotation.y = 0.4;
      for (const [x, y, z, s] of [[-0.22, 0.2, 0.1, 0.26], [0.24, 0.12, -0.12, 0.22], [0.06, 0.34, 0.06, 0.2]] as const) {
        const c = part(main, [s, s * 1.3, s], [x, y, z]);
        c.rotation.set(0.5, 0.6, 0.3);
      }
      part(kit.glow('#fff3a8'), [0.08, 0.08, 0.08], [-0.22, 0.34, 0.14]);
      break;
    }
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
    case 'bucket': {
      darkParts.push(part(dark, [0.5, 0.08, 0.5], [0, -0.4, 0]));
      part(main, [0.64, 0.5, 0.64], [0, -0.11, 0]);
      part(kit.mat('#4aa8ff'), [0.52, 0.04, 0.52], [0, 0.13, 0]);
      for (const x of [-0.32, 0.32]) darkParts.push(part(dark, [0.05, 0.3, 0.05], [x, 0.25, 0]));
      darkParts.push(part(dark, [0.69, 0.05, 0.05], [0, 0.4, 0]));
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
