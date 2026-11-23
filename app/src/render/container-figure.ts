import * as THREE from 'three';
import type { EntityView } from '../engine/types';
import { CONTAINER_BOARD_LABEL, CONTAINER_THICK, containerOfLabel, type ContainerShape } from '../nodes/container';
import { rollCageParts } from './factory-blocks';
import { bakedMesh, box, q, rbox, sizeKey, type Part } from './factory-kit';

/**
 * A block of a cage ("Lồng chứa"). The floor plate carries the shape of the whole cage and draws all of it:
 * - the roll cage look: the mesh cage on four small wheels of the warehouse looks, laid round the clear room inside, so
 *   what lies in the cage stays in view. The walls then draw nothing: the mesh stands where they are.
 * - the classic look: the plate on four feet, and every wall as the flat board its solid box is.
 */

const FOOT = '#23252b';
const FOOT_SIDE = 0.07;

/** The feet of a classic cage under its floor plate, with y = 0 on the middle of the plate. */
function footParts(s: ContainerShape): Part[] {
  const reach = s.inside / 2 + CONTAINER_THICK - FOOT_SIDE / 2;
  const parts: Part[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) parts.push({ geo: rbox(FOOT_SIDE, s.clearance, FOOT_SIDE, 0.012), color: FOOT, at: [sx * reach, -CONTAINER_THICK / 2 - s.clearance / 2, sz * reach] });
  }
  return parts;
}

const hexOf = (color: string): string => `#${new THREE.Color(color).getHexString()}`;

export class ContainerFigure {
  readonly object = new THREE.Group();
  private key = '';

  constructor(view: EntityView) {
    this.update(view);
  }

  private build(view: EntityView, color: string): void {
    this.object.clear();
    const size = view.size;
    const shape = containerOfLabel(view.label);
    if (shape && !shape.classic) {
      // The whole roll cage, standing on the ground under the plate.
      const cage = bakedMesh(`container-cage|${view.label}|${color}`, () => rollCageParts({ insideX: shape.inside, insideZ: shape.inside, wall: shape.wall, clearance: shape.clearance }, color));
      cage.position.y = -(shape.clearance + CONTAINER_THICK / 2);
      this.object.add(cage);
    } else if (shape) {
      this.object.add(bakedMesh(`container-plate|${sizeKey(size)}|${color}`, () => [{ geo: box(size.x, size.y, size.z), color }], undefined, true));
      this.object.add(bakedMesh(`container-feet|${q(shape.inside)}|${q(shape.clearance)}`, () => footParts(shape)));
    } else if (view.label === CONTAINER_BOARD_LABEL) {
      this.object.add(bakedMesh(`container-wall|${sizeKey(size)}|${color}`, () => [{ geo: box(size.x, size.y, size.z), color }]));
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

  /** The baked shapes are shared by every cage of the same size and stay for the life of the page. */
  dispose(): void {
    this.object.clear();
  }
}
