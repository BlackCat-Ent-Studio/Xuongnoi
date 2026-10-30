import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type GameResult, type InputSnapshot, type ParamValue, type PortRef } from '../../src/engine/types';
import { compileGraph } from '../../src/engine/compile';
import { getNodeDef } from '../../src/engine/registry';
import { registerAllNodes } from '../../src/nodes';
import { chapterOf, lessonName } from '../../src/tutorial/course';
import { findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import type { Snapshot } from '../../src/tutorial/types';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });

function session(lessonId: string) {
  const lesson = findLesson(lessonId)!;
  const state = createEditorState(lesson.createBoard());
  const runner = createRunner(lesson);
  let ended: GameResult | null = null;
  const tick = (): void => {
    const snap: Snapshot = { graph: state.getGraph(), mode: state.getMode(), playing: state.isPlaying(), ended };
    runner.evaluate(snap);
  };
  tick();
  const kindId = (kind: string, where: (params: Record<string, ParamValue>) => boolean = () => true): string => {
    const n = state.getGraph().nodes.find((x) => x.kind === kind && where(x.params));
    if (!n) throw new Error(`no ${kind}`);
    return n.id;
  };
  return {
    lesson,
    state,
    runner,
    stepId: () => runner.step().id,
    add(kind: string): string {
      const id = state.addNode(kind, { x: 0, y: 0 });
      if (!id) throw new Error(`cannot add ${kind}`);
      tick();
      return id;
    },
    param(id: string, name: string, v: ParamValue): void {
      state.setParam(id, name, v);
      tick();
    },
    wire(from: PortRef, to: PortRef): void {
      expect(state.connect(from, to)).toEqual({ ok: true });
      tick();
    },
    play(on: boolean): void {
      state.setPlaying(on);
      tick();
    },
    end(result: GameResult): void {
      ended = result;
      tick();
    },
    kindId,
    hero: () => kindId('character', (q) => q.role !== 'bot'),
    bot: () => kindId('character', (q) => q.role === 'bot'),
  };
}

type Session = ReturnType<typeof session>;

const nothing: InputSnapshot = { keysDown: new Set() };
const clickOn = (...ids: string[]): InputSnapshot => ({
  keysDown: new Set(),
  ui: { clicked: new Set(ids), held: new Set(), picked: new Set() },
});

/** Drives the finished board headless: `frames` ticks of `input(frame)`, stopping early when the game ends. */
function simulate(s: Session, frames: number, input: (frame: number) => InputSnapshot, watch?: () => void) {
  const world = createWorld('2d-side');
  const rt = createRuntime(s.state.getGraph(), world, '2d-side');
  for (let f = 0; f < frames && !world.ended; f++) {
    rt.tick(input(f));
    world.step(TICK_DT);
    watch?.();
  }
  return { world, rt };
}

function assertTargets(s: Session): void {
  const snap: Snapshot = { graph: s.state.getGraph(), mode: '2d-side', playing: false, ended: null };
  for (const step of s.lesson.steps) {
    for (const t of step.target?.(snap) ?? []) {
      for (const sel of typeof t === 'string' ? [t] : t) expect(sel.length).toBeGreaterThan(0);
    }
  }
}

