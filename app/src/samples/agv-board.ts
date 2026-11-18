import type { Board, GraphNode, NodeGroup, Note, Params, Wire } from '../engine/types';

/**
 * Sample "Xe tự hành chở hàng (AGV)": an automated guided vehicle follows a painted loop with two stations.
 * At the loading station a fixed two-joint arm lifts a crate from a table onto the vehicle; at the unloading station a
 * piston pushes the crate off onto a receiving platform. Nothing is driven by a person: it all runs after "Chơi".
 * Built only from general pieces and wires; no piece knows about "AGV", "station" or "delivery".
 * Plain data (no registry lookups), so the sample list can build it before any node is registered.
 */

type Spec = { id: string; kind: string; params?: Params };
type Link = [fromNode: string, fromPort: string, toNode: string, toPort: string];

/** Numbers the notes on the board quote and the tests pin. */
export const AGV_SETTINGS = {
  /** Heaviest load (kg) the chassis may carry; a crate weighs 1 kg. */
  maxPayload: 3,
  chassisMass: 5,
  /** Top speed share of the motors: the speed gain at full signal. */
  speedGain: 0.7,
  kp: 3,
  /** Pull of each drive motor (N) at full power. */
  motorForce: 6,
  /** Taught joint angles (degrees): [shoulder, elbow] over the supply table, down at the crate, over the vehicle. */
  poses: {
    overTable: [120, 95],
    atCrate: [146, 95],
    overVehicle: [27, -92],
  } as const,
  pistonForce: 100,
};

/** Rows (inputs + outputs) of a card by kind, to stack cards without overlap. */
const ROWS: Record<string, number> = {
  block: 8, 'line-track': 1, 'robot-body': 6, 'line-sensor': 6, math: 3, 'map-range': 2, pid: 7, motor: 4, zone: 6, compare: 3, and: 3, or: 3,
  not: 2, sequence: 10, joint: 8, link: 2, gripper: 10, spawner: 7, 'linear-actuator': 9, counter: 9, 'show-number': 1, 'show-text': 2,
  camera: 5, 'on-start': 2,
};
const cardHeight = (kind: string): number => 40 + (ROWS[kind] ?? 4) * 26 + 8;
const GAP = 34;
const COL = 310;

/** Stacks the cards of each column top to bottom. */
function stack(specs: readonly Spec[], columns: readonly (readonly string[])[], x0: number, y0: number): GraphNode[] {
  const byId = new Map(specs.map((s) => [s.id, s]));
  const out: GraphNode[] = [];
  columns.forEach((col, c) => {
    let y = y0;
    for (const id of col) {
      const s = byId.get(id);
      if (!s) throw new Error(`agv sample: unknown card ${id}`);
      out.push({ id: s.id, kind: s.kind, params: structuredClone(s.params ?? {}), pos: { x: x0 + c * COL, y } });
      y += cardHeight(s.kind) + GAP;
    }
  });
  return out;
}

// ------------------------------------------------------------------ the world (loose on the board)

