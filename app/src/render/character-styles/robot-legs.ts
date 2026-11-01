import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { smoothValue } from '../cameras';
import type { Motion } from '../character-motion';
import type { PartKit, StyleDef, StyleRig } from './kit';
import { darkerShade, ellipsoid, fitFigure, instance, part, sameColor } from './toon-parts';

/** Short-legged round robot: big head with a screen face, stubby arms and two chunky feet; toon shaded. */

const RAMP = [130, 195, 255];
const INK = '#2a2350';
const CHEEK = '#ff8fa8';
const METAL = '#c9d2dc';
const ACCENT = '#ffcc3d';
const SCREEN = '#f6f1e4';

// Model units.
const LEG_LENGTH = 0.35;
const FOOT_HEIGHT = 0.12;
const HIP_Y = FOOT_HEIGHT + LEG_LENGTH;
const TORSO_TOP = 0.66;
const HEAD_Y = TORSO_TOP + 0.5;
const ANTENNA_LENGTH = 0.35;
const HEADROOM = 0.04;

/** Height of the screen surface at (x, y), so face details sit on it. */
function screenZ(x: number, y: number): number {
  return 0.59 + 0.14 * Math.sqrt(Math.max(0, 1 - (x / 0.57) ** 2 - ((y + 0.02) / 0.41) ** 2));
}

interface Eye {
  group: THREE.Group;
  ball: THREE.Mesh;
  glint: THREE.Mesh;
  arc: THREE.Mesh;
  side: number;
}

