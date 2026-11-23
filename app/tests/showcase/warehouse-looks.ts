/**
 * Development-only page (served by the dev server, never part of the shipped pages): every warehouse look in the real
 * scene (roll cage, signal tower, hole cover, teal tug, flatbed truck, dock door, scan gate with its light sheet, floor
 * paint, warehouse scenery), one picture per look and state. The entities are written by hand and drawn through the
 * real SceneView, so what shows here is what a board that sets these styles gets.
 *
 * `?only=<id>` shows one picture filling the window; `?t=<seconds>` pins the clock (the scan line moves with it).
 */
import * as THREE from 'three';
import { AGV_LOOK, TUG_TEAL } from '../../src/engine/factory-looks';
import type { EntityView, Vec3 } from '../../src/engine/types';
import { drawCost } from '../../src/render/factory-kit';
import { truckBed, warehouseDoors } from '../../src/render/factory-blocks';
import { SceneView } from '../../src/render/scene-view';

const query = new URLSearchParams(location.search);
const only = query.get('only');
const pinned = query.get('t');
if (pinned !== null) performance.now = () => Number(pinned) * 1000;

const GREY = '#a3a3a3';
const DECK_GREY = '#93a1b3';
const TAPES = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#f97316'];
const LAMP = { red: '#ef4444', amber: '#facc15', green: '#22c55e' } as const;

let serial = 0;
function block(style: string, position: Vec3, size: Vec3, extra: Partial<EntityView> = {}): EntityView {
  const id = `b${serial++}`;
  return { id, kind: 'block', ownerNodeId: id, position, size, color: GREY, visible: true, ...(style === 'box' ? {} : { blockStyle: style }), ...extra };
}

const CARTON = { x: 0.32, y: 0.26, z: 0.28 };
function carton(x: number, y: number, z: number, n: number): EntityView {
  const id = `i${serial++}`;
  return { id, kind: 'item', ownerNodeId: id, position: { x, y: y + CARTON.y / 2, z }, size: CARTON, color: TAPES[n % TAPES.length]!, shape: 'box', look: 'parcel-carton', visible: true };
}

/** The cage every sample scene uses: 1.0 m clear inside, 1.0 m walls, 0.35 m free under the floor plate. */
const CAGE = { x: 1.06, y: 1.4, z: 1.06 };
const CAGE_FLOOR = 0.4;
const PILE: readonly [number, number, number][] = [[-0.22, -0.2, 0], [0.2, -0.22, 0], [-0.18, 0.22, 0], [0.22, 0.2, 0], [-0.05, -0.1, 1], [0.14, 0.16, 1]];

/** A cage standing on `y` with `fill` cartons in it. */
function cage(x: number, y: number, z: number, fill = 0): EntityView[] {
  const list = [block('roll-cage', { x, y: y + CAGE.y / 2, z }, CAGE)];
  for (let k = 0; k < fill; k++) list.push(carton(x + PILE[k]![0], y + CAGE_FLOOR + PILE[k]![2] * CARTON.y, z + PILE[k]![1], k));
  return list;
}

function agv(x: number, y: number, z: number, color: string, heading = 0, payload = 0): EntityView {
  const id = `r${serial++}`;
  const length = 0.9;
  const width = 0.7;
  const height = 0.24;
  return {
    id,
    kind: 'robot',
    ownerNodeId: id,
    position: { x, y: y + height / 2, z },
    size: { x: length, y: height, z: length },
    color,
    look: AGV_LOOK,
    visible: true,
    robot: { length, width, speed: 0, heading, turnRate: 0, payload, wheels: [1, -1].flatMap((f) => [1, -1].map((s) => ({ forward: f * length * 0.29, side: s * (width / 2 + 0.035), radius: 0.085, spin: 0 }))) },
  } as EntityView;
}

/** The colour a robot card has when nobody touched it: the look draws it orange. */
const ROBOT_DEFAULT = '#3b82f6';

/** A square of deck (top at y = `top`) with one hole of side `hole` in the middle. */
function deckWithHole(side: number, hole: number, top: number, thick = 0.2): EntityView[] {
  const rim = (side - hole) / 2;
  const y = top - thick / 2;
  const list: EntityView[] = [];
  for (const s of [-1, 1]) {
    list.push(block('box', { x: 0, y, z: s * (hole / 2 + rim / 2) }, { x: side, y: thick, z: rim }, { color: DECK_GREY }));
    list.push(block('box', { x: s * (hole / 2 + rim / 2), y, z: 0 }, { x: rim, y: thick, z: hole }, { color: DECK_GREY }));
  }
  return list;
}

