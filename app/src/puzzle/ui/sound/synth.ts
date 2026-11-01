/** WebAudio voices: turns a SynthEvent into a few short-lived nodes. Works on a real or an offline context. */
import type { SynthEvent } from './notes';

export interface Buses {
  sfx: GainNode;
  music: GainNode;
}

/** Effects and music go through one soft limiter so a pile-up of notes can never clip. */
export function createBuses(ctx: BaseAudioContext, destination: AudioNode): Buses {
  const master = ctx.createGain();
  master.gain.value = 0.85;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 10;
  limiter.ratio.value = 10;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  limiter.connect(master).connect(destination);
  const sfx = ctx.createGain();
  sfx.gain.value = 1;
  sfx.connect(limiter);
  const music = ctx.createGain();
  music.gain.value = 0.3; // music stays clearly below the effects
  music.connect(limiter);
  return { sfx, music };
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** One shared second of white noise per context (never grows). */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
    noiseCache.set(ctx, buf);
  }
  return buf;
}

const MIN = 0.0001;

/** Gain node with a soft attack and an exponential decay; frees itself when the sound ends. */
function envelope(ctx: BaseAudioContext, out: AudioNode, at: number, peak: number, attack: number, dur: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(MIN, at);
  g.gain.linearRampToValueAtTime(Math.max(peak, MIN), at + attack);
  g.gain.exponentialRampToValueAtTime(MIN, at + Math.max(dur, attack + 0.01));
  g.connect(out);
  return g;
}

function osc(ctx: BaseAudioContext, type: OscillatorType, freq: number, dst: AudioNode, start: number, stop: number, endFreq?: number): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (endFreq !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), start + (stop - start) * 0.9);
  o.connect(dst);
  o.start(start);
  o.stop(stop);
  return o;
}

function noise(ctx: BaseAudioContext, dst: AudioNode, start: number, stop: number): AudioBufferSourceNode {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx);
  n.loop = true;
  n.connect(dst);
  n.start(start, 0);
  n.stop(stop);
  return n;
}

/** Plays one event at absolute context time `at` (seconds) into `out`. */
export function playVoice(ctx: BaseAudioContext, out: AudioNode, ev: SynthEvent, at: number): void {
  const end = at + ev.dur + 0.05;
  const owned: AudioNode[] = [];
  let last: AudioScheduledSourceNode | null = null;
  const track = <T extends AudioNode>(n: T): T => {
    owned.push(n);
    return n;
  };
  switch (ev.voice) {
    case 'pluck': {
      // marimba-like: soft sine + a quickly fading upper partial
      const body = track(envelope(ctx, out, at, ev.gain, 0.004, ev.dur));
      last = osc(ctx, 'sine', ev.freq, body, at, end);
      const top = track(envelope(ctx, out, at, ev.gain * 0.3, 0.002, ev.dur * 0.25));
      osc(ctx, 'sine', ev.freq * 4, top, at, end);
      break;
    }
    case 'bell': {
      const body = track(envelope(ctx, out, at, ev.gain, 0.004, ev.dur));
      last = osc(ctx, 'sine', ev.freq, body, at, end);
      const mid = track(envelope(ctx, out, at, ev.gain * 0.3, 0.003, ev.dur * 0.6));
      osc(ctx, 'sine', ev.freq * 2.76, mid, at, end);
      const hi = track(envelope(ctx, out, at, ev.gain * 0.12, 0.002, ev.dur * 0.3));
      osc(ctx, 'sine', ev.freq * 5.4, hi, at, end);
      break;
    }
    case 'pad': {
      // two slightly detuned triangles under a low-pass, slow swell in and out
      const lp = track(ctx.createBiquadFilter());
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const g = track(ctx.createGain());
      g.gain.setValueAtTime(MIN, at);
      g.gain.linearRampToValueAtTime(ev.gain, at + ev.dur * 0.3);
      g.gain.linearRampToValueAtTime(MIN, at + ev.dur);
      lp.connect(g).connect(out);
      last = osc(ctx, 'triangle', ev.freq, lp, at, end);
      const second = osc(ctx, 'triangle', ev.freq * 1.004, lp, at, end);
      last.onended = () => second.disconnect();
      break;
    }
    case 'blip': {
      const body = track(envelope(ctx, out, at, ev.gain, 0.01, ev.dur));
      last = osc(ctx, 'sine', ev.freq, body, at, end, ev.endFreq);
      break;
    }
    case 'wood': {
      // short woody knock: a quickly falling sine plus a tiny band-passed click
      const body = track(envelope(ctx, out, at, ev.gain, 0.002, ev.dur));
      last = osc(ctx, 'sine', ev.freq, body, at, end, ev.freq * 0.7);
      const bp = track(ctx.createBiquadFilter());
      bp.type = 'bandpass';
      bp.frequency.value = ev.freq * 2.5;
      bp.Q.value = 2;
      const click = track(envelope(ctx, out, at, ev.gain * 0.35, 0.001, 0.025));
      bp.connect(click);
      noise(ctx, bp, at, at + 0.04).onended = () => bp.disconnect();
      break;
    }
    case 'thump': {
      const body = track(envelope(ctx, out, at, ev.gain, 0.004, ev.dur));
      last = osc(ctx, 'sine', ev.freq, body, at, end, ev.freq * 0.5);
      break;
    }
    case 'whoosh': {
      const bp = track(ctx.createBiquadFilter());
      bp.type = 'bandpass';
      bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(ev.freq, at);
      bp.frequency.exponentialRampToValueAtTime(Math.max(ev.endFreq ?? ev.freq, 1), at + ev.dur);
      const g = track(ctx.createGain());
      g.gain.setValueAtTime(MIN, at);
      g.gain.linearRampToValueAtTime(ev.gain, at + ev.dur * 0.4);
      g.gain.linearRampToValueAtTime(MIN, at + ev.dur);
      bp.connect(g).connect(out);
      last = noise(ctx, bp, at, end);
      break;
    }
    case 'shaker': {
      const hp = track(ctx.createBiquadFilter());
      hp.type = 'highpass';
      hp.frequency.value = ev.freq;
      const g = track(envelope(ctx, out, at, ev.gain, 0.006, ev.dur));
      hp.connect(g);
      last = noise(ctx, hp, at, end);
      break;
    }
  }
  if (last) {
    const prev = last.onended;
    last.onended = (e) => {
      prev?.call(last as AudioScheduledSourceNode, e);
      for (const n of owned) n.disconnect();
    };
  }
}
