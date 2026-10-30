import { chapterOf } from '../../src/tutorial/course';
import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState, type EditorState } from '../../src/editor/editor-state';
import { getNodeDef } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type GameResult, type PortRef } from '../../src/engine/types';
import { createWorld } from '../../src/world/world';
import { registerAllNodes } from '../../src/nodes';
import { hasWire } from '../../src/tutorial/graph-checks';
import { LESSONS, findLesson } from '../../src/tutorial/lessons';
import { createRunner, type Runner } from '../../src/tutorial/runner';
import type { Snapshot } from '../../src/tutorial/types';

beforeAll(() => registerAllNodes());

/** Drives a lesson with real editor-state operations, like the learner would. */
function session(lessonId: string) {
  const lesson = findLesson(lessonId);
  if (!lesson) throw new Error(`no lesson ${lessonId}`);
  const state = createEditorState(lesson.createBoard());
  const runner: Runner = createRunner(lesson);
  let ended: GameResult | null = null;
  const snap = (): Snapshot => ({
    graph: state.getGraph(),
    mode: state.getMode(),
    playing: state.isPlaying(),
    ended,
  });
  const tick = (): void => {
    runner.evaluate(snap());
  };
  tick();
  return {
    state,
    runner,
    stepId: () => runner.step().id,
    add(kind: string): string {
      const id = state.addNode(kind, { x: 0, y: 0 });
      if (!id) throw new Error(`cannot add ${kind}`);
      tick();
      return id;
    },
    param(id: string, p: string, v: Parameters<EditorState['setParam']>[2]): void {
      state.setParam(id, p, v);
      tick();
    },
    wire(from: PortRef, to: PortRef): void {
      const res = state.connect(from, to);
      expect(res).toEqual({ ok: true });
      tick();
    },
    play(on: boolean): void {
      state.setPlaying(on);
      if (on) ended = null;
      tick();
    },
    end(result: GameResult): void {
      ended = result;
      tick();
    },
    idOf(kind: string): string {
      const n = state.getGraph().nodes.find((x) => x.kind === kind);
      if (!n) throw new Error(`no ${kind}`);
      return n.id;
    },
  };
}

const p = (node: string, port: string): PortRef => ({ node, port });

describe('lesson boards', () => {
  it('build without errors and only use known nodes and ports', () => {
    for (const lesson of LESSONS) {
      const board = lesson.createBoard();
      expect(['2d-side', '2d-top']).toContain(board.mode);
      for (const n of board.graph.nodes) expect(getNodeDef(n.kind)).toBeDefined();
      for (const w of board.graph.wires) {
        const from = board.graph.nodes.find((n) => n.id === w.from.node);
        const to = board.graph.nodes.find((n) => n.id === w.to.node);
        expect(getNodeDef(from?.kind ?? '')?.outputs.some((o) => o.id === w.from.port)).toBe(true);
        expect(getNodeDef(to?.kind ?? '')?.inputs.some((i) => i.id === w.to.port)).toBe(true);
      }
    }
  });

  it('gives a fresh independent board each time', () => {
    const lesson = LESSONS[1]!;
    const a = lesson.createBoard();
    a.graph.nodes.pop();
    expect(lesson.createBoard().graph.nodes.length).toBeGreaterThan(a.graph.nodes.length);
  });

  it('does not start with any step already finished', () => {
    for (const lesson of LESSONS) {
      const s = session(lesson.id);
      expect(s.runner.index()).toBe(0);
    }
  });

  it('has unique step ids and Vietnamese text on every step', () => {
    for (const lesson of LESSONS) {
      const ids = lesson.steps.map((st) => st.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const st of lesson.steps) {
        expect(st.title.length).toBeGreaterThan(0);
        expect(st.text.length).toBeGreaterThan(0);
      }
      expect(lesson.steps[lesson.steps.length - 1]?.check).toBeUndefined();
    }
  });
});

