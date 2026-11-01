import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { smoothValue } from '../cameras';
import type { Motion } from '../character-motion';
import type { PartKit, StyleDef, StyleRig, ToonOptions } from './kit';
import { ellipsoid, fitFigure, instance, part, scaledHex } from './toon-parts';

/** "Mèo Mun" on four legs: black cat with a white bib and socks, big blue eyes, red collar with an X tag; toon shaded. */

const RAMP = [85, 170, 255];
const FUR = '#2b2733';
const WHITE = '#f7f1ee';
const EYE = '#4aa8f0';
const COLLAR = '#d8323c';
const RIM = '#4554ff';

// Head ellipsoid radii.
const HA = 0.67;
const HB = 0.575;
const HC = 0.6;
// Body height above the floor and leg length at the default leg size.
const BODY_Y = 0.9;
const LEG_H = 0.6;
const HEAD_POS = new THREE.Vector3(0, 0.58, 0.78);
const HEADROOM = 0.1;

// Collar: ring size, thickness, offset above the neck, tilt (radians) and the tag size.
const RING_R = 0.56 * 0.9;
const RING_THICK = 0.085;
const RING_Y = 0.17;
const RING_TILT = (-6 * Math.PI) / 180;
const RING_LEAN = -0.55;
const TAG_SIZE = 0.92;

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Point on the head surface at (x, y), pushed out by `off`, and the rotation that aligns +Z to the surface normal. */
function onHead(x: number, y: number, off = 0): { pos: THREE.Vector3; quat: THREE.Quaternion } {
  const z = HC * Math.sqrt(Math.max(0.0001, 1 - (x / HA) ** 2 - (y / HB) ** 2));
  const n = new THREE.Vector3(x / (HA * HA), y / (HB * HB), z / (HC * HC)).normalize();
  return { pos: new THREE.Vector3(x, y, z).addScaledVector(n, off), quat: new THREE.Quaternion().setFromUnitVectors(Z_AXIS, n) };
}

/** Triangle with softly rounded corners, as a shape for ear extrusion. */
function roundedTriangle(pts: THREE.Vector2[], d: number): THREE.Shape {
  const sh = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n]!;
    const b = pts[i]!;
    const c = pts[(i + 1) % n]!;
    const ab = b.clone().sub(a).normalize();
    const cb = c.clone().sub(b).normalize();
    const p1 = b.clone().sub(ab.multiplyScalar(d));
    const p2 = b.clone().add(cb.multiplyScalar(d));
    if (i === 0) sh.moveTo(p1.x, p1.y);
    else sh.lineTo(p1.x, p1.y);
    sh.quadraticCurveTo(b.x, b.y, p2.x, p2.y);
  }
  sh.closePath();
  return sh;
}

function tubeThrough(points: THREE.Vector3[], radius: number, segments: number): THREE.TubeGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal'), segments, radius, 5, false);
}

interface Leg {
  group: THREE.Group;
  front: boolean;
  phase: number;
  hip: THREE.Vector3;
}

const TAIL_SEGMENTS = 7;
const TAIL_LENGTH = 1.25;

