import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import type { Board } from '../../src/engine/types';
import { tryGripper, tryJoint, tryLink } from '../../src/handbook/boards-robot-arm';
import { registerAllNodes } from '../../src/nodes';
import { findLesson } from '../../src/tutorial/lessons';
import { crateInArm } from '../helpers/grip-metrics';
import { loadEngine, playReal, type PlayedReal } from '../helpers/cell-run-real';

/**
 * Every lesson and handbook try-board that has an arm is played with the "Vật lý thật" switch forced ON (the solid hand, the exact
 * boxes, finger arrival) as well as OFF (unchanged). The measured things are the ones a pupil sees: the lesson crate is lifted and
 * held, the gripper holds what it is lowered onto, no crate is ever inside a link, the palm or a finger (1 mm), no number is NaN.
 */
const OVERLAP = 0.001;

beforeAll(async () => {
  registerAllNodes();
  await loadEngine();
});

const withSwitch = (board: Board, on: boolean): Board => {
  const b = structuredClone(board);
  b.graph.settings = { ...b.graph.settings, ...(on ? { realPhysics: true } : { realPhysics: false }) };
  return b;
};

const idsOf = (board: Board, kind: string): string[] => board.graph.nodes.filter((n) => n.kind === kind).map((n) => n.id);

/** Plays the board for `seconds`; returns the worst overlap of any crate with the arm (m) and whether every position stayed finite. */
function play(p: PlayedReal, board: Board, seconds: number): { worst: number; finite: boolean } {
  // A hand that hangs from a wrist joint takes that joint's frame, so the wrist counts as the last link.
  const links = [...idsOf(board, 'link'), ...idsOf(board, 'joint').slice(1)];
  const grip = idsOf(board, 'gripper')[0];
  let worst = -Infinity;
  let finite = true;
  p.watch(seconds, () => {
    for (const e of p.world.entities()) {
      if (!Number.isFinite(e.position.x + e.position.y + e.position.z)) finite = false;
      if (e.kind === 'item' && e.visible && grip) worst = Math.max(worst, crateInArm(p.world, links, grip, e));
    }
  });
  return { worst, finite };
}

describe('handbook try-boards with an arm, switch on', () => {
  for (const [name, make, moves] of [['Khớp xoay', tryJoint, false], ['Thanh nối', tryLink, true]] as const) {
    it(`${name}: the arm follows the keys and nothing goes missing or non-finite`, () => {
      const board = withSwitch(make(), true);
      let keys = new Set<string>(['ArrowDown']);
      const p = playReal(board, () => keys);
      const joint = idsOf(board, 'joint')[0]!;
      p.seconds(2);
      const down = p.out(joint, 'angleNow') as number;
      keys = new Set(['ArrowUp']);
      p.seconds(3);
      const up = p.out(joint, 'angleNow') as number;
      expect(Number.isFinite(down) && Number.isFinite(up)).toBe(true);
      // The servo of "Khớp xoay" is made too weak for its 8 kg link on purpose (it sags): only the strong one has to come back up.
      if (moves) expect(up).toBeGreaterThan(down + 5);
      expect(p.world.entities().every((e) => Number.isFinite(e.position.x + e.position.y + e.position.z))).toBe(true);
      p.dispose();
    });
  }

  it('Tay kẹp: the down arrow lowers the hand round the 5 kg crate, Space grips it with both pads on the faces, the crate is never inside the hand', () => {
    const board = withSwitch(tryGripper(), true);
    const grip = idsOf(board, 'gripper')[0]!;
    let keys = new Set<string>(['ArrowDown']);
    const p = playReal(board, () => keys);
    // The hand hangs from the wrist joint: its frame is the joint's, so the joint counts as the last link.
    const links = [...idsOf(board, 'link'), ...idsOf(board, 'joint').slice(1)];
    let worst = -Infinity;
    const watch = (s: number): void =>
      p.watch(s, () => {
        for (const e of p.world.entities()) if (e.kind === 'item' && e.visible) worst = Math.max(worst, crateInArm(p.world, links, grip, e));
      });
    watch(3);
    expect(p.out(grip, 'inReach')).toBe(true);
    expect(p.out(grip, 'holding')).toBe(false);
    keys = new Set(['ArrowDown', 'Space']);
    // Held only once both pads touch the faces: not on the tick Space goes down, but within 0.5 s.
    p.seconds(1 / 60);
    expect(p.out(grip, 'holding')).toBe(false);
    watch(0.6);
    expect(p.out(grip, 'holding')).toBe(true);
    expect(worst).toBeLessThan(OVERLAP);
    p.dispose();
  });
});

describe('lesson "Bảng giá trị và chuỗi bước" (arm-steps), finished by the learner', () => {
  /** The learner's finished board: a Chuỗi bước (3 steps), a Bảng giá trị (-12, -12, 30) and the six wires of the lesson. */
  function finished(): Board {
    const lesson = findLesson('arm-steps')!;
    const state = createEditorState(lesson.createBoard());
    const g = () => state.getGraph();
    const idOf = (kind: string): string => g().nodes.find((n) => n.kind === kind)!.id;
    const seq = state.addNode('sequence', { x: 40, y: 900 })!;
    state.setParam(seq, 'stepCount', 3);
    state.setParam(seq, 'showDone', 'yes');
    const table = state.addNode('value-table', { x: 300, y: 900 })!;
    state.setParam(table, 'v1', -12);
    state.setParam(table, 'v2', -12);
    state.setParam(table, 'v3', 30);
    const joint = idOf('joint');
    const gripper = idOf('gripper');
    const either = idOf('or');
    const wire = (a: [string, string], b: [string, string]): void => {
      expect(state.connect({ node: a[0], port: a[1] }, { node: b[0], port: b[1] }, { replace: true })).toEqual({ ok: true });
    };
    wire([seq, 'index'], [table, 'index']);
    wire([table, 'value'], [joint, 'angle']);
    wire([seq, 'step2'], [either, 'a']);
    wire([seq, 'step3'], [either, 'b']);
    wire([gripper, 'inReach'], [seq, 'done1']);
    wire([gripper, 'holding'], [seq, 'done2']);
    return state.getBoard();
  }

  for (const on of [false, true]) {
    it(`switch ${on ? 'ON' : 'OFF'}: the arm lowers, grips and lifts the 2.5 kg crate by itself (above 1.5 m, held), no crate inside the arm`, { timeout: 120_000 }, () => {
      const board = withSwitch(finished(), on);
      const p = playReal(board);
      const r = play(p, board, 16);
      const crate = p.world.entities().find((e) => e.kind === 'item')!;
      const grip = idsOf(board, 'gripper')[0]!;
      expect(crate.position.y).toBeGreaterThan(1.5);
      expect(p.out(grip, 'holding')).toBe(true);
      expect(r.finite).toBe(true);
      if (on) expect(r.worst).toBeLessThan(OVERLAP);
      p.dispose();
    });
  }
});
