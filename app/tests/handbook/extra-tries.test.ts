import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type InputSnapshot } from '../../src/engine/types';
import { HANDBOOK, handbookEntry } from '../../src/handbook';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';

registerAllNodes();

const extras = HANDBOOK.flatMap((e) => (e.extraTries ?? []).map((t) => ({ kind: e.kind, ...t })));

describe('handbook extra try-boards', () => {
  it('exist for route-follow pointsFrom and block showHiddenOut', () => {
    expect(extras.map((e) => e.kind).sort()).toEqual(['block', 'route-follow']);
  });

  for (const extra of extras) {
    it(`${extra.kind}: "${extra.label}" is a valid saved board and runs`, () => {
      const board = extra.board();
      expect(board.name.startsWith('Thử: ')).toBe(true);
      expect((board.notes ?? []).length).toBeGreaterThan(0);
      expect(parseBoard(serializeBoard(board)).ok).toBe(true);
      const world = createWorld(board.mode);
      const rt = createRuntime(board.graph, world, board.mode);
      for (let i = 0; i < 180; i++) {
        rt.tick({ keysDown: new Set<string>() });
        world.step(TICK_DT);
      }
    });
  }

  it('route-follow: the car drives to the wired objects, and follows when the bot moves', () => {
    const board = handbookEntry('route-follow')!.extraTries![0]!.board();
    const route = board.graph.nodes.find((n) => n.kind === 'route-follow')!;
    expect(route.params.pointsFrom).toBe('objects');
    expect(board.graph.wires.filter((w) => w.to.node === route.id && /^obj\d$/.test(w.to.port))).toHaveLength(3);
    const run = (keys: string[]): { x: number; z: number } => {
      const world = createWorld(board.mode);
      const rt = createRuntime(board.graph, world, board.mode);
      for (let i = 0; i < 600; i++) {
        const input: InputSnapshot = { keysDown: new Set(i < 120 ? keys : []) };
        rt.tick(input);
        world.step(TICK_DT);
      }
      const carId = board.graph.nodes.find((n) => n.kind === 'vehicle')!.id;
      const car = world.entities().find((e) => e.ownerNodeId === carId)!;
      return { x: car.position.x, z: car.position.z };
    };
    const still = run([]);
    const moved = run(['KeyD', 'KeyS']);
    expect(Math.hypot(still.x - moved.x, still.z - moved.z)).toBeGreaterThan(0.2);
  });

  it('block: hiding the box turns on "Đang ẩn" and wins; before that the game goes on', () => {
    const board = handbookEntry('block')!.extraTries![0]!.board();
    const wall = board.graph.nodes.find((n) => n.kind === 'block' && n.params.showHiddenOut === 'yes')!;
    expect(board.graph.wires.some((w) => w.from.node === wall.id && w.from.port === 'hidden')).toBe(true);
    const world = createWorld(board.mode);
    const rt = createRuntime(board.graph, world, board.mode);
    for (let i = 0; i < 60; i++) {
      rt.tick({ keysDown: new Set<string>() });
      world.step(TICK_DT);
    }
    expect(world.ended).toBeFalsy();
    for (let i = 0; i < 10 && !world.ended; i++) {
      rt.tick({ keysDown: new Set(['Space']) });
      world.step(TICK_DT);
    }
    expect(world.ended?.result).toBe('win');
  });
});
