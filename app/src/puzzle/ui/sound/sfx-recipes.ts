import type { SfxName } from '../sound';
import { midiToHz as hz, pentatonicMidi, type SynthEvent } from './notes';

const C5 = 72; // MIDI number of C5 (middle C = 60)

/** Pure recipe of one effect: a list of soft notes. `starIndex` raises the pitch of 'star' inside a win. */
export function sfxEvents(name: SfxName, starIndex = 0): SynthEvent[] {
  switch (name) {
    case 'tap':
      return [{ t: 0, voice: 'wood', freq: 760, dur: 0.07, gain: 0.45 }];
    case 'pick':
      return [
        { t: 0, voice: 'wood', freq: 520, dur: 0.08, gain: 0.3 },
        { t: 0.04, voice: 'pluck', freq: hz(C5 - 5), dur: 0.18, gain: 0.2 },
      ];
    case 'wire':
      return [
        { t: 0, voice: 'blip', freq: 560, endFreq: 880, dur: 0.11, gain: 0.2 },
        { t: 0.09, voice: 'pluck', freq: hz(C5 + 7), dur: 0.2, gain: 0.22 },
      ];
    case 'unwire':
      return [{ t: 0, voice: 'blip', freq: 700, endFreq: 380, dur: 0.16, gain: 0.3 }];
    case 'run':
      return [
        { t: 0, voice: 'pluck', freq: hz(C5), dur: 0.2, gain: 0.26 },
        { t: 0.08, voice: 'pluck', freq: hz(C5 + 4), dur: 0.2, gain: 0.26 },
        { t: 0.16, voice: 'pluck', freq: hz(C5 + 7), dur: 0.22, gain: 0.26 },
        { t: 0.25, voice: 'bell', freq: hz(C5 + 12), dur: 0.5, gain: 0.2 },
      ];
    case 'stop':
      return [
        { t: 0, voice: 'pluck', freq: hz(C5 - 5), dur: 0.2, gain: 0.26 },
        { t: 0.1, voice: 'pluck', freq: hz(C5 - 12), dur: 0.3, gain: 0.26 },
      ];
    case 'win': {
      const run = [0, 4, 7, 12].map((s, i): SynthEvent => ({ t: i * 0.14, voice: 'pluck', freq: hz(C5 + s), dur: 0.3, gain: 0.26 }));
      const chord = [0, 4, 7, 12].map((s): SynthEvent => ({ t: 0.62, voice: 'bell', freq: hz(C5 + s), dur: 0.85, gain: 0.15 }));
      return [...run, { t: 0.62, voice: 'pluck', freq: hz(C5 + 16), dur: 0.6, gain: 0.2 }, ...chord];
    }
    case 'lose':
      return [
        { t: 0, voice: 'blip', freq: hz(C5 - 5), endFreq: hz(C5 - 8), dur: 0.4, gain: 0.2 },
        { t: 0.34, voice: 'blip', freq: hz(C5 - 8), endFreq: hz(C5 - 12), dur: 0.6, gain: 0.2 },
      ];
    case 'star': {
      const f = hz(pentatonicMidi(C5 + 12, Math.min(Math.max(starIndex, 0), 4)));
      return [
        { t: 0, voice: 'bell', freq: f, dur: 0.6, gain: 0.26 },
        { t: 0.05, voice: 'bell', freq: f * 2, dur: 0.3, gain: 0.07 },
      ];
    }
    case 'hint':
      return [
        { t: 0, voice: 'bell', freq: hz(C5 + 4), dur: 0.55, gain: 0.18 },
        { t: 0.13, voice: 'bell', freq: hz(C5 + 7), dur: 0.7, gain: 0.18 },
      ];
    case 'unlock':
      return [0, 1, 2, 3, 4, 5].map((d, i): SynthEvent => ({
        t: i * 0.06,
        voice: 'bell',
        freq: hz(pentatonicMidi(C5, d + 5)),
        dur: 0.4,
        gain: 0.14,
      }));
    case 'page':
      return [{ t: 0, voice: 'whoosh', freq: 400, endFreq: 1100, dur: 0.26, gain: 0.05 }];
  }
}

/** Length in seconds until the effect has faded out. */
export function sfxDuration(events: readonly SynthEvent[]): number {
  return events.reduce((m, e) => Math.max(m, e.t + e.dur), 0);
}
