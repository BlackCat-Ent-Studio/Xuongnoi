import * as THREE from 'three';
import {
  PAL,
  at,
  ball,
  clamp,
  glowSprite,
  lathe,
  paint,
  rbox,
  ringShape,
  roundedPoly,
  rng,
  rrShape,
  sm01,
  toon,
  toonOwn,
} from './stage-kit';

/** Props of the cozy workshop, all built from rounded primitives. Origin of each prop = its base on the floor. */

export interface DoorProp {
  g: THREE.Group;
  /** 0 closed .. 1 open. */
  set(open: number): void;
}

/**
 * Wooden door seen edge-on from the side: a thin hinge post and a thin plank leaf that swings open about the
 * vertical hinge. `hz` = depth of the hinge, the leaf runs from there along +z when closed.
 */
export function makeDoor({ h = 3.6, L = 1.5, hz = -0.7, t = 0.14 }: { h?: number; L?: number; hz?: number; t?: number } = {}): DoorProp {
  const g = new THREE.Group();
  g.add(at(rbox(0.3, h + 0.1, 0.3, PAL.wood3, 0.1), 0, (h + 0.1) / 2, hz));
  g.add(at(ball(0.2, PAL.honey, 1, 0.8, 1, 12, 8), 0, h + 0.14, hz));
  const panel = new THREE.Group();
  panel.position.set(0, 0, hz);
  g.add(panel);
  panel.add(at(rbox(t, h, L, PAL.wood4, 0.06), 0, h / 2, L / 2 + 0.12));
  for (const f of [0.2, 0.78]) panel.add(at(rbox(0.06, 0.26, L - 0.2, PAL.wood3, 0.03, 1), -t * 0.64, h * f, L / 2 + 0.12));
  for (let i = 1; i <= 2; i++) panel.add(at(rbox(0.03, h - 0.4, 0.04, PAL.wood3, 0.012, 1), -t * 0.54, h / 2, 0.12 + (i * L) / 3));
  panel.add(at(ball(0.1, PAL.honey, 1, 1, 1, 12, 8), -t * 0.86, h * 0.47, L - 0.12));
  for (const f of [0.2, 0.78]) panel.add(at(rbox(0.2, 0.12, 0.1, PAL.honey, 0.04, 1), 0, h * f, 0.06));
  return {
    g,
    set(open: number) {
      panel.rotation.y = open * 1.5;
    },
  };
}

export interface ButtonProp {
  g: THREE.Group;
  /** 0 up .. 1 pressed. */
  set(v: number): void;
  dispose(): void;
}

/** Round floor button with a wooden ring; the cap takes the entity's colour. */
export function makeButton(capHex: string): ButtonProp {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [0.86, 0], [0.9, 0.05], [0.9, 0.12], [0.84, 0.18], [0.74, 0.18], [0.7, 0.14], [0.68, 0.08], [0, 0.08]], PAL.wood3, 28));
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    g.add(at(ball(0.07, PAL.honey, 1, 0.7, 1, 8, 6), Math.cos(a) * 0.8, 0.17, Math.sin(a) * 0.8));
  }
  const up = new THREE.Color(capHex);
  const down = up.clone().multiplyScalar(0.72);
  const capMat = toonOwn(capHex);
  const cap = new THREE.Group();
  g.add(cap);
  cap.add(lathe([[0, 0], [0.6, 0], [0.64, 0.05], [0.64, 0.11], [0.57, 0.2], [0.4, 0.25], [0, 0.27]], capMat, 28));
  cap.add(at(ball(0.15, '#ffffff', 1, 0.25, 0.7, 10, 6), -0.2, 0.265, 0.16));
  cap.position.y = 0.12;
  const shine = cap.children[1] as THREE.Mesh;
  shine.material = toonOwn('#ffe9df', { transparent: true, opacity: 0.8 });
  return {
    g,
    set(v: number) {
      cap.position.y = 0.12 - 0.11 * v;
      capMat.color.copy(up).lerp(down, v);
    },
    dispose() {
      capMat.dispose();
      (shine.material as THREE.Material).dispose();
    },
  };
}

export interface FlagProp {
  g: THREE.Group;
  update(t: number, boost?: number): void;
}

/** Goal flag on a small round base; the cloth waves. */
export function makeFlag(): FlagProp {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [0.38, 0], [0.42, 0.04], [0.4, 0.12], [0.3, 0.18], [0.1, 0.2], [0, 0.2]], PAL.wood3, 24));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 10), toon(PAL.cream3)), 0, 1.35, 0));
  g.add(at(ball(0.11, PAL.honey, 1, 1, 1, 14, 10), 0, 2.6, 0));
  const N = 10;
  const L = 1.25;
  const H = 0.85;
  const yc = 2.05;
  const pos = new Float32Array((N + 1) * 2 * 3);
  const idx: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  g.add(new THREE.Mesh(geo, toonOwn(PAL.red, { side: THREE.DoubleSide })));
  function wave(t: number, boost: number): void {
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = 0.06 + u * L;
      const half = (H / 2) * (1 - 0.8 * u);
      const z = Math.sin(u * 5 - t * (4 + boost * 3)) * (0.07 + boost * 0.05) * u * 2.2;
      const sag = -u * u * 0.1;
      p.setXYZ(i * 2, x, yc + half + sag, z);
      p.setXYZ(i * 2 + 1, x, yc - half + sag, z);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  }
  wave(0, 0);
  return { g, update: wave };
}

