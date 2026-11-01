import * as THREE from 'three';
import { smoothValue } from '../cameras';
import type { Motion } from '../character-motion';
import type { PartKit, StyleDef, StyleRig, ToonOptions } from './kit';
import { ellipsoid, fitFigure, instance, mixHex, part, scaledHex } from './toon-parts';

/** "Mèo Mun" chibi: black kitten with an oversized head, big blue eyes, a red collar with an X tag; toon shaded. */

const RAMP = [105, 185, 255];
const FUR = '#2b2733';
const WHITE = '#f7f1ee';
const EYE = '#4aa8f0';
const COLLAR = '#d8323c';
const PINK_EAR = '#f2a1a8';
const PINK = '#ff8fa0';
const NAVY = '#232a5a';
const RIM = '#9e8cff';

/** Head ellipsoid radii. */
const RX = 1.15;
const RY = 0.95;
const RZ = 1;
const HEAD_Y = 0.3 + 1.3 - 0.25 + RY;
const HEADROOM = 0.06;

const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** Point on the head surface at (x, y), pushed out by `off`, with the rotation that aligns +Z to the surface normal. */
function onHead(x: number, y: number, off = 0): { pos: THREE.Vector3; quat: THREE.Quaternion } {
  const z = RZ * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2 - (y / RY) ** 2));
  const n = new THREE.Vector3(x / (RX * RX), y / (RY * RY), z / (RZ * RZ)).normalize();
  return {
    pos: new THREE.Vector3(x, y, z).addScaledVector(n, off),
    quat: new THREE.Quaternion().setFromUnitVectors(Z_AXIS, n),
  };
}

function placeOnHead(obj: THREE.Object3D, x: number, y: number, off = 0): THREE.Object3D {
  const p = onHead(x, y, off);
  obj.position.copy(p.pos);
  obj.quaternion.copy(p.quat);
  return obj;
}

/** Ear cone: a lathed profile with a rounded tip. */
function earShape(radius: number, height: number, tip: number, segments: number): THREE.LatheGeometry {
  const pts = [new THREE.Vector2(0, -0.12), new THREE.Vector2(radius, -0.12), new THREE.Vector2(radius, 0)];
  pts.push(new THREE.Vector2(tip, height));
  for (let a = 1; a <= 4; a++) {
    const an = (a / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(tip * Math.cos(an), height + tip * Math.sin(an)));
  }
  return new THREE.LatheGeometry(pts, segments);
}

