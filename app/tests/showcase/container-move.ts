/**
 * Development-only page (served by the dev server, never part of the shipped pages): the "Lồng chứa" try board played
 * until the cage is full, then the cage moved 2.2 m as one body the way a carrier piece would do it
 * (`world.moveBlocks(containerBlocks(...))`, ramped), drawn through the real SceneView. No piece on the palette moves a
 * cage yet, so this page is the only place a moved cage can be looked at.
 */
import * as THREE from 'three';
import { runnableGraph } from '../../src/circuits/runnable';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type EntityId, type World } from '../../src/engine/types';
import { tryContainer } from '../../src/handbook/boards-container';
import { registerAllNodes } from '../../src/nodes';
import { CONTAINER_LOOK, containerBlocks } from '../../src/nodes/container';
import { SceneView } from '../../src/render/scene-view';
import { loadRapier } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';

registerAllNodes();

const DISTANCE = 2.2;
const CRUISE = 1.9;
const ACCEL = 3.5;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 400);

function draw(world: World, id: string, caption: string): void {
  const figure = document.createElement('figure');
  const canvas = document.createElement('canvas');
  canvas.id = id;
  const text = document.createElement('figcaption');
  text.textContent = caption;
  figure.append(canvas, text);
  document.body.append(figure);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(2, Math.round(rect.width));
  const h = Math.max(2, Math.round(rect.height));
  const view = new SceneView();
  view.setMode('3d');
  view.setBackdrop(0xe6e8ec);
  view.setGrid('3d', false);
  view.sync(world.entities(), 0);
  const target = { x: 0.8, y: 0.8, z: 0 };
  view.focusSun(target, 5);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const [yaw, pitch, distance] = [0.5, 0.42, 9];
  camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * distance, target.y + Math.sin(pitch) * distance, target.z + Math.cos(yaw) * Math.cos(pitch) * distance);
  camera.lookAt(target.x, target.y, target.z);
  camera.updateProjectionMatrix();
  renderer.render(view.scene, camera);
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')?.drawImage(renderer.domElement, 0, 0);
  view.dispose();
}

async function main(): Promise<void> {
  const rapier = await loadRapier();
  const board = tryContainer();
  const world = createWorld(board.mode, { realPhysics: true, rapier });
  const rt = createRuntime(runnableGraph(board), world, board.mode);
  const tick = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
  };
  const floor = (): EntityId => world.entities().find((e) => e.look === CONTAINER_LOOK)!.id;
  const inCage = (): number => Number(world.hudItems().find((hud) => hud.label.startsWith('Số thùng trong lồng'))?.value ?? -1);
  tick(Math.round(20 / TICK_DT));
  draw(world, 'full', `Lồng đầy, chưa di chuyển (trong lồng: ${inCage()})`);
  const ids = containerBlocks(world, floor());
  const from = { ...world.getEntity(ids[0]!)!.position };
  let gone = 0;
  let refused = 0;
  let halfDrawn = false;
  let fewest = inCage();
  for (let t = 0; gone < DISTANCE - 1e-9; t += TICK_DT) {
    const peak = Math.min(CRUISE, Math.sqrt(DISTANCE * ACCEL));
    const up = peak / ACCEL;
    const flat = (DISTANCE - peak * up) / peak;
    const speed = Math.max(t < up ? ACCEL * t : t < up + flat ? peak : peak - ACCEL * (t - up - flat), (ACCEL * TICK_DT) / 2);
    gone = Math.min(DISTANCE, gone + speed * TICK_DT);
    if (!world.moveBlocks(ids, { x: from.x + gone, y: from.y, z: from.z })) refused++;
    tick();
    fewest = Math.min(fewest, inCage());
    if (!halfDrawn && gone >= DISTANCE / 2) {
      halfDrawn = true;
      draw(world, 'moving', `Đang di chuyển, được ${gone.toFixed(2)} m (trong lồng: ${inCage()})`);
    }
  }
  tick(Math.round(1 / TICK_DT));
  fewest = Math.min(fewest, inCage());
  draw(world, 'moved', `Đã di chuyển ${DISTANCE} m, nghỉ 1 giây (trong lồng: ${inCage()}, ít nhất trên đường: ${fewest}, bước bị từ chối: ${refused})`);
  world.dispose?.();
  document.body.dataset.ready = 'yes';
}

main().catch((err) => {
  document.body.dataset.ready = 'error';
  document.body.append(String(err));
});
