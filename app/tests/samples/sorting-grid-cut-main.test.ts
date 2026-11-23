import { beforeAll, describe } from 'vitest';
import { instanceValueKey } from '../../src/circuits/instance';
import type { Board } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { CATCH_WIRES, GRID_MAIN_WIRES } from '../../src/samples/sorting-grid-floor';
import { GRID, GRID_IDS } from '../../src/samples/sorting-grid-plan';
import { loadRapier } from '../../src/world/rapier-loader';
import { circuitOf, cutInside, cutOutside, type Link } from '../helpers/factory-run';
import { cutTests, onlyRoute, type Cut, type Symptom } from '../helpers/grid-sample-cuts';
import { shippedGrid } from '../helpers/grid-sample-run';

/**
 * The main board, "Ô nhận tuyến" and "Cộng chín số" without one wire. A wire that only reports a fault (a carton in a wrong box, a
 * carton left on the deck floor) or a route that sees few cartons is cut on a board where that thing does happen; such
 * a board differs from the shipped one by settings or by one other missing wire, named in the test.
 *
 * Six robots and nine boxes are wired alike. This file cuts the wires of robot 1 and box 1 and everything that exists
 * once; VITE_GRID_CUT_ALL=1 adds the same cuts for robots 2-6 and boxes 2-9.
 */

beforeAll(async () => {
  registerAllNodes();
  await loadRapier();
});

const ALL = Boolean((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GRID_CUT_ALL);
const text = (w: Link): string => w.join(' > ');
const mainWire = (from: string, to: string): Link => {
  const w = GRID_MAIN_WIRES.find((x) => x[0] === from && x[1] === to);
  if (!w) throw new Error(`no such wire on the main board: ${from} > ${to}`);
  return w;
};

// ---------- boards on which the reported thing happens ----------

/** Every catch box is told another route than the one its hole belongs to, so each carton it gets is a wrong one. */
function boxesMislabelled(board: Board = shippedGrid()): Board {
  for (const n of board.graph.nodes) {
    const k = /^o-(\d)$/.exec(n.id);
    if (k) n.params[instanceValueKey('tuyen')] = (Number(k[1]) % GRID.routes) + 1;
  }
  return board;
}

/** The stations push without looking at the tray, so a second carton is pushed against the first and one lands on the deck floor. */
const stationsPushBlind = (board: Board = shippedGrid()): Board => cutInside(board, GRID_IDS.station, ['khay-xe.inside', 'khay-xe-trong.in']);

const WRONG = { name: 'every box mislabelled', board: () => boxesMislabelled() };
const SPILL = { name: 'stations push blind', board: () => stationsPushBlind() };

// ---------- "Ô nhận tuyến" ----------

const CATCH_SYMPTOMS: Record<string, { symptom: Symptom; faulty?: boolean }> = {
  'bat-dau.started > bang-dan.run': { symptom: 'no carton reaches a box' },
  'vung.entered > dem.up': { symptom: 'the box counters stay at 0' },
  'vung.first > doc-ma.thing': { symptom: 'the wrong-route counters count' },
  'doc-ma.code > khac-tuyen.a': { symptom: 'the wrong-route counters count' },
  'tuyen.value > khac-tuyen.b': { symptom: 'the wrong-route counters count' },
  'khac-tuyen.out > sai-luc-vao.a': { symptom: 'the wrong-route counters stay at 0', faulty: true },
  'vung.entered > sai-luc-vao.b': { symptom: 'the wrong-route counters stay at 0', faulty: true },
  'sai-luc-vao.out > dem-sai.up': { symptom: 'the wrong-route counters stay at 0', faulty: true },
};

const catchCuts: Cut[] = CATCH_WIRES.map((w) => {
  const row = CATCH_SYMPTOMS[text(w)];
  if (!row) throw new Error(`no symptom named for ${text(w)}`);
  return row.faulty
    ? { name: `Ô nhận tuyến (every box mislabelled): ${text(w)}`, board: () => cutInside(boxesMislabelled(), GRID_IDS.catch, w), symptom: row.symptom, from: WRONG }
    : { name: `Ô nhận tuyến: ${text(w)}`, board: () => cutInside(shippedGrid(), GRID_IDS.catch, w), symptom: row.symptom };
});

// ---------- "Cộng chín số" ----------

/** The adder's chain, cut on a board where only route 1 is fed: the number of box 1 goes in at the head of the chain, so every link carries it. */
const FED_1 = { name: 'only route 1', board: () => onlyRoute(1) };
const adderCuts: Cut[] = circuitOf(shippedGrid(), GRID_IDS.adder).graph.wires.map((w): Cut => {
  const link: Link = [`${w.from.node}.${w.from.port}`, `${w.to.node}.${w.to.port}`];
  return { name: `Cộng chín số (only route 1): ${text(link)}`, board: () => cutInside(onlyRoute(1), GRID_IDS.adder, link), symptom: 'screen: total is too small', from: FED_1 };
});

// ---------- the main board ----------

const robots = ALL ? [1, 2, 3, 4, 5, 6] : [1];
const boxes = ALL ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1];
const main = (from: string, to: string, symptom: Symptom): Cut => ({ name: `main board: ${from} > ${to}`, board: () => cutOutside(shippedGrid(), mainWire(from, to)), symptom });