/** Tapered tube along `curve` with per-vertex color, open at the base (hidden inside the body). */
function taperTube(
  curve: THREE.Curve<THREE.Vector3>,
  radiusAt: (t: number) => number,
  colorAt: (t: number) => THREE.Color,
  tubular: number,
  radial: number,
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubular, false);
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const p = curve.getPointAt(t);
    const r = radiusAt(t);
    const c = colorAt(t);
    const fn = frames.normals[i]!;
    const fb = frames.binormals[i]!;
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2;
      const cs = -Math.cos(v);
      const sn = Math.sin(v);
      const nx = cs * fn.x + sn * fb.x;
      const ny = cs * fn.y + sn * fb.y;
      const nz = cs * fn.z + sn * fb.z;
      pos.push(p.x + r * nx, p.y + r * ny, p.z + r * nz);
      nor.push(nx, ny, nz);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 1; i <= tubular; i++) {
    for (let j = 1; j <= radial; j++) {
      const a = (radial + 1) * (i - 1) + (j - 1);
      const b = (radial + 1) * i + (j - 1);
      const c = (radial + 1) * i + j;
      const d = (radial + 1) * (i - 1) + j;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export const catChibiStyle: StyleDef = {
  id: 'cat-chibi',
  fixedColor: true,
  build(kit: PartKit): StyleRig {
    const root = new THREE.Group();
    const toon = (color: string, rim = 0): THREE.MeshToonMaterial => {
      const opts: ToonOptions = { ramp: RAMP, rim, rimColor: RIM };
      return kit.toon(color, opts);
    };
    const ring = scaledHex(EYE, 0.58);
    const M = {
      fur: toon(FUR, 0.95),
      shade: toon(scaledHex(FUR, 0.65), 0.85),
      white: toon(WHITE, 0.4),
      earPink: toon(PINK_EAR, 0.25),
      pink: toon(PINK, 0.2),
      eye: toon(EYE, 0.1),
      ring: toon(ring, 0.1),
      glow: toon(mixHex(EYE, '#ffffff', 0.45)),
      pupil: toon('#14183a'),
      hi: kit.glow('#ffffff'),
      collar: toon(COLLAR, 0.5),
      navy: toon(NAVY, 0.5),
      whisker: toon('#d9d2e3', 0.2),
      mouth: toon('#ff9fb0', 0.1),
      vertex: kit.toon('#ffffff', { ramp: RAMP, rim: 0.9, rimColor: RIM, vertexColors: true }),
    };

    const model = new THREE.Group();
    const motion = new THREE.Group();
    model.add(motion);

    // Torso: dark body, white bib, collar with the X tag, and two arms with paws.
    const torso = new THREE.Group();
    torso.position.y = 0.3 + 0.65;
    motion.add(torso);
    ellipsoid(kit, torso, M.shade, [0.65, 0.65, 0.58], [0, 0, 0], [24, 16]);
    ellipsoid(kit, torso, M.white, [0.5, 0.56, 0.34], [0, -0.1, 0.33], [28, 18]);
    const collarWrap = new THREE.Group();
    collarWrap.position.y = 0.33;
    collarWrap.scale.set(1, 1, 0.9);
    torso.add(collarWrap);
    part(kit, collarWrap, new THREE.TorusGeometry(0.575, 0.075, 6, 22), M.collar, [0, 0, 0], [Math.PI / 2, 0, 0]);
    const tag = new THREE.Group();
    tag.position.set(0, 0.3, 0.6);
    tag.rotation.x = -0.25;
    torso.add(tag);
    part(kit, tag, new THREE.TorusGeometry(0.045, 0.014, 6, 12), M.navy, [0, -0.02, 0]);
    const cross = new THREE.Group();
    cross.position.set(0, -0.22, 0.03);
    tag.add(cross);
    const barGeo = kit.own(new THREE.CapsuleGeometry(0.036, 0.26, 3, 8));
    instance(cross, barGeo, M.navy, [0, 0, 0], [0, 0, Math.PI / 4]);
    instance(cross, barGeo, M.navy, [0, 0, 0.012], [0, 0, -Math.PI / 4]);

    const armGeo = kit.own(new THREE.CapsuleGeometry(0.125, 0.26, 2, 7));
    const arms = ([-1, 1] as const).map((side) => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.58, 0.17, 0.12);
      arm.rotation.z = side * 0.42;
      instance(arm, armGeo, M.shade, [0, -0.2, 0]);
      const paw = new THREE.Group();
      paw.position.set(0, -0.47, 0.02);
      ellipsoid(kit, paw, M.white, [0.165, 0.16, 0.16], [0, 0, 0], [12, 9]);
      ellipsoid(kit, paw, M.pink, [0.065, 0.05, 0.03], [0, -0.03, 0.145], [9, 6]);
      for (const dx of [-0.07, 0, 0.07]) {
        ellipsoid(kit, paw, M.pink, [0.028, 0.03, 0.02], [dx, 0.05, 0.14 - Math.abs(dx) * 0.6], [9, 6]);
      }
      arm.add(paw);
      torso.add(arm);
      return { arm, side };
    });

    // Short legs with white feet.
    const legGeo = kit.own(new THREE.CapsuleGeometry(0.17, 0.1, 2, 8));
    const legs = ([-1, 1] as const).map((side) => {
      const leg = new THREE.Group();
      leg.position.set(side * 0.3, 0.46, 0.08);
      instance(leg, legGeo, M.shade, [0, -0.1, 0]);
      const foot = new THREE.Group();
      foot.position.set(0, -0.32, 0.08);
      ellipsoid(kit, foot, M.white, [0.215, 0.14, 0.3], [0, 0, 0], [12, 9]);
      leg.add(foot);
      motion.add(leg);
      return { leg, side };
    });

    // Tail: tapered tube, dark with a white tip, hanging from behind the body.
    const tail = new THREE.Group();
    tail.position.set(0, 0.55, -0.4);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.28, -0.02, -0.3),
      new THREE.Vector3(0.72, 0.3, -0.4),
      new THREE.Vector3(0.95, 0.9, -0.38),
      new THREE.Vector3(0.9, 1.5, -0.28),
    ]);
    const black = new THREE.Color(FUR);
    const tip = new THREE.Color(WHITE);
    const tmp = new THREE.Color();
    const tailColor = (t: number): THREE.Color => (t < 0.78 ? black : t > 0.85 ? tip : tmp.copy(black).lerp(tip, (t - 0.78) / 0.07));
    const tailRadius = (t: number): number => {
      const cap = t > 0.93 ? Math.sqrt(Math.max(0, 1 - ((t - 0.93) / 0.07) ** 2)) : 1;
      return (0.13 + 0.07 * t) * cap;
    };
    part(kit, tail, taperTube(curve, tailRadius, tailColor, 20, 8), M.vertex);
    motion.add(tail);

    // Head: wide ellipsoid with ears, big glossy eyes, nose, smile and whiskers.
    const head = new THREE.Group();
    head.position.set(0, HEAD_Y, 0.1);
    motion.add(head);
    ellipsoid(kit, head, M.fur, [RX, RY, RZ], [0, 0, 0], [24, 16]);

    const outerEar = kit.own(earShape(0.5, 0.82, 0.09, 12));
    const innerEar = kit.own(earShape(0.33, 0.58, 0.06, 10));
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.68, 0.6, -0.02);
      pivot.rotation.set(0.1, 0, -side * 0.38);
      const shape = new THREE.Group();
      shape.scale.z = 0.55;
      instance(shape, outerEar, M.fur);
      instance(shape, innerEar, M.earPink, [0, 0.08, 0.2]);
      pivot.add(shape);
      head.add(pivot);
    }

    const eyes = ([-1, 1] as const).map((side) => {
      const anchor = new THREE.Group();
      placeOnHead(anchor, side * 0.5, -0.04, 0);
      const ball = new THREE.Group();
      ellipsoid(kit, ball, M.ring, [0.31, 0.38, 0.1], [0, 0, 0], [12, 9]);
      ellipsoid(kit, ball, M.eye, [0.27, 0.34, 0.11], [0, 0, 0.014], [12, 9]);
      ellipsoid(kit, ball, M.glow, [0.19, 0.14, 0.11], [0, -0.14, 0.03], [9, 6]);
      ellipsoid(kit, ball, M.pupil, [0.115, 0.21, 0.11], [0, 0, 0.045], [9, 6]);
      ellipsoid(kit, ball, M.hi, [0.085, 0.095, 0.05], [-0.09, 0.13, 0.115], [9, 6]);
      ellipsoid(kit, ball, M.hi, [0.04, 0.04, 0.03], [0.09, -0.15, 0.115], [9, 6]);
      anchor.add(ball);
      head.add(anchor);
      return ball;
    });

    const nose = new THREE.Group();
    placeOnHead(nose, 0, -0.27, 0);
    ellipsoid(kit, nose, M.pink, [0.095, 0.07, 0.07], [0, 0, 0.02], [9, 6]);
    head.add(nose);
    const mouth = new THREE.Group();
    placeOnHead(mouth, 0, -0.43, 0.012);
    const mouthArc = kit.own(new THREE.TorusGeometry(0.075, 0.019, 6, 10, Math.PI));
    for (const s of [-1, 1]) instance(mouth, mouthArc, M.mouth, [s * 0.075, 0, 0], [0, 0, Math.PI]);
    part(kit, mouth, new THREE.CapsuleGeometry(0.017, 0.07, 2, 5), M.mouth, [0, 0.1, 0]);
    head.add(mouth);

    const whiskerGeo = kit.own(new THREE.CylinderGeometry(0.012, 0.01, 0.75, 4));
    whiskerGeo.translate(0, 0.31, 0);
    for (const side of [-1, 1]) {
      for (const [ang, dy] of [
        [0.24, 0],
        [0, -0.07],
        [-0.24, -0.14],
      ] as const) {
        const w = new THREE.Group();
        placeOnHead(w, side * 0.64, -0.38 + dy, 0);
        const m = instance(w, whiskerGeo, M.whisker);
        m.rotation.set(0, side * 0.12, -side * (Math.PI / 2 - ang));
        head.add(w);
      }
    }

    const { squash } = fitFigure(root, model, { headroom: HEADROOM, reachShare: 0.8 });

    // Pose state.
    let walk = 0;
    let air = 0;
    let armUp = 0;
    let sy = 1;
    let land = 0;
    let wasAir = false;
    let tailPhase = 0;
    let blinkAt = 2;
    let blinkT = -1;

    const apply = (time: number, sw: number, blink: number, tailAngle: number): void => {
      const breath = Math.sin(time * 2.2) * 0.02;
      const rz = sw * 0.07 * walk;
      // The sideways rock must never sink a foot, so it also lifts the body by the dip.
      // In the air the feet tuck up a little so the swinging legs never dip under the floor.
      motion.position.y = Math.abs(sw) * 0.09 * walk + Math.abs(rz) * 0.52 + 0.08 * air;
      motion.rotation.z = rz;
      squash.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
      torso.scale.set(1, 1 + breath, 1);
      head.position.y = HEAD_Y + breath * 0.84;
      head.rotation.z = -sw * 0.04 * walk;

      const swing = sw * 0.8 * walk;
      for (const { arm, side } of arms) {
        arm.rotation.z = side * (0.42 + armUp * 1.2);
        arm.rotation.x = side * swing;
      }
      const legSw = sw * 0.7 * walk + air * 0.35;
      for (const { leg, side } of legs) leg.rotation.x = (side > 0 ? -1 : 1) * legSw;

      tail.rotation.y = Math.sin(tailAngle) * (0.3 + 0.05 * walk);
      tail.rotation.x = -0.05;
      for (const eye of eyes) eye.scale.set(1, Math.max(0.08, 1 - 0.9 * blink), 1);
    };
    apply(0, 0, 0, 0);

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
        armUp = smoothValue(armUp, m.airborne ? (m.vy >= 0 ? 0.9 : 0.6) : 0, d, 12);
        sy = smoothValue(sy, 1 - 0.18 * land, d, 16);

        let blink = 0;
        if (blinkT < 0 && m.time > blinkAt) blinkT = 0;
        if (blinkT >= 0) {
          blinkT += d;
          const q = blinkT / 0.17;
          if (q >= 1) {
            blinkT = -1;
            blinkAt = m.time + 2 + Math.random() * 3;
          } else {
            blink = Math.sin(q * Math.PI);
          }
        }
        tailPhase += d * (1.3 + 2.2 * walk);
        apply(m.time, Math.sin(m.phase), blink, tailPhase);
      },
    };
  },
};