describe('lesson 1: walk and jump', () => {
  it('advances step by step as the learner builds', () => {
    const s = session('walk-jump');
    expect(s.stepId()).toBe('intro');
    s.runner.next();
    expect(s.stepId()).toBe('add-floor');
    const floor = s.add('block');
    expect(s.stepId()).toBe('floor-size');
    s.param(floor, 'size', { x: 3, y: 1, z: 1 });
    expect(s.stepId()).toBe('floor-size'); // too short to be a floor
    s.param(floor, 'size', { x: 20, y: 1, z: 1 });
    expect(s.stepId()).toBe('add-hero');
    const hero = s.add('character');
    expect(s.stepId()).toBe('first-play');
    s.play(true);
    expect(s.stepId()).toBe('back-to-edit');
    s.play(false);
    expect(s.stepId()).toBe('add-stick');
    const stick = s.add('stick');
    expect(s.stepId()).toBe('wire-stick');
    s.wire(p(stick, 'x'), p(hero, 'moveX'));
    expect(s.stepId()).toBe('add-key');
    const key = s.add('key');
    expect(s.stepId()).toBe('wire-key');
    s.wire(p(key, 'held'), p(hero, 'jump'));
    expect(s.stepId()).toBe('play-move');
    s.play(true);
    expect(s.stepId()).toBe('done');
    s.runner.next();
    expect(s.runner.isFinished()).toBe(true);
  });

  it('skips ahead over steps that are already satisfied', () => {
    const s = session('walk-jump');
    s.runner.next();
    const floor = s.add('block');
    s.add('character');
    s.param(floor, 'size', { x: 12, y: 1, z: 1 });
    expect(s.stepId()).toBe('first-play');
  });

  it('accepts the stick wired in either order of creation', () => {
    const s = session('walk-jump');
    s.runner.next();
    const hero = s.add('character');
    const stick = s.add('stick');
    s.wire(p(stick, 'x'), p(hero, 'moveX'));
    expect(hasWire(s.state.getGraph(), { kind: 'stick', port: 'x' }, { kind: 'character', port: 'moveX' })).toBe(true);
  });
});

describe('lesson 2: collect stars', () => {
  it('starts with a character that already moves, and teaches the star chain', () => {
    const s = session('collect-stars');
    expect(s.stepId()).toBe('intro');
    s.runner.next();
    expect(s.stepId()).toBe('add-star');
    const hero = s.idOf('character');
    const star = s.add('block');
    expect(s.stepId()).toBe('star-type');
    s.param(star, 'type', 'pickup');
    expect(s.stepId()).toBe('star-place');
    s.param(star, 'position', { x: 4, y: 1, z: 0 });
    expect(s.stepId()).toBe('add-touch');
    const touch = s.add('touch');
    s.wire(p(hero, 'self'), p(touch, 'a'));
    expect(s.stepId()).toBe('wire-touch-b');
    s.wire(p(star, 'self'), p(touch, 'b'));
    expect(s.stepId()).toBe('wire-hide');
    s.wire(p(touch, 'touching'), p(star, 'hide'));
    expect(s.stepId()).toBe('add-counter');
    const counter = s.add('counter');
    s.wire(p(touch, 'began'), p(counter, 'up'));
    expect(s.stepId()).toBe('add-show');
    const show = s.add('show-number');
    s.wire(p(counter, 'value'), p(show, 'value'));
    expect(s.stepId()).toBe('play-collect');
    s.play(true);
    expect(s.stepId()).toBe('done');
  });
});

describe('lesson 3: win and lose', () => {
  it('walks through win condition, lose condition and the win result', () => {
    const s = session('win-lose');
    s.runner.next();
    expect(s.stepId()).toBe('goal');
    const counter = s.idOf('counter');
    s.param(counter, 'target', 1);
    expect(s.stepId()).toBe('add-end');
    const end = s.add('win-lose');
    s.wire(p(counter, 'reached'), p(end, 'win'));
    expect(s.stepId()).toBe('add-compare');
    const cmp = s.add('compare');
    const hero = s.idOf('character');
    s.wire(p(hero, 'y'), p(cmp, 'a'));
    expect(s.stepId()).toBe('compare-op');
    s.param(cmp, 'op', 'lt');
    expect(s.stepId()).toBe('add-const');
    const c = s.add('const');
    expect(s.stepId()).toBe('const-value');
    s.param(c, 'value', -5);
    expect(s.stepId()).toBe('wire-limit');
    s.wire(p(c, 'value'), p(cmp, 'b'));
    expect(s.stepId()).toBe('wire-lose');
    s.wire(p(cmp, 'out'), p(end, 'lose'));
    expect(s.stepId()).toBe('play-win');
    s.play(true);
    expect(s.stepId()).toBe('win');
    s.end('lose');
    expect(s.stepId()).toBe('win');
    s.play(false);
    s.play(true);
    s.end('win');
    expect(s.stepId()).toBe('done');
  });

  it('rejects a counter goal that more stars than exist could never reach', () => {
    const s = session('win-lose');
    s.runner.next();
    expect(s.stepId()).toBe('goal');
    s.param(s.idOf('counter'), 'target', 5);
    expect(s.stepId()).toBe('goal');
  });
});

