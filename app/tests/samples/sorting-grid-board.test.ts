import { beforeAll, describe, expect, it } from 'vitest';
import { runnableGraph } from '../../src/circuits/runnable';
import { validateCircuits } from '../../src/circuits/validate';
import { boardIssues } from '../../src/editor/circuits/circuit-issues';
import { estimateNodeSize } from '../../src/editor/graph/graph-geometry';
import { STUDENT_CARD_METRICS, relayoutShipped } from '../../src/editor/graph/shipped-layout';
import { CIRCUIT_KIND, type Board } from '../../src/engine/types';
import { laneArrows } from '../../src/handbook/boards-grid-floor';
import { listSamples, parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { FACTORY_STATIONS_NAME } from '../../src/samples/sorting-factory-stations';
import { GRID_FLOOR_NAME, GRID_MAIN_WIRES, LAMP_ROWS, SWAP_BUTTON, cageLabel, catchPlace, createGridFloorBoard, lockNumber } from '../../src/samples/sorting-grid-floor';
import { CAGE, CARTON, CATCH, COVER, GRID, GRID_IDS, LAMP, LOCK_WAIT_S, ROBOT, ROUTES, STARTS, STATION_CELLS, cellNumber, cellPlace, isLaneCell, stationNumber } from '../../src/samples/sorting-grid-plan';
import { GRID_SAMPLE_ID, shippedGrid } from '../helpers/grid-sample-run';

beforeAll(() => registerAllNodes());

const copiesOf = (board: Board, circuit: string) => board.graph.nodes.filter((n) => n.kind === CIRCUIT_KIND && n.params.circuit === circuit);

describe('the grid-floor sorting sample as it ships', () => {
  it('is the second sorting entry of the "Bài mẫu" menu, and both entries carry their short name only', () => {
    const samples = listSamples();
    const stations = samples.find((s) => s.id === 'sorting-factory')!;
    const grid = samples.find((s) => s.id === GRID_SAMPLE_ID)!;
    expect(stations.label).toBe('Xưởng phân loại kiện hàng (đang dựng: phần trạm)');
    expect(stations.label).toBe(FACTORY_STATIONS_NAME);
    expect(grid.label).toBe('Xưởng phân loại kiện hàng (đang dựng: sàn lưới)');
    expect(grid.label).toBe(GRID_FLOOR_NAME);
    expect(samples.indexOf(grid)).toBe(samples.indexOf(stations) + 1);
    expect(grid.board.name).toBe(GRID_FLOOR_NAME);
    expect(grid.board.mode).toBe('3d');
    expect(grid.board.graph.settings).toEqual({ wireRule: true, realPhysics: true });
  });

  it('survives save and load unchanged, and its circuits validate', () => {
    const made = createGridFloorBoard();
    const res = parseBoard(serializeBoard(made));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(JSON.parse(serializeBoard(res.board))).toEqual(JSON.parse(serializeBoard(made)));
    // No setting carries rounding noise such as 4.199999999999999.
    expect(/\d\.\d{7,}/.test(serializeBoard(made))).toBe(false);
    expect(validateCircuits(res.board)).toEqual([]);
    expect(() => runnableGraph(res.board)).not.toThrow();
  });

  it('opens with nothing in "Việc cần sửa"', () => {
    const board = shippedGrid();
    expect(boardIssues(board, board.mode)).toEqual([]);
  });

  it('is made of five circuits: one floor, two stations, six robots on one hold card, nine holes, three adders', () => {
    const board = shippedGrid();
    expect(board.circuits!.map((c) => c.name)).toEqual(['Sàn lưới', 'Trạm nạp', 'Xe phân loại', 'Lỗ thả', 'Cộng chín số']);
    expect(copiesOf(board, GRID_IDS.floor).length).toBe(1);
    expect(copiesOf(board, GRID_IDS.station).length).toBe(2);
    expect(copiesOf(board, GRID_IDS.robot).length).toBe(GRID.robots);
    expect(copiesOf(board, GRID_IDS.catch).length).toBe(GRID.routes);
    expect(copiesOf(board, GRID_IDS.adder).length).toBe(3);
    expect(board.graph.nodes.filter((n) => n.kind === 'cell-hold').length).toBe(1);
    expect(board.graph.nodes.find((n) => n.kind === 'cell-hold')!.params.robots).toBe(GRID.robots);
    // Every robot is wired to its own row of the one hold card with four wires.
    const links = GRID_MAIN_WIRES.map((w) => w.join('>'));
    for (let k = 1; k <= GRID.robots; k++) {
      for (const w of [`xe-${k}.robot>giu-o.robot${k}`, `xe-${k}.o-muon>giu-o.want${k}`, `giu-o.cell${k}>xe-${k}.o-duoc-di`, `giu-o.stood${k}>xe-${k}.dung-giua-o`]) expect(links, w).toContain(w);
    }
    // No wire leads from a robot to a station or to a hole: they meet only in the world. Besides the hold card a robot
    // has one more wire: the lock number, the sum of what the nine holes report.
    for (const [from, to] of GRID_MAIN_WIRES) {
      const ends = [from.split('.')[0]!, to.split('.')[0]!];
      if (ends.some((e) => e.startsWith('xe-'))) expect(ends.some((e) => e === 'giu-o' || e === 'tong-khoa'), `${from} -> ${to}`).toBe(true);
    }
    for (let k = 1; k <= GRID.robots; k++) expect(links).toContain(`tong-khoa.tong>xe-${k}.so-khoa`);
    for (const r of ROUTES) expect(links).toContain(`o-${r.code}.bao-khoa>tong-khoa.so-${r.code}`);
    // No circuit prints on the screen or needs a key: copies of one circuit would print the same line on top of each other.
    for (const c of board.circuits!) for (const n of c.graph.nodes) expect(['show-number', 'show-text', 'camera', 'key', 'stick', 'ui-button'].includes(n.kind), `${c.id}/${n.id}`).toBe(false);
    // One button on the main board stands in for swapping the cages.
    expect(board.graph.nodes.filter((n) => n.kind === 'ui-button').map((n) => n.params.text)).toEqual([SWAP_BUTTON]);
    expect(SWAP_BUTTON).toBe('Đổi lồng');
    expect(board.notes!.some((n) => n.text.includes('"Đổi lồng"') && n.text.includes('ĐỨNG THAY'))).toBe(true);
    expect(board.graph.nodes.filter((n) => n.kind === 'show-number').map((n) => n.params.label)).toEqual([
      'Tổng kiện đã phân loại',
      'Kiện vào sai ô',
      'Kiện nằm lại trên mặt sàn',
      ...ROUTES.map((r) => cageLabel(r.code)),
      'Trạm 1: mã kiện đang chờ',
      'Trạm 2: mã kiện đang chờ',
    ]);
  });

  it('the floor: a deck of 3 x 3 holes of 0.7 m at 2.6 m, 40 lane markers of 1.4 m with one-way arrows (row 0 east, column 0 north)', () => {
    const flat = runnableGraph(shippedGrid());
    const deck = flat.nodes.find((n) => n.kind === 'raised-deck')!;
    expect(deck.params).toMatchObject({ top: 2.6, holeCols: 3, holeRows: 3, hole: 0.7, pitch: 2.8, length: 9.8, width: 9.8, legs: 'solid' });
    const markers = flat.nodes.filter((n) => n.kind === 'floor-marker');
    expect(markers.length).toBe(40);
    for (let r = 0; r < GRID.rows; r++) {
      for (let c = 0; c < GRID.cols; c++) {
        const m = markers.find((n) => n.params.number === cellNumber(r, c));
        expect(m !== undefined, `cell ${r},${c}`).toBe(isLaneCell(r, c));
        if (!m) continue;
        expect(m.params.position).toEqual(cellPlace(r, c));
        expect(m.params.size).toBe(1.4);
        expect(m.params.exits).toBe(laneArrows(r, c, GRID.rows, GRID.cols));
        expect(String(m.params.exits).length).toBeGreaterThan(0);
      }
    }
    expect(markers.find((n) => n.params.number === cellNumber(0, 1))!.params.exits).toBe('E');
    expect(markers.find((n) => n.params.number === cellNumber(1, 0))!.params.exits).toBe('N');
    expect(markers.find((n) => n.params.number === cellNumber(2, 1))!.params.exits).toBe('W');
    expect(markers.find((n) => n.params.number === cellNumber(1, 2))!.params.exits).toBe('S');
  });

  it('the routes: code k leads to the lane cell north of hole k, the tray turns to the side the hole is on, and the way home is a station cell', () => {
    expect(ROUTES.map((r) => r.code)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const r of ROUTES) {
      const [hr, hc] = r.hole;
      expect(hr % 2 === 1 && hc % 2 === 1, `route ${r.code}`).toBe(true);
      expect(r.stop).toEqual([hr - 1, hc]);
      expect(isLaneCell(...r.stop)).toBe(true);
      // The lane of the stop cell runs east or west; the hole lies south of it: on the right of an eastbound robot.
      const arrow = laneArrows(r.stop[0], r.stop[1], GRID.rows, GRID.cols);
      expect(arrow === 'E' || arrow === 'W', `route ${r.code}`).toBe(true);
      expect(r.turn).toBe(arrow === 'E' ? 90 : -90);
      expect([stationNumber(1), stationNumber(2)]).toContain(r.home);
      expect(STATION_CELLS.some(([sr, sc]) => sr === r.stop[0] && sc === r.stop[1])).toBe(false);
    }
    expect(new Set(ROUTES.map((r) => cellNumber(...r.stop))).size).toBe(GRID.routes);
    // The three tables every robot carries hold exactly these routes, and each catch box its own route.
    const flat = runnableGraph(shippedGrid());
    const row = (id: string, k: number) => flat.nodes.find((n) => n.id === id)!.params[`v${k}`];
    for (let x = 1; x <= GRID.robots; x++) {
      for (const r of ROUTES) {
        expect(row(`xe-${x}/o-do`, r.code)).toBe(cellNumber(...r.stop));
        expect(row(`xe-${x}/ben-do`, r.code)).toBe(r.turn);
        expect(row(`xe-${x}/tram-ve`, r.code)).toBe(r.home);
        // The lap cell is the next cell down the lane of the stop cell; the two tables that pick digit k of the lock number hold 10^k and 10^(k-1).
        const [sr, sc] = r.stop;
        expect(r.lap).toEqual([sr, laneArrows(sr, sc, GRID.rows, GRID.cols) === 'E' ? sc + 1 : sc - 1]);
        expect(isLaneCell(...r.lap)).toBe(true);
        expect(row(`xe-${x}/o-vong`, r.code)).toBe(cellNumber(...r.lap));
        expect(row(`xe-${x}/muoi-mu-k`, r.code)).toBe(10 * lockNumber(r.code));
        expect(row(`xe-${x}/muoi-mu-k-1`, r.code)).toBe(lockNumber(r.code));
      }
      expect(flat.nodes.find((n) => n.id === `xe-${x}/dem-cho`)!.params).toMatchObject({ seconds: 4, repeat: 'no' });
      expect(LOCK_WAIT_S).toBe(4);
      expect(flat.nodes.find((n) => n.id === `xe-${x}/nho-ma`)!.params.start).toBe(STARTS[x - 1]!.route);
      expect(flat.nodes.find((n) => n.id === `xe-${x}/than`)!.params.look).toBe('agv');
    }
    for (const r of ROUTES) {
      expect(flat.nodes.find((n) => n.id === `o-${r.code}/tuyen`)!.params.value).toBe(r.code);
      // A locked hole k reports 10^(k-1): digit k of the sum.
      expect(flat.nodes.find((n) => n.id === `o-${r.code}/so-khoa`)!.params).toMatchObject({ whenOn: 10 ** (r.code - 1), whenOff: 0 });
      // The cage stands under its hole; the belt lies between the stop cell and the hole and runs towards the hole.
      const at = catchPlace(r.code);
      const cage = flat.nodes.find((n) => n.id === `o-${r.code}/long`)!;
      expect(cage.kind).toBe('container');
      expect(cage.params).toMatchObject({ position: at, inside: 1, wall: 1, capacity: 6, clearance: 0.35, look: 'roll-cage' });
      // The lamp stands on the deck in a corner of the hole's cell, clear of the lanes; it is green, amber from 5, red from 6.
      const lamp = flat.nodes.find((n) => n.id === `o-${r.code}/den`)!.params;
      expect(lamp).toMatchObject({ style: 'signal-tower', type: 'pickup', size: LAMP.size });
      const lampAt = lamp.position as { x: number; y: number; z: number };
      // To the millimetre: positions on the board are rounded to it.
      expect(lampAt.y - LAMP.size.y / 2).toBeCloseTo(GRID.top, 2);
      expect(Math.max(Math.abs(lampAt.x - at.x), Math.abs(lampAt.z - at.z)) + LAMP.size.x / 2).toBeLessThan(GRID.pitch / 2);
      expect(Math.min(Math.abs(lampAt.x - at.x), Math.abs(lampAt.z - at.z)) - LAMP.size.x / 2).toBeGreaterThan(GRID.hole / 2);
      // The plate over the hole covers the whole opening and lies on the deck; the parked one lies just south of it.
      const over = flat.nodes.find((n) => n.id === `o-${r.code}/nap-dong`)!.params;
      const beside = flat.nodes.find((n) => n.id === `o-${r.code}/nap-mo`)!.params;
      expect(over).toMatchObject({ style: 'hole-cover', type: 'solid', size: COVER.size });
      expect(beside).toMatchObject({ style: 'hole-cover', type: 'pickup', size: COVER.size });
      const overAt = over.position as { x: number; y: number; z: number };
      const besideAt = beside.position as { x: number; y: number; z: number };
      expect(overAt.y - COVER.size.y / 2).toBeCloseTo(GRID.top, 9);
      expect(COVER.size.x / 2).toBeGreaterThan(GRID.hole / 2);
      expect(overAt.z - COVER.size.z / 2).toBeCloseTo(at.z - GRID.hole / 2, 9);
      expect(overAt.z + COVER.size.z / 2).toBeGreaterThan(at.z + GRID.hole / 2);
      expect(besideAt.z - overAt.z).toBeCloseTo(COVER.size.z, 9);
      expect(besideAt.x).toBe(overAt.x);
      expect(at.x).toBeCloseTo(r.hole[1] * GRID.pitch, 9);
      expect(at.z).toBeCloseTo(r.hole[0] * GRID.pitch, 9);
      expect(at.y).toBe(0);
      const belt = flat.nodes.find((n) => n.id === `o-${r.code}/bang-dan`)!.params;
      const stop = cellPlace(...r.stop);
      const pos = belt.position as { x: number; y: number; z: number };
      const size = belt.size as { x: number; y: number; z: number };
      expect(pos.x).toBeCloseTo(stop.x, 9);
      expect(pos.z - size.z / 2).toBeCloseTo(stop.z + CATCH.belt.from, 9);
      expect(pos.z + size.z / 2).toBeCloseTo(at.z - GRID.hole / 2, 9);
      expect(pos.y - size.y / 2).toBeCloseTo(GRID.top, 9);
      expect(belt.beltDir).toBe('z');
    }
    // The two stations draw their codes from different seeds.
    expect(flat.nodes.find((n) => n.id === 'tram-1/xuc-xac')!.params.seed).not.toBe(flat.nodes.find((n) => n.id === 'tram-2/xuc-xac')!.params.seed);
    for (const s of [1, 2]) expect(flat.nodes.find((n) => n.id === `tram-${s}/tao-kien`)!.params).toMatchObject({ wireCode: 'yes', recallPorts: 'yes', lifetime: 0, look: 'parcel-carton' });
    // One station alone may hold every carton the floor has room for: nine full cages, six trays, two tables.
    expect(CARTON.maxAlive).toBeGreaterThanOrEqual(GRID.routes * CAGE.capacity + GRID.robots + 2);
    expect(CARTON.maxAlive).toBeLessThanOrEqual(200);
    expect(LAMP_ROWS).toEqual([3, 3, 3, 3, 2, 1]);
    expect([LAMP.red, LAMP.amber, LAMP.green]).toEqual([1, 2, 3]);
    // The zone of "Đổi lồng" spans the inside of all nine cages, from the floor plates to the rims, and the shaft zone of a hole lies between the rim and the deck.
    const swapZone = flat.nodes.find((n) => n.id === 'vung-thu-hoi')!.params;
    expect((swapZone.center as { y: number }).y - (swapZone.size as { y: number }).y / 2).toBeCloseTo(CAGE.clearance + 0.05, 9);
    expect((swapZone.center as { y: number }).y + (swapZone.size as { y: number }).y / 2).toBeCloseTo(CAGE.clearance + 0.05 + CAGE.wall, 9);
    expect(CATCH.shaft.from).toBeGreaterThan(CAGE.rimY);
    expect(CATCH.shaft.to).toBeLessThan(GRID.top - 0.2);
    expect(CAGE.clearance).toBeGreaterThan(ROBOT.height);
  });

  it('no card lies on another at the biggest card size, on the main board and inside every circuit', () => {
    const board = shippedGrid();
    const overlap = (p: { x: number; y: number; w: number; h: number }, q: { x: number; y: number; w: number; h: number }): boolean => p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y;
    // Of the copies drawn as one stacked block only the first is a card on the canvas: the block stands where that copy is.
    const stacks = board.graph.stacks!;
    expect(stacks).toEqual([GRID_IDS.robot, GRID_IDS.catch]);
    const rows = new Map(board.circuits!.map((c) => [c.id, Math.max(c.pins.filter((p) => p.dir === 'in').length, c.pins.filter((p) => p.dir === 'out').length)]));
    const drawn = board.graph.nodes.filter((n) => !stacks.includes(String(n.params.circuit)) || n === board.graph.nodes.find((m) => m.params.circuit === n.params.circuit));
    expect(drawn.length).toBe(board.graph.nodes.length - (GRID.robots - 1) - (GRID.routes - 1));
    const boxes = drawn.map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y, ...(n.kind === CIRCUIT_KIND ? { w: 350, h: 60 + 34 * (rows.get(String(n.params.circuit)) ?? 4) } : estimateNodeSize(n, STUDENT_CARD_METRICS)) }));
    for (const p of boxes) for (const q of boxes) if (p.id < q.id) expect(overlap(p, q), `${p.id}/${q.id}`).toBe(false);
    // The notes lie on no card either.
    for (const note of board.notes!) for (const q of boxes) expect(overlap({ x: note.pos.x, y: note.pos.y, w: note.size.w, h: note.size.h }, q), `${note.id}/${q.id}`).toBe(false);
    for (const c of board.circuits!) {
      const inner = c.graph.nodes.map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y, ...estimateNodeSize(n, STUDENT_CARD_METRICS) }));
      for (const p of inner) for (const q of inner) if (p.id < q.id) expect(overlap(p, q), `${c.id}: ${p.id}/${q.id}`).toBe(false);
    }
    // The app spreads a shipped board at that size when it opens it: this one is already spread.
    expect(relayoutShipped(board).graph.nodes.map((n) => n.pos)).toEqual(board.graph.nodes.map((n) => n.pos));
  });
});
