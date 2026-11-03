import { describe, expect, it } from 'vitest';
import { registerAllNodes } from '../../src/nodes';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { starsFor } from '../../src/puzzle/run-level';
import { EMPTY_BOARD, placePiece } from '../../src/puzzle/ui/board-state';
import {
  hasSeenGuide,
  hasSeenIntro,
  hintLineOf,
  isGuideForced,
  markGuideSeen,
  markIntroSeen,
  buildGuideSteps,
  newPieceIntros,
  nextHintStep,
  solutionSteps,
  stepKey,
} from '../../src/puzzle/ui/guide-script';
import { countHint, extraHints, hintBadge, hintsLeft } from '../../src/puzzle/ui/hint-rules';

registerAllNodes();

const lv = (order: number) => {
  const l = PUZZLE_LEVELS.find((x) => x.order === order);
  if (!l) throw new Error(`no level ${order}`);
  return l;
};

function memory(): Pick<Storage, 'getItem' | 'setItem'> {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe('hint counter and badge', () => {
  it('counts down the free hints, then turns costly', () => {
    const l3 = lv(3); // 2 free hints
    expect(hintBadge(l3, 0)).toEqual({ left: 2, costly: false });
    expect(hintBadge(l3, 1)).toEqual({ left: 1, costly: false });
    expect(hintBadge(l3, 2)).toEqual({ left: 0, costly: true });
    expect(hintBadge(l3, 5)).toEqual({ left: 0, costly: true });
    expect(hintsLeft(l3, 9)).toBe(0);
    expect(extraHints(l3, 2)).toBe(0);
    expect(extraHints(l3, 3)).toBe(1);
  });

  it('level 1 has no free hint, so its badge is costly from the start', () => {
    expect(hintBadge(lv(1), 0).costly).toBe(true);
  });

  it('three presses on level 3 leave 2 stars for a par solution; no hints on level 6 keep 3', () => {
    expect(starsFor(lv(3), lv(3).solution, 3)).toBe(2);
    expect(starsFor(lv(6), lv(6).solution, 0)).toBe(3);
  });
});

describe('counting each revealed step once', () => {
  it('counts a step the first time only, and ignores "nothing revealed"', () => {
    const seen = new Set<string>();
    expect(countHint(seen, 'wire:s1')).toBe(true);
    expect(countHint(seen, 'wire:s1')).toBe(false);
    expect(countHint(seen, 'wire:s2')).toBe(true);
    expect(countHint(seen, null)).toBe(false);
    expect(seen.size).toBe(2);
  });

  it('a repeated press on the same step keeps the badge where it was', () => {
    const l = lv(3); // 2 free hints
    const seen = new Set<string>();
    let used = 0;
    const press = (key: string | null): void => {
      if (countHint(seen, key)) used++;
    };
    press('piece:a');
    press('piece:a');
    press('piece:a');
    expect(hintBadge(l, used)).toEqual({ left: 1, costly: false });
    press('piece:b');
    expect(hintBadge(l, used).costly).toBe(true);
  });

  it('gives every solution step its own key, stable across board states', () => {
    for (const level of PUZZLE_LEVELS) {
      const keys = solutionSteps(level).map(stepKey);
      expect(keys.every((k) => typeof k === 'string')).toBe(true);
      expect(new Set(keys).size).toBe(keys.length);
    }
    const first = nextHintStep(lv(2), EMPTY_BOARD);
    expect(first && stepKey(first)).toBe(first && stepKey({ ...first }));
    expect(stepKey({ type: 'run', text: 'x' })).toBeNull();
  });
});

describe('one-step reveal', () => {
  it('picks the first undone step and moves on as the board fills', () => {
    const l = lv(2);
    const all = solutionSteps(l);
    const first = nextHintStep(l, EMPTY_BOARD);
    expect(first).toEqual(all[0]);
    expect(first?.type).toBe('piece');
    if (first?.type !== 'piece') return;
    const placed = placePiece(l, EMPTY_BOARD, first.slot, { x: 0, y: 0 });
    expect(placed).not.toBeNull();
    if (!placed) return;
    expect(nextHintStep(l, placed)).toEqual(all[1]);
  });

  it('returns null once every step is done', () => {
    const l = lv(1);
    let state = EMPTY_BOARD;
    for (const step of solutionSteps(l)) {
      if (step.type === 'piece') state = placePiece(l, state, step.slot, { x: 0, y: 0 }) ?? state;
    }
    // pieces are placed, so only wires remain: the next step is a wire
    expect(nextHintStep(l, state)?.type).toBe('wire');
  });

  it('says a short line for a piece step', () => {
    const step = nextHintStep(lv(2), EMPTY_BOARD);
    expect(step && hintLineOf(step)).toMatch(/^Lấy mảnh .+ ra bàn\.$/);
  });
});

describe('new-piece intros', () => {
  it('has none on level 1 and names each unseen kind once on later levels', () => {
    expect(newPieceIntros(lv(1))).toEqual([]);
    const l2 = newPieceIntros(lv(2));
    expect(l2.length).toBeGreaterThan(0);
    // a kind introduced on level 2 is not introduced again on level 3
    const l3 = newPieceIntros(lv(3));
    expect(l3.every((t) => !l2.includes(t))).toBe(true);
    for (let o = 2; o <= 7; o++) for (const t of newPieceIntros(lv(o))) expect(t.split(/\s+/).length).toBeLessThanOrEqual(14);
  });

  it('is remembered per level, apart from the level 1 guide mark', () => {
    const s = memory();
    expect(hasSeenIntro('cua-kho', s)).toBe(false);
    markIntroSeen('cua-kho', s);
    expect(hasSeenIntro('cua-kho', s)).toBe(true);
    expect(hasSeenIntro('nhat-sao', s)).toBe(false);
    expect(hasSeenGuide('cua-kho', s)).toBe(false);
  });
});

describe('levels 1, 5 and 7 forced guide', () => {
  it('is forced until the guide is marked seen, and only on levels 1, 5 and 7', () => {
    const s = memory();
    expect(isGuideForced(lv(1), s)).toBe(true);
    expect(isGuideForced(lv(5), s)).toBe(true);
    expect(isGuideForced(lv(7), s)).toBe(true);
    expect(isGuideForced(lv(2), s)).toBe(false);
    markGuideSeen(lv(1).id, s);
    expect(isGuideForced(lv(1), s)).toBe(false);
    expect(isGuideForced(lv(5), s)).toBe(true);
    markGuideSeen(lv(5).id, s);
    expect(isGuideForced(lv(5), s)).toBe(false);
    expect(isGuideForced(lv(7), s)).toBe(true);
    markGuideSeen(lv(7).id, s);
    expect(isGuideForced(lv(7), s)).toBe(false);
  });

  it('level 7 leads with a cat intro and a hand-written line per solution wire', () => {
    const steps = buildGuideSteps(lv(7));
    expect(steps[0]?.type).toBe('intro');
    const wires = steps.filter((x) => x.type === 'wire');
    expect(wires).toHaveLength(lv(7).solution.wires.length);
    for (const w of wires) expect(w.text).not.toContain('(');
    expect(lv(7).freeHints).toBe(7);
  });

  it('level 5 has the cat intro and a friendly line per solution wire, and no tips on top of the guide', () => {
    const steps = buildGuideSteps(lv(5));
    expect(steps[0]?.type).toBe('intro');
    expect(steps[0]?.text).toMatch(/3D/);
    const wires = steps.filter((x) => x.type === 'wire');
    expect(wires).toHaveLength(lv(5).solution.wires.length);
    for (const w of wires) expect(w.text).not.toContain('('); // hand-written lines, not the generated "A (port) with B (port)" form
  });
});
