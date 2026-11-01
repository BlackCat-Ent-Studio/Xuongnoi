/** Real-time music player: look-ahead scheduler on top of the pure MusicCursor, with crossfades between scenes. */
import type { MusicScene } from '../sound';
import { MusicCursor } from './music';
import { playVoice } from './synth';

const TICK_MS = 120;
const LOOKAHEAD_SEC = 0.6;
const FADE_IN_SEC = 1.4;
const CROSSFADE_SEC = 1.4;

interface Run {
  scene: MusicScene;
  gain: GainNode;
  cursor: MusicCursor;
  startTime: number;
  timer: ReturnType<typeof setTimeout> | null;
}

export class MusicEngine {
  private run: Run | null = null;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly bus: AudioNode,
  ) {}

  get scene(): MusicScene | null {
    return this.run?.scene ?? null;
  }

  /** Starts a scene (fading in); fades the previous one out. Nothing happens if this scene already plays. */
  start(scene: MusicScene): void {
    if (this.run?.scene === scene) return;
    const fadeOut = this.run !== null;
    this.stop(CROSSFADE_SEC);
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(1, now + (fadeOut ? CROSSFADE_SEC : FADE_IN_SEC));
    gain.connect(this.bus);
    const run: Run = { scene, gain, cursor: new MusicCursor(scene), startTime: now + 0.05, timer: null };
    this.run = run;
    this.tick(run);
  }

  /** Stops scheduling at once and fades what already sounds out over `fadeSec`. */
  stop(fadeSec = 0.4): void {
    const run = this.run;
    if (!run) return;
    this.run = null;
    if (run.timer !== null) clearTimeout(run.timer);
    run.timer = null;
    const now = this.ctx.currentTime;
    run.gain.gain.cancelScheduledValues(now);
    run.gain.gain.setValueAtTime(Math.max(run.gain.gain.value, 0.0001), now);
    run.gain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
    // notes scheduled a little ahead are silent by then; free the nodes shortly after
    setTimeout(() => run.gain.disconnect(), (fadeSec + LOOKAHEAD_SEC + 0.3) * 1000);
  }

  private tick(run: Run): void {
    if (this.run !== run) return;
    try {
      const until = this.ctx.currentTime + LOOKAHEAD_SEC - run.startTime;
      for (const { time, event } of run.cursor.take(until)) {
        playVoice(this.ctx, run.gain, event, run.startTime + time);
      }
    } catch {
      // a failed note must never stop the music loop
    }
    run.timer = setTimeout(() => this.tick(run), TICK_MS);
  }
}
