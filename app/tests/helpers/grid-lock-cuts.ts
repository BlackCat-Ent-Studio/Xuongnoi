import type { Board } from '../../src/engine/types';
import { CATCH_WIRES, GRID_MAIN_WIRES } from '../../src/samples/sorting-grid-floor';
import { GRID_IDS } from '../../src/samples/sorting-grid-plan';
import { ROBOT_WIRES } from '../../src/samples/sorting-grid-robot';
import { cutInside, cutOutside, type Link } from './factory-run';
import { HOLE_LOCK_WIRES, ROBOT_LOCK_WIRES, onlyRoute, onlyRoutes, quickLock, type Cut, type Symptom } from './grid-sample-cuts';

/**
 * The lock of a full cage without one of its wires: the lamp, the latch, the two plates, the lock number the robots read,
 * the wait and the lap inside "Xe phân loại", and the button "Đổi lồng". A cage of the shipped board takes minutes to fill,
 * so each wire is cut on a board whose stations feed route 1 only and whose cages say "Đã đầy" at two cartons (two
 * settings): the first hole is locked after about 20 s. Where the swap is what the wire is for, the script presses "Đổi
 * lồng" 10 s after a hole has locked. The cuts are spread over four test files so that they run side by side.
 */

interface Scene {
  name: string;
  board: () => Board;
  seconds: number;
  /** "Đổi lồng" is pressed this many seconds after a hole has locked. */
  press?: number;
}

const lockBoard = (route = 1): Board => quickLock(onlyRoute(route));

const SCENES = {
  lock: { name: 'only route 1, full at 2', board: () => lockBoard(), seconds: 60 },
  swap: { name: 'only route 1, full at 2', board: () => lockBoard(), seconds: 60, press: 10 },
  // A robot that never comes back from its lap, or never starts a second one, shows after its first lap.
  stand: { name: 'only route 1, full at 2', board: () => lockBoard(), seconds: 100 },
  stand2: { name: 'only route 2, full at 2', board: () => lockBoard(2), seconds: 100 },
  // Three holes fill one after the other: for a while a hole with a lower number is locked and one with a higher number is open.
  three: { name: 'routes 1 to 3, full at 2', board: () => quickLock(onlyRoutes(1, 3)), seconds: 90 },
  // The cage as shipped (full at six): the lamp goes through amber and red.
  fill: { name: 'only route 1', board: () => onlyRoute(1), seconds: 60 },
} satisfies Record<string, Scene>;
type Where = keyof typeof SCENES;

function cutOn(where: Where, label: string, wire: Link, symptom: Symptom, cut: (board: Board) => Board): Cut {
  const b: Scene = SCENES[where];
  return { name: `${label} (${b.name}${b.press === undefined ? '' : ', "Đổi lồng" pressed'}): ${wire.join(' > ')}`, board: () => cut(b.board()), symptom, seconds: b.seconds, from: { name: b.name, board: b.board }, ...(b.press === undefined ? {} : { pressAfterLockedS: b.press }) };
}

const STANDS: Symptom = 'a robot stands for more than 30 s';
const NO_LAP: Symptom = 'no robot takes a lap';
const ON_COVER: Symptom = 'a carton lands on a cover';
const PLATES: Symptom = 'the plates do not follow the lock';
const LAMP: Symptom = 'a lamp does not show the colour for the number in its cage';

// ---------- "Xe phân loại" ----------

export const ROBOT_ROWS: Record<string, [where: Where, symptom: Symptom]> = {
  // Reading digit k of the lock number
  'doc-ma.code > muoi-mu-k.index': ['lock', ON_COVER],
  // Row 1 instead of row k: a locked hole with a lower number reads as "my hole is locked"
  'doc-ma.code > muoi-mu-k-1.index': ['three', 'a robot waits beside an open hole'],
  'muoi-mu-k.value > phan-du.b': ['lock', ON_COVER],
  'phan-du.out > lo-khoa.a': ['lock', ON_COVER],
  'lo-khoa.out > lo-mo.in': ['lock', ON_COVER],
  // Standing still on the stop cell beside a locked hole -> 4 s -> lap
  'doc-moc.number > o-o-do.a': ['lock', NO_LAP],
  'o-do.value > o-o-do.b': ['lock', NO_LAP],
  'than.self > dung-yen.who': ['lock', NO_LAP],
  'o-o-do.out > dung-canh-lo.a': ['lock', NO_LAP],
  'dung-yen.still > dung-canh-lo.b': ['lock', NO_LAP],
  'dung-canh-lo.out > cho-lo.a': ['lock', NO_LAP],
  'lo-khoa.out > cho-lo.b': ['lock', NO_LAP],
  'cho-lo.out > dem-cho.run': ['lock', NO_LAP],
  'dem-cho.done > di-vong.set': ['lock', NO_LAP],
  // The timer is never wound up again: the first lap is the last
  'cho-lo.out > thoi-cho.in': ['stand', STANDS],
  'thoi-cho.out > dem-cho.reset': ['stand', STANDS],
  // The lap: the goal becomes the lap cell, and the stop cell again once the robot is on the lap cell
  'doc-ma.code > o-vong.index': ['stand', STANDS],
  'doc-moc.number > toi-o-vong.a': ['stand', STANDS],
  'o-vong.value > toi-o-vong.b': ['stand', STANDS],
  'toi-o-vong.out > di-vong.reset': ['stand', STANDS],
  'di-vong.on > dang-vong.on': ['stand', STANDS],
  'o-vong.value > lech-vong.a': ['stand', STANDS],
  // Without the stop cell taken off, the goal is "stop cell + lap cell": for route 2 that is no lane cell
  'o-do.value > lech-vong.b': ['stand2', STANDS],
  'lech-vong.out > them-vong.a': ['stand', STANDS],
  'dang-vong.value > them-vong.b': ['stand', STANDS],
  'them-vong.out > o-co-hang.b': ['stand', STANDS],
};

