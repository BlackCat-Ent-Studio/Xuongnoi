import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type Graph, type PortRef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { COURSE, chapterOf } from '../../src/tutorial/course';
import { LESSONS, findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import { takeSnapshot } from '../../src/tutorial/snapshot';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });

/** Plays a board for `seconds` and returns where the crate is and what the gripper and the readouts say. */
function run(board: Board, seconds: number) {
  const world = createWorld(board.mode);
  const rt = createRuntime(board.graph, world, board.mode);
  const grip = board.graph.nodes.find((n) => n.kind === 'gripper')!.id;
  const joint = board.graph.nodes.find((n) => n.kind === 'joint')!.id;
  let peakHolding = 0;
  let minLeft = Infinity;
  let maxAngle = -Infinity;
  for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
    maxAngle = Math.max(maxAngle, rt.getOutput(joint, 'angleNow') as number);
  }
  const crate = world.entities().find((e) => e.kind === 'item')!;
  const hud = world.hudItems() as readonly { label?: string; value?: number }[];
  peakHolding = hud.find((h) => h.label === 'Đang giữ (1 = có)')?.value ?? -1;
  minLeft = hud.find((h) => h.label === 'Còn phải quay (độ)')?.value ?? Infinity;
  return { crate: crate.position, holding: rt.getOutput(grip, 'holding'), peakHolding, minLeft, maxAngle };
}

