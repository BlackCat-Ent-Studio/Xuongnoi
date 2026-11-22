/**
 * Development-only: the newly drawn machines of the outbound side of the design mock-up (roll cage, cage tug, box truck,
 * doors). Drawn with the factory look's own toolkit so they read as one family with the game's figures; none of them
 * exists as a game piece yet.
 */
import * as THREE from 'three';
import { VERTEX_GLOW, bakedGeo, bakedMesh, box, canvasTexture, cyl, rbox, type Part } from '../../src/render/factory-kit';
import { PIT } from './factory-mockup-ground';

const STEEL = '#7f8894', STEEL_DARK = '#4a515c', TYRE = '#22262d', WIRE = '#aab2bd', YELLOW = '#f2b90f', BLUE = '#2a6fd0', WHITE = '#f1f3f6';
/** The one accent of the tug fleet and of everything painted for it. */
export const TEAL = '#12a594';

/** Top of a cage's floor plate: where its cartons stand. */
export const CAGE_FLOOR = 0.33;
export const CAGE_SIDE = 0.98;

type At = [number, number, number];
const part = (list: Part[]) => (geo: THREE.BufferGeometry, color: string, at: At, turn?: At): void => { list.push({ geo, color, at, ...(turn ? { turn } : {}) }); };

/** A roll cage on castors, open enough underneath for a tug to drive in. Stands on y = 0. */
export function cageMesh(): THREE.Mesh {
  return bakedMesh('mock-cage', () => {
    const parts: Part[] = [], add = part(parts);
    add(rbox(CAGE_SIDE, 0.06, CAGE_SIDE, 0.02), STEEL_DARK, [0, CAGE_FLOOR - 0.03, 0]);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      add(cyl('x', 0.065, 0.045, 10), TYRE, [sx * 0.41, 0.065, sz * 0.41]);
      add(rbox(0.06, 0.2, 0.06, 0.01), STEEL_DARK, [sx * 0.41, 0.2, sz * 0.41]);
      add(cyl('y', 0.022, 1.45, 8), WIRE, [sx * 0.47, CAGE_FLOOR + 0.725, sz * 0.47]);
    }
    for (const y of [0.45, 0.95, 1.45]) for (const s of [-1, 1]) {
      add(cyl('x', 0.014, 0.94, 6), WIRE, [0, CAGE_FLOOR + y, s * 0.47]);
      add(cyl('z', 0.014, 0.94, 6), WIRE, [s * 0.47, CAGE_FLOOR + y, 0]);
    }
    for (const s of [-0.24, 0, 0.24]) for (const k of [-1, 1]) {
      add(cyl('y', 0.009, 1.4, 5), WIRE, [s, CAGE_FLOOR + 0.74, k * 0.47]);
      add(cyl('y', 0.009, 1.4, 5), WIRE, [k * 0.47, CAGE_FLOOR + 0.74, s]);
    }
    return parts;
  });
}

export const TUG = { L: 0.8, W: 0.58, wheelR: 0.07 };
/** The cage tug: a low carrier that drives under a cage and latches it with the pin on its back. Heads along +x. */
export function tugFigure(): THREE.Group {
  const g = new THREE.Group();
  g.add(bakedMesh('mock-tug', () => {
    const parts: Part[] = [], add = part(parts);
    add(rbox(TUG.L + 0.04, 0.07, TUG.W + 0.04, 0.03), TYRE, [0, 0.065, 0]);
    add(rbox(TUG.L, 0.13, TUG.W, 0.05), TEAL, [0, 0.135, 0]);
    add(rbox(0.46, 0.02, 0.36, 0.008), STEEL_DARK, [-0.04, 0.208, 0]);
    add(cyl('y', 0.04, 0.06, 12), STEEL, [-0.04, 0.24, 0]);
    add(cyl('y', 0.07, 0.03, 14), TYRE, [0.3, 0.212, 0]);
    for (const s of [-1, 1]) {
      add(cyl('z', TUG.wheelR, 0.05, 14), TYRE, [0, TUG.wheelR, s * (TUG.W / 2 + 0.005)]);
      add(box(0.34, 0.03, 0.006), YELLOW, [-0.12, 0.14, s * (TUG.W / 2 + 0.001)]);
    }
    return parts;
  }));
  g.add(bakedMesh('mock-tug-lights', () => {
    const parts: Part[] = [], add = part(parts);
    add(box(0.012, 0.035, 0.34), '#c9fff4', [TUG.L / 2 + 0.002, 0.14, 0]);
    for (const s of [-1, 1]) add(box(0.012, 0.035, 0.08), '#ff4b3e', [-TUG.L / 2 - 0.002, 0.14, s * 0.2]);
    return parts;
  }, VERTEX_GLOW));
  return g;
}

/**
 * A box truck. Local frame: the back of the box is z = 0 and the cab points to -z; y = 0 is the road it stands on, and
 * the floor of the box is `PIT` above it, level with the hall floor when the truck stands in its dock.
 */
