import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type EntityView, type InputSnapshot } from '../../src/engine/types';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { buildPlayGraph } from '../../src/puzzle/run-level';
import { puzzleWorldOptions } from '../../src/puzzle/world-options';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';
import { CameraRig } from '../../src/render/cameras';
import { createAccumulator, createSimPacer } from '../../src/render/game-loop';
import { Humanoid } from '../../src/render/humanoid-model';
import { TickBlender } from '../../src/render/tick-blend';

const NO_KEYS: InputSnapshot = { keysDown: new Set<string>() };

/** Deterministic uneven frame times: a screen at `hz` whose frames arrive up to `jitter` of a frame early or late. */
function frameTimes(hz: number, jitter: number, seconds: number): number[] {
  let seed = 12345;
  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const out: number[] = [];
  const period = 1 / hz;
  for (let k = 1; k * period < seconds; k++) out.push(k * period + (rnd() - 0.5) * 2 * jitter * period);
  return out;
}

interface Series {
  /** Per-frame hero world position as drawn. */
  hero: Array<{ x: number; y: number; z: number }>;
  /** Per-frame camera focus. */
  cam: Array<{ x: number; y: number; z: number }>;
  /** Per-frame walk speed the figure animation believes (units/s). */
  anim: number[];
  /** True when the simulation itself moved the hero in this frame's ticks. */
  moving: boolean[];
}

function playFrames(levelIndex: number, hz: number, jitter: number, blend: boolean, seconds: number): Series {
  registerAllNodes();
  const level = PUZZLE_LEVELS[levelIndex]!;
  const world = createWorld(level.mode, puzzleWorldOptions(level.mode));
  const rt = createRuntime(buildPlayGraph(level, level.solution), world, level.mode);
  const pacer = createSimPacer(createAccumulator());
  const blender = new TickBlender();
  const rig = new CameraRig(level.mode);
  rig.resize(844, 390);
  const start = world.entities().find((e) => e.kind === 'character' && e.visible);
  const heroOwner = start?.ownerNodeId ?? null;
  rig.setFit({ top: 0.15, bottom: 0.2, follow: heroOwner, heroScale: 1.6, ...(level.mode === '2d-side' ? { sidePitch: 0.2 } : {}), ...(level.mode === '3d' ? { pitch: 0.9 } : {}) });
  rig.snap();
  blender.capture(world.entities());
  rig.update(world.entities(), 0, true);
  const figure = new Humanoid('#7cc4f0', level.mode, start?.look);
  const out: Series = { hero: [], cam: [], anim: [], moving: [] };
  let last = 0;
  let prevTickPos = start?.position ?? { x: 0, y: 0, z: 0 };
  for (const t of frameTimes(hz, jitter, seconds)) {
    const dt = t - last;
    last = t;
    const steps = pacer.stepsFor(dt);
    for (let i = 0; i < steps && !world.ended; i++) {
      rt.tick(NO_KEYS);
      world.step(TICK_DT);
      if (i >= steps - 2) blender.capture(world.entities());
    }
    const raw = world.entities();
    const heroRaw = raw.find((e) => e.ownerNodeId === heroOwner && e.kind === 'character');
    let tickMoved = false;
    if (heroRaw) {
      tickMoved = Math.hypot(heroRaw.position.x - prevTickPos.x, heroRaw.position.z - prevTickPos.z) > 1e-6;
      prevTickPos = heroRaw.position;
    }
    const shown: readonly EntityView[] = blend && !world.ended ? blender.blend(raw, pacer.alpha()) : raw;
    rig.update(shown, dt, true);
    const hero = shown.find((e) => e.ownerNodeId === heroOwner && e.kind === 'character');
    if (!hero) continue;
    figure.update(hero, dt);
    out.hero.push({ ...hero.position });
    out.cam.push({ x: rig.focus.x, y: rig.focus.y, z: rig.focus.z });
    const f = figure as unknown as { vx: number; vz: number };
    out.anim.push(level.mode === '2d-side' ? Math.abs(f.vx) : Math.hypot(f.vx, f.vz));
    out.moving.push(tickMoved);
    if (world.ended) break;
  }
  return out;
}

