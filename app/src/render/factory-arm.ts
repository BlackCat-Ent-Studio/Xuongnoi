import * as THREE from 'three';
import { FACTORY_ARM_LOOK, HINGE_LOOK } from '../engine/factory-looks';
import type { ArmHint, ArmPartKind } from '../engine/render-hints';
import type { EntityView, ViewMode } from '../engine/types';
import { adjustColor, armPartColor, buildWarning, pulseWarnings, toonMat } from './arm-part-models';
import { bakedMesh, box, cyl, plate, rbox, sizeKey, type Part, type XYZ } from './factory-kit';

/**
 * The tidy factory arm: a tapered link with round ends and a light stripe, a grey servo collar with a cap, a yellow pin
 * and six bolts, a dark palm with a yellow strip and dark fingers with yellow pads. A link that has a width (a plate) is
 * drawn as the AGV tray: a light plate at the link's real length x thickness x width with a dark mat whose top is the
 * plate's real top, a low rim in the link colour on the far end and the two sides (the hinge side stays open, that is
 * where a parcel slides off), and under it a hinge rod, a stand and a lifting rod that follows the tilt.
 *
 * Every part is built for the exact size of its block, along the block's +x with +y up, and baked into one mesh.
 * Draw only: the blocks keep their own collision boxes.
 */

const PAD = '#ffd23f';
const BOLT = '#c9ced6';
const DARK = '#2a2d34';
const STEEL = '#8f97a3';
const COLLAR = '#4a4f58';
const TRAY_PLATE = '#e9ecef';
const TRAY_MAT = '#3a3f47';
/** The tray's stand and posts reach this far (m) under the plate: mount the tilt joint so the plate clears the chassis by it. */
export const TRAY_STAND = 0.05;
/** Height (m) the tray's rim stands above the plate's real top. */
export const TRAY_RIM = 0.03;

/** Looks this file draws; any other look on an arm piece keeps the classic figure. */
export function isFactoryArmLook(look: string | undefined): boolean {
  return look === FACTORY_ARM_LOOK || look === HINGE_LOOK;
}

/** A link wider than it is thick is a plate: the factory look draws it as a tray. */
export const isTrayPlate = (size: XYZ): boolean => size.z > size.y + 1e-9;

// ---------------------------------------------------------------- parts

function linkParts(size: XYZ, color: string): Part[] {
  const L = size.x;
  const t = size.y;
  const w0 = t * 1.25;
  const w1 = t * 0.85;
  const dep = size.z * 0.8;
  const b = Math.min(0.02, t * 0.15, dep * 0.3);
  const s = new THREE.Shape();
  s.moveTo(0, w0 / 2 - b);
  s.lineTo(L, w1 / 2 - b);
  s.absarc(L, 0, w1 / 2 - b, Math.PI / 2, -Math.PI / 2, true);
  s.lineTo(0, -(w0 / 2 - b));
  s.absarc(0, 0, w0 / 2 - b, -Math.PI / 2, Math.PI / 2, true);
  const slab = new THREE.ExtrudeGeometry(s, { depth: dep - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 2, curveSegments: 6 });
  slab.translate(-L / 2, 0, -(dep - 2 * b) / 2);
  return [
    { geo: slab, color },
    { geo: rbox(L * 0.5, t * 0.3, dep + 0.012, 0.012), color: adjustColor(color, 0.2, 0.05) },
  ];
}

function trayTopParts(size: XYZ, color: string): Part[] {
  const { x: L, y: T, z: W } = size;
  return [
    { geo: plate(L, W, Math.max(T - 0.003, 0.01), Math.min(0.07, L * 0.12, W * 0.12), 0.008), color: TRAY_PLATE, at: [0, -T / 2, 0] },
    // the mat's top is the plate's real top: what rests on the tray is seen resting on it
    { geo: box(Math.max(L - 0.06, L * 0.6), 0.006, Math.max(W - 0.1, W * 0.6)), color: TRAY_MAT, at: [-0.02, T / 2 - 0.003, 0] },
    { geo: rbox(0.03, TRAY_RIM + 0.005, Math.max(W - 0.04, 0.03), 0.012), color, at: [L / 2 - 0.02, T / 2 + TRAY_RIM / 2 - 0.0025, 0] },
    ...[-1, 1].map(
      (s): Part => ({ geo: rbox(Math.max(L - 0.08, 0.03), TRAY_RIM + 0.005, 0.03, 0.012), color, at: [0.01, T / 2 + TRAY_RIM / 2 - 0.0025, s * (W / 2 - 0.02)] }),
    ),
  ];
}

