import { beforeAll, describe, expect, it } from 'vitest';
import { validateCircuits } from '../../src/circuits/validate';
import { estimateNodeSize } from '../../src/editor/graph/graph-geometry';
import { getNodeDef } from '../../src/engine/registry';
import { registerAllNodes } from '../../src/nodes';
import { FACTORY, FACTORY_IDS, STATION_WIRES } from '../../src/samples/sorting-factory-stations';
import { loadRapier } from '../../src/world/rapier-loader';
import { circuitOf, colourOfClass, cutInside, factoryBoard, runStation, type Link, type StationResult } from '../helpers/factory-run';

beforeAll(async () => {
  registerAllNodes();
  await loadRapier();
});

/** Cartons taken off the table whose pins did not say the class (colour number) or the mass the spawner gave them. */
function wrongPins(r: StationResult): { cls: number; kg: number } {
  const byId = new Map(r.made.map((m) => [m.id, m]));
  return {
    cls: r.taken.filter((t) => t.loai !== colourOfClass(byId.get(t.id)?.cls ?? 0)).length,
    kg: r.taken.filter((t) => Math.abs(t.kg - (byId.get(t.id)?.kg ?? -1)) > 1e-6).length,
  };
}

const station = () => circuitOf(factoryBoard(), FACTORY_IDS.station);
const SHORT_S = 40;