describe('arm-steps lesson', () => {
  const lesson = () => findLesson('arm-steps')!;

  it('is registered once, sits right after the robot arm lesson in the Robot chapter, ends on an info step, unique step ids', () => {
    expect(LESSONS.filter((l) => l.id === 'arm-steps')).toHaveLength(1);
    expect(chapterOf('arm-steps')?.id).toBe('robots');
    const ids = COURSE.find((c) => c.id === 'robots')!.lessonIds;
    expect(ids.indexOf('arm-steps')).toBe(ids.indexOf('robot-arm') + 1);
    expect(lesson().steps.at(-1)!.check).toBeUndefined();
    expect(new Set(lesson().steps.map((s) => s.id)).size).toBe(lesson().steps.length);
  });

  it('starts as a valid board with the arm built but none of the pieces it teaches, and the arm cannot do the job alone', () => {
    const board = lesson().createBoard();
    const kinds = board.graph.nodes.map((n) => n.kind);
    for (const k of ['sequence', 'value-table', 'angle-diff', 'bool-to-number']) expect(kinds, k).not.toContain(k);
    for (const k of ['joint', 'link', 'gripper', 'item', 'or']) expect(kinds, k).toContain(k);
    expect(kinds).not.toContain('key');
    expect(kinds).not.toContain('stick');
    const ids = new Set(board.graph.nodes.map((n) => n.id));
    expect(board.graph.wires.every((w) => ids.has(w.from.node) && ids.has(w.to.node))).toBe(true);
    // Nothing closes the gripper or sets the angle yet: the crate stays on the table.
    const r = run(board, 10);
    expect(r.crate.y).toBeLessThan(1);
    expect(r.holding).toBe(false);
  });

  function solve() {
    const state = createEditorState(lesson().createBoard());
    const runner = createRunner(lesson());
    const look = (): void => {
      runner.evaluate(takeSnapshot(state, null));
    };
    const g = (): Graph => state.getGraph();
    const idOf = (kind: string): string => g().nodes.find((n) => n.kind === kind)!.id;
    const doIt = (fn: () => void): void => {
      fn();
      look();
    };
    const connect = (a: PortRef, b: PortRef): void => {
      doIt(() => expect(state.connect(a, b, { replace: true })).toEqual({ ok: true }));
    };
    look();
    const stepId = (): string => runner.step().id;
    const trail: string[] = [];
    const expectStep = (id: string): void => {
      expect(stepId()).toBe(id);
      trail.push(id);
    };

    expectStep('intro');
    runner.next();
    expectStep('add-sequence');
    let seq = '';
    doIt(() => {
      seq = state.addNode('sequence', { x: 40, y: 900 })!;
    });
    expectStep('step-count');
    doIt(() => state.setParam(seq, 'stepCount', 3));
    expectStep('show-done');
    doIt(() => state.setParam(seq, 'showDone', 'yes'));
    expectStep('add-table');
    let table = '';
    doIt(() => {
      table = state.addNode('value-table', { x: 300, y: 900 })!;
    });
    expectStep('fill-table');
    doIt(() => state.setParam(table, 'v1', -12));
    expectStep('fill-table');
    doIt(() => state.setParam(table, 'v2', -12));
    expectStep('fill-table');
    doIt(() => state.setParam(table, 'v3', 30));
    const joint = idOf('joint');
    const gripper = idOf('gripper');
    const either = idOf('or');
    expectStep('wire-index');
    connect(p(seq, 'index'), p(table, 'index'));
    expectStep('wire-angle');
    connect(p(table, 'value'), p(joint, 'angle'));
    expectStep('wire-close');
    connect(p(seq, 'step2'), p(either, 'a'));
    expectStep('wire-close');
    connect(p(seq, 'step3'), p(either, 'b'));
    expectStep('wire-done');
    connect(p(gripper, 'inReach'), p(seq, 'done1'));
    expectStep('wire-done');
    connect(p(gripper, 'holding'), p(seq, 'done2'));
    expectStep('play-1');

    return { state, runner, doIt, connect, expectStep, g, idOf, ids: { seq, table, joint, gripper, either }, stepId };
  }

  it('can be solved step by step; the finished board lowers, grips and lifts the crate by itself', { timeout: 60_000 }, () => {
    const s = solve();
    const snap = takeSnapshot(s.state, null);
    for (const st of lesson().steps) if (st.target) expect(st.target(snap).length, st.id).toBeGreaterThan(0);
    s.doIt(() => s.state.setPlaying(true));
    s.expectStep('back-to-edit');
    s.doIt(() => s.state.setPlaying(false));
    s.expectStep('add-angle-diff');
    let diff = '';
    s.doIt(() => {
      diff = s.state.addNode('angle-diff', { x: 560, y: 900 })!;
    });
    s.expectStep('wire-diff');
    const left = s.g().nodes.find((n) => n.kind === 'show-number' && n.params.label === 'Còn phải quay (độ)')!.id;
    s.connect(p(s.ids.table, 'value'), p(diff, 'a'));
    s.expectStep('wire-diff');
    s.connect(p(s.ids.joint, 'angleNow'), p(diff, 'b'));
    s.expectStep('wire-diff');
    s.connect(p(diff, 'diff'), p(left, 'value'));
    s.expectStep('add-bool-to-number');
    let bool = '';
    s.doIt(() => {
      bool = s.state.addNode('bool-to-number', { x: 560, y: 1000 })!;
    });
    s.expectStep('wire-bool');
    const holdingShow = s.g().nodes.find((n) => n.kind === 'show-number' && n.params.label === 'Đang giữ (1 = có)')!.id;
    s.connect(p(s.ids.gripper, 'holding'), p(bool, 'on'));
    s.expectStep('wire-bool');
    s.connect(p(bool, 'value'), p(holdingShow, 'value'));
    s.expectStep('play-2');
    s.doIt(() => s.state.setPlaying(true));
    s.expectStep('done');

    const r = run(s.state.getBoard(), 14);
    // The 2.5 kg crate is lifted off the 0.6 m table and held there.
    expect(r.crate.y).toBeGreaterThan(1.5);
    expect(r.holding).toBe(true);
    expect(r.peakHolding).toBe(1);
    expect(r.maxAngle).toBeGreaterThan(25);
    // Bool-to-number is wired for real: closing 30 deg = the diff readout is back at 0 once the arm arrived.
    expect(Math.abs(r.minLeft)).toBeLessThan(1);
  });

  it('is anti-forced: without any one of the wires the crate is not lifted', { timeout: 120_000 }, () => {
    const base = solve();
    const wires: [string, string, string, string][] = [
      ['seq', 'index', 'table', 'index'],
      ['table', 'value', 'joint', 'angle'],
      ['seq', 'step2', 'either', 'a'],
      ['seq', 'step3', 'either', 'b'],
      ['gripper', 'inReach', 'seq', 'done1'],
      ['gripper', 'holding', 'seq', 'done2'],
    ];
    const lifted = (board: Board): boolean => run(board, 14).crate.y > 1.5;
    expect(lifted(base.state.getBoard())).toBe(true);
    for (const [a, ap, b, bp] of wires) {
      const board = structuredClone(base.state.getBoard());
      const ids = base.ids as Record<string, string>;
      const before = board.graph.wires.length;
      board.graph.wires = board.graph.wires.filter((w) => !(w.from.node === ids[a] && w.from.port === ap && w.to.node === ids[b] && w.to.port === bp));
      expect(board.graph.wires.length, `${a}.${ap}->${b}.${bp}`).toBe(before - 1);
      // Step 3 without "close" (b) still grips in step 2 but lets go on the lift: the crate falls back. Same for step 2.
      expect(lifted(board), `${a}.${ap}->${b}.${bp}`).toBe(false);
    }
  });
});
