import { describe, expect, it } from 'vitest';
import { BARS_PER_LOOP, buildLoop, MusicCursor, SCENE_STYLE } from '../../src/puzzle/ui/sound/music';
import { PENTATONIC } from '../../src/puzzle/ui/sound/notes';
import { sfxDuration, sfxEvents } from '../../src/puzzle/ui/sound/sfx-recipes';
import type { MusicScene, SfxName } from '../../src/puzzle/ui/sound';

const ALL: SfxName[] = ['tap', 'pick', 'wire', 'unwire', 'run', 'stop', 'win', 'lose', 'star', 'hint', 'unlock', 'page'];

describe('sfx recipes', () => {
  it.each(ALL)('%s has soft, finite, ordered notes', (name) => {
    const ev = sfxEvents(name);
    expect(ev.length).toBeGreaterThan(0);
    for (const e of ev) {
      expect(e.t).toBeGreaterThanOrEqual(0);
      expect(e.dur).toBeGreaterThan(0);
      expect(e.gain).toBeGreaterThan(0);
      expect(e.gain).toBeLessThanOrEqual(0.5);
      expect(e.freq).toBeGreaterThan(50);
      expect(e.freq).toBeLessThan(6000);
    }
    expect(sfxDuration(ev)).toBeLessThan(2);
  });

  it('win is a short jingle of about 1.5 s', () => {
    const d = sfxDuration(sfxEvents('win'));
    expect(d).toBeGreaterThan(1.2);
    expect(d).toBeLessThan(1.8);
  });

  it('star pitch rises with the star index', () => {
    const f = (i: number) => sfxEvents('star', i)[0]!.freq;
    expect(f(1)).toBeGreaterThan(f(0));
    expect(f(2)).toBeGreaterThan(f(1));
  });

  it('wire rises and unwire falls', () => {
    const w = sfxEvents('wire')[0]!;
    const u = sfxEvents('unwire')[0]!;
    expect(w.endFreq!).toBeGreaterThan(w.freq);
    expect(u.endFreq!).toBeLessThan(u.freq);
  });
});

describe('music loops', () => {
  const scenes: MusicScene[] = ['menu', 'level'];

  it.each(scenes)('%s loop is 8 bars at 80-95 BPM, sorted, and stays on the scale', (scene) => {
    const { events, length } = buildLoop(scene, 0);
    const bpm = SCENE_STYLE[scene].bpm;
    expect(bpm).toBeGreaterThanOrEqual(80);
    expect(bpm).toBeLessThanOrEqual(95);
    expect(length).toBeCloseTo(BARS_PER_LOOP * 4 * (60 / bpm), 6);
    for (let i = 1; i < events.length; i++) expect(events[i]!.t).toBeGreaterThanOrEqual(events[i - 1]!.t);
    for (const e of events) {
      expect(e.t).toBeLessThan(length);
      if (e.voice !== 'pluck') continue;
      const midi = Math.round(69 + 12 * Math.log2(e.freq / 440));
      expect(PENTATONIC as readonly number[]).toContain(((midi % 12) + 12) % 12);
    }
  });

  it('is repeatable but varies between loops', () => {
    const a = JSON.stringify(buildLoop('menu', 0).events);
    expect(JSON.stringify(buildLoop('menu', 0).events)).toBe(a);
    expect(JSON.stringify(buildLoop('menu', 1).events)).not.toBe(a);
    expect(JSON.stringify(buildLoop('menu', 4).events)).toBe(a);
  });

  it('level is calmer than menu (fewer melody notes)', () => {
    const count = (s: MusicScene) => buildLoop(s, 0).events.filter((e) => e.voice === 'pluck').length;
    expect(count('level')).toBeLessThan(count('menu'));
  });

  it('cursor hands out every event once, in time order, across loops', () => {
    const cur = new MusicCursor('level');
    const first = buildLoop('level', 0);
    const got = [...cur.take(1), ...cur.take(5), ...cur.take(first.length + 3)];
    for (let i = 1; i < got.length; i++) expect(got[i]!.time).toBeGreaterThanOrEqual(got[i - 1]!.time);
    expect(got.filter((g) => g.time < first.length)).toHaveLength(first.events.length);
    expect(got.some((g) => g.time >= first.length)).toBe(true);
    expect(cur.take(5)).toEqual([]);
  });
});
