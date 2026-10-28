import * as THREE from 'three';
import type { GameView } from '../app-contracts';
import {
  TICK_DT,
  type GameResult,
  type Graph,
  type InputSnapshot,
  type Runtime,
  type Vec3,
  type ViewMode,
  type World,
} from '../engine/types';
import { createRuntime } from '../engine/runtime';
import { createWorld } from '../world/world';
import { registerAllNodes } from '../nodes';
import { CameraRig } from './cameras';
import { createAccumulator } from './game-loop';
import { floatingLabels } from './floating-labels';
import { Hud } from './hud';
import { SceneView } from './scene-view';
import { TEXT_VI } from './text-vi';

let nodesRegistered = false;
function ensureNodesRegistered(): void {
  if (nodesRegistered) return;
  registerAllNodes();
  nodesRegistered = true;
}

export function createGameView(): GameView {
  const sceneView = new SceneView();
  const accumulator = createAccumulator();
  const endCallbacks: Array<(result: GameResult, message: string) => void> = [];
  const restartCallbacks: Array<() => void> = [];

  let container: HTMLElement | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let hud: Hud | null = null;
  let rig = new CameraRig('2d-side');
  let width = 1;
  let height = 1;

  let mode: ViewMode = '2d-side';
  let world: World | null = null;
  let runtime: Runtime | null = null;
  let playing = false;
  let rafId = 0;
  let lastTime = 0;
  let readInputFn: (() => InputSnapshot) | null = null;
  let drag: { id: number; x: number; y: number; kind: 'orbit' | 'pan' } | null = null;
  let resetBtn: HTMLButtonElement | null = null;
  let resetOnNextPreview = false;

  const raycaster = new THREE.Raycaster();

  function ensureRig(m: ViewMode): void {
    sceneView.setMode(m);
    if (rig.mode === m) return;
    rig = new CameraRig(m);
    rig.resize(width, height);
  }

  function draw(dt: number, follow: boolean): void {
    if (!renderer) return;
    const entities = world ? world.entities() : [];
    sceneView.sync(entities, dt);
    rig.update(entities, dt, follow);
    renderer.render(sceneView.scene, rig.camera);
  }

  /** Redraw the static (non-playing) scene, e.g. after orbit or resize. */
  function redrawStatic(): void {
    if (playing) return; // the loop redraws every frame
    rig.snap();
    draw(0, false);
  }

  function showError(): void {
    hud?.showError(TEXT_VI.previewError);
  }

  function cancelLoop(): void {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function resetSession(): void {
    cancelLoop();
    playing = false;
    runtime = null;
    // Fresh figures per session so animation state never carries across restarts.
    sceneView.clear();
    hud?.hideEnd();
    hud?.hideError();
    // Values from a finished play session must not linger on the edit-mode preview.
    hud?.clearItems();
  }

  function build(graph: Graph, m: ViewMode): boolean {
    try {
      ensureNodesRegistered();
      const w = createWorld(m);
      const r = createRuntime(graph, w, m);
      world = w;
      runtime = r;
      mode = m;
      return true;
    } catch (err) {
      console.error(err);
      world = null;
      runtime = null;
      mode = m;
      sceneView.clear();
      showError();
      return false;
    }
  }

  function frame(now: number): void {
    rafId = 0;
    if (!playing || !world || !runtime || !readInputFn) return;
    const dt = Math.min((now - lastTime) / 1000, 0.25);
    lastTime = now;
    try {
      if (mode === '3d') world.setCameraYaw(rig.yaw);
      const steps = accumulator.advance(dt);
      for (let i = 0; i < steps && !world.ended; i++) {
        runtime.tick(readInputFn());
        world.step(TICK_DT);
      }
    } catch (err) {
      console.error(err);
      draw(dt, true);
      cancelLoop();
      showError();
      return;
    }
    draw(dt, true);
    const hudItems = world.hudItems();
    hud?.setItems(hudItems);
    hud?.setFloating(floatingLabels(hudItems, (id) => world?.getEntity(id), rig.camera, width, height));
    const ended = world.ended;
    // A character that ran out of health finishes tipping over before the end card appears.
    if (ended && world.entities().some((e) => e.visible && e.fallen !== undefined)) {
      world.step(dt);
      rafId = requestAnimationFrame(frame);
      return;
    }
    if (ended) {
      hud?.showEnd(ended.result, ended.message);
      for (const cb of endCallbacks) cb(ended.result, ended.message);
      return; // loop stops; session stays until stop()
    }
    rafId = requestAnimationFrame(frame);
  }

  function applySize(): void {
    if (!container || !renderer) return;
    const rect = container.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    rig.resize(width, height);
    redrawStatic();
  }

  function toNdc(clientX: number, clientY: number): THREE.Vector2 | null {
    if (!renderer) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
  }

  function syncChrome(): void {
    if (resetBtn) resetBtn.style.display = playing ? 'none' : 'block';
    if (renderer) renderer.domElement.style.cursor = playing && mode !== '3d' ? '' : drag ? 'grabbing' : 'grab';
  }

  function onPointerDown(e: PointerEvent): void {
    if (!renderer || drag) return;
    let kind: 'orbit' | 'pan' | null = null;
    if (playing) {
      if (mode === '3d' && e.button === 0) kind = 'orbit';
    } else if (e.button === 2 || (e.button === 0 && mode !== '3d')) {
      kind = 'pan';
    } else if (e.button === 0) {
      kind = 'orbit';
    }
    if (!kind) return;
    e.preventDefault();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, kind };
    renderer.domElement.setPointerCapture(e.pointerId);
    syncChrome();
  }

  function onPointerMove(e: PointerEvent): void {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (drag.kind === 'orbit') rig.rotate(dx, dy);
    else rig.pan(dx, dy);
    drag.x = e.clientX;
    drag.y = e.clientY;
    redrawStatic();
  }

  function onPointerUp(e: PointerEvent): void {
    if (drag && drag.id === e.pointerId) {
      drag = null;
      syncChrome();
    }
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    const ndc = toNdc(e.clientX, e.clientY);
    rig.zoom(e.deltaY, ndc ? { x: ndc.x, y: ndc.y } : undefined);
    redrawStatic();
  }

  return {
    mount(el: HTMLElement): void {
      if (container) return;
      container = el;
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
      } catch (err) {
        console.error(err);
        el.textContent = TEXT_VI.previewError;
        container = null;
        return;
      }
      const canvas = renderer.domElement;
      canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
      el.appendChild(canvas);
      hud = new Hud(() => restartCallbacks.forEach((cb) => cb()));
      el.appendChild(hud.root);
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'cam-reset';
      resetBtn.textContent = TEXT_VI.resetCamera;
      resetBtn.addEventListener('click', () => {
        rig.resetView();
        redrawStatic();
      });
      el.appendChild(resetBtn);
      syncChrome();
      resizeObserver = new ResizeObserver(() => applySize());
      resizeObserver.observe(el);
      applySize();
    },

    showPreview(graph: Graph, m: ViewMode): void {
      resetSession();
      ensureRig(m);
      sceneView.setGrid(m, true);
      if (resetOnNextPreview) {
        resetOnNextPreview = false;
        rig.resetView();
      }
      syncChrome();
      if (build(graph, m)) {
        rig.snap();
        draw(0, false);
      } else {
        draw(0, false);
      }
    },

    play(graph: Graph, m: ViewMode, readInput: () => InputSnapshot): void {
      resetSession();
      ensureRig(m);
      sceneView.setGrid(m, false);
      readInputFn = readInput;
      if (!build(graph, m)) {
        draw(0, false);
        return;
      }
      playing = true;
      rig.snap();
      syncChrome();
      accumulator.reset();
      hud?.clearItems();
      lastTime = performance.now();
      rafId = requestAnimationFrame(frame);
    },

    stop(): void {
      cancelLoop();
      playing = false;
      runtime = null;
      hud?.hideEnd();
    },

    resetCamera(): void {
      resetOnNextPreview = true;
    },

    isPlaying: () => playing,
    getRuntime: () => (playing ? runtime : null),

    pickEntityOwner(clientX: number, clientY: number): string | null {
      const ndc = toNdc(clientX, clientY);
      return ndc ? sceneView.pick(ndc, rig.camera) : null;
    },

    screenToPlane(clientX: number, clientY: number, planeY = 0): Vec3 | null {
      const ndc = toNdc(clientX, clientY);
      if (!ndc) return null;
      raycaster.setFromCamera(ndc, rig.camera);
      const plane =
        mode === '2d-side'
          ? new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
          : new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      return hit ? { x: hit.x, y: hit.y, z: hit.z } : null;
    },

    onGameEnd(cb): void {
      endCallbacks.push(cb);
    },

    onRestartRequest(cb): void {
      restartCallbacks.push(cb);
    },

    resize(): void {
      applySize();
    },
  };
}
