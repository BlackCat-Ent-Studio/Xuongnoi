import * as THREE from 'three';
import {
  FLOOR_COLS,
  PAL,
  SIDE_COLS,
  WAIN_COLS,
  WALL_COLS,
  at,
  boardMesh,
  colsFront,
  rbox,
  rowsFront,
  rowsTop,
} from './stage-kit';
import { makeCrate, makeLamp, makePlant, makeShelf, makeWindow } from './stage-props';

/** Floors, walls and room decoration of the workshop. Everything is built once per scene and never moves, except the lamp. */

export interface Scenery {
  g: THREE.Group;
  /** Advances the small animations (lamp swing). */
  update(t: number): void;
}

/** Wooden floor strip seen from the side, with the cream plank back wall, window, shelf and one hanging lamp. */
export function makeSideRoom(x0: number, x1: number): Scenery {
  const g = new THREE.Group();
  const W = x1 - x0;
  const cx = (x0 + x1) / 2;

  // floor slab (the front shows the plank ends, the top shows the planks)
  const D = 4;
  const T = 8;
  g.add(at(rbox(W, T, D, PAL.slab, 0.22), cx, -T / 2, 0));
  g.add(boardMesh(rowsTop({ x0, x1, y: 0.006, zBack: -D / 2 + 0.24, zFront: D / 2 - 0.24, rowW: 0.58, minL: 2.2, maxL: 4, cols: FLOOR_COLS, seed: 7 })));
  g.add(boardMesh(rowsFront({ x0, x1, y0: -T + 0.24, y1: -0.24, z: D / 2 + 0.006, courseH: 1.0, minL: 2.4, maxL: 4.5, cols: SIDE_COLS, seed: 8 })));

  // back wall: cream boards above a wood wainscot, chair rail and skirting
  const h = 40;
  const z = -2.8;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, h + 0.4), new THREE.MeshToonMaterial({ color: '#b98a55' }));
  back.position.set(cx, h / 2 - 0.2, z);
  g.add(back);
  g.add(boardMesh(colsFront({ x0, x1, y0: 1.55, y1: h, z: z + 0.008, w: 1.1, cols: WALL_COLS, seed: 5 })));
  g.add(boardMesh(rowsFront({ x0, x1, y0: 0.32, y1: 1.42, z: z + 0.008, courseH: 0.55, minL: 2.5, maxL: 4.5, cols: WAIN_COLS, seed: 6 })));
  g.add(at(rbox(W, 0.18, 0.26, PAL.wood3, 0.07, 1), cx, 1.48, z + 0.12));
  g.add(at(rbox(W, 0.34, 0.22, PAL.wood2, 0.08, 1), cx, 0.17, z + 0.1));

  // decoration on the wall: window, shelf and one lamp
  const inside = (x: number): boolean => x > x0 + 2 && x < x1 - 2;
  if (inside(-15)) g.add(at(makeWindow(), -15, 4.3, z + 0.15));
  if (inside(0.8)) g.add(at(makeShelf(), 0.8, 3.7, z + 0.05));
  const lamp = makeLamp({ len: 3.3 });
  at(lamp.g, -6.2, 8.4, z + 1.1);
  g.add(lamp.g);
  return { g, update: lamp.update };
}

export interface TrayOptions {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** A full tray also gets the low walls and the corner decoration; a bank is only slab and planks. */
  walls: boolean;
  /** Spots (x, z) that hold gameplay objects: the decoration keeps away from them. */
  busy: ReadonlyArray<{ x: number; z: number }>;
  seed: number;
}

/** Wooden tray for the 3D stages: floor slab with planks, low walls on three sides and a few props in the corners. */
export function makeTray(o: TrayOptions): Scenery {
  const { x0, x1, z0, z1, walls, busy, seed } = o;
  const g = new THREE.Group();
  const W = x1 - x0;
  const D = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const T = 0.9;
  g.add(at(rbox(W, T, D, PAL.slab, 0.16), cx, -T / 2, cz));
  g.add(boardMesh(rowsTop({ x0: x0 + 0.12, x1: x1 - 0.12, y: 0.004, zBack: z0 + 0.12, zFront: z1 - 0.12, rowW: 0.6, gap: 0.04, minL: 2.4, maxL: 4.2, cols: FLOOR_COLS, seed })));
  g.add(boardMesh(rowsFront({ x0: x0 + 0.2, x1: x1 - 0.2, y0: -T + 0.14, y1: -0.14, z: z1 + 0.004, courseH: 0.62, minL: 2.6, maxL: 4.4, cols: SIDE_COLS, seed: seed + 3 })));
  if (!walls) return { g, update: () => undefined };

  const wall = (w: number, h: number, d: number, x: number, z: number): void => {
    g.add(at(rbox(w, h, d, PAL.wood3, 0.17), x, h / 2, z));
    g.add(at(rbox(w + 0.06, 0.16, d + 0.16, PAL.wood5, 0.07, 1), x, h + 0.02, z));
  };
  wall(W + 0.8, 0.95, 0.55, cx, z0 - 0.28);
  wall(0.55, 0.95, D + 0.55, x0 - 0.28, cz);
  wall(0.55, 0.95, D + 0.55, x1 + 0.28, cz);
  g.add(at(rbox(W + 0.8, 0.3, 0.4, PAL.wood3, 0.12, 1), cx, 0.15, z1 + 0.2));
  g.add(boardMesh(rowsFront({ x0: x0 + 0.1, x1: x1 - 0.1, y0: 0.14, y1: 0.8, z: z0 + 0.004, courseH: 0.33, minL: 2.6, maxL: 4.4, cols: WAIN_COLS, seed: seed + 5 })));

  // corner decoration, only where no game object stands
  const free = (x: number, z: number): boolean => busy.every((b) => Math.hypot(b.x - x, b.z - z) > 2.6);
  const spots: Array<{ x: number; z: number; make: () => THREE.Object3D }> = [
    { x: x0 + 1.5, z: z0 + 1.3, make: () => makePlantScaled(seed) },
    { x: x1 - 1.7, z: z0 + 1.4, make: () => makeCrateStack() },
    { x: x1 - 1.5, z: z1 - 1.3, make: () => makePlantScaled(seed + 1) },
    { x: x0 + 1.7, z: z1 - 1.4, make: () => makeSingleCrate() },
  ];
  for (const s of spots) {
    if (!free(s.x, s.z)) continue;
    const o3 = s.make();
    o3.position.set(s.x, 0, s.z);
    g.add(o3);
  }
  return { g, update: () => undefined };
}

function makePlantScaled(seed: number): THREE.Group {
  const p = makePlant(seed);
  p.scale.setScalar(1.3);
  return p;
}

function makeSingleCrate(): THREE.Group {
  const c = makeCrate();
  c.scale.setScalar(0.95);
  c.rotation.y = 0.3;
  return c;
}

function makeCrateStack(): THREE.Group {
  const g = new THREE.Group();
  const a = makeSingleCrate();
  const b = makeSingleCrate();
  b.position.set(-1.25, 0, 0.2);
  b.rotation.y = 0.05;
  const c = makeSingleCrate();
  c.position.set(-0.55, 0.95, 0.1);
  c.rotation.y = 0.5;
  g.add(a, b, c);
  return g;
}