const WORLD: Spec[] = [
  { id: 'san', kind: 'block', params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 20, y: 1, z: 11 }, color: '#475569' } },
  { id: 'duong', kind: 'line-track', params: { shape: 'custom', count: 4, closed: 'yes', smooth: 'yes', radius: 1.4, center: { x: 0, y: 0.02, z: 0 }, width: 0.3, color: '#f8fafc', p1: { x: -3.5, y: 0, z: -2.5 }, p2: { x: 3.5, y: 0, z: -2.5 }, p3: { x: 3.5, y: 0, z: 2.5 }, p4: { x: -3.5, y: 0, z: 2.5 } } },
  {
    id: 'than',
    kind: 'robot-body',
    params: { position: { x: 0, y: 0.2, z: 2.5 }, heading: 180, length: 1.2, width: 1, height: 0.3, mass: AGV_SETTINGS.chassisMass, friction: 0.8, color: '#f59e0b', maxPayload: AGV_SETTINGS.maxPayload, showPayload: 'yes' },
  },
  { id: 'tru', kind: 'block', params: { position: { x: -5.5, y: 0.8, z: 0 }, size: { x: 0.6, y: 1.6, z: 0.6 }, color: '#94a3b8' } },
  { id: 'ban-cap', kind: 'block', params: { position: { x: -7.5, y: 0.4, z: 0 }, size: { x: 1.2, y: 0.8, z: 1.2 }, color: '#78716c' } },
  { id: 'de-xi-lanh', kind: 'block', params: { position: { x: 1.1, y: 0.15, z: 0 }, size: { x: 2.2, y: 0.3, z: 0.8 }, color: '#64748b' } },
  { id: 'mang-nhan', kind: 'block', params: { position: { x: 5.1, y: 0.1, z: 0 }, size: { x: 1.7, y: 0.2, z: 1.2 }, color: '#16a34a' } },
  { id: 'chan-cuoi', kind: 'block', params: { position: { x: 6.05, y: 0.4, z: 0 }, size: { x: 0.2, y: 0.8, z: 1.2 }, color: '#15803d' } },
  { id: 'khi-bat-dau', kind: 'on-start' },
  { id: 'may-quay', kind: 'camera', params: { mode: 'fixed', point: { x: -1.4, y: 0.8, z: 0.1 }, zoom: 0.92, view: 'tilted', smoothness: 0 } },
];
const WORLD_COLUMNS: string[][] = [['san', 'duong', 'than'], ['tru', 'ban-cap', 'de-xi-lanh'], ['mang-nhan', 'chan-cuoi', 'khi-bat-dau', 'may-quay']];

// ------------------------------------------------------------------ group "Bám line"

const LINE: Spec[] = [
  { id: 'mat-trai', kind: 'line-sensor', params: { side: -0.22, forward: 0.65, spot: 0.2 } },
  { id: 'mat-giua', kind: 'line-sensor', params: { side: 0, forward: 0.65, spot: 0.2 } },
  { id: 'mat-phai', kind: 'line-sensor', params: { side: 0.22, forward: 0.65, spot: 0.2 } },
  { id: 'lech', kind: 'math', params: { op: 'sub' } },
  { id: 'pid', kind: 'pid', params: { kp: AGV_SETTINGS.kp, ki: 0, kd: 0, target: 0, outMin: -1, outMax: 1 } },
  { id: 'toc-do', kind: 'math', params: { op: 'mul' } },
  { id: 'cong-trai', kind: 'math', params: { op: 'add' } },
  { id: 'tru-phai', kind: 'math', params: { op: 'sub' } },
  { id: 'dc-trai', kind: 'motor', params: { side: -0.45, maxRpm: 90, maxForce: AGV_SETTINGS.motorForce } },
  { id: 'dc-phai', kind: 'motor', params: { side: 0.45, maxRpm: 90, maxForce: AGV_SETTINGS.motorForce } },
];
const LINE_COLUMNS: string[][] = [['mat-trai', 'mat-giua', 'mat-phai'], ['lech', 'toc-do', 'cong-trai', 'tru-phai'], ['pid'], ['dc-trai', 'dc-phai']];

// ------------------------------------------------------------------ group "Trạm dừng"

const STATIONS: Spec[] = [
  { id: 'vung-nap', kind: 'zone', params: { center: { x: -3.5, y: 0.3, z: -0.2 }, size: { x: 1.2, y: 1, z: 0.6 }, filter: 'robot', rule: 'center', color: '#22c55e' } },
  { id: 'vung-do', kind: 'zone', params: { center: { x: 3.5, y: 0.3, z: 0.2 }, size: { x: 1.2, y: 1, z: 0.6 }, filter: 'robot', rule: 'center', color: '#ef4444' } },
  { id: 'co-hang', kind: 'map-range', params: { inMin: 0, inMax: 0.5, outMin: 0, outMax: 1, clamp: 'yes' } },
  { id: 'trong', kind: 'map-range', params: { inMin: 0, inMax: 0.5, outMin: 1, outMax: 0, clamp: 'yes' } },
  { id: 'dung-nap', kind: 'math', params: { op: 'mul' } },
  { id: 'dung-do', kind: 'math', params: { op: 'mul' } },
  { id: 'dung', kind: 'math', params: { op: 'add' } },
  { id: 'he-so', kind: 'map-range', params: { inMin: 0, inMax: 1, outMin: AGV_SETTINGS.speedGain, outMax: 0, clamp: 'yes' } },
  { id: 'rong', kind: 'compare', params: { op: 'lt' } },
  { id: 'nguong', kind: 'const', params: { value: 0.5 } },
  { id: 'co-tai', kind: 'compare', params: { op: 'ge' } },
];
const STATION_COLUMNS: string[][] = [['vung-nap', 'vung-do'], ['co-hang', 'trong', 'nguong'], ['dung-nap', 'dung-do', 'rong', 'co-tai'], ['dung', 'he-so']];

