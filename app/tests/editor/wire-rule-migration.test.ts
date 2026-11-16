import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { addStartCard, FORMERLY_ON_BY_DEFAULT, migrateBoardWireRule, migrateWireRule } from '../../src/editor/graph/wire-rule-migration';
import { estimateNodeSize } from '../../src/editor/graph/graph-geometry';
import { compileGraph } from '../../src/engine/compile';
import type { Board, Graph, GraphNode, NodeGroup } from '../../src/engine/types';
import { createEmptyBoard, listAllSamples, parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { createNode } from '../../src/editor/editor-state';

beforeAll(() => registerAllNodes());

const node = (id: string, kind: string, x: number, y: number, params: GraphNode['params'] = {}): GraphNode => ({ id, kind, params, pos: { x, y } });
const wire = (id: string, fn: string, fp: string, tn: string, tp: string) => ({ id, from: { node: fn, port: fp }, to: { node: tn, port: tp } });
const boxOf = (n: GraphNode) => ({ x: n.pos.x, y: n.pos.y, ...estimateNodeSize(n) });
const overlap = (a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('migrating a board from before the wire rule', () => {
  const old = (): Graph => ({
    nodes: [
      node('bot', 'character', 40, 40),
      node('go', 'go-to', 300, 40),
      node('walk', 'patrol', 300, 400),
      node('clock', 'timer', 600, 40),
      node('floor', 'block', 600, 400),
    ],
    wires: [wire('w1', 'bot', 'self', 'go', 'self'), wire('w2', 'go', 'moveX', 'bot', 'moveX')],
  });

  it('adds one visible "Khi bắt đầu" card and wires its held output into every empty switch-on input', () => {
    const g = migrateWireRule(old(), '2d-side');
    const starts = g.nodes.filter((n) => n.kind === 'on-start');
    expect(starts).toHaveLength(1);
    const into = g.wires.filter((w) => w.from.node === starts[0]!.id).map((w) => `${w.to.node}.${w.to.port}`).sort();
    expect(into).toEqual(['clock.run', 'go.go', 'walk.on']);
    expect(g.wires.filter((w) => w.from.node === starts[0]!.id).every((w) => w.from.port === 'started')).toBe(true);
    expect(g.settings?.wireRule).toBe(true);
  });

  it('leaves an input that already has a wire alone, and adds nothing when nothing is empty', () => {
    const g = old();
    const wired: Graph = { ...g, wires: [...g.wires, wire('w3', 'bot', 'self', 'go', 'go')] };
    // (type mismatch aside, only the presence of a wire matters to the migration)
    const out = migrateWireRule(wired, '2d-side');
    expect(out.wires.some((w) => w.to.node === 'go' && w.to.port === 'go' && w.from.node !== 'bot')).toBe(false);
    const none = migrateWireRule({ nodes: [node('f', 'block', 0, 0)], wires: [] }, '2d-side');
    expect(none.nodes.filter((n) => n.kind === 'on-start')).toHaveLength(0);
    expect(none.settings?.wireRule).toBe(true);
  });

  it('runs once: a marked board comes back untouched, and a new board never gets a wire it did not ask for', () => {
    const once = migrateWireRule(old(), '2d-side');
    expect(migrateWireRule(once, '2d-side')).toBe(once);
    const fresh = createEmptyBoard('2d-side');
    expect(migrateBoardWireRule(fresh)).toBe(fresh);
    const withBot: Board = { ...fresh, graph: { ...fresh.graph, nodes: [node('go', 'go-to', 0, 0)] } };
    expect(migrateBoardWireRule(withBot).graph.wires).toHaveLength(0);
    const back = parseBoard(serializeBoard(withBot));
    expect(back.ok && back.board.graph.wires).toEqual([]);
  });

  it('puts the card where it covers nothing and evaluates it first, so no other piece changes its turn', () => {
    const g = migrateWireRule(old(), '2d-side');
    const card = g.nodes.find((n) => n.kind === 'on-start')!;
    for (const other of g.nodes.filter((n) => n !== card)) expect(overlap(boxOf(card), boxOf(other)), other.id).toBe(false);
    const before = compileGraph(old()).order;
    const after = compileGraph(g).order;
    expect(after[0]).toBe(card.id);
    expect(after.filter((id) => id !== card.id)).toEqual(before);
  });

  it('puts one card inside each group that needs one, and a lone belt block only when it is a belt', () => {
    const groups: NodeGroup[] = [{ id: 'grp1', name: 'Nhóm 1', nodeIds: ['go'], x: 0, y: 0 }];
    const g = migrateWireRule({ ...old(), groups }, '2d-side');
    const cards = g.nodes.filter((n) => n.kind === 'on-start');
    expect(cards).toHaveLength(2);
    const inGroup = g.groups![0]!.nodeIds.filter((id) => cards.some((c) => c.id === id));
    expect(inGroup).toHaveLength(1);
    expect(g.wires.find((w) => w.to.node === 'go' && w.to.port === 'go')!.from.node).toBe(inGroup[0]);
    expect(g.wires.find((w) => w.to.node === 'walk' && w.to.port === 'on')!.from.node).not.toBe(inGroup[0]);

    const belt = migrateWireRule({ nodes: [node('b', 'block', 0, 0, { style: 'conveyor', size: { x: 4, y: 0.4, z: 1 } })], wires: [] }, '2d-side');
    expect(belt.wires.map((w) => `${w.to.node}.${w.to.port}`)).toEqual(['b.run']);
    const plain = migrateWireRule({ nodes: [node('b', 'block', 0, 0)], wires: [] }, '2d-side');
    expect(plain.wires).toHaveLength(0);
  });

  it('wires the patrol and the route into a forecast that used to read them out of thin air', () => {
    const g: Graph = {
      nodes: [node('guard', 'character', 0, 0), node('you', 'character', 0, 200), node('walk', 'patrol', 300, 0), node('route', 'route-follow', 300, 200), node('fore', 'sight-forecast', 600, 0)],
      wires: [
        wire('a', 'guard', 'self', 'walk', 'self'),
        wire('b', 'you', 'self', 'route', 'self'),
        wire('c', 'guard', 'self', 'fore', 'viewer'),
        wire('d', 'you', 'self', 'fore', 'target'),
      ],
    };
    const out = migrateWireRule(g, '3d');
    const has = (fn: string, fp: string, tn: string, tp: string): boolean => out.wires.some((w) => w.from.node === fn && w.from.port === fp && w.to.node === tn && w.to.port === tp);
    expect(has('walk', 'route', 'fore', 'patrol')).toBe(true);
    expect(has('route', 'route', 'fore', 'route')).toBe(true);
  });

  it('knows every input that used to be on by itself', () => {
    expect(FORMERLY_ON_BY_DEFAULT.map((r) => `${r.kind}.${r.port}`).sort()).toEqual(
      ['block.run', 'camera.on', 'chase.go', 'fight.go', 'go-to.go', 'guide-arrow.show', 'moving-platform.run', 'patrol.on', 'portal.on', 'rotating-platform.run', 'route-follow.on', 'show-text.show', 'timer.run', 'ui-button.show', 'ui-meter.show'].sort(),
    );
  });
});

describe('every way a board comes in is migrated', () => {
  it('a saved file, a sample and the editor load all end up with the mark and the card', () => {
    const file = JSON.stringify({ format_version: 1, name: 'Cũ', mode: '2d-side', graph: { nodes: [{ id: 'go', kind: 'go-to', params: {}, pos: { x: 0, y: 0 } }], wires: [] } });
    const parsed = parseBoard(file);
    expect(parsed.ok && parsed.board.graph.nodes.map((n) => n.kind).sort()).toEqual(['go-to', 'on-start']);

    const samples = listAllSamples();
    expect(samples.length).toBeGreaterThanOrEqual(16);
    for (const s of samples) expect(s.board.graph.settings?.wireRule, s.id).toBe(true);
    const guard = samples.find((s) => s.id === 'guard-patrol')!;
    expect(guard.board.graph.nodes.some((n) => n.kind === 'on-start')).toBe(true);

    const raw: Board = { name: 'x', mode: '2d-side', graph: { nodes: [createNode({ nodes: [], wires: [] }, 'timer', { x: 0, y: 0 })!], wires: [] } };
    const state = createEditorState(createEmptyBoard('2d-side'));
    state.loadBoard(raw);
    expect(state.getGraph().nodes.map((n) => n.kind).sort()).toEqual(['on-start', 'timer']);
  });

  it('the editor keeps the mark when "Va chạm thật" is switched', () => {
    const state = createEditorState(createEmptyBoard('2d-side'));
    state.setSolidBodies(false);
    expect(state.getGraph().settings).toEqual({ wireRule: true });
    state.setSolidBodies(true);
    expect(state.getGraph().settings).toEqual({ solidBodies: true, wireRule: true });
  });

  it('a lesson gets a card to wire only when it asks for one', () => {
    const plain: Board = { name: 'p', mode: '2d-side', graph: { nodes: [node('f', 'block', 100, 100)], wires: [] } };
    const withCard = addStartCard(plain);
    expect(withCard.graph.nodes.filter((n) => n.kind === 'on-start')).toHaveLength(1);
    expect(overlap(boxOf(withCard.graph.nodes[0]!), boxOf(plain.graph.nodes[0]!))).toBe(false);
    expect(addStartCard(withCard)).toBe(withCard);
  });
});
