/**
 * Development-only: a page of look proposals for three things the game does not have yet (a cage that holds cartons, a
 * status lamp, a cover over a drop hole), drawn with the factory look's own toolkit and the game's carton figure so
 * they read as one family with what is on screen today. Nothing here is a game piece and no existing figure is changed.
 * It is packed into one script for `plans/ui-mockups/cage-lamp-cover/index.html`.
 */
import * as THREE from 'three';
import { VERTEX_TOON, bakedMesh, box, canvasTexture, cyl, glowMat, rbox, type Part } from '../../src/render/factory-kit';
import { buildParcel } from '../../src/render/factory-parcels';

const STEEL = '#8f97a3', STEEL_DARK = '#4a515c', TYRE = '#23252b', WIRE = '#aab2bd', YELLOW = '#ffc21a', BLUE = '#2f7fe0', DECK = '#93a1b3';
const LAMP = { green: '#22c55e', amber: '#facc15', red: '#ef4444' } as const;
type LampColor = keyof typeof LAMP;
const TAPES = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ef4444'];

/** The cage every option is drawn round: the clear room inside, the wall height, and the room under the floor plate. */
const CAGE = { inside: 0.8, wall: 1.0, floorTop: 0.4, plate: 0.05 };
const CARTON = { x: 0.32, y: 0.26, z: 0.28 };
const HOLE = 0.94;

type At = [number, number, number];
const adder = (list: Part[]) => (geo: THREE.BufferGeometry, color: string, at: At, turn?: At): void => {
  list.push({ geo, color, at, ...(turn ? { turn } : {}) });
};

// ---------------------------------------------------------------- cages

const OUT = CAGE.inside + 0.06;
const HALF = OUT / 2;

/** A: a closed bin of sheet steel on four feet. */
function cageSolid(): THREE.Object3D {
  return bakedMesh('look-cage-a', () => {
    const parts: Part[] = [], add = adder(parts);
    add(rbox(OUT, CAGE.plate, OUT, 0.012), STEEL_DARK, [0, CAGE.floorTop - CAGE.plate / 2, 0]);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      add(rbox(0.07, CAGE.floorTop - CAGE.plate, 0.07, 0.012), STEEL_DARK, [sx * (HALF - 0.05), (CAGE.floorTop - CAGE.plate) / 2, sz * (HALF - 0.05)]);
      add(rbox(0.12, 0.03, 0.12, 0.01), TYRE, [sx * (HALF - 0.05), 0.015, sz * (HALF - 0.05)]);
    }
    const wy = CAGE.floorTop + CAGE.wall / 2;
    for (const s of [-1, 1]) {
      add(box(OUT, CAGE.wall, 0.03), BLUE, [0, wy, s * (HALF - 0.015)]);
      add(box(0.03, CAGE.wall, OUT - 0.06), BLUE, [s * (HALF - 0.015), wy, 0]);
      // a pressed rib and the yellow rim
      add(box(OUT + 0.012, 0.05, 0.042), STEEL, [0, CAGE.floorTop + 0.5, s * (HALF - 0.015)]);
      add(box(0.042, 0.05, OUT + 0.012), STEEL, [s * (HALF - 0.015), CAGE.floorTop + 0.5, 0]);
      add(box(OUT + 0.02, 0.05, 0.05), YELLOW, [0, CAGE.floorTop + CAGE.wall - 0.025, s * (HALF - 0.015)]);
      add(box(0.05, 0.05, OUT + 0.02), YELLOW, [s * (HALF - 0.015), CAGE.floorTop + CAGE.wall - 0.025, 0]);
    }
    return parts;
  });
}

/** One wall of wire mesh from the cage floor up to `h`, along x at z = `z` (or along z at x = `z` when `turned`). */
function meshWall(add: ReturnType<typeof adder>, z: number, h: number, turned: boolean): void {
  const run = OUT - 0.06;
  const rail = (y: number, r: number): void => (turned ? add(cyl('z', r, run, 6), WIRE, [z, CAGE.floorTop + y, 0]) : add(cyl('x', r, run, 6), WIRE, [0, CAGE.floorTop + y, z]));
  const rails = Math.max(2, Math.round(h / 0.125));
  for (let k = 1; k <= rails; k++) rail((h * k) / rails, k === rails ? 0.016 : 0.006);
  for (let k = -3; k <= 3; k++) {
    const s = (k * run) / 8;
    add(cyl('y', 0.006, h, 5), WIRE, turned ? [z, CAGE.floorTop + h / 2, s] : [s, CAGE.floorTop + h / 2, z]);
  }
}