// ------------------------------------------------------------------ group "Tay máy nạp hàng"
// Card ids of this group sort after "buoc", so the step sequence is the one place where the wires loop back.

const ARM: Spec[] = [
  { id: 'vai', kind: 'joint', params: { axis: 'pitch', start: AGV_SETTINGS.poses.overTable[0], min: -10, max: 175, maxTorque: 150, maxSpeed: 90, mount: { x: 0, y: 0.8, z: 0 } } },
  { id: 'canh-tren', kind: 'link', params: { length: 1.5, mass: 1.2, thickness: 0.22 } },
  { id: 'khuyu', kind: 'joint', params: { axis: 'pitch', start: AGV_SETTINGS.poses.overTable[1], min: -120, max: 120, maxTorque: 90, maxSpeed: 90 } },
  { id: 'canh-duoi', kind: 'link', params: { length: 1.2, mass: 0.9, thickness: 0.18 } },
  { id: 'kep', kind: 'gripper', params: { defaultForce: 20, maxForce: 120, fingerMu: 0.8, width: 1, reach: 0.5, mass: 0.5 } },
  { id: 'buoc', kind: 'sequence', params: { stepCount: 6, loop: 'yes' } },
  { id: 'tao-thung', kind: 'spawner', params: { template: 'item', shape: 'crate', position: { x: -7.5, y: 1.7, z: 0 }, size: { x: 0.5, y: 0.5, z: 0.5 }, color: '#a16207', maxAlive: 6, lifetime: 90 } },
  { id: 'dk-san-sang', kind: 'and' },
  { id: 'dk-tay-xong', kind: 'and' },
  { id: 'dk-tay-gan', kind: 'and' },
  { id: 'dk-tay-giu', kind: 'and' },
  { id: 'dk-b1', kind: 'and' },
  { id: 'dk-b2', kind: 'and' },
  { id: 'dk-b3', kind: 'and' },
  { id: 'dk-b46', kind: 'or' },
  { id: 'dk-b4', kind: 'and' },
  { id: 'dk-b5', kind: 'and' },
  { id: 'dk-hop-1', kind: 'or' },
  { id: 'dk-hop-2', kind: 'or' },
  { id: 'dk-hop-3', kind: 'or' },
  { id: 'dk-hop-4', kind: 'or' },
  { id: 'dk-kep', kind: 'or' },
  { id: 'goc-vai-2', kind: 'map-range', params: { inMin: 1, inMax: 2, outMin: AGV_SETTINGS.poses.overTable[0], outMax: AGV_SETTINGS.poses.atCrate[0], clamp: 'yes' } },
  { id: 'goc-vai-3', kind: 'map-range', params: { inMin: 2, inMax: 3, outMin: 0, outMax: AGV_SETTINGS.poses.overTable[0] - AGV_SETTINGS.poses.atCrate[0], clamp: 'yes' } },
  { id: 'goc-vai-4', kind: 'map-range', params: { inMin: 3, inMax: 4, outMin: 0, outMax: AGV_SETTINGS.poses.overVehicle[0] - AGV_SETTINGS.poses.overTable[0], clamp: 'yes' } },
  { id: 'goc-vai-6', kind: 'map-range', params: { inMin: 5, inMax: 6, outMin: 0, outMax: AGV_SETTINGS.poses.overTable[0] - AGV_SETTINGS.poses.overVehicle[0], clamp: 'yes' } },
  { id: 'goc-vai-a', kind: 'math', params: { op: 'add' } },
  { id: 'goc-vai-b', kind: 'math', params: { op: 'add' } },
  { id: 'goc-vai-c', kind: 'math', params: { op: 'add' } },
  { id: 'goc-khuyu-4', kind: 'map-range', params: { inMin: 3, inMax: 4, outMin: AGV_SETTINGS.poses.overTable[1], outMax: AGV_SETTINGS.poses.overVehicle[1], clamp: 'yes' } },
  { id: 'goc-khuyu-6', kind: 'map-range', params: { inMin: 5, inMax: 6, outMin: 0, outMax: AGV_SETTINGS.poses.overTable[1] - AGV_SETTINGS.poses.overVehicle[1], clamp: 'yes' } },
  { id: 'goc-khuyu-a', kind: 'math', params: { op: 'add' } },
];
const ARM_COLUMNS: string[][] = [
  ['buoc', 'tao-thung'],
  ['dk-san-sang', 'dk-tay-xong', 'dk-tay-gan', 'dk-tay-giu'],
  ['dk-b1', 'dk-b2', 'dk-b3', 'dk-b46'],
  ['dk-b4', 'dk-b5', 'dk-hop-1', 'dk-hop-2'],
  ['dk-hop-3', 'dk-hop-4', 'dk-kep'],
  ['goc-vai-2', 'goc-vai-3', 'goc-vai-4', 'goc-vai-6', 'goc-khuyu-4', 'goc-khuyu-6'],
  ['goc-vai-a', 'goc-vai-b', 'goc-vai-c', 'goc-khuyu-a'],
  ['vai', 'khuyu'],
  ['canh-tren', 'canh-duoi', 'kep'],
];

