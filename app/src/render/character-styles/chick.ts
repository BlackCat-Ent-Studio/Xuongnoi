import * as THREE from 'three';
import type { Motion } from '../character-motion';
import { type PartKit, type StyleDef, poseRig } from './kit';

/** Leg swings, body roll about the facing axis (waddle) and wing lift (0 = folded, 0.7 = spread). */
type ChickPose = { legL: number; legR: number; rock: number; wing: number };

const REST: ChickPose = { legL: 0, legR: 0, rock: 0, wing: 0.08 };
const WING_MAX = 0.7;

function chickTarget(m: Motion): ChickPose {
  if (m.airborne) {
    const flap = 0.35 + Math.sin(m.time * 30) * 0.35;
    return { legL: 0.5, legR: 0.5, rock: 0, wing: flap };
  }
  if (!m.walking) {
    return { legL: 0, legR: 0, rock: Math.sin(m.time * 1.6) * 0.02, wing: 0.08 };
  }
  const s = Math.sin(m.phase);
  return { legL: s * 0.7 * m.amp, legR: -s * 0.7 * m.amp, rock: s * 0.16 * m.amp, wing: 0.12 };
}

const CREAM = '#fff0c2';
const ORANGE = '#ff9f1c';
const EYES = '#1d1d24';

export const chickStyle: StyleDef = {
  id: 'chick',
  build(kit: PartKit) {
    const root = new THREE.Group();
    const cream = kit.mat(CREAM);
    const orange = kit.mat(ORANGE);
    const eyes = kit.mat(EYES);
    const baseY = -0.36;

    const [legL, legR] = ([0.1, -0.1] as const).map((z) => {
      const leg = kit.joint(root, [0, baseY, z]);
      kit.box(leg, orange, [0.05, 0.1, 0.05], [0, -0.05, 0]);
      kit.box(leg, orange, [0.14, 0.04, 0.1], [0.04, -0.12, 0]);
      return leg;
    }) as [THREE.Group, THREE.Group];

    // Round-ish body from stacked boxes; everything above the legs rocks together.
    const body = kit.joint(root, [0, baseY, 0]);
    kit.box(body, kit.main, [0.5, 0.1, 0.44], [0, 0.05, 0]);
    kit.box(body, kit.main, [0.62, 0.4, 0.54], [0, 0.3, 0]);
    kit.box(body, kit.main, [0.54, 0.2, 0.46], [0, 0.6, 0]);
    kit.box(body, kit.main, [0.4, 0.08, 0.34], [0, 0.74, 0]);
    kit.box(body, kit.main, [0.07, 0.07, 0.07], [0.02, 0.81, 0]);
    kit.box(body, cream, [0.02, 0.26, 0.34], [0.311, 0.28, 0]);
    kit.box(body, eyes, [0.02, 0.07, 0.06], [0.281, 0.6, 0.12]);
    kit.box(body, eyes, [0.02, 0.07, 0.06], [0.281, 0.6, -0.12]);
    kit.box(body, orange, [0.14, 0.07, 0.14], [0.33, 0.49, 0]);

    // Wings hang from the sides; lifting rotates each outward about the facing axis.
    const wingL = kit.joint(body, [0, 0.46, 0.28]);
    kit.box(wingL, cream, [0.22, 0.24, 0.04], [-0.03, -0.12, 0]);
    const wingR = kit.joint(body, [0, 0.46, -0.28]);
    kit.box(wingR, cream, [0.22, 0.24, 0.04], [-0.03, -0.12, 0]);

    return poseRig(root, REST, chickTarget, (p) => {
      legL.rotation.z = p.legL;
      legR.rotation.z = p.legR;
      body.rotation.x = p.rock;
      const lift = Math.min(p.wing, WING_MAX);
      wingL.rotation.x = -lift;
      wingR.rotation.x = lift;
    });
  },
};