interface Jitter {
  frames: number;
  /** Frames where the hero stood still on screen although the world was moving it. */
  stalls: number;
  /** Direction reversals along the main travel axis between consecutive nonzero moves. */
  reversals: number;
  /** Coefficient of variation (stdev / mean) of the per-frame step while moving. */
  cv: number;
  /** Largest step divided by the median step while moving. */
  maxOverMedian: number;
  camCv: number;
  /** Stdev / mean of the walk speed the figure animation sees while the hero keeps moving (leg swing follows it). */
  animCv: number;
  /** Mean change of the step from one frame to the next, relative to the mean step: 0 = perfectly even. */
  rough: number;
  camRough: number;
}

function stats(steps: number[]): { cv: number; maxOverMedian: number } {
  if (steps.length < 3) return { cv: 0, maxOverMedian: 1 };
  const mean = steps.reduce((s, v) => s + v, 0) / steps.length;
  const sd = Math.sqrt(steps.reduce((s, v) => s + (v - mean) ** 2, 0) / steps.length);
  const sorted = [...steps].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)]!;
  return { cv: mean > 0 ? sd / mean : 0, maxOverMedian: med > 0 ? sorted[sorted.length - 1]! / med : 99 };
}

function roughness(steps: number[]): number {
  if (steps.length < 3) return 0;
  const mean = steps.reduce((s, v) => s + v, 0) / steps.length;
  let sum = 0;
  for (let i = 1; i < steps.length; i++) sum += Math.abs(steps[i]! - steps[i - 1]!);
  return mean > 0 ? sum / (steps.length - 1) / mean : 0;
}

function jitterOf(s: Series): Jitter {
  const horiz = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(b.x - a.x, b.z - a.z);
  const steps: number[] = [];
  const camSteps: number[] = [];
  let stalls = 0;
  let reversals = 0;
  const anim: number[] = [];
  let prevSign = 0;
  const first = s.hero[0]!;
  const lastPos = s.hero[s.hero.length - 1]!;
  const travelX = Math.abs(lastPos.x - first.x) >= Math.abs(lastPos.z - first.z);
  for (let i = 2; i < s.hero.length; i++) {
    const d = horiz(s.hero[i - 1]!, s.hero[i]!);
    // "Moving" = the world moved the hero in this or the previous frame (tick truth), so rests are not counted.
    if (s.moving[i] || s.moving[i - 1]) {
      if (d < 1e-7) stalls++;
      steps.push(d);
      camSteps.push(horiz(s.cam[i - 1]!, s.cam[i]!));
    }
    const along = travelX ? s.hero[i]!.x - s.hero[i - 1]!.x : s.hero[i]!.z - s.hero[i - 1]!.z;
    const sign = Math.abs(along) < 1e-7 ? 0 : Math.sign(along);
    if (sign !== 0) {
      if (prevSign !== 0 && sign !== prevSign) reversals++;
      prevSign = sign;
    }
    if (i >= 12 && horiz(s.hero[i - 12]!, s.hero[i]!) > 0.05) anim.push(s.anim[i]!);
  }
  const st = stats(steps);
  return { frames: s.hero.length, stalls, reversals, cv: st.cv, maxOverMedian: st.maxOverMedian, camCv: stats(camSteps).cv, animCv: stats(anim).cv, rough: roughness(steps), camRough: roughness(camSteps) };
}

const RATES: Array<[string, number, number]> = [
  ['60Hz uneven', 60, 0.25],
  ['120Hz', 120, 0.05],
  ['144Hz', 144, 0.05],
];

describe('smooth motion on screen', () => {
  for (let li = 0; li < PUZZLE_LEVELS.length; li++) {
    for (const [name, hz, jit] of RATES) {
      it(`level ${li + 1} @ ${name}: blended motion is steadier than raw ticks`, () => {
        const secs = Math.min(PUZZLE_LEVELS[li]!.timeLimit, 20);
        const raw = jitterOf(playFrames(li, hz, jit, false, secs));
        const mix = jitterOf(playFrames(li, hz, jit, true, secs));
        expect(mix.stalls).toBeLessThanOrEqual(raw.stalls);
        expect(mix.reversals).toBeLessThanOrEqual(raw.reversals);
        expect(mix.cv).toBeLessThanOrEqual(raw.cv + 1e-9);
        expect(mix.rough).toBeLessThanOrEqual(raw.rough);
        // Absolute bar: no frame of the blended hero stands still while the world moves it, and steps stay even.
        if (hz > 60) expect(mix.stalls).toBe(0);
        expect(mix.maxOverMedian).toBeLessThan(1.6);
        expect(mix.camRough).toBeLessThanOrEqual(raw.camRough + 0.01);
        expect(mix.animCv).toBeLessThanOrEqual(raw.animCv + 0.01);
      });
    }
  }
});