const TRUCK = { x: 2.4, y: 0.95, z: 4.35 };
/** A truck whose back is at z = `back`, cab toward -z, with `n` cages on its bed. */
function truck(x: number, back: number, n: number): EntityView[] {
  const z = back - TRUCK.z / 2;
  const list = [block('truck-flatbed', { x, y: TRUCK.y / 2, z }, TRUCK)];
  const bed = truckBed(TRUCK);
  const slots: [number, number][] = [[-0.57, bed.from + 0.6], [0.57, bed.from + 0.6], [-0.57, bed.from + 1.75], [0.57, bed.from + 1.75]];
  for (let i = 0; i < n; i++) list.push(...cage(x + slots[i]![0], TRUCK.y, z + slots[i]![1], 5 - (i % 2)));
  return list;
}

const DOOR = { x: 3.5, y: 4.32, z: 0.5 };
const GATE = { x: 0.14, y: 1.17, z: 0.79 };
const BELT = { x: 2.6, y: 0.5, z: 0.6 };

function gateScene(style: string, color: string, parcelAt: number): EntityView[] {
  return [
    block('belt-frame', { x: 0, y: BELT.y / 2, z: 0 }, BELT, { belt: { axis: 'x', speed: 1, phase: 0 } }),
    block(style, { x: 0, y: GATE.y / 2, z: 0 }, GATE, { color }),
    carton(parcelAt, BELT.y + 0.006, 0, 3),
  ];
}

// ---------------------------------------------------------------- the stand-in two-level floor and the hall round it

const HALL = { x: 34, y: 11.05, z: 25.8 };
const HALL_AT = { x: 2, y: HALL.y / 2, z: 2.1 };
const DECK_TOP = 2.6;
const HOLES = [1.4, 4.2, 7.0];
const DECK = { x0: -4.6, x1: 9.7, z0: -1.3, z1: 9.7 };

function twoLevelFloor(): EntityView[] {
  const list: EntityView[] = [];
  const slab = (x0: number, x1: number, z0: number, z1: number): void => void list.push(block('box', { x: (x0 + x1) / 2, y: DECK_TOP - 0.125, z: (z0 + z1) / 2 }, { x: x1 - x0, y: 0.25, z: z1 - z0 }, { color: DECK_GREY }));
  // strips between the rows of holes, then the pieces between the holes of a row
  let z = DECK.z0;
  for (const hz of [...HOLES, null]) {
    slab(DECK.x0, DECK.x1, z, hz === null ? DECK.z1 : hz - 0.5);
    if (hz === null) break;
    let x = DECK.x0;
    for (const hx of [...HOLES, null]) {
      slab(x, hx === null ? DECK.x1 : hx - 0.5, hz - 0.5, hz + 0.5);
      if (hx !== null) x = hx + 0.5;
    }
    z = hz + 0.5;
  }
  for (const x of [DECK.x0 + 0.3, -1.0, 2.8, 5.6, DECK.x1 - 0.3]) for (const zz of [DECK.z0 + 0.3, 2.8, 5.6, DECK.z1 - 0.3]) list.push(block('box', { x, y: (DECK_TOP - 0.25) / 2, z: zz }, { x: 0.2, y: DECK_TOP - 0.25, z: 0.2 }, { color: '#4a515c' }));
  // on the deck: belt and gate, sorting robots, a tower and a cover at some holes
  list.push(block('belt-frame', { x: -2.9, y: DECK_TOP + BELT.y / 2, z: 4.2 }, BELT, { belt: { axis: 'x', speed: 1, phase: 0 } }));
  list.push(block('scan-gate-sheet', { x: -2.6, y: DECK_TOP + GATE.y / 2, z: 4.2 }, GATE));
  for (const [x, zz, yaw, load] of [[2.8, 0, 0, 1], [5.6, 4.2, Math.PI / 2, 0], [0, 7, Math.PI, 1], [8.4, 2.8, -Math.PI / 2, 0], [-1.1, 4.2, 0, 1]] as const) list.push(agv(x, DECK_TOP, zz, ROBOT_DEFAULT, yaw, load));
  HOLES.forEach((hx, i) =>
    HOLES.forEach((hz, j) => {
      const fill = (i * 2 + j * 3) % 7;
      list.push(...cage(hx, 0, hz, Math.min(fill, 6)));
      list.push(block('signal-tower', { x: hx + 0.62, y: DECK_TOP + 0.4325, z: hz + 0.62 }, { x: 0.14, y: 0.865, z: 0.14 }, { color: fill >= 6 ? LAMP.red : fill >= 5 ? LAMP.amber : LAMP.green }));
      if (fill >= 6) list.push(block('hole-cover', { x: hx, y: DECK_TOP + 0.015, z: hz }, { x: 1.0, y: 0.03, z: 1.0 }));
      list.push(block('floor-frame', { x: hx, y: 0.01, z: hz }, { x: 1.2, y: 0.02, z: 1.2 }));
    }),
  );
  // below: tug lanes, two tugs (one under a cage), two trucks at the first two doors
  for (const lz of [0, 2.8, 5.6, 8.4]) list.push(block('floor-lane', { x: 4.2, y: 0.01, z: lz }, { x: 12.6, y: 0.02, z: 0.4 }, lz % 5.6 === 0 ? {} : { label: '-' }));
  list.push(block('floor-lane', { x: 10.5, y: 0.01, z: 2.45 }, { x: 0.4, y: 0.02, z: 11.9 }, { label: '-' }));
  list.push(block('floor-lane', { x: -2.1, y: 0.01, z: 2.45 }, { x: 0.4, y: 0.02, z: 11.9 }));
  list.push(block('floor-lane', { x: 4.2, y: 0.01, z: -3.5 }, { x: 12.6, y: 0.02, z: 0.4 }, { label: '-' }));
  list.push(agv(6.2, 0, -3.5, TUG_TEAL, 0, 1), ...cage(6.2, 0, -3.5, 6));
  list.push(agv(-3.4, 0, 1.4, TUG_TEAL, Math.PI / 2));
  const doors = warehouseDoors(HALL);
  doors.slice(0, 2).forEach((d, i) => list.push(...truck(HALL_AT.x + d.position.x, -4.9, i === 0 ? 3 : 1)));
  // the third door is shut: a closed door block exactly over the open one the hall draws
  const shut = doors[2];
  if (shut) list.push(block('dock-door', { x: HALL_AT.x + shut.position.x, y: HALL_AT.y + shut.position.y, z: HALL_AT.z + shut.position.z }, shut.size));
  return list;
}