function castors(add: ReturnType<typeof adder>, r: number): void {
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const x = sx * (HALF - 0.07), z = sz * (HALF - 0.07);
    add(cyl('x', r, 0.05, 14), TYRE, [x, r, z]);
    add(cyl('x', r * 0.45, 0.056, 10), STEEL, [x, r, z]);
    add(rbox(0.07, CAGE.floorTop - CAGE.plate - r, 0.07, 0.012), STEEL_DARK, [x, r + (CAGE.floorTop - CAGE.plate - r) / 2, z]);
  }
}

/** B: a roll cage with four mesh walls. C: the same with a low front (the side at +z) and big wheels. */
function cageRoll(lowFront: boolean): THREE.Object3D {
  return bakedMesh(`look-cage-${lowFront ? 'c' : 'b'}`, () => {
    const parts: Part[] = [], add = adder(parts);
    add(rbox(OUT, CAGE.plate, OUT, 0.012), STEEL_DARK, [0, CAGE.floorTop - CAGE.plate / 2, 0]);
    castors(add, lowFront ? 0.1 : 0.065);
    const front = lowFront ? 0.35 : CAGE.wall;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const h = sz > 0 ? front : CAGE.wall;
      add(cyl('y', 0.02, h, 8), lowFront ? YELLOW : WIRE, [sx * (HALF - 0.03), CAGE.floorTop + h / 2, sz * (HALF - 0.03)]);
    }
    meshWall(add, -(HALF - 0.03), CAGE.wall, false);
    meshWall(add, HALF - 0.03, front, false);
    for (const s of [-1, 1]) {
      meshWall(add, s * (HALF - 0.03), lowFront ? front : CAGE.wall, true);
      if (!lowFront) continue;
      // the sides step up behind the low front: a sloped top rail from the front post to the full height half way back
      const rise = CAGE.wall - front, back = OUT * 0.5, len = Math.hypot(rise, back);
      add(cyl('z', 0.016, len, 6), YELLOW, [s * (HALF - 0.03), CAGE.floorTop + front + rise / 2, HALF - 0.03 - back / 2], [Math.atan2(rise, back), 0, 0]);
      add(cyl('z', 0.016, OUT - 0.06 - back, 6), YELLOW, [s * (HALF - 0.03), CAGE.floorTop + CAGE.wall, -(back / 2)]);
      for (let k = 1; k <= 3; k++) {
        const zz = -(HALF - 0.03) + ((OUT - 0.06 - back) * k) / 3;
        add(cyl('y', 0.006, rise, 5), WIRE, [s * (HALF - 0.03), CAGE.floorTop + front + rise / 2, zz]);
      }
      for (let k = 1; k <= 4; k++) add(cyl('z', 0.006, OUT - 0.06 - back, 6), WIRE, [s * (HALF - 0.03), CAGE.floorTop + front + (rise * k) / 5, -(back / 2)]);
    }
    return parts;
  });
}

/** Where the cartons of a pile lie: place on the cage floor (x, z), layer, and turn about the vertical. */
const PILE: readonly [x: number, z: number, layer: number, yaw: number][] = [
  [-0.19, -0.17, 0, 0.12],
  [0.18, -0.2, 0, -0.2],
  [-0.14, 0.2, 0, 1.45],
  [0.2, 0.17, 0, 0.3],
  [-0.05, -0.1, 1, 0.5],
  [0.12, 0.16, 1, -0.35],
];

function cartons(count: number): THREE.Group {
  const g = new THREE.Group();
  for (let k = 0; k < count; k++) {
    const [x, z, layer, yaw] = PILE[k]!;
    const fig = buildParcel('parcel-carton', TAPES[k % TAPES.length]!, `c${k}`);
    fig.update?.({ size: CARTON });
    fig.object.scale.set(CARTON.x, CARTON.y, CARTON.z);
    fig.object.position.set(x, CAGE.floorTop + CARTON.y / 2 + layer * CARTON.y, z);
    fig.object.rotation.y = yaw;
    g.add(fig.object);
  }
  return g;
}

function cageScene(kind: 'a' | 'b' | 'c', count: number): THREE.Group {
  const g = new THREE.Group();
  g.add(kind === 'a' ? cageSolid() : cageRoll(kind === 'c'));
  g.add(cartons(count));
  g.add(ground(14));
  return g;
}

// ---------------------------------------------------------------- shared scenery