const mainCuts: Cut[] = [
  main('bat-dau.started', 'may-quay.on', 'the camera card does not hold the camera'),
  ...robots.flatMap((k): Cut[] => [
    // Not on the hold card, the robot holds no cell: another robot is let into the cell it stands on.
    main(`xe-${k}.robot`, `giu-o.robot${k}`, 'two robots touch'),
    main(`xe-${k}.o-muon`, `giu-o.want${k}`, `robot ${k} never leaves its cell`),
    main(`giu-o.cell${k}`, `xe-${k}.o-duoc-di`, `robot ${k} never leaves its cell`),
    main(`giu-o.stood${k}`, `xe-${k}.dung-giua-o`, `robot ${k} tips nothing`),
  ]),
  main('vung-thu-hoi.inside', 'nhip-thu-hoi.run', 'counted cartons are not taken back'),
  ...[1, 2].flatMap((s): Cut[] => [
    main('vung-thu-hoi.first', `tram-${s}.vat-thu-hoi`, 'counted cartons are not taken back'),
    main('nhip-thu-hoi.done', `tram-${s}.thu-hoi`, 'counted cartons are not taken back'),
    main(`tram-${s}.ma-cho`, `hien-ma-${s}.value`, `screen: no waiting code at station ${s}` as Symptom),
  ]),
  ...boxes.flatMap((k): Cut[] => {
    const fed = { name: `only route ${k}`, board: () => onlyRoute(k) };
    const fedWrong = { name: `only route ${k}, every box mislabelled`, board: () => boxesMislabelled(onlyRoute(k)) };
    return [
      { name: `main board (only route ${k}): o-${k}.so-kien > hien-${k}.value`, board: () => cutOutside(onlyRoute(k), mainWire(`o-${k}.so-kien`, `hien-${k}.value`)), symptom: `screen: route ${k} stays at 0`, from: fed },
      { name: `main board (only route ${k}): o-${k}.so-kien > tong-kien.so-${k}`, board: () => cutOutside(onlyRoute(k), mainWire(`o-${k}.so-kien`, `tong-kien.so-${k}`)), symptom: 'screen: total is too small', from: fed },
      { name: `main board (only route ${k}, every box mislabelled): o-${k}.sai > tong-sai.so-${k}`, board: () => cutOutside(boxesMislabelled(onlyRoute(k)), mainWire(`o-${k}.sai`, `tong-sai.so-${k}`)), symptom: 'screen: wrong-box number is too small', from: fedWrong },
    ];
  }),
  main('tong-kien.tong', 'hien-tong.value', 'screen: total stays at 0'),
  { name: 'main board (every box mislabelled): tong-sai.tong > hien-sai.value', board: () => cutOutside(boxesMislabelled(), mainWire('tong-sai.tong', 'hien-sai.value')), symptom: 'screen: wrong-box number stays at 0', from: WRONG },
  // A carton left on the deck floor
  ...(
    [
      ['tren-san.inside', 'nam-lau.run'],
      ['nam-lau.done', 'dem-roi.up'],
      ['dem-roi.value', 'hien-roi.value'],
    ] as const
  ).map(([from, to]): Cut => ({ name: `main board (stations push blind): ${from} > ${to}`, board: () => cutOutside(stationsPushBlind(), mainWire(from, to)), symptom: 'screen: on-the-deck number stays at 0', from: SPILL })),
  // Without the reset each time the deck floor is empty, the moments cartons spend falling past the deck's face add up to "one second on the floor".
  { ...main('tren-san.inside', 'san-trong.in', 'screen: on-the-deck number counts'), seconds: 150 },
  { ...main('san-trong.out', 'nam-lau.reset', 'screen: on-the-deck number counts'), seconds: 150 },
];

describe('grid-floor sample, anti-forced: the catch box circuit', () => {
  cutTests(catchCuts);
});

describe('grid-floor sample, anti-forced: the adder circuit', () => {
  cutTests(adderCuts);
});

describe('grid-floor sample, anti-forced: the main board', () => {
  cutTests(mainCuts);
});