/** The robot's lock wires, in two halves: those that show within a minute, and those that show as a robot that stands for good. */
export function robotLockCuts(standing: boolean): Cut[] {
  return ROBOT_WIRES.filter((w) => ROBOT_LOCK_WIRES.includes(w.join(' > '))).flatMap((w) => {
    const row = ROBOT_ROWS[w.join(' > ')];
    if (!row) throw new Error(`no symptom named for ${w.join(' > ')}`);
    return (row[1] === STANDS) === standing ? [cutOn(row[0], 'Xe phân loại', w, row[1], (b) => cutInside(b, GRID_IDS.robot, w))] : [];
  });
}

// ---------- "Lỗ thả" ----------

export const HOLE_ROWS: Record<string, [where: Where, symptom: Symptom]> = {
  'long.count > bang-mau.index': ['fill', LAMP],
  'bang-mau.value > den.pick': ['lock', LAMP],
  'long.full > khoa.set': ['lock', 'no hole is ever locked and a cage gets more cartons than its capacity'],
  'long.count > long-trong.a': ['swap', 'a hole stays locked over an empty cage'],
  'long-trong.out > khoa.reset': ['swap', 'a hole stays locked over an empty cage'],
  'khoa.on > lo-mo.in': ['swap', PLATES],
  'khoa.on > nap-dong.show': ['lock', PLATES],
  // The plate over the hole is there from the start: every carton is tipped onto it
  'lo-mo.out > nap-dong.hide': ['lock', ON_COVER],
  'khoa.on > nap-mo.hide': ['lock', PLATES],
  'lo-mo.out > nap-mo.show': ['swap', PLATES],
  // The hole does not tell the robots
  'khoa.on > so-khoa.on': ['lock', ON_COVER],
};

export function holeLockCuts(): Cut[] {
  return CATCH_WIRES.filter((w) => HOLE_LOCK_WIRES.includes(w.join(' > '))).map((w) => {
    const row = HOLE_ROWS[w.join(' > ')];
    if (!row) throw new Error(`no symptom named for ${w.join(' > ')}`);
    return cutOn(row[0], 'Lỗ thả', w, row[1], (b) => cutInside(b, GRID_IDS.catch, w));
  });
}

// ---------- the main board ----------

const mainWire = (from: string, to: string): Link => {
  const w = GRID_MAIN_WIRES.find((x) => x[0] === from && x[1] === to);
  if (!w) throw new Error(`no such wire on the main board: ${from} > ${to}`);
  return w;
};
const main = (where: Where, from: string, to: string, symptom: Symptom): Cut => cutOn(where, 'main board', mainWire(from, to), symptom, (b) => cutOutside(b, mainWire(from, to)));

export function mainLockCuts(): Cut[] {
  return [
    // The lock number: from hole 1 into the sum, from the sum to robot 1
    main('lock', 'o-1.bao-khoa', 'tong-khoa.so-1', ON_COVER),
    main('lock', 'tong-khoa.tong', 'xe-1.so-khoa', ON_COVER),
    // "Đổi lồng"
    main('swap', 'bat-dau.started', 'nut-doi.show', 'the swap empties nothing'),
    main('swap', 'nut-doi.pressed', 'bat-doi.a', 'the swap empties nothing'),
    main('swap', 'vung-thu-hoi.inside', 'bat-doi.b', 'the swap empties nothing'),
    main('swap', 'bat-doi.out', 'dang-doi.set', 'the swap empties nothing'),
    main('swap', 'dang-doi.on', 'nhip-thu-hoi.run', 'the swap empties nothing'),
    main('swap', 'vung-thu-hoi.inside', 'het-thung.in', 'the swap never ends'),
    main('swap', 'het-thung.out', 'dang-doi.reset', 'the swap never ends'),
    // One station is not told which carton to take back, or not told when: its cartons stay in the cage
    ...[1, 2].flatMap((s): Cut[] => [main('swap', 'vung-thu-hoi.first', `tram-${s}.vat-thu-hoi`, 'the swap never ends'), main('swap', 'nhip-thu-hoi.done', `tram-${s}.thu-hoi`, 'the swap never ends')]),
  ];
}