export const catQuadStyle: StyleDef = {
  id: 'cat-quad',
  fixedColor: true,
  build(kit: PartKit): StyleRig {
    const root = new THREE.Group();
    const toon = (color: string, rim = 0): THREE.MeshToonMaterial => {
      const opts: ToonOptions = { ramp: RAMP, rim, rimColor: RIM };
      return kit.toon(color, opts);
    };
    const M = {
      fur: toon(FUR, 0.55),
      shade: toon(scaledHex(FUR, 0.65), 0.55),
      white: toon(WHITE, 0.12),
      pink: toon('#ff8fa0'),
      earPink: toon('#f2a1a8'),
      eyeRing: toon('#2a5fb0'),
      iris: toon(EYE),
      pupil: toon('#10153a'),
      glint: kit.glow('#ffffff'),
      brow: toon('#7a7092'),
      mouth: toon('#f7a6b4'),
      collar: toon(COLLAR, 0.1),
      navy: toon('#232a5a'),
      whisker: kit.glow('#f1ebf5'),
    };

    const model = new THREE.Group();
    const body = new THREE.Group();
    body.position.y = BODY_Y;
    model.add(body);

    // Torso, white bib, collar and X tag.
    const torso = new THREE.Group();
    body.add(torso);
    ellipsoid(kit, torso, M.fur, [0.72, 0.68, 0.95], [0, 0, -0.1], [24, 16]);
    ellipsoid(kit, torso, M.white, [0.36, 0.42, 0.3], [0, -0.3, 0.58], [14, 10]);
    ellipsoid(kit, torso, M.white, [0.2, 0.24, 0.2], [-0.22, -0.4, 0.54], [8, 6]);
    ellipsoid(kit, torso, M.white, [0.2, 0.24, 0.2], [0.22, -0.4, 0.54], [8, 6]);

    const collarY = 0.14 + RING_Y;
    const collarZ = 0.5;
    const collar = new THREE.Group();
    collar.position.set(0, collarY, collarZ);
    collar.rotation.x = RING_TILT;
    part(kit, collar, new THREE.TorusGeometry(RING_R, RING_THICK, 8, 40), M.collar, [0, 0, 0], [RING_LEAN, 0, 0]);
    torso.add(collar);
    // The tag hangs from the lowest-front point of the (leaning, tilted) ring.
    const lowY = -RING_R * Math.cos(-RING_LEAN);
    const lowZ = RING_R * Math.sin(-RING_LEAN);
    const tag = new THREE.Group();
    tag.position.set(
      0,
      collarY + lowY * Math.cos(RING_TILT) - lowZ * Math.sin(RING_TILT),
      collarZ + lowY * Math.sin(RING_TILT) + lowZ * Math.cos(RING_TILT),
    );
    tag.scale.setScalar(TAG_SIZE);
    const barGeo = kit.own(new RoundedBoxGeometry(0.4, 0.085, 0.07, 1, 0.03));
    for (const a of [0.72, -0.72]) instance(tag, barGeo, M.navy, [0, -0.25, 0.17], [0, 0, a]);
    part(kit, tag, new THREE.TorusGeometry(0.05, 0.014, 5, 10), M.collar, [0, -0.06, 0.04]);
    torso.add(tag);

    // Head.
    const head = new THREE.Group();
    head.position.copy(HEAD_POS);
    body.add(head);
    ellipsoid(kit, head, M.fur, [HA, HB, HC], [0, 0, 0], [24, 16]);

    const outerEar = kit.own(
      new THREE.ExtrudeGeometry(
        roundedTriangle([new THREE.Vector2(-0.27, 0), new THREE.Vector2(0.27, 0), new THREE.Vector2(0.03, 0.66)], 0.13),
        { depth: 0.07, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 2, curveSegments: 4 },
      ),
    );
    outerEar.translate(0, 0, -0.035);
    const innerEar = kit.own(
      new THREE.ExtrudeGeometry(
        roundedTriangle([new THREE.Vector2(-0.16, 0.07), new THREE.Vector2(0.16, 0.07), new THREE.Vector2(0.02, 0.49)], 0.09),
        { depth: 0.03, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 4 },
      ),
    );
    innerEar.translate(0, 0, -0.015);
    const ears = ([-1, 1] as const).map((side) => {
      const ear = new THREE.Group();
      ear.position.set(side * 0.4, 0.38, 0.17);
      instance(ear, outerEar, M.shade);
      instance(ear, innerEar, M.earPink, [0, 0, 0.075]);
      head.add(ear);
      return { ear, side };
    });

    const eyes = ([-1, 1] as const).map((side) => {
      const anchor = new THREE.Group();
      const at = onHead(side * 0.285, -0.03, -0.005);
      anchor.position.copy(at.pos);
      anchor.quaternion.copy(at.quat);
      const eye = new THREE.Group();
      ellipsoid(kit, eye, M.eyeRing, [0.18, 0.235, 0.045], [0, 0, 0], [14, 8]);
      ellipsoid(kit, eye, M.iris, [0.15, 0.2, 0.04], [0, 0, 0.014], [14, 8]);
      const pupil = new THREE.Group();
      pupil.position.z = 0.03;
      ellipsoid(kit, pupil, M.pupil, [0.075, 0.125, 0.04], [0, 0, 0], [8, 6]);
      eye.add(pupil);
      ellipsoid(kit, eye, M.glint, [0.052, 0.052, 0.03], [-0.058, 0.075, 0.058], [8, 5]);
      ellipsoid(kit, eye, M.glint, [0.026, 0.026, 0.02], [0.065, -0.085, 0.052], [6, 4]);
      anchor.add(eye);
      head.add(anchor);

      const browAt = onHead(side * 0.27, 0.31, 0);
      const brow = new THREE.Group();
      brow.position.copy(browAt.pos);
      brow.quaternion.copy(browAt.quat);
      ellipsoid(kit, brow, M.brow, [0.1, 0.026, 0.02], [0, 0, 0.004], [6, 4]);
      head.add(brow);
      return eye;
    });

    const nose = ellipsoid(kit, head, M.pink, [0.058, 0.045, 0.04], onHead(0, -0.17, 0.005).pos.toArray(), [10, 8]);
    nose.quaternion.copy(onHead(0, -0.17, 0.005).quat);
    const smile = [
      [-0.125, -0.252],
      [-0.095, -0.283],
      [-0.05, -0.29],
      [-0.012, -0.262],
      [0, -0.24],
      [0.012, -0.262],
      [0.05, -0.29],
      [0.095, -0.283],
      [0.125, -0.252],
    ] as const;
    part(kit, head, tubeThrough(smile.map(([x, y]) => onHead(x, y, 0.006).pos), 0.0095, 18), M.mouth);
    part(kit, head, tubeThrough([onHead(0, -0.205, 0.006).pos, onHead(0, -0.24, 0.006).pos], 0.0095, 2), M.mouth);

    const whiskerGeo = kit.own(new THREE.CylinderGeometry(0.0065, 0.0035, 0.4, 4, 1));
    for (const side of [-1, 1]) {
      for (const vy of [0.24, 0, -0.22]) {
        const dir = new THREE.Vector3(side * 0.95, vy, 0.28).normalize();
        const base = onHead(side * 0.2, -0.17 + vy * 0.06, 0).pos;
        const w = instance(head, whiskerGeo, M.whisker);
        w.quaternion.setFromUnitVectors(Y_AXIS, dir);
        w.position.copy(base).addScaledVector(dir, 0.19);
      }
    }

    // Legs: capsule, white sock, white paw with a pink pad. Front pair stands forward, hind pair back.
    const legCaps = kit.own(new THREE.CapsuleGeometry(0.17, Math.max(0.05, LEG_H - 0.34), 2, 7));
    legCaps.translate(0, -LEG_H / 2, 0);
    const sockGeo = kit.own(new THREE.SphereGeometry(1, 10, 7));
    const padGeo = kit.own(new THREE.SphereGeometry(1, 6, 4));
    const legDefs = [
      { front: true, x: -0.36, z: 0.45, phase: 0 },
      { front: true, x: 0.36, z: 0.45, phase: Math.PI },
      { front: false, x: -0.42, z: -0.62, phase: Math.PI },
      { front: false, x: 0.42, z: -0.62, phase: 0 },
    ];
    const legs: Leg[] = legDefs.map((d) => {
      const group = new THREE.Group();
      const hipY = d.front ? -0.3 : -0.28;
      group.position.set(d.x, hipY, d.z);
      instance(group, legCaps, M.fur);
      instance(group, sockGeo, M.white, [0, -LEG_H + 0.23, 0.02]).scale.set(0.185, 0.22, 0.19);
      instance(group, sockGeo, M.white, [0, -LEG_H + 0.1, 0.07]).scale.set(0.185, 0.11, 0.23);
      instance(group, padGeo, M.pink, [0, -LEG_H + 0.04, 0.22]).scale.set(0.06, 0.03, 0.05);
      body.add(group);
      return { group, front: d.front, phase: d.phase, hip: new THREE.Vector3(d.x, hipY, d.z) };
    });

    // Tail: chain of capsules thinning toward a white tip.
    const tailRoot = new THREE.Group();
    tailRoot.position.set(0.1, -0.1, -1);
    tailRoot.rotation.set(-0.6, 0, -0.28);
    body.add(tailRoot);
    const segLen = TAIL_LENGTH / TAIL_SEGMENTS;
    const tailSegs: THREE.Group[] = [];
    let parent: THREE.Group = tailRoot;
    for (let i = 0; i < TAIL_SEGMENTS; i++) {
      const g = new THREE.Group();
      g.position.y = i === 0 ? 0 : segLen;
      parent.add(g);
      const r = 0.135 + (0.09 - 0.135) * (i / (TAIL_SEGMENTS - 1));
      part(kit, g, new THREE.CapsuleGeometry(r, segLen, 2, 7), i >= TAIL_SEGMENTS - 2 ? M.white : M.fur, [0, segLen / 2, 0]);
      tailSegs.push(g);
      parent = g;
    }

    // Pose state; the rest pose is applied before fitting so the figure is measured standing.
    let walk = 0;
    let air = 0;
    let rise = 0;
    let land = 0;
    let wasAir = false;
    let tailPhase = 0;
    let blinkAt = 2;
    let blinkT = -1;

    const apply = (time: number, phase: number, blink: number): void => {
      const breath = Math.sin(time * 1.9);
      const idle = 1 - walk;
      const w = phase;
      const crouch = -0.22 * land;
      const dy = Math.abs(Math.sin(w)) * 0.05 * walk;
      const pitch = Math.sin(w * 2) * 0.025 * walk - 0.15 * air * rise + 0.1 * air * (1 - rise);
      const headNod = Math.sin(w * 2) * 0.03 * walk + breath * 0.012 * idle;
      const sx = 1 - breath * 0.008 * idle * (1 - air) + 0.09 * land;
      const sy = 1 + breath * 0.02 * idle * (1 - air) - 0.17 * land;
      const swingF = -1.0 * air * rise - 0.4 * air * (1 - rise);
      const swingH = 0.9 * air * rise + 0.3 * air * (1 - rise);

      const by = BODY_Y + crouch;
      body.position.y = by + dy;
      body.rotation.x = pitch;
      torso.scale.set(sx, sy, sx);

      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      for (const leg of legs) {
        const s = Math.sin(w + leg.phase);
        const swing = -s * 0.55 * walk + (leg.front ? swingF : swingH);
        // Tucked up a little in the air so the reaching legs never dip under the floor.
        const lift = Math.max(0, Math.cos(w + leg.phase)) * 0.13 * walk + 0.12 * air;
        const groundHip = by + leg.hip.y * cp - leg.hip.z * sp;
        const scl = Math.min(1.45, Math.max(0.35, (groundHip - lift) / LEG_H));
        leg.group.rotation.x = -pitch + swing;
        leg.group.scale.set(1, scl, 1);
      }

      head.rotation.x = -pitch * 0.9 + headNod;
      head.rotation.y = Math.sin(time * 0.7) * 0.04 * idle + Math.sin(time * 4.5) * 0.06 * walk;
      const flick = Math.sin(time * 2.3) * 0.03;
      for (const { ear, side } of ears) {
        ear.rotation.x = 0.15;
        ear.rotation.z = side < 0 ? 0.3 + flick : -(0.3 + Math.sin(time * 2.3 + 1) * 0.03);
      }
      for (const eye of eyes) eye.scale.set(1, Math.max(0.05, 1 - 0.93 * blink), 1);

      const amp = 0.12 + 0.08 * walk - 0.02 * air;
      tailSegs.forEach((g, i) => {
        g.rotation.x = 0.17;
        g.rotation.z = Math.sin(tailPhase - i * 0.55) * amp * (0.3 + i * 0.13);
      });
    };
    apply(0, 0, 0);

    fitFigure(root, model, { headroom: HEADROOM, reachShare: 0.8 });

    return {
      root,
      selfFitting: true,
      update(m: Motion, dt: number): void {
        const d = Math.min(dt, 0.05);
        if (wasAir && !m.airborne) land = 1;
        wasAir = m.airborne;
        land = Math.max(0, land - d * 4);
        walk = smoothValue(walk, m.walking && !m.airborne ? m.amp : 0, d, 8);
        air = smoothValue(air, m.airborne ? 1 : 0, d, 12);
        if (m.airborne) rise = smoothValue(rise, m.vy >= 0 ? 1 : 0, d, 14);
        tailPhase += d * (1.5 + 2.5 * walk + 1.5 * air);

        let blink = 0;
        if (blinkT < 0 && m.time > blinkAt) blinkT = 0;
        if (blinkT >= 0) {
          blinkT += d;
          const q = blinkT / 0.15;
          if (q >= 1) {
            blinkT = -1;
            blinkAt = m.time + 2.2 + Math.random() * 3;
          } else {
            blink = Math.sin(q * Math.PI);
          }
        }
        apply(m.time, m.phase, blink);
      },
    };
  },
};
