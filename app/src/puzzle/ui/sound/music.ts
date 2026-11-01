import type { MusicScene } from '../sound';
import { midiToHz, mulberry32, pentatonicMidi, type SynthEvent } from './notes';

interface SceneStyle {
  bpm: number;
  /** Chord roots (MIDI), 2 bars each, over the 8-bar loop. */
  roots: readonly number[];
  melodyGain: number;
  padGain: number;
  /** Chance that an off-beat melody step plays (rest otherwise). */
  density: number;
}

export const SCENE_STYLE: Readonly<Record<MusicScene, SceneStyle>> = {
  menu: { bpm: 92, roots: [48, 45, 50, 43], melodyGain: 0.1, padGain: 0.05, density: 0.5 },
  level: { bpm: 82, roots: [48, 43, 45, 50], melodyGain: 0.07, padGain: 0.045, density: 0.32 },
};

export const BARS_PER_LOOP = 8;
const BEATS_PER_BAR = 4;
const VARIANTS = 4;

export interface MusicLoop {
  /** Events with `t` in seconds from the start of the loop. */
  events: SynthEvent[];
  /** Loop length in seconds. */
  length: number;
}

/** Builds one 8-bar loop. Different `loopIndex` (mod 4) give a different melody over the same chords. */
export function buildLoop(scene: MusicScene, loopIndex: number): MusicLoop {
  const st = SCENE_STYLE[scene];
  const beat = 60 / st.bpm;
  const rand = mulberry32((scene === 'menu' ? 1000 : 2000) + (loopIndex % VARIANTS));
  const events: SynthEvent[] = [];
  let deg = 5; // pentatonic degree over C4: 5 = C5
  for (let bar = 0; bar < BARS_PER_LOOP; bar++) {
    const root = st.roots[Math.floor(bar / 2) % st.roots.length] ?? 48;
    const t0 = bar * BEATS_PER_BAR * beat;
    // pad: root + fifth + octave, one soft chord per 2 bars
    if (bar % 2 === 0) {
      for (const s of [0, 7, 12]) {
        events.push({ t: t0, voice: 'pad', freq: midiToHz(root + 12 + s), dur: beat * 8 * 0.98, gain: st.padGain });
      }
    }
    // melody: eighth-note grid, random walk over the pentatonic scale, with rests
    for (let step = 0; step < 8; step++) {
      const strong = step % 4 === 0;
      if (rand() > (strong ? Math.min(st.density + 0.35, 0.95) : st.density)) continue;
      deg = Math.min(Math.max(deg + Math.floor(rand() * 5) - 2, 1), 9);
      if (bar === BARS_PER_LOOP - 1 && step === 0) deg = 5; // settle on the root before the loop repeats
      events.push({
        t: t0 + step * beat * 0.5,
        voice: 'pluck',
        freq: midiToHz(pentatonicMidi(60, deg)),
        dur: beat * (strong ? 1.4 : 0.9),
        gain: st.melodyGain * (strong ? 1 : 0.75),
      });
    }
    // light percussion: soft thump on beat 1, quiet wood on beat 3, shaker on off-beats (menu only)
    events.push({ t: t0, voice: 'thump', freq: 90, dur: 0.25, gain: scene === 'menu' ? 0.12 : 0.08 });
    events.push({ t: t0 + 2 * beat, voice: 'wood', freq: 640, dur: 0.07, gain: 0.05 });
    if (scene === 'menu') {
      for (let b = 0; b < 4; b++) events.push({ t: t0 + (b + 0.5) * beat, voice: 'shaker', freq: 5000, dur: 0.05, gain: 0.025 });
    }
  }
  events.sort((a, b) => a.t - b.t);
  return { events, length: BARS_PER_LOOP * BEATS_PER_BAR * beat };
}

export interface TimedEvent {
  /** Seconds from the start of the music. */
  time: number;
  event: SynthEvent;
}

/** Hands out the events of an endless music scene in time order, loop after loop. */
export class MusicCursor {
  private loopIndex = 0;
  private loopStart = 0;
  private loop: MusicLoop;
  private next = 0;

  constructor(private readonly scene: MusicScene) {
    this.loop = buildLoop(scene, 0);
  }

  /** All not-yet-returned events that start before `untilSec`. */
  take(untilSec: number): TimedEvent[] {
    const out: TimedEvent[] = [];
    for (;;) {
      const ev = this.loop.events[this.next];
      if (!ev) {
        const end = this.loopStart + this.loop.length;
        if (end >= untilSec) break;
        this.loopIndex += 1;
        this.loopStart = end;
        this.loop = buildLoop(this.scene, this.loopIndex);
        this.next = 0;
        continue;
      }
      const time = this.loopStart + ev.t;
      if (time >= untilSec) break;
      out.push({ time, event: ev });
      this.next += 1;
    }
    return out;
  }
}
