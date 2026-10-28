import * as THREE from 'three';
import type { Motion } from '../character-motion';
import { type PartKit, type StyleDef, poseRig } from './kit';

/** Leg swings (front/rear, left/right) and the tail's backward lean, all about the lateral axis. */
type CatPose = { fl: number; fr: number; rl: number; rr: number; tail: number };

const REST: CatPose = { fl: 0, fr: 0, rl: 0, rr: 0, tail: 0.2 };
const TROT_AMPLITUDE = 0.8;
const STRETCH = 0.9;

function catTarget(m: Motion): CatPose {
  if (m.airborne) {
    // Stretched out mid-jump: front legs reach forward, back legs and tail trail behind.
    return { fl: STRETCH, fr: STRETCH, rl: -STRETCH, rr: -STRETCH, tail: 0.6 };
  }
  if (!m.walking) {
    return { fl: 0, fr: 0, rl: 0, rr: 0, tail: 0.2 + Math.sin(m.time * 1.8) * 0.22 };
  }
  // Trot: diagonal pairs (front-left + rear-right, front-right + rear-left) move together.
  const s = Math.sin(m.phase) * TROT_AMPLITUDE * m.amp;
  return { fl: s, rr: s, fr: -s, rl: -s, tail: 0.25 + Math.sin(m.phase * 0.5) * 0.15 };
}

const CREAM = '#fff3df';
const PINK = '#f4a6b7';
const EYES = '#1d1d24';

export const catStyle: StyleDef = {
  id: 'cat',
  build(kit: PartKit) {
    const root = new THREE.Group();
    const cream = kit.mat(CREAM);
    const pink = kit.mat(PINK);
    const eyes = kit.mat(EYES);

    const leg = (x: number, z: number): THREE.Group => {
      const j = kit.joint(root, [x, -0.25, z]);
      kit.box(j, kit.main, [0.09, 0.2, 0.09], [0, -0.1, 0]);
      kit.box(j, cream, [0.11, 0.05, 0.11], [0.01, -0.225, 0]);
      return j;
    };
    const fl = leg(0.2, 0.1);
    const fr = leg(0.2, -0.1);
    const rl = leg(-0.2, 0.1);
    const rr = leg(-0.2, -0.1);

    kit.box(root, kit.main, [0.6, 0.3, 0.3], [0, -0.1, 0]);
    kit.box(root, cream, [0.4, 0.04, 0.2], [0.02, -0.255, 0]);
    kit.box(root, kit.main, [0.32, 0.32, 0.32], [0.28, 0.12, 0]);
    kit.box(root, cream, [0.04, 0.1, 0.14], [0.45, 0.08, 0]);
    kit.box(root, pink, [0.03, 0.04, 0.06], [0.47, 0.12, 0]);
    kit.box(root, eyes, [0.02, 0.06, 0.05], [0.445, 0.17, 0.08]);
    kit.box(root, eyes, [0.02, 0.06, 0.05], [0.445, 0.17, -0.08]);
    for (const z of [0.1, -0.1]) {
      kit.box(root, kit.main, [0.08, 0.1, 0.08], [0.2, 0.33, z]);
      kit.box(root, kit.main, [0.05, 0.07, 0.05], [0.2, 0.415, z]);
      kit.box(root, pink, [0.02, 0.06, 0.04], [0.245, 0.33, z]);
    }

    // Raised tail with a curled cream tip.
    const tail = kit.joint(root, [-0.28, -0.1, 0]);
    kit.box(tail, kit.main, [0.07, 0.26, 0.07], [0, 0.13, 0]);
    const tailTip = kit.joint(tail, [0, 0.26, 0]);
    tailTip.rotation.z = -0.6;
    kit.box(tailTip, cream, [0.075, 0.14, 0.075], [0, 0.07, 0]);

    return poseRig(root, REST, catTarget, (p) => {
      fl.rotation.z = p.fl;
      fr.rotation.z = p.fr;
      rl.rotation.z = p.rl;
      rr.rotation.z = p.rr;
      tail.rotation.z = p.tail;
    });
  },
};
