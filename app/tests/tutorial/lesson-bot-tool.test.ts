import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type EntitySpec, type PortRef, type ViewMode } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { handToolNode } from '../../src/nodes/hand-tool';
import { LESSONS, findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import type { Snapshot } from '../../src/tutorial/types';
import { createWorld } from '../../src/world/world';
import { defaultParams } from '../nodes/fake-world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });
const DT = 1 / 60;

describe('a robot bot holding a tool (world)', () => {
  const MODES: ViewMode[] = ['2d-side', '2d-top', '3d'];
  describe.each(MODES)('in %s', (mode) => {
    const y = mode === '2d-top' ? 0 : 0.5;
    const spec = (over: Partial<EntitySpec>): EntitySpec => ({
      kind: 'block', ownerNodeId: 'x', position: { x: 0, y, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#fff', solid: true, ...over,
    });
    function scene() {
      const w = createWorld(mode);
      if (mode === '2d-side') for (let x = -10; x <= 10; x++) w.spawn(spec({ position: { x, y: -0.5, z: 0 } }));
      if (mode === '3d') for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) w.spawn(spec({ position: { x, y: -0.5, z } }));
      const bot = w.spawn(spec({ kind: 'character', ownerNodeId: 'bot', look: 'robot', role: 'bot', color: '#f59e0b' }));
      return { w, bot };
    }
    const run = (w: ReturnType<typeof createWorld>, n: number): void => {
      for (let i = 0; i < n; i++) w.step(DT);
    };

    it('equips the nearest tool, hits the rock in front, then puts the tool down', () => {
      const { w, bot } = scene();
      const far = w.spawn(spec({ kind: 'item', ownerNodeId: 'far', position: { x: -4, y, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, solid: false, shape: 'pickaxe', holdStyle: 'hand' }));
      const near = w.spawn(spec({ kind: 'item', ownerNodeId: 'near', position: { x: 0.8, y, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, solid: false, shape: 'pickaxe', holdStyle: 'hand' }));
      const rock = w.spawn(spec({ ownerNodeId: 'rock', position: { x: 1.2, y, z: 0 } }));
      run(w, 5);
      expect(w.equip(bot, 1.3)).toBe(near);
      expect(w.handItem(bot)).toBe(near);
      expect(w.getEntity(bot)!.tool).toBeDefined();
      expect(w.isInHand(far)).toBe(false);
      expect(w.useTool(bot, 1.3)).toEqual({ target: rock });
      w.step(DT);
      expect(w.wasUsedOn(rock)).toBe(true);
      expect(w.unequip(bot)).toBe(near);
      expect(w.handItem(bot)).toBeNull();
    });

    it('the Cầm tay brick drives a bot: take, then use pulses the rock', () => {
      const { w, bot } = scene();
      const pick = w.spawn(spec({ kind: 'item', ownerNodeId: 'p', position: { x: 0.6, y, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, solid: false, shape: 'pickaxe', holdStyle: 'hand' }));
      const rock = w.spawn(spec({ ownerNodeId: 'rock', position: { x: 1.4, y, z: 0 } }));
      run(w, 5);
      const realCtx = { world: w, dt: DT } as unknown as Parameters<typeof handToolNode.evaluate>[0];
      const params = defaultParams(handToolNode);
      const s = handToolNode.create!(realCtx, params);
      const take = handToolNode.evaluate(realCtx, { character: bot, toggle: true }, params, s);
      expect(take).toMatchObject({ holding: true, tool: pick });
      handToolNode.evaluate(realCtx, { character: bot, toggle: false, use: false }, params, s);
      const hit = handToolNode.evaluate(realCtx, { character: bot, use: true }, params, s);
      expect(hit).toMatchObject({ used: true, hit: rock });
    });
  });
});

describe('lesson 16: a bot that holds a pickaxe', () => {
  function session() {
    const lesson = findLesson('bot-pickaxe')!;
    const state = createEditorState(lesson.createBoard());
    const runner = createRunner(lesson);
    const tick = (ended: Snapshot['ended'] = null): void => {
      runner.evaluate({ graph: state.getGraph(), mode: state.getMode(), playing: state.isPlaying(), ended });
    };
    tick();
    return {
      state,
      runner,
      tick,
      stepId: () => runner.step().id,
      add(kind: string): string {
        const id = state.addNode(kind, { x: 0, y: 0 });
        if (!id) throw new Error(`cannot add ${kind}`);
        tick();
        return id;
      },
      wire(from: PortRef, to: PortRef): void {
        expect(state.connect(from, to)).toEqual({ ok: true });
        tick();
      },
      play(on: boolean): void {
        state.setPlaying(on);
        tick();
      },
    };
  }

  function solve() {
    const s = session();
    const g = s.state.getGraph();
    const goAt = (x: number) => g.nodes.find((n) => n.kind === 'go-to' && (n.params.targetPos as { x: number }).x === x)!.id;
    const goPick = goAt(-2);
    const goRock = goAt(3);
    const bot = g.nodes.find((n) => n.kind === 'character')!.id;
    const rock = g.nodes.find((n) => n.kind === 'block' && (n.params.size as { y: number }).y === 3)!.id;
    const pickaxeId = g.nodes.find((n) => n.kind === 'item')!.id;
    const or = g.nodes.find((n) => n.kind === 'or')!.id;
    const expectStep = (id: string): void => expect(s.stepId()).toBe(id);

    expectStep('intro');
    s.runner.next();
    expectStep('watch');
    s.play(true);
    expectStep('back-to-edit');
    s.play(false);
    expectStep('add-sequence');
    const seq = s.add('sequence');
    expectStep('wire-step1');
    s.wire(p(seq, 'step1'), p(goPick, 'go'));
    expectStep('wire-step2');
    s.wire(p(seq, 'step2'), p(goRock, 'go'));
    expectStep('wire-next');
    s.wire(p(or, 'out'), p(seq, 'next'));
    expectStep('add-hand');
    const hand = s.add('hand-tool');
    expectStep('wire-hand-who');
    s.wire(p(bot, 'self'), p(hand, 'character'));
    expectStep('wire-take');
    s.wire(p(goPick, 'arrivedPulse'), p(hand, 'toggle'));
    expectStep('wire-swing');
    s.wire(p(goRock, 'arrivedPulse'), p(hand, 'use'));
    expectStep('add-and');
    const and = s.add('and');
    expectStep('wire-rock');
    s.wire(p(rock, 'usedOn'), p(and, 'a'));
    expectStep('wire-in-hand');
    s.wire(p(pickaxeId, 'inHand'), p(and, 'b'));
    expectStep('wire-break');
    s.wire(p(and, 'out'), p(rock, 'hide'));
    expectStep('add-end');
    const end = s.add('win-lose');
    expectStep('wire-win');
    s.wire(p(and, 'out'), p(end, 'win'));
    expectStep('play-break');
    s.play(true);
    expectStep('win');
    return { s, bot, rock };
  }

  it('is registered last and starts as a side-view board with a robot bot, a hand tool and a rock', () => {
    const lesson = findLesson('bot-pickaxe')!;
    expect(LESSONS[LESSONS.length - 1]).toBe(lesson);
    expect(lesson.title).toBe('16. Bot cầm cuốc');
    const board = lesson.createBoard();
    expect(board.mode).toBe('2d-side');
    const bot = board.graph.nodes.find((n) => n.kind === 'character')!;
    expect(bot.params).toMatchObject({ role: 'bot', look: 'robot' });
    expect(board.graph.nodes.find((n) => n.kind === 'item')!.params).toMatchObject({ shape: 'pickaxe', holdStyle: 'hand' });
  });

  it('walks through every step to the win and ends on the last step', () => {
    const { s } = solve();
    s.tick('win');
    expect(s.stepId()).toBe('done');
  });

  it('without the Cầm tay wiring the bot never breaks the rock', () => {
    const board = findLesson('bot-pickaxe')!.createBoard();
    const world = createWorld('2d-side');
    const rt = createRuntime(board.graph, world, '2d-side');
    for (let i = 0; i < 60 * 5; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    expect(world.ended).toBeNull();
  });

  it('the finished board makes the bot take the pickaxe, break the rock and win', () => {
    const { s, bot, rock } = solve();
    const graph = s.state.getGraph();
    const world = createWorld('2d-side');
    const rt = createRuntime(graph, world, '2d-side');
    const view = (owner: string) => world.entities().find((e) => e.ownerNodeId === owner)!;
    const pickaxe = graph.nodes.find((n) => n.kind === 'item')!.id;
    let tookTool = false;
    let swung = false;
    for (let i = 0; i < 60 * 40 && !world.ended; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
      const b = view(bot);
      if (b.tool) tookTool = true;
      if (tookTool && b.swing !== undefined) swung = true;
    }
    expect(tookTool).toBe(true);
    expect(swung).toBe(true);
    expect(view(pickaxe).inHand).toBe(true);
    expect(view(rock).visible).toBe(false);
    expect(world.ended?.result).toBe('win');
  });
});
