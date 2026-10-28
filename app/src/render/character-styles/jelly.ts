import * as THREE from 'three';
import type { Motion } from '../character-motion';
import { type PartKit, type StyleDef, poseRig } from './kit';

/** `squash` -1 (flattened) .. +1 (stretched tall); `hop` lifts the whole body off the floor (units). */
type JellyPose = { squash: number; hop: number };

const REST: JellyPose = { squash: 0, hop: 0 };
const HOP_HEIGHT = 0.05;

/** Width and height of the cube for a given squash value; volume is roughly kept. */
export function jellySize(squash: number): { w: number; h: number } {
  const s = Math.max(-1, Math.min(1, squash));
  return { w: 0.63 - 0.05 * s, h: 0.8 + (s > 0 ? 0.19 : 0.14) * s };
}

function jellyTarget(m: Motion): JellyPose {
  if (m.airborne) return { squash: 0.75, hop: 0 };
  if (!m.walking) return { squash: Math.sin(m.time * 2.6) * 0.15, hop: 0 };
  // One bounce per step: flat on the floor, stretched at the top of the hop.
  const up = Math.abs(Math.sin(m.phase));
  return { squash: (up - 0.6) * m.amp, hop: up * HOP_HEIGHT * m.amp };
}

const SHINE = '#ffffff';
const EYES = '#1d1d24';

export const jellyStyle: StyleDef = {
  id: 'jelly',
  build(kit: PartKit) {
    const root = new THREE.Group();
    const eyes = kit.mat(EYES);
    const shine = kit.mat(SHINE);

    // The body is a unit cube sitting on y=0, scaled as a whole so the face stretches with it.
    const blob = kit.joint(root, [0, -0.5, 0]);
    kit.box(blob, kit.main, [1, 1, 1], [0, 0.5, 0]);
    kit.box(blob, eyes, [0.02, 0.16, 0.1], [0.51, 0.6, 0.2]);
    kit.box(blob, eyes, [0.02, 0.16, 0.1], [0.51, 0.6, -0.2]);
    kit.box(blob, eyes, [0.02, 0.04, 0.14], [0.51, 0.4, 0]);
    kit.box(blob, shine, [0.02, 0.2, 0.1], [0.51, 0.85, -0.3]);
    kit.box(blob, shine, [0.02, 0.07, 0.07], [0.51, 0.72, -0.3]);

    return poseRig(
      root,
      REST,
      jellyTarget,
      (p) => {
        const { w, h } = jellySize(p.squash);
        blob.scale.set(w, h, w);
        blob.position.y = -0.5 + p.hop;
      },
      18,
    );
  },
};