function ground(side: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(side, side), new THREE.MeshLambertMaterial({ color: '#d5d9df' }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

/** A square of deck (top at y = 0) with one drop hole in the middle and the yellow band the game draws round a hole. */
function deckWithHole(side: number): THREE.Object3D {
  const m = bakedMesh(`look-deck|${side}`, () => {
    const parts: Part[] = [], add = adder(parts);
    const rim = (side - HOLE) / 2;
    for (const s of [-1, 1]) {
      add(box(side, 0.2, rim), DECK, [0, -0.1, s * (HOLE / 2 + rim / 2)]);
      add(box(rim, 0.2, HOLE), DECK, [s * (HOLE / 2 + rim / 2), -0.1, 0]);
      add(box(HOLE + 0.12, 0.012, 0.06), YELLOW, [0, 0.006, s * (HOLE / 2 + 0.03)]);
      add(box(0.06, 0.012, HOLE), YELLOW, [s * (HOLE / 2 + 0.03), 0.006, 0]);
    }
    return parts;
  }, VERTEX_TOON, true);
  const g = new THREE.Group();
  g.add(m);
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(side - 0.04, side - 0.04), new THREE.MeshBasicMaterial({ color: '#3a3f48' }));
  dark.rotation.x = -Math.PI / 2;
  dark.position.y = -0.22;
  g.add(dark);
  return g;
}

// ---------------------------------------------------------------- lamps

const dim = (hex: string): string => `#${new THREE.Color(hex).multiplyScalar(0.28).getHexString()}`;

/** A: a stack of three lenses on a pole, the lit one glowing. B: one dome that takes the colour. Both stand on the deck beside a hole. */
function lampScene(kind: 'a' | 'b', lit: LampColor): THREE.Group {
  const g = new THREE.Group();
  const deck = deckWithHole(2.2);
  g.add(deck);
  const at = new THREE.Group();
  at.position.set(HOLE / 2 + 0.2, 0, HOLE / 2 + 0.2);
  g.add(at);
  at.add(bakedMesh(`look-lamp-post-${kind}`, () => {
    const parts: Part[] = [], add = adder(parts);
    add(cyl('y', 0.07, 0.03, 16), TYRE, [0, 0.015, 0]);
    add(cyl('y', 0.02, kind === 'a' ? 0.42 : 0.5, 10), STEEL, [0, kind === 'a' ? 0.24 : 0.28, 0]);
    if (kind === 'a') add(cyl('y', 0.05, 0.03, 14), TYRE, [0, 0.85, 0]);
    else add(cyl('y', 0.075, 0.04, 16), TYRE, [0, 0.55, 0]);
    return parts;
  }));
  if (kind === 'a') {
    (['green', 'amber', 'red'] as const).forEach((c, k) => {
      const on = c === lit;
      const lens = new THREE.Mesh(cyl('y', 0.045, 0.12, 16), on ? glowMat(LAMP[c]) : new THREE.MeshLambertMaterial({ color: dim(LAMP[c]) }));
      lens.position.y = 0.45 + 0.06 + k * 0.13;
      at.add(lens);
      const ring = new THREE.Mesh(cyl('y', 0.048, 0.012, 16), new THREE.MeshLambertMaterial({ color: TYRE }));
      ring.position.y = 0.45 + k * 0.13 - 0.004;
      at.add(ring);
    });
  } else {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), glowMat(LAMP[lit]));
    dome.position.y = 0.57 + 0.09;
    at.add(dome);
    const skirt = new THREE.Mesh(cyl('y', 0.085, 0.09, 20), glowMat(LAMP[lit]));
    skirt.position.y = 0.57 + 0.045;
    at.add(skirt);
  }
  return g;
}

// ---------------------------------------------------------------- hole covers

function stripes(key: string, a: string, b: string): THREE.Material {
  const map = canvasTexture(key, 256, 256, (g, w, h) => {
    g.fillStyle = a;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = b;
    g.lineWidth = 30;
    for (let x = -h; x < w + h; x += 86) {
      g.beginPath();
      g.moveTo(x, h + 20);
      g.lineTo(x + h + 20, -20);
      g.stroke();
    }
  });
  return new THREE.MeshLambertMaterial(map ? { map } : { color: a });
}

