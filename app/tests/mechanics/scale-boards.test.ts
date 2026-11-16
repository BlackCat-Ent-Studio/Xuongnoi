import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type HudItem } from '../../src/engine/types';
import { tryForceSensor } from '../../src/handbook/boards-input-logic';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';
import { LESSONS } from '../../src/tutorial/lessons';

registerAllNodes();

/** Plays a board headless; `keysAt` gives the keys held on a tick. Returns the HUD values at the end. */
function play(board: Board, seconds: number, keysAt: (tick: number) => string[] = () => []): Map<string, number> {
  const world = createWorld(board.mode);
  const rt = createRuntime(board.graph, world, board.mode);
  const total = Math.round(seconds / TICK_DT);
  for (let i = 0; i < total; i++) {
    rt.tick({ keysDown: new Set(keysAt(i)) });
    world.step(TICK_DT);
  }
  const out = new Map<string, number>();
  for (const h of world.hudItems() as readonly HudItem[]) out.set(h.label, h.value);
  return out;
}

describe('scale try-board', () => {
  it('reads 17 kg and 166.77 N once the three crates have landed', () => {
    const hud = play(tryForceSensor(), 4);
    expect(hud.get('Khối lượng (kg)')).toBe(17);
    expect(hud.get('Lực (N)')).toBeCloseTo(166.77, 6);
  });

  it('pressing Space hides the 10 kg crate and the reading drops to 7 kg', () => {
    const hud = play(tryForceSensor(), 4, (t) => (t === 200 ? ['Space'] : []));
    expect(hud.get('Khối lượng (kg)')).toBe(7);
    expect(hud.get('Lực (N)')).toBeCloseTo(68.67, 6);
  });
});

describe('lesson "Cân nặng và lực"', () => {
  it('starts with a scale and three crates of 2 kg, 5 kg and the default 1 kg', () => {
    const lesson = LESSONS.find((l) => l.id === 'weight-force')!;
    expect(lesson).toBeDefined();
    const board = lesson.createBoard();
    const crates = board.graph.nodes.filter((n) => n.kind === 'item');
    expect(crates.map((n) => n.params.mass)).toEqual([2, 5, 1]);
    expect(board.graph.nodes.some((n) => n.kind === 'force-sensor')).toBe(false);
  });

  it('wired as taught, the lesson board reads 2 + 5 + 10 kg', () => {
    const lesson = LESSONS.find((l) => l.id === 'weight-force')!;
    const board = lesson.createBoard();
    const red = board.graph.nodes.find((n) => n.kind === 'item' && n.params.color === '#ef4444')!;
    red.params = { ...red.params, mass: 10 };
    const scale = board.graph.nodes.find((n) => n.kind === 'block' && n.params.color === '#0ea5e9')!;
    const nums = board.graph.nodes.filter((n) => n.kind === 'show-number');
    const kg = nums.find((n) => n.params.label === 'Khối lượng (kg)')!;
    const newton = nums.find((n) => n.params.label === 'Lực (N)')!;
    const sensor = { id: 'fs', kind: 'force-sensor', params: {}, pos: { x: 600, y: 100 } };
    board.graph = {
      nodes: [...board.graph.nodes, sensor],
      wires: [
        ...board.graph.wires,
        { id: 'w1', from: { node: scale.id, port: 'self' }, to: { node: 'fs', port: 'who' } },
        { id: 'w2', from: { node: 'fs', port: 'mass' }, to: { node: kg.id, port: 'value' } },
        { id: 'w3', from: { node: 'fs', port: 'force' }, to: { node: newton.id, port: 'value' } },
      ],
    };
    const hud = play(board, 4);
    expect(hud.get('Khối lượng (kg)')).toBe(17);
    expect(hud.get('Lực (N)')).toBeCloseTo(166.77, 6);
  });
});
