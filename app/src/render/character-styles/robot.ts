import * as THREE from 'three';
import type { Motion } from '../character-motion';
import { type PartKit, type StyleDef, poseRig } from './kit';

type RobotPose = { armL: number; armR: number; legL: number; legR: number; antenna: number };

const REST: RobotPose = { armL: 0, armR: 0, legL: 0, legR: 0, antenna: 0 };
/** Walk swing is snapped to this many steps per side, so the gait looks mechanical. */
const STEPS = 2;

function robotTarget(m: Motion): RobotPose {
  if (m.airborne) {
    return {
      armL: 1.5,
      armR: 1.5,
      legL: 0.3,
      legR: -0.3,
      antenna: Math.sin(m.time * 22) * 0.55,
    };
  }
  if (!m.walking) {
    return { armL: 0, armR: 0, legL: 0, legR: 0, antenna: Math.sin(m.time * 2.2) * 0.08 };
  }
  const swing = (Math.round(Math.sin(m.phase) * STEPS) / STEPS) * 0.6 * m.amp;
  return { armL: -swing, armR: swing, legL: swing, legR: -swing, antenna: Math.sin(m.phase * 2) * 0.1 };
}

export const robotStyle: StyleDef = {
  id: 'robot',
  build(kit: PartKit) {
    const root = new THREE.Group();
    const metal = kit.mat('#cfd6e0');
    const dark = kit.mat('#55606e');
    const panel = kit.mat('#ffd23f');
    const tip = kit.mat('#ff5a5a');
    const eye = kit.glow('#38e8ff');
    const hipY = -0.3;

    const [legL, legR] = ([0.1, -0.1] as const).map((z) => {
      const leg = kit.joint(root, [0, hipY, z]);
      kit.box(leg, dark, [0.12, 0.14, 0.12], [0, -0.07, 0]);
      kit.box(leg, metal, [0.2, 0.06, 0.15], [0.03, -0.17, 0]);
      return leg;
    }) as [THREE.Group, THREE.Group];

    const upper = kit.joint(root, [0, hipY, 0]);
    kit.box(upper, kit.main, [0.26, 0.28, 0.42], [0, 0.14, 0]);
    kit.box(upper, panel, [0.02, 0.12, 0.2], [0.131, 0.15, 0]);
    kit.box(upper, dark, [0.08, 0.04, 0.1], [0, 0.3, 0]);
    // Big square head with a glowing visor strip and side bolts.
    kit.box(upper, metal, [0.34, 0.34, 0.42], [0, 0.48, 0]);
    kit.box(upper, eye, [0.02, 0.07, 0.3], [0.171, 0.5, 0]);
    kit.box(upper, dark, [0.06, 0.08, 0.06], [0, 0.48, 0.24]);
    kit.box(upper, dark, [0.06, 0.08, 0.06], [0, 0.48, -0.24]);
    const antenna = kit.joint(upper, [0, 0.65, 0]);
    kit.box(antenna, dark, [0.03, 0.07, 0.03], [0, 0.035, 0]);
    kit.box(antenna, tip, [0.06, 0.06, 0.06], [0, 0.1, 0]);

    const arms = ([0.27, -0.27] as const).map((z) => {
      const arm = kit.joint(upper, [0, 0.24, z]);
      const swing = kit.joint(arm, [0, 0, 0]);
      kit.box(swing, dark, [0.1, 0.2, 0.1], [0, -0.1, 0]);
      kit.box(swing, metal, [0.08, 0.08, 0.03], [0.02, -0.24, 0.03]);
      kit.box(swing, metal, [0.08, 0.08, 0.03], [0.02, -0.24, -0.03]);
      return { arm, swing };
    }) as [{ arm: THREE.Group; swing: THREE.Group }, { arm: THREE.Group; swing: THREE.Group }];
    const armL = arms[0].arm;
    const armR = arms[1].arm;

    // Stiff joints: a high blend rate keeps the stepped gait crisp.
    return poseRig(
      root,
      REST,
      robotTarget,
      (p) => {
        armL.rotation.z = p.armL;
        armR.rotation.z = p.armR;
        legL.rotation.z = p.legL;
        legR.rotation.z = p.legR;
        antenna.rotation.z = p.antenna;
      },
      32,
      { swing: arms[0].swing, at: [0.05, -0.24, 0], length: 0.7, swingShare: 1 },
    );
  },
};