/** A: a striped plate that slides over the hole from a pocket beside it. B: a striped barrier frame that folds down over the hole. */
function coverScene(kind: 'a' | 'b', closed: boolean): THREE.Group {
  const g = new THREE.Group();
  g.add(deckWithHole(2.6));
  if (kind === 'a') {
    const plateMesh = new THREE.Mesh(box(HOLE + 0.06, 0.03, HOLE + 0.06), stripes('look-cover-a', '#d92b2b', '#ffffff'));
    plateMesh.position.set(closed ? 0 : -(HOLE + 0.02), 0.03, 0);
    plateMesh.castShadow = true;
    g.add(plateMesh);
    // the two rails it runs on
    g.add(bakedMesh('look-cover-rails', () => {
      const parts: Part[] = [], add = adder(parts);
      for (const s of [-1, 1]) add(box(HOLE * 2 + 0.2, 0.02, 0.03), STEEL_DARK, [-(HOLE / 2), 0.01, s * (HOLE / 2 + 0.075)]);
      return parts;
    }));
  } else {
    const frame = new THREE.Group();
    const s = HOLE + 0.04;
    // the frame hangs on a hinge along the hole edge at -x; its own origin is on that hinge
    frame.add(bakedMesh('look-cover-b', () => {
      const parts: Part[] = [], add = adder(parts);
      /** A bar of black and yellow lengths, along x (or along z when `alongZ`). */
      const bar = (len: number, thick: number, x: number, z: number, alongZ: boolean): void => {
        const n = Math.round(len / 0.14);
        for (let k = 0; k < n; k++) {
          const at = -len / 2 + ((k + 0.5) * len) / n;
          const color = k % 2 === 0 ? YELLOW : TYRE;
          if (alongZ) add(box(thick, 0.05, len / n), color, [x, 0, z + at]);
          else add(box(len / n, 0.05, thick), color, [x + at, 0, z]);
        }
      };
      bar(s, 0.07, s / 2, -s / 2 + 0.035, false);
      bar(s, 0.07, s / 2, s / 2 - 0.035, false);
      bar(s - 0.14, 0.07, 0.035, 0, true);
      bar(s - 0.14, 0.07, s - 0.035, 0, true);
      for (const z of [-0.16, 0.16]) bar(s - 0.14, 0.05, s / 2, z, false);
      return parts;
    }));
    frame.position.set(-s / 2, 0.045, 0);
    frame.rotation.z = closed ? 0 : Math.PI / 2 - 0.12;
    g.add(frame);
    g.add(bakedMesh('look-cover-hinge', () => {
      const parts: Part[] = [], add = adder(parts);
      add(cyl('z', 0.03, HOLE + 0.1, 10), STEEL_DARK, [-s / 2, 0.035, 0]);
      return parts;
    }));
  }
  return g;
}

// ---------------------------------------------------------------- the page

interface Tile {
  canvas: HTMLCanvasElement;
  build: () => THREE.Group;
  /** What the camera looks at, how far away it stands, and how high it looks down from (radians). */
  target: At;
  distance: number;
  pitch: number;
  root?: THREE.Group;
}

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe6e8ec);
// The lights of the game's own scene (render/scene-view.ts).
scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(6, 12, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 40 });
scene.add(sun, sun.target);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

const tiles: Tile[] = [];
const turn = 0.62;

function draw(tile: Tile): void {
  const box2 = tile.canvas.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(2, Math.round(box2.width * ratio));
  const h = Math.max(2, Math.round(box2.height * ratio));
  tile.root ??= tile.build();
  scene.add(tile.root);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const [tx, ty, tz] = tile.target;
  camera.position.set(tx + Math.sin(turn) * Math.cos(tile.pitch) * tile.distance, ty + Math.sin(tile.pitch) * tile.distance, tz + Math.cos(turn) * Math.cos(tile.pitch) * tile.distance);
  camera.lookAt(tx, ty, tz);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  if (tile.canvas.width !== w || tile.canvas.height !== h) {
    tile.canvas.width = w;
    tile.canvas.height = h;
  }
  tile.canvas.getContext('2d')?.drawImage(renderer.domElement, 0, 0);
  scene.remove(tile.root);
}

function drawAll(): void {
  for (const t of tiles) draw(t);
}

const only = new URLSearchParams(location.search).get('only');

/** One picture per option and state; `?only=<id>` shows a single one filling the window (for taking its screenshot). */
function tile(id: string, build: () => THREE.Group, target: At, distance: number, pitch: number): void {
  if (only !== null && only !== id) return;
  const canvas = document.createElement('canvas');
  canvas.id = id;
  canvas.title = id;
  if (only !== null) canvas.className = 'only';
  document.body.append(canvas);
  tiles.push({ canvas, build, target, distance, pitch });
}

for (const kind of ['a', 'b', 'c'] as const) for (const n of [0, 3, 6]) tile(`cage-${kind}-${n}`, () => cageScene(kind, n), [0, 0.74, 0], 4.5, 0.72);
for (const kind of ['a', 'b'] as const) for (const c of ['green', 'amber', 'red'] as const) tile(`lamp-${kind}-${c}`, () => lampScene(kind, c), [HOLE / 2 + 0.1, 0.38, HOLE / 2 + 0.1], 2.6, 0.42);
for (const kind of ['a', 'b'] as const) for (const state of ['open', 'closed'] as const) tile(`cover-${kind}-${state}`, () => coverScene(kind, state === 'closed'), [-0.25, 0.1, 0], 5.2, 0.62);

window.addEventListener('resize', drawAll);
drawAll();
document.body.dataset.ready = 'yes';
