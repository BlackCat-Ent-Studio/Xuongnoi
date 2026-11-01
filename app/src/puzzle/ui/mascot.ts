import * as THREE from 'three';
import { PartKit, styleFor, type FaceControl, type StyleRig } from '../../render/character-styles';
import { motionOf } from '../../render/character-motion';
import { createTalker } from './mascot-talk';
import './mascot.css';

/**
 * The tutorial guide's mascot: Mèo Mun Chibi in a round frame that talks (types the line out while its
 * mouth flaps and its head nods) and blinks now and then. The guide only uses this interface, so the
 * guide and the talking cat can be built separately.
 */
export type MascotMood = 'normal' | 'happy';

export interface Mascot {
  /** The round frame element to place inside the guide bubble row. */
  readonly el: HTMLElement;
  /** Say a line: types it into `textEl` and animates the cat while typing. Replaces any line in progress. */
  talk(text: string, mood?: MascotMood): void;
  /** Show the whole current line at once and stop talking. */
  finish(): void;
  /** Pause rendering (guide hidden) or resume it. */
  setVisible(on: boolean): void;
  dispose(): void;
}

/** Turn of the cat toward the bubble on the right, in radians. */
const TURN = 0.42;
const FOV = 30;
/** How much of the portrait height the round frame shows (smaller = closer), and how far its centre sits above the portrait's. */
const FRAME_SHARE = 0.9;
const AIM_UP = 0.0;
const MAX_DT = 0.05;
const SETTLE_STEPS = 12;

const faces = new WeakMap<HTMLElement, FaceControl>();

/** The cat's face controls behind a mascot (tests and previews force poses with it); absent without WebGL. */
export function mascotFace(mascot: Mascot): FaceControl | undefined {
  return faces.get(mascot.el);
}

interface Stage {
  rig: StyleRig;
  face: FaceControl;
  render(): void;
  resize(): void;
  dispose(): void;
}

/** Builds the small three.js scene around the engine's chibi cat; throws when WebGL is unavailable. */
function createStage(frame: HTMLElement): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const kit = new PartKit('#ffffff');
    const rig = styleFor('cat-chibi').build(kit);
    const face = rig.face;
    if (!face) throw new Error('cat-chibi has no face controls');

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xdfeaff, 0x7a6aa8, 2.4));
    const key = new THREE.DirectionalLight(0xffe2bd, 2.6);
    key.position.set(3.5, 6, 5);
    scene.add(key);
    const back = new THREE.DirectionalLight(0xb9a8ff, 1.4);
    back.position.set(-4, 3, -5);
    scene.add(back);
    // The rig faces +X; turn it to face the camera (+Z) and then a little toward the right.
    rig.root.rotation.y = -Math.PI / 2 + TURN;
    scene.add(rig.root);

    const { y, height } = face.portrait;
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    // Head and upper chest only: the window is a part of the portrait height, centred a little above its middle.
    const view = height * FRAME_SHARE;
    const dist = view / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const aimY = y + height * AIM_UP;
    camera.position.set(0, aimY + view * 0.12, dist);
    camera.lookAt(0, aimY, 0);

    frame.appendChild(renderer.domElement);
    return {
      rig,
      face,
      render: () => renderer.render(scene, camera),
      resize() {
        const w = frame.clientWidth;
        const h = frame.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      },
      dispose() {
        renderer.domElement.remove();
        kit.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      },
    };
  } catch (err) {
    renderer.dispose();
    throw err;
  }
}

export function createMascot(textEl: HTMLElement): Mascot {
  const el = document.createElement('div');
  el.className = 'pz-mascot-frame';
  const reducedQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = (): boolean => reducedQuery?.matches === true;

  let stage: Stage | null = null;
  try {
    stage = createStage(el);
    faces.set(el, stage.face);
  } catch (err) {
    console.warn('Mascot: 3D cat unavailable, using plain text.', err);
    el.classList.add('is-plain');
  }

  // Text is typed into an overlay on top of an invisible copy of the whole line, so the bubble never resizes.
  const ghost = document.createElement('span');
  ghost.className = 'pz-say-ghost';
  const typed = document.createElement('span');
  typed.className = 'pz-say-typed';
  typed.setAttribute('aria-hidden', 'true');
  const say = document.createElement('span');
  say.className = 'pz-say';
  say.append(ghost, typed);

  const talker = createTalker();
  let chars: readonly string[] = [];
  let line = '';
  let shownDrawn = -1;
  let visible = true;
  let disposed = false;
  let raf = 0;
  let last = 0;
  let time = 0;

  const drawText = (shown: number): void => {
    if (shown === shownDrawn) return;
    shownDrawn = shown;
    typed.textContent = shown >= chars.length ? line : chars.slice(0, shown).join('');
  };
  const showPlain = (): void => {
    textEl.textContent = line;
  };

  /** Advances the animation by `dt` and draws a frame. */
  const frameStep = (dt: number): void => {
    if (!stage) return;
    time += dt;
    const p = talker.step(time, dt);
    drawText(p.shown);
    stage.face.setMouthOpen(p.mouth);
    stage.face.setHeadPose(p.headX, p.headY, p.headZ);
    stage.face.setEarFlick(p.earSide, p.ear);
    const motion = motionOf(0, false, 0, reduced() ? 0 : time);
    // A still frame has no time to ease the eyes into place, so let the pose settle first.
    for (let i = 0; i < (dt > 0 ? 1 : SETTLE_STEPS); i++) stage.rig.update(motion, dt > 0 ? dt : MAX_DT);
    stage.render();
  };

  const loop = (ms: number): void => {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min((ms - last) / 1000, MAX_DT) : 0;
    last = ms;
    if (document.hidden || !el.clientWidth) return;
    frameStep(dt);
  };
  const startLoop = (): void => {
    if (raf || disposed || !stage || !visible || reduced()) return;
    last = 0;
    raf = requestAnimationFrame(loop);
  };
  const stopLoop = (): void => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  /** A still frame (reduced motion draws only when something changes). */
  const drawOnce = (): void => {
    if (visible && !disposed && reduced()) frameStep(0);
  };

  const observer = typeof ResizeObserver === 'function' && stage ? new ResizeObserver(() => { stage?.resize(); drawOnce(); }) : null;
  observer?.observe(el);
  stage?.resize();
  startLoop();

  return {
    el,
    talk(text, mood = 'normal') {
      if (disposed) return;
      line = text;
      if (!stage) {
        showPlain();
        return;
      }
      if (say.parentNode !== textEl) textEl.replaceChildren(say);
      ghost.textContent = text;
      shownDrawn = -1;
      chars = talker.start(text, reduced());
      stage.face.setHappy(mood === 'happy' ? 1 : 0);
      drawText(talker.step(time, 0).shown);
      startLoop();
      drawOnce();
    },
    finish() {
      if (disposed) return;
      if (!stage) {
        showPlain();
        return;
      }
      talker.finish();
      drawText(chars.length);
      stage.face.setMouthOpen(0);
      drawOnce();
    },
    setVisible(on) {
      visible = on;
      if (on) {
        startLoop();
        drawOnce();
      } else {
        stopLoop();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopLoop();
      observer?.disconnect();
      stage?.dispose();
      stage = null;
      faces.delete(el);
      el.remove();
    },
  };
}
