import { describe, expect, it } from 'vitest';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { runLevel } from '../../src/puzzle/run-level';
import { PUZZLE_CHARACTER_SCALE } from '../../src/puzzle/world-options';
import type { PuzzleAnswer, PuzzleLevel } from '../../src/puzzle/types';
import type { BodySnapshot, World } from '../../src/engine/types';
import {
  checkBodies,
  checkColliderMatchesDrawing,
  checkContactClaims,
  describeViolation,
  type Violation,
} from '../../src/world/physics-check';

/**
 * Hidden physics check: every level's reference solution and several wrong answers are played tick by tick, and the
 * bodies must never end up inside each other. Nothing here is drawn in the game.
 */

const EMPTY: PuzzleAnswer = { nodes: [], wires: [] };

/** The reference solution, an empty answer, the solution missing each wire, and the solution with each number nudged. */
function answersFor(level: PuzzleLevel): { name: string; answer: PuzzleAnswer }[] {
  const out = [
    { name: 'solution', answer: level.solution },
    { name: 'empty', answer: EMPTY },
    ...level.solution.wires.map((w) => ({ name: `without ${w.id}`, answer: { ...level.solution, wires: level.solution.wires.filter((x) => x.id !== w.id) } })),
  ];
  for (const e of level.editable ?? []) {
    for (const value of [0, 1, 8]) {
      out.push({
        name: `${e.kind}.${e.paramId}=${value}`,
        answer: { ...level.solution, nodes: level.solution.nodes.map((n) => (n.kind === e.kind ? { ...n, params: { ...n.params, [e.paramId]: value } } : n)) },
      });
    }
  }
  return out;
}

/** Plays one answer and returns the first tick each distinct violation appeared. */
function playAndCheck(level: PuzzleLevel, answer: PuzzleAnswer): { violations: string[]; outcome: string; last: BodySnapshot[]; world: World | null } {
  const seen = new Map<string, string>();
  let last: BodySnapshot[] = [];
  let lastWorld: World | null = null;
  const solidBodies = level.mode === '3d';
  const result = runLevel(level, answer, level.timeLimit, (world, tick) => {
    const bodies = world.debugBodies?.() ?? [];
    last = [...bodies];
    lastWorld = world;
    const add = (v: Violation): void => {
      const key = `${v.code}|${v.who.join('|')}`;
      if (!seen.has(key)) seen.set(key, `t=${(tick / 60).toFixed(2)}s ${describeViolation(v)}`);
    };
    for (const v of checkBodies(bodies, { solidBodies })) add(v);
    // Sensors: "touching" must agree with the real collision boxes.
    const live = bodies.filter((b) => b.visible && !b.seated && !b.zone);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i]!;
        const b = live[j]!;
        if (a.kind === 'block' && b.kind === 'block') continue;
        if (a.carried || b.carried) continue;
        for (const v of checkContactClaims(a, b, world.isTouching(a.id, b.id))) add(v);
      }
    }
  });
  return { violations: [...seen.values()], outcome: result.outcome, last, world: lastWorld };
}

const LEVELS = PUZZLE_LEVELS;

describe.each(LEVELS)('physics invariants: level $order $id', (level) => {
  for (const { name, answer } of answersFor(level)) {
    it(`bodies never overlap or fall unhandled: ${name}`, () => {
      expect(playAndCheck(level, answer).violations).toEqual([]);
    });
  }
});

describe('physics invariants: drawn size', () => {
  it.each(LEVELS.filter((l) => l.mode === '3d'))('level $order: character collision boxes match the $id drawing', (level) => {
    let checked = 0;
    const bad: string[] = [];
    runLevel(level, level.solution, 0.05, (world, tick) => {
      if (tick !== 0) return;
      for (const b of world.debugBodies?.() ?? []) {
        if (b.kind !== 'character') continue;
        checked++;
        for (const v of checkColliderMatchesDrawing(b, PUZZLE_CHARACTER_SCALE)) bad.push(describeViolation(v));
      }
    });
    expect(checked).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
});

describe('physics invariants: stores count only what rests there', () => {
  it.each(LEVELS.filter((l) => l.mode === '3d'))('level $order $id: no crate is still carried when the win comes', (level) => {
    const r = playAndCheck(level, level.solution);
    expect(r.outcome).toBe('win');
    const zones = [...level.base.nodes, ...level.solution.nodes].filter((n) => n.kind === 'zone' && n.params.filter === 'item');
    for (const z of zones) {
      const c = z.params.center as { x: number; z: number };
      const s = z.params.size as { x: number; z: number };
      const carriedInside = r.last.filter(
        (b) => b.kind === 'item' && b.visible && b.carried && Math.abs(b.pos.x - c.x) <= s.x / 2 && Math.abs(b.pos.z - c.z) <= s.z / 2,
      );
      expect(carriedInside.map((b) => b.owner), `carried inside zone ${z.id}`).toEqual([]);
    }
  });
});

describe('physics invariants: the checker itself', () => {
  const body = (over: Partial<BodySnapshot>): BodySnapshot => ({
    id: 'a', kind: 'character', owner: 'a', visible: true, solid: false, zone: false,
    box: { pos: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 } },
    pos: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, carried: false, holder: null, seated: false, tag: '', ...over,
  });

  it('flags a character inside a crate, two crates inside each other and a fall', () => {
    const crate = body({ id: 'c', kind: 'item', owner: 'crate', box: { pos: { x: 0.2, y: 0.5, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 } } });
    const crate2 = body({ id: 'd', kind: 'item', owner: 'crate2', box: { pos: { x: 0.4, y: 0.5, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 } } });
    const faller = body({ id: 'f', owner: 'faller', box: { pos: { x: 9, y: -20, z: 9 }, size: { x: 1, y: 1, z: 1 } } });
    const codes = checkBodies([body({}), crate, crate2, faller], { solidBodies: true }).map((v) => v.code);
    expect(codes).toContain('character-in-item');
    expect(codes).toContain('item-in-item');
    expect(codes).toContain('below-floor');
  });

  it('accepts bodies that only touch, and ignores overlap when solid bodies are off', () => {
    const crate = body({ id: 'c', kind: 'item', owner: 'crate', box: { pos: { x: 0.8, y: 0.5, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 } } });
    expect(checkBodies([body({}), crate], { solidBodies: true })).toEqual([]);
    const inside = body({ id: 'c', kind: 'item', owner: 'crate', box: { pos: { x: 0, y: 0.5, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 } } });
    expect(checkBodies([body({}), inside], { solidBodies: false })).toEqual([]);
  });

  it('flags a carried item inside a wall and a sensor that claims contact from afar', () => {
    const wall = body({ id: 'w', kind: 'block', owner: 'wall', solid: true, box: { pos: { x: 0, y: 1, z: 0 }, size: { x: 1, y: 2, z: 4 } } });
    const held = body({ id: 'h', kind: 'item', owner: 'crate', carried: true, holder: 'p', box: { pos: { x: 0.2, y: 1, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 } } });
    expect(checkBodies([wall, held], { solidBodies: true }).map((v) => v.code)).toContain('carried-in-block');
    const far = body({ id: 'far', owner: 'far', box: { pos: { x: 5, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 } } });
    expect(checkContactClaims(body({}), far, true).map((v) => v.code)).toEqual(['sensor-without-contact']);
  });

  it('flags a collision box shorter than the drawn figure', () => {
    expect(checkColliderMatchesDrawing(body({}), 1.6).length).toBeGreaterThan(0);
  });
});
