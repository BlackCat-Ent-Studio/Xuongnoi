/** Pure sound helpers (no WebAudio): note tables, event type, rate limiter. */

/** One sound to play. `t` is the start in seconds from the start of the sequence. */
export interface SynthEvent {
  t: number;
  voice: 'pluck' | 'bell' | 'pad' | 'blip' | 'wood' | 'thump' | 'whoosh' | 'shaker';
  /** Pitch in Hz (for 'whoosh' the start of the filter sweep). */
  freq: number;
  /** Pitch (or filter sweep) at the end, for gliding voices. */
  endFreq?: number;
  dur: number;
  /** Peak level of this voice, 0..1 (before the buses). */
  gain: number;
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Major pentatonic steps (C D E G A): every combination sounds friendly. */
export const PENTATONIC = [0, 2, 4, 7, 9] as const;

/** MIDI number of pentatonic degree `deg` (0 = root, may be negative or above 4) over a root note. */
export function pentatonicMidi(rootMidi: number, deg: number): number {
  const n = PENTATONIC.length;
  const octave = Math.floor(deg / n);
  const idx = ((deg % n) + n) % n;
  return rootMidi + octave * 12 + (PENTATONIC[idx] ?? 0);
}

/** Small deterministic random generator so a music loop is repeatable (and testable). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Allows the same key at most once per `minGapMs`. */
export function createRateLimiter(minGapMs: number): (key: string, nowMs: number) => boolean {
  const last = new Map<string, number>();
  return (key, nowMs) => {
    const prev = last.get(key);
    if (prev !== undefined && nowMs >= prev && nowMs - prev < minGapMs) return false;
    last.set(key, nowMs);
    return true;
  };
}

/** Counts stars inside one win card: 0, 1, 2 ... resets after a quiet gap or `reset()`. */
export function createStarCounter(resetGapMs = 2500, maxIndex = 4) {
  let count = 0;
  let lastMs = -Infinity;
  return {
    next(nowMs: number): number {
      if (nowMs - lastMs > resetGapMs || nowMs < lastMs) count = 0;
      lastMs = nowMs;
      const i = Math.min(count, maxIndex);
      count += 1;
      return i;
    },
    reset(): void {
      count = 0;
      lastMs = -Infinity;
    },
  };
}
