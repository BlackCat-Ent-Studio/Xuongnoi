import * as THREE from 'three';
import type { EntityView } from '../engine/types';
import { adjustColor } from './arm-part-models';
import { VERTEX_GLOW, bakedGeo, bakedMesh, cyl, glowMat, plate, q, rbox, type Part } from './factory-kit';
import { robotBodyColor } from './robot-models';

/**
 * A robot chassis drawn as the rounded AGV: a pill-shaped body in the chassis colour over a dark skirt, a light strip
 * running all round in a dark groove, a dark visor with two white "eye" lights on the nose and two red tail lights,
 * a dark deck on top, and at every motor mount a wheel (dark tyre, white rim, hub cap in the body colour) under a
 * round fender. Built in real units around the entity centre (floor at -height/2, nose toward +x, right side toward +z),
 * for any length, width, height and mount list. The body is the chassis's real length x width x height; the wheels and
 * fenders stand where the motors are, and the strip stands 6 mm proud of the body.
 *
 * The strip is blue while nothing rides on the chassis and green while the world reports a payload.
 * Draw only. One baked mesh for the body, one for the lights, one for the strip and one per wheel.
 */

const GAP = 0.04;
const DARK = '#2a2d34';
const TYRE = '#23252b';
const DECK = '#4a4f58';
const RIM = '#eef0f3';
const EYE = '#ffffff';
const TAIL = '#ff5a4a';
export const AGV_STRIP = { idle: '#39c6ff', loaded: '#45e07a' } as const;

interface Mount {
  forward: number;
  side: number;
  radius: number;
}

interface Dims {
  L: number;
  W: number;
  H: number;
}

/** Heights of the body parts above the floor: the coloured shell starts at `y0` and is `bh` tall. */
function levels(d: Dims): { r: number; y0: number; bh: number; stripY: number; eyeY: number } {
  const r = Math.min(0.17, d.W * 0.26, d.L * 0.26);
  const y0 = Math.min(GAP + 0.045, d.H * 0.45);
  const bh = Math.max(d.H - y0, 0.02);
  return { r, y0, bh, stripY: y0 + bh * 0.3, eyeY: y0 + bh * 0.68 };
}

function bodyParts(d: Dims, color: string, mounts: readonly Mount[]): Part[] {
  const { L, W, H } = d;
  const { r, y0, bh, stripY, eyeY } = levels(d);
  const skirt = Math.min(0.07, Math.max(0.02, H - GAP));
  const parts: Part[] = [
    { geo: plate(L * 0.95, W * 0.95, skirt, r * 0.9, 0.01, 1), color: DARK, at: [0, Math.min(GAP, H * 0.2), 0] },
    // the shell stops 4 mm under the chassis top and the deck fills the rest, so the deck's top is the real top
    { geo: plate(L, W, Math.max(bh - 0.004, 0.012), r, 0.025, 3, 2), color, at: [0, y0, 0] },
    // a dark groove behind the strip, so the light reads on any body colour
    { geo: plate(L + 0.006, W + 0.006, Math.min(0.04, bh * 0.5), r + 0.003, 0.004, 3), color: DARK, at: [0, stripY - 0.009, 0] },
    { geo: plate(L * 0.84, W * 0.82, 0.012, r * 0.75, 0.004, 1), color: DECK, at: [0, H - 0.012, 0] },
    { geo: rbox(0.03, bh * 0.36, Math.min(W * 0.46, W - 2 * r), 0.014), color: DARK, at: [L / 2 - 0.007, eyeY, 0] },
  ];
  const fender = adjustColor(color, -0.07);
  for (const w of mounts) {
    const s = Math.sign(w.side) || 1;
    parts.push({ geo: new THREE.TorusGeometry(w.radius + 0.012, 0.04, 5, 7, Math.PI), color: fender, at: [w.forward, w.radius + 0.004, w.side + s * 0.002] });
  }
  return parts;
}

