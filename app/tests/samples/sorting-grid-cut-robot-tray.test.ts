import { beforeAll, describe } from 'vitest';
import { registerAllNodes } from '../../src/nodes';
import { GRID_IDS } from '../../src/samples/sorting-grid-plan';
import { ROBOT_WIRES } from '../../src/samples/sorting-grid-robot';
import { loadRapier } from '../../src/world/rapier-loader';
import { cutInside } from '../helpers/factory-run';
import { ROBOT_LOCK_WIRES, cutTests, type Cut, type Symptom } from '../helpers/grid-sample-cuts';
import { shippedGrid } from '../helpers/grid-sample-run';

/**
 * "Xe phân loại" without one of its inner wires (the wire is gone from all six copies), second half: turning the tray, tipping, and when the robot may drive.
 * The table names what each cut does to a run of 45 s (20 s where it shows at once).
 */

beforeAll(async () => {
  registerAllNodes();
  await loadRapier();
});

const SYMPTOMS: Record<string, Symptom> = {
  've-tram.value > o-tram.b': 'no robot leaves its cell',
  'o-do.value > o-co-hang.a': 'cartons end on the deck floor or on the ground',
  'o-co-hang.out > o-dich.a': 'cartons end on the deck floor or on the ground',
  'o-tram.out > o-dich.b': 'no robot leaves its cell',
  'o-dich.out > tim-duong.goal': 'no robot leaves its cell',
  'tim-duong.hasNext > da-toi.in': 'cartons end on the deck floor or on the ground',
  'da-toi.out > dung-o-dich.b': 'no carton reaches a box',
  'dung-o-dich.out > toi-noi.a': 'no carton reaches a box',
  'cho-yen.done > toi-noi.b': 'no carton reaches a box',
  'doc-ma.code > ben-do.index': 'cartons end on the deck floor or on the ground',
  'ben-do.value > nho-ben.value': 'cartons end on the deck floor or on the ground',
  'toi-noi.out > duoc-do.a': 'no carton reaches a box',
  'duoc-do.out > nho-ben.store': 'cartons end on the deck floor or on the ground',
  'nho-ben.held > ban-xoay.angle': 'cartons end on the deck floor or on the ground',
  'duoc-do.out > lenh-do.a': 'no carton reaches a box',
  // Without the threshold every hole reads as locked; without "the hole is open" the tray is never told to tip
  'muoi-mu-k-1.value > lo-khoa.b': 'no carton reaches a box',
  'lo-mo.out > duoc-do.b': 'no carton reaches a box',
  'ban-xoay.reached > lenh-do.b': 'no carton reaches a box',
  'lenh-do.out > goc-nghieng.on': 'no carton reaches a box',
  'goc-nghieng.value > khop-nghieng.angle': 'no carton reaches a box',
  'lenh-do.out > dem-do.up': 'the tip counters stay at 0',
  'khop-nghieng.reached > chay.a': 'no robot leaves its cell',
  'khay-trong.out > duoc-di.a': 'no robot leaves its cell',
  'cho-yen.done > duoc-di.b': 'no carton reaches a box',
  'duoc-di.out > chay.b': 'no robot leaves its cell',
  'chay.out > lai.go': 'no robot leaves its cell',
};

const named = (wire: string): Symptom => {
  const symptom = SYMPTOMS[wire];
  if (!symptom) throw new Error(`no symptom named for ${wire}`);
  return symptom;
};

/** The wires that only speak beside a locked hole are cut in the lock file, on a board where a hole does lock. */
const wires = ROBOT_WIRES.slice(24).filter((w) => !ROBOT_LOCK_WIRES.includes(w.join(' > ')));
const cuts: Cut[] = wires.map((w) => ({ name: `Xe phân loại: ${w.join(' > ')}`, board: () => cutInside(shippedGrid(), GRID_IDS.robot, w), symptom: named(w.join(' > ')) }));

describe('grid-floor sample, anti-forced: the robot circuit, tipping and leaving', () => {
  cutTests(cuts);
});
