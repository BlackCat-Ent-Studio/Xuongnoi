import { beforeAll, describe, expect, it } from 'vitest';
import { listSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { AUTO_ARM, AUTO_ARM_WIRES } from '../../src/samples/auto-arm-board';
import type { Board } from '../../src/engine/types';
import { firstCardOverlap, without } from '../helpers/cell-run';
import { loadEngine, playReal as play } from '../helpers/cell-run-real';

beforeAll(async () => {
  registerAllNodes();
  await loadEngine();
});

const sample = (): Board => structuredClone(listSamples().find((s) => s.id === 'auto-arm')!.board);

const KEYS_OR_BUTTONS = new Set(['key', 'stick', 'ui-button', 'ui-start', 'ui-pick', 'ui-dialog']);
/** Time limit of the runs (s): the first crate arrives after about 10 s, then one is placed about every 8 s. */
const LIMIT_S = 60;
const SHORT_LIMIT_S = 60;
const LONG_S = 300;

interface Result {
  /** Crates the spawner made. */
  spawned: number;
  placed: number;
  slipped: number;
  crushed: number;
  /** Peak load of the shoulder (N·m) and whether any joint reported overload. */
  peakLoad: number;
  overloaded: boolean;
  /** Crates that lay on the floor away from the belts at some moment (dropped by accident). */
  strayed: number;
  /** Crates that got to the far side of the arm (x < -0.7): moved by the arm, counter or not. */
  moved: number;
  /** Crates that went beyond the blue pad (past its edge or off its sides): thrown away instead of placed. */
  lost: number;
  /** Most crates alive at once, and the longest time (s) between two placements (the cell never blocks). */
  maxAlive: number;
  longestGapS: number;
  /** Fragile crates (a crush limit) the spawner made. */
  fragileSeen: number;
}

/** `id` maps the sample's card ids to the ids of a renamed copy of the board. */
function run(board: Board, seconds = LIMIT_S, id: (name: string) => string = (n) => n): Result {
  const p = play(board);
  let peakLoad = 0;
  let overloaded = false;
  let maxAlive = 0;
  let lastPlaced = 0;
  let lastPlacedAt = 0;
  let longestGap = 0;
  const seen = new Set<string>();
  const strayedIds = new Set<string>();
  const movedIds = new Set<string>();
  const lostIds = new Set<string>();
  const fragileIds = new Set<string>();
  p.watch(seconds, (t) => {
    peakLoad = Math.max(peakLoad, p.out(id('shoulder'), 'load') as number);
    if (p.out(id('shoulder'), 'overloaded') === true || p.out(id('elbow'), 'overloaded') === true || p.out(id('swing'), 'overloaded') === true) overloaded = true;
    const placed = p.out(id('placed'), 'value') as number;
    if (placed > lastPlaced) {
      longestGap = Math.max(longestGap, t - lastPlacedAt);
      lastPlaced = placed;
      lastPlacedAt = t;
    }
    let alive = 0;
    for (const e of p.world.entities()) {
      if (e.ownerNodeId !== id('maker')) continue;
      alive++;
      if (!seen.has(e.id)) {
        seen.add(e.id);
        if (p.world.materialOf(e.id)!.crushLimitN > 0) fragileIds.add(e.id);
      }
      // The place belt ends at x = -7; crates that fall off its end into the blue pad are not strays.
      if (e.position.y < 0.5 && e.position.x > -6.9 && e.position.x < 8) strayedIds.add(e.id);
      if (e.position.x < -0.7) movedIds.add(e.id);
      // The blue pad spans x -10 to -7 and z -1.5 to 1.5.
      if (e.position.x < -10.1 || Math.abs(e.position.z) > 1.6 || e.position.y < 0.3) lostIds.add(e.id);
    }
    maxAlive = Math.max(maxAlive, alive);
  });
  longestGap = Math.max(longestGap, seconds - lastPlacedAt);
  return {
    spawned: seen.size,
    placed: lastPlaced,
    slipped: p.out(id('slips'), 'value') as number,
    crushed: p.out(id('crushes'), 'value') as number,
    peakLoad,
    overloaded,
    strayed: strayedIds.size,
    moved: movedIds.size,
    lost: lostIds.size,
    maxAlive,
    longestGapS: longestGap,
    fragileSeen: fragileIds.size,
  };
}

const withForce = (n: number): Board => {
  const b = sample();
  b.graph.nodes.find((x) => x.id === 'grip-force')!.params.value = n;
  return b;
};

/** A copy of the board with every card id changed by `f` (wires follow). */
function renamed(board: Board, f: (id: string) => string): Board {
  const b = structuredClone(board);
  for (const n of b.graph.nodes) n.id = f(n.id);
  for (const w of b.graph.wires) {
    w.from.node = f(w.from.node);
    w.to.node = f(w.to.node);
  }
  return b;
}

describe('sample Tay máy tự gắp và đặt', () => {
  it('is an automated 3D machine of palette pieces: no keys or buttons, a floor, a camera, readouts, notes', () => {
    const b = sample();
    expect(b.mode).toBe('3d');
    for (const n of b.graph.nodes) expect(KEYS_OR_BUTTONS.has(n.kind), n.kind).toBe(false);
    const kinds = new Set(b.graph.nodes.map((n) => n.kind));
    for (const k of ['camera', 'sequence', 'joint', 'link', 'gripper', 'spawner', 'random', 'counter', 'value-table', 'timer', 'show-number', 'show-text']) expect(kinds.has(k), k).toBe(true);
    expect(b.graph.nodes.find((n) => n.id === 'floor')?.kind).toBe('block');
    // Crates are made while it runs (none is placed by hand); the dice and a table decide which are fragile.
    expect(b.graph.nodes.filter((n) => n.kind === 'item')).toHaveLength(0);
    expect(b.graph.nodes.find((n) => n.id === 'maker')!.params.wireMaterial).toBe('yes');
    expect(Number(b.graph.nodes.find((n) => n.id === 'tbl-fragile')!.params.v3)).toBe(AUTO_ARM.fragileLimitN);
    // The taught angles are three tables, not ramps; the steps end through their own ports, not a gate.
    for (const gone of ['map-range', 'select-number', 'math']) expect(kinds.has(gone), gone).toBe(false);
    expect(b.graph.nodes.filter((n) => n.kind === 'value-table').map((n) => n.id).sort()).toEqual(['tbl-elbow', 'tbl-fragile', 'tbl-shoulder', 'tbl-swing']);
    expect(b.graph.nodes.find((n) => n.id === 'a-cycle')!.params.showDone).toBe('yes');
    expect(b.graph.wires.some((w) => w.to.node === 'a-cycle' && w.to.port === 'next')).toBe(false);
    // The gripper takes only what lies between its fingers, set on the card (not left to an old-board default).
    expect(b.graph.nodes.find((n) => n.id === 'gripper')!.params.grip).toBe('between');
    expect(b.graph.nodes.some((n) => n.id === 'stopper')).toBe(false);
    expect((b.notes ?? []).length).toBeGreaterThanOrEqual(3);
    expect(firstCardOverlap(b)).toBeNull();
    expect(listSamples().find((s) => s.id === 'auto-arm')!.label).not.toMatch(/game/i);
  });

  it('at the shipped force it places every crate, none slipped, none crushed, joints never overloaded', { timeout: 120_000 }, () => {
    expect(AUTO_ARM.gripForceN).toBeGreaterThan(AUTO_ARM.holdThresholdN);
    expect(AUTO_ARM.gripForceN * 2).toBeLessThan(AUTO_ARM.fragileLimitN);
    const r = run(sample());
    // Everything that had time to arrive was placed (the last ones are still on the way in).
    expect(r.placed).toBeGreaterThanOrEqual(4);
    expect(r.placed).toBeGreaterThanOrEqual(r.spawned - 3);
    expect(r.moved).toBeGreaterThanOrEqual(r.placed);
    expect(r.slipped).toBe(0);
    expect(r.crushed).toBe(0);
    expect(r.overloaded).toBe(false);
    expect(r.peakLoad).toBeLessThan(140);
    expect(r.strayed).toBe(0);
    expect(r.lost).toBe(0);
  });

  it('runs on "Vật lý thật" for five minutes and never stops: every crate that arrived is placed, none dropped or crushed, no joint overloaded, the cell never blocks', { timeout: 300_000 }, () => {
    const b = sample();
    expect(b.graph.settings?.realPhysics).toBe(true);
    expect(b.graph.settings?.gravity).toBeUndefined();
    const r = run(b, LONG_S);
    expect(r.spawned).toBeGreaterThanOrEqual(Math.floor(LONG_S / AUTO_ARM.spawnEveryS) - 1);
    expect(r.fragileSeen).toBeGreaterThanOrEqual(3);
    expect(r.placed).toBeGreaterThanOrEqual(r.spawned - 3);
    expect(r.slipped).toBe(0);
    expect(r.crushed).toBe(0);
    expect(r.overloaded).toBe(false);
    expect(r.lost).toBe(0);
    expect(r.strayed).toBe(0);
    // Crates vanish after their life, so the pad never fills; one is placed about every spawn period, none waits long.
    expect(r.maxAlive).toBeLessThanOrEqual(8);
    expect(r.longestGapS).toBeLessThan(2 * AUTO_ARM.spawnEveryS + 6);
    // Real loads: well inside the joints' own limits (shoulder 140 N m).
    expect(r.peakLoad).toBeGreaterThan(20);
    expect(r.peakLoad).toBeLessThan(140);
  });

  it('the arm has to lower onto the crate: at the hover pose a waiting crate is not between the fingers, at the grab the shoulder is down', { timeout: 60_000 }, () => {
    const p = play(sample());
    let waitingTicks = 0;
    let reachWhileHovering = 0;
    let grabShoulder: number | null = null;
    p.watch(25, () => {
      const step = p.out('a-cycle', 'index');
      // Step 2 ("lower") starts the moment the crate is at the pick point; while the shoulder is still near the hover angle the crate must not be between the fingers.
      if (step === 2 && p.out('pick', 'inside') === true && (p.out('shoulder', 'angleNow') as number) > AUTO_ARM.hover[0] - 5) {
        waitingTicks++;
        if (p.out('gripper', 'inReach') === true) reachWhileHovering++;
      }
      if (step === 3 && grabShoulder === null) grabShoulder = p.out('shoulder', 'angleNow') as number;
    });
    expect(waitingTicks).toBeGreaterThan(0);
    expect(reachWhileHovering).toBe(0);
    expect(grabShoulder).not.toBeNull();
    // Lowered by at least 15 degrees of the 29 between the hover and the lowered pose.
    expect(AUTO_ARM.hover[0] - grabShoulder!).toBeGreaterThan(15);
  });

  it('the steps do not depend on card ids or card order: renamed or reordered copies place the same crates', { timeout: 300_000 }, () => {
    const base = run(sample(), SHORT_LIMIT_S);
    expect(base.placed).toBeGreaterThanOrEqual(4);
    const variants: [string, (b: Board) => Board, (n: string) => string][] = [
      ['prefix a', (b) => renamed(b, (i) => `a-${i}`), (n) => `a-${n}`],
      ['prefix z', (b) => renamed(b, (i) => `z-${i}`), (n) => `z-${n}`],
      [
        'sequence last, tables and joints first',
        (b) => renamed(b, (i) => (i === 'a-cycle' ? 'zzz-cycle' : i.startsWith('tbl-') || ['swing', 'shoulder', 'elbow'].includes(i) ? `0-${i}` : i)),
        (n) => (n === 'a-cycle' ? 'zzz-cycle' : n.startsWith('tbl-') || ['swing', 'shoulder', 'elbow'].includes(n) ? `0-${n}` : n),
      ],
      [
        'cards listed in reverse',
        (b) => {
          const c = structuredClone(b);
          c.graph.nodes.reverse();
          return c;
        },
        (n) => n,
      ],
    ];
    for (const [name, make, id] of variants) {
      const r = run(make(sample()), SHORT_LIMIT_S, id);
      expect(r.placed, name).toBe(base.placed);
      expect(r.spawned, name).toBe(base.spawned);
      expect(r.slipped, name).toBe(0);
      expect(r.crushed, name).toBe(0);
    }
  });

  it('below the hold threshold (19.62 N) crates slip and none is placed', { timeout: 120_000 }, () => {
    const r = run(withForce(AUTO_ARM.holdThresholdN - 3));
    expect(r.slipped).toBeGreaterThanOrEqual(1);
    expect(r.placed).toBe(0);
    // Just above the threshold it holds again.
    const ok = run(withForce(AUTO_ARM.holdThresholdN + 0.5), 40);
    expect(ok.slipped).toBe(0);
    expect(ok.placed).toBeGreaterThanOrEqual(1);
  });

  it('above the crush limit (30 N each finger for the fragile crate) the fragile crate is crushed', { timeout: 120_000 }, () => {
    const r = run(withForce(AUTO_ARM.fragileLimitN / 2 + 5));
    expect(r.crushed).toBeGreaterThanOrEqual(1);
    expect(r.crushed).toBeLessThanOrEqual(r.fragileSeen);
    expect(r.slipped).toBe(0);
    // Just under the limit the same crate survives.
    const ok = run(withForce(AUTO_ARM.fragileLimitN / 2 - 0.5));
    expect(ok.crushed).toBe(0);
  });

  it('is anti-forced: without any essential wire the machine stops (at most the first crate is let go)', { timeout: 600_000 }, () => {
    const essential: [string, string, string, string][] = [
      // the arm
      ['pillar', 'self', 'swing', 'base'],
      ['swing', 'tip', 'shoulder', 'base'],
      ['shoulder', 'tip', 'upper', 'base'],
      ['upper', 'tip', 'elbow', 'base'],
      ['elbow', 'tip', 'fore', 'base'],
      ['fore', 'tip', 'gripper', 'base'],
      ['go', 'started', 'swing', 'power'],
      ['go', 'started', 'shoulder', 'power'],
      ['go', 'started', 'elbow', 'power'],
      // the taught angles
      ['a-cycle', 'index', 'tbl-swing', 'index'],
      ['a-cycle', 'index', 'tbl-shoulder', 'index'],
      ['a-cycle', 'index', 'tbl-elbow', 'index'],
      ['tbl-swing', 'value', 'swing', 'angle'],
      ['tbl-shoulder', 'value', 'shoulder', 'angle'],
      ['tbl-elbow', 'value', 'elbow', 'angle'],
      // the gripper
      ['a-cycle', 'step3', 'close-3-4', 'a'],
      ['a-cycle', 'step4', 'close-3-4', 'b'],
      ['close-3-4', 'out', 'gripper', 'close'],
      ['grip-force', 'value', 'gripper', 'force'],
      // every "Xong bước" port
      ['pick', 'inside', 'a-cycle', 'done1'],
      ['gripper', 'inReach', 'a-cycle', 'done2'],
      ['a-cycle', 'step3', 'grip-wait', 'run'],
      ['grip-wait', 'done', 'grip-ok', 'a'],
      ['gripper', 'holding', 'grip-ok', 'b'],
      ['grip-ok', 'out', 'a-cycle', 'done3'],
      ['swing', 'reached', 'a-cycle', 'done4'],
      ['swing', 'reached', 'a-cycle', 'done5'],
      // the belts
      ['belt-run', 'out', 'feed', 'run'],
    ];
    for (const link of essential) {
      expect(AUTO_ARM_WIRES.some((w) => w.join('.') === link.join('.')), link.join('.')).toBe(true);
      const r = run(without(sample(), link), SHORT_LIMIT_S);
      // Without the last step's port the first crate is let go (the release is the start of step 5) and the cycle stops there.
      expect(r.moved, link.join('.')).toBeLessThan(2);
    }
  });

  it('is anti-forced: without the timer or the spawn wire no crate is made and nothing is placed; the dice and table only decide which crates are fragile', { timeout: 300_000 }, () => {
    for (const link of [
      ['go', 'started', 'make-timer', 'run'],
      ['make-timer', 'done', 'maker', 'spawn'],
    ] as const) {
      expect(AUTO_ARM_WIRES.some((w) => w.join('.') === link.join('.')), link.join('.')).toBe(true);
      const r = run(without(sample(), link), SHORT_LIMIT_S);
      expect(r.spawned, link.join('.')).toBe(0);
      expect(r.placed, link.join('.')).toBe(0);
    }
    for (const link of [
      ['dice', 'value', 'tbl-fragile', 'index'],
      ['tbl-fragile', 'value', 'maker', 'crushLimit'],
    ] as const) {
      expect(AUTO_ARM_WIRES.some((w) => w.join('.') === link.join('.')), link.join('.')).toBe(true);
      const r = run(without(sample(), link), SHORT_LIMIT_S);
      expect(r.placed, link.join('.')).toBeGreaterThanOrEqual(4);
    }
    // Without the table wire the fragile row is never read: no crate has a limit at all.
    expect(run(without(sample(), ['tbl-fragile', 'value', 'maker', 'crushLimit']), SHORT_LIMIT_S).fragileSeen).toBe(0);
  });

  it('one text card shows the name of the step that is running, driven by the step number', { timeout: 60_000 }, () => {
    const p = play(sample());
    const seen = new Set<string>();
    p.watch(20, () => {
      for (const h of p.world.hudItems() as readonly { text?: string; hidden?: boolean }[]) if (h.text && !h.hidden) seen.add(h.text);
    });
    expect([...seen].some((s) => s.startsWith('1.'))).toBe(true);
    expect([...seen].some((s) => s.startsWith('4.'))).toBe(true);
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it('wires that only report or tidy up are not essential: the machine places crates without them', { timeout: 300_000 }, () => {
    const optional: [string, string, string, string][] = [
      ['drop-zone', 'entered', 'placed', 'up'],
      ['gripper', 'slipped', 'slips', 'up'],
      ['gripper', 'crushedOut', 'crushes', 'up'],
      ['placed', 'value', 'show-placed', 'value'],
      ['gripper', 'gripForce', 'show-grip', 'value'],
      ['a-cycle', 'index', 'step-text', 'line'],
      ['go', 'started', 'step-text', 'show'],
      ['go', 'started', 'cam', 'on'],
      ['go', 'started', 'out-belt', 'run'],
      ['pick', 'inside', 'belt-run', 'in'],
    ];
    for (const link of optional) {
      const r = run(without(sample(), link), SHORT_LIMIT_S);
      expect(r.moved, link.join('.')).toBeGreaterThanOrEqual(3);
    }
  });
});
