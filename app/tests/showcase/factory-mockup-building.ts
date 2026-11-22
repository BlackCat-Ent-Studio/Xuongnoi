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
import { GATE, TEAL } from './factory-mockup-figures';
import { DOCK_Z, GROUND, PIT, WALL_Z, type GroundPlan } from './factory-mockup-ground';

const G = GROUND;
const STEEL = '#7f8894', STEEL_DARK = '#4a515c', YELLOW = '#f2b90f', BLUE = '#2a6fd0', BELT_DARK = '#2f333b', CARTON = '#c8975a', WALL = '#e3e6ea', WALL_BAND = '#8e98a5', ORANGE = '#f08a1c', PALLET = '#b98a55';
const WRAPS = [CARTON, '#d8c9a8', '#b9c8dc', CARTON, '#cfd6de'];

export interface FloorPlan {
  id: string;
  /** Width (x) and depth (z) of the lane grid, from the middle of the first cell to the middle of the last. */
  W: number; D: number;
  holes: readonly { n: number; x: number; z: number; color: string }[];
  /** Feeding stations: hand-over cell and which way the belt runs (+1 = from the west). */
  stations: readonly { x: number; z: number; dir: 1 | -1; beltFar: number }[];
  /** The lanes, docks and bays of the ground floor. */
  ground: GroundPlan;
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
export function addBuilding(stage: THREE.Group, plan: FloorPlan): { deck: THREE.Mesh; dispose: () => void } {
  const { W, D } = plan;
  const west = plan.stations.some((s) => s.dir === 1), east = plan.stations.some((s) => s.dir === -1);
  const x0 = west ? -6.6 : -1.3, x1 = east ? W + 6.6 : W + 1.3, z0 = -1.3, z1 = D + 3.6;
  const gy = -G;
  const parts: Part[] = [], glow: Part[] = [];
  const add = (geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, turn?: [number, number, number]): void => { parts.push({ geo, color, at: [x, y, z], ...(turn ? { turn } : {}) }); };
  const lamp = (geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number): void => { glow.push({ geo, color, at: [x, y, z] }); };
  const free: (() => void)[] = [];

  // ---- mezzanine: deck plate, yellow edge, columns
  // the plate is a mesh of its own so the page can make it see-through to show the floor below
  const deck = bakedMesh(`mock-deck|${plan.id}`, () => [{ geo: box(x1 - x0, 0.25, z1 - z0), color: STEEL, at: [(x0 + x1) / 2, -0.131, (z0 + z1) / 2] }], undefined, true);
  add(box(x1 - x0 + 0.06, 0.3, 0.06), YELLOW, (x0 + x1) / 2, -0.15, z0); add(box(x1 - x0 + 0.06, 0.3, 0.06), YELLOW, (x0 + x1) / 2, -0.15, z1);
  add(box(0.06, 0.3, z1 - z0), YELLOW, x0, -0.15, (z0 + z1) / 2); add(box(0.06, 0.3, z1 - z0), YELLOW, x1, -0.15, (z0 + z1) / 2);
  const colH = G - 0.25;
  const column = (x: number, z: number): void => { add(rbox(0.2, colH, 0.2, 0.03), STEEL_DARK, x, -0.25 - colH / 2, z); add(box(0.42, 0.04, 0.42), STEEL_DARK, x, gy + 0.02, z); };
  // the columns stand where four ground cells meet, so no lane, cage or bay ever has one in it
  const lines = (from: number, to: number): number[] => {
    const out = [from];
    for (let v = -0.7 - 2.8 * 8; v < to - 1.5; v += 2.8) if (v > from + 1.5) out.push(v);
    return [...out, to];
  };
  for (const x of lines(west ? x0 + 0.3 : -0.7, east ? x1 - 0.3 : W + 0.7)) for (const z of lines(-0.7, D + 3.5)) column(x, z);

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

  // ---- paint on the ground floor: tug lanes with arrows, a bay under every hole, waiting bays, the empty-cage lane
  const gp = plan.ground, PAINT = '#0f8f80';
  const square = (x: number, z: number, side: number, color: string, w = 0.05): void => {
    for (const s of [-1, 1]) { add(box(side, 0.012, w), color, x, gy + 0.008, z + (s * (side - w)) / 2); add(box(w, 0.012, side), color, x + (s * (side - w)) / 2, gy + 0.008, z); }
  };
  for (const a of gp.nodes.values()) for (const id of a.out) {
    const b = gp.nodes.get(id)!, dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    add(box(Math.abs(dx) > 0.01 ? len : 0.06, 0.01, Math.abs(dz) > 0.01 ? len : 0.06), PAINT, (a.x + b.x) / 2, gy + 0.006, (a.z + b.z) / 2);
    if ((a.r + a.c) % 2 === 0) add(cyl('y', 0.17, 0.012, 3), PAINT, (a.x + b.x) / 2, gy + 0.007, (a.z + b.z) / 2, [0, Math.atan2(dx, dz), 0]);
  }
  for (const h of plan.holes) {
    square(h.x, h.z, 1.2, YELLOW);
    // the post of the hole's beacon on the deck
    add(cyl('y', 0.02, 0.54, 8), STEEL_DARK, h.x + 0.6, 0.27, h.z + 0.6);
    add(cyl('y', 0.05, 0.03, 10), STEEL_DARK, h.x + 0.6, 0.015, h.z + 0.6);
  }
  for (const id of gp.pockets) { const p = gp.nodes.get(id)!; square(p.x, p.z, 1.16, PAINT, 0.07); }
  const laneX = gp.buffer.x, laneZ0 = WALL_Z + 0.15, laneZ1 = gp.nodes.get(gp.buffer.node)!.z + 0.6, laneLen = laneZ1 - laneZ0, laneMid = (laneZ0 + laneZ1) / 2;
  for (const s of [-1, 1]) { add(box(0.05, 0.02, laneLen), STEEL_DARK, laneX + s * 0.3, gy + 0.01, laneMid); add(box(0.07, 0.012, laneLen), YELLOW, laneX + s * 0.64, gy + 0.008, laneMid); }
  for (let z = laneZ0 + 0.3; z < laneZ1; z += 0.55) add(box(0.5, 0.014, 0.06), STEEL, laneX, gy + 0.008, z);
  add(box(1.35, 0.012, 0.07), YELLOW, laneX, gy + 0.008, laneZ1);

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
  const zN = WALL_Z, xw0 = x0 - 13, xw1 = x1 + 13, H = 9.5, wy = gy + H / 2;
  const wallLen = xw1 - xw0, sideLen = z1 + 12 - zN;
  // The back wall is built round its openings: a dock door per truck (down to the road, which lies `PIT` below the
  // hall floor so a truck bed is level with it) and the small door the empty cages come back through.
  const pitY = gy - PIT, doorTop = pitY + GATE.h, hatchTop = gy + 2.2, half = GATE.w / 2;
  const openings = [{ a: laneX - 0.7, b: laneX + 0.7, top: hatchTop, sill: gy }, ...gp.doors.map((d) => ({ a: d.x - half, b: d.x + half, top: doorTop, sill: pitY }))].sort((m, n) => m.a - n.a);
  let wallAt = xw0;
  const wallRun = (a: number, b: number): void => {
    if (b - a < 0.01) return;
    add(box(b - a, H + PIT, 0.3), WALL, (a + b) / 2, wy - PIT / 2, zN);
    add(box(b - a, 1.3, 0.36), WALL_BAND, (a + b) / 2, gy + 0.65, zN);
  };
  for (const o of openings) {
    wallRun(wallAt, o.a);
    add(box(o.b - o.a, gy + H - o.top, 0.3), WALL, (o.a + o.b) / 2, (gy + H + o.top) / 2, zN);
    if (o.sill > pitY) add(box(o.b - o.a, o.sill - pitY, 0.3), WALL_BAND, (o.a + o.b) / 2, (o.sill + pitY) / 2, zN);
    wallAt = o.b;
  }
  wallRun(wallAt, xw1);
  add(box(wallLen, 0.4, 0.34), BLUE, (xw0 + xw1) / 2, gy + 5.6, zN);
  add(box(0.3, H, sideLen), WALL, xw0, wy, zN + sideLen / 2);
  add(box(0.36, 1.3, sideLen), WALL_BAND, xw0, gy + 0.65, zN + sideLen / 2);
  add(box(0.34, 0.4, sideLen), BLUE, xw0, gy + 5.6, zN + sideLen / 2);
  const dockA = laneX - 2.4, dockB = gp.doors[gp.doors.length - 1]!.x + 3.2;
  for (let x = xw0; x <= xw1 + 0.01; x += wallLen / 8) if (x < dockA || x > dockB) add(box(0.4, H, 0.4), '#c5cad2', x, wy, zN + 0.05);
  for (let z = zN; z <= zN + sideLen + 0.01; z += sideLen / 6) add(box(0.4, H, 0.4), '#c5cad2', xw0 + 0.05, wy, z);
  for (const d of gp.doors) {
    // door frame, the islands of hall floor either side are drawn below; rubber buffers where the truck bed meets the floor
    add(box(GATE.w + 0.5, 0.3, 0.42), YELLOW, d.x, doorTop + 0.15, zN + 0.03);
    for (const s of [-1, 1]) {
      add(box(0.22, GATE.h, 0.42), YELLOW, d.x + s * (half + 0.11), pitY + GATE.h / 2, zN + 0.03);
      add(box(0.1, 0.012, DOCK_Z - zN - 0.4), YELLOW, d.x + s * (half + 0.1), gy + 0.008, (DOCK_Z + zN) / 2 + 0.1);
      add(rbox(0.3, 0.5, 0.12, 0.03), '#22262d', d.x + s * 1.05, gy - 0.3, DOCK_Z - 0.0);
    }
    add(box(GATE.w, PIT, 0.2), '#8b929c', d.x, gy - PIT / 2, DOCK_Z + 0.1);
    add(box(GATE.w, 0.012, 0.1), YELLOW, d.x, gy + 0.008, DOCK_Z + 0.16);
  }
  // the door of the empty-cage lane: frame, strip curtain, and a ledge outside for the cages that wait to come in
  add(box(1.8, 0.2, 0.4), YELLOW, laneX, hatchTop + 0.1, zN + 0.03);
  for (const s of [-1, 1]) add(box(0.16, 2.2, 0.4), YELLOW, laneX + s * 0.78, gy + 1.1, zN + 0.03);
  for (let k = -3; k <= 3; k++) add(box(0.185, 2.2, 0.03), k % 2 === 0 ? '#3f6f9f' : '#35608c', laneX + k * 0.2, gy + 1.1, zN + (k % 2 === 0 ? 0.0 : 0.02));
  add(box(1.9, PIT, 2.4), '#b3b8bf', laneX, gy - PIT / 2 - 0.001, zN - 1.35);
  // pallet racking along the back wall, clear of the docks
  const rackZ = zN + 1.5, bay = 2.9, levels = [0.15, 1.9, 3.65];
  for (let x = xw0 + 2.5, i = 0; x + bay < xw1 - 1; x += bay, i++) {
    if (x + bay > dockA && x < dockB) continue;
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
  stage.add(building, lights, deck);

  // ground floor
  // The hall floor ends at the docks; between the trucks it runs on to the wall as islands, and the road the trucks
  // stand on lies lower and carries on outside.
  const groundMat = new THREE.MeshLambertMaterial({ color: '#c3c7cd' }), roadMat = new THREE.MeshLambertMaterial({ color: '#a4a9b1' });
  free.push(() => { groundMat.dispose(); roadMat.dispose(); });
  const slab = (mat: THREE.Material, xa: number, xb: number, za: number, zb: number, top: number, thick: number): void => {
    const geo = thick > 0 ? new THREE.BoxGeometry(xb - xa, thick, zb - za) : new THREE.PlaneGeometry(xb - xa, zb - za);
    const m = new THREE.Mesh(geo, mat);
    if (thick <= 0) m.rotation.x = -Math.PI / 2;
    m.position.set((xa + xb) / 2, top - Math.max(0, thick) / 2, (za + zb) / 2);
    m.receiveShadow = true;
    stage.add(m);
    free.push(() => geo.dispose());
  };
  slab(groundMat, xw0 - 2, xw1 + 2, DOCK_Z, zN + sideLen + 3, gy, 0);
  slab(roadMat, xw0 - 2, xw1 + 2, zN - 22, DOCK_Z, pitY, 0);
  let islandAt = xw0 - 2;
  for (const d of gp.doors) { slab(groundMat, islandAt, d.x - half, zN + 0.15, DOCK_Z, gy, PIT); islandAt = d.x + half; }
  slab(groundMat, islandAt, xw1 + 2, zN + 0.15, DOCK_Z, gy, PIT);

  // signs
  const place = (m: THREE.Mesh | null, x: number, y: number, z: number, ry = 0): void => { if (!m) return; m.position.set(x, y, z); m.rotation.y = ry; stage.add(m); free.push(() => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }); };
  place(sign('TRUNG TÂM CHIA CHỌN TỰ ĐỘNG', 13, 1.5, '#ffffff', BLUE), (x0 + x1) / 2, gy + 7.4, zN + 0.2);
  place(sign('KHU SẠC XE', 3.2, 0.5, '#1c2330', YELLOW), 0.4 + 1.5, 1.6, z1 - 0.02, Math.PI);
  place(sign('KHU SẠC XE', 3.2, 0.5, '#1c2330', YELLOW), 0.4 + 1.5, 1.6, z1 - 0.03);
  for (const s of plan.stations) for (const ry of [0, Math.PI]) place(sign('NẠP HÀNG', 1.5, 0.3, '#ffffff', BLUE), s.beltFar + s.dir * 0.2, 2.35, s.z + (ry === 0 ? 0.012 : -0.012), ry);
  for (const d of gp.doors) place(sign(`CỬA ${d.n} · LỖ ${d.holes[0]}–${d.holes[d.holes.length - 1]}`, 2.9, 0.52, '#1c2330', '#ffffff'), d.x, doorTop + 1.3, zN + 0.2);
  place(sign('LỒNG RỖNG', 1.9, 0.42, '#ffffff', TEAL), laneX, hatchTop + 0.5, zN + 0.2);
  place(sign('XE KÉO CHỜ', 2.2, 0.36, '#ffffff', TEAL), -2.14, -0.55, D / 2, -Math.PI / 2);
  // the number of each hole, readable from below
  for (const h of plan.holes) place(sign(`LỖ ${h.n}`, 0.56, 0.2, '#1c2330', '#ffffff'), h.x, -0.5, h.z + 0.585);

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
  return { deck, dispose: () => free.forEach((f) => f()) };
}