/** What stays level under a tilting tray, in the frame of the hinge (origin on the hinge line, +x toward the far end). */
function trayBaseParts(size: XYZ): Part[] {
  const { x: L, y: T, z: W } = size;
  return [
    { geo: cyl('z', 0.016, W * 0.8, 8), color: STEEL, at: [0.012, -T / 2 - 0.004, 0] },
    ...[-1, 1].map((s): Part => ({ geo: box(0.03, TRAY_STAND, 0.03), color: DARK, at: [0.012, -T / 2 - TRAY_STAND / 2 - 0.004, s * W * 0.3] })),
    { geo: box(L * 0.4, TRAY_STAND + 0.006, W * 0.45), color: DARK, at: [L / 2, -T / 2 - TRAY_STAND / 2 - 0.003, 0] },
  ];
}

function jointParts(size: XYZ, color: string): Part[] {
  const r = Math.max(size.x, size.y) * 0.56;
  const len = size.z + 0.04;
  // caps, pins and bolts keep their proportion to the hub
  const k = r / 0.112;
  const cap = adjustColor(color, 0.12);
  const parts: Part[] = [{ geo: cyl('z', r, len, 20), color }];
  for (const s of [-1, 1]) {
    parts.push({ geo: cyl('z', r * 0.55, 0.03 * k, 16), color: cap, at: [0, 0, s * (len / 2 + 0.012 * k)] });
    parts.push({ geo: cyl('z', r * 0.2, 0.02 * k, 8), color: PAD, at: [0, 0, s * (len / 2 + 0.03 * k)] });
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      parts.push({ geo: cyl('z', 0.014 * k, 0.012 * k, 6), color: BOLT, at: [Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, s * (len / 2 + 0.003 * k)] });
    }
  }
  return parts;
}

function hingeParts(size: XYZ): Part[] {
  const len = size.z * 0.9;
  return [
    { geo: cyl('z', 0.02, len, 8), color: STEEL },
    ...[-1, 1].map((s): Part => ({ geo: cyl('z', 0.032, 0.02, 10), color: DARK, at: [0, 0, s * (len / 2)] })),
  ];
}

function palmParts(size: XYZ, color: string): Part[] {
  const alongZ = size.z > size.y;
  const across = alongZ ? size.y : size.z;
  return [
    { geo: rbox(size.x, size.y, size.z, 0.02), color },
    alongZ
      ? { geo: box(size.x * 0.5, 0.008, size.z * 0.9), color: PAD, at: [0, size.y / 2 + 0.002, 0] }
      : { geo: box(size.x * 0.5, size.y * 0.9, 0.008), color: PAD, at: [0, 0, size.z / 2 + 0.002] },
    { geo: cyl('x', across * 0.25, 0.06, 14), color: COLLAR, at: [-size.x / 2 - 0.02, 0, 0] },
  ];
}

function fingerParts(size: XYZ, color: string, side: 1 | -1, mode: ViewMode): Part[] {
  const inward = -side;
  return [
    { geo: rbox(size.x, size.y, size.z, 0.014), color },
    mode === '2d-side'
      ? { geo: box(size.x * 0.62, 0.012, size.z * 0.78), color: PAD, at: [size.x * 0.12, inward * (size.y / 2 - 0.001), 0] }
      : { geo: box(size.x * 0.62, size.y * 0.78, 0.012), color: PAD, at: [size.x * 0.12, 0, inward * (size.z / 2 - 0.001)] },
  ];
}

// ---------------------------------------------------------------- tray

const ROD_GEO = (() => {
  const g = new THREE.CylinderGeometry(0.013, 0.013, 1, 8);
  g.translate(0, 0.5, 0);
  return g;
})();
const UP = new THREE.Vector3(0, 1, 0);
const reach = new THREE.Vector3();

/** How far a block is pitched as the views draw it (the top view shows no pitch). */
function pitchOf(view: EntityView, mode: ViewMode): number {
  return mode === '3d' ? (view.tilt ?? 0) : mode === '2d-side' ? (view.angle ?? 0) : 0;
}

