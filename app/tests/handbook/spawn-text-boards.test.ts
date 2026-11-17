import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board } from '../../src/engine/types';
import { handbookEntry } from '../../src/handbook';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';

registerAllNodes();

function play(board: Board, seconds: number, each: (world: ReturnType<typeof createWorld>) => void): void {
  const world = createWorld(board.mode);
  const rt = createRuntime(board.graph, world, board.mode);
  for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
    rt.tick({ keysDown: new Set<string>() });
    world.step(TICK_DT);
    each(world);
  }
}

describe('random crate mass try-board', () => {
  it('spawns crates of different masses and the scale reads their sum', () => {
    const board = handbookEntry('spawner')!.extraTries![0]!.board();
    const masses = new Set<number>();
    let scaleReading = 0;
    play(board, 12, (w) => {
      for (const e of w.entities()) {
        if (e.kind === 'item') masses.add(w.materialOf(e.id)!.massKg);
      }
      const scale = w.entities().find((e) => e.kind === 'block' && e.size.x === 3);
      if (scale) scaleReading = Math.max(scaleReading, w.massOn(scale.id));
    });
    expect(masses.size).toBeGreaterThanOrEqual(3);
    expect(scaleReading).toBeGreaterThan(0);
  });
});

describe('changing text try-board', () => {
  it('one card walks through the three lines', () => {
    const board = handbookEntry('show-text')!.extraTries![0]!.board();
    const seen: string[] = [];
    play(board, 7, (w) => {
      const item = w.hudItems().find((h) => h.text !== undefined && h.text !== 'Chờ');
      const text = item?.text;
      if (text && seen[seen.length - 1] !== text) seen.push(text);
    });
    expect(seen.slice(0, 4)).toEqual(['Đang chờ hàng', 'Đang chạy', 'Đã dừng', 'Đang chờ hàng']);
  });
});
