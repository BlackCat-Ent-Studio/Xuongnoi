import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Graph, type InputSnapshot, type PortRef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { chapterOf, lessonName } from '../../src/tutorial/course';
import { LESSONS, findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import { takeSnapshot } from '../../src/tutorial/snapshot';
import type { Lesson, Snapshot } from '../../src/tutorial/types';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });

function session(id: string) {
  const lesson = findLesson(id)!;
  const state = createEditorState(lesson.createBoard());
  const runner = createRunner(lesson);
  let ended: Snapshot['ended'] = null;
  const tick = (): void => {
    runner.evaluate(takeSnapshot(state, ended));
  };
  tick();
  const nodes = () => state.getGraph().nodes;
  return {
    lesson,
    state,
    runner,
    stepId: () => runner.step().id,
    /** Runs an editor action, then lets the lesson look at the result like the controller does. */
    do(fn: () => void): void {
      fn();
      tick();
    },
    finish(result: 'win' | 'lose'): void {
      ended = result;
      tick();
    },
    kindId: (kind: string): string => nodes().find((n) => n.kind === kind)!.id,
    expectStep(id: string): void {
      expect(runner.step().id).toBe(id);
    },
  };
}

const allSelectors = (lesson: Lesson, snap: Snapshot): string[] =>
  lesson.steps.flatMap((st) => (st.target?.(snap) ?? []).flatMap((t) => (typeof t === 'string' ? [t] : t)));

describe('course pack D registration', () => {
  it.each([
    ['groups', 'Gom nhóm mảnh ghép'],
    ['capstone-factory', 'Dự án cuối: Xưởng đóng gói'],
  ])('%s is in the Làm game thật chapter with its title', (id, name) => {
    const lesson = findLesson(id)!;
    expect(LESSONS).toContain(lesson);
    expect(chapterOf(id)?.id).toBe('real-games');
    expect(lessonName(lesson.title)).toBe(name);
    expect(lesson.steps.at(-1)!.check).toBeUndefined();
    expect(new Set(lesson.steps.map((st) => st.id)).size).toBe(lesson.steps.length);
  });

  it('the capstone is listed after the groups lesson', () => {
    const order = LESSONS.map((l) => l.id);
    expect(order.indexOf('groups')).toBeGreaterThan(order.indexOf('editor-tools'));
    expect(order.indexOf('capstone-factory')).toBeGreaterThan(order.indexOf('groups'));
  });
});

describe('groups lesson', () => {
  it('starts as two bot setups plus a floor, with no groups', () => {
    const board = findLesson('groups')!.createBoard();
    const kinds = board.graph.nodes.map((n) => n.kind).sort();
    // The "Khi bắt đầu" card is what the wire rule adds so both bots still set off at the start.
    expect(kinds).toEqual(['block', 'character', 'character', 'go-to', 'go-to', 'on-start']);
    expect(board.graph.wires).toHaveLength(6);
    expect(board.graph.groups).toBeUndefined();
  });

  it('every step target resolves to a selector on the starter board', () => {
    const lesson = findLesson('groups')!;
    const s = session('groups');
    const snap = takeSnapshot(s.state, null);
    for (const st of lesson.steps) {
      if (st.id === 'rename-group' || st.id === 'enter-group' || st.id === 'select-group') continue;
      if (st.target) expect(st.target(snap).length, st.id).toBeGreaterThan(0);
    }
  });

  it('walks select, group, rename, enter, exit, select, duplicate, then ends', () => {
    const s = session('groups');
    const g = () => s.state.getGraph();
    const botId = s.kindId('character');
    const goId = s.kindId('go-to');

    s.expectStep('intro');
    s.runner.next();
    s.expectStep('select-pair');
    s.do(() => s.state.selectMany([botId]));
    s.expectStep('select-pair');
    s.do(() => s.state.selectMany([botId, goId, s.kindId('block')]));
    s.expectStep('select-pair');
    s.do(() => s.state.selectMany([botId, goId]));
    s.expectStep('make-group');

    s.do(() => expect(s.state.groupSelection().ok).toBe(true));
    expect(g().groups).toHaveLength(1);
    s.expectStep('rename-group');
    const groupId = g().groups![0]!.id;

    s.do(() => s.state.renameGroup(groupId, 'Nhóm 7'));
    s.expectStep('rename-group');
    s.do(() => s.state.renameGroup(groupId, 'Bot đi tuần'));
    s.expectStep('enter-group');

    s.do(() => s.state.enterGroup(groupId));
    s.expectStep('exit-group');
    s.do(() => s.state.exitGroup());
    s.expectStep('select-group');

    s.do(() => s.state.selectMany([groupId, s.kindId('block')]));
    s.expectStep('select-group');
    s.do(() => s.state.select({ kind: 'group', id: groupId }));
    s.expectStep('duplicate-group');

    s.do(() => expect(s.state.duplicate()).toBeGreaterThan(0));
    expect(g().groups).toHaveLength(2);
    s.expectStep('library');
    s.runner.next();
    s.expectStep('done');
  });

  it('target selectors point at the group block and the rename field once a group exists', () => {
    const lesson = findLesson('groups')!;
    const s = session('groups');
    s.do(() => s.state.selectMany([s.kindId('character'), s.kindId('go-to')]));
    s.do(() => s.state.groupSelection());
    const snap = takeSnapshot(s.state, null);
    const sels = allSelectors(lesson, snap);
    expect(sels.some((x) => x.startsWith('.wc-group[data-id='))).toBe(true);
    expect(sels).toContain('.pn-group-name');
  });
});