const hall = (): EntityView => block('warehouse', HALL_AT, HALL);

// ---------------------------------------------------------------- the pictures

type At = [number, number, number];
interface Tile {
  id: string;
  build: () => EntityView[];
  target: At;
  distance: number;
  pitch: number;
  yaw: number;
  /** Half-width of the shadow window round the target (m). */
  reach: number;
}

const tiles: Tile[] = [];
function tile(id: string, build: () => EntityView[], target: At, distance: number, pitch: number, yaw = 0.62, reach = 4): void {
  if (only !== null && only !== id) return;
  tiles.push({ id, build, target, distance, pitch, yaw, reach });
}

for (const n of [0, 3, 6]) tile(`cage-${n}`, () => cage(0, 0, 0, n), [0, 0.74, 0], 4.5, 0.72);
for (const [name, color] of [['off', GREY], ['green', LAMP.green], ['amber', LAMP.amber], ['red', LAMP.red]] as const) {
  tile(`lamp-${name}`, () => [...deckWithHole(2.2, 0.94, 0), block('signal-tower', { x: 0.67, y: 0.4325, z: 0.67 }, { x: 0.14, y: 0.865, z: 0.14 }, { color })], [0.57, 0.38, 0.57], 2.6, 0.42);
}
tile('cover-closed', () => [...deckWithHole(3.2, 0.94, 0), block('hole-cover', { x: 0, y: 0.015, z: 0 }, { x: 1.0, y: 0.03, z: 1.0 })], [-0.25, 0.1, 0], 5.2, 0.62);
tile('cover-open', () => [...deckWithHole(3.2, 0.94, 0), block('hole-cover', { x: -1.0, y: 0.015, z: 0 }, { x: 1.0, y: 0.03, z: 1.0 })], [-0.25, 0.1, 0], 5.2, 0.62);
tile('tug-colours', () => [agv(-0.7, 0, 0, ROBOT_DEFAULT), agv(0.7, 0, 0, TUG_TEAL)], [0, 0.15, 0], 3.6, 0.5);
tile('tug-under-cage', () => [agv(0, 0, 0, TUG_TEAL, 0, 1), ...cage(0, 0, 0, 4)], [0, 0.6, 0], 4.6, 0.3);
tile('truck-empty', () => truck(0, 2.2, 0), [0, 1.2, 0], 11, 0.42, 0.72, 6);
tile('truck-4-cages', () => truck(0, 2.2, 4), [0, 1.2, 0], 11, 0.42, 0.72, 6);
tile('truck-front', () => truck(0, 2.2, 4), [0, 1.2, 0], 11, 0.3, 0.6 + Math.PI, 6);
tile('door-closed', () => [block('dock-door', { x: 0, y: DOOR.y / 2, z: 0 }, DOOR), ...cage(2.6, 0, 1.6, 5)], [0, 2.2, 0], 13, 0.22, 0.42, 6);
tile('door-open', () => [block('dock-door-open', { x: 0, y: DOOR.y / 2, z: 0 }, DOOR), ...cage(2.6, 0, 1.6, 5)], [0, 2.2, 0], 13, 0.22, 0.42, 6);
tile('gate-plain', () => gateScene('scan-gate', GREY, 0.72), [0, 0.7, 0], 3.6, 0.29, 0.56);
tile('sheet-idle', () => gateScene('scan-gate-sheet', GREY, 0.72), [0, 0.7, 0], 3.6, 0.29, 0.56);
tile('sheet-read', () => gateScene('scan-gate-sheet', LAMP.green, 0), [0, 0.7, 0], 3.6, 0.29, 0.56);
tile(
  'floor-paint',
  () => [
    block('floor-lane', { x: 0, y: 0.01, z: -0.8 }, { x: 8.4, y: 0.02, z: 0.4 }),
    block('floor-lane', { x: 0, y: 0.01, z: 0.8 }, { x: 8.4, y: 0.02, z: 0.4 }, { label: '-' }),
    block('floor-lane', { x: 4.4, y: 0.01, z: 0 }, { x: 0.4, y: 0.02, z: 4.2 }),
    block('floor-frame', { x: -1.5, y: 0.01, z: 0 }, { x: 1.2, y: 0.02, z: 1.2 }),
    block('floor-frame', { x: 1.5, y: 0.01, z: 0 }, { x: 1.16, y: 0.02, z: 1.16 }, { color: '#0f8f80' }),
  ],
  [0, 0, 0],
  11,
  0.7,
  0.3,
  6,
);
tile('hall-only', () => [hall()], [2.2, 1.2, -0.8], 40, 0.68, 0.42, 27);
tile('hall-game', () => [hall(), ...twoLevelFloor()], [2.5, 1.2, 2], 38, 0.6, 0, 27);
tile('hall-turned', () => [hall(), ...twoLevelFloor()], [2.2, 1.2, -0.8], 40, 0.68, 0.42, 27);
tile('hall-low', () => [hall(), ...twoLevelFloor()], [2.2, 1.2, -0.8], 40, 0.2, 0.95, 27);
tile('hall-close', () => [hall(), ...twoLevelFloor()], [3, 1.5, 3], 20, 0.55, 0.3, 14);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 400);

