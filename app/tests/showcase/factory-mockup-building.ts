/**
 * Development-only: the warehouse around the sorting floor of the design mock-up. The sorting floor is a mezzanine whose
 * top is y = 0; the ground floor lies `G` below. Everything here is still scenery drawn with the factory look's own
 * toolkit (same toon material, same rounded boxes), so it reads as one family with the game's figures. None of it exists
 * as a game piece yet.
 */
import * as THREE from 'three';
import type { EntityView } from '../../src/engine/types';
import { AgvFigure } from '../../src/render/factory-agv';
import { VERTEX_GLOW, bakedMesh, box, canvasTexture, cyl, rbox, type Part } from '../../src/render/factory-kit';

export const GROUND = 2.6;
const G = GROUND;
const STEEL = '#7f8894', STEEL_DARK = '#4a515c', YELLOW = '#f2b90f', BLUE = '#2a6fd0', BELT_DARK = '#2f333b', CARTON = '#c8975a', WALL = '#e3e6ea', WALL_BAND = '#8e98a5', ORANGE = '#f08a1c', PALLET = '#b98a55', WIRE = '#aab2bd';
const WRAPS = [CARTON, '#d8c9a8', '#b9c8dc', CARTON, '#cfd6de'];

export interface FloorPlan {
  id: string;
  /** Width (x) and depth (z) of the lane grid, from the middle of the first cell to the middle of the last. */
  W: number; D: number;
  holes: readonly { n: number; x: number; z: number; color: string }[];
  /** Feeding stations: hand-over cell and which way the belt runs (+1 = from the west). */
  stations: readonly { x: number; z: number; dir: 1 | -1; beltFar: number }[];
}

function sign(text: string, w: number, h: number, fg: string, bg: string): THREE.Mesh | null {
  const tex = canvasTexture(`sign|${text}|${fg}|${bg}`, 1024, Math.round((1024 * h) / w), (g, cw, ch) => {
    g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = ch * 0.56;
    g.font = `800 ${size}px "Segoe UI", Arial, sans-serif`;
    while (g.measureText(text).width > cw * 0.9 && size > 10) { size -= 4; g.font = `800 ${size}px "Segoe UI", Arial, sans-serif`; }
    g.fillText(text, cw / 2, ch / 2 + size * 0.04);
  });
  if (!tex) return null;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}