describe('capstone factory lesson', () => {
  const lesson = () => findLesson('capstone-factory')!;

  it('starts as a valid half-built factory with the bot, belt, crates and zones', () => {
    const board = lesson().createBoard();
    const count = (k: string) => board.graph.nodes.filter((n) => n.kind === k).length;
    expect(board.mode).toBe('2d-side');
    expect(count('go-to')).toBe(4);
    expect(count('zone')).toBe(3);
    expect(count('item')).toBe(2);
    expect(count('sequence')).toBe(1);
    expect(count('spawner')).toBe(1);
    expect(count('counter') + count('ui-meter') + count('ui-start') + count('win-lose')).toBe(0);
    const ids = new Set(board.graph.nodes.map((n) => n.id));
    expect(board.graph.wires.every((w) => ids.has(w.from.node) && ids.has(w.to.node))).toBe(true);
  });

  it('has 15 to 22 steps and every target resolves while its step is current', () => {
    expect(lesson().steps.length).toBeGreaterThanOrEqual(15);
    expect(lesson().steps.length).toBeLessThanOrEqual(22);
    const solved = solve();
    const snap = takeSnapshot(solved.s.state, null);
    for (const st of lesson().steps) {
      if (st.target) expect(st.target(snap).length, st.id).toBeGreaterThan(0);
    }
  });

  /** Plays the lesson through the editor API, asserting each step waits for its edit. */
  function solve() {
    const s = session('capstone-factory');
    const graph = (): Graph => s.state.getGraph();
    const byPos = (kind: string, col: number, row: number) =>
      graph().nodes.find((n) => n.kind === kind && n.pos.x === 20 + col * 250 && n.pos.y === 20 + row * 200)!.id;
    const connect = (a: PortRef, b: PortRef): void => s.do(() => expect(s.state.connect(a, b, { replace: true })).toEqual({ ok: true }));
    const add = (kind: string): string => {
      let id = '';
      s.do(() => {
        id = s.state.addNode(kind, { x: 40, y: 900 })!;
      });
      return id;
    };
    const zoneAt = (x: number) =>
      graph().nodes.find((n) => n.kind === 'zone' && (n.params.center as { x: number }).x === x)!.id;

    s.expectStep('intro');
    s.runner.next();
    s.expectStep('add-start');
    const start = add('ui-start');
    s.expectStep('wire-start-timer');
    const timer = s.kindId('timer');
    const spawner = s.kindId('spawner');
    connect(p(start, 'started'), p(timer, 'run'));
    s.expectStep('wire-timer-spawn');
    connect(p(timer, 'done'), p(spawner, 'spawn'));
    s.expectStep('wire-belt-at');
    const belt = graph().nodes.find((n) => n.kind === 'block' && n.params.style === 'conveyor')!.id;
    connect(p(belt, 'self'), p(spawner, 'at'));
    s.expectStep('wire-next');
    const orArrived = byPos('or', 3, 1);
    connect(p(orArrived, 'out'), p(s.kindId('sequence'), 'next'));
    s.expectStep('wire-grab');
    connect(p(orArrived, 'out'), p(s.kindId('carry'), 'grab'));
    s.expectStep('goods-red');
    s.do(() => s.state.setParam(zoneAt(-6), 'goods', 'xanh'));
    s.expectStep('goods-red');
    s.do(() => s.state.setParam(zoneAt(-6), 'goods', 'đỏ'));
    s.expectStep('goods-blue');
    s.do(() => s.state.setParam(zoneAt(-1), 'goods', ' xanh '));
    s.expectStep('goods-blue');
    s.do(() => s.state.setParam(zoneAt(-1), 'goods', 'xanh'));
    s.expectStep('add-counter');
    const counter = add('counter');
    s.expectStep('counter-target');
    s.do(() => s.state.setParam(counter, 'target', 3));
    s.expectStep('counter-target');
    s.do(() => s.state.setParam(counter, 'target', 2));
    s.expectStep('wire-packed');
    connect(p(byPos('or', 7, 2), 'out'), p(counter, 'up'));
    s.expectStep('add-meter');
    const meter = add('ui-meter');
    s.expectStep('meter-setup');
    s.do(() => s.state.setParam(meter, 'max', 2));
    s.expectStep('meter-setup');
    s.do(() => s.state.setParam(meter, 'label', 'Đóng gói'));
    s.expectStep('wire-meter');
    connect(p(counter, 'value'), p(meter, 'value'));
    s.expectStep('wire-reached');
    const and = s.kindId('and');
    connect(p(counter, 'reached'), p(and, 'a'));
    s.expectStep('add-end');
    const end = add('win-lose');
    s.expectStep('wire-win');
    connect(p(and, 'out'), p(end, 'win'));
    s.expectStep('play');
    s.do(() => s.state.setPlaying(true));
    s.expectStep('win');
    return { s, start };
  }

  it('walks every step in order and ends on the closing step', () => {
    const { s } = solve();
    s.finish('win');
    s.expectStep('done');
  });

  it('the unfinished board never wins', () => {
    const board = lesson().createBoard();
    const world = createWorld('2d-side');
    const rt = createRuntime(board.graph, world, '2d-side');
    for (let i = 0; i < 60 * 40; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    expect(world.ended).toBeNull();
  });

  it('the finished board packs the crates and wins with no player input', () => {
    const { s, start } = solve();
    const graph = s.state.getGraph();
    const world = createWorld('2d-side');
    const rt = createRuntime(graph, world, '2d-side');
    const click: InputSnapshot = { keysDown: new Set(), ui: { clicked: new Set([start]), held: new Set(), picked: new Set() } };
    const idle: InputSnapshot = { keysDown: new Set() };
    const goods = (tag: string) => world.entities().find((e) => world.tagOf(e.id) === tag)!;
    for (let i = 0; i < 60 * 90 && !world.ended; i++) {
      rt.tick(i === 5 ? click : idle);
      world.step(TICK_DT);
    }
    expect(world.ended?.result).toBe('win');
    // The red crate ended in the red zone and the blue one in the blue zone.
    expect(Math.abs(goods('đỏ').position.x - -6)).toBeLessThan(1.4);
    expect(Math.abs(goods('xanh').position.x - -1)).toBeLessThan(1.4);
  });

  it('zones that want the other colour count nothing (goods filter)', () => {
    const { s, start } = solve();
    const graph = structuredClone(s.state.getGraph());
    // Swap the filters: each zone now wants the other colour, so the bot's sorting no longer counts.
    for (const n of graph.nodes) {
      if (n.kind !== 'zone') continue;
      if (n.params.goods === 'đỏ') n.params.goods = 'xanh';
      else if (typeof n.params.goods === 'string' && n.params.goods === 'xanh') n.params.goods = 'đỏ';
    }
    const world = createWorld('2d-side');
    const rt = createRuntime(graph, world, '2d-side');
    const click: InputSnapshot = { keysDown: new Set(), ui: { clicked: new Set([start]), held: new Set(), picked: new Set() } };
    for (let i = 0; i < 60 * 60 && !world.ended; i++) {
      rt.tick(i === 5 ? click : { keysDown: new Set() });
      world.step(TICK_DT);
    }
    expect(world.ended).toBeNull();
  });

});
