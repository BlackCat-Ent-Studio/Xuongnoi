import { getNodeDef } from '../engine/registry';
import type { Circuit, GraphNode, ParamValue, Params, Wire } from '../engine/types';
import { registerAllNodes } from '../nodes';
import type { CircuitFile } from './circuit-file';

/**
 * Small ready-made circuits offered in the palette group "Bảng mạch". Each is plain data: general pieces, wires, pins,
 * opened settings and (for trying it alone) bench cards. Nothing here is a special piece; a pupil can open one and see how
 * it is made, or build the same thing by hand.
 */

export interface StarterCircuit {
  id: string;
  /** One line under the name in the palette. */
  about: string;
  /** The circuit as a circuit file, ready for `importCircuitFile`. */
  file: CircuitFile;
}

type CardSpec = [id: string, kind: string, x: number, y: number, params?: Record<string, ParamValue>];
type WireSpec = [from: string, to: string];

/** A card as the palette would make it (every setting at its default), with the given settings on top. */
function card([id, kind, x, y, given]: CardSpec): GraphNode {
  const def = getNodeDef(kind);
  if (!def) throw new Error(`starter circuit: unknown piece ${kind}`);
  const params: Params = {};
  for (const p of def.params) params[p.id] = typeof p.default === 'object' ? { ...p.default } : p.default;
  for (const [key, value] of Object.entries(given ?? {})) params[key] = typeof value === 'object' ? { ...value } : value;
  return { id, kind, params, pos: { x, y } };
}

const wires = (specs: WireSpec[]): Wire[] =>
  specs.map(([from, to], i) => {
    const [fn, fp] = from.split('.') as [string, string];
    const [tn, tp] = to.split('.') as [string, string];
    return { id: `w${i + 1}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } };
  });

const inner = (ref: string): { node: string; port: string } => {
  const [node, port] = ref.split('.') as [string, string];
  return { node, port };
};
const setting = (ref: string): { node: string; param: string } => {
  const [node, param] = ref.split('.') as [string, string];
  return { node, param };
};

/**
 * "Đèn nháy": while "Bật" is on, "Đang sáng" goes on and off in a steady beat. A repeating "Hẹn giờ" gives one pulse per
 * beat and a "Công tắc nhớ" flips on each pulse.
 */
function blinker(): Circuit {
  return {
    id: 'den-nhay',
    name: 'Đèn nháy',
    color: '#f7d046',
    graph: {
      nodes: [card(['nhip', 'timer', 0, 0, { seconds: 0.5, repeat: 'yes' }]), card(['den', 'latch', 300, 0])],
      wires: wires([['nhip.done', 'den.toggle']]),
    },
    pins: [
      { id: 'p1', label: 'Bật', dir: 'in', type: 'bool', inner: inner('nhip.run') },
      { id: 'p2', label: 'Đang sáng', dir: 'out', type: 'bool', inner: inner('den.on') },
    ],
    exposed: [{ id: 'e1', label: 'Nhịp nháy (giây)', inner: setting('nhip.seconds') }],
    benchIds: [],
  };
}

/**
 * "Xe hai bánh tới mốc": a chassis with a motor on each side and "Đi tới điểm" steering them. Outside, wire a "Mốc sàn"
 * (or any object) to "Mốc đích" and switch "Chạy" on. The floor and the marker inside are bench cards: they exist only when
 * the circuit is tried alone.
 */
function twoWheelCart(): Circuit {
  return {
    id: 'xe-toi-moc',
    name: 'Xe hai bánh tới mốc',
    color: '#5aa9ff',
    graph: {
      nodes: [
        card(['than', 'robot-body', 0, 0, { position: { x: 0, y: 0.15, z: 0 }, length: 0.9, width: 0.7, height: 0.3, mass: 5 }]),
        card(['lai', 'robot-goto', 330, 60]),
        card(['trai', 'motor', 680, 0, { side: -0.3 }]),
        card(['phai', 'motor', 680, 300, { side: 0.3 }]),
        card(['san-thu', 'block', 0, 560, { position: { x: 0, y: -0.5, z: 0 }, size: { x: 24, y: 1, z: 16 } }]),
        card(['moc-thu', 'floor-marker', 330, 560, { number: 1, position: { x: 4, y: 0, z: 3 } }]),
      ],
      wires: wires([
        ['than.self', 'lai.robot'],
        ['than.self', 'trai.body'],
        ['than.self', 'phai.body'],
        ['lai.left', 'trai.power'],
        ['lai.right', 'phai.power'],
        ['moc-thu.self', 'lai.target'],
      ]),
    },
    pins: [
      { id: 'p1', label: 'Mốc đích', dir: 'in', type: 'object', inner: inner('lai.target') },
      { id: 'p2', label: 'Chạy', dir: 'in', type: 'bool', inner: inner('lai.go') },
      { id: 'p3', label: 'Đã tới', dir: 'out', type: 'bool', inner: inner('lai.arrived') },
      { id: 'p4', label: 'Còn cách', dir: 'out', type: 'number', inner: inner('lai.distance') },
      { id: 'p5', label: 'Thân xe', dir: 'out', type: 'object', inner: inner('than.self') },
    ],
    exposed: [
      { id: 'e1', label: 'Vị trí xuất phát', inner: setting('than.position') },
      { id: 'e2', label: 'Màu xe', inner: setting('than.color') },
      { id: 'e3', label: 'Công suất chạy', inner: setting('lai.power') },
    ],
    benchIds: ['san-thu', 'moc-thu'],
  };
}

let cache: StarterCircuit[] | null = null;

/** The starter circuits, built once. */
export function listStarterCircuits(): StarterCircuit[] {
  if (cache) return cache;
  registerAllNodes();
  const one = (circuit: Circuit, about: string): StarterCircuit => ({ id: circuit.id, about, file: { root: circuit.id, circuits: [circuit] } });
  cache = [
    one(blinker(), 'Bật thì chân "Đang sáng" cứ sáng rồi tắt theo nhịp. Làm từ Hẹn giờ và Công tắc nhớ.'),
    one(twoWheelCart(), 'Thân robot, hai động cơ và Đi tới điểm. Nối một Mốc sàn vào "Mốc đích", bật "Chạy" là xe tự tới.'),
  ];
  return cache;
}
