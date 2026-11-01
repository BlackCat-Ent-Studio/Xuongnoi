/** Renders effects and music into a buffer without speakers: used by the sound check page to measure levels. */
import type { MusicScene, SfxName } from '../sound';
import { MusicCursor } from './music';
import { sfxDuration, sfxEvents } from './sfx-recipes';
import { createBuses, playVoice } from './synth';

export interface RenderStats {
  /** Highest absolute sample, 0..1. */
  peak: number;
  rms: number;
  /** Seconds of the rendered buffer where the signal is above -60 dB (rough audible length). */
  audibleSec: number;
  /** Length of the sound in seconds as written in the recipe. */
  recipeSec: number;
}

const SAMPLE_RATE = 44100;

function measure(buf: AudioBuffer, recipeSec: number): RenderStats {
  const data = buf.getChannelData(0);
  let peak = 0;
  let sum = 0;
  let lastLoud = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs(data[i] ?? 0);
    if (v > peak) peak = v;
    sum += v * v;
    if (v > 0.001) lastLoud = i;
  }
  return { peak, rms: Math.sqrt(sum / data.length), audibleSec: lastLoud / buf.sampleRate, recipeSec };
}

export async function renderSfx(name: SfxName, starIndex = 0): Promise<RenderStats> {
  const events = sfxEvents(name, starIndex);
  const dur = sfxDuration(events);
  const ctx = new OfflineAudioContext(1, Math.ceil((dur + 0.5) * SAMPLE_RATE), SAMPLE_RATE);
  const buses = createBuses(ctx, ctx.destination);
  for (const e of events) playVoice(ctx, buses.sfx, e, 0.01 + e.t);
  return measure(await ctx.startRendering(), dur);
}

export async function renderMusic(scene: MusicScene, seconds: number): Promise<RenderStats> {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  const buses = createBuses(ctx, ctx.destination);
  const fade = ctx.createGain();
  fade.connect(buses.music);
  for (const { time, event } of new MusicCursor(scene).take(seconds)) playVoice(ctx, fade, event, time);
  return measure(await ctx.startRendering(), seconds);
}
