/**
 * Sound of the puzzle game: short effects and one soft background music loop, all made with WebAudio code
 * (no audio files). Screens only call these functions; they respect the player's settings themselves.
 *
 * Contract between the screen code and the sound code: the names below are the only events.
 * Browsers start audio only after a user gesture, so `unlockAudio()` is called from the first tap.
 * Before that, everything here is silent and never throws.
 */
import { getSettings, onSettingsChange } from './settings';
import { MusicEngine } from './sound/music-engine';
import { createRateLimiter, createStarCounter } from './sound/notes';
import { sfxEvents } from './sound/sfx-recipes';
import { createBuses, playVoice, type Buses } from './sound/synth';

export type SfxName =
  | 'tap' // any button
  | 'pick' // a tray piece placed on the board
  | 'wire' // a wire connected
  | 'unwire' // a wire or piece removed
  | 'run' // CHẠY pressed
  | 'stop' // DỪNG pressed
  | 'win' // level won
  | 'lose' // level lost
  | 'star' // one star appears on the win card
  | 'hint' // "?" pressed
  | 'unlock' // a new level opens on the map
  | 'page'; // screen transition

/** Which music plays: the calm menu loop (title, map) or the play loop (inside a level). */
export type MusicScene = 'menu' | 'level';

const MIN_GAP_MS = 40;

interface AudioState {
  ctx: AudioContext;
  buses: Buses;
  music: MusicEngine;
}

let audio: AudioState | null = null;
let wantedScene: MusicScene | null = null;
let hooksInstalled = false;
const allow = createRateLimiter(MIN_GAP_MS);
const stars = createStarCounter();

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Music follows the settings, the wanted scene and the tab visibility. */
function syncMusic(): void {
  if (!audio) return;
  try {
    if (wantedScene && getSettings().music) audio.music.start(wantedScene);
    else audio.music.stop(0.4);
  } catch {
    // audio trouble must never break the game
  }
}

function syncVisibility(): void {
  if (!audio) return;
  const ctx = audio.ctx;
  if (document.hidden) void ctx.suspend().catch(() => undefined);
  else void ctx.resume().catch(() => undefined);
}

/** Plays one effect if effects are on. Safe to call before audio is unlocked (it is then silent). */
export function playSfx(name: SfxName): void {
  try {
    if (!audio || !getSettings().sfx || audio.ctx.state !== 'running') return;
    const t = nowMs();
    if (!allow(name, t)) return;
    let starIndex = 0;
    if (name === 'star') starIndex = stars.next(t);
    else if (name === 'win') stars.reset();
    const at = audio.ctx.currentTime + 0.005;
    for (const e of sfxEvents(name, starIndex)) playVoice(audio.ctx, audio.buses.sfx, e, at + e.t);
  } catch {
    // audio trouble must never break the game
  }
}

/** Starts (or switches to) a music loop if music is on; keeps it across screens of the same scene. */
export function startMusic(scene: MusicScene): void {
  wantedScene = scene;
  syncMusic();
}

export function stopMusic(): void {
  wantedScene = null;
  syncMusic();
}

/** Call from the first user gesture (pointerdown/keydown) so the browser lets audio play. */
export function unlockAudio(): void {
  try {
    if (!audio) {
      const Ctor: typeof AudioContext | undefined =
        typeof AudioContext !== 'undefined' ? AudioContext : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const buses = createBuses(ctx, ctx.destination);
      audio = { ctx, buses, music: new MusicEngine(ctx, buses.music) };
      if (!hooksInstalled) {
        hooksInstalled = true;
        onSettingsChange(syncMusic);
        document.addEventListener('visibilitychange', syncVisibility);
      }
    }
    void audio.ctx.resume().catch(() => undefined);
    syncMusic();
  } catch {
    audio = null; // no audio available: stay silent
  }
}