export const TRUCK = { len: 4.4, inner: 2.28, boxLen: 2.8, boxH: 2.25 };
export function truckFigure(): { group: THREE.Group; rear: THREE.Mesh } {
  const g = new THREE.Group();
  const top = PIT + TRUCK.boxH;
  g.add(bakedMesh('mock-truck', () => {
    const parts: Part[] = [], add = part(parts);
    const mid = -TRUCK.boxLen / 2;
    add(box(0.9, 0.2, 4.1), STEEL_DARK, [0, 0.62, -2.15]);
    for (const z of [-0.85, -3.6]) for (const s of [-1, 1]) {
      add(cyl('x', 0.42, 0.28, 18), TYRE, [s * 0.98, 0.42, z]);
      add(cyl('x', 0.2, 0.3, 12), STEEL, [s * 0.98, 0.42, z]);
    }
    // the box: floor, two sides, roof, front; open at the back
    add(box(2.4, 0.1, TRUCK.boxLen), STEEL_DARK, [0, PIT - 0.05, mid]);
    for (const s of [-1, 1]) {
      add(box(0.06, TRUCK.boxH, TRUCK.boxLen), WHITE, [s * 1.17, PIT + TRUCK.boxH / 2, mid]);
      add(box(0.07, 0.34, TRUCK.boxLen - 0.3), BLUE, [s * 1.171, PIT + 1.0, mid]);
      add(box(0.09, TRUCK.boxH + 0.06, 0.09), STEEL, [s * 1.165, PIT + TRUCK.boxH / 2, -0.045]);
    }
    add(box(2.4, 0.06, TRUCK.boxLen), WHITE, [0, top + 0.03, mid]);
    add(box(2.4, TRUCK.boxH, 0.06), WHITE, [0, PIT + TRUCK.boxH / 2, -TRUCK.boxLen + 0.03]);
    add(box(2.42, 0.1, 0.09), STEEL, [0, top + 0.02, -0.045]);
    add(box(2.3, 0.14, 0.1), TYRE, [0, 0.66, -0.06]);
    // the cab
    add(rbox(2.2, 1.75, 1.45, 0.16), BLUE, [0, 1.5, -3.62]);
    add(box(1.86, 0.62, 0.05), '#1d2733', [0, 1.88, -4.33]);
    for (const s of [-1, 1]) add(box(0.05, 0.55, 0.7), '#1d2733', [s * 1.085, 1.9, -3.85]);
    add(rbox(2.26, 0.3, 0.2, 0.05), TYRE, [0, 0.68, -4.3]);
    add(rbox(1.9, 0.42, 0.95, 0.12), WHITE, [0, 2.5, -3.5]);
    return parts;
  }));
  g.add(bakedMesh('mock-truck-lights', () => {
    const parts: Part[] = [], add = part(parts);
    for (const s of [-1, 1]) { add(box(0.22, 0.1, 0.02), '#ff4b3e', [s * 0.95, 0.66, -0.005]); add(box(0.26, 0.12, 0.02), '#fff6d8', [s * 0.8, 0.9, -4.36]); }
    return parts;
  }, VERTEX_GLOW));
  // the roll-up door at the back: hangs from the roof, `scale.y` 1 = shut
  const rear = bakedMesh('mock-truck-rear', () => {
    const parts: Part[] = [], add = part(parts);
    add(box(TRUCK.inner, TRUCK.boxH, 0.04), '#d9dde3', [0, -TRUCK.boxH / 2, 0]);
    for (let k = 1; k < 8; k++) add(box(TRUCK.inner, 0.02, 0.05), '#aab2bd', [0, -k * (TRUCK.boxH / 8), 0]);
    add(box(0.5, 0.06, 0.07), STEEL_DARK, [0, -TRUCK.boxH + 0.2, 0]);
    return parts;
  });
  rear.position.set(0, top, -0.07);
  g.add(rear);
  return { group: g, rear };
}

/** The roller door of a dock: hangs from the top of its opening, `scale.y` 1 = shut. */
export const GATE = { w: 3.0, h: 3.6 };
export function gateMesh(): THREE.Mesh {
  return bakedMesh('mock-dock-gate', () => {
    const parts: Part[] = [], add = part(parts);
    add(box(GATE.w, GATE.h, 0.08), '#39404b', [0, -GATE.h / 2, 0]);
    for (let k = 1; k < 9; k++) add(box(GATE.w, 0.04, 0.1), '#566070', [0, -k * 0.4, 0]);
    return parts;
  });
}

/** The lights of one hole in one piece: a frame round the hole and a beacon on the deck, a ring under the deck. */
export function holeLightGeo(): THREE.BufferGeometry {
  return bakedGeo('mock-hole-light', () => {
    const parts: Part[] = [], add = part(parts);
    for (const s of [-1, 1]) {
      add(box(1.1, 0.03, 0.05), '#ffffff', [0, 0.02, s * 0.525]); add(box(0.05, 0.03, 1.0), '#ffffff', [s * 0.525, 0.02, 0]);
      add(box(1.16, 0.09, 0.06), '#ffffff', [0, -0.69, s * 0.55]); add(box(0.06, 0.09, 1.04), '#ffffff', [s * 0.55, -0.69, 0]);
    }
    add(cyl('y', 0.085, 0.16, 12), '#ffffff', [0.6, 0.62, 0.6]);
    return parts;
  });
}

/** The cover that shuts a locked hole: a plate that slides in from one side (`scale.x` 0 → 1). */
export function hatchMesh(): THREE.Mesh {
  hatchGeo ??= box(0.9, 0.024, 0.9).translate(0.45, 0, 0);
  if (!hatchMat) {
    const map = canvasTexture('mock-hatch', 256, 256, (g, w, h) => {
      g.fillStyle = '#d92b2b'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#ffffff'; g.lineWidth = 26;
      for (let x = -h; x < w + h; x += 84) { g.beginPath(); g.moveTo(x, h + 20); g.lineTo(x + h + 20, -20); g.stroke(); }
      g.strokeStyle = '#8f1515'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
    });
    hatchMat = new THREE.MeshLambertMaterial(map ? { map } : { color: '#d92b2b' });
  }
  return new THREE.Mesh(hatchGeo, hatchMat);
}
let hatchGeo: THREE.BufferGeometry | null = null, hatchMat: THREE.Material | null = null;
