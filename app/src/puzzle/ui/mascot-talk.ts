/**
 * Pure talking logic for the mascot (no DOM, no three.js): how many characters are typed, the mouth
 * flapping in syllables, and the soft head nod / ear flick while speaking. Time is passed in, randomness
 * is injectable, so it is testable.
 */
export const TYPE_CPS = 28;
const PAUSE = /[,.;:!?…→]/;

export interface TalkPose {
  /** Characters of the line shown so far. */
  shown: number;
  typing: boolean;
  /** Mouth openness 0..1 (smoothed). */
  mouth: number;
  headX: number;
  headY: number;
  headZ: number;
  /** Which ear flicks (-1 / 1) and how far through the flick, 0..1. */
  earSide: -1 | 1;
  ear: number;
}

export interface Talker {
  /** Start a new line (`reduced` = show it all at once, no motion). Returns its characters. */
  start(text: string, reduced: boolean): readonly string[];
  /** Finish the line immediately. */
  finish(): void;
  /** Advance by `dt` seconds at clock `time`; returns a pose object that is reused between calls. */
  step(time: number, dt: number): TalkPose;
}

export function createTalker(rand: () => number = Math.random, reducedMotion = false): Talker {
  const range = (a: number, b: number): number => a + rand() * (b - a);
  const ease = (dt: number, rate: number): number => 1 - Math.exp(-dt * rate);

  let chars: string[] = [];
  let acc = 0;
  let reduced = reducedMotion;
  let sylT = 0;
  let mouthTarget = 0;
  let talkK = 0;
  let wob = 1;
  let wobTarget = 1;
  let nextWob = 0;
  let nextTwitch = 2;
  let twitch = 0;
  let twitchSide: -1 | 1 = 1;
  const pose: TalkPose = { shown: 0, typing: false, mouth: 0, headX: 0, headY: 0, headZ: 0, earSide: 1, ear: 0 };

  return {
    start(text, reducedNow) {
      reduced = reducedNow;
      chars = Array.from(text);
      acc = 0;
      sylT = 0;
      mouthTarget = 0;
      pose.shown = reduced ? chars.length : 0;
      pose.typing = !reduced && chars.length > 0;
      return chars;
    },
    finish() {
      pose.shown = chars.length;
      pose.typing = false;
      mouthTarget = 0;
    },
    step(time, dt) {
      if (pose.typing) {
        acc += dt * TYPE_CPS;
        const n = Math.floor(acc);
        if (n > 0) {
          acc -= n;
          pose.shown = Math.min(chars.length, pose.shown + n);
          if (pose.shown >= chars.length) pose.typing = false;
        }
        // Syllable clock: a short open (vowel), a shorter close, a longer rest on punctuation.
        sylT -= dt;
        if (sylT <= 0) {
          if (mouthTarget > 0) {
            mouthTarget = 0;
            sylT = range(0.04, 0.07);
          } else if (PAUSE.test(chars[Math.max(0, pose.shown - 1)] ?? '')) {
            sylT = range(0.18, 0.26);
          } else {
            mouthTarget = range(0.55, 1);
            sylT = range(0.08, 0.12);
          }
        }
      } else {
        mouthTarget = 0;
      }
      pose.mouth += (mouthTarget - pose.mouth) * ease(dt, 30);
      talkK += ((pose.typing && !reduced ? 1 : 0) - talkK) * ease(dt, 6);

      if (reduced) {
        pose.headX = pose.headY = pose.headZ = 0;
        pose.ear = 0;
        return pose;
      }
      if (time > nextWob) {
        wobTarget = range(0.6, 1.4);
        nextWob = time + range(0.8, 1.8);
      }
      wob += (wobTarget - wob) * ease(dt, 1.5);
      pose.headZ = Math.sin(time * 0.9) * 0.015 + talkK * wob * (Math.sin(time * 2.6) * 0.045 + Math.sin(time * 4.1 + 1) * 0.025);
      pose.headX = talkK * (-0.03 + pose.mouth * 0.05 * wob + Math.sin(time * 5.3) * 0.015 + Math.sin(time * 2.2) * 0.012);
      pose.headY = talkK * wob * (Math.sin(time * 1.9) * 0.07 + Math.sin(time * 3.3 + 2) * 0.03);

      if (time > nextTwitch) {
        twitch = 1;
        twitchSide = rand() < 0.5 ? -1 : 1;
        nextTwitch = time + (pose.typing ? range(0.5, 1.3) : range(3, 6));
      }
      twitch = Math.max(0, twitch - dt * 5);
      pose.earSide = twitchSide;
      pose.ear = twitch;
      return pose;
    },
  };
}
