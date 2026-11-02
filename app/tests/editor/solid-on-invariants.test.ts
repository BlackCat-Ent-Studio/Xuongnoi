import { describe, expect, it } from 'vitest';
import type { BodySnapshot, World } from '../../src/engine/types';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { checkBodies, checkColliderMatchesDrawing, checkContactClaims, type Violation } from '../../src/world/physics-check';
import { allBoards, runBoard, type NamedBoard } from './solid-helpers';

/**
 * Every sample, lesson board and handbook try-board played with "Va chạm thật" on, with the hidden physics checker
 * after every second tick. Nothing here flips a shipped board: the result is a table (see the file snapshot) the
 * owner reads before deciding which boards may switch on. The snapshot also guards against silent changes.
 */

interface Outcome {
  ended: string;
  ticks: number;
  /** Distinct rule breaks as "code xN" (N = distinct object pairs), with the first second it happened. */
  breaks: string[];
  error: string | null;
  /** Largest gap between a character's collision box and its own size (editor characters keep their size). */
  colliderMismatch: number;
  /** Hash of the whole entity state (without the solid-body-only `carried` flag); equal in ON and OFF means the switch changed nothing here. */
  hash: string;
}

function play(board: NamedBoard, on: boolean): Outcome {
  const seen = new Map<string, { code: string; t: number }>();
  let mismatch = 0;
  const check = (world: World, tick: number): void => {
    const bodies: readonly BodySnapshot[] = world.debugBodies?.() ?? [];
    const add = (v: Violation): void => {
      const key = `${v.code}|${v.who.join('|')}`;
      if (!seen.has(key)) seen.set(key, { code: v.code, t: tick / 60 });
    };
    for (const v of checkBodies(bodies, { solidBodies: true })) add(v);
    const live = bodies.filter((b) => b.visible && !b.seated && !b.zone);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i]!;
        const b = live[j]!;
        if ((a.kind === 'block' && b.kind === 'block') || a.carried || b.carried) continue;
        for (const v of checkContactClaims(a, b, world.isTouching(a.id, b.id))) add(v);
      }
    }
    if (tick === 0) {
      for (const c of bodies) if (c.kind === 'character') for (const v of checkColliderMatchesDrawing(c, 1)) mismatch = Math.max(mismatch, v.amount);
    }
  };
  const res = runBoard(board.board, on ? worldOptionsForGraph({ nodes: [], wires: [], settings: { solidBodies: true } }) : undefined, {
    seconds: 15,
    ignoreCarriedFlag: true,
    onTick: (tick, world) => {
      if (tick % 2 === 0) check(world, tick);
    },
  });
  const byCode = new Map<string, { n: number; first: number }>();
  for (const v of seen.values()) {
    const cur = byCode.get(v.code);
    byCode.set(v.code, { n: (cur?.n ?? 0) + 1, first: Math.min(cur?.first ?? Infinity, v.t) });
  }
  return {
    ended: res.ended ?? 'running',
    ticks: res.ticks,
    breaks: [...byCode.entries()].sort().map(([code, v]) => `${code} x${v.n} from ${v.first.toFixed(1)}s`),
    error: res.error,
    colliderMismatch: Math.round(mismatch * 1000) / 1000,
    hash: res.hash,
  };
}

const boards = allBoards();
const table: Record<string, { off: Outcome; on: Outcome }> = {};

describe('Va chạm thật on: physics checker over every shipped board', () => {
  for (const b of boards) {
    it(`${b.id}: runs without error and keeps the editor character size`, { timeout: 180_000 }, () => {
      const off = play(b, false);
      const on = play(b, true);
      table[b.id] = { off, on };
      expect(on.error, 'ON run threw').toBeNull();
      expect(off.error, 'OFF run threw').toBeNull();
      expect(on.colliderMismatch).toBe(0);
    });
  }

  it('summary table', async () => {
    const rows = boards.map((b) => ({ id: b.id, off: table[b.id]?.off, on: table[b.id]?.on }));
    await expect(JSON.stringify(rows, null, 1)).toMatchFileSnapshot('./solid-on-summary.snap.json');
  });
});
