import { describe, expect, it } from 'vitest';
import { getNodeDef } from '../../src/engine/registry';
import { canConnect } from '../../src/engine/wiring';
import { registerAllNodes } from '../../src/nodes';
import { level01 } from '../../src/puzzle/levels/level-01';
import { level02 } from '../../src/puzzle/levels/level-02';
import { level03 } from '../../src/puzzle/levels/level-03';
import { level04 } from '../../src/puzzle/levels/level-04';
import { buildPlayGraph, piecesUsed, runLevel, starsFor } from '../../src/puzzle/run-level';
import { isSceneryNode } from '../../src/puzzle/ui/board-state';
import type { PuzzleAnswer, PuzzleLevel } from '../../src/puzzle/types';
import { searchCheaperWins } from './fixtures/cheaper-win-search';

registerAllNodes();

const LEVELS = [level01, level02, level03, level04].map((l, i) => {
  if (!l) throw new Error(`level ${i + 1} is missing`);
  return l;
});
const EMPTY: PuzzleAnswer = { nodes: [], wires: [] };
const CONTROL_KINDS = ['key', 'stick'];

const without = (a: PuzzleAnswer, wireId: string): PuzzleAnswer => ({ ...a, wires: a.wires.filter((w) => w.id !== wireId) });
const withoutNode = (a: PuzzleAnswer, nodeId: string): PuzzleAnswer => ({
  nodes: a.nodes.filter((n) => n.id !== nodeId),
  wires: a.wires.filter((w) => w.from.node !== nodeId && w.to.node !== nodeId),
});

/** Tray kinds the reference solution leaves unused: the spare (decoy) pieces. */
const spareKinds = (level: PuzzleLevel): string[] =>
  level.tray.flatMap((t) => {
    const spare = t.count - level.solution.nodes.filter((n) => n.kind === t.kind).length;
    return spare > 0 ? [t.kind] : [];
  });