/** Adds the warehouse to `stage`; returns what must be freed when the layout changes. */
export function addBuilding(stage: THREE.Group, plan: FloorPlan): () => void {
  const { W, D } = plan;
  const west = plan.stations.some((s) => s.dir === 1), east = plan.stations.some((s) => s.dir === -1);
  const x0 = west ? -6.6 : -1.3, x1 = east ? W + 6.6 : W + 1.3, z0 = -1.3, z1 = D + 3.6;
  const gy = -G;
  const parts: Part[] = [], glow: Part[] = [];
  const add = (geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, turn?: [number, number, number]): void => { parts.push({ geo, color, at: [x, y, z], ...(turn ? { turn } : {}) }); };
  const lamp = (geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number): void => { glow.push({ geo, color, at: [x, y, z] }); };
  const free: (() => void)[] = [];

  // ---- mezzanine: deck plate, yellow edge, columns
  add(box(x1 - x0, 0.25, z1 - z0), STEEL, (x0 + x1) / 2, -0.131, (z0 + z1) / 2);
  add(box(x1 - x0 + 0.06, 0.3, 0.06), YELLOW, (x0 + x1) / 2, -0.15, z0); add(box(x1 - x0 + 0.06, 0.3, 0.06), YELLOW, (x0 + x1) / 2, -0.15, z1);
  add(box(0.06, 0.3, z1 - z0), YELLOW, x0, -0.15, (z0 + z1) / 2); add(box(0.06, 0.3, z1 - z0), YELLOW, x1, -0.15, (z0 + z1) / 2);
  const colH = G - 0.25;
  const column = (x: number, z: number): void => { add(rbox(0.2, colH, 0.2, 0.03), STEEL_DARK, x, -0.25 - colH / 2, z); add(box(0.42, 0.04, 0.42), STEEL_DARK, x, gy + 0.02, z); };
  for (let x = 0; x <= W + 0.01; x += 2.8) for (let z = 0; z <= D + 0.01; z += 2.8) column(x, z);
  for (const x of [x0 + 0.3, x1 - 0.3]) for (let z = z0 + 0.3; z <= z1; z += 2.8) if (x < -0.5 || x > W + 0.5) column(x, z);
  for (let x = 0; x <= W + 0.01; x += 2.8) column(x, z1 - 0.3);

  // ---- railing round the deck, open where a ramp or the stairs meet it
  const stairX = W * 0.72;
  const rail = (ax: number, az: number, bx: number, bz: number, gaps: [number, number][]): void => {
    const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
    const from = alongX ? Math.min(ax, bx) : Math.min(az, bz), to = alongX ? Math.max(ax, bx) : Math.max(az, bz);
    // the stretches left between the openings
    const runs: [number, number][] = [];
    let at = from;
    for (const [a, b] of [...gaps].sort((m, n) => m[0] - n[0])) { if (a > at) runs.push([at, a]); at = Math.max(at, b); }
    if (to > at) runs.push([at, to]);
    for (const [a, b] of runs) {
      const len = b - a, mid = (a + b) / 2, posts = Math.max(1, Math.round(len / 1.4));
      for (const y of [0.55, 1.05]) add(cyl(alongX ? 'x' : 'z', 0.025, len, 8), YELLOW, alongX ? mid : ax, y, alongX ? az : mid);
      for (let i = 0; i <= posts; i++) { const u = a + (len * i) / posts; add(cyl('y', 0.03, 1.08, 8), YELLOW, alongX ? u : ax, 0.54, alongX ? az : u); }
    }
  };
  const rampGaps = (dir: 1 | -1): [number, number][] => plan.stations.filter((s) => s.dir === dir).map((s) => [s.z - 0.55, s.z + 0.55]);
  rail(x0, z0, x1, z0, []);
  rail(x0, z1, x1, z1, [[stairX - 0.7, stairX + 0.7]]);
  rail(x0, z0, x0, z1, rampGaps(1));
  rail(x1, z0, x1, z1, rampGaps(-1));

  // ---- stairs down to the ground floor on the south side
  const steps = 13, rise = G / steps, run = 0.3;
  for (let i = 0; i < steps; i++) add(rbox(1.2, 0.06, run, 0.01), STEEL, stairX, -rise * (i + 1) + 0.03, z1 + run * (i + 0.5));
  const slope = Math.atan2(G, steps * run), stairLen = Math.hypot(G, steps * run);
  for (const s of [-1, 1]) {
    add(box(0.06, 0.24, stairLen), STEEL_DARK, stairX + s * 0.63, -G / 2 - 0.1, z1 + (steps * run) / 2, [slope, 0, 0]);
    add(cyl('z', 0.025, stairLen, 8), YELLOW, stairX + s * 0.63, -G / 2 + 0.95, z1 + (steps * run) / 2, [slope, 0, 0]);
    for (const k of [0, 0.5, 1]) add(cyl('y', 0.025, 1.0, 8), YELLOW, stairX + s * 0.63, -G * k + 0.45, z1 + steps * run * k);
  }

  // ---- roll cages under every hole, a few parcels in each, aisle lines on the floor
  for (const h of plan.holes) {
    const b = gy + 0.16;
    add(rbox(0.98, 0.06, 0.98, 0.02), STEEL_DARK, h.x, b, h.z);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      add(cyl('x', 0.06, 0.05, 10), '#22262d', h.x + sx * 0.4, gy + 0.06, h.z + sz * 0.4);
      add(cyl('y', 0.022, 1.45, 8), WIRE, h.x + sx * 0.47, b + 0.75, h.z + sz * 0.47);
    }
    for (const y of [0.45, 0.95, 1.45]) {
      for (const s of [-1, 1]) { add(cyl('x', 0.014, 0.94, 6), WIRE, h.x, b + y, h.z + s * 0.47); add(cyl('z', 0.014, 0.94, 6), WIRE, h.x + s * 0.47, b + y, h.z); }
    }
    for (const s of [-0.24, 0, 0.24]) add(cyl('y', 0.01, 1.4, 6), WIRE, h.x + s, b + 0.74, h.z - 0.47);
    add(box(0.5, 0.2, 0.02), h.color, h.x, b + 1.2, h.z + 0.49);
    const fill = 1 + ((h.n * 7) % 4);
    for (let i = 0; i < fill; i++) {
      const s = 0.26 + ((h.n + i * 3) % 3) * 0.06;
      add(rbox(s + 0.08, s, s, 0.02), CARTON, h.x + ((i % 2) - 0.5) * 0.4, b + 0.04 + s / 2 + Math.floor(i / 2) * 0.36, h.z + (((i + h.n) % 2) - 0.5) * 0.36, [0, (h.n + i) * 0.4, 0]);
    }
  }
  const rowsZ = [...new Set(plan.holes.map((h) => h.z))];
  for (const z of rowsZ) for (const s of [-1, 1]) add(box(W + 1.6, 0.012, 0.08), YELLOW, W / 2, gy + 0.007, z + s * 0.78);

  // ---- inbound: a trunk conveyor on the ground along each fed side, a ramp up to every station belt
  for (const dir of [1, -1] as const) {
    const side = plan.stations.filter((s) => s.dir === dir);
    if (side.length === 0) continue;
    const runX = 5.2, topY = 0.44, lowY = gy + 0.78;
    const zs = side.map((s) => s.z), zMin = Math.min(...zs) - 2.2, zMax = Math.max(...zs) + 1.2;
    const farX = side[0]!.beltFar, trunkX = farX - dir * (runX + 0.45);
    add(box(0.7, 0.12, zMax - zMin), BELT_DARK, trunkX, lowY - 0.06, (zMin + zMax) / 2);
    for (const s of [-1, 1]) add(box(0.05, 0.16, zMax - zMin), BLUE, trunkX + s * 0.36, lowY - 0.02, (zMin + zMax) / 2);
    for (let z = zMin + 0.4; z < zMax; z += 1.6) for (const s of [-1, 1]) add(rbox(0.06, lowY - gy - 0.1, 0.06, 0.01), STEEL, trunkX + s * 0.3, (lowY - 0.1 + gy) / 2, z);
    for (let z = zMin + 0.5, i = 0; z < zMax - 0.3; z += 1.15, i++) add(rbox(0.34, 0.26, 0.3, 0.02), WRAPS[i % WRAPS.length]!, trunkX, lowY + 0.13, z, [0, i * 0.5, 0]);
    for (const s of side) {
      const ax = s.beltFar, bx = s.beltFar - dir * runX;
      const len = Math.hypot(runX, topY - lowY), ang = Math.atan2(topY - lowY, runX) * dir;
      const mx = (ax + bx) / 2, my = (topY + lowY) / 2;
      add(box(len, 0.1, 0.6), BELT_DARK, mx, my - 0.05, s.z, [0, 0, ang]);
      for (const k of [-1, 1]) add(box(len, 0.16, 0.05), BLUE, mx, my, s.z + k * 0.31, [0, 0, ang]);
      for (const t of [0.25, 0.6]) add(rbox(0.3, 0.22, 0.26, 0.02), CARTON, bx + (ax - bx) * t, lowY + (topY - lowY) * t + 0.12, s.z, [0, 0, ang]);
      for (const t of [0.2, 0.55, 0.9]) { const px = bx + (ax - bx) * t, py = lowY + (topY - lowY) * t - 0.1; if (py - gy > 0.3) for (const k of [-1, 1]) add(rbox(0.06, py - gy, 0.06, 0.01), STEEL, px, (py + gy) / 2, s.z + k * 0.26); }
    }
  }

  // ---- the building: back wall with dock doors, one side wall, pallet racking, lamps
  const zN = z0 - 9.5, xw0 = x0 - 13, xw1 = x1 + 13, H = 9.5, wy = gy + H / 2;
  const wallLen = xw1 - xw0, sideLen = z1 + 12 - zN;
  add(box(wallLen, H, 0.3), WALL, (xw0 + xw1) / 2, wy, zN);
  add(box(wallLen, 1.3, 0.36), WALL_BAND, (xw0 + xw1) / 2, gy + 0.65, zN);
  add(box(wallLen, 0.4, 0.34), BLUE, (xw0 + xw1) / 2, gy + 5.6, zN);
  add(box(0.3, H, sideLen), WALL, xw0, wy, zN + sideLen / 2);
  add(box(0.36, 1.3, sideLen), WALL_BAND, xw0, gy + 0.65, zN + sideLen / 2);
  add(box(0.34, 0.4, sideLen), BLUE, xw0, gy + 5.6, zN + sideLen / 2);
  for (let x = xw0; x <= xw1 + 0.01; x += wallLen / 8) add(box(0.4, H, 0.4), '#c5cad2', x, wy, zN + 0.05);
  for (let z = zN; z <= zN + sideLen + 0.01; z += sideLen / 6) add(box(0.4, H, 0.4), '#c5cad2', xw0 + 0.05, wy, z);
  const doors = Math.max(3, Math.round(wallLen / 9));
  for (let i = 0; i < doors; i++) {
    const x = xw0 + (wallLen * (i + 0.5)) / doors;
    add(box(3.4, 3.8, 0.38), '#39404b', x, gy + 1.9, zN + 0.02);
    for (let k = 0; k < 9; k++) add(box(3.3, 0.04, 0.4), '#566070', x, gy + 0.35 + k * 0.4, zN + 0.03);
    add(box(3.8, 0.3, 0.42), YELLOW, x, gy + 3.95, zN + 0.03);
    for (const s of [-1, 1]) add(box(0.22, 3.8, 0.42), YELLOW, x + s * 1.8, gy + 1.9, zN + 0.03);
    add(rbox(0.5, 0.9, 0.3, 0.05), '#22262d', x - 1.3, gy + 0.9, zN + 0.3); add(rbox(0.5, 0.9, 0.3, 0.05), '#22262d', x + 1.3, gy + 0.9, zN + 0.3);
  }
  // pallet racking along the back wall
  const rackZ = zN + 1.5, bay = 2.9, levels = [0.15, 1.9, 3.65];
  for (let x = xw0 + 2.5, i = 0; x + bay < xw1 - 1; x += bay, i++) {
    for (const s of [0, bay]) for (const k of [-0.5, 0.5]) add(rbox(0.1, 5.4, 0.1, 0.01), '#2a5fb0', x + s, gy + 2.7, rackZ + k);
    for (const y of levels.slice(1).concat(5.3)) for (const k of [-0.5, 0.5]) add(box(bay, 0.12, 0.06), ORANGE, x + bay / 2, gy + y - 0.1, rackZ + k);
    levels.forEach((y, l) => {
      for (const p of [0.75, 2.15]) {
        if ((i * 3 + l * 5 + Math.round(p)) % 7 === 0) return;
        add(box(1.2, 0.14, 1.0), PALLET, x + p, gy + y + 0.07, rackZ);
        const hgt = 0.7 + ((i + l) % 3) * 0.25;
        add(rbox(1.08, hgt, 0.92, 0.03), WRAPS[(i + l * 2 + Math.round(p)) % WRAPS.length]!, x + p, gy + y + 0.14 + hgt / 2, rackZ);
      }
    });
  }
  // loose pallets and a forklift on the ground floor
  const fx = x0 - 5.5, fz = z1 + 2.5;
  for (const [px, pz, hgt, c] of [[fx - 3, fz - 1, 1.1, 0], [fx - 3, fz + 1.4, 0.8, 2], [fx - 1.2, fz + 3.4, 1.3, 1], [x1 + 4, z1 + 4, 1.0, 4], [x1 + 5.6, z1 + 4.2, 0.7, 0]] as const) {
    add(box(1.2, 0.14, 1.0), PALLET, px, gy + 0.07, pz);
    add(rbox(1.08, hgt, 0.92, 0.03), WRAPS[c]!, px, gy + 0.14 + hgt / 2, pz);
  }
  add(rbox(1.5, 0.75, 1.05, 0.12), YELLOW, fx, gy + 0.62, fz);
  add(rbox(0.55, 0.8, 1.0, 0.1), STEEL_DARK, fx - 0.6, gy + 0.72, fz);
  for (const [sx, sz] of [[-0.45, -0.45], [-0.45, 0.45], [0.35, -0.45], [0.35, 0.45]] as const) add(cyl('y', 0.035, 1.25, 8), STEEL_DARK, fx + sx, gy + 1.6, fz + sz);
  add(rbox(1.05, 0.06, 1.05, 0.02), STEEL_DARK, fx - 0.05, gy + 2.24, fz);
  add(rbox(0.5, 0.12, 0.6, 0.04), '#22262d', fx - 0.15, gy + 1.0, fz);
  for (const [sx, sz, r] of [[-0.5, -0.56, 0.24], [-0.5, 0.56, 0.24], [0.5, -0.56, 0.3], [0.5, 0.56, 0.3]] as const) add(cyl('z', r, 0.2, 14), '#22262d', fx + sx, gy + r, fz + sz);
  for (const k of [-0.32, 0.32]) { add(rbox(0.1, 2.5, 0.12, 0.01), STEEL_DARK, fx + 0.86, gy + 1.3, fz + k); add(box(1.1, 0.05, 0.12), STEEL_DARK, fx + 1.45, gy + 0.3, fz + k); }
  add(box(0.08, 0.5, 0.8), STEEL_DARK, fx + 0.92, gy + 0.55, fz);
  add(box(1.2, 0.14, 1.0), PALLET, fx + 1.5, gy + 0.4, fz); add(rbox(1.05, 0.8, 0.9, 0.03), CARTON, fx + 1.5, gy + 0.87, fz);
  // charging bay and control desk on the south strip of the deck
  const bayZ = z1 - 0.55, bays = Math.min(6, Math.max(3, Math.floor(W / 1.6)));
  for (let i = 0; i < bays; i++) {
    const x = 0.4 + i * 1.5;
    if (Math.abs(x - stairX) < 1.2) continue;
    add(rbox(0.34, 0.95, 0.22, 0.04), '#eef0f3', x, 0.475, bayZ);
    add(box(0.36, 0.1, 0.24), BLUE, x, 0.1, bayZ);
    lamp(box(0.2, 0.05, 0.02), '#45e07a', x, 0.78, bayZ - 0.115);
    for (const s of [-1, 1]) add(box(0.05, 0.008, 1.2), YELLOW, x + s * 0.55, 0.004, bayZ - 0.9);
    add(box(1.15, 0.008, 0.05), YELLOW, x, 0.004, bayZ - 1.5);
  }
  const dx = W - 0.4, dz = z1 - 0.8;
  add(rbox(1.7, 0.06, 0.75, 0.02), '#d9dde3', dx, 0.76, dz);
  for (const s of [-0.75, 0.75]) add(rbox(0.06, 0.74, 0.65, 0.01), STEEL_DARK, dx + s, 0.37, dz);
  for (const s of [-0.4, 0.4]) { add(rbox(0.62, 0.4, 0.04, 0.02), '#22262d', dx + s, 1.12, dz + 0.2); add(cyl('y', 0.025, 0.2, 8), STEEL_DARK, dx + s, 0.88, dz + 0.22); lamp(box(0.56, 0.34, 0.01), '#7fc4ff', dx + s, 1.12, dz + 0.176); }
  add(rbox(0.5, 0.5, 0.5, 0.08), BLUE, dx, 0.35, dz - 0.75);
  // lamps hanging over the floor
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / 4, z = z0 + ((z1 - z0) * (j + 0.5)) / 2;
    add(cyl('y', 0.012, 2.2, 6), STEEL_DARK, x, 6.2, z);
    add(cyl('y', 0.38, 0.18, 14, 0.14), STEEL_DARK, x, 5.05, z);
    lamp(cyl('y', 0.3, 0.03, 14), '#fff6d8', x, 4.95, z);
  }

  for (const s of plan.stations) for (const k of [-0.7, 0.7]) add(cyl('y', 0.03, 2.5, 8), STEEL_DARK, s.beltFar + s.dir * 0.2 + k, 1.25, s.z);
  const building = bakedMesh(`mock-building|${plan.id}`, () => parts, undefined, true);
  const lights = bakedMesh(`mock-lights|${plan.id}`, () => glow, VERTEX_GLOW);
  stage.add(building, lights);

  // ground floor
  const groundGeo = new THREE.PlaneGeometry(xw1 - xw0 + 4, sideLen + 6), groundMat = new THREE.MeshLambertMaterial({ color: '#c3c7cd' });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((xw0 + xw1) / 2, gy, zN + sideLen / 2);
  ground.receiveShadow = true;
  stage.add(ground);
  free.push(() => { groundGeo.dispose(); groundMat.dispose(); });

  // signs
  const place = (m: THREE.Mesh | null, x: number, y: number, z: number, ry = 0): void => { if (!m) return; m.position.set(x, y, z); m.rotation.y = ry; stage.add(m); free.push(() => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }); };
  place(sign('TRUNG TÂM CHIA CHỌN TỰ ĐỘNG', 13, 1.5, '#ffffff', BLUE), (x0 + x1) / 2, gy + 7.4, zN + 0.2);
  place(sign('KHU SẠC XE', 3.2, 0.5, '#1c2330', YELLOW), 0.4 + 1.5, 1.6, z1 - 0.02, Math.PI);
  place(sign('KHU SẠC XE', 3.2, 0.5, '#1c2330', YELLOW), 0.4 + 1.5, 1.6, z1 - 0.03);
  for (const s of plan.stations) for (const ry of [0, Math.PI]) place(sign('NẠP HÀNG', 1.5, 0.3, '#ffffff', BLUE), s.beltFar + s.dir * 0.2, 2.35, s.z + (ry === 0 ? 0.012 : -0.012), ry);
  for (let i = 0; i < doors; i++) place(sign(`CỬA ${i + 1}`, 1.6, 0.5, '#1c2330', '#ffffff'), xw0 + (wallLen * (i + 0.5)) / doors, gy + 4.6, zN + 0.2);

  // spare robots on charge (the game's own AGV figure)
  for (let i = 0; i < Math.min(3, bays); i++) {
    const x = 0.4 + (i === 0 ? 0 : i + 1) * 1.5;
    if (Math.abs(x - stairX) < 1.2) continue;
    const fig = new AgvFigure();
    const wheels = ([[1, -1], [1, 1], [-1, -1], [-1, 1]] as const).map(([f, s]) => ({ side: s * 0.385, forward: f * 0.261, radius: 0.085, spin: 0 }));
    fig.update({ id: `spare${i}`, kind: 'robot', ownerNodeId: `spare${i}`, position: { x, y: 0.12, z: bayZ - 0.9 }, size: { x: 0.9, y: 0.24, z: 0.7 }, color: '#f97316', visible: true, robot: { length: 0.9, width: 0.7, speed: 0, heading: Math.PI / 2, turnRate: 0, wheels } } as EntityView);
    stage.add(fig.object);
    free.push(() => fig.dispose());
  }
  return () => free.forEach((f) => f());
}
