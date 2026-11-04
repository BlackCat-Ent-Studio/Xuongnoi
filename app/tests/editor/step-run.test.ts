import { describe, expect, it, vi } from 'vitest';
import type { StepBreak } from '../../src/app-contracts';
import type { Graph } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { createStepRun, type StepRunState } from '../../src/editor/step/step-run';
import type { StepLightSet } from '../../src/editor/step/step-light-layer';

registerAllNodes();

const graph: Graph = {
  nodes: [
    { id: 'ch', kind: 'character', params: {}, pos: { x: 0, y: 0 } },
    { id: 'key', kind: 'key', params: {}, pos: { x: 0, y: 0 } },
    { id: 'mv', kind: 'move', params: {}, pos: { x: 0, y: 0 } },
    { id: 'lonely', kind: 'key', params: {}, pos: { x: 0, y: 0 } },
  ],
  wires: [
    { id: 'w1', from: { node: 'key', port: 'pressed' }, to: { node: 'mv', port: 'go' } },
    { id: 'w2', from: { node: 'mv', port: 'action' }, to: { node: 'ch', port: 'actions' } },
  ],
} as unknown as Graph;

function setup(opts: { playing?: boolean } = {}) {
  let playing = opts.playing ?? true;
  let paused = false;
  let rule: StepBreak | null = null;
  const lights: Array<StepLightSet | null> = [];
  const highlights: Array<ReadonlySet<string>> = [];
  const states: StepRunState[] = [];
  const view = {
    isPlaying: () => playing,
    isPaused: () => paused,
    resume: vi.fn(() => {
      paused = false;
    }),
    setStepBreak: (r: StepBreak | null) => {
      rule = r;
    },
    setHighlight: (ids: ReadonlySet<string>) => {
      highlights.push(ids);
    },
  };
  const startPlay = vi.fn(() => {
    playing = true;
  });
  const run = createStepRun({
    isPlaying: () => playing,
    startPlay,
    getGraph: () => graph,
    restingHighlight: () => new Set(['sel']),
    view,
    board: { hasOutPin: (n, p) => p !== 'hidden' && n !== 'ghost', setStepLight: (l) => lights.push(l) },
    onChange: (s) => states.push(s),
  });
  const fire = (keys: string[]): void => {
    paused = true;
    rule!.onBreak(new Set(keys));
  };
  return { run, view, startPlay, lights, highlights, states, fire, rule: () => rule };
}

describe('editor step run', () => {
  it('breaks only on shown outputs that have a wire', () => {
    const t = setup();
    t.run.press();
    const rule = t.rule()!;
    expect(rule.accepts('key|pressed')).toBe(true);
    expect(rule.accepts('lonely|pressed')).toBe(false); // no wire
    expect(rule.accepts('key|hidden')).toBe(false); // pin not drawn
    expect(rule.accepts('ghost|pressed')).toBe(false);
  });

  it('starts a run from the edit mode and arms it', () => {
    const t = setup({ playing: false });
    t.run.press();
    expect(t.startPlay).toHaveBeenCalledTimes(1);
    expect(t.run.state()).toEqual({ stepping: true, waiting: false });
  });

  it('lights the fired pin, its wire and target, then drops the light on continue', () => {
    const t = setup();
    t.run.press();
    t.fire(['key|pressed']);
    const light = t.lights.at(-1)!;
    expect(light.pins).toEqual(new Set(['key|pressed']));
    expect(light.wires).toEqual(new Set(['w1']));
    expect(light.cards).toEqual(new Set(['key', 'mv']));
    expect(t.run.state()).toEqual({ stepping: true, waiting: true });
    t.run.press();
    expect(t.lights.at(-1)).toBeNull();
    expect(t.highlights.at(-1)).toEqual(new Set(['sel']));
    expect(t.view.resume).toHaveBeenCalledTimes(1);
    expect(t.run.state()).toEqual({ stepping: true, waiting: false });
  });

  it('lights the character wired into a fired card and glows it on the stage', () => {
    const t = setup();
    t.run.press();
    t.fire(['mv|action']);
    expect(t.lights.at(-1)!.cards).toEqual(new Set(['mv', 'ch']));
    expect(t.highlights.at(-1)).toEqual(new Set(['ch']));
  });

  it('pressing while running (not frozen) does nothing; a normal run is armed by the first press', () => {
    const t = setup();
    t.run.press();
    t.run.press();
    expect(t.view.resume).not.toHaveBeenCalled();
  });

  it('resuming from the pause button drops the light; reset leaves step mode', () => {
    const t = setup();
    t.run.press();
    t.fire(['key|pressed']);
    t.run.noteResume();
    expect(t.lights.at(-1)).toBeNull();
    expect(t.run.state().waiting).toBe(false);
    t.run.reset();
    expect(t.run.state()).toEqual({ stepping: false, waiting: false });
  });

  it('arming while paused resumes the game', () => {
    const t = setup();
    t.view.isPaused = () => true;
    t.run.press();
    expect(t.view.resume).toHaveBeenCalledTimes(1);
  });
});