describe.each(LEVELS.map((l) => [l.order, l] as const))('puzzle level %i', (_order, level) => {
  it('has the expected id, order and one locked win-lose node', () => {
    expect(level.order).toBe(_order);
    expect(level.base.nodes.filter((n) => n.kind === 'win-lose')).toHaveLength(1);
    expect(level.task.length).toBeGreaterThan(10);
    expect(level.hint.length).toBeGreaterThan(10);
    expect(level.par).toBe(level.solution.nodes.length);
    expect(Number.isFinite(level.timeLimit)).toBe(true);
  });

  it('is won by the reference solution before the time limit', () => {
    const r = runLevel(level, level.solution);
    expect(r.outcome).toBe('win');
    expect(r.seconds).toBeLessThan(level.timeLimit);
  });

  it('is not won with nothing added', () => {
    expect(runLevel(level, EMPTY).outcome).not.toBe('win');
  });

  it('is not won when any single wire of the solution is removed', () => {
    for (const w of level.solution.wires) {
      expect(runLevel(level, without(level.solution, w.id)).outcome, `without wire ${w.id}`).not.toBe('win');
    }
  });

  it('is not won when any single placed piece is removed', () => {
    for (const n of level.solution.nodes) {
      expect(runLevel(level, withoutNode(level.solution, n.id)).outcome, `without piece ${n.id}`).not.toBe('win');
    }
  });

  it('only uses tray kinds within their counts', () => {
    for (const n of level.solution.nodes) {
      expect(getNodeDef(n.kind), `unknown kind ${n.kind}`).toBeDefined();
      expect(level.tray.some((t) => t.kind === n.kind), `${n.kind} not in tray`).toBe(true);
    }
    for (const t of level.tray) {
      const used = level.solution.nodes.filter((n) => n.kind === t.kind).length;
      expect(used).toBeLessThanOrEqual(t.count);
    }
  });

  it('solution ids do not clash with base and each wire joins existing nodes', () => {
    const baseIds = new Set(level.base.nodes.map((n) => n.id));
    for (const n of level.solution.nodes) expect(baseIds.has(n.id)).toBe(false);
    const all = new Set([...baseIds, ...level.solution.nodes.map((n) => n.id)]);
    for (const w of [...level.base.wires, ...level.solution.wires]) {
      expect(all.has(w.from.node) && w.from.node !== w.to.node && all.has(w.to.node), `wire ${w.id}`).toBe(true);
    }
  });

  it('every solution wire passes the real board connection rules, one after the other', () => {
    const placed: PuzzleAnswer['wires'] = [];
    for (const w of level.solution.wires) {
      const graph = buildPlayGraph(level, { nodes: level.solution.nodes, wires: placed });
      expect(canConnect(graph, w.from, w.to), `wire ${w.id}`).toEqual({ ok: true });
      placed.push(w);
    }
  });

  it('every solution wire touches only ports that are shown on locked nodes', () => {
    const placed = new Set(level.solution.nodes.map((n) => n.id));
    const shown = (nodeId: string, dir: 'in' | 'out', port: string): boolean => {
      const list = level.shownPorts?.[nodeId]?.[dir];
      if (list) return list.includes(port);
      // A locked node missing from shownPorts shows all its ports.
      return true;
    };
    for (const w of level.solution.wires) {
      if (!placed.has(w.from.node)) expect(shown(w.from.node, 'out', w.from.port), `${w.id} from ${w.from.node}.${w.from.port}`).toBe(true);
      if (!placed.has(w.to.node)) expect(shown(w.to.node, 'in', w.to.port), `${w.id} to ${w.to.node}.${w.to.port}`).toBe(true);
    }
  });

  it('has no key or stick nodes in base, tray or solution', () => {
    const kinds = [...level.base.nodes.map((n) => n.kind), ...level.tray.map((t) => t.kind), ...level.solution.nodes.map((n) => n.kind)];
    for (const k of CONTROL_KINDS) expect(kinds).not.toContain(k);
  });

  it('visible cards (the characters and objects the player wires to) do not overlap and sit in the left part of the board', () => {
    const CARD_W = 170;
    const visible = level.base.nodes.filter((n) => !isSceneryNode(level, n.id));
    const size = (id: string) => {
      const sp = level.shownPorts?.[id];
      return { w: CARD_W, h: 34 + 26 * ((sp?.in?.length ?? 0) + (sp?.out?.length ?? 0)) };
    };
    for (let i = 0; i < visible.length; i++) {
      const a = visible[i]!;
      const sa = size(a.id);
      expect(a.pos.x + sa.w, `${a.id} right edge`).toBeLessThanOrEqual(400);
      expect(a.pos.y + sa.h, `${a.id} bottom edge`).toBeLessThanOrEqual(560);
      for (let j = i + 1; j < visible.length; j++) {
        const b = visible[j]!;
        const sb = size(b.id);
        const hit = a.pos.x < b.pos.x + sb.w && b.pos.x < a.pos.x + sa.w && a.pos.y < b.pos.y + sb.h && b.pos.y < a.pos.y + sa.h;
        expect(hit, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it('the tray holds the solution pieces plus exactly one spare, and the spare gives no cheaper win', () => {
    const spares = spareKinds(level);
    const extra = level.tray.reduce((n, t) => n + t.count, 0) - level.solution.nodes.length;
    expect(extra).toBe(1);
    expect(spares).toHaveLength(1);
    const spare = spares[0] ? { id: 'spare', kind: spares[0], params: {}, pos: { x: 0, y: 0 } } : null;
    const result = searchCheaperWins(level, spare, level.timeLimit);
    // Level 3 has two known shortcut families (a touch signal also feeds the other star's "Ẩn đi"; the route's "Nhảy" pulse
    // while blocked by a star hides it); see the level 3 tests.
    const known = /^without p-touch\d( \+ spare)? \+ (p-touch\d\.(touching|began|ended)|p-route\.jump)>star-\d\.hide$/;
    const unexpected = level.id === 'nhat-sao' ? result.wins.filter((w) => !known.test(w)) : result.wins;
    expect(unexpected).toEqual([]);
    expect(result.tried).toBeGreaterThan(level.order === 1 ? 1 : 50);
  }, 300_000);

  it('an over-built answer with the spare piece still wins, but with 2 stars', () => {
    const kind = spareKinds(level)[0];
    if (!kind) return;
    const answer: PuzzleAnswer = {
      nodes: [...level.solution.nodes, { id: 'p-spare', kind, params: {}, pos: { x: 100, y: 100 } }],
      wires: level.solution.wires,
    };
    expect(piecesUsed(answer)).toBe(level.par + 1);
    expect(runLevel(level, answer).outcome).toBe('win');
    expect(starsFor(level, answer, 0)).toBe(2);
    expect(starsFor(level, level.solution, 0)).toBe(3);
  });

  it('the free hints scale with the wires the player joins', () => {
    expect(level.freeHints).toBeGreaterThanOrEqual(1);
    expect(level.freeHints).toBeLessThanOrEqual(Math.ceil(level.solution.wires.length / 2));
  });
});

describe('level 1 (bot-dau-tien)', () => {
  it('without the wire into the walking input of the bot it stands still', () => {
    expect(runLevel(level01!, without(level01!.solution, 's3')).outcome).toBe('timeout');
  });
  it('needs two pieces and four wires: the walk and the start signal that switches it on', () => {
    expect(level01!.par).toBe(2);
    expect(level01!.solution.wires).toHaveLength(4);
  });
});

describe('level 2 (cua-kho)', () => {
  const sol = level02!.solution;
  it('needs four pieces: walk, touch, memory switch, start', () => {
    expect(sol.nodes.map((n) => n.kind)).toEqual(['go-to', 'touch', 'latch', 'on-start']);
  });
  it('touch straight into the door signal opens it only while the bot stands on the button, so the bot gets stuck', () => {
    const noLatch: PuzzleAnswer = {
      nodes: sol.nodes.filter((n) => n.id !== 'p-latch'),
      wires: [...sol.wires.filter((w) => !w.to.node.includes('latch') && !w.from.node.includes('latch')), { id: 'x1', from: { node: 'p-touch', port: 'touching' }, to: { node: 'door', port: 'hiddenWhile' } }],
    };
    expect(runLevel(level02!, noLatch).outcome).toBe('timeout');
  });
  it('a latch wired from nothing never opens the door', () => {
    expect(runLevel(level02!, withoutNode(sol, 'p-touch')).outcome).toBe('timeout');
  });
});

describe('level 3 (nhat-sao)', () => {
  const sol = level03!.solution;
  const STAR_IDS = ['star-1', 'star-2'];
  it('has no editable settings: the player wires, nothing is typed in', () => {
    expect(level03!.editable ?? []).toEqual([]);
  });
  it('needs five pieces: walk, start, a touch per star and Và', () => {
    expect(sol.nodes.map((n) => n.kind).sort()).toEqual(['and', 'on-start', 'route-follow', 'touch', 'touch']);
    expect(level03!.par).toBe(5);
    expect(sol.wires).toHaveLength(12);
    expect(level03!.tray.map((t) => `${t.kind}x${t.count}`).sort()).toEqual(['andx2', 'on-startx1', 'route-followx1', 'touchx2']);
  });
  it('the board shows only the cat, the two stars and the gate; each star takes "Ẩn đi" and gives "Đang ẩn"', () => {
    const hidden = level03!.base.nodes.filter((n) => isSceneryNode(level03!, n.id)).map((n) => n.id).sort();
    expect(hidden).toEqual(['end', 'goal', 'ground', 'touch-goal']);
    for (const id of STAR_IDS) {
      expect(level03!.shownPorts![id]).toEqual({ in: ['hide'], out: ['self', 'hidden'] });
      expect(level03!.base.nodes.find((n) => n.id === id)!.params.showHiddenOut).toBe('yes');
    }
    expect(level03!.base.nodes.some((n) => n.id === 'star-3')).toBe(false);
    expect(level03!.base.wires.some((w) => STAR_IDS.includes(w.from.node) || STAR_IDS.includes(w.to.node))).toBe(false);
  });
  it('the walk holds no star position: all its points lie beyond the gate', () => {
    const route = level03!.tray.find((t) => t.kind === 'route-follow');
    const gateX = (level03!.base.nodes.find((n) => n.id === 'gate')!.params.position as { x: number }).x;
    const count = Number(route?.params?.count);
    expect(count).toBeGreaterThanOrEqual(2);
    for (let k = 1; k <= count; k++) expect((route!.params![`p${k}`] as { x: number }).x).toBeGreaterThan(gateX);
  });
  it('the cat cannot reach the goal on its own: the gate blocks it', () => {
    expect(runLevel(level03!, { nodes: sol.nodes.filter((n) => n.kind === 'route-follow' || n.kind === 'on-start'), wires: sol.wires.filter((w) => ['s1', 's2', 's3'].includes(w.id)) }).outcome).toBe('timeout');
  });
  it.each([1, 2])('star %i: without its touch wires, hide wire, report wire or touch piece the gate stays shut', (k) => {
    for (const id of [`t${k}a`, `t${k}b`, `h${k}`, `g${k}`]) expect(runLevel(level03!, without(sol, id)).outcome, `without ${id}`).toBe('timeout');
    expect(runLevel(level03!, withoutNode(sol, `p-touch${k}`)).outcome).toBe('timeout');
  });
  it('stars are solid: without a hide wire the cat is stopped in front of that star and never wins', () => {
    for (const id of STAR_IDS) expect(level03!.base.nodes.find((n) => n.id === id)!.params.type).toBe('solid');
    for (const k of [1, 2]) expect(runLevel(level03!, without(sol, `h${k}`)).outcome, `without h${k}`).toBe('timeout');
  });
  it('a star alone cannot open the gate: its "Đang ẩn" straight into the gate does not win', () => {
    const direct: PuzzleAnswer = {
      nodes: sol.nodes.filter((n) => n.id === 'p-start' || n.id === 'p-route' || n.id === 'p-touch1'),
      wires: [...sol.wires.filter((w) => ['s1', 's2', 's3', 't1a', 't1b', 'h1'].includes(w.id)), { id: 'x', from: { node: 'star-1', port: 'hidden' }, to: { node: 'gate', port: 'hiddenWhile' } }],
    };
    expect(runLevel(level03!, direct).outcome).toBe('timeout');
  });
  it('known shortcuts (a signal can feed more than one input): one touch hides both stars; the route "Nhảy" pulse can stand in for a touch', () => {
    const fan: PuzzleAnswer = {
      nodes: sol.nodes.filter((n) => n.id !== 'p-touch2'),
      wires: [...sol.wires.filter((w) => !['t2a', 't2b', 'h2'].includes(w.id)), { id: 'x', from: { node: 'p-touch1', port: 'began' }, to: { node: 'star-2', port: 'hide' } }],
    };
    expect(runLevel(level03!, fan).outcome).toBe('win');
    const jump: PuzzleAnswer = {
      nodes: sol.nodes.filter((n) => n.id !== 'p-touch2'),
      wires: [...sol.wires.filter((w) => !['t2a', 't2b', 'h2'].includes(w.id)), { id: 'x', from: { node: 'p-route', port: 'jump' }, to: { node: 'star-2', port: 'hide' } }],
    };
    expect(runLevel(level03!, jump).outcome).toBe('win');
  });
  it.each(STAR_IDS)('%s: taking the star out of the world means the gate never opens', (id) => {
    const level: PuzzleLevel = { ...level03!, base: { ...level03!.base, nodes: level03!.base.nodes.filter((n) => n.id !== id) } };
    const answer: PuzzleAnswer = { nodes: sol.nodes, wires: sol.wires.filter((w) => w.from.node !== id && w.to.node !== id) };
    expect(runLevel(level, answer).outcome).toBe('timeout');
  });
});

describe('level 4 (hai-nut-mot-cua)', () => {
  const sol = level04!.solution;
  it('needs the walk of both bots, one touch sensor and Hoặc', () => {
    expect(sol.nodes.map((n) => n.kind).sort()).toEqual(['go-to', 'go-to', 'or', 'touch']);
    expect(level04!.par).toBe(4);
  });
  it('one signal alone is not enough: a robot is left behind', () => {
    expect(runLevel(level04!, without(sol, 's10')).outcome).toBe('timeout');
    expect(runLevel(level04!, without(sol, 's11')).outcome).toBe('timeout');
  });
  it('bot A must wait for bot B: without the "Bật" wire A leaves its button and the door shuts', () => {
    expect(runLevel(level04!, without(sol, 's7')).outcome).toBe('timeout');
  });
  it('both robots are locked with the approved looks', () => {
    expect(level04!.base.nodes.filter((n) => n.kind === 'character').map((n) => n.params.look)).toEqual(['robot-legs', 'robot-wheel']);
  });
  it('the door is wired only through its hidden-while input', () => {
    expect(level04!.shownPorts!.door).toEqual({ in: ['hiddenWhile'], out: [] });
    expect(sol.wires.some((w) => w.to.node === 'door' && w.to.port === 'hiddenWhile')).toBe(true);
  });
  it('bot A is the one standing on button 1 at the start', () => {
    const a = level04!.base.nodes.find((n) => n.id === 'bot-a')!.params.position as { x: number };
    const b1 = level04!.base.nodes.find((n) => n.id === 'button-a')!.params.position as { x: number };
    expect(a.x).toBe(b1.x);
  });
  it('the second touch sensor can stand in for "Đã đến" but then the answer costs a piece more', () => {
    const swapped: PuzzleAnswer = {
      nodes: [...sol.nodes, { id: 'p-touch2', kind: 'touch', params: {}, pos: { x: 100, y: 100 } }],
      wires: [
        ...sol.wires.filter((w) => w.id !== 's11'),
        { id: 'x1', from: { node: 'bot-b', port: 'self' }, to: { node: 'p-touch2', port: 'a' } },
        { id: 'x2', from: { node: 'button-b', port: 'self' }, to: { node: 'p-touch2', port: 'b' } },
        { id: 'x3', from: { node: 'p-touch2', port: 'touching' }, to: { node: 'p-or', port: 'b' } },
      ],
    };
    expect(runLevel(level04!, swapped).outcome).toBe('win');
    expect(starsFor(level04!, swapped, 0)).toBe(2);
  });
});
