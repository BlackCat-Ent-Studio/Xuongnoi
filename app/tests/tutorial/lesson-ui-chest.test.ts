import { chapterOf, lessonName } from '../../src/tutorial/course';
import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type GameResult, type Graph, type PortRef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import type { Snapshot } from '../../src/tutorial/types';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });

function session() {
  const lesson = findLesson('ui-chest')!;
  const state = createEditorState(lesson.createBoard());
  const runner = createRunner(lesson);
  let ended: GameResult | null = null;
  const tick = (): void => {
    const snap: Snapshot = { graph: state.getGraph(), mode: state.getMode(), playing: state.isPlaying(), ended };
    runner.evaluate(snap);
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
    param(id: string, name: string, v: Parameters<typeof state.setParam>[2]): void {
      state.setParam(id, name, v);
      tick();
    },
    wire(from: PortRef, to: PortRef): void {
      expect(state.connect(from, to, { replace: true })).toEqual({ ok: true });
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
    chestId: () => state.getGraph().nodes.find((n) => n.kind === 'block' && n.params.type === 'pickup')!.id,
  };
}

/** Builds the finished game by following the lesson steps; returns the graph and the ids that matter. */
function finishedGame() {
  const s = session();
  s.runner.next();
  const pick = s.add('ui-pick');
  s.wire(p(s.chestId(), 'self'), p(pick, 'target'));
  const wl = s.add('win-lose');
  s.wire(p(pick, 'pressed'), p(wl, 'win'));
  const timer = s.add('timer');
  s.param(timer, 'seconds', 10);
  const meter = s.add('ui-meter');
  s.param(meter, 'max', 10);
  s.wire(p(timer, 'left'), p(meter, 'value'));
  const start = s.state.getGraph().nodes.find((n) => n.kind === 'on-start')!.id;
  s.wire(p(start, 'started'), p(timer, 'run'));
  s.wire(p(start, 'started'), p(meter, 'show'));
  s.wire(p(timer, 'done'), p(wl, 'lose'));
  return { s, graph: s.state.getGraph(), chest: s.chestId(), pick, meter, timer };
}

describe('lesson 17: secret chest', () => {
  it('is the last registered lesson with a stable id and a starter board', () => {
    const lesson = findLesson('ui-chest')!;
    expect(chapterOf(lesson.id)?.id).toBe('items');
    expect(lessonName(lesson.title)).toBe('Rương bí mật');
    const board = lesson.createBoard();
    expect(board.mode).toBe('2d-side');
    expect(board.graph.nodes.map((n) => n.kind).sort()).toEqual(['block', 'block', 'character', 'on-start', 'stick']);
  });

  it('walks every step in order and ends info-only', () => {
    const s = session();
    expect(s.stepId()).toBe('intro');
    s.runner.next();
    expect(s.stepId()).toBe('add-pick');
    const pick = s.add('ui-pick');
    expect(s.stepId()).toBe('wire-chest');
    s.wire(p(s.chestId(), 'self'), p(pick, 'target'));
    expect(s.stepId()).toBe('add-win-lose');
    const wl = s.add('win-lose');
    expect(s.stepId()).toBe('wire-win');
    s.wire(p(pick, 'pressed'), p(wl, 'win'));
    expect(s.stepId()).toBe('add-timer');
    const timer = s.add('timer');
    expect(s.stepId()).toBe('add-timer');
    s.param(timer, 'seconds', 10);
    expect(s.stepId()).toBe('start-timer-run');
    const start = s.state.getGraph().nodes.find((n) => n.kind === 'on-start')!.id;
    s.wire(p(start, 'started'), p(timer, 'run'));
    expect(s.stepId()).toBe('add-meter');
    const meter = s.add('ui-meter');
    expect(s.stepId()).toBe('add-meter');
    s.param(meter, 'max', 10);
    expect(s.stepId()).toBe('wire-meter');
    s.wire(p(timer, 'left'), p(meter, 'value'));
    expect(s.stepId()).toBe('start-ui-meter-show');
    s.wire(p(start, 'started'), p(meter, 'show'));
    expect(s.stepId()).toBe('wire-lose');
    s.wire(p(timer, 'done'), p(wl, 'lose'));
    expect(s.stepId()).toBe('play');
    s.play(true);
    expect(s.stepId()).toBe('win');
    s.end('lose');
    expect(s.stepId()).toBe('win');
    s.end('win');
    expect(s.stepId()).toBe('done');
    expect(s.runner.isLast()).toBe(true);
  });

  it('does not accept a wire from some other block as the chest', () => {
    const s = session();
    s.runner.next();
    const pick = s.add('ui-pick');
    const floor = s.state.getGraph().nodes.find((n) => n.kind === 'block' && n.params.type !== 'pickup')!.id;
    s.wire(p(floor, 'self'), p(pick, 'target'));
    expect(s.stepId()).toBe('wire-chest');
  });

  it('plays: clicking the chest before time runs out wins', () => {
    const { graph, chest } = finishedGame();
    const world = createWorld('2d-side');
    const rt = createRuntime(graph, world, '2d-side');
    const chestEntity = world.entities().find((e) => e.ownerNodeId === chest)!;
    const nothing = { keysDown: new Set<string>() };
    for (let i = 0; i < 120; i++) {
      rt.tick(nothing);
      world.step(TICK_DT);
    }
    expect(world.ended).toBeNull();
    const bar = world.hudItems().find((h) => h.widget?.type === 'bar')!;
    expect(bar.value).toBeGreaterThan(7.5);
    expect(bar.value).toBeLessThan(8.5);
    rt.tick({ keysDown: new Set(), ui: { clicked: new Set(), held: new Set(), picked: new Set([chestEntity.id]) } });
    expect(world.ended?.result).toBe('win');
  });

  it('plays: a click on something else does nothing and running out of time loses', () => {
    const { graph } = finishedGame();
    const world = createWorld('2d-side');
    const rt = createRuntime(graph, world, '2d-side');
    const floor = world.entities().find((e) => e.kind === 'block' && e.size.x > 5)!;
    rt.tick({ keysDown: new Set(), ui: { clicked: new Set(), held: new Set(), picked: new Set([floor.id]) } });
    expect(world.ended).toBeNull();
    for (let i = 0; i < 60 * 11 && !world.ended; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    expect(world.ended?.result).toBe('lose');
  });

  it('every target is a non-empty selector', () => {
    const { graph } = finishedGame();
    const snap: Snapshot = { graph: graph as Graph, mode: '2d-side', playing: false, ended: null };
    for (const step of findLesson('ui-chest')!.steps) {
      for (const t of step.target?.(snap) ?? []) {
        for (const sel of typeof t === 'string' ? [t] : t) expect(sel.length).toBeGreaterThan(0);
      }
    }
  });
});