describe('lesson 4: carry and use', () => {
  it('walks through the key, carry, interact and door wiring, and the result is winnable', () => {
    const s = session('carry-use');
    s.runner.next();
    expect(s.stepId()).toBe('add-item');
    const lock = s.idOf('item');
    const key = s.add('item');
    expect(s.stepId()).toBe('item-shape');
    s.param(key, 'shape', 'key');
    expect(s.stepId()).toBe('add-carry');
    const carry = s.add('carry');
    const hero = s.idOf('character');
    expect(s.stepId()).toBe('wire-carry');
    s.wire(p(hero, 'self'), p(carry, 'character'));
    expect(s.stepId()).toBe('add-key-e');
    const keyE = s.add('key');
    expect(s.stepId()).toBe('key-e-code');
    s.param(keyE, 'key', 'KeyE');
    expect(s.stepId()).toBe('wire-grab');
    s.wire(p(keyE, 'pressed'), p(carry, 'grab'));
    expect(s.stepId()).toBe('play-carry');
    s.play(true);
    expect(s.stepId()).toBe('back-to-edit');
    s.play(false);
    expect(s.stepId()).toBe('add-interact');
    const interact = s.add('interact');
    s.wire(p(hero, 'self'), p(interact, 'character'));
    expect(s.stepId()).toBe('add-key-f');
    const keyF = s.add('key');
    expect(s.stepId()).toBe('key-f-code');
    s.param(keyF, 'key', 'KeyF');
    expect(s.stepId()).toBe('wire-press');
    s.wire(p(keyF, 'pressed'), p(interact, 'press'));
    expect(s.stepId()).toBe('add-and');
    const and = s.add('and');
    expect(s.stepId()).toBe('wire-lock');
    s.wire(p(lock, 'interacted'), p(and, 'a'));
    expect(s.stepId()).toBe('wire-holding');
    s.wire(p(carry, 'holding'), p(and, 'b'));
    expect(s.stepId()).toBe('wire-open');
    const door = s.state.getGraph().nodes.find((n) => n.kind === 'block' && (n.params.size as { y: number }).y === 3)!;
    s.wire(p(and, 'out'), p(door.id, 'hide'));
    expect(s.stepId()).toBe('play-open');
    s.play(true);
    expect(s.stepId()).toBe('win');

    // Play the learner's board for real.
    const graph = s.state.getGraph();
    const world = createWorld('2d-side');
    const rt = createRuntime(graph, world, '2d-side');
    const step = (...k: string[]): void => {
      rt.tick({ keysDown: new Set(k) });
      world.step(TICK_DT);
    };
    for (let i = 0; i < 20; i++) step();
    for (let i = 0; i < 40; i++) step('ArrowRight'); // hero from -4 to about -1.7; key rests at x=0
    for (let i = 0; i < 12; i++) step('ArrowRight');
    step('KeyE');
    step();
    expect(rt.getOutput(carry, 'holding')).toBe(true);
    for (let i = 0; i < 80; i++) step('ArrowRight'); // stops against the door
    step('KeyF');
    step();
    step();
    for (let i = 0; i < 200 && !world.ended; i++) step('ArrowRight');
    expect(world.ended?.result).toBe('win');
    s.end('win');
    expect(s.stepId()).toBe('done');
  });
});