describe('circuit Trạm nạp alone on the bench (Vật lý thật)', () => {
  it('is made of palette pieces only, has no read-out of its own, and its cards do not overlap', () => {
    const board = factoryBoard();
    expect(board.graph.settings?.realPhysics).toBe(true);
    expect(validateCircuits(board)).toEqual([]);
    const c = station();
    const kinds = new Set(c.graph.nodes.map((n) => n.kind));
    for (const k of kinds) expect(getNodeDef(k), k).toBeDefined();
    for (const banned of ['key', 'stick', 'ui-button', 'ui-start', 'ui-pick', 'ui-dialog', 'show-number', 'show-text', 'camera', 'circuit']) expect(kinds.has(banned), banned).toBe(false);
    for (const k of ['spawner', 'zone', 'color-sensor', 'force-sensor', 'sample-hold', 'sequence', 'value-table', 'joint', 'link', 'gripper']) expect(kinds.has(k), k).toBe(true);
    expect(c.pins.map((p) => `${p.dir}:${p.label}:${p.type}`)).toEqual(['in:Cho nạp tiếp:bool', 'out:Có kiện chờ:bool', 'out:Loại kiện:number', 'out:Khối lượng:number']);
    expect(c.exposed.map((e) => `${e.inner.node}.${e.inner.param}`)).toEqual(['tao-kien.classCount', 'nhip-nap.seconds', 'tao-kien.classSeed']);
    expect(c.benchIds).toEqual(['san-thu']);
    // The looks picked for the factory.
    const params = (id: string) => c.graph.nodes.find((n) => n.id === id)!.params;
    expect(params('tao-kien').look).toBe('parcel-carton');
    expect(params('bang').style).toBe('belt-frame');
    expect(params('cong').style).toBe('scan-gate');
    expect(params('de-tay').style).toBe('arm-base');
    for (const id of ['xoay', 'vai', 'khuyu', 'thanh-tren', 'thanh-duoi', 'tay-kep']) expect(params(id).look, id).toBe('factory');
    expect(params('tay-kep').grip).toBe('between');
    const boxes = c.graph.nodes.map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y, ...estimateNodeSize(n) }));
    for (const p of boxes) for (const q of boxes) if (p.id < q.id) expect(p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y, `${p.id}/${q.id}`).toBe(false);
  });

  it('over three minutes every carton is scanned with its class, weighed, picked and set on the hand-over table; none is dropped', { timeout: 300_000 }, () => {
    const r = runStation(factoryBoard(), { seconds: 180 });
    console.log(`Trạm nạp alone, 180 s: made ${r.made.length}, handed over ${r.taken.length}, ${r.msPerTick.toFixed(2)} ms per tick, seconds per step ${r.stepSeconds.slice(1).map((s) => s.toFixed(0)).join('/')}`);
    expect(r.made.length).toBeGreaterThanOrEqual(20);
    // Every class shows up, the heavy one too.
    expect(new Set(r.made.map((m) => m.cls)).size).toBe(FACTORY.classCount);
    for (const m of r.made) expect(m.kg).toBe(FACTORY.classMasses[m.cls - 1]);
    // The gate: one scan per carton, in order, each the colour number of that carton's class (the last carton may still be on its way).
    expect(r.scans.length).toBeGreaterThanOrEqual(r.made.length - 1);
    r.scans.forEach((colour, n) => expect(colour, `scan ${n + 1}`).toBe(colourOfClass(r.made[n]!.cls)));
    // The arm: everything that arrived was set on the table and taken in the order it was made.
    expect(r.taken.length).toBeGreaterThanOrEqual(r.made.length - 2);
    expect(r.taken.map((t) => t.id)).toEqual(r.made.slice(0, r.taken.length).map((m) => m.id));
    expect(r.offered).toBeGreaterThanOrEqual(r.taken.length);
    // The pins at the moment a carton is taken: its own colour number and its own mass.
    expect(wrongPins(r)).toEqual({ cls: 0, kg: 0 });
    expect(r.dropped).toBe(0);
    expect(r.slips).toBe(0);
    expect(r.overloaded).toBe(false);
    expect(r.maxOnTable).toBe(1);
    expect(r.maxOnBelt).toBe(1);
    // "Có kiện chờ" only goes on once the hand is back on the belt side.
    for (const step of r.offeredAtSteps) expect(step === 9 || step <= 5, `offered in step ${step}`).toBe(true);
  });

  it('waits while the table is occupied: one carton on the table, one held back at the pick point, no new one made; goes on once the table is cleared', { timeout: 120_000 }, () => {
    const snap: { made: number; step: number; items: number }[] = [];
    let made = 0;
    const r = runStation(factoryBoard(), {
      seconds: 80,
      takeAfterS: (t) => (t < 50 ? null : 1),
      each: (t, run) => {
        if (run.rt.getOutput('tao-kien', 'spawned') === true) made++;
        if (Math.abs(t - 20) < 1e-6 || Math.abs(t - 49) < 1e-6) snap.push({ made, step: Number(run.rt.getOutput('buoc', 'index')), items: run.items().length });
      },
    });
    // From second 20 to second 49 nothing moves: the arm waits in step 1 with a carton at the pick point and one on the table.
    expect(snap).toEqual([
      { made: 2, step: 1, items: 2 },
      { made: 2, step: 1, items: 2 },
    ]);
    expect(r.taken[0]!.t).toBeGreaterThanOrEqual(50);
    expect(r.taken.length).toBeGreaterThanOrEqual(3);
    expect(wrongPins(r)).toEqual({ cls: 0, kg: 0 });
    expect(r.dropped).toBe(0);
    expect(r.maxOnTable).toBe(1);
  });

  it('pin "Cho nạp tiếp": while it is off the arm does not pick; it starts when the pin goes on', { timeout: 120_000 }, () => {
    const off = runStation(factoryBoard(), { seconds: SHORT_S, allow: false });
    expect(off.made.length).toBe(1);
    expect(off.offered).toBe(0);
    expect(off.maxOnTable).toBe(0);
    expect(off.lastStep).toBe(1);
    expect(off.stepSeconds[1]).toBeCloseTo(SHORT_S, 0);
    const later = runStation(factoryBoard(), { seconds: SHORT_S, allow: (t) => t >= 20 });
    expect(later.taken.length).toBeGreaterThanOrEqual(1);
    expect(later.taken[0]!.t).toBeGreaterThan(20);
  });

  it('is anti-forced: every inner wire is needed; cut one and the station fails in the way that wire explains', { timeout: 900_000 }, () => {
    const base = runStation(factoryBoard(), { seconds: SHORT_S });
    expect(base.taken.length).toBeGreaterThanOrEqual(4);
    expect(wrongPins(base)).toEqual({ cls: 0, kg: 0 });

    /** Each group: the wires, and what must be seen when one of them is missing. */
    const groups: { name: string; wires: Link[]; check: (r: StationResult, cut: Board, label: string) => void }[] = [
      {
        name: 'no carton is made',
        wires: [
          ['bang-trong.out', 'nhip-nap.run'],
          ['nhip-nap.done', 'tao-kien.spawn'],
        ],
        check: (r, _b, l) => expect(r.made.length, l).toBe(0),
      },
      {
        name: 'the belt never runs: the carton stays where it was made',
        wires: [['bang-chay.out', 'bang.run']],
        check: (r, _b, l) => {
          expect(r.made.length, l).toBe(1);
          expect(r.scans.length, l).toBe(0);
          expect(r.offered, l).toBe(0);
        },
      },
      {
        name: 'the belt never stops: the carton rides off its end onto the floor',
        wires: [['diem-gap.inside', 'bang-chay.in']],
        check: (r, _b, l) => {
          expect(r.dropped, l).toBeGreaterThanOrEqual(1);
          expect(r.offered, l).toBe(0);
        },
      },
      {
        name: 'cartons are made without waiting for an empty belt: they pile up, fall off and are weighed together',
        wires: [['tren-bang.inside', 'bang-trong.in']],
        check: (r, _b, l) => {
          expect(r.maxOnBelt, l).toBeGreaterThan(1);
          expect(r.dropped, l).toBeGreaterThanOrEqual(1);
          expect(wrongPins(r).kg, l).toBeGreaterThanOrEqual(1);
        },
      },
      {
        name: 'no carton ever reaches the table (the arm is not whole, has no power, no taught angle, no grip, or a step never ends)',
        wires: [
          ['de-tay.self', 'xoay.base'],
          ['xoay.tip', 'vai.base'],
          ['vai.tip', 'thanh-tren.base'],
          ['thanh-tren.tip', 'khuyu.base'],
          ['khuyu.tip', 'thanh-duoi.base'],
          ['thanh-duoi.tip', 'tay-kep.base'],
          ['bat-dau.started', 'xoay.power'],
          ['bat-dau.started', 'vai.power'],
          ['bat-dau.started', 'khuyu.power'],
          ['buoc.index', 'goc-xoay.index'],
          ['buoc.index', 'goc-vai.index'],
          ['buoc.index', 'goc-khuyu.index'],
          ['goc-xoay.value', 'xoay.angle'],
          ['goc-vai.value', 'vai.angle'],
          ['goc-khuyu.value', 'khuyu.angle'],
          ['buoc.step3', 'kep-3-4.a'],
          ['buoc.step4', 'kep-3-4.b'],
          ['buoc.step5', 'kep-5-6.a'],
          ['buoc.step6', 'kep-5-6.b'],
          ['kep-3-4.out', 'kep.a'],
          ['kep-5-6.out', 'kep.b'],
          ['kep.out', 'tay-kep.close'],
          ['luc-kep.value', 'tay-kep.force'],
          ['diem-gap.inside', 'co-the-gap.a'],
          ['ban-trong.out', 'co-the-gap.b'],
          ['co-the-gap.out', 'duoc-gap.a'],
          ['duoc-gap.out', 'buoc.done1'],
          ['vai.reached', 'da-toi-goc.a'],
          ['khuyu.reached', 'da-toi-goc.b'],
          ['da-toi-goc.out', 'tay-om-kien.a'],
          ['tay-kep.inReach', 'tay-om-kien.b'],
          ['tay-om-kien.out', 'buoc.done2'],
          ['buoc.step3', 'cho-kep.run'],
          ['cho-kep.done', 'kep-chac.a'],
          ['tay-kep.holding', 'kep-chac.b'],
          ['kep-chac.out', 'buoc.done3'],
          ['da-toi-goc.out', 'buoc.done4'],
          ['xoay.reached', 'buoc.done5'],
        ],
        check: (r, _b, l) => {
          expect(r.maxOnTable, l).toBe(0);
          expect(r.offered, l).toBe(0);
          expect(r.taken.length, l).toBe(0);
        },
      },
      {
        name: 'one carton reaches the table and the station stops there (a later step never ends, or "Có kiện chờ" never goes on)',
        wires: [
          ['da-toi-goc.out', 'buoc.done6'],
          ['buoc.step7', 'cho-mo.run'],
          ['cho-mo.done', 'buoc.done7'],
          ['da-toi-goc.out', 'buoc.done8'],
          ['xoay.reached', 'buoc.done9'],
          ['buoc-ha-ban.value', 'tay-da-ve.b'],
          ['cho-giao.inside', 'co-kien-cho.a'],
          ['tay-da-ve.out', 'co-kien-cho.b'],
        ],
        check: (r, _b, l) => {
          expect(r.maxOnTable, l).toBe(1);
          expect(r.offered, l).toBe(0);
          expect(r.taken.length, l).toBe(0);
          expect(r.made.length, l).toBe(2);
        },
      },
      {
        name: '"Có kiện chờ" goes on while the hand is still at the table',
        wires: [['buoc.index', 'tay-da-ve.a']],
        check: (r, _b, l) => {
          expect(r.offered, l).toBeGreaterThanOrEqual(1);
          for (const step of r.offeredAtSteps) expect(step >= 6 && step <= 8, `${l}: offered in step ${step}`).toBe(true);
        },
      },
      {
        name: 'the class pin is wrong (the scan never reaches it)',
        wires: [
          ['cong-quet.first', 'doc-mau.thing'],
          ['doc-mau.index', 'nho-mau.value'],
          ['cong-quet.entered', 'nho-mau.store'],
          ['nho-mau.held', 'loai-kien.value'],
          ['buoc.step3', 'loai-kien.store'],
        ],
        check: (r, _b, l) => {
          expect(r.taken.length, l).toBeGreaterThanOrEqual(4);
          expect(wrongPins(r), l).toEqual({ cls: r.taken.length, kg: 0 });
          expect(r.pins.loai, l).toBe(0);
        },
      },
      {
        name: 'the mass pin is wrong (the scale never reaches it)',
        wires: [
          ['bang.self', 'can.who'],
          ['can.mass', 'khoi-luong.value'],
          ['buoc.step3', 'khoi-luong.store'],
        ],
        check: (r, _b, l) => {
          expect(r.taken.length, l).toBeGreaterThanOrEqual(4);
          expect(wrongPins(r), l).toEqual({ cls: 0, kg: r.taken.length });
          expect(r.pins.kg, l).toBe(0);
        },
      },
      {
        name: 'the arm does not look at the table: with nobody taking cartons away it sets the next one onto the first',
        wires: [['cho-giao.inside', 'ban-trong.in']],
        check: (_r, cut, l) => {
          const untaken = runStation(cut, { seconds: SHORT_S, takeAfterS: null });
          expect(untaken.maxOnTable + untaken.dropped + untaken.slips, l).toBeGreaterThanOrEqual(2);
          // The whole station, left alone, never has two there.
          expect(runStation(factoryBoard(), { seconds: SHORT_S, takeAfterS: null }).maxOnTable).toBe(1);
        },
      },
    ];

    const listed = groups.flatMap((g) => g.wires.map((w) => w.join('>')));
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(STATION_WIRES.map((w) => w.join('>')).sort());
    for (const g of groups) {
      for (const w of g.wires) {
        const cut = cutInside(factoryBoard(), FACTORY_IDS.station, w);
        g.check(runStation(cut, { seconds: SHORT_S }), cut, `${g.name}: ${w.join(' -> ')}`);
      }
    }
  });
});

type Board = ReturnType<typeof factoryBoard>;
