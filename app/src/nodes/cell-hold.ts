import type { EntityId, EntityView, NodeDef, Params, PortDef, PortValues } from '../engine/types';
import { setTileHeld } from '../engine/render-hints';
import { feetOf, listMarkers, markerAt, type MarkerSpot } from './floor-marker';
import { asNum, asObject, clamp, numParam, strParam } from './util';

export const CELL_HOLD_MAX_ROBOTS = 12;
const MIN_ROBOTS = 1;
/** A robot slower than this (m/s) is standing. */
const STANDING_SPEED = 0.05;
/** Tiles whose heights differ by more than this are on another floor than the robot's: its body does not hold them. */
const SAME_FLOOR = 0.3;
const DEFAULT_HELD_COLOR = '#ef4444';

interface RobotSlot {
  /** The chassis wired to this row last tick (a change starts the row again). */
  id: EntityId | null;
  /** The cell this robot is cleared to stand on or drive to (0 = none yet), and the one it was cleared for before. */
  cell: number;
  before: number;
}

interface CellHoldState {
  robots: RobotSlot[];
  /** Tiles painted in the held colour right now: marker id -> the colour to give back, and the card the tile belongs to. */
  painted: Map<EntityId, { color: string; owner: string }>;
}

const rowPorts = (id: string, type: PortDef['type'], vi: (k: number) => string, en: (k: number) => string, extra: Partial<PortDef> = {}): PortDef[] =>
  Array.from({ length: CELL_HOLD_MAX_ROBOTS }, (_, k) => ({ id: `${id}${k + 1}`, type, label: vi(k + 1), labelEn: en(k + 1), ...extra }));

const robotPorts = rowPorts('robot', 'object', (k) => `Robot ${k}`, (k) => `Robot ${k}`);
const wantPorts = rowPorts(
  'want',
  'number',
  (k) => `Ô robot ${k} muốn tới`,
  (k) => `Cell robot ${k} wants`,
  // Usually worked out from what this card answered ("Tìm đường trên lưới" behind "Đọc mốc sàn"): the loop is cut here.
  { feedback: true },
);
const cellPorts = rowPorts('cell', 'number', (k) => `Ô robot ${k} được đi`, (k) => `Cell granted to robot ${k}`);
const waitPorts = rowPorts('wait', 'bool', (k) => `Robot ${k} đang chờ ô`, (k) => `Robot ${k} waiting`);
const stoodPorts = rowPorts('stood', 'bool', (k) => `Robot ${k} đứng giữa ô`, (k) => `Robot ${k} standing on centre`);

/** Robot count as the card uses it: whole and within 1..12. */
export function holdRobotCount(params: Params): number {
  return clamp(Math.round(numParam(params, 'robots', 2)), MIN_ROBOTS, CELL_HOLD_MAX_ROBOTS);
}

/** Half sizes of the upright box round a chassis turned to its heading (any other body: its own box). */
function reachOf(e: EntityView): { hx: number; hz: number } {
  const r = e.robot;
  if (!r) return { hx: e.size.x / 2, hz: e.size.z / 2 };
  const c = Math.abs(Math.cos(r.heading));
  const s = Math.abs(Math.sin(r.heading));
  return { hx: (r.length / 2) * c + (r.width / 2) * s, hz: (r.length / 2) * s + (r.width / 2) * c };
}

const newSlot = (id: EntityId | null): RobotSlot => ({ id, cell: 0, before: 0 });

/**
 * The table of held floor cells, one card for the whole fleet. Rule: one robot per cell. A robot holds every cell its
 * body lies on, plus the one cell it was last cleared for; it is cleared for the cell it asks for when nobody else holds
 * it. It may leave for another cell only from the middle of the one it was cleared for, or, going straight on, as soon
 * as its middle is inside that cell. When two robots ask for one cell on the same tick the lower row wins. Everything a
 * robot knows about the others reaches it through the wires of this card.
 */
