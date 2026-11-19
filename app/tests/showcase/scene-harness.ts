/**
 * Development-only page (served by the dev server, never part of the shipped pages): plays a board for an exact number
 * of ticks and draws it through the real SceneView with a fixed camera, so two versions of the drawing code can be
 * compared pixel by pixel. Clock and random numbers are pinned, so the same board gives the same picture every time.
 *
 * Browser scripts drive it through `window.__harness`.
 */
import * as THREE from 'three';
import { runnableGraph } from '../../src/circuits/runnable';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type EntityView, type InputSnapshot, type Params, type ViewMode, type World } from '../../src/engine/types';
import { listAllSamples } from '../../src/io';
import { parseBoard } from '../../src/io/save-format';
import { registerAllNodes } from '../../src/nodes';
import { CameraRig } from '../../src/render/cameras';
import { serializeBoard } from '../../src/io/save-format';
import { SPOTS, createFactoryShowcase, type ShowcaseOptions } from './factory-showcase-board';
import { onPackLoaded } from '../../src/render/pack-models';
import { SceneView } from '../../src/render/scene-view';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { prepareWorldOptions } from '../../src/world/play-options';
import { createWorld } from '../../src/world/world';

registerAllNodes();

/** Fixed clock for everything drawn (the overload ring of a joint pulses with the time). */
performance.now = () => 1000;

function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface FixedCamera {
  pos: [number, number, number];
  target: [number, number, number];
  fov?: number;
  /** Half-width of the shadow window around the target (m). */
  shadow?: number;
}

export interface RunRequest {
  /** Id of a shipped sample ... */
  sample?: string;
  /** ... or a saved board as JSON text. */
  boardJson?: string;
  ticks: number;
  width?: number;
  height?: number;
  /** View mode other than the board's own. */
  mode?: ViewMode;
  /** Free camera; without it the app's own framing of the scene is used. */
  camera?: FixedCamera;
  /** Parameters to set on nodes at a given tick, e.g. to tilt a tray: [tick, nodeId, params]. */
  edits?: [number, string, Params][];
  grid?: boolean;
}

const EDITOR_BACKDROP = 0xe6e8ec;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setPixelRatio(1);
document.body.appendChild(renderer.domElement);

let packLoads = 0;
onPackLoaded(() => {
  packLoads++;
});

let sceneView: SceneView | null = null;
let world: World | null = null;
let redraw: (() => void) | null = null;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function boardOf(req: RunRequest): Board {
  if (req.boardJson !== undefined) {
    const res = parseBoard(req.boardJson);
    if (!res.ok) throw new Error(res.error);
    return res.board;
  }
  const s = listAllSamples().find((x) => x.id === req.sample);
  if (!s) throw new Error(`unknown sample ${req.sample}`);
  return s.board;
}

async function run(req: RunRequest): Promise<{ entities: number; ticks: number; mode: ViewMode }> {
  const board = boardOf(req);
  const mode = req.mode ?? board.mode;
  const width = req.width ?? 1280;
  const height = req.height ?? 800;
  Math.random = seededRandom(12345);
  sceneView?.dispose();
  world?.dispose?.();
  const graph = runnableGraph(board);
  // Like the app: the still editing picture is built without the physics engine, a played board with it.
  const wanted = worldOptionsForGraph(graph);
  const options = req.ticks > 0 ? (await prepareWorldOptions(wanted)).options : wanted;
  const w = createWorld(mode, options);
  const rt = createRuntime(graph, w, mode);
  world = w;
  const view = new SceneView();
  sceneView = view;
  view.setMode(mode);
  view.setBackdrop(EDITOR_BACKDROP);
  view.setGrid(mode, req.grid ?? req.ticks === 0);
  const rig = new CameraRig(mode);
  renderer.setSize(width, height, true);
  rig.resize(width, height);
  const input: InputSnapshot = { keysDown: new Set<string>() };
  for (let i = 0; i < req.ticks && !w.ended; i++) {
    for (const [at, nodeId, params] of req.edits ?? []) if (at === i) rt.applyNodeParams(nodeId, params);
    if (mode === '3d') w.setCameraYaw(rig.yaw);
    rt.tick(input);
    w.step(TICK_DT);
  }
  let free: THREE.PerspectiveCamera | null = null;
  if (req.camera) {
    free = new THREE.PerspectiveCamera(req.camera.fov ?? 35, width / height, 0.1, 400);
    free.position.set(...req.camera.pos);
    free.lookAt(new THREE.Vector3(...req.camera.target));
  }
  const draw = (): void => {
    const entities: readonly EntityView[] = w.entities();
    view.sync(entities, 0);
    rig.snap();
    rig.update(entities, 0, req.ticks > 0, req.ticks > 0 ? w.cameraCommand() : null);
    if (free && req.camera) {
      const [x, y, z] = req.camera.target;
      view.focusSun({ x, y, z }, req.camera.shadow ?? 8);
    } else if (mode === '3d') {
      view.focusSun(rig.focus, rig.size);
    }
    renderer.render(view.scene, free ?? rig.camera);
  };
  redraw = draw;
  // Pack models arrive after the first draw: keep drawing until no new one has come for a while.
  draw();
  let seen = -1;
  for (let i = 0; i < 40 && seen !== packLoads; i++) {
    seen = packLoads;
    await sleep(i === 0 ? 1500 : 700);
    draw();
  }
  return { entities: w.entities().length, ticks: req.ticks, mode };
}

const api = {
  samples: (): { id: string; mode: ViewMode }[] => listAllSamples().map((s) => ({ id: s.id, mode: s.board.mode })),
  run,
  /** The factory showcase board (see factory-showcase-board.ts). */
  showcase: (options: ShowcaseOptions, req: Omit<RunRequest, 'sample' | 'boardJson'>) => run({ ...req, boardJson: serializeBoard(createFactoryShowcase(options)) }),
  spots: SPOTS,
  /** The showcase as a saved board, to open in the real editor. */
  showcaseJson: (options: ShowcaseOptions = {}): string => serializeBoard(createFactoryShowcase(options)),
  redraw: (): void => redraw?.(),
  png: (): string => renderer.domElement.toDataURL('image/png'),
  /** Draw calls and triangles of the last frame (shadow pass included). */
  info: (): { calls: number; triangles: number } => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
  entities: (): readonly EntityView[] => world?.entities() ?? [],
};

declare global {
  interface Window {
    __harness?: typeof api;
  }
}
window.__harness = api;