export interface LampProp {
  g: THREE.Group;
  update(t: number): void;
}

/** Hanging lamp; origin = ceiling anchor, swings gently. */
export function makeLamp({ len = 2.4 }: { len?: number } = {}): LampProp {
  const g = new THREE.Group();
  const sw = new THREE.Group();
  g.add(sw);
  sw.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 6), toon(PAL.wood1)), 0, -len / 2, 0));
  sw.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.2, 12), toon(PAL.wood2)), 0, -len - 0.02, 0));
  const shade = lathe(
    ([[0.14, 0], [0.2, -0.08], [0.34, -0.3], [0.52, -0.52], [0.7, -0.7]] as Array<[number, number]>).reverse(),
    PAL.amber,
    28,
    THREE.DoubleSide,
  );
  shade.position.y = -len - 0.1;
  sw.add(shade);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.055, 8, 28), toon(PAL.cream));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -len - 0.8;
  sw.add(rim);
  sw.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshBasicMaterial({ color: '#fff1c0' })), 0, -len - 0.62, 0));
  const glow = glowSprite(5.2, 0.85);
  if (glow) {
    glow.position.set(0, -len - 0.85, -0.3);
    glow.renderOrder = -1;
    sw.add(glow);
  }
  return {
    g,
    update(t: number) {
      sw.rotation.z = Math.sin(t * 0.95) * 0.06;
      if (glow) glow.material.opacity = 0.78 + 0.08 * Math.sin(t * 1.7);
    },
  };
}

/** Wooden crate: rounded body with darker corner posts and rims. 1 unit wide, base on the floor. */
export function makeCrate(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(rbox(1, 1, 1, PAL.crate, 0.12, 1), 0, 0.5, 0));
  for (const y of [0.13, 0.87]) g.add(at(rbox(1.06, 0.18, 1.06, PAL.crateDark, 0.07, 1), 0, y, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(rbox(0.15, 1.04, 0.15, PAL.crateDark, 0.06, 1), sx * 0.46, 0.52, sz * 0.46));
  for (const x of [-0.18, 0.18]) g.add(at(rbox(0.04, 0.02, 0.8, '#8a5430', 0.01, 1), x, 1.012, 0));
  return g;
}

export interface StarProp {
  g: THREE.Group;
  update(t: number): void;
}

/** Chunky rounded gold star, about 1 unit across, centred on its origin. */
export function makeStar(): StarProp {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 ? 0.27 : 0.52;
    pts.push(new THREE.Vector2(Math.cos(a) * r, -Math.sin(a) * r));
  }
  const geo = new THREE.ExtrudeGeometry(roundedPoly(pts, 0.085), {
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 3,
    curveSegments: 5,
  });
  geo.center();
  const mat = toonOwn('#ffc93c', { emissive: new THREE.Color('#8a5a00'), emissiveIntensity: 0.55 });
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(new THREE.Mesh(geo, mat));
  g.add(inner);
  const glow = glowSprite(2.2, 0.6);
  if (glow) {
    glow.position.z = -0.35;
    glow.renderOrder = -1;
    g.add(glow);
  }
  return {
    g,
    update(t: number) {
      inner.rotation.y = t * 2.1;
      inner.position.y = Math.sin(t * 2.6) * 0.06;
      if (glow) glow.material.opacity = 0.5 + 0.15 * Math.sin(t * 3);
    },
  };
}

/** Painted storage zone: sage paint, cream border, honey corner dots, box icon. `w` = side length. */
export function makeZonePad(w: number): THREE.Group {
  const g = new THREE.Group();
  g.add(paint(rrShape(w, w, 0.34), 0.05, '#9cc194', 0));
  g.add(paint(ringShape(w - 0.3, w - 0.3, 0.26, 0.1), 0.02, PAL.cream, 0.05));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) g.add(paint(rrShape(0.5, 0.5, 0.17), 0.03, PAL.honey, 0.05).translateX(sx * (w / 2 - 0.5)).translateZ(sz * (w / 2 - 0.5)));
  }
  g.add(paint(ringShape(1.0, 1.0, 0.2, 0.13), 0.03, PAL.honey, 0.05));
  const ch = roundedPoly(
    [new THREE.Vector2(-0.42, 0.18), new THREE.Vector2(0, -0.14), new THREE.Vector2(0.42, 0.18), new THREE.Vector2(0.42, 0.42), new THREE.Vector2(0, 0.1), new THREE.Vector2(-0.42, 0.42)],
    0.07,
  );
  for (const z of [-1.0, -0.62]) g.add(paint(ch, 0.025, PAL.cream, 0.05).translateZ(z));
  return g;
}

