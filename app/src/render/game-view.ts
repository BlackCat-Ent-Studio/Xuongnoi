import * as THREE from 'three';
import type { GameView } from '../app-contracts';
import {
  TICK_DT,
  type GameResult,
  type Graph,
  type Params,
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
import { createAccumulator, createSimPacer } from './game-loop';
import { floatingLabels } from './floating-labels';
import { GuideArrowLayer, guideArrowShapes } from './guide-arrows';
import { Hud } from './hud';
import { onPackLoaded } from './pack-models';
import { SceneView } from './scene-view';
import type { StageTheme } from './stage-theme';
import { TEXT_VI } from './text-vi';
import { UiInputBuffer, createClickTracker, pickEntities } from './ui-input';

let nodesRegistered = false;
function ensureNodesRegistered(): void {
  if (nodesRegistered) return;
  registerAllNodes();
  nodesRegistered = true;
}

export interface GameViewOptions {
  /** Transparent canvas on the stage (puzzle page): whatever sits behind the canvas shows around the scene. The editor leaves this off. */
  transparentStage?: boolean;
  /** Themed look of the scene (floors, props, bigger characters). The editor leaves this off. */
  stage?: StageTheme;
}

export function createGameView(options: GameViewOptions = {}): GameView {
  const sceneView = new SceneView(options.stage ?? null);
  const pacer = createSimPacer(createAccumulator());
  const pauseCallbacks: Array<(paused: boolean) => void> = [];
  const endCallbacks: Array<(result: GameResult, message: string) => void> = [];
  const restartCallbacks: Array<() => void> = [];

  let container: HTMLElement | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let hud: Hud | null = null;
  let guideArrows: GuideArrowLayer | null = null;
  let rig = new CameraRig('2d-side');
  let width = 1;
  let height = 1;

  let stageFit: { top: number; bottom: number; pitch?: number; follow?: string | null } | null = null;
  const EDITOR_BACKDROP = 0xe6e8ec;
  const STAGE_BACKDROP = 0xbfeedd;
  const backdropFor = (stage: boolean): number | null => (!stage ? EDITOR_BACKDROP : options.transparentStage ? null : STAGE_BACKDROP);

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
  /** Graph nodes selected in the editor; their objects get a collision frame while editing. */
  let selectedOwners: ReadonlySet<string> = new Set();

  const raycaster = new THREE.Raycaster();
  const uiBuf = new UiInputBuffer();
  const clicks = createClickTracker();

  function ensureRig(m: ViewMode): void {
    sceneView.setMode(m);
    if (rig.mode !== m) {
      rig = new CameraRig(m);
      rig.resize(width, height);
    }
    rig.setFit(stageFit);
    sceneView.setBackdrop(backdropFor(stageFit !== null));
  }

  function draw(dt: number, follow: boolean): void {
    if (!renderer) return;
    const entities = world ? world.entities() : [];
    sceneView.sync(entities, dt);
    sceneView.syncColliderFrames(entities, playing ? new Set() : selectedOwners);
    rig.update(entities, dt, follow, follow && world ? world.cameraCommand() : null);
    if (rig.mode === '3d') sceneView.focusSun(rig.focus, rig.size);
    renderer.render(sceneView.scene, rig.camera);
  }

  /** Redraw the static (non-playing) scene, e.g. after orbit or resize. */
  function redrawStatic(): void {
    if (playing) return; // the loop redraws every frame
    rig.snap();
    draw(0, false);
  }

  // Pack models load after the first draw; redraw the still editing scene (at most once a frame) as they arrive.
  let packRedraw = 0;
  onPackLoaded(() => {
    if (playing || packRedraw) return;
    packRedraw = requestAnimationFrame(() => {
      packRedraw = 0;
      if (!playing) draw(0, false);
    });
  });

  function showError(): void {
    hud?.showError(TEXT_VI.previewError);
  }

  function cancelLoop(): void {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function setPaused(paused: boolean): void {
    if (pacer.isPaused() === paused) return;
    if (paused) pacer.pause();
    else {
      pacer.resume();
      hud?.showPauseMenu(false, resumePlay);
    }
    for (const cb of pauseCallbacks) cb(paused);
  }

  /** Session over: back to the running state silently (listeners learn from stop / play). */
  function clearPause(): void {
    const was = pacer.isPaused();
    pacer.reset();
    if (was) for (const cb of pauseCallbacks) cb(false);
  }

  function resumePlay(): void {
    if (!playing || !pacer.isPaused()) return;
    setPaused(false);
    lastTime = performance.now();
  }

  /** Esc opens or closes the pause menu of a start screen that asked for one. */
  function onEscape(e: KeyboardEvent): void {
    if (e.code !== 'Escape' || !playing || !hud || world?.ended) return;
    const t = e.target;
    if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (hud.pauseMenuShown()) {
      resumePlay();
    } else if (hud.canPause() && !pacer.isPaused()) {
      setPaused(true);
      hud.showPauseMenu(true, resumePlay);
    }
  }

  function resetSession(): void {
    cancelLoop();
    uiBuf.clear();
    clicks.cancel();
    clearPause();
    playing = false;
    runtime = null;
    // Fresh figures per session so animation state never carries across restarts.
    sceneView.clear();
    hud?.hideEnd();
    hud?.hideError();
    // Values from a finished play session must not linger on the edit-mode preview.
    hud?.clearItems();
    guideArrows?.clear();
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

  /** Slow machines lose the shadows (the costliest part of the 3D look) instead of the frame rate. */
  const SLOW_FPS = 40;
  const WATCH_FRAMES = 90;
  let watchTime = 0;
  let watchFrames = 0;
  function watchFrameRate(dt: number): void {
    if (mode !== '3d' || !sceneView.shadowsOn || pacer.isPaused()) return;
    watchTime += dt;
    if (++watchFrames < WATCH_FRAMES) return;
    const fps = watchFrames / Math.max(watchTime, 0.001);
    watchTime = 0;
    watchFrames = 0;
    if (fps < SLOW_FPS) {
      sceneView.setShadowsAllowed(false);
      console.info(`Shadows turned off: ${fps.toFixed(0)} fps`);
    }
  }

  function frame(now: number): void {
    rafId = 0;
    if (!playing || !world || !runtime || !readInputFn) return;
    const dt = Math.min((now - lastTime) / 1000, 0.25);
    lastTime = now;
    watchFrameRate(dt);
    try {
      if (mode === '3d') world.setCameraYaw(rig.yaw);
      const steps = pacer.stepsFor(dt);
      for (let i = 0; i < steps && !world.ended; i++) {
        runtime.tick({ ...readInputFn(), ui: i === 0 ? uiBuf.take() : uiBuf.peekHeld() });
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
    guideArrows?.sync(guideArrowShapes(hudItems, (id) => world?.getEntity(id), rig.camera, width, height));
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
    // Layout size, not the on-screen box: the puzzle stage is scaled into a corner window by a transform.
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
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

  /** A click on the playing view reaches the game as the entities under the pointer. */
  function pickForGame(e: PointerEvent): void {
    if (!world || e.button !== 0 || !clicks.up(e.pointerId, e.clientX, e.clientY)) return;
    const ndc = toNdc(e.clientX, e.clientY);
    if (ndc) uiBuf.pick(pickEntities(ndc, rig.camera, world.entities(), mode === '3d'));
  }

  function onPointerDown(e: PointerEvent): void {
    if (playing && e.button === 0) clicks.down(e.pointerId, e.clientX, e.clientY);
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
    if (playing) pickForGame(e);
    if (drag && drag.id === e.pointerId) {
      drag = null;
      syncChrome();
    }
  }

  /** Redraws after the player moved the stage camera; a finished run (loop stopped) is redrawn from its last frame. */
  function redrawCamera(): void {
    if (playing) {
      if (!rafId) draw(0, true);
    } else {
      redrawStatic();
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
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: options.transparentStage === true });
      } catch (err) {
        console.error(err);
        el.textContent = TEXT_VI.previewError;
        container = null;
        return;
      }
      if (options.transparentStage) renderer.setClearColor(0x000000, 0);
      // Development only: lets browser checks read the triangle count of the last frame.
      if (import.meta.env.DEV && options.stage) (window as unknown as { __pzRenderInfo?: THREE.WebGLInfo }).__pzRenderInfo = renderer.info;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      const canvas = renderer.domElement;
      canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
      el.appendChild(canvas);
      hud = new Hud(() => restartCallbacks.forEach((cb) => cb()), {
        click: (key) => uiBuf.click(key),
        hold: (key, down) => uiBuf.hold(key, down),
      });
      el.appendChild(hud.root);
      guideArrows = new GuideArrowLayer(hud.root);
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('keydown', onEscape);
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
      sceneView.setGrid(m, !stageFit);
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
      watchTime = 0;
      watchFrames = 0;
      rig.snap();
      syncChrome();
      hud?.clearItems();
      guideArrows?.clear();
      lastTime = performance.now();
      rafId = requestAnimationFrame(frame);
    },

    stop(): void {
      cancelLoop();
      clearPause();
      playing = false;
      runtime = null;
      hud?.hideEnd();
    },

    setStageFit(fit): void {
      stageFit = fit;
      rig.setFit(fit);
      sceneView.setBackdrop(backdropFor(fit !== null));
      if (!playing) {
        sceneView.setGrid(mode, !fit);
        redrawStatic();
      }
    },

    resetCamera(): void {
      resetOnNextPreview = true;
    },

    pause(): void {
      if (playing) setPaused(true);
    },

    resume: resumePlay,

    stepFrame(): void {
      if (playing) pacer.requestStep(); // the running loop picks it up on the next frame
    },

    isPaused: () => playing && pacer.isPaused(),

    onPauseChange(cb): void {
      pauseCallbacks.push(cb);
    },

    applyNodeParams(nodeId: string, params: Record<string, unknown>): boolean {
      if (!playing || !runtime) return false;
      try {
        return runtime.applyNodeParams(nodeId, params as Params);
      } catch (err) {
        console.error(err);
        return false;
      }
    },

    setSelection(ownerNodeIds: ReadonlySet<string>): void {
      selectedOwners = new Set(ownerNodeIds);
      redrawStatic();
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

    panCamera(dxPx: number, dyPx: number): void {
      rig.userPanBy(dxPx, dyPx);
      redrawCamera();
    },

    zoomCamera(factor: number, clientX: number, clientY: number): void {
      const ndc = toNdc(clientX, clientY);
      rig.userZoomBy(factor, ndc ? { x: ndc.x, y: ndc.y } : undefined);
      redrawCamera();
    },

    resetStageCamera(animate = true): void {
      rig.resetUserCamera(animate && playing && rafId !== 0);
      redrawCamera();
    },

    cameraState: () => rig.userCamera,

    resize(): void {
      applySize();
    },
  };
}
