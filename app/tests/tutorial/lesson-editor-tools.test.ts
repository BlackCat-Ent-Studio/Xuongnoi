import { lessonName } from '../../src/tutorial/course';
import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { registerAllNodes } from '../../src/nodes';
import { LESSONS, findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import { takeSnapshot } from '../../src/tutorial/snapshot';

beforeAll(() => registerAllNodes());

function session() {
  const lesson = findLesson('editor-tools')!;
  const state = createEditorState(lesson.createBoard());
  const runner = createRunner(lesson);
  const tick = (): void => {
    runner.evaluate(takeSnapshot(state, null));
  };
  tick();
  const idOf = (kind: string): string => state.getGraph().nodes.find((n) => n.kind === kind)!.id;
  return {
    state,
    runner,
    stepId: () => runner.step().id,
    /** Run an editor action, then let the lesson look at the result like the controller does. */
    do(fn: () => void): void {
      fn();
      tick();
    },
    selectGroup(): void {
      this.do(() => state.selectMany([idOf('key'), idOf('character')]));
    },
    idOf,
  };
}

describe('lesson 15: board tools', () => {
  it('is registered with a stable id and a starter board', () => {
    const lesson = findLesson('editor-tools')!;
    expect(LESSONS).toContain(lesson);
    expect(lessonName(lesson.title)).toBe('Công cụ bảng nối');
    const board = lesson.createBoard();
    expect(board.graph.nodes.map((n) => n.kind).sort()).toEqual(['block', 'character', 'key']);
    expect(board.graph.wires).toHaveLength(1);
  });

  it('waits on the intro until Tiếp, then needs exactly the key and the hero selected', () => {
    const s = session();
    expect(s.stepId()).toBe('intro');
    s.runner.next();
    expect(s.stepId()).toBe('select-group');
    s.do(() => s.state.selectMany([s.idOf('key'), s.idOf('character'), s.idOf('block')]));
    expect(s.stepId()).toBe('select-group');
    s.do(() => s.state.selectMany([s.idOf('key')]));
    expect(s.stepId()).toBe('select-group');
    s.selectGroup();
    expect(s.stepId()).toBe('copy-paste');
  });

  it('walks copy, paste, duplicate, delete, undo, redo, undo, note, text, colour', () => {
    const s = session();
    s.runner.next();
    s.selectGroup();

    expect(s.state.copy()).toBe(2);
    s.do(() => undefined);
    expect(s.stepId()).toBe('copy-paste');
    s.do(() => s.state.paste());
    expect(s.state.getGraph().nodes).toHaveLength(5);
    expect(s.state.getGraph().wires).toHaveLength(2);
    expect(s.stepId()).toBe('paste-again');
    s.do(() => s.state.paste());
    expect(s.stepId()).toBe('duplicate');
    s.do(() => s.state.duplicate());
    expect(s.state.getGraph().nodes).toHaveLength(9);
    expect(s.stepId()).toBe('delete-by-mistake');

    s.do(() => s.state.deleteSelection());
    expect(s.state.getGraph().nodes).toHaveLength(7);
    expect(s.stepId()).toBe('undo');
    s.do(() => s.state.undo());
    expect(s.state.getGraph().nodes).toHaveLength(9);
    expect(s.stepId()).toBe('redo');
    s.do(() => s.state.redo());
    expect(s.state.getGraph().nodes).toHaveLength(7);
    expect(s.stepId()).toBe('undo-again');
    s.do(() => s.state.undo());
    expect(s.stepId()).toBe('add-note');

    let noteId = '';
    s.do(() => {
      noteId = s.state.addNote({ x: 700, y: 20 })!;
    });
    expect(s.stepId()).toBe('note-text');
    s.do(() => s.state.updateNote(noteId, { text: '   ' }));
    expect(s.stepId()).toBe('note-text');
    s.do(() => s.state.updateNote(noteId, { text: 'Nhóm nhảy' }));
    expect(s.stepId()).toBe('note-color');
    s.do(() => s.state.updateNote(noteId, { color: 'blue' }));
    expect(s.stepId()).toBe('done');
    expect(s.runner.isLast()).toBe(true);
  });

  it('does not count an undo that went too far back', () => {
    const s = session();
    s.runner.next();
    s.selectGroup();
    s.state.copy();
    s.do(() => s.state.paste());
    s.do(() => s.state.paste());
    s.do(() => s.state.duplicate());
    s.do(() => s.state.deleteSelection());
    expect(s.stepId()).toBe('undo');
    // Undo the delete and the duplicate in one go: 7 nodes, so the pair is not back yet.
    s.do(() => {
      s.state.undo();
      s.state.undo();
    });
    expect(s.state.getGraph().nodes).toHaveLength(7);
    expect(s.stepId()).toBe('undo');
    s.do(() => s.state.redo());
    expect(s.state.getGraph().nodes).toHaveLength(9);
    expect(s.stepId()).toBe('redo');
  });

  it('every target selector is a non-empty string and the last step is info only', () => {
    const lesson = findLesson('editor-tools')!;
    const state = createEditorState(lesson.createBoard());
    state.addNote({ x: 0, y: 0 });
    const snap = takeSnapshot(state, null);
    for (const step of lesson.steps) {
      for (const t of step.target?.(snap) ?? []) {
        for (const sel of typeof t === 'string' ? [t] : t) expect(sel.length).toBeGreaterThan(0);
      }
    }
    expect(lesson.steps[lesson.steps.length - 1]?.check).toBeUndefined();
    expect(lesson.steps.length).toBeGreaterThanOrEqual(12);
  });
});