export const cellHoldNode: NodeDef<CellHoldState> = {
  kind: 'cell-hold',
  label: 'Bảng giữ ô',
  category: 'brain',
  description:
    'Bảng ghi ô sàn nào đang có robot giữ, dùng chung cho cả đội robot để không xe nào đụng xe nào. Luật: mỗi ô (Mốc sàn) chỉ một robot. Robot giữ các ô thân nó đang đè lên và ô nó vừa được cho đi. Mỗi robot nối "Đối tượng" của Thân robot vào "Robot k" và nối ô nó muốn sang (thường là "Ô kế tiếp" của Tìm đường trên lưới) vào "Ô robot k muốn tới". Ô đó trống thì "Ô robot k được đi" đổi sang số ô đó: nối nó qua Tìm mốc sàn vào "Đích" của Đi tới điểm. Ô đang có robot khác giữ thì "Robot k đang chờ ô" bật và robot đứng lại ở giữa ô của mình. Hai robot xin cùng một ô trong cùng một nhịp thì robot số nhỏ hơn được đi. Robot chỉ được xin ô mới khi đã vào giữa ô đang giữ; đi thẳng tiếp thì được xin sớm hơn để không phải dừng. Khi game chạy, ô đang bị giữ đổi sang "Màu ô đang bị giữ". "Robot k đứng giữa ô" bật khi robot đã dừng hẳn ở giữa ô được cho đi: dùng nó (thay cho "Đã tới") để biết lúc nào được đổ hàng.',
  inputs: [],
  optionalInputs: {
    all: [...robotPorts, ...wantPorts],
    active: (params) => {
      const n = holdRobotCount(params);
      return Array.from({ length: n }, (_, k) => [robotPorts[k]!, wantPorts[k]!]).flat();
    },
  },
  outputs: [{ id: 'held', type: 'number', label: 'Số ô đang bị giữ' }],
  optionalOutputs: {
    all: [...cellPorts, ...waitPorts, ...stoodPorts],
    active: (params) => {
      const n = holdRobotCount(params);
      return Array.from({ length: n }, (_, k) => [cellPorts[k]!, waitPorts[k]!, stoodPorts[k]!]).flat();
    },
  },
  params: [
    { id: 'robots', label: `Số robot (${MIN_ROBOTS}-${CELL_HOLD_MAX_ROBOTS})`, kind: 'number', default: 2, min: MIN_ROBOTS, max: CELL_HOLD_MAX_ROBOTS, step: 1 },
    {
      id: 'flow',
      label: 'Đi thẳng thì xin ô kế tiếp sớm',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Có (đi thẳng không phải dừng ở từng ô)' },
        { value: 'no', label: 'Không (ô nào cũng dừng ở giữa rồi mới xin)' },
      ],
    },
    { id: 'arriveWithin', label: 'Coi như đứng giữa ô khi còn cách (m)', kind: 'number', default: 0.06, min: 0.01, max: 1, step: 0.01 },
    { id: 'heldColor', label: 'Màu ô đang bị giữ', kind: 'color', default: DEFAULT_HELD_COLOR },
  ],
  create: () => ({ robots: Array.from({ length: CELL_HOLD_MAX_ROBOTS }, () => newSlot(null)), painted: new Map() }),
  evaluate(ctx, i, params, s) {
    const n = holdRobotCount(params);
    const within = numParam(params, 'arriveWithin', 0.06);
    const flow = strParam(params, 'flow', 'yes') === 'yes';
    const markers = listMarkers(ctx.world);
    const byNumber = new Map<number, MarkerSpot>();
    // Two markers with one number: the one made first counts, as "Tìm mốc sàn" has it.
    for (const m of markers) if (!byNumber.has(m.number)) byNumber.set(m.number, m);

    // Who is on the floor this tick. A row whose robot is gone, hidden or swapped for another starts again.
    const bodies: (EntityView | null)[] = [];
    const taken = new Set<EntityId>();
    for (let k = 0; k < n; k++) {
      const id = asObject(i[`robot${k + 1}`]);
      const view = id !== null && !taken.has(id) ? ctx.world.getEntity(id) : undefined;
      const body = view && view.visible ? view : null;
      if (body) taken.add(body.id);
      const slot = s.robots[k]!;
      if ((body?.id ?? null) !== slot.id) s.robots[k] = newSlot(body?.id ?? null);
      bodies.push(body);
    }

    // The table is written afresh every tick: first the cell each robot is cleared for, then every cell a body lies on.
    const holds = new Map<number, number>();
    for (let k = 0; k < n; k++) {
      const body = bodies[k];
      const slot = s.robots[k]!;
      if (!body) continue;
      if (slot.cell === 0) {
        const under = markerAt(markers, ctx.mode, feetOf(body));
        // A robot that starts on a cell somebody already holds gets no cell of its own; its body still holds what it lies on.
        if (under && !holds.has(under.number)) slot.cell = under.number;
      }
      if (slot.cell > 0) holds.set(slot.cell, k);
    }
    for (let k = 0; k < n; k++) {
      const body = bodies[k];
      if (!body) continue;
      const feet = feetOf(body);
      const { hx, hz } = reachOf(body);
      const side = ctx.mode === '2d-side';
      const under = markers.filter((m) => Math.abs(feet.x - m.x) < m.size / 2 + hx && (side || Math.abs(feet.z - m.z) < m.size / 2 + hz));
      const floor = under.reduce<MarkerSpot | null>((best, m) => (!best || Math.abs(m.y - feet.y) < Math.abs(best.y - feet.y) ? m : best), null);
      for (const m of under) if (floor && Math.abs(m.y - floor.y) <= SAME_FLOOR && !holds.has(m.number)) holds.set(m.number, k);
    }

    // Requests, lowest row first.
    const out: PortValues = {};
    for (let k = 0; k < n; k++) {
      const body = bodies[k];
      const slot = s.robots[k]!;
      let waiting = false;
      let stood = false;
      const here = body ? byNumber.get(slot.cell) : undefined;
      if (body && here) {
        const off = Math.hypot(body.position.x - here.x, ctx.mode === '2d-side' ? 0 : body.position.z - here.z);
        const centred = off <= within;
        stood = centred && Math.abs(body.robot?.speed ?? 0) < STANDING_SPEED;
        const want = Math.round(asNum(i[`want${k + 1}`]));
        const there = want > 0 && want !== slot.cell ? byNumber.get(want) : undefined;
        if (there) {
          const was = byNumber.get(slot.before);
          const straight = was !== undefined && Math.abs(there.x - here.x - (here.x - was.x)) < 1e-6 && Math.abs(there.z - here.z - (here.z - was.z)) < 1e-6;
          const inside = Math.abs(body.position.x - here.x) < here.size / 2 && Math.abs(body.position.z - here.z) < here.size / 2;
          if (centred || (flow && straight && inside)) {
            const holder = holds.get(want);
            if (holder === undefined || holder === k) {
              slot.before = slot.cell;
              slot.cell = want;
              holds.set(want, k);
              stood = false;
            } else waiting = true;
          }
        }
      }
      out[`cell${k + 1}`] = body ? slot.cell : 0;
      out[`wait${k + 1}`] = waiting;
      out[`stood${k + 1}`] = stood;
    }

    // Held tiles show it: painted in the held colour, and given their own colour back when they are let go.
    const heldColor = strParam(params, 'heldColor', DEFAULT_HELD_COLOR);
    const heldIds = new Set<EntityId>();
    for (const cell of holds.keys()) {
      const m = byNumber.get(cell);
      if (m) heldIds.add(m.id);
    }
    for (const [id, own] of s.painted) {
      if (heldIds.has(id)) continue;
      ctx.world.setEntityStyle(id, { color: own.color });
      setTileHeld(own.owner, id, false);
      s.painted.delete(id);
    }
    for (const id of heldIds) {
      const tile = ctx.world.getEntity(id);
      if (!tile) continue;
      if (!s.painted.has(id)) {
        s.painted.set(id, { color: tile.color, owner: tile.ownerNodeId });
        // The scene washes the whole tile, so a held cell shows even with a robot standing on its ring and arrows.
        setTileHeld(tile.ownerNodeId, id, true);
      }
      if (tile.color !== heldColor) ctx.world.setEntityStyle(id, { color: heldColor });
    }

    out.held = holds.size;
    return out;
  },
};
