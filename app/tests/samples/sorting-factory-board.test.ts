import { beforeAll, describe, expect, it } from 'vitest';
import { runnableGraph } from '../../src/circuits/runnable';
import { validateCircuits } from '../../src/circuits/validate';
import { estimateNodeSize } from '../../src/editor/graph/graph-geometry';
import { CIRCUIT_KIND, TICK_DT, type Board } from '../../src/engine/types';
import { listSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { CARRY_WIRES, FACTORY, FACTORY_IDS, FACTORY_STATIONS_NAME, RULE_WIRES, chuteAccepts, chutePlace } from '../../src/samples/sorting-factory-stations';
import { loadRapier } from '../../src/world/rapier-loader';
import { chuteOfClass, colourOfClass, cutInside, cutOutside, start, type Link } from '../helpers/factory-run';

beforeAll(async () => {
  registerAllNodes();
  await loadRapier();
});

/** The board exactly as the "Bài mẫu" menu hands it out. */
const shipped = (): Board => structuredClone(listSamples().find((s) => s.id === 'sorting-factory')!.board);

const CHUTES = Array.from({ length: FACTORY.chuteCount }, (_, n) => n + 1);

interface FactoryResult {
  /** Cartons made, in order: spawner class and the chute the rule must send it to. */
  made: { id: string; cls: number; chute: number }[];
  /** What each chute counted (index 1..6), and what it flagged as wrong. */
  counts: number[];
  wrongs: number[];
  /** The two totals as the screen shows them. */
  shownTotal: number;
  shownWrong: number;
  /** What the three read-outs of the waiting carton said each time a carton was offered: colour number, kg, chute. */
  offers: { colour: number; kg: number; chute: number }[];
  /** Cartons that lay on the open floor at some moment (not on a belt, the table or inside a chute). */
  onFloor: string[];
  /** Most sorted cartons behind one chute at one moment. */
  maxInLine: number;
  slips: number;
  overloaded: boolean;
  hash: number;
  msPerTick: number;
}

/** Plays a whole board as it is: nothing is added, nothing is taken away by the test. */
function runFactory(board: Board, seconds: number): FactoryResult {
  expect(validateCircuits(board)).toEqual([]);
  const run = start(runnableGraph(board), board.mode);
  const out = (node: string, port: string) => run.rt.getOutput(node, port);
  const res: FactoryResult = { made: [], counts: [], wrongs: [], shownTotal: 0, shownWrong: 0, offers: [], onFloor: [], maxInLine: 0, slips: 0, overloaded: false, hash: 2166136261, msPerTick: 0 };
  const floor = new Set<string>();
  const half = FACTORY.chute.side / 2 + 0.05;
  const inAChute = (x: number, z: number): boolean => CHUTES.some((k) => Math.abs(x - chutePlace(k).x) < half && Math.abs(z - chutePlace(k).z) < half);
  let wasOffered = false;
  const ticks = Math.round(seconds / TICK_DT);
  const t0 = performance.now();
  for (let i = 0; i < ticks; i++) {
    run.tick();
    if (out('tram-nap/tao-kien', 'spawned') === true) {
      const cls = Number(out('tram-nap/tao-kien', 'lastClass'));
      res.made.push({ id: String(out('tram-nap/tao-kien', 'lastSpawned')), cls, chute: chuteOfClass(cls) });
    }
    if (out('tram-nap/tay-kep', 'slipped') === true) res.slips++;
    for (const j of ['xoay', 'vai', 'khuyu']) if (out(`tram-nap/${j}`, 'overloaded') === true) res.overloaded = true;
    const offered = out('tram-nap/co-kien-cho', 'out') === true;
    if (offered && !wasOffered) res.offers.push({ colour: Number(out('tram-nap/loai-kien', 'held')), kg: Number(out('tram-nap/khoi-luong', 'held')), chute: Number(out('luat/cua-toi', 'out')) });
    wasOffered = offered;
    const lines = new Map<number, number>();
    for (const e of run.items()) {
      const { x, y, z } = e.position;
      if (y < 0.2 && !inAChute(x, z)) floor.add(e.id);
      if (z < chutePlace(1).z - half) {
        const lane = Math.round((x - chutePlace(1).x) / 1.5);
        lines.set(lane, (lines.get(lane) ?? 0) + 1);
      }
      if (i % 30 === 0) for (const v of [x, y, z]) res.hash = Math.imul(res.hash ^ Math.round(v * 1e4), 16777619) >>> 0;
    }
    res.maxInLine = Math.max(res.maxInLine, ...lines.values());
  }
  res.msPerTick = (performance.now() - t0) / ticks;
  res.counts = [0, ...CHUTES.map((k) => Number(out(`cua-${k}/dem`, 'value')))];
  res.wrongs = [0, ...CHUTES.map((k) => Number(out(`cua-${k}/dem-sai`, 'value')))];
  res.shownTotal = Number(out('tong-kien/cong-5', 'out'));
  res.shownWrong = Number(out('tong-sai/cong-5', 'out'));
  res.onFloor = [...floor];
  run.dispose();
  return res;
}

const sum = (list: number[]): number => list.reduce((a, b) => a + b, 0);

describe('the shipped board "Xưởng phân loại kiện hàng (đang dựng: phần trạm)" (Vật lý thật)', () => {
  it('is in the "Bài mẫu" menu under a name that says it is unfinished, and its notes say what stands in for the vehicles', () => {
    const entry = listSamples().find((s) => s.id === 'sorting-factory')!;
    expect(entry.label).toContain('đang dựng');
    expect(entry.label).toContain('chưa có đội xe');
    const board = entry.board;
    expect(board.name).toBe(FACTORY_STATIONS_NAME);
    expect(board.graph.settings?.realPhysics).toBe(true);
    const text = board.notes!.map((n) => n.text).join(' ');
    for (const said of ['CHƯA có', 'Chuyển tạm (thay xe)', 'Dịch chuyển', 'từ 4 kg trở lên']) expect(text, said).toContain(said);
  });

  it('holds one Trạm nạp, six Cửa thả set to their colours, the rule, the stand-in and the read-outs; the read-outs are on the main board only', () => {
    const board = shipped();
    const copies = board.graph.nodes.filter((n) => n.kind === CIRCUIT_KIND);
    const of = (id: string) => copies.filter((n) => n.params.circuit === id);
    expect(of(FACTORY_IDS.station).length).toBe(1);
    expect(of(FACTORY_IDS.chute).length).toBe(FACTORY.chuteCount);
    expect(of(FACTORY_IDS.rule).length).toBe(1);
    expect(of(FACTORY_IDS.carry).length).toBe(1);
    expect(of(FACTORY_IDS.adder).length).toBe(2);
    expect(board.graph.stacks).toEqual([FACTORY_IDS.chute, FACTORY_IDS.adder]);
    // Five colour chutes and one that takes every colour (the heavy one).
    const flat = runnableGraph(board);
    for (const k of CHUTES) {
      expect(flat.nodes.find((n) => n.id === `cua-${k}/mau-nhan`)!.params.value, `chute ${k}`).toBe(chuteAccepts(k));
      expect(flat.nodes.find((n) => n.id === `cua-${k}/cua`)!.params.signText, `chute ${k}`).toBe(String(k));
    }
    expect(CHUTES.map(chuteAccepts)).toEqual([1, 2, 3, 4, 5, 0]);
    // No circuit prints on the screen or needs a key: copies of one circuit would print the same line on top of each other.
    for (const c of board.circuits!) for (const n of c.graph.nodes) expect(['show-number', 'show-text', 'camera', 'key', 'ui-button'].includes(n.kind), `${c.id}/${n.id}`).toBe(false);
    expect(board.graph.nodes.filter((n) => n.kind === 'show-number').length).toBe(5);
    expect(board.graph.nodes.some((n) => ['key', 'stick', 'ui-button', 'ui-start'].includes(n.kind))).toBe(false);
    // Cards of the main board, and of every circuit, do not lie on each other.
    const rows = new Map(board.circuits!.map((c) => [c.id, c.pins.length]));
    const boxes = board.graph.nodes.map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y, ...(n.kind === CIRCUIT_KIND ? { w: 220, h: 48 + 26 * (rows.get(String(n.params.circuit)) ?? 4) } : estimateNodeSize(n)) }));
    for (const p of boxes) for (const q of boxes) if (p.id < q.id) expect(p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y, `${p.id}/${q.id}`).toBe(false);
    for (const c of board.circuits!) {
      const inner = c.graph.nodes.map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y, ...estimateNodeSize(n) }));
      for (const p of inner) for (const q of inner) if (p.id < q.id) expect(p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y, `${c.id}: ${p.id}/${q.id}`).toBe(false);
    }
  });

  it('the rule sends colours 1-5 to chutes 1-5 and every carton of 4 kg or more to chute 6', () => {
    expect([1, 2, 3, 4, 5, 6].map(chuteOfClass)).toEqual([1, 2, 3, 4, 5, 6]);
    expect([1, 2, 3, 4, 5, 6].map(colourOfClass)).toEqual([1, 2, 3, 4, 5, 1]);
    const rule = shipped().circuits!.find((c) => c.id === FACTORY_IDS.rule)!;
    const graph = { nodes: [...structuredClone(rule.graph.nodes), { id: 'mau', kind: 'const', params: { value: 0 }, pos: { x: 0, y: 0 } }, { id: 'kg', kind: 'const', params: { value: 0 }, pos: { x: 0, y: 0 } }], wires: [...rule.graph.wires, { id: 'x1', from: { node: 'mau', port: 'value' }, to: { node: 'cua-theo-mau', port: 'a' } }, { id: 'x2', from: { node: 'kg', port: 'value' }, to: { node: 'la-nang', port: 'a' } }] };
    const chuteFor = (colour: number, kg: number): number => {
      const g = structuredClone(graph);
      g.nodes.find((n) => n.id === 'mau')!.params.value = colour;
      g.nodes.find((n) => n.id === 'kg')!.params.value = kg;
      const run = start(g);
      run.tick();
      run.tick();
      const chute = Number(run.rt.getOutput('cua-toi', 'out'));
      run.dispose();
      return chute;
    };
    for (const colour of [1, 2, 3, 4, 5]) {
      expect(chuteFor(colour, 1), `colour ${colour}, 1 kg`).toBe(colour);
      expect(chuteFor(colour, 3.9), `colour ${colour}, 3.9 kg`).toBe(colour);
      expect(chuteFor(colour, 4), `colour ${colour}, 4 kg`).toBe(6);
      expect(chuteFor(colour, 8), `colour ${colour}, 8 kg`).toBe(6);
    }
  });

  it('runs three minutes by itself: every carton reaches the chute of its class, none is flagged, none lies on the floor', { timeout: 600_000 }, () => {
    const r = runFactory(shipped(), 180);
    console.log(`Factory board, 180 s: made ${r.made.length}, per chute ${r.counts.slice(1).join('/')}, wrong ${sum(r.wrongs)}, most in one line ${r.maxInLine}, ${r.msPerTick.toFixed(2)} ms per tick`);
    expect(r.made.length).toBeGreaterThanOrEqual(15);
    expect(new Set(r.made.map((m) => m.cls)).size).toBe(FACTORY.classCount);
    // The read-outs of the waiting carton: its colour number, its mass, and the chute the rule names.
    expect(r.offers.length).toBeGreaterThanOrEqual(r.made.length - 2);
    r.offers.forEach((o, n) => {
      const m = r.made[n]!;
      expect(o, `carton ${n + 1}`).toEqual({ colour: colourOfClass(m.cls), kg: FACTORY.classMasses[m.cls - 1], chute: m.chute });
    });
    // Each chute counted the cartons of its class, in the order they were made (the last ones may still be on their way).
    const total = sum(r.counts);
    expect(total).toBeGreaterThanOrEqual(r.made.length - 3);
    const arrived = r.made.slice(0, total);
    for (const k of CHUTES) expect(r.counts[k], `chute ${k}`).toBe(arrived.filter((m) => m.chute === k).length);
    for (const k of CHUTES) expect(r.counts[k], `chute ${k} got something`).toBeGreaterThanOrEqual(1);
    expect(sum(r.wrongs)).toBe(0);
    expect(r.shownTotal).toBe(total);
    expect(r.shownWrong).toBe(0);
    expect(r.onFloor).toEqual([]);
    expect(r.slips).toBe(0);
    expect(r.overloaded).toBe(false);
    expect(r.maxInLine).toBeLessThanOrEqual(16);
  });

  it('plays the same way twice (same seed, same hash)', { timeout: 600_000 }, () => {
    const a = runFactory(shipped(), 60);
    const b = runFactory(shipped(), 60);
    expect(a.made.length).toBeGreaterThanOrEqual(5);
    expect(b.hash).toBe(a.hash);
    expect(b.made).toEqual(a.made);
    expect(b.counts).toEqual(a.counts);
  });

  it('is anti-forced: cut a wire of the main board, the rule or the stand-in and the factory fails in the way that wire explains', { timeout: 1_800_000 }, () => {
    const SECONDS = 75;
    const base = runFactory(shipped(), SECONDS);
    const baseTotal = sum(base.counts);
    expect(baseTotal).toBeGreaterThanOrEqual(5);
    expect(sum(base.wrongs)).toBe(0);
    expect(base.shownTotal).toBe(baseTotal);

    type Check = (r: FactoryResult, label: string) => void;
    const nothingLeavesTheTable: Check = (r, l) => {
      expect(sum(r.counts), l).toBe(0);
      expect(r.made.length, l).toBeLessThanOrEqual(2);
    };
    const outside: { name: string; wires: Link[]; check: Check }[] = [
      {
        name: 'the arm never picks (the station is not told to go on)',
        wires: [['bat-dau.started', 'tram-nap.cho-nap']],
        check: (r, l) => {
          expect(r.offers.length, l).toBe(0);
          expect(r.made.length, l).toBe(1);
        },
      },
      {
        name: 'the first carton stays on the table and the station waits',
        wires: [
          ['tram-nap.co-kien', 'chuyen-tam.co-kien'],
          ['luat.cua', 'chuyen-tam.cua'],
        ],
        check: nothingLeavesTheTable,
      },
      {
        name: 'the rule does not hear the colour: only heavy cartons leave the table',
        wires: [['tram-nap.loai', 'luat.loai']],
        check: (r, l) => {
          expect(sum(r.counts.slice(1, 6)), l).toBe(0);
          expect(r.offers.every((o) => o.chute === 0 || o.chute === 6), l).toBe(true);
        },
      },
      {
        name: 'the rule does not hear the mass: heavy cartons go by their colour and the heavy chute stays empty',
        wires: [['tram-nap.kg', 'luat.kg']],
        check: (r, l) => {
          expect(r.counts[6], l).toBe(0);
          expect(r.offers.every((o) => o.chute === o.colour), l).toBe(true);
        },
      },
    ];
    const listedOutside = new Set(outside.flatMap((g) => g.wires.map((w) => w.join('>'))));
    for (const g of outside) for (const w of g.wires) g.check(runFactory(cutOutside(shipped(), w), SECONDS), `${g.name}: ${w.join(' -> ')}`);

    // Read-out wires: the factory runs as before, the line on the screen stays at 0.
    const readouts: [Link, (r: FactoryResult) => number][] = [
      [['tong-kien.tong', 'hien-kien.value'], () => 0],
      [['cua-1.so-kien', 'tong-kien.so-1'], (r) => r.shownTotal - (sum(r.counts) - r.counts[1]!)],
      [['cua-6.so-kien', 'tong-kien.so-6'], (r) => r.shownTotal - (sum(r.counts) - r.counts[6]!)],
    ];
    for (const [w, off] of readouts) {
      const r = runFactory(cutOutside(shipped(), w), SECONDS);
      expect(sum(r.counts), w.join(' -> ')).toBe(baseTotal);
      expect(off(r), w.join(' -> ')).toBe(0);
      listedOutside.add(w.join('>'));
    }
    // Every other wire of the main board is a read-out wire of the same kinds (a chute to an adder, an adder or a pin to a line on the screen) or the camera switch.
    for (const w of shipped().graph.wires) {
      const key = `${w.from.node}.${w.from.port}>${w.to.node}.${w.to.port}`;
      if (listedOutside.has(key)) continue;
      expect(/^(cua-\d\.(so-kien|sai)>tong-(kien|sai)\.so-\d|tong-sai\.tong>hien-sai\.value|tram-nap\.(loai|kg)>hien-(mau|kg)\.value|luat\.cua>hien-cua\.value|bat-dau\.started>may-quay\.on)$/.test(key), key).toBe(true);
    }

    // Inside the rule.
    const rule: { name: string; wires: Link[]; check: Check }[] = [
      {
        name: 'nothing is ever heavy: the heavy chute stays empty',
        wires: [
          ['nguong-nang.value', 'la-nang.b'],
          ['la-nang.out', 'cua-nang.on'],
          ['cua-nang.value', 'cua-toi.b'],
        ],
        check: (r, l) => expect(r.counts[6], l).toBe(0),
      },
      {
        name: 'a heavy carton is sent to a chute that does not exist (its colour number plus 6) and stays on the table',
        wires: [['la-nang.out', 'he-so-mau.on']],
        check: (r, l) => {
          expect(r.counts[6], l).toBe(0);
          expect(r.offers.some((o) => o.chute > 6), l).toBe(true);
        },
      },
      {
        name: 'the colour never reaches the answer: only heavy cartons leave the table',
        wires: [
          ['he-so-mau.value', 'cua-theo-mau.b'],
          ['cua-theo-mau.out', 'cua-toi.a'],
        ],
        check: (r, l) => {
          expect(sum(r.counts.slice(1, 6)), l).toBe(0);
          expect(r.offers.every((o) => o.chute === 0 || o.chute === 6), l).toBe(true);
        },
      },
    ];
    expect(rule.flatMap((g) => g.wires.map((w) => w.join('>'))).sort()).toEqual(RULE_WIRES.map((w) => w.join('>')).sort());
    for (const g of rule) for (const w of g.wires) g.check(runFactory(cutInside(shipped(), FACTORY_IDS.rule, w), SECONDS), `${g.name}: ${w.join(' -> ')}`);

    // Inside the stand-in: every wire of chute k's branch is needed for chute k and for no other.
    const carried = new Set<string>();
    for (const w of CARRY_WIRES) {
      const k = Number(/-(\d)\./.exec(w[1])![1]);
      // Only the branches of chutes that received something in the base run can be told apart in this time.
      if (base.counts[k]! === 0) continue;
      const r = runFactory(cutInside(shipped(), FACTORY_IDS.carry, w), SECONDS);
      const label = `stand-in, chute ${k}: ${w.join(' -> ')}`;
      expect(r.counts[k], label).toBe(0);
      expect(sum(r.wrongs), label).toBe(0);
      carried.add(w.join('>'));
    }
    expect(carried.size).toBeGreaterThanOrEqual(8);
  });
});