interface Report {
  id: string;
  entities: number;
  calls: number;
  triangles: number;
  /** Draw cost of the first entity's own figure (the look the picture is about). */
  first: { meshes: number; triangles: number };
}
const reports: Report[] = [];

function draw(t: Tile, canvas: HTMLCanvasElement): void {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(2, Math.round(rect.width * ratio));
  const h = Math.max(2, Math.round(rect.height * ratio));
  const view = new SceneView();
  view.setMode('3d');
  view.setBackdrop(0xe6e8ec);
  view.setGrid('3d', false);
  serial = 0;
  const entities = t.build();
  view.sync(entities, 0);
  const [tx, ty, tz] = t.target;
  view.focusSun({ x: tx, y: ty, z: tz }, t.reach);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.position.set(tx + Math.sin(t.yaw) * Math.cos(t.pitch) * t.distance, ty + Math.sin(t.pitch) * t.distance, tz + Math.cos(t.yaw) * Math.cos(t.pitch) * t.distance);
  camera.lookAt(tx, ty, tz);
  camera.updateProjectionMatrix();
  renderer.render(view.scene, camera);
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')?.drawImage(renderer.domElement, 0, 0);
  let first = { meshes: 0, triangles: 0 };
  view.scene.traverse((o) => {
    if (first.meshes === 0 && o.userData.ownerNodeId === entities[0]?.ownerNodeId && o.parent && o.parent.userData.ownerNodeId !== entities[0]?.ownerNodeId) first = drawCost(o);
  });
  reports.push({ id: t.id, entities: entities.length, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, first });
  view.dispose();
}

for (const t of tiles) {
  const figure = document.createElement('figure');
  const canvas = document.createElement('canvas');
  canvas.id = t.id;
  if (only !== null) canvas.className = 'only';
  const caption = document.createElement('figcaption');
  caption.textContent = t.id;
  figure.append(canvas, caption);
  document.body.append(figure);
  draw(t, canvas);
}

declare global {
  interface Window {
    __looks?: { reports: Report[] };
  }
}
window.__looks = { reports };
document.body.dataset.ready = 'yes';