// ------------------------------------------------------------------ group "Dỡ hàng"

const UNLOAD: Spec[] = [
  { id: 'dk-do-hang', kind: 'and' },
  { id: 'xi-lanh', kind: 'linear-actuator', params: { position: { x: 0.1, y: 0.68, z: 0 }, direction: 0, orient: 'ground', stroke: 1.9, maxForce: AGV_SETTINGS.pistonForce, speed: 1.2, headSize: 0.6 } },
];
const UNLOAD_COLUMNS: string[][] = [['dk-do-hang'], ['xi-lanh']];

// ------------------------------------------------------------------ group "Đếm và hiện số"

const SHOW: Spec[] = [
  { id: 'dk-day-ra', kind: 'compare', params: { op: 'ge' } },
  { id: 'dk-giao-xong', kind: 'and' },
  { id: 'dem-thung', kind: 'counter', params: { start: 0, target: 99 } },
  { id: 'dem-vong', kind: 'counter', params: { start: -1, target: 99 } },
  { id: 'hien-tai', kind: 'show-number', params: { label: 'Khối lượng đang chở (kg)', corner: 'top-left' } },
  { id: 'hien-toc-do', kind: 'show-number', params: { label: 'Tốc độ (m/s)', corner: 'top-left' } },
  { id: 'hien-thung', kind: 'show-number', params: { label: 'Thùng đã giao', corner: 'top-left' } },
  { id: 'hien-vong', kind: 'show-number', params: { label: 'Số vòng đã chạy', corner: 'top-left' } },
  { id: 'dk-dang-chay', kind: 'compare', params: { op: 'ge' } },
  { id: 'dk-khong-qua-tai', kind: 'not' },
  { id: 'dk-chay-that', kind: 'and' },
  { id: 'chu-chay', kind: 'show-text', params: { text: 'Đang chạy theo line', color: '#16a34a', corner: 'top-right' } },
  { id: 'chu-nap', kind: 'show-text', params: { text: 'Trạm nạp: tay máy đặt thùng lên xe', color: '#2563eb', corner: 'top-right' } },
  { id: 'chu-do', kind: 'show-text', params: { text: 'Trạm dỡ: xi lanh đẩy thùng ra', color: '#dc2626', corner: 'top-right' } },
  { id: 'chu-qua-tai', kind: 'show-text', params: { text: 'QUÁ TẢI: thùng nặng hơn tải tối đa, xe không đi', color: '#dc2626', corner: 'top-right' } },
];
const SHOW_COLUMNS: string[][] = [
  ['dk-day-ra', 'dk-giao-xong', 'dem-thung', 'dem-vong'],
  ['hien-tai', 'hien-toc-do', 'hien-thung', 'hien-vong'],
  ['dk-dang-chay', 'dk-khong-qua-tai', 'dk-chay-that'],
  ['chu-chay', 'chu-nap', 'chu-do', 'chu-qua-tai'],
];

