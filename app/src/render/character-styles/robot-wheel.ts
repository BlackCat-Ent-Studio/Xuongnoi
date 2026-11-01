import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { smoothValue } from '../cameras';
import type { Motion } from '../character-motion';
import type { PartKit, StyleDef, StyleRig } from './kit';
import { darkerShade, ellipsoid, fitFigure, instance, part, sameColor } from './toon-parts';

/** Round-bodied robot balancing on a single wheel with a mudguard over it; toon shaded. */

const RAMP = [150, 205, 255];
const INK = '#2a2350';
const CHEEK = '#ff8fa8';
const METAL = '#c9d2dc';
const TIRE = '#3b3f5c';
const ACCENT = '#ffcc3d';
const SCREEN = '#f6f1e4';

// Model units (wheel outer radius 0.55, head radius 0.6 before its 1.08 scale).
const AXLE = 0.54;
const TORSO_Y = 1.48;
const HEAD_SCALE = 1.08;
const HEAD_Y = TORSO_Y + 0.25 - 0.14 + 0.6 * HEAD_SCALE;
const ANTENNA_LENGTH = 0.3;
/** Wheel turn per unit of ground speed, and the cap that keeps the spokes readable. */
const SPIN_PER_SPEED = 2.2;
const SPIN_MAX = 16;
const HEADROOM = 0.01;

interface Eye {
  open: THREE.Group;
  happy: THREE.Mesh;
  side: number;
}