describe('lesson 5: hand tools', () => {
  it('walks through the pickaxe, hand tool and rock wiring, and the result is winnable', () => {
    const s = session('hand-tools');
    s.runner.next();
    expect(s.stepId()).toBe('add-item');
    const pick = s.add('item');
    expect(s.stepId()).toBe('item-shape');
    s.param(pick, 'shape', 'pickaxe');
    expect(s.stepId()).toBe('item-hold');
    s.param(pick, 'holdStyle', 'hand');
    expect(s.stepId()).toBe('add-hand');
    const hand = s.add('hand-tool');
    const hero = s.idOf('character');
    expect(s.stepId()).toBe('wire-hand');
    s.wire(p(hero, 'self'), p(hand, 'character'));
    expect(s.stepId()).toBe('add-key-e');
    const keyE = s.add('key');
    expect(s.stepId()).toBe('key-e-code');
    s.param(keyE, 'key', 'KeyE');
    expect(s.stepId()).toBe('wire-equip');
    s.wire(p(keyE, 'pressed'), p(hand, 'toggle'));
    expect(s.stepId()).toBe('add-key-f');
    const keyF = s.add('key');
    expect(s.stepId()).toBe('key-f-code');
    s.param(keyF, 'key', 'KeyF');
    expect(s.stepId()).toBe('wire-use');
    s.wire(p(keyF, 'pressed'), p(hand, 'use'));
    expect(s.stepId()).toBe('play-tool');
    s.play(true);
    expect(s.stepId()).toBe('back-to-edit');
    s.play(false);
    expect(s.stepId()).toBe('add-and');
    const and = s.add('and');
    const rock = s.state.getGraph().nodes.find((n) => n.kind === 'block' && (n.params.size as { y: number }).y === 3)!;
    expect(s.stepId()).toBe('wire-rock');
    s.wire(p(rock.id, 'usedOn'), p(and, 'a'));
    expect(s.stepId()).toBe('wire-in-hand');
    s.wire(p(pick, 'inHand'), p(and, 'b'));
    expect(s.stepId()).toBe('wire-break');
    s.wire(p(and, 'out'), p(rock.id, 'hide'));
    expect(s.stepId()).toBe('play-break');
    s.play(true);
    expect(s.stepId()).toBe('win');

    const graph = s.state.getGraph();
    const world = createWorld('2d-side');
    const rt = createRuntime(graph, world, '2d-side');
    const step = (...k: string[]): void => {
      rt.tick({ keysDown: new Set(k) });
      world.step(TICK_DT);
    };
    for (let i = 0; i < 20; i++) step();
    for (let i = 0; i < 40; i++) step('ArrowRight');
    step('KeyE');
    step();
    expect(rt.getOutput(hand, 'holding')).toBe(true);
    for (let i = 0; i < 100; i++) step('ArrowRight'); // stops against the rock
    step('KeyF');
    step();
    step();
    for (let i = 0; i < 200 && !world.ended; i++) step('ArrowRight');
    expect(world.ended?.result).toBe('win');
    s.end('win');
    expect(s.stepId()).toBe('done');
  });
});

describe('lesson 6: make a bot', () => {
  it('walks through bot role, patrol brain and the touch-to-lose wiring, and the bot really catches the player', () => {
    const s = session('make-bot');
    s.runner.next();
    expect(s.stepId()).toBe('add-bot');
    const hero = s.idOf('character');
    const bot = s.add('character');
    expect(s.stepId()).toBe('bot-role');
    s.param(bot, 'role', 'bot');
    expect(s.stepId()).toBe('add-patrol');
    const patrol = s.add('patrol');
    expect(s.stepId()).toBe('wire-bot-self');
    s.wire(p(bot, 'self'), p(patrol, 'self'));
    expect(s.stepId()).toBe('wire-bot-move');
    s.wire(p(patrol, 'moveX'), p(bot, 'moveX'));
    expect(s.stepId()).toBe('play-patrol');
    s.play(true);
    expect(s.stepId()).toBe('back-to-edit');
    s.play(false);
    expect(s.stepId()).toBe('add-touch');
    const touch = s.add('touch');
    expect(s.stepId()).toBe('wire-touch-a');
    s.wire(p(hero, 'self'), p(touch, 'a'));
    expect(s.stepId()).toBe('wire-touch-b');
    s.wire(p(bot, 'self'), p(touch, 'b'));
    expect(s.stepId()).toBe('add-end');
    const end = s.add('win-lose');
    expect(s.stepId()).toBe('wire-lose');
    s.wire(p(touch, 'touching'), p(end, 'lose'));
    expect(s.stepId()).toBe('play-caught');
    s.play(true);
    expect(s.stepId()).toBe('caught');

    // Play the learner's board for real: the player walks right and the patrolling bot catches them.
    const graph = s.state.getGraph();
    const world = createWorld('2d-side');
    const rt = createRuntime(graph, world, '2d-side');
    for (let i = 0; i < 60 * 15 && !world.ended; i++) {
      rt.tick({ keysDown: new Set(['ArrowRight']) });
      world.step(TICK_DT);
    }
    expect(world.ended?.result).toBe('lose');
    s.end('lose');
    expect(s.stepId()).toBe('done');
  });

  it('the starting board has a player and a floor but no bot yet', () => {
    const board = findLesson('make-bot')!.createBoard();
    const characters = board.graph.nodes.filter((n) => n.kind === 'character');
    expect(characters).toHaveLength(1);
    expect(characters[0]!.params.role ?? 'player').toBe('player');
  });
});