export const robotLegsStyle: StyleDef = {
  id: 'robot-legs',
  build(kit: PartKit): StyleRig {
    const root = new THREE.Group();
    const toon = (c: string): THREE.MeshToonMaterial => kit.toon(c, { ramp: RAMP });
    const body = kit.toonTinted(sameColor, { ramp: RAMP });
    const shade = kit.toonTinted(darkerShade(0.17), { ramp: RAMP });
    const accent = toon(ACCENT);
    const screenMat = toon(SCREEN);
    const ink = toon(INK);
    const cheek = toon(CHEEK);
    const metal = toon(METAL);
    const white = kit.glow('#ffffff');

    const model = new THREE.Group();
    // Hips: the whole upper body rocks side to side about this point.
    const upper = new THREE.Group();
    upper.position.y = HIP_Y;
    model.add(upper);

    // Torso with a chest badge and two arms.
    const torso = new THREE.Group();
    upper.add(torso);
    part(kit, torso, new RoundedBoxGeometry(0.74, 0.66, 0.6, 3, 0.26), shade, [0, 0.33, 0]);
    ellipsoid(kit, torso, accent, [0.1, 0.1, 0.045], [0, 0.33, 0.29], [10, 8]);
    const armGeo = kit.own(new THREE.CapsuleGeometry(0.075, 0.14, 2, 6));
    const arms = ([-1, 1] as const).map((s) => {
      const arm = new THREE.Group();
      arm.position.set(s * 0.46, 0.5, 0);
      instance(arm, armGeo, body, [0, -0.13, 0]);
      ellipsoid(kit, arm, body, [0.105, 0.105, 0.105], [0, -0.27, 0], [10, 8]);
      torso.add(arm);
      return { arm, side: s };
    });

    // Head with ear knobs, screen face and antenna.
    const head = new THREE.Group();
    head.position.y = HEAD_Y;
    upper.add(head);
    ellipsoid(kit, head, body, [0.75, 0.65, 0.68], [0, 0, 0], [24, 16]);
    for (const s of [-1, 1]) ellipsoid(kit, head, metal, [0.07, 0.17, 0.17], [s * 0.74, -0.02, 0], [10, 8]);

    const face = new THREE.Group();
    head.add(face);
    ellipsoid(kit, face, screenMat, [0.57, 0.41, 0.14], [0, -0.02, 0.59], [20, 12]);
    const eyes: Eye[] = ([-1, 1] as const).map((s) => {
      const group = new THREE.Group();
      group.position.set(s * 0.25, 0.1, screenZ(0.25, 0.1) - 0.01);
      group.rotation.y = s * 0.25;
      const ball = ellipsoid(kit, group, ink, [1, 1, 1], [0, 0, 0], [12, 8]);
      const glint = ellipsoid(kit, group, white, [1, 1, 1], [0, 0, 0], [8, 6]);
      const arc = part(kit, group, new THREE.TorusGeometry(0.085, 0.03, 6, 10, Math.PI), ink, [0, -0.04, 0]);
      face.add(group);
      return { group, ball, glint, arc, side: s };
    });
    for (const s of [-1, 1]) {
      const c = ellipsoid(kit, face, cheek, [0.075, 0.05, 0.03], [s * 0.4, -0.1, screenZ(0.4, -0.1) + 0.005], [10, 8]);
      c.rotation.y = s * 0.3;
    }
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.1, screenZ(0, -0.1) + 0.012);
    const mouth = part(kit, mouthGroup, new THREE.TorusGeometry(0.085, 0.024, 6, 10, Math.PI), ink);
    mouth.rotation.z = Math.PI;
    face.add(mouthGroup);

    const antenna = new THREE.Group();
    antenna.position.y = 0.62;
    ellipsoid(kit, antenna, metal, [0.09, 0.06, 0.09], [0, 0, 0], [10, 8]);
    part(kit, antenna, new THREE.CapsuleGeometry(0.035, ANTENNA_LENGTH, 2, 6), metal, [0, ANTENNA_LENGTH / 2, 0]);
    ellipsoid(kit, antenna, accent, [0.1, 0.1, 0.1], [0, ANTENNA_LENGTH + 0.07, 0], [14, 10]);
    head.add(antenna);

    // Legs: capsule stalk and a rounded foot with an accent sole.
    const legGeo = kit.own(new THREE.CapsuleGeometry(0.135, LEG_LENGTH, 2, 8));
    const soleGeo = kit.own(new THREE.SphereGeometry(1, 12, 3, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38));
    const legs = ([-1, 1] as const).map((s) => {
      const leg = new THREE.Group();
      leg.position.set(s * 0.21, HIP_Y, 0);
      instance(leg, legGeo, shade, [0, -LEG_LENGTH / 2, 0]);
      const foot = new THREE.Group();
      foot.position.y = -HIP_Y + FOOT_HEIGHT;
      ellipsoid(kit, foot, body, [0.19, 0.12, 0.25], [0, 0, 0.04], [12, 8]);
      const sole = instance(foot, soleGeo, accent, [0, 0, 0.04]);
      sole.scale.set(0.195, 0.125, 0.255);
      leg.add(foot);
      model.add(leg);
      return { leg, side: s };
    });

    const { squash } = fitFigure(root, model, { headroom: HEADROOM });

    // Pose state.
    let walk = 0;
    let air = 0;
    let sy = 1;
    let carry = 0;
    let land = 0;
    let wasAir = false;
    let antZ = 0;
    let antZv = 0;
    let antX = 0;
    let antXv = 0;
    let blinkAt = 2.2;
    let blinkT = -1;

    const apply = (time: number, dt: number, sw: number, vy: number, blink: number): void => {
      const breathe = Math.sin(time * 2.2);
      const bob = Math.abs(sw) * 0.05 * walk;
      squash.position.y = bob;
      const sq = sy * (1 + 0.016 * breathe);
      const sxz = 1 / Math.sqrt(sq);
      squash.scale.set(sxz, sq, sxz);
      upper.rotation.z = sw * 0.13 * walk;
      upper.position.x = sw * 0.05 * walk;

      for (const { leg, side } of legs) {
        const ph = sw * side;
        // Opposite legs; in the air they trail apart a little instead of stepping.
        leg.rotation.x = -ph * 0.7 * walk + side * Math.sin(time * 9) * 0.25 * air;
        leg.position.y = HIP_Y + Math.max(0, -ph) * 0.07 * walk;
      }

      head.position.y = HEAD_Y + breathe * 0.012;
      head.rotation.z = -sw * 0.07 * walk;
      const tz = -upper.rotation.z * 1.3 - head.rotation.z * 0.6;
      const tx = -Math.max(-10, Math.min(10, vy)) * 0.03 + Math.sin(time * 2.2) * 0.02;
      const step = Math.min(dt, 0.05);
      antZv += (-70 * (antZ - tz) - 6 * antZv) * step;
      antZ += antZv * step;
      antXv += (-70 * (antX - tx) - 6 * antXv) * step;
      antX += antXv * step;
      antenna.rotation.set(antX, 0, antZ + Math.sin(time * 4) * 0.03);

      const raise = 0.55 * air;
      for (const { arm, side } of arms) {
        // Carrying: both arms reach forward to hold the load out front.
        arm.rotation.z = (1 - carry) * side * (0.32 + raise * 2.2) + carry * side * 0.28;
        arm.rotation.x = (1 - carry) * side * sw * 0.9 * walk - carry * 1.35;
      }

      const open = 1 - 0.92 * blink;
      const happy = air * 0.8;
      const ballVis = Math.max(0, 1 - happy * 2);
      const arcVis = Math.max(0, happy * 2 - 1);
      for (const e of eyes) {
        e.ball.scale.set(0.105 * ballVis, 0.15 * open * ballVis, 0.055 * ballVis);
        e.ball.visible = ballVis > 0.02;
        e.glint.visible = e.ball.visible && open > 0.5;
        e.glint.position.set(0.035, 0.05 * open, 0.045);
        e.glint.scale.setScalar(0.03 * ballVis);
        e.arc.visible = arcVis > 0.02;
        e.arc.scale.setScalar(Math.max(arcVis, 0.001));
      }
      mouth.scale.set(1 + 0.45 * happy, 1 + 0.3 * happy, 1);
    };
    apply(0, 0, 0, 0, 0);

    return {
      root,
      selfFitting: true,
      update(m: Motion, dt: number): void {
        const d = Math.min(dt, 0.05);
        if (wasAir && !m.airborne) land = 1;
        wasAir = m.airborne;
        land = Math.max(0, land - d * 4);
        walk = smoothValue(walk, m.walking && !m.airborne ? 1 : 0, d, 7);
        air = smoothValue(air, m.airborne ? 1 : 0, d, 12);
        sy = smoothValue(sy, 1 - 0.28 * land, d, 16);
        carry = smoothValue(carry, m.carrying === true && !m.airborne ? 1 : 0, d, 14);

        let blink = 0;
        if (blinkT < 0 && m.time > blinkAt) blinkT = 0;
        if (blinkT >= 0) {
          blinkT += d;
          const q = blinkT / 0.16;
          if (q >= 1) {
            blinkT = -1;
            blinkAt = m.time + 2.5 + Math.random() * 2.5;
          } else {
            blink = Math.sin(q * Math.PI);
          }
        }
        apply(m.time, d, Math.sin(m.phase), m.vy, blink);
      },
    };
  },
};