const NODE_SPECS: Spec[] = [...WORLD, ...LINE, ...STATIONS, ...ARM, ...UNLOAD, ...SHOW];

/** Every wire of the board. Nothing is hidden inside a piece: what one piece tells another travels on one of these. */
export const AGV_WIRES: readonly Link[] = [
  // --- line following: eyes read the line, the PID turns the difference into steering, two motors move the chassis
  ['than', 'self', 'mat-trai', 'who'], ['than', 'self', 'mat-giua', 'who'], ['than', 'self', 'mat-phai', 'who'],
  ['duong', 'self', 'mat-trai', 'track'], ['duong', 'self', 'mat-giua', 'track'], ['duong', 'self', 'mat-phai', 'track'],
  ['mat-trai', 'level', 'lech', 'a'], ['mat-phai', 'level', 'lech', 'b'],
  ['lech', 'out', 'pid', 'measured'],
  ['mat-giua', 'level', 'toc-do', 'a'], ['he-so', 'value', 'toc-do', 'b'],
  ['toc-do', 'out', 'cong-trai', 'a'], ['pid', 'out', 'cong-trai', 'b'],
  ['toc-do', 'out', 'tru-phai', 'a'], ['pid', 'out', 'tru-phai', 'b'],
  ['cong-trai', 'out', 'dc-trai', 'power'], ['tru-phai', 'out', 'dc-phai', 'power'],
  ['than', 'self', 'dc-trai', 'body'], ['than', 'self', 'dc-phai', 'body'],
  // --- stations: the chassis stops where it is empty at the loading zone or loaded at the unloading zone
  ['than', 'payload', 'co-hang', 'value'], ['than', 'payload', 'trong', 'value'],
  ['vung-nap', 'count', 'dung-nap', 'a'], ['trong', 'value', 'dung-nap', 'b'],
  ['vung-do', 'count', 'dung-do', 'a'], ['co-hang', 'value', 'dung-do', 'b'],
  ['dung-nap', 'out', 'dung', 'a'], ['dung-do', 'out', 'dung', 'b'],
  ['dung', 'out', 'he-so', 'value'],
  ['than', 'payload', 'rong', 'a'], ['nguong', 'value', 'rong', 'b'],
  ['than', 'payload', 'co-tai', 'a'], ['nguong', 'value', 'co-tai', 'b'],
  // --- arm: base -> joint -> link -> joint -> link -> gripper
  ['tru', 'self', 'vai', 'base'], ['vai', 'tip', 'canh-tren', 'base'], ['canh-tren', 'tip', 'khuyu', 'base'], ['khuyu', 'tip', 'canh-duoi', 'base'], ['canh-duoi', 'tip', 'kep', 'base'],
  ['khi-bat-dau', 'started', 'vai', 'power'], ['khi-bat-dau', 'started', 'khuyu', 'power'],
  // arm: the step sequence, advanced by feedback from the pieces
  ['vung-nap', 'inside', 'dk-san-sang', 'a'], ['rong', 'out', 'dk-san-sang', 'b'],
  ['vai', 'reached', 'dk-tay-xong', 'a'], ['khuyu', 'reached', 'dk-tay-xong', 'b'],
  ['dk-tay-xong', 'out', 'dk-tay-gan', 'a'], ['kep', 'inReach', 'dk-tay-gan', 'b'],
  ['buoc', 'step1', 'dk-b1', 'a'], ['dk-san-sang', 'out', 'dk-b1', 'b'],
  ['buoc', 'step2', 'dk-b2', 'a'], ['dk-tay-gan', 'out', 'dk-b2', 'b'],
  ['dk-tay-xong', 'out', 'dk-tay-giu', 'a'], ['kep', 'holding', 'dk-tay-giu', 'b'],
  ['buoc', 'step3', 'dk-b3', 'a'], ['dk-tay-giu', 'out', 'dk-b3', 'b'],
  ['buoc', 'step4', 'dk-b46', 'a'], ['buoc', 'step6', 'dk-b46', 'b'],
  ['dk-b46', 'out', 'dk-b4', 'a'], ['dk-tay-xong', 'out', 'dk-b4', 'b'],
  ['buoc', 'step5', 'dk-b5', 'a'], ['co-tai', 'out', 'dk-b5', 'b'],
  ['dk-b1', 'out', 'dk-hop-1', 'a'], ['dk-b2', 'out', 'dk-hop-1', 'b'],
  ['dk-b3', 'out', 'dk-hop-2', 'a'], ['dk-b4', 'out', 'dk-hop-2', 'b'],
  ['dk-hop-1', 'out', 'dk-hop-3', 'a'], ['dk-hop-2', 'out', 'dk-hop-3', 'b'],
  ['dk-hop-3', 'out', 'dk-hop-4', 'a'], ['dk-b5', 'out', 'dk-hop-4', 'b'],
  ['dk-hop-4', 'out', 'buoc', 'next'],
  ['buoc', 'step3', 'dk-kep', 'a'], ['buoc', 'step4', 'dk-kep', 'b'],
  ['dk-kep', 'out', 'kep', 'close'],
  ['buoc', 'step1', 'tao-thung', 'spawn'],
  // arm: taught angles, picked by the step number
  ['buoc', 'index', 'goc-vai-2', 'value'], ['buoc', 'index', 'goc-vai-3', 'value'], ['buoc', 'index', 'goc-vai-4', 'value'], ['buoc', 'index', 'goc-vai-6', 'value'],
  ['goc-vai-2', 'value', 'goc-vai-a', 'a'], ['goc-vai-3', 'value', 'goc-vai-a', 'b'],
  ['goc-vai-a', 'out', 'goc-vai-b', 'a'], ['goc-vai-4', 'value', 'goc-vai-b', 'b'],
  ['goc-vai-b', 'out', 'goc-vai-c', 'a'], ['goc-vai-6', 'value', 'goc-vai-c', 'b'],
  ['goc-vai-c', 'out', 'vai', 'angle'],
  ['buoc', 'index', 'goc-khuyu-4', 'value'], ['buoc', 'index', 'goc-khuyu-6', 'value'],
  ['goc-khuyu-4', 'value', 'goc-khuyu-a', 'a'], ['goc-khuyu-6', 'value', 'goc-khuyu-a', 'b'],
  ['goc-khuyu-a', 'out', 'khuyu', 'angle'],
  // --- unloading: the piston pushes while the chassis sits loaded in the unloading zone
  ['vung-do', 'inside', 'dk-do-hang', 'a'], ['co-tai', 'out', 'dk-do-hang', 'b'],
  ['dk-do-hang', 'out', 'xi-lanh', 'extend'],
  // --- counters and readouts
  ['xi-lanh', 'positionNow', 'dk-day-ra', 'a'], ['nguong', 'value', 'dk-day-ra', 'b'],
  ['rong', 'out', 'dk-giao-xong', 'a'], ['dk-day-ra', 'out', 'dk-giao-xong', 'b'],
  ['dk-giao-xong', 'out', 'dem-thung', 'up'], ['vung-nap', 'entered', 'dem-vong', 'up'],
  ['than', 'payload', 'hien-tai', 'value'], ['than', 'speed', 'hien-toc-do', 'value'],
  ['dem-thung', 'value', 'hien-thung', 'value'], ['dem-vong', 'value', 'hien-vong', 'value'],
  ['he-so', 'value', 'dk-dang-chay', 'a'], ['nguong', 'value', 'dk-dang-chay', 'b'],
  ['than', 'overloaded', 'dk-khong-qua-tai', 'in'],
  ['dk-dang-chay', 'out', 'dk-chay-that', 'a'], ['dk-khong-qua-tai', 'out', 'dk-chay-that', 'b'],
  ['dk-chay-that', 'out', 'chu-chay', 'show'], ['than', 'self', 'chu-chay', 'anchor'],
  ['dk-san-sang', 'out', 'chu-nap', 'show'], ['than', 'self', 'chu-nap', 'anchor'],
  ['dk-do-hang', 'out', 'chu-do', 'show'], ['than', 'self', 'chu-do', 'anchor'],
  ['than', 'overloaded', 'chu-qua-tai', 'show'], ['than', 'self', 'chu-qua-tai', 'anchor'],
  // camera
  ['khi-bat-dau', 'started', 'may-quay', 'on'],
];