/** Every lesson of the pack: registered in the numbers chapter, valid starter board, no check passes before its edit. */
describe.each([
  ['health-color', 'Thanh máu đổi màu'],
  ['start-screen', 'Màn hình bắt đầu'],
  ['ask-dialog', 'Hộp hỏi'],
])('pack C lesson %s', (id, name) => {
  it('is in the numbers chapter with a valid starter board and ends info-only', () => {
    const lesson = findLesson(id)!;
    expect(chapterOf(id)?.id).toBe('numbers-ui');
    expect(lessonName(lesson.title)).toBe(name);
    const board = lesson.createBoard();
    expect(board.mode).toBe('2d-side');
    expect(board.graph.nodes.every((n) => getNodeDef(n.kind) !== undefined)).toBe(true);
    expect(compileGraph(board.graph).order).toHaveLength(board.graph.nodes.length);
    expect(lesson.steps[lesson.steps.length - 1]!.check).toBeUndefined();
    expect(new Set(lesson.steps.map((x) => x.id)).size).toBe(lesson.steps.length);
  });

  it('starter board does not already satisfy any step check', () => {
    const lesson = findLesson(id)!;
    const board = lesson.createBoard();
    const snap: Snapshot = { graph: board.graph, mode: board.mode, playing: false, ended: null };
    for (const step of lesson.steps.slice(0, -1)) {
      if (step.check && step.id !== 'play' && step.id !== 'win' && step.id !== 'lost') {
        expect(step.check(snap), step.id).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------- health-color

function buildHealthColor(s: Session) {
  s.runner.next();
  const hp = s.add('health');
  expect(s.stepId()).toBe('max-hp');
  s.param(hp, 'maxHp', 3);
  expect(s.stepId()).toBe('wire-self');
  s.wire(p(s.hero(), 'self'), p(hp, 'self'));
  expect(s.stepId()).toBe('add-meter');
  const meter = s.add('ui-meter');
  expect(s.stepId()).toBe('add-map');
  const map = s.add('map-range');
  expect(s.stepId()).toBe('map-scale');
  s.param(map, 'inMax', 3);
  expect(s.stepId()).toBe('wire-hp-map');
  s.wire(p(hp, 'hp'), p(map, 'value'));
  expect(s.stepId()).toBe('wire-map-meter');
  s.wire(p(map, 'value'), p(meter, 'value'));
  expect(s.stepId()).toBe('add-select');
  const sel = s.add('select-number');
  expect(s.stepId()).toBe('wire-hp-select');
  s.wire(p(hp, 'hp'), p(sel, 'value'));
  expect(s.stepId()).toBe('add-text');
  const text = s.add('show-text');
  expect(s.stepId()).toBe('text-words');
  s.param(text, 'text', 'Sắp gục rồi!');
  expect(s.stepId()).toBe('wire-warn');
  s.wire(p(sel, 'is1'), p(text, 'show'));
  expect(s.stepId()).toBe('wire-dead');
  s.wire(p(hp, 'dead'), p(s.kindId('win-lose'), 'lose'));
  expect(s.stepId()).toBe('play');
  return { hp, meter, text };
}

describe('health-color', () => {
  it('does not accept a wrong value or a wire from the wrong character', () => {
    const s = session('health-color');
    s.runner.next();
    const hp = s.add('health');
    expect(s.stepId()).toBe('max-hp');
    s.param(hp, 'maxHp', 4);
    expect(s.stepId()).toBe('max-hp');
    s.param(hp, 'maxHp', 3);
    s.wire(p(s.bot(), 'self'), p(hp, 'self'));
    expect(s.stepId()).toBe('wire-self');
  });

  it('completes in order and ends when the player is out of health', () => {
    const s = session('health-color');
    buildHealthColor(s);
    s.play(true);
    expect(s.stepId()).toBe('lost');
    s.end('win');
    expect(s.stepId()).toBe('lost');
    s.end('lose');
    expect(s.stepId()).toBe('done');
    expect(s.runner.isLast()).toBe(true);
    assertTargets(s);
  });

  it('plays: the bar drops from full, the warning appears at one health, then the player loses', () => {
    const s = session('health-color');
    const { text } = buildHealthColor(s);
    const world = createWorld('2d-side');
    const rt = createRuntime(s.state.getGraph(), world, '2d-side');
    const textEntry = (): { hidden?: boolean } => world.hudItems().find((h) => h.key === text) ?? {};
    const bars: number[] = [];
    const warned: boolean[] = [];
    for (let f = 0; f < 60 * 14 && !world.ended; f++) {
      rt.tick(nothing);
      world.step(TICK_DT);
      const bar = world.hudItems().find((h) => h.widget?.type === 'bar');
      if (bar?.widget?.type === 'bar') bars.push(Math.round(bar.widget.fraction * 100));
      warned.push(textEntry().hidden !== true);
    }
    expect(bars[0]).toBe(100);
    expect(bars).toContain(67);
    expect(bars).toContain(33);
    expect(warned[0]).toBe(false);
    expect(warned.some(Boolean)).toBe(true);
    expect(world.ended?.result).toBe('lose');
  });
});

// ---------------------------------------------------------------- start-screen

function buildStartScreen(s: Session) {
  s.runner.next();
  const start = s.add('ui-start');
  expect(s.stepId()).toBe('start-title');
  s.param(start, 'title', 'Đi tìm ngôi sao');
  expect(s.stepId()).toBe('add-button');
  const button = s.add('ui-button');
  expect(s.stepId()).toBe('button-text');
  s.param(button, 'text', 'Mở cửa');
  expect(s.stepId()).toBe('wire-door');
  const door = s.kindId('block', (q) => (q.size as { y: number }).y >= 3);
  s.wire(p(button, 'pressed'), p(door, 'hide'));
  expect(s.stepId()).toBe('add-timer');
  const timer = s.add('timer');
  expect(s.stepId()).toBe('add-timer');
  s.param(timer, 'seconds', 20);
  expect(s.stepId()).toBe('wire-run');
  s.wire(p(start, 'started'), p(timer, 'run'));
  expect(s.stepId()).toBe('wire-lose');
  s.wire(p(timer, 'done'), p(s.kindId('win-lose'), 'lose'));
  expect(s.stepId()).toBe('play');
  return { start, button, door, timer };
}

const walkRight: InputSnapshot = { keysDown: new Set(['ArrowRight']) };

describe('start-screen', () => {
  it('completes in order and ends info-only', () => {
    const s = session('start-screen');
    buildStartScreen(s);
    s.play(true);
    expect(s.stepId()).toBe('win');
    s.end('win');
    expect(s.stepId()).toBe('done');
    expect(s.runner.isLast()).toBe(true);
    assertTargets(s);
  });

  it('plays: the clock waits for the start button, the door opens with the screen button, then the star wins', () => {
    const s = session('start-screen');
    const { start, button } = buildStartScreen(s);
    const world = createWorld('2d-side');
    const rt = createRuntime(s.state.getGraph(), world, '2d-side');
    const heroX = (): number => world.entities().find((e) => e.ownerNodeId === s.hero())!.position.x;
    const wait = (n: number, input: InputSnapshot): void => {
      for (let i = 0; i < n && !world.ended; i++) {
        rt.tick(input);
        world.step(TICK_DT);
      }
    };
    // Before the start button: the countdown has not moved and the start screen shows.
    wait(120, nothing);
    expect(world.hudItems().find((h) => h.key === start)?.hidden).toBe(false);
    rt.tick(clickOn(start));
    world.step(TICK_DT);
    expect(world.hudItems().find((h) => h.key === start)?.hidden).toBe(true);
    // The door stops the hero until the on-screen button is pressed.
    wait(120, walkRight);
    expect(heroX()).toBeLessThan(0);
    expect(world.ended).toBeNull();
    rt.tick(clickOn(button));
    world.step(TICK_DT);
    wait(60 * 6, walkRight);
    expect(world.ended?.result).toBe('win');
  });

  it('plays: if the player never opens the door the countdown loses', () => {
    const s = session('start-screen');
    const { start } = buildStartScreen(s);
    const { world } = simulate(s, 60 * 22, (f) => (f === 0 ? clickOn(start) : nothing));
    expect(world.ended?.result).toBe('lose');
  });

  it('plays: without pressing start the countdown never runs out', () => {
    const s = session('start-screen');
    buildStartScreen(s);
    const { world } = simulate(s, 60 * 25, () => nothing);
    expect(world.ended).toBeNull();
  });
});

// ---------------------------------------------------------------- ask-dialog

function buildAskDialog(s: Session) {
  s.runner.next();
  const touch = s.add('touch');
  expect(s.stepId()).toBe('wire-hero');
  s.wire(p(s.hero(), 'self'), p(touch, 'a'));
  expect(s.stepId()).toBe('wire-bot');
  s.wire(p(s.bot(), 'self'), p(touch, 'b'));
  expect(s.stepId()).toBe('add-dialog');
  const dialog = s.add('ui-dialog');
  expect(s.stepId()).toBe('wire-ask');
  s.wire(p(touch, 'began'), p(dialog, 'ask'));
  expect(s.stepId()).toBe('question');
  s.param(dialog, 'question', 'Cổng này đang đóng. Bạn làm gì?');
  s.param(dialog, 'answer1', 'Xin mở cổng');
  s.param(dialog, 'answer2', 'Ăn bánh ngủ');
  expect(s.stepId()).toBe('wire-open');
  const gate = s.kindId('block', (q) => (q.size as { y: number }).y >= 3);
  s.wire(p(dialog, 'a1'), p(gate, 'hide'));
  expect(s.stepId()).toBe('wire-trap');
  s.wire(p(dialog, 'a2'), p(s.kindId('win-lose'), 'lose'));
  expect(s.stepId()).toBe('play');
  return { touch, dialog, gate };
}

describe('ask-dialog', () => {
  it('completes in order and ends info-only', () => {
    const s = session('ask-dialog');
    buildAskDialog(s);
    s.play(true);
    expect(s.stepId()).toBe('win');
    s.end('win');
    expect(s.stepId()).toBe('done');
    expect(s.runner.isLast()).toBe(true);
    assertTargets(s);
  });

  it('does not take the board\'s own goal sensor for the new one', () => {
    const s = session('ask-dialog');
    s.runner.next();
    expect(s.stepId()).toBe('add-touch');
    const touch = s.add('touch');
    expect(s.stepId()).toBe('wire-hero');
    s.wire(p(s.bot(), 'self'), p(touch, 'a'));
    expect(s.stepId()).toBe('wire-hero');
  });

  it('plays: touching the bot asks, answer 1 opens the gate and the star wins', () => {
    const s = session('ask-dialog');
    const { dialog } = buildAskDialog(s);
    const world = createWorld('2d-side');
    const rt = createRuntime(s.state.getGraph(), world, '2d-side');
    const dialogHud = (): { hidden?: boolean } | undefined => world.hudItems().find((h) => h.key === dialog);
    const heroX = (): number => world.entities().find((e) => e.ownerNodeId === s.hero())!.position.x;
    let asked = false;
    for (let f = 0; f < 60 * 4 && !asked; f++) {
      rt.tick(walkRight);
      world.step(TICK_DT);
      asked = dialogHud()?.hidden === false;
    }
    expect(asked).toBe(true);
    expect(world.ended).toBeNull();
    rt.tick(clickOn(`${dialog}#0`));
    world.step(TICK_DT);
    expect(dialogHud()?.hidden).toBe(true);
    for (let f = 0; f < 60 * 8 && !world.ended; f++) {
      rt.tick(walkRight);
      world.step(TICK_DT);
    }
    expect(world.ended?.result).toBe('win');
    expect(heroX()).toBeGreaterThan(5);
  });

  it('plays: answer 2 loses', () => {
    const s = session('ask-dialog');
    const { dialog } = buildAskDialog(s);
    const world = createWorld('2d-side');
    const rt = createRuntime(s.state.getGraph(), world, '2d-side');
    for (let f = 0; f < 60 * 4; f++) {
      rt.tick(walkRight);
      world.step(TICK_DT);
      if (world.hudItems().find((h) => h.key === dialog)?.hidden === false) break;
    }
    rt.tick(clickOn(`${dialog}#1`));
    world.step(TICK_DT);
    expect(world.ended?.result).toBe('lose');
  });
});
