import * as THREE from 'three';
import type { Motion } from '../character-motion';
import { type PartKit, type StyleDef, poseRig } from './kit';

/** Limb rotations about the lateral axis (positive = swing toward the facing direction). */
export type HumanPose = {
  armL: number;
  armR: number;
  legL: number;
  legR: number;
  /** Fractional vertical stretch of the upper body (breathing). */
  breathe: number;
};

const REST: HumanPose = { armL: 0, armR: 0, legL: 0, legR: 0, breathe: 0 };
const WALK_AMPLITUDE = 0.85;
const ARMS_UP = 2.4;
const LEG_TUCK_FRONT = 0.9;
const LEG_TUCK_BACK = -0.5;

/** Pose the figure is heading toward for the given motion state. */
export function humanTarget(m: Motion): HumanPose {
  if (m.airborne) {
    return { armL: ARMS_UP, armR: ARMS_UP, legL: LEG_TUCK_FRONT, legR: LEG_TUCK_BACK, breathe: 0 };
  }
  if (!m.walking) {
    const sway = Math.sin(m.time * 1.6) * 0.04;
    return { armL: sway, armR: -sway, legL: 0, legR: 0, breathe: Math.sin(m.time * 2) * 0.012 };
  }
  const swing = Math.sin(m.phase) * WALK_AMPLITUDE * m.amp;
  return { armL: -swing * 0.9, armR: swing * 0.9, legL: swing, legR: -swing, breathe: 0 };
}

const SKIN = '#f1c27d';
const PANTS = '#3b4a6b';
const SHOES = '#2b2b33';
const EYES = '#1d1d24';

export const humanStyle: StyleDef = {
  id: 'human',
  build(kit: PartKit) {
    const root = new THREE.Group();
    const skin = kit.mat(SKIN);
    const pants = kit.mat(PANTS);
    const shoes = kit.mat(SHOES);
    const eyes = kit.mat(EYES);
    const hipY = -0.1;
    const shoulderY = 0.22;

    const [legL, legR] = ([0.09, -0.09] as const).map((z) => {
      const leg = kit.joint(root, [0, hipY, z]);
      kit.box(leg, pants, [0.16, 0.4, 0.16], [0, -0.2, 0]);
      kit.box(leg, shoes, [0.22, 0.08, 0.17], [0.03, -0.36, 0]);
      return leg;
    }) as [THREE.Group, THREE.Group];

    const upper = kit.joint(root, [0, hipY, 0]);
    kit.box(upper, kit.main, [0.2, 0.34, 0.36], [0, 0.17, 0]);
    kit.box(upper, skin, [0.26, 0.26, 0.26], [0, 0.445, 0]);
    kit.box(upper, eyes, [0.02, 0.045, 0.045], [0.131, 0.47, 0.065]);
    kit.box(upper, eyes, [0.02, 0.045, 0.045], [0.131, 0.47, -0.065]);
    const [armL, armR] = ([0.25, -0.25] as const).map((z) => {
      const arm = kit.joint(upper, [0, shoulderY - hipY, z]);
      kit.box(arm, kit.main, [0.14, 0.24, 0.14], [0, -0.12, 0]);
      kit.box(arm, skin, [0.13, 0.1, 0.13], [0, -0.29, 0]);
      return arm;
    }) as [THREE.Group, THREE.Group];

    return poseRig(root, REST, humanTarget, (p) => {
      armL.rotation.z = p.armL;
      armR.rotation.z = p.armR;
      legL.rotation.z = p.legL;
      legR.rotation.z = p.legR;
      upper.scale.y = 1 + p.breathe;
    });
  },
};