const NOTES: Note[] = [
  {
    id: 'n1',
    color: 'yellow',
    pos: { x: 40, y: 580 },
    size: { w: 320, h: 250 },
    text:
      'Xe tự hành chở hàng (AGV): bấm Chơi là cả máy tự chạy, không cần bấm phím nào.\nXe cam chạy theo vạch trắng quanh một vòng kín và có 2 trạm: TRẠM NẠP (bên trái, tay máy) và TRẠM DỠ (bên phải, xi lanh đẩy). Mỗi vòng xe chở một thùng 1 kg từ trạm nạp sang trạm dỡ.\nBấm vào một nhóm (khối màu ở trên) để xem dây bên trong.',
  },
  {
    id: 'n2',
    color: 'blue',
    pos: { x: 380, y: 580 },
    size: { w: 320, h: 250 },
    text:
      'Nhóm "Bám line": 3 mắt dò line nhìn xuống sàn. Sai lệch = mắt trái trừ mắt phải. Bộ PID đổi sai lệch thành lệnh lái: động cơ trái cộng lệnh, động cơ phải trừ lệnh. Mắt giữa thấy vạch càng rõ thì xe chạy càng nhanh.',
  },
  {
    id: 'n3',
    color: 'green',
    pos: { x: 720, y: 580 },
    size: { w: 340, h: 250 },
    text:
      'Nhóm "Trạm dừng": xe dừng khi (ở trạm nạp mà xe còn TRỐNG) hoặc (ở trạm dỡ mà xe đang CHỞ hàng). Xe biết mình chở hay trống nhờ ô "Khối lượng đang chở" của Thân robot. Hàng lên xe thì xe tự đi tiếp, hàng được lấy xuống thì xe tự đi tiếp. Tín hiệu dừng (0 hoặc 1) nhân với tốc độ nên khi dừng xe không chạy.',
  },
  {
    id: 'n4',
    color: 'green',
    pos: { x: 1080, y: 580 },
    size: { w: 360, h: 250 },
    text:
      'Nhóm "Tay máy nạp hàng": Chuỗi bước có 6 bước: 1 chờ xe vào trạm nạp, 2 hạ tay xuống (chờ "có vật trong tầm"), 3 kẹp (chờ "đang giữ"), 4 đưa thùng sang xe (chờ cả hai khớp "đã tới góc"), 5 nhả thùng (chờ xe báo đã chở), 6 về chỗ cũ. Các góc đã dạy (vai, khuỷu): 120/95, 146/95, 27/-92 độ.',
  },
  {
    id: 'n5',
    color: 'pink',
    pos: { x: 1460, y: 580 },
    size: { w: 340, h: 250 },
    text:
      'Nhóm "Dỡ hàng": khi xe đứng ở trạm dỡ và đang chở hàng thì xi lanh đẩy ra, đẩy thùng khỏi xe sang bệ nhận. Hết hàng thì xi lanh tự rút về và xe đi tiếp. Lực cần để đẩy = μ × m × 9,81 = 0,5 × 1 × 9,81 ≈ 4,9 N cho mỗi thùng bị đẩy (xi lanh có 100 N). Thùng tự biến mất sau 90 giây (mảnh Tạo đối tượng, "Sống bao lâu") để bệ nhận không bị đầy.',
  },
  {
    id: 'n6',
    color: 'yellow',
    pos: { x: 1820, y: 580 },
    size: { w: 380, h: 250 },
    text:
      'Thử đổi thông số:\n1) Thân robot, mục Nâng cao, "Tải tối đa" = 0,5 kg: thùng 1 kg nặng hơn tải tối đa, hiện "QUÁ TẢI" và xe đứng yên ở trạm nạp.\n2) Xi lanh đẩy, "Lực đẩy tối đa" = 3 N: nhỏ hơn 4,9 N nên xi lanh không đẩy nổi, hiện "Quá tải" và xe chờ mãi ở trạm dỡ.\n3) Thân robot "Khối lượng" = 20 kg: xe nặng nên tăng tốc chậm hơn (a = F / m, hai động cơ kéo 2 × 4,2 = 8,4 N).\n4) Bộ PID "Kp" = 0: xe không lái nữa và đi lệch khỏi line.',
  },
  {
    id: 'n7',
    color: 'blue',
    pos: { x: 2240, y: 580 },
    size: { w: 380, h: 250 },
    text:
      'Vật lý thật (đã bật): thùng là vật rắn thật nằm trên lưng xe, xi lanh đẩy nó trượt ra khỏi xe. Mỗi động cơ kéo 6 N × công suất 0,7 = 4,2 N, hai động cơ 8,4 N. Xe trống nặng 5 kg tăng tốc a = 8,4 / 5 = 1,68 m/s², xe chở thùng 1 kg (6 kg) chỉ a = 8,4 / 6 = 1,4 m/s²: đạt 0,9 m/s sau 0,54 giây khi trống và 0,64 giây khi có hàng. Sàn giữ được μ·m·g = 0,8 × 5 × 9,81 = 39 N, lớn hơn lực kéo nên bánh không trượt.',
  },
];

