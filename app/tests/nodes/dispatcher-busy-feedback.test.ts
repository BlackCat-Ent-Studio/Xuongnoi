import { beforeAll, describe, expect, it } from 'vitest';
import type { Board } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { createRng } from '../../src/nodes/random';
import { makeBoard, type CardSpec, type Link } from '../../src/samples/cell-board-kit';
import { play } from '../helpers/cell-run';

beforeAll(() => registerAllNodes());

/** Seconds each machine works on one job. Together they are a little slower than the jobs arrive, so jobs do queue up. */
const WORK_SECONDS = [0.7, 0.9, 1.3];
const JOB_EVERY = 0.3;
const CARDS = ['clock', 'count', 'disp', 'work1', 'work2', 'work3', 'free1', 'free2', 'free3'] as const;
type Ids = Record<(typeof CARDS)[number], string>;

/**
 * The loop a student builds: "Giao máy k" restarts the machine's timer, and the timer (through a "Đảo ngược" card) reports
 * "Máy k đang bận" back to the dispatcher. A counter numbers the jobs so that every hand-over can be told apart.
 */
function board(ids: Ids): Board {
  const specs: CardSpec[] = [
    { id: 'zz-go', kind: 'on-start', col: 0 },
    { id: ids.clock, kind: 'timer', col: 0, params: { seconds: JOB_EVERY, repeat: 'yes' } },
    { id: ids.count, kind: 'counter', col: 1 },
    { id: ids.disp, kind: 'dispatcher', col: 2, params: { machines: 3, showCode: 'yes' } },
    ...WORK_SECONDS.flatMap((seconds, k): CardSpec[] => [
      { id: ids[`work${k + 1}` as 'work1'], kind: 'timer', col: 3, params: { seconds } },
      { id: ids[`free${k + 1}` as 'free1'], kind: 'not', col: 4 },
    ]),
  ];
  const links: Link[] = [
    ['zz-go', 'started', ids.clock, 'run'],
    [ids.clock, 'done', ids.count, 'up'],
    [ids.clock, 'done', ids.disp, 'job'],
    [ids.count, 'value', ids.disp, 'jobId'],
    ...WORK_SECONDS.flatMap((_, k): Link[] => {
      const work = ids[`work${k + 1}` as 'work1'];
      const free = ids[`free${k + 1}` as 'free1'];
      return [
        ['zz-go', 'started', work, 'run'],
        [ids.disp, `give${k + 1}`, work, 'reset'],
        [work, 'done', free, 'in'],
        [free, 'out', ids.disp, `busy${k + 1}`],
      ];
    }),
  ];
  return makeBoard('busy feedback', '2d-side', specs, links, []);
}

interface Trace {
  /** Per tick: which machine got a job (0 = none), the code it got, and the three "is working" levels after the tick. */
  rows: { to: number; code: number; working: boolean[]; waiting: boolean }[];
  jobs: number;
  /** Rule breaks, in words. */
  bad: string[];
}

function run(ids: Ids, seconds = 30): Trace {
  const p = play(board(ids));
  const t: Trace = { rows: [], jobs: 0, bad: [] };
  p.watch(seconds, () => {
    const to = [1, 2, 3].filter((k) => p.out(ids.disp, `give${k}`) === true);
    if (to.length > 1) t.bad.push(`tick ${t.rows.length}: ${to.length} machines got a job at once`);
    const machine = to[0] ?? 0;
    const before = t.rows.at(-1)?.working ?? [true, true, true];
    if (machine > 0 && before[machine - 1]) t.bad.push(`tick ${t.rows.length}: machine ${machine} got a job while working`);
    t.rows.push({
      to: machine,
      code: machine > 0 ? (p.out(ids.disp, `code${machine}`) as number) : 0,
      working: [1, 2, 3].map((k) => p.out(ids[`work${k}` as 'work1'], 'done') !== true),
      waiting: p.out(ids.disp, 'waiting') === true,
    });
    t.jobs = p.out(ids.count, 'value') as number;
  });
  return t;
}

/** Orders in which the cards can sort by id: the nine in a row, then 300 shuffles from a fixed seed (9! is too many to play). */
function orders(): string[][] {
  const rnd = createRng(261119);
  const all: string[][] = [[...CARDS], [...CARDS].reverse()];
  for (let n = 0; n < 300; n++) {
    const o = [...CARDS] as string[];
    for (let i = o.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [o[i], o[j]] = [o[j]!, o[i]!];
    }
    all.push(o);
  }
  return all;
}
const ORDERS = orders();
const idsFor = (order: string[]): Ids => Object.fromEntries(CARDS.map((c) => [c, `c${order.indexOf(c)}-${c}`])) as Ids;

describe('dispatcher with every "Máy k đang bận" wired back from the machine it starts', () => {
  const traces: Trace[] = [];
  beforeAll(() => {
    for (const order of ORDERS) traces.push(run(idsFor(order)));
  }, 240_000);

  it('the board really queues: jobs wait at times, and all three machines get work', () => {
    const t = traces[0]!;
    expect(t.rows.some((r) => r.waiting)).toBe(true);
    for (const k of [1, 2, 3]) expect(t.rows.filter((r) => r.to === k).length, `machine ${k}`).toBeGreaterThan(5);
  });

  it('no machine gets a job while it works and no two get one on the same tick, whatever the card ids', () => {
    const bad = ORDERS.filter((_, n) => traces[n]!.bad.length > 0);
    expect(bad.map((o, n) => `${o.join('<')}: ${traces[n]!.bad[0]}`)).toEqual([]);
  });

  it('every job is handed over exactly once and in arrival order, whatever the card ids', () => {
    for (const [n, t] of traces.entries()) {
      const codes = t.rows.filter((r) => r.to > 0).map((r) => r.code);
      expect(codes, ORDERS[n]!.join('<')).toEqual(Array.from({ length: codes.length }, (_, k) => k + 1));
      // What is not handed over yet is still waiting: at most the jobs that arrived, never more.
      expect(codes.length).toBeLessThanOrEqual(t.jobs);
      expect(codes.length).toBeGreaterThan(t.jobs * 0.8);
    }
  });

  it('the run is identical for every ordering of the cards', () => {
    const first = JSON.stringify(traces[0]!.rows);
    expect(ORDERS.filter((_, n) => JSON.stringify(traces[n]!.rows) !== first).length).toBe(0);
  });
});
