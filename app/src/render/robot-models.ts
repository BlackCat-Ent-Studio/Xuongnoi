import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { EntityView } from '../engine/types';
import { toonMat } from './arm-part-models';

/**
 * A robot chassis in the cartoon-factory look: a rounded body in the entity colour, a dark deck, a dark bumper with a
 * yellow strip on the nose (so the heading can be read from above), and one wheel per mounted motor (a black tyre with a
 * yellow hub and a dark bar, so the turning shows). Built in real units around the entity centre (floor at -height/2,
 * nose toward +x, right-hand side toward +z). The scene only moves and turns the group; it is never scaled.
 * Geometry is cached by size and materials by colour, so every chassis shares them.
 */

/** The colour the node had before this look existed: a chassis still carrying it is drawn in the look's orange. */
const OLD_DEFAULT_COLOR = '#3b82f6';
const LOOK_COLOR = '#ff9f2e';
const DECK_COLOR = '#4a4f58';
const BUMPER_COLOR = '#23252b';
const WHEEL_COLOR = '#23252b';
const HUB_COLOR = '#ffd23f';
/** Wheel thickness across the chassis, metres. */
const WHEEL_WIDTH = 0.1;
/** The chassis is lifted this far off the ground so the wheels carry it, metres. */
const GROUND_GAP = 0.04;

const geos = new Map<string, THREE.BufferGeometry>();
const q = (v: number): string => (Math.round(v * 1000) / 1000).toString();
function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geos.get(key);
  if (!g) {
    g = make();
    geos.set(key, g);
  }
  return g;
}
const box = (w: number, h: number, d: number): THREE.BufferGeometry => geo(`b|${q(w)}|${q(h)}|${q(d)}`, () => new THREE.BoxGeometry(w, h, d));
const rbox = (w: number, h: number, d: number, r: number, seg: number): THREE.BufferGeometry =>
  geo(`rb|${q(w)}|${q(h)}|${q(d)}|${q(r)}|${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, Math.max(0.002, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3))));
const zcyl = (r: number, len: number, seg: number): THREE.BufferGeometry =>
  geo(`cz|${q(r)}|${q(len)}|${seg}`, () => {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.rotateX(Math.PI / 2);
    return g;
  });

function part(parent: THREE.Object3D, g: THREE.BufferGeometry, color: string, at: [number, number, number]): void {
  const mesh = new THREE.Mesh(g, toonMat(color));
  mesh.position.set(at[0], at[1], at[2]);
  mesh.castShadow = true;
  parent.add(mesh);
}

/** The colour a chassis is drawn in: the user's, or the look's own while the param still holds the old default. */
export function robotBodyColor(color: string): string {
  return color.toLowerCase() === OLD_DEFAULT_COLOR ? LOOK_COLOR : color;
}

interface WheelMesh {
  group: THREE.Group;
}

export class RobotFigure {
  readonly object = new THREE.Group();

  private readonly body = new THREE.Group();
  private readonly wheelGroup = new THREE.Group();
  private wheels: WheelMesh[] = [];
  private wheelKey = '';
  private sizeKey = '';
  private colorHex: string;

  constructor(color: string) {
    this.colorHex = color;
    this.object.add(this.body, this.wheelGroup);
  }

  /** Rebuilds the chassis parts when its size or colour changes. */
  private buildBody(length: number, width: number, height: number): void {
    this.body.clear();
    const floor = -height / 2 + GROUND_GAP;
    const slab = Math.max(0.05, height * 0.6 - GROUND_GAP);
    const main = robotBodyColor(this.colorHex);
    part(this.body, rbox(length, slab, width, Math.min(0.1, slab * 0.4, width * 0.2), 2), main, [0, floor + slab / 2, 0]);
    const plate = Math.max(0.03, height * 0.25);
    part(this.body, box(length * 0.6, plate, width * 0.7), DECK_COLOR, [-length * 0.05, floor + slab + plate / 2, 0]);
    const bumperH = Math.max(0.04, slab * 0.6);
    part(this.body, rbox(0.07, bumperH, width * 1.02, 0.025, 1), BUMPER_COLOR, [length / 2 + 0.01, floor + slab * 0.5, 0]);
    part(this.body, box(0.04, Math.max(0.03, bumperH * 0.4), width * 0.7), HUB_COLOR, [length / 2 + 0.05, floor + slab * 0.5, 0]);
  }

  private buildWheels(view: EntityView): void {
    for (const w of this.wheels) this.wheelGroup.remove(w.group);
    this.wheels = [];
    const floor = -view.size.y / 2;
    for (const w of view.robot?.wheels ?? []) {
      const group = new THREE.Group();
      group.position.set(w.forward, floor + w.radius, w.side);
      part(group, zcyl(w.radius, WHEEL_WIDTH, 18), WHEEL_COLOR, [0, 0, 0]);
      part(group, zcyl(w.radius * 0.55, WHEEL_WIDTH * 1.2, 12), HUB_COLOR, [0, 0, 0]);
      part(group, box(w.radius * 0.95, w.radius * 0.2, WHEEL_WIDTH * 1.3), WHEEL_COLOR, [0, 0, 0]);
      this.wheelGroup.add(group);
      this.wheels.push({ group });
    }
  }

  setColor(color: string): void {
    if (color === this.colorHex) return;
    this.colorHex = color;
    this.sizeKey = ''; // rebuilt on the next update
  }

  /** Follow the entity: position, nose direction, wheel mounts and turning, colour, owner (for clicking in the game view). */
  update(view: EntityView): void {
    const r = view.robot;
    const p = view.position;
    this.setColor(view.color);
    this.object.position.set(p.x, p.y, p.z);
    this.object.rotation.y = -(r?.heading ?? 0);
    const sizeKey = `${r?.length}|${r?.width}|${view.size.y}`;
    if (sizeKey !== this.sizeKey) {
      this.sizeKey = sizeKey;
      this.buildBody(r?.length ?? 1, r?.width ?? 0.7, view.size.y);
    }
    // Wheels are rebuilt only when a motor is plugged, unplugged or re-tuned (their mounts are the key).
    const key = (r?.wheels ?? []).map((w) => `${w.side}|${w.forward}|${w.radius}`).join(';');
    if (key !== this.wheelKey) {
      this.wheelKey = key;
      this.buildWheels(view);
    }
    (r?.wheels ?? []).forEach((w, i) => {
      const mesh = this.wheels[i];
      if (mesh) mesh.group.rotation.z = -w.spin;
    });
    this.object.traverse((o) => {
      o.userData.ownerNodeId = view.ownerNodeId;
    });
    this.object.updateMatrixWorld(true);
  }

  /** Geometry and materials are shared, so there is nothing per-figure to free. */
  dispose(): void {
    this.body.clear();
    this.wheelGroup.clear();
  }
}