function buildTray(size: XYZ, color: string): { object: THREE.Group; pose: (view: EntityView, mode: ViewMode) => void } {
  const { x: L, y: T } = size;
  const object = new THREE.Group();
  object.add(bakedMesh(`tray-top|${sizeKey(size)}|${color}`, () => trayTopParts(size, color), undefined, true));
  // The stand, hinge and lifting rod belong to the chassis: this group undoes the tray's own tilt about the hinge line.
  const base = new THREE.Group();
  base.position.x = -L / 2;
  base.add(bakedMesh(`tray-base|${sizeKey(size)}`, () => trayBaseParts(size)));
  const rod = new THREE.Mesh(ROD_GEO, toonMat(BOLT));
  rod.castShadow = true;
  base.add(rod);
  object.add(base);
  const footX = L * 0.75;
  const footY = -T / 2 - TRAY_STAND;
  return {
    object,
    pose(view, mode) {
      const pitch = pitchOf(view, mode);
      base.rotation.z = -pitch;
      // From its foot on the chassis to the point of the plate's underside that started right above it.
      reach.set(footX * Math.cos(pitch) + (T / 2) * Math.sin(pitch) - footX, footX * Math.sin(pitch) - (T / 2) * Math.cos(pitch) - footY, 0);
      const len = reach.length();
      rod.visible = reach.y > 0.005;
      rod.position.set(footX, footY, 0);
      rod.scale.set(1, Math.max(len, 0.001), 1);
      rod.quaternion.setFromUnitVectors(UP, reach.normalize());
    },
  };
}

// ---------------------------------------------------------------- figure

/** One arm block in the factory look: placed and turned like the block, rebuilt only when its size, colour or hint changes. */
export class FactoryArmFigure {
  readonly object = new THREE.Group();
  private key = '';
  private pose: ((view: EntityView, mode: ViewMode) => void) | null = null;

  constructor(
    readonly part: ArmPartKind,
    readonly look: string,
  ) {}

  update(view: EntityView, mode: ViewMode, hint: ArmHint, nowMs: number): void {
    const { size } = view;
    const color = armPartColor(this.part, view.color);
    const warn = this.part === 'joint' && hint.overloaded === true;
    const key = [sizeKey(size), color, hint.axis ?? '', hint.side ?? 0, mode, warn, view.ownerNodeId].join('|');
    if (key !== this.key) {
      this.key = key;
      this.object.clear();
      this.pose = null;
      this.build(size, color, hint, mode, warn);
      this.object.traverse((o) => {
        o.userData.ownerNodeId = view.ownerNodeId;
      });
    }
    this.object.position.set(view.position.x, view.position.y, view.position.z);
    // Same turning rule as the classic figure: about Z in the side view, about the vertical axis (and tilt) elsewhere.
    this.object.rotation.order = 'YZX';
    this.object.rotation.set(0, mode === '2d-side' ? 0 : (view.angle ?? 0), mode === '2d-side' ? (view.angle ?? 0) : mode === '3d' ? (view.tilt ?? 0) : 0);
    this.pose?.(view, mode);
    if (warn) pulseWarnings(nowMs);
    this.object.updateMatrixWorld(true);
  }

  private build(size: XYZ, color: string, hint: ArmHint, mode: ViewMode, warn: boolean): void {
    const sk = sizeKey(size);
    switch (this.part) {
      case 'link': {
        if (isTrayPlate(size)) {
          const tray = buildTray(size, color);
          this.object.add(tray.object);
          this.pose = tray.pose;
        } else {
          this.object.add(bakedMesh(`arm-link|${sk}|${color}`, () => linkParts(size, color)));
        }
        break;
      }
      case 'joint': {
        const axis = hint.axis ?? 'pitch';
        const hub = this.look === HINGE_LOOK ? bakedMesh(`arm-hinge|${sk}`, () => hingeParts(size)) : bakedMesh(`arm-joint|${sk}|${color}`, () => jointParts(size, color));
        if (axis === 'yaw') hub.rotation.x = Math.PI / 2;
        this.object.add(hub);
        if (warn) this.object.add(buildWarning(Math.max(size.x, size.y) * 0.56, axis));
        break;
      }
      case 'palm':
        this.object.add(bakedMesh(`arm-palm|${sk}|${color}`, () => palmParts(size, color)));
        break;
      case 'finger': {
        const side = hint.side ?? 1;
        this.object.add(bakedMesh(`arm-finger|${sk}|${color}|${side}|${mode === '2d-side' ? 's' : 'f'}`, () => fingerParts(size, color, side, mode)));
        break;
      }
      default:
        break; // 'body' cubes are never drawn; pistons have no factory look
    }
  }

  /** Geometry and materials are shared by every figure, so there is nothing per-figure to free. */
  dispose(): void {
    this.object.clear();
  }
}

/** Parts this look can draw (a piston keeps its classic figure whatever look it carries). */
export function hasFactoryArmFigure(part: ArmPartKind, look: string | undefined): look is string {
  if (!isFactoryArmLook(look)) return false;
  if (look === HINGE_LOOK) return part === 'joint';
  return part === 'link' || part === 'joint' || part === 'palm' || part === 'finger';
}