function groups(): NodeGroup[] {
  const ids = (specs: readonly Spec[], skip: readonly string[] = []): string[] => specs.map((s) => s.id).filter((id) => !skip.includes(id));
  return [
    { id: 'grp-line', name: 'Bám line', color: '#5aa9ff', nodeIds: ids(LINE), x: 40, y: 40 },
    { id: 'grp-tram', name: 'Trạm dừng', color: '#f7d046', nodeIds: ids(STATIONS), x: 330, y: 40 },
    { id: 'grp-tay', name: 'Tay máy nạp hàng', color: '#3ecf8e', nodeIds: ids(ARM), x: 620, y: 40 },
    { id: 'grp-do', name: 'Dỡ hàng', color: '#ff7f7f', nodeIds: ids(UNLOAD), x: 910, y: 40 },
    { id: 'grp-hien', name: 'Đếm và hiện số', color: '#a894ff', nodeIds: ids(SHOW), x: 1200, y: 40 },
  ];
}

/** The sample board. Fresh objects on every call. */
export function createAgvBoard(): Board {
  const nodes: GraphNode[] = [
    ...stack(NODE_SPECS, WORLD_COLUMNS, 40, 920),
    ...stack(NODE_SPECS, LINE_COLUMNS, 40, 40),
    ...stack(NODE_SPECS, STATION_COLUMNS, 40, 40),
    ...stack(NODE_SPECS, ARM_COLUMNS, 40, 40),
    ...stack(NODE_SPECS, UNLOAD_COLUMNS, 40, 40),
    ...stack(NODE_SPECS, SHOW_COLUMNS, 40, 40),
  ];
  const wires: Wire[] = AGV_WIRES.map(([fn, fp, tn, tp], i) => ({ id: `w${i + 1}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } }));
  return {
    name: 'Xe tự hành chở hàng (AGV)',
    mode: '3d',
    graph: { nodes, wires, groups: groups(), settings: { wireRule: true, realPhysics: true } },
    notes: structuredClone(NOTES),
  };
}
