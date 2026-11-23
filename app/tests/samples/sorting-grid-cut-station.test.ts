import { beforeAll, describe } from 'vitest';
import { registerAllNodes } from '../../src/nodes';
import { GRID_IDS } from '../../src/samples/sorting-grid-plan';
import { GRID_STATION_WIRES } from '../../src/samples/sorting-grid-station';
import { loadRapier } from '../../src/world/rapier-loader';
import { cutInside } from '../helpers/factory-run';
import { cutTests, type Cut, type Symptom } from '../helpers/grid-sample-cuts';
import { shippedGrid } from '../helpers/grid-sample-run';

/**
 * "Trạm nạp" without one of its inner wires (the wire is gone from both copies). The table names what each cut does to
 * a run of 45 s (20 s where it shows at once).
 */

beforeAll(async () => {
  registerAllNodes();
  await loadRapier();
});

const SYMPTOMS: Record<string, Symptom> = {
  'tren-ban.inside > ban-trong.in': 'a station makes cartons without end',
  'ban-trong.out > duoc-nap.a': 'no carton is made',
  'xi-lanh.retracted > duoc-nap.b': 'no carton is made',
  'duoc-nap.out > nhip-nap.run': 'no carton is made',
  'nhip-nap.done > xuc-xac.roll': 'no carton reaches a box',
  'xuc-xac.value > tao-kien.code': 'no carton reaches a box',
  'nhip-nap.done > tao-kien.spawn': 'no carton is made',
  'tren-ban.first > doc-ma.thing': 'screen: no waiting code at station 1',
  'xe-do.first > xe-dung-yen.who': 'no carton gets onto a tray',
  'xe-do.inside > xe-san-sang.a': 'no carton gets onto a tray',
  'xe-dung-yen.still > xe-san-sang.b': 'no carton gets onto a tray',
  'khay-xe.inside > khay-xe-trong.in': 'cartons end on the deck floor or on the ground',
  'tren-ban.inside > co-the-day.a': 'no carton gets onto a tray',
  'khay-xe-trong.out > co-the-day.b': 'no carton gets onto a tray',
  'xe-san-sang.out > lenh-day.a': 'no carton gets onto a tray',
  'co-the-day.out > lenh-day.b': 'no carton gets onto a tray',
  'lenh-day.out > dang-day.set': 'no carton gets onto a tray',
  'xi-lanh.extended > dang-day.reset': 'at most half as many cartons reach a box',
  'dang-day.on > xi-lanh.extend': 'no carton gets onto a tray',
  'xi-lanh.extended > dem-nap.up': 'the load counters stay at 0',
};

const named = (wire: string): Symptom => {
  const symptom = SYMPTOMS[wire];
  if (!symptom) throw new Error(`no symptom named for ${wire}`);
  return symptom;
};

const cuts: Cut[] = GRID_STATION_WIRES.map((w) => ({ name: `Trạm nạp: ${w.join(' > ')}`, board: () => cutInside(shippedGrid(), GRID_IDS.station, w), symptom: named(w.join(' > ')) }));

describe('grid-floor sample, anti-forced: the station circuit', () => {
  cutTests(cuts);
});