/** Painted store mat for a store with marked slots: sage paint and a cream border only (the slots are drawn on top). */
export function makeSlotMat(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  g.add(paint(rrShape(w, d, 0.34), 0.05, '#9cc194', 0));
  g.add(paint(ringShape(w - 0.3, d - 0.3, 0.26, 0.1), 0.02, PAL.cream, 0.05));
  return g;
}

/** Round goal pad: sage disc, cream ring, honey star. About 2 units across. */
export function makeGoalPad(): THREE.Group {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [0.98, 0], [1.02, 0.03], [1.02, 0.07], [0.96, 0.1], [0, 0.1]], '#9cc194', 32));
  g.add(lathe([[0.66, 0.1], [0.68, 0.125], [0.8, 0.125], [0.82, 0.1]], PAL.cream, 32));
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 ? 0.17 : 0.36;
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  g.add(paint(roundedPoly(pts, 0.06), 0.035, PAL.honey, 0.1));
  return g;
}

export function makePlant(seed = 9): THREE.Group {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [0.17, 0], [0.25, 0.26], [0.29, 0.28], [0.29, 0.36], [0.24, 0.36], [0, 0.32]], '#c06a3a', 18));
  const R = rng(seed);
  for (let i = 0; i < 7; i++) {
    const leaf = ball(1, PAL.sage, 0.075, 0.34 + R() * 0.18, 0.04, 6, 4);
    const a = (i / 7) * Math.PI * 2;
    const holder = new THREE.Group();
    holder.rotation.set(0, a, 0.22 + R() * 0.5);
    leaf.position.y = 0.45;
    holder.add(leaf);
    holder.position.y = 0.3;
    g.add(holder);
  }
  return g;
}

export function makeWindow(): THREE.Group {
  const g = new THREE.Group();
  const w = 2.2;
  const h = 1.8;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 4), new THREE.MeshBasicMaterial({ vertexColors: true }));
  const cols: number[] = [];
  const gp = glass.geometry.attributes.position as THREE.BufferAttribute;
  const c = new THREE.Color();
  for (let i = 0; i < gp.count; i++) {
    c.set('#bfe3ee').lerp(new THREE.Color('#f7f1d6'), 1 - (gp.getY(i) + h / 2) / h);
    cols.push(c.r, c.g, c.b);
  }
  glass.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  glass.position.z = -0.02;
  g.add(glass);
  g.add(at(rbox(w + 0.4, 0.22, 0.26, PAL.wood3, 0.09, 1), 0, h / 2 + 0.1, 0.05), at(rbox(w + 0.4, 0.22, 0.26, PAL.wood3, 0.09, 1), 0, -h / 2 - 0.1, 0.05));
  for (const s of [-1, 1]) g.add(at(rbox(0.22, h + 0.44, 0.26, PAL.wood3, 0.09, 1), s * (w / 2 + 0.1), 0, 0.05));
  g.add(at(rbox(0.08, h, 0.12, PAL.wood3, 0.03, 1), 0, 0, 0.05), at(rbox(w, 0.08, 0.12, PAL.wood3, 0.03, 1), 0, 0.05, 0.05));
  g.add(at(rbox(w + 0.9, 0.14, 0.5, PAL.wood4, 0.06, 1), 0, -h / 2 - 0.3, 0.2));
  const pl = at(makePlant(), 0.55, -h / 2 - 0.23, 0.22);
  pl.scale.setScalar(0.85);
  g.add(pl);
  return g;
}

export function makeShelf(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(rbox(2.8, 0.16, 0.7, PAL.wood4, 0.06, 1), 0, 0, 0.35));
  for (const s of [-1, 1]) g.add(at(rbox(0.14, 0.5, 0.5, PAL.wood3, 0.05, 1), s * 1.0, -0.3, 0.27));
  const books: Array<[string, number, number]> = [
    ['#e0553f', 0.5, -1.05],
    ['#93b58c', 0.44, -0.86],
    ['#ffb938', 0.52, -0.67],
  ];
  for (const [c, hh, x] of books) g.add(at(rbox(0.16, hh, 0.4, c, 0.05, 1), x, 0.08 + hh / 2, 0.4));
  g.add(at(lathe([[0, 0], [0.24, 0], [0.28, 0.1], [0.26, 0.44], [0.2, 0.5], [0, 0.5]], '#e9f1e6', 18), 0.35, 0.08, 0.38));
  g.add(at(lathe([[0, 0], [0.2, 0], [0.2, 0.08], [0, 0.08]], PAL.honey, 14), 0.35, 0.58, 0.38));
  const pl = at(makePlant(), 1.0, 0.08, 0.36);
  pl.scale.setScalar(0.6);
  g.add(pl);
  return g;
}

/** Eased 0..1 progress helper shared by the animated figures. */
export function approach(current: number, target: number, dt: number, seconds: number): number {
  if (dt <= 0) return target;
  const step = dt / seconds;
  return clamp(current + clamp(target - current, -step, step), 0, 1);
}

export { sm01 };