function lightParts(d: Dims): Part[] {
  const { L, W } = d;
  const { eyeY } = levels(d);
  const parts: Part[] = [];
  for (const s of [-1, 1]) {
    parts.push({ geo: cyl('x', 0.017, 0.012, 8), color: EYE, at: [L / 2 + 0.008, eyeY, s * W * 0.11] });
    parts.push({ geo: cyl('x', 0.015, 0.012, 6), color: TAIL, at: [-L / 2 - 0.001, eyeY, s * W * 0.16] });
  }
  return parts;
}

function wheelParts(R: number, color: string): Part[] {
  return [
    { geo: cyl('z', R, 0.07, 14), color: TYRE },
    { geo: cyl('z', R * 0.58, 0.076, 10), color: RIM },
    { geo: cyl('z', R * 0.22, 0.084, 6), color },
  ];
}

export class AgvFigure {
  readonly object = new THREE.Group();

  private readonly body = new THREE.Group();
  private readonly wheelGroup = new THREE.Group();
  private wheels: THREE.Mesh[] = [];
  private strip: THREE.Mesh | null = null;
  private key = '';

  constructor() {
    this.object.add(this.body, this.wheelGroup);
  }

  private build(view: EntityView, d: Dims, color: string, mounts: readonly Mount[], mountKey: string): void {
    this.body.clear();
    this.wheelGroup.clear();
    const floor = -d.H / 2;
    const dimKey = `${q(d.L)}|${q(d.W)}|${q(d.H)}`;
    const shell = bakedMesh(`agv-body|${dimKey}|${color}|${mountKey}`, () => bodyParts(d, color, mounts), undefined, true);
    const lights = bakedMesh(`agv-lights|${dimKey}`, () => lightParts(d), VERTEX_GLOW);
    const { r, stripY, bh } = levels(d);
    const stripGeo = bakedGeo(`agv-strip|${dimKey}`, () => [{ geo: plate(d.L + 0.012, d.W + 0.012, Math.min(0.022, bh * 0.3), r + 0.006, 0.004, 3), color: '#ffffff', at: [0, stripY, 0] }]);
    this.strip = new THREE.Mesh(stripGeo, glowMat(AGV_STRIP.idle));
    for (const m of [shell, lights, this.strip]) {
      m.position.y = floor;
      this.body.add(m);
    }
    this.wheels = mounts.map((w) => {
      const mesh = bakedMesh(`agv-wheel|${q(w.radius)}|${color}`, () => wheelParts(w.radius, color));
      mesh.position.set(w.forward, floor + w.radius, w.side);
      this.wheelGroup.add(mesh);
      return mesh;
    });
    this.object.traverse((o) => {
      o.userData.ownerNodeId = view.ownerNodeId;
    });
  }

  /** Follow the entity: position, nose direction, wheel mounts and turning, colour, load light. */
  update(view: EntityView): void {
    const r = view.robot;
    const d: Dims = { L: r?.length ?? 1, W: r?.width ?? 0.7, H: view.size.y };
    const color = robotBodyColor(view.color);
    const mounts = r?.wheels ?? [];
    const mountKey = mounts.map((w) => `${q(w.side)},${q(w.forward)},${q(w.radius)}`).join(';');
    const key = `${q(d.L)}|${q(d.W)}|${q(d.H)}|${color}|${mountKey}|${view.ownerNodeId}`;
    if (key !== this.key) {
      this.key = key;
      this.build(view, d, color, mounts, mountKey);
    }
    this.object.position.set(view.position.x, view.position.y, view.position.z);
    this.object.rotation.y = -(r?.heading ?? 0);
    mounts.forEach((w, i) => {
      const mesh = this.wheels[i];
      if (mesh) mesh.rotation.z = -w.spin;
    });
    if (this.strip) this.strip.material = glowMat((r?.payload ?? 0) > 0 ? AGV_STRIP.loaded : AGV_STRIP.idle);
    this.object.updateMatrixWorld(true);
  }

  /** Geometry and materials are shared, so there is nothing per-figure to free. */
  dispose(): void {
    this.body.clear();
    this.wheelGroup.clear();
  }
}
