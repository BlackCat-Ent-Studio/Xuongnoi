import { beforeAll, describe } from 'vitest';
import { registerAllNodes } from '../../src/nodes';
import { GRID_IDS } from '../../src/samples/sorting-grid-plan';
import { ROBOT_WIRES } from '../../src/samples/sorting-grid-robot';
import { loadRapier } from '../../src/world/rapier-loader';
import { cutInside } from '../helpers/factory-run';
import { cutTests, onlyRoute, type Cut, type Symptom } from '../helpers/grid-sample-cuts';
import { shippedGrid } from '../helpers/grid-sample-run';

/**
 * "Xe phân loại" without one of its inner wires (the wire is gone from all six copies), first half: chassis, way finding, tray mounting, the carton on the tray and the choice of the goal cell.
 * The table names what each cut does to a run of 45 s (20 s where it shows at once).
 */

beforeAll(async () => {
  registerAllNodes();
  await loadRapier();
});

const SYMPTOMS: Record<string, Symptom> = {
  'than.self > trai.body': 'no robot leaves its cell',
  'than.self > phai.body': 'no robot leaves its cell',
  'than.self > lai.robot': 'no robot leaves its cell',
  'lai.left > trai.power': 'no robot leaves its cell',
  'lai.right > phai.power': 'no robot leaves its cell',
  'than.self > doc-moc.who': 'no robot leaves its cell',
  'doc-moc.number > tim-duong.at': 'no robot leaves its cell',
  'tim-moc.marker > lai.target': 'no robot leaves its cell',
  'than.self > ban-xoay.base': 'no robot leaves its cell',
  'ban-xoay.tip > khop-nghieng.base': 'no robot leaves its cell',
  'khop-nghieng.tip > khay.base': 'cartons end on the deck floor or on the ground',
  'bat-dau.started > ban-xoay.power': 'no carton reaches a box',
  'bat-dau.started > khop-nghieng.power': 'no robot leaves its cell',
  'than.self > tren-khay.follow': 'no carton reaches a box',
  'tren-khay.first > doc-ma.thing': 'cartons end on the deck floor or on the ground',
  'tren-khay.inside > khay-trong.in': 'cartons end on the deck floor or on the ground',
  'tren-khay.inside > cho-yen.run': 'no carton reaches a box',
  'khay-trong.out > cho-yen.reset': 'cartons end on the deck floor or on the ground',
  'doc-ma.code > nho-ma.value': 'cartons end on the deck floor or on the ground',
  'cho-yen.done > nho-ma.store': 'cartons end on the deck floor or on the ground',
  'doc-ma.code > o-do.index': 'cartons end on the deck floor or on the ground',
  'nho-ma.held > tram-ve.index': 'cartons end on the deck floor or on the ground',
  'khay-trong.out > ve-tram.on': 'no robot leaves its cell',
  'tram-ve.value > o-tram.a': 'no robot leaves its cell',
};

const named = (wire: string): Symptom => {
  const symptom = SYMPTOMS[wire];
  if (!symptom) throw new Error(`no symptom named for ${wire}`);
  return symptom;
};

const wires = ROBOT_WIRES.slice(0, 24);
/** The turntable starts on the right-hand side; only a route whose hole is on the left (route 4) needs it to turn. */
const LEFT_ROUTE = 4;
const TURNTABLE_POWER = 'bat-dau.started > ban-xoay.power';
const cuts: Cut[] = wires.map((w): Cut => {
  const name = w.join(' > ');
  if (name === TURNTABLE_POWER) return { name: `Xe phân loại (only route ${LEFT_ROUTE}): ${name}`, board: () => cutInside(onlyRoute(LEFT_ROUTE), GRID_IDS.robot, w), symptom: named(name), from: { name: `only route ${LEFT_ROUTE}`, board: () => onlyRoute(LEFT_ROUTE) } };
  return { name: `Xe phân loại: ${name}`, board: () => cutInside(shippedGrid(), GRID_IDS.robot, w), symptom: named(name) };
});

describe('grid-floor sample, anti-forced: the robot circuit, driving and choosing the goal', () => {
  cutTests(cuts);
});