describe('lesson 7: bot throws the crate', () => {
  function buildLesson() {
    const s = session('chores');
    s.runner.next();
    expect(s.stepId()).toBe('watch-mess');
    s.play(true);
    expect(s.stepId()).toBe('back-to-edit');
    s.play(false);
    expect(s.stepId()).toBe('add-sequence');
    const seq = s.add('sequence');
    expect(s.stepId()).toBe('step-count');
    s.param(seq, 'stepCount', 2);
    expect(s.stepId()).toBe('step-count');
    s.param(seq, 'stepCount', 3);
    expect(s.stepId()).toBe('wire-step1');
    const gos = s.state.getGraph().nodes.filter((n) => n.kind === 'go-to');
    const byX = (x: number) => gos.find((n) => (n.params.targetPos as { x: number }).x === x)!.id;
    s.wire(p(seq, 'step1'), p(byX(-1.5), 'go'));
    expect(s.stepId()).toBe('wire-step2');
    s.wire(p(seq, 'step2'), p(byX(4.5), 'go'));
    expect(s.stepId()).toBe('wire-step3');
    s.wire(p(seq, 'step3'), p(byX(-5), 'go'));
    expect(s.stepId()).toBe('wire-next');
    const ors = s.state.getGraph().nodes.filter((n) => n.kind === 'or');
    s.wire(p(ors[0]!.id, 'out'), p(seq, 'next')); // the first Hoặc only gathers two of the three pulses
    expect(s.stepId()).toBe('wire-next');
    s.state.select({ kind: 'wire', id: s.state.getGraph().wires.find((w) => w.from.node === ors[0]!.id && w.to.node === seq)!.id });
    s.state.deleteSelection();
    s.wire(p(ors[1]!.id, 'out'), p(seq, 'next'));
    expect(s.stepId()).toBe('play-order');
    s.play(true);
    expect(s.stepId()).toBe('back-to-edit-2');
    s.play(false);
    expect(s.stepId()).toBe('add-carry');
    const carry = s.add('carry');
    const bot = s.state.getGraph().nodes.find((n) => n.kind === 'character' && n.params.role === 'bot')!;
    expect(s.stepId()).toBe('wire-carry');
    s.wire(p(bot.id, 'self'), p(carry, 'character'));
    expect(s.stepId()).toBe('wire-grab');
    s.wire(p(byX(-1.5), 'arrivedPulse'), p(carry, 'grab'));
    expect(s.stepId()).toBe('wire-drop');
    s.wire(p(byX(4.5), 'arrivedPulse'), p(carry, 'throw'));
    expect(s.stepId()).toBe('wire-finished');
    s.wire(p(seq, 'finished'), p(s.idOf('win-lose'), 'win'));
    expect(s.stepId()).toBe('play-chores');
    s.play(true);
    expect(s.stepId()).toBe('win');
    return { s, bot: bot.id, carry };
  }

  it('walks through the order, carry and finish wiring', () => {
    const { s } = buildLesson();
    s.end('win');
    expect(s.stepId()).toBe('done');
  });

  it('the finished board throws the crate past the pad and then wins with the bot back home', () => {
    const { s } = buildLesson();
    const graph = s.state.getGraph();
    const world = createWorld('2d-side');
    const rt = createRuntime(graph, world, '2d-side');
    const crateOwner = graph.nodes.find((n) => n.kind === 'item')!.id;
    const botOwner = graph.nodes.find((n) => n.kind === 'character' && n.params.role === 'bot')!.id;
    const view = (owner: string) => world.entities().find((e) => e.ownerNodeId === owner)!;
    let thrownPastPad = false;
    for (let i = 0; i < 60 * 40 && !world.ended; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
      const c = view(crateOwner);
      if (!c.inHand && c.position.x > 5.5) thrownPastPad = true;
    }
    expect(thrownPastPad).toBe(true);
    expect(world.ended?.result).toBe('win');
    expect(Math.abs(view(botOwner).position.x - -5)).toBeLessThan(0.6);
    expect(view(crateOwner).position.x).toBeGreaterThan(5.5);
    expect(view(crateOwner).inHand).toBeFalsy();
  });

  it('without the order brick the bot does not finish the chores', () => {
    const board = findLesson('chores')!.createBoard();
    const world = createWorld('2d-side');
    const rt = createRuntime(board.graph, world, '2d-side');
    for (let i = 0; i < 60 * 15; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    expect(world.ended).toBeNull();
  });
});

describe('lesson 8: bot places the crate', () => {
  /** Plays the board headless and reports where the crate and bot ended up. */
  function simulate(graph: Snapshot['graph'], seconds: number) {
    const world = createWorld('2d-side');
    const rt = createRuntime(graph, world, '2d-side');
    const crateOwner = graph.nodes.find((n) => n.kind === 'item')!.id;
    const botOwner = graph.nodes.find((n) => n.kind === 'character' && n.params.role === 'bot')!.id;
    const view = (owner: string) => world.entities().find((e) => e.ownerNodeId === owner)!;
    for (let i = 0; i < 60 * seconds && !world.ended; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    return { ended: world.ended, crate: view(crateOwner), bot: view(botOwner) };
  }

  function walk() {
    const s = session('chores-place');
    expect(s.stepId()).toBe('intro');
    s.runner.next();
    expect(s.stepId()).toBe('watch-throw');
    s.play(true);
    expect(s.stepId()).toBe('back-to-edit');
    s.play(false);
    expect(s.stepId()).toBe('remove-throw');
    const carry = s.idOf('carry');
    const wire = s.state.getGraph().wires.find((w) => w.to.node === carry && w.to.port === 'throw')!;
    s.state.select({ kind: 'wire', id: wire.id });
    s.state.deleteSelection();
    s.play(false); // re-evaluates the runner against the edited graph
    expect(s.stepId()).toBe('wire-drop');
    const padGo = s.state.getGraph().nodes.find((n) => n.kind === 'go-to' && (n.params.targetPos as { x: number }).x === 4.5)!;
    s.wire(p(padGo.id, 'arrivedPulse'), p(carry, 'drop'));
    expect(s.stepId()).toBe('play-place');
    s.play(true);
    expect(s.stepId()).toBe('win');
    return s;
  }

  it('walks through watch, delete the throw wire, wire the drop, play and win', () => {
    const s = walk();
    s.end('win');
    expect(s.stepId()).toBe('done');
  });

  it('follows the throw lesson inside the bot chapter, and titles count 1, 2, 3... in course order', () => {
    const ids = LESSONS.map((l) => l.id);
    expect(ids.indexOf('chores-place')).toBe(ids.indexOf('chores') + 1);
    expect(chapterOf('chores-place')?.id).toBe('bots');
    expect(LESSONS.map((l) => Number.parseInt(l.title, 10))).toEqual(LESSONS.map((_, i) => i + 1));
  });

  it('with Ném the crate flies off the pad and the game never wins', () => {
    const board = findLesson('chores-place')!.createBoard();
    const r = simulate(board.graph, 40);
    expect(r.ended).toBeNull();
    expect(r.crate.position.x).toBeGreaterThan(5.5);
  });

  it('with Thả the crate rests on the pad and the game wins with the bot home', () => {
    const s = walk();
    const r = simulate(s.state.getGraph(), 40);
    expect(r.ended?.result).toBe('win');
    expect(Math.abs(r.crate.position.x - 4.5)).toBeLessThan(1);
    expect(r.crate.inHand).toBeFalsy();
    expect(Math.abs(r.bot.position.x - -5)).toBeLessThan(0.6);
  });
});

describe('step targets', () => {
  it('resolve to selectors for every step of every lesson on the starting board', () => {
    for (const lesson of LESSONS) {
      const state = createEditorState(lesson.createBoard());
      const snap: Snapshot = { graph: state.getGraph(), mode: state.getMode(), playing: false, ended: null };
      for (const step of lesson.steps) {
        const list = step.target?.(snap) ?? [];
        for (const t of list) {
          for (const sel of typeof t === 'string' ? [t] : t) expect(sel.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
