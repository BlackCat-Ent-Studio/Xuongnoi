import { beforeAll, describe, expect, it } from 'vitest';
import { registerAllNodes } from '../../src/nodes';
import type { Board } from '../../src/engine/types';
import { makeBoard, type CardSpec, type Link } from '../../src/samples/cell-board-kit';
import { play } from '../helpers/cell-run';

beforeAll(() => registerAllNodes());

/** Taught angles per step for two joints; the steps differ for both so that a step left too early is seen on either. */
const ANGLES = [
  [0, 0],
  [40, -30],
  [80, 20],
  [20, 60],
];
const TOLERANCE = 1;
const CARDS = ['seq', 'tblA', 'tblB', 'jointA', 'jointB', 'both', 'dwell', 'settled'] as const;
type Ids = Record<(typeof CARDS)[number], string>;

/**
 * The wiring a student reaches for first: step number -> table -> joint angle, and the joints' "Đã tới góc" (both of
 * them, through an "và" card) -> every "Xong bước". Two joints so that the cycles share the sequence card.
 */
function board(ids: Ids): Board {
  const table = (col: number) => ({ rows: ANGLES.length, ...Object.fromEntries(ANGLES.map((a, k) => [`v${k + 1}`, a[col]])) });
  const joint = { axis: 'yaw', start: 0, min: -180, max: 180, maxSpeed: 90, tolerance: TOLERANCE };
  const specs: CardSpec[] = [
    { id: 'zz-floor', kind: 'block', col: 0, params: { position: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 } } },
    { id: 'zz-go', kind: 'on-start', col: 1 },
    { id: ids.jointA, kind: 'joint', col: 2, params: joint },
    { id: ids.jointB, kind: 'joint', col: 2, params: joint },
    { id: ids.tblA, kind: 'value-table', col: 3, params: table(0) },
    { id: ids.tblB, kind: 'value-table', col: 3, params: table(1) },
    { id: ids.both, kind: 'and', col: 4 },
    { id: ids.dwell, kind: 'not', col: 4 },
    { id: ids.settled, kind: 'and', col: 4 },
    { id: ids.seq, kind: 'sequence', col: 5, params: { stepCount: ANGLES.length, loop: 'no', showDone: 'yes' } },
  ];
  const links: Link[] = [
    ['zz-floor', 'self', ids.jointA, 'base'],
    ['zz-floor', 'self', ids.jointB, 'base'],
    ['zz-go', 'started', ids.jointA, 'power'],
    ['zz-go', 'started', ids.jointB, 'power'],
    [ids.seq, 'index', ids.tblA, 'index'],
    [ids.seq, 'index', ids.tblB, 'index'],
    [ids.tblA, 'value', ids.jointA, 'angle'],
    [ids.tblB, 'value', ids.jointB, 'angle'],
    [ids.jointA, 'reached', ids.both, 'a'],
    [ids.jointB, 'reached', ids.both, 'b'],
    // A second loop through the sequence card: a step only ends while the whole sequence is not finished.
    [ids.seq, 'finished', ids.dwell, 'in'],
    [ids.both, 'out', ids.settled, 'a'],
    [ids.dwell, 'out', ids.settled, 'b'],
    ...ANGLES.map((_, k): Link => [ids.settled, 'out', ids.seq, `done${k + 1}`]),
  ];
  return makeBoard('feedback', '3d', specs, links, []);
}

interface Trace {
  /** Per tick: step number shown by the sequence and both joint angles. */
  rows: { index: number; a: number; b: number }[];
  /** Steps (1-based) that ended while a joint was still away from that step's angle, in order. */
  skipped: number[];
  /** Step numbers shown, without repeats. */
  visited: number[];
}

function run(ids: Ids, seconds = 15): Trace {
  const p = play(board(ids));
  const t: Trace = { rows: [], skipped: [], visited: [1] };
  const near = (r: { a: number; b: number }, step: number, joint: 'a' | 'b') => Math.abs(r[joint] - ANGLES[step - 1]![joint === 'a' ? 0 : 1]!) <= TOLERANCE + 1e-6;
  p.watch(seconds, () => {
    const index = p.out(ids.seq, 'index') as number;
    t.rows.push({ index, a: p.out(ids.jointA, 'angleNow') as number, b: p.out(ids.jointB, 'angleNow') as number });
    const prevIndex = t.rows.length > 1 ? t.rows[t.rows.length - 2]!.index : 1;
    if (index === prevIndex) return;
    // The step that ended counts as done if each joint was at its angle on the tick of the change or the tick before
    // (the two joints may be read one tick apart; that is not a skipped step).
    const window = t.rows.slice(-2);
    for (const joint of ['a', 'b'] as const) {
      if (!window.some((r) => near(r, prevIndex, joint))) t.skipped.push(prevIndex);
    }
    t.visited.push(index);
  });
  return t;
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r]));
}

/** Orders in which the cards can sort by id. */
const ALL_ORDERS = permutations([...CARDS]);
/** 8! orders are too many to play; every 100th, starting at a fixed offset, still covers all relative positions of the cards. */
const ORDERS = ALL_ORDERS.filter((_, n) => n % 100 === 7);
const idsFor = (order: string[]): Ids => Object.fromEntries(CARDS.map((c) => [c, `c${order.indexOf(c)}-${c}`])) as Ids;

describe('a sequence step that ends on joints "Đã tới góc" wired back through the tables', () => {
  const traces: Trace[] = [];
  beforeAll(() => {
    for (const order of ORDERS) traces.push(run(idsFor(order)));
  }, 120_000);

  it('no step ends before the joints are at its angles, whatever the card ids', () => {
    const bad = ORDERS.filter((_, n) => traces[n]!.skipped.length > 0 || traces[n]!.visited.join() !== '1,2,3,4,0');
    expect(bad.map((o) => o.join('<'))).toEqual([]);
  });

  it('the run is identical for every ordering of the cards', () => {
    const first = JSON.stringify(traces[0]!.rows);
    const differ = ORDERS.filter((_, n) => JSON.stringify(traces[n]!.rows) !== first);
    expect(differ.length).toBe(0);
  });
});
