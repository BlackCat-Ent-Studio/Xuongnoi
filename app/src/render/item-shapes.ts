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
