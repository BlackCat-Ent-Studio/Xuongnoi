import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { motionOf } from '../../src/render/character-motion';
import { PartKit, styleFor } from '../../src/render/character-styles';
import { BLINK_DURATION, createBlinker } from '../../src/render/character-styles/blink';
import { createTalker } from '../../src/puzzle/ui/mascot-talk';

function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

/** Runs a blinker for `seconds` at 60 fps; returns the times each blink started. */
function blinkStarts(rand: () => number, seconds: number): number[] {
  const b = createBlinker(rand);
  const starts: number[] = [];
  let prev = 0;
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    const v = b.step(t, dt);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
    if (v > 0 && prev === 0) starts.push(t);
    prev = v;
  }
  return starts;
}

describe('blinker', () => {
  it('blinks every 2-5 s when it never doubles', () => {
    const starts = blinkStarts(seq([0.5, 0.9, 0.5]), 30);
    expect(starts.length).toBeGreaterThan(4);
    for (let i = 1; i < starts.length; i++) {
      const gap = starts[i]! - starts[i - 1]!;
      expect(gap).toBeGreaterThan(2);
      expect(gap).toBeLessThan(5.5);
    }
  });

  it('follows a blink with a quick second one when the dice say so', () => {
    const starts = blinkStarts(seq([0, 0.1, 0.9, 0.5]), 10);
    expect(starts[1]! - starts[0]!).toBeLessThan(BLINK_DURATION + 0.2);
  });

  it('closes fully mid-blink', () => {
    const b = createBlinker(() => 0);
    let peak = 0;
    for (let t = 0; t < 3; t += 1 / 120) peak = Math.max(peak, b.step(t, 1 / 120));
    expect(peak).toBeGreaterThan(0.95);
  });
});

describe('cat-chibi face', () => {
  it('exposes clamped face controls', () => {
    const kit = new PartKit('#ffffff');
    const rig = styleFor('cat-chibi').build(kit);
    const face = rig.face!;
    expect(face).toBeDefined();
    const eyeScaleY = (): number => {
      let y = 0;
      rig.root.traverse((o) => {
        if (o instanceof THREE.Mesh && o.parent && o.parent.parent?.parent && y === 0 && o.scale.y > 0.3 && o.scale.y < 0.4 && o.scale.x < 0.32 && o.scale.x > 0.3) y = o.parent.scale.y;
      });
      return y;
    };
    face.setMouthOpen(5);
    face.setBlink(-3);
    face.setHappy(9);
    face.setHeadPose(NaN, 0.1, 0);
    rig.update(motionOf(0, false, 0, 0.5), 0.016);
    expect(eyeScaleY()).toBeGreaterThan(0.9);
    face.setBlink(7);
    rig.update(motionOf(0, false, 0, 0.5), 0.016);
    expect(eyeScaleY()).toBeLessThan(0.2);
    face.setBlink(null);
    expect(face.portrait.height).toBeGreaterThan(0.3);
    expect(face.portrait.y).toBeGreaterThan(-0.5);
    kit.dispose();
  });

  it('shows the round mouth only when open', () => {
    const kit = new PartKit('#ffffff');
    const rig = styleFor('cat-chibi').build(kit);
    const dark = (): THREE.Mesh | undefined => {
      let found: THREE.Mesh | undefined;
      rig.root.traverse((o) => {
        if (o instanceof THREE.Mesh && (o.material as THREE.MeshToonMaterial).color?.getHexString() === '7a2a40') found = o;
      });
      return found;
    };
    const mouth = dark()!;
    expect(mouth.visible).toBe(false);
    rig.face!.setMouthOpen(0.8);
    rig.update(motionOf(0, false, 0, 0), 0.016);
    expect(mouth.visible).toBe(true);
    rig.face!.setMouthOpen(0);
    rig.update(motionOf(0, false, 0, 0), 0.016);
    expect(mouth.visible).toBe(false);
    kit.dispose();
  });

  it('other looks have no face controls', () => {
    const kit = new PartKit('#ffffff');
    expect(styleFor('robot').build(kit).face).toBeUndefined();
    kit.dispose();
  });
});

describe('mascot talker', () => {
  it('types at about 28 characters per second and flaps the mouth while typing', () => {
    const t = createTalker(seq([0.3, 0.6, 0.9]));
    t.start('a'.repeat(56), false);
    let maxMouth = 0;
    let time = 0;
    let p = t.step(time, 0);
    while (time < 1) {
      time += 1 / 60;
      p = t.step(time, 1 / 60);
      maxMouth = Math.max(maxMouth, p.mouth);
    }
    expect(p.shown).toBeGreaterThan(24);
    expect(p.shown).toBeLessThan(32);
    expect(maxMouth).toBeGreaterThan(0.3);
    t.finish();
    expect(t.step(time, 1 / 60).shown).toBe(56);
    for (let i = 0; i < 30; i++) p = t.step(time, 1 / 60);
    expect(p.mouth).toBeLessThan(0.05);
  });

  it('reduced motion shows everything at once without head motion', () => {
    const t = createTalker();
    t.start('xin chao', true);
    const p = t.step(5, 1 / 60);
    expect(p.shown).toBe(8);
    expect(p.typing).toBe(false);
    expect(p.headX).toBe(0);
    expect(p.headY).toBe(0);
    expect(p.headZ).toBe(0);
  });

  it('keeps the head still-ish when idle and nods while typing', () => {
    const t = createTalker();
    t.start('x'.repeat(200), false);
    let peak = 0;
    for (let i = 0; i < 120; i++) peak = Math.max(peak, Math.abs(t.step(i / 60, 1 / 60).headZ));
    expect(peak).toBeGreaterThan(0.02);
    expect(peak).toBeLessThan(0.25);
  });
});
