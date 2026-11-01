import * as THREE from 'three';
import { motionOf } from '../../render/character-motion';
import { PartKit, styleFor, type StyleRig } from '../../render/character-styles';

/**
 * A small three.js view of the game's characters standing on a floor line, for the title and ending screens.
 * It builds the characters from the engine's own looks (robot-wheel, robot-legs, cat-chibi), unchanged.
 * The view covers the whole screen frame; it is transparent, so the wooden backdrop shows around the figures.
 */
export type StageMood = 'idle' | 'cheer';

export interface CharacterStage {
  dispose(): void;
}

interface Slot {
  look: string;
  /** Horizontal centre as a share of the frame width. */
  x: number;
  /** Figure height in frame heights. */
  size: number;
  /** Turn toward the camera plus this many radians (positive = toward the right). */
  turn: number;
  /** Starts of the idle wave and the hop of the cheer are shifted by this many seconds. */
  offset: number;
}

const SLOTS: readonly Slot[] = [
  { look: 'cat-chibi', x: 0.2, size: 0.46, turn: 0.45, offset: 0 },
  { look: 'robot-wheel', x: 0.76, size: 0.4, turn: -0.4, offset: 1.7 },
  { look: 'robot-legs', x: 0.9, size: 0.4, turn: -0.5, offset: 3.4 },
];

/** Robots wear the colour the levels use. The cat keeps its own black. */
const ROBOT_TINT = '#7cc4f0';
/** Frame aspect (844 x 390) and where the floor line sits, from the top, as a share of the frame height. */
const ASPECT = 844 / 390;
const FLOOR_Y = 0.875;
const WAVE_EVERY = 5.5;
const WAVE_FOR = 1.5;
const HOP_HEIGHT = 0.3;
const MAX_DT = 0.05;

interface Figure {
  slot: Slot;
  rig: StyleRig;
  kit: PartKit;
  group: THREE.Group;
  baseY: number;
  phase: number;
}

export function createCharacterStage(frame: HTMLElement, mood: StageMood): CharacterStage | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (err) {
    console.warn('Character stage: 3D unavailable.', err);
    return null;
  }
  const reducedQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = (): boolean => reducedQuery?.matches === true;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'pz-char-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  // The camera maps one world unit to 1/H of the frame height, so slots can be placed in frame shares.
  const H = 4;
  const W = H * ASPECT;
  const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 50);
  camera.position.set(0, 0, 10);
  const floorWorldY = H / 2 - FLOOR_Y * H;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff0d8, 0x8a6a4a, 2.6));
  const key = new THREE.DirectionalLight(0xffe2bd, 2.4);
  key.position.set(3.5, 6, 5);
  scene.add(key);
  const back = new THREE.DirectionalLight(0xffc98a, 1.2);
  back.position.set(-4, 3, -5);
  scene.add(back);

  const shadowGeo = new THREE.CircleGeometry(0.5, 24);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x1a0d05, transparent: true, opacity: 0.28, depthWrite: false });

  const figures: Figure[] = [];
  const disposeAll = (): void => {
    for (const f of figures) f.kit.dispose();
    shadowGeo.dispose();
    shadowMat.dispose();
    renderer.dispose();
  };
  try {
    for (const slot of SLOTS) {
      const kit = new PartKit(slot.look.startsWith('robot') ? ROBOT_TINT : '#ffffff');
      const rig = styleFor(slot.look).build(kit);
      const size = slot.size * H;
      const group = new THREE.Group();
      // The rig is 1 unit tall, base on y -0.5, facing +X: face the camera, then turn a little.
      rig.root.rotation.y = -Math.PI / 2 + slot.turn;
      group.add(rig.root);
      group.scale.setScalar(size);
      const baseY = floorWorldY + size * 0.5;
      group.position.set((slot.x - 0.5) * W, baseY, 0);
      scene.add(group);
      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.scale.set(size * 0.7, size * 0.16, 1);
      shadow.position.set(group.position.x, floorWorldY - 0.01, -1);
      scene.add(shadow);
      figures.push({ slot, rig, kit, group, baseY, phase: 0 });
    }
  } catch (err) {
    disposeAll();
    console.warn('Character stage: could not build the figures.', err);
    return null;
  }
  frame.append(canvas);

  let raf = 0;
  let last = 0;
  let time = 0;
  let disposed = false;

  const resize = (): void => {
    const w = frame.clientWidth;
    const h = frame.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
  };

  /** Draws one frame `dt` seconds after the last. */
  function frameStep(dt: number): void {
    time += dt;
    for (const f of figures) {
      const t = time + f.slot.offset;
      let lift = 0;
      let airborne = false;
      let vy = 0;
      const face = f.rig.face;
      if (mood === 'cheer') {
        // Hop with the arms up, one after the other.
        const hop = Math.abs(Math.sin(t * 4.2));
        lift = hop * HOP_HEIGHT * f.slot.size * H;
        airborne = hop > 0.12;
        vy = Math.cos(t * 4.2) >= 0 ? 1 : -1;
        face?.setHappy(1);
        face?.setMouthOpen(0.6 + 0.4 * Math.sin(t * 8));
      } else {
        // Gentle bob; every few seconds the figure raises its arms for a moment, like a wave.
        lift = (0.5 + 0.5 * Math.sin(t * 1.7)) * 0.012 * H;
        airborne = t % WAVE_EVERY < WAVE_FOR;
        vy = 1;
        face?.setHeadPose(0.04 * Math.sin(t * 0.9), 0.22 * Math.sin(t * 0.6), 0.05 * Math.sin(t * 0.8));
        if (face && Math.floor(t / 3.1) % 2 === 0 && t % 3.1 < 0.25) face.setEarFlick(1, 1);
      }
      f.group.position.y = f.baseY + lift;
      f.rig.update(motionOf(0, airborne, f.phase, reduced() ? 0 : t, vy), dt > 0 ? dt : MAX_DT);
    }
    renderer.render(scene, camera);
  }

  const loop = (ms: number): void => {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min((ms - last) / 1000, MAX_DT) : 0;
    last = ms;
    if (document.hidden || !frame.clientWidth) return;
    frameStep(dt);
  };
  const start = (): void => {
    if (raf || disposed) return;
    if (reduced()) {
      // One still frame; the poses need a few steps to settle.
      for (let i = 0; i < 12; i++) frameStep(MAX_DT);
      return;
    }
    last = 0;
    raf = requestAnimationFrame(loop);
  };

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    resize();
    if (reduced()) frameStep(0);
  }) : null;
  observer?.observe(frame);
  resize();
  start();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      observer?.disconnect();
      canvas.remove();
      disposeAll();
      renderer.forceContextLoss();
    },
  };
}
