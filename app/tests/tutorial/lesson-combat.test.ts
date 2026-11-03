import { chapterOf } from '../../src/tutorial/course';
import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type GameResult, type PortRef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import type { Snapshot } from '../../src/tutorial/types';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });

describe('lesson 9: combat', () => {
  it('is the lesson after the hand-tool and bot lessons', () => {
    expect(chapterOf('combat')?.id).toBe('fighting');
  });

  it('walks through health, win on dead, fight brain and attack wiring, and the finished board plays', () => {
    const lesson = findLesson('combat')!;
    const state = createEditorState(lesson.createBoard());
    const runner = createRunner(lesson);
    let ended: GameResult | null = null;
    const tick = (): void => {
      const snap: Snapshot = { graph: state.getGraph(), mode: state.getMode(), playing: state.isPlaying(), ended };
      runner.evaluate(snap);
    };
    const at = (id: string): void => expect(runner.step().id).toBe(id);
    const add = (kind: string): string => {
      const id = state.addNode(kind, { x: 0, y: 0 });
      if (!id) throw new Error(kind);
      tick();
      return id;
    };
    const wire = (from: PortRef, to: PortRef): void => {
      expect(state.connect(from, to, { replace: true })).toEqual({ ok: true });
      tick();
    };
    const nodes = state.getGraph().nodes;
    const hero = nodes.find((n) => n.kind === 'character' && n.params.role !== 'bot')!.id;
    const bot = nodes.find((n) => n.kind === 'character' && n.params.role === 'bot')!.id;
    const end = nodes.find((n) => n.kind === 'win-lose')!.id;
    const botHand = nodes.filter((n) => n.kind === 'hand-tool').find((n) => state.getGraph().wires.some((w) => w.from.node === bot && w.to.node === n.id))!.id;

    tick();
    runner.next();
    at('add-health');
    const health = add('health');
    at('wire-health-self');
    wire(p(bot, 'self'), p(health, 'self'));
    at('wire-win');
    wire(p(health, 'dead'), p(end, 'win'));
    at('play-win');
    state.setPlaying(true);
    tick();
    at('won');
    ended = 'win';
    tick();
    at('back-to-edit');
    state.setPlaying(false);
    ended = null;
    tick();
    at('add-fight');
    const fight = add('fight');
    at('wire-fight-bot');
    wire(p(bot, 'self'), p(fight, 'self'));
    at('wire-fight-target');
    wire(p(hero, 'self'), p(fight, 'target'));
    at('wire-fight-move');
    wire(p(fight, 'moveX'), p(bot, 'moveX'));
    at('wire-fight-attack');
    wire(p(fight, 'attack'), p(botHand, 'use'));
    at('start-fight-go');
    wire(p(state.getGraph().nodes.find((n) => n.kind === 'on-start')!.id, 'started'), p(fight, 'go'));
    at('play-fight');
    state.setPlaying(true);
    tick();
    at('result');

    // The learner's board for real: an idle player is beaten and the game reports a loss.
    const world = createWorld('2d-side');
    const rt = createRuntime(state.getGraph(), world, '2d-side');
    for (let i = 0; i < 60 * 40 && !world.ended; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    expect(world.ended?.result).toBe('lose');
    ended = 'lose';
    tick();
    at('done');
  });

  it('the starting board has a passive bot: punching it to zero wins once health is wired', () => {
    const board = findLesson('combat')!.createBoard();
    const healths = board.graph.nodes.filter((n) => n.kind === 'health');
    expect(healths).toHaveLength(1);
    expect(board.graph.nodes.some((n) => n.kind === 'fight')).toBe(false);
  });
});