export const robotWheelStyle: StyleDef = {
  id: 'robot-wheel',
  build(kit: PartKit): StyleRig {
    const root = new THREE.Group();
    const toon = (c: string): THREE.MeshToonMaterial => kit.toon(c, { ramp: RAMP });
    const body = kit.toonTinted(sameColor, { ramp: RAMP });
    const shade = kit.toonTinted(darkerShade(0.17), { ramp: RAMP });
    const accent = toon(ACCENT);
    const screenMat = toon(SCREEN);
    const metal = toon(METAL);
    const tire = toon(TIRE);
    const ink = kit.glow(INK);
    const cheek = kit.glow(CHEEK);
    const white = kit.glow('#ffffff');

    const model = new THREE.Group();

    // Wheel: tyre, two hubs and crossed bars on each side. Stays upright while the body leans.
    const wheel = new THREE.Group();
    wheel.position.y = AXLE;
    const spin = new THREE.Group();
    wheel.add(spin);
    part(kit, spin, new THREE.TorusGeometry(0.3, 0.25, 14, 40), tire, [0, 0, 0], [0, Math.PI / 2, 0]);
    const barGeo = kit.own(new RoundedBoxGeometry(0.06, 0.08, 0.36, 2, 0.03));
    for (const s of [-1, 1]) {
      ellipsoid(kit, spin, accent, [0.125, 0.25, 0.25], [s * 0.22, 0, 0], [16, 10]);
      instance(spin, barGeo, metal, [s * 0.29, 0, 0]);
      instance(spin, barGeo, metal, [s * 0.29, 0, 0], [Math.PI / 2, 0, 0]);
    }
    model.add(wheel);

    // Everything above the wheel leans about the axle.
    const pivot = new THREE.Group();
    pivot.position.y = AXLE;
    model.add(pivot);

    // Mudguard: an arch over the top of the wheel with an accent stripe, two struts and side caps.
    const guard = new THREE.Group();
    const arc = Math.PI * 0.72;
    const start = (Math.PI - arc) / 2;
    const archWrap = new THREE.Group();
    archWrap.rotation.y = Math.PI / 2;
    guard.add(archWrap);
    const arch = part(kit, archWrap, new THREE.TorusGeometry(0.66, 0.06, 8, 32, arc), shade);
    arch.rotation.z = start;
    arch.scale.z = 4.6;
    part(kit, archWrap, new THREE.TorusGeometry(0.72, 0.028, 6, 32, arc), accent).rotation.z = start;
    const strutGeo = kit.own(new RoundedBoxGeometry(0.05, 0.62, 0.12, 2, 0.02));
    for (const s of [-1, 1]) {
      instance(guard, strutGeo, metal, [s * 0.33, 0.3, 0]);
      ellipsoid(kit, guard, accent, [0.0495, 0.11, 0.11], [s * 0.4, 0, 0], [12, 8]);
    }
    pivot.add(guard);

    // Torso: rounded box, neck ring and a chest button.
    const torso = new THREE.Group();
    torso.position.y = TORSO_Y - AXLE;
    part(kit, torso, new RoundedBoxGeometry(0.62, 0.5, 0.56, 3, 0.2), shade);
    part(kit, torso, new THREE.TorusGeometry(0.2, 0.06, 8, 24), metal, [0, 0.24, 0], [Math.PI / 2, 0, 0]);
    ellipsoid(kit, torso, accent, [0.08, 0.08, 0.04], [0, -0.02, 0.29], [12, 8]);
    pivot.add(torso);

    // Arms hang from the shoulders and swing out sideways.
    const armGeo = kit.own(new THREE.CapsuleGeometry(0.085, 0.14, 4, 10));
    const arms = ([-1, 1] as const).map((s) => {
      const arm = new THREE.Group();
      arm.position.set(s * 0.34, TORSO_Y + 0.09 - AXLE, 0);
      instance(arm, armGeo, body, [0, -0.14, 0]);
      ellipsoid(kit, arm, metal, [0.1, 0.1, 0.1], [0, -0.27, 0], [12, 8]);
      pivot.add(arm);
      return arm;
    });

    // Head: wide sphere with ear caps, a cream screen face and a springy antenna.
    const head = new THREE.Group();
    head.position.y = HEAD_Y - AXLE;
    head.scale.setScalar(HEAD_SCALE);
    ellipsoid(kit, head, body, [0.66, 0.6, 0.6], [0, 0, 0], [32, 20]);
    for (const s of [-1, 1]) ellipsoid(kit, head, accent, [0.066, 0.144, 0.144], [s * 0.65, -0.02, 0], [12, 8]);

    ellipsoid(kit, head, screenMat, [0.5, 0.38, 0.14], [0, 0, 0.52], [24, 16]);
    const eyes: Eye[] = ([-1, 1] as const).map((s) => {
      const eye = new THREE.Group();
      eye.position.set(s * 0.17, 0.06, 0.635);
      const open = new THREE.Group();
      const ball = part(kit, open, new THREE.CapsuleGeometry(0.065, 0.09, 4, 10), ink);
      ball.scale.z = 0.5;
      ellipsoid(kit, open, white, [0.024, 0.024, 0.024], [0.02, 0.07, 0.04], [8, 6]);
      const happy = part(kit, eye, new THREE.TorusGeometry(0.075, 0.03, 6, 14, Math.PI), ink, [0, -0.03, 0]);
      happy.scale.z = 0.6;
      happy.visible = false;
      eye.add(open);
      head.add(eye);
      return { open, happy, side: s };
    });
    const mouth = new THREE.Group();
    mouth.position.set(0, -0.1, 0.645);
    part(kit, mouth, new THREE.TorusGeometry(0.075, 0.02, 6, 20, Math.PI), ink, [0, 0.04, 0], [0, 0, Math.PI]);
    head.add(mouth);
    for (const s of [-1, 1]) ellipsoid(kit, head, cheek, [0.07, 0.045, 0.03], [s * 0.3, -0.1, 0.605], [12, 8]);

    const antenna = new THREE.Group();
    antenna.position.y = 0.56;
    ellipsoid(kit, antenna, metal, [0.07, 0.035, 0.07], [0, 0, 0], [12, 8]);
    const stalkGeo = kit.own(new THREE.CylinderGeometry(0.028, 0.028, 1, 8));
    stalkGeo.translate(0, 0.5, 0);
    instance(antenna, stalkGeo, metal).scale.y = ANTENNA_LENGTH;
    ellipsoid(kit, antenna, accent, [0.095, 0.095, 0.095], [0, ANTENNA_LENGTH + 0.04, 0], [16, 10]);
    head.add(antenna);
    pivot.add(head);

    const { squash } = fitFigure(root, model, { headroom: HEADROOM });

    // Pose state, smoothed toward what the motion asks for.
    let spinAngle = 0;
    let lean = 0;
    let armL = 0.28;
    let armR = 0.28;
    let pitch = 0;
    let roll = 0;
    let happy = 0;
    let wobble = 1;
    let sy = 1;
    let land = 0;
    let wasAir = false;
    let blinkAt = 2.5;
    let blinkT = -1;

    const apply = (time: number, blink: number): void => {
      spin.rotation.x = spinAngle;
      const sxz = 1 / Math.sqrt(sy);
      squash.scale.set(sxz, sy, sxz);
      pivot.rotation.x = lean;
      head.rotation.x = pitch;
      head.rotation.z = roll;
      arms[0]!.rotation.z = -armL;
      arms[1]!.rotation.z = armR;
      antenna.rotation.z = Math.sin(time * 3.1) * 0.13 * wobble - lean * 0.5;
      antenna.rotation.x = Math.cos(time * 2.3) * 0.09 * wobble - lean * 0.8;
      const arcs = happy >= 0.6;
      for (const e of eyes) {
        e.open.visible = !arcs;
        e.happy.visible = arcs;
        e.open.scale.set(1, Math.max(0.05, blink * (1 - happy * 0.6)), 1);
        const hs = Math.min(1, Math.max(0, (happy - 0.6) / 0.4)) * 0.35 + 0.65;
        e.happy.scale.set(hs, hs, 0.6);
      }
      mouth.scale.set(1 + happy * 0.35, 1 + happy * 0.5, 1);
    };
    apply(0, 1);

    return {
      root,
      selfFitting: true,
      update(m: Motion, dt: number): void {
        const d = Math.min(dt, 0.05);
        if (wasAir && !m.airborne) land = 1;
        wasAir = m.airborne;
        land = Math.max(0, land - d * 4);

        let tLean = 0;
        let tArmL: number;
        let tArmR: number;
        let tPitch = 0;
        let tRoll = 0;
        let tHappy = 0;
        let tWobble = 1;
        let tSy = 1;
        let rate = 8;
        if (m.airborne) {
          const rising = m.vy >= 0;
          tArmL = tArmR = rising ? 1.9 : 1.45;
          tHappy = rising ? 0.85 : 0;
          tWobble = rising ? 2 : 2.4;
          tPitch = rising ? -0.05 : 0.08;
          tLean = 0.1 * m.amp;
          rate = 16;
        } else if (m.walking) {
          const swing = Math.sin(m.phase) * 0.35;
          tArmL = 0.7 + swing;
          tArmR = 0.7 - swing;
          tLean = 0.2 * m.amp;
          tPitch = -0.05;
          tHappy = 0.15;
          tWobble = 1.8;
        } else {
          const breathe = Math.sin(m.time * 2);
          tArmL = tArmR = 0.28 + breathe * 0.04;
          tRoll = Math.sin(m.time * 0.8) * 0.03;
          tSy = 1 - 0.012 * (0.5 + 0.5 * breathe);
        }
        if (land > 0) {
          tSy = 1 - 0.22 * land;
          tArmL = tArmR = 0.1;
          rate = 16;
        }

        lean = smoothValue(lean, tLean, d, rate);
        armL = smoothValue(armL, tArmL, d, rate);
        armR = smoothValue(armR, tArmR, d, rate);
        pitch = smoothValue(pitch, tPitch, d, rate);
        roll = smoothValue(roll, tRoll, d, rate);
        happy = smoothValue(happy, tHappy, d, rate);
        wobble = smoothValue(wobble, tWobble, d, rate);
        sy = smoothValue(sy, tSy, d, rate);
        spinAngle += Math.min(m.speed * SPIN_PER_SPEED, SPIN_MAX) * d;

        if (blinkT < 0 && m.time > blinkAt) blinkT = 0;
        let blink = 1;
        if (blinkT >= 0) {
          blinkT += d;
          blink = 1 - Math.sin(Math.min(1, blinkT / 0.16) * Math.PI) * 0.92;
          if (blinkT > 0.16) {
            blinkT = -1;
            blinkAt = m.time + 2.5 + Math.random() * 2.5;
          }
        }
        apply(m.time, blink);
      },
    };
  },
};
