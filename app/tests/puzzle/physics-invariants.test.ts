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
  gap,
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
  const solidBodies = true;
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
  it.each(LEVELS)('level $order: character collision boxes match the $id drawing', (level) => {
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

describe('physics invariants: crates are set down and lifted, never teleported', () => {
  /** Plays the reference solution and watches every item tick by tick. */
  function watchItems(level: PuzzleLevel): { releases: number; grabs: number; worstReleaseShift: number; worstStep: number; worstGrabStep: number } {
    const last = new Map<string, { x: number; y: number; z: number; carried: boolean }>();
    const out = { releases: 0, grabs: 0, worstReleaseShift: 0, worstStep: 0, worstGrabStep: 0 };
    runLevel(level, level.solution, level.timeLimit, (world) => {
      for (const b of world.debugBodies?.() ?? []) {
        if (b.kind !== 'item') continue;
        const prev = last.get(b.owner);
        if (prev) {
          const flat = Math.hypot(b.pos.x - prev.x, b.pos.z - prev.z);
          const full = Math.hypot(flat, b.pos.y - prev.y);
          out.worstStep = Math.max(out.worstStep, full);
          if (prev.carried && !b.carried) {
            out.releases++;
            out.worstReleaseShift = Math.max(out.worstReleaseShift, flat);
          }
          if (!prev.carried && b.carried) {
            out.grabs++;
            out.worstGrabStep = Math.max(out.worstGrabStep, full);
          }
        }
        last.set(b.owner, { x: b.pos.x, y: b.pos.y, z: b.pos.z, carried: !!b.carried });
      }
    });
    return out;
  }

  it.each(LEVELS.filter((l) => l.mode === '3d' && l.order !== 6))('level $order $id: a released crate stays where the hands were, and no crate jumps', (level) => {
    const r = watchItems(level);
    expect(r.releases).toBeGreaterThan(0);
    // The crate is let go in place (it only falls); a hair of slack for the tick it is released on.
    expect(r.worstReleaseShift).toBeLessThan(0.02);
    // The lift into the hands and the fall are both gradual: no crate moves more than a third of a unit in one tick.
    expect(r.worstStep).toBeLessThan(0.3);
    expect(r.worstGrabStep).toBeLessThan(0.3);
  });
});

describe('physics invariants: doors really block and really let through', () => {
  /** A door is any solid block that is hidden at some moment of the run. */
  function watchDoors(level: PuzzleLevel, answer: PuzzleAnswer): { crossedClosed: string[]; crossedOpen: Set<string>; doors: Set<string> } {
    const out = { crossedClosed: [] as string[], crossedOpen: new Set<string>(), doors: new Set<string>() };
    const prev = new Map<string, { side: number; doorShown: boolean }>();
    const everHidden = new Set<string>();
    runLevel(level, answer, level.timeLimit, (world, tick) => {
      const bodies = world.debugBodies?.() ?? [];
      for (const d of bodies) if (d.kind === 'block' && d.solid && !d.visible) everHidden.add(d.owner);
      for (const d of bodies) {
        if (d.kind !== 'block' || !d.solid || !everHidden.has(d.owner)) continue;
        out.doors.add(d.owner);
        // The door is a wall across the walking line: its thin axis says which way people cross it.
        const axis = d.box.size.x <= d.box.size.z ? 'x' : 'z';
        for (const c of bodies) {
          if (c.kind !== 'character' || !c.visible || c.seated) continue;
          const key = `${d.owner}|${c.owner}`;
          const side = Math.sign(c.box.pos[axis] - d.box.pos[axis]);
          const before = prev.get(key);
          if (before && before.side !== 0 && side !== 0 && side !== before.side) {
            if (before.doorShown && d.visible) out.crossedClosed.push(`${c.owner} crossed shut ${d.owner} at t=${(tick / 60).toFixed(2)}s`);
            else out.crossedOpen.add(`${c.owner}|${d.owner}`);
          }
          prev.set(key, { side: side !== 0 ? side : before?.side ?? 0, doorShown: d.visible });
        }
      }
    });
    return out;
  }

  it.each(LEVELS)('level $order $id: nobody crosses a door while it is shut (any answer)', (level) => {
    for (const { name, answer } of answersFor(level)) {
      expect(watchDoors(level, answer).crossedClosed, name).toEqual([]);
    }
  });

  it.each(LEVELS.filter((l) => ['cua-kho', 'nhat-sao', 'hai-nut-mot-cua'].includes(l.id)))('level $order $id: the solution walks through the open door', (level) => {
    const r = watchDoors(level, level.solution);
    expect(r.doors.size).toBeGreaterThan(0);
    expect(r.crossedOpen.size).toBeGreaterThan(0);
  });
});

describe('physics invariants: a win comes for the stated reason', () => {
  const by = (bodies: BodySnapshot[], owner: string): BodySnapshot => {
    const b = bodies.find((x) => x.owner === owner);
    if (!b) throw new Error(`no body ${owner}`);
    return b;
  };
  const touching = (bodies: BodySnapshot[], a: string, b: string): boolean => gap(by(bodies, a), by(bodies, b)) <= 0.02;
  const insideZone = (b: BodySnapshot, c: { x: number; z: number }, s: { x: number; z: number }): boolean => Math.abs(b.pos.x - c.x) <= s.x / 2 && Math.abs(b.pos.z - c.z) <= s.z / 2;

  /** For each level: what must be true of the world on the tick the game was won. */
  const PROOFS: Record<string, (bodies: BodySnapshot[], level: PuzzleLevel) => string[]> = {
    'bot-dau-tien': (b) => (touching(b, 'bot', 'flag') ? [] : ['bot is not at the flag']),
    'cua-kho': (b) => {
      const bad: string[] = [];
      if (!touching(b, 'bot', 'flag')) bad.push('bot is not at the flag');
      if (by(b, 'bot').pos.x < by(b, 'door').pos.x) bad.push('bot is still before the door');
      return bad;
    },
    'nhat-sao': (b) => {
      const bad: string[] = [];
      if (!touching(b, 'cat', 'goal')) bad.push('cat is not at the flag');
      for (const s of ['star-1', 'star-2', 'star-3']) if (by(b, s).visible) bad.push(`${s} is still there`);
      if (by(b, 'cat').pos.x < by(b, 'gate').pos.x) bad.push('cat is still before the gate');
      return bad;
    },
    'hai-nut-mot-cua': (b) => {
      const bad: string[] = [];
      const door = by(b, 'door').pos.x;
      if (!touching(b, 'bot-a', 'flag')) bad.push('bot A is not at the flag');
      if (!touching(b, 'bot-b', 'button-b')) bad.push('bot B is not on button 2');
      for (const bot of ['bot-a', 'bot-b']) if (by(b, bot).pos.x < door) bad.push(`${bot} is still before the door`);
      if (by(b, 'bot-a').pos.x > by(b, 'bot-b').pos.x) bad.push('bot A got past bot B');
      return bad;
    },
    'du-ba-thung': (b, level) => {
      const zone = level.solution.nodes.find((n) => n.kind === 'zone')!;
      const c = zone.params.center as { x: number; z: number };
      const s = zone.params.size as { x: number; z: number };
      const crates = b.filter((x) => x.kind === 'item');
      const rest = crates.filter((x) => !x.carried && insideZone(x, c, s));
      return rest.length === 3 ? [] : [`${rest.length} crates resting in the store`];
    },
    'ne-linh-gac': (b) => {
      const bad: string[] = [];
      if (Math.hypot(by(b, 'hero').pos.x - by(b, 'goal').pos.x, by(b, 'hero').pos.z - by(b, 'goal').pos.z) > 1.6) bad.push('hero is not on the green tile');
      if (gap(by(b, 'hero'), by(b, 'guard')) <= 0.02) bad.push('hero is touching the guard');
      return bad;
    },
    'phan-loai-mau': (b) => {
      const c = { x: -10.7, z: 0 };
      const s = { x: 5.6, z: 2 };
      const inStore = b.filter((x) => x.kind === 'item' && !x.carried && insideZone(x, c, s)).map((x) => x.owner).sort();
      return inStore.join() === 'crate-2,crate-4,crate-6' ? [] : [`store holds ${inStore.join() || 'nothing'}, expected the three blue crates only`];
    },
  };

  it.each(LEVELS)('level $order $id: the world matches the win message', (level) => {
    const proof = PROOFS[level.id];
    expect(proof, `no proof written for ${level.id}`).toBeDefined();
    const r = playAndCheck(level, level.solution);
    expect(r.outcome).toBe('win');
    expect(proof!(r.last, level)).toEqual([]);
  });

  it.each(LEVELS)('level $order $id: the reference solution wins with time to spare', (level) => {
    const r = runLevel(level, level.solution);
    expect(r.outcome).toBe('win');
    expect(r.seconds).toBeLessThan(level.timeLimit * 0.75);
  });
});

describe('physics invariants: a loss comes for the stated reason', () => {
  const find = (bodies: BodySnapshot[], owner: string): BodySnapshot => bodies.find((x) => x.owner === owner)!;

  it.each(LEVELS.filter((l) => ['ne-linh-gac'].includes(l.id)))('level $order $id: every lost run ends with the guard really touching the cat', (level) => {
    let lost = 0;
    for (const { name, answer } of answersFor(level)) {
      const r = playAndCheck(level, answer);
      if (r.outcome !== 'lose') continue;
      lost++;
      expect(gap(find(r.last, 'hero'), find(r.last, 'guard')), name).toBeLessThanOrEqual(0.02);
    }
    expect(lost).toBeGreaterThan(0);
  });

  it('level 7: every lost run ends with a red crate resting in the store', () => {
    const level = LEVELS.find((l) => l.id === 'phan-loai-mau')!;
    let lost = 0;
    for (const { name, answer } of answersFor(level)) {
      const r = playAndCheck(level, answer);
      if (r.outcome !== 'lose') continue;
      lost++;
      const red = r.last.filter(
        (b) => ['crate-1', 'crate-3', 'crate-5'].includes(b.owner) && !b.carried && Math.abs(b.pos.x + 10.7) <= 2.8 && Math.abs(b.pos.z) <= 1,
      );
      expect(red.length, name).toBeGreaterThan(0);
    }
    expect(lost).toBeGreaterThan(0);
  });
});
