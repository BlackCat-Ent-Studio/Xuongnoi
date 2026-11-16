import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type EntityView } from '../../src/engine/types';
import { createWorld } from '../../src/world/world';
import { estimateNodeSize } from '../../src/editor/graph/graph-geometry';

/** A board played headless with nobody touching any key. */
export function play(board: Board) {
  const world = createWorld(board.mode);
  const rt = createRuntime(board.graph, world, board.mode);
  const tick = (): void => {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
  };
  return {
    world,
    rt,
    tick,
    ticks(n: number): void {
      for (let i = 0; i < n; i++) tick();
    },
    seconds(s: number): void {
      for (let i = 0; i < Math.round(s / TICK_DT); i++) tick();
    },
    /** Runs `s` seconds and calls `each` after every tick. */
    watch(s: number, each: (t: number) => void): void {
      const n = Math.round(s / TICK_DT);
      for (let i = 0; i < n; i++) {
        tick();
        each((i + 1) * TICK_DT);
      }
    },
    out: (id: string, port: string) => rt.getOutput(id, port),
    entity: (owner: string): EntityView => world.entities().find((e) => e.ownerNodeId === owner)!,
  };
}

export type Played = ReturnType<typeof play>;

/** Same board without one wire; throws when the wire is not there (so a typo cannot pass as "removed"). */
export function without(board: Board, link: readonly [string, string, string, string]): Board {
  const b = structuredClone(board);
  const before = b.graph.wires.length;
  b.graph.wires = b.graph.wires.filter((w) => !(w.from.node === link[0] && w.from.port === link[1] && w.to.node === link[2] && w.to.port === link[3]));
  if (b.graph.wires.length !== before - 1) throw new Error(`wire not found: ${link.join('.')}`);
  return b;
}

/** Ids of two cards that overlap on the canvas, or null. */
export function firstCardOverlap(board: Board): string | null {
  const boxes = board.graph.nodes.map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y, ...estimateNodeSize(n) }));
  for (const p of boxes) {
    for (const q of boxes) {
      if (p.id < q.id && p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y) return `${p.id}/${q.id}`;
    }
  }
  const notes = (board.notes ?? []).map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y, w: n.size.w, h: n.size.h }));
  for (const p of notes) {
    for (const q of [...boxes, ...notes]) {
      if (p.id !== q.id && p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y) return `${p.id}/${q.id}`;
    }
  }
  return null;
}
