import * as THREE from 'three';
import type { Motion } from '../character-motion';
import { type PartKit, type StyleDef, poseRig } from './kit';

/** Leg/arm swings and forward lean about the lateral axis (lean < 0 = nose down); tail swings sideways. */
type DinoPose = { legL: number; legR: number; armL: number; armR: number; lean: number; tail: number };

const REST: DinoPose = { legL: 0, legR: 0, armL: 0, armR: 0, lean: 0, tail: 0 };
const RUN_AMPLITUDE = 0.9;
const MAX_LEAN = 0.15;

function dinoTarget(m: Motion): DinoPose {
  if (m.airborne) {
    return { legL: 0.7, legR: -0.4, armL: 0.8, armR: 0.8, lean: -0.05, tail: 0 };
  }
  if (!m.walking) {
    const sway = Math.sin(m.time * 1.5);
    return { legL: 0, legR: 0, armL: sway * 0.05, armR: -sway * 0.05, lean: 0, tail: sway * 0.2 };
  }
  const s = Math.sin(m.phase);
  return {
    legL: s * RUN_AMPLITUDE * m.amp,
    legR: -s * RUN_AMPLITUDE * m.amp,
    armL: -s * 0.5 * m.amp,
    armR: s * 0.5 * m.amp,
    lean: -MAX_LEAN * m.amp,
    tail: -s * 0.24 * m.amp,
  };
}

const CREAM = '#fff3d6';
const PLATES = '#ff9f43';
const EYES = '#1d1d24';

export const dinoStyle: StyleDef = {
  id: 'dino',
  build(kit: PartKit) {
    const root = new THREE.Group();
    const cream = kit.mat(CREAM);
    const plates = kit.mat(PLATES);
    const eyes = kit.mat(EYES);
    const hip: [number, number] = [-0.04, -0.14];

    const [legL, legR] = ([0.12, -0.12] as const).map((z) => {
      const leg = kit.joint(root, [hip[0], hip[1], z]);
      kit.box(leg, kit.main, [0.15, 0.3, 0.14], [0, -0.15, 0]);
      kit.box(leg, cream, [0.24, 0.06, 0.15], [0.05, -0.33, 0]);
      return leg;
    }) as [THREE.Group, THREE.Group];

    // Everything above the hips leans together when running.
    const upper = kit.joint(root, [hip[0], hip[1], 0]);
    kit.box(upper, kit.main, [0.34, 0.34, 0.36], [0.01, 0.18, 0]);
    kit.box(upper, cream, [0.02, 0.22, 0.24], [0.181, 0.18, 0]);
    // Big head with a pale jaw, eyes and a row of back plates.
    kit.box(upper, kit.main, [0.3, 0.2, 0.3], [0.27, 0.48, 0]);
    kit.box(upper, cream, [0.3, 0.08, 0.28], [0.27, 0.34, 0]);
    kit.box(upper, eyes, [0.02, 0.06, 0.05], [0.431, 0.5, 0.1]);
    kit.box(upper, eyes, [0.02, 0.06, 0.05], [0.431, 0.5, -0.1]);
    for (const x of [-0.1, 0, 0.1]) kit.box(upper, plates, [0.08, 0.09, 0.06], [x, 0.395, 0]);

    // Tools are carried in the mouth, at the front of the jaw; they lean with the body.
    const mouth = kit.joint(upper, [0.43, 0.38, 0]);
    const [armL, armR] = ([0.2, -0.2] as const).map((z) => {
      const arm = kit.joint(upper, [0.14, 0.19, z]);
      kit.box(arm, kit.main, [0.09, 0.14, 0.07], [0.01, -0.07, 0]);
      kit.box(arm, cream, [0.07, 0.04, 0.075], [0.03, -0.16, 0]);
      return arm;
    }) as [THREE.Group, THREE.Group];

    // Tapering three-segment tail; each segment turns a bit less than the one before.
    const tail1 = kit.joint(upper, [-0.13, 0.14, 0]);
    kit.box(tail1, kit.main, [0.12, 0.18, 0.2], [-0.06, 0, 0]);
    const tail2 = kit.joint(tail1, [-0.12, 0, 0]);
    kit.box(tail2, kit.main, [0.1, 0.13, 0.14], [-0.05, 0, 0]);
    const tail3 = kit.joint(tail2, [-0.1, 0, 0]);
    kit.box(tail3, plates, [0.08, 0.08, 0.09], [-0.04, 0, 0]);

    return poseRig(root, REST, dinoTarget, (p) => {
      legL.rotation.z = p.legL;
      legR.rotation.z = p.legR;
      armL.rotation.z = p.armL;
      armR.rotation.z = p.armR;
      upper.rotation.z = p.lean;
      tail1.rotation.y = p.tail;
      tail2.rotation.y = p.tail * 0.8;
      tail3.rotation.y = p.tail * 0.8;
    }, undefined, { swing: mouth, at: [0, 0, 0], length: 0.6, swingShare: 0.6 });
  },
};
