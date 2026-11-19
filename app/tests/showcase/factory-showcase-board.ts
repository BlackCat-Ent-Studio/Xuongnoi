/**
 * Development-only board that puts every factory look side by side: two AGVs with a tilt tray (one hinged at the back,
 * one at the side through a turntable joint), an arm on its base, a row of parcels in every look, a chute on a raised
 * floor and an open-frame belt with a scan gate. Not a shipped sample: it only feeds the scene harness and the tests.
 */
import { getNodeDef } from '../../src/engine/registry';
import type { Board, Graph, GraphNode, ParamValue } from '../../src/engine/types';

type NodeSpec = [id: string, kind: string, params?: Record<string, ParamValue>];
type WireSpec = [from: string, outPort: string, to: string, inPort: string];

export interface ShowcaseOptions {
  /** Tilt of both trays, degrees. */
  tilt?: number;
  gripperClosed?: boolean;
  /** Colour of the scan gate's lamp (the block colour); absent = idle. */
  gateLamp?: string;
  /** Leave every piece on its classic look (to compare). */
  classic?: boolean;
}

export const AGV = { L: 0.9, W: 0.7, H: 0.24, wheelR: 0.085, tray: { L: 0.74, W: 0.62, T: 0.05 }, stand: 0.05 };
export const ARM = { baseR: 0.24, baseH: 0.3, L1: 0.8, L2: 0.65, t: 0.15, open: 0.27 };

/** Where the things stand (x, z of their middles), so camera scripts can aim at them. */
export const SPOTS = {
  agvRear: { x: -3, z: 2.2 },
  agvSide: { x: -1.2, z: 2.2 },
  arm: { x: 1.4, z: 2.2 },
  parcels: { x: 0, z: 0.2 },
  chute: { x: -2.6, z: -2.4 },
  belt: { x: 1.6, z: -2.4 },
  markers: { x: 4.6, z: 1 },
};

function agv(id: string, at: { x: number; z: number }, side: boolean, look: boolean, tilt: number, nodes: NodeSpec[], wires: WireSpec[]): void {
  const { L, W, H, wheelR, tray, stand } = AGV;
  nodes.push([`${id}-body`, 'robot-body', { position: { x: at.x, y: H / 2, z: at.z }, heading: 0, length: L, width: W, height: H, mass: 8, ...(look ? { look: 'agv' } : {}) }]);
  for (const [k, f, s] of [['fl', 1, -1], ['fr', 1, 1], ['rl', -1, -1], ['rr', -1, 1]] as const) {
    nodes.push([`${id}-m-${k}`, 'motor', { side: s * (W / 2 + 0.035), forward: f * L * 0.29, wheelRadius: wheelR }]);
    wires.push([`${id}-body`, 'self', `${id}-m-${k}`, 'body']);
  }
  const up = H / 2 + stand + tray.T / 2;
  const hinge = { axis: 'pitch', start: 0, min: -90, max: 90, maxTorque: 200, maxSpeed: 60, solid: 'no', ...(look ? { look: 'hinge' } : {}) };
  const plate = { thickness: tray.T, solid: 'yes', mass: 1, ...(look ? { look: 'factory' } : {}) };
  nodes.push([`${id}-angle`, 'const', { value: tilt }]);
  if (side) {
    // A turntable joint turns the hinge a quarter, so the tray tips sideways and the parcel leaves over the right-hand edge.
    nodes.push([`${id}-turn`, 'joint', { ...hinge, axis: 'yaw', start: 90, mount: { x: 0, y: up, z: tray.W / 2 } }]);
    nodes.push([`${id}-tilt`, 'joint', { ...hinge, mount: { x: 0, y: 0, z: 0 } }]);
    nodes.push([`${id}-tray`, 'link', { ...plate, length: tray.W, width: tray.L }]);
    wires.push([`${id}-body`, 'self', `${id}-turn`, 'base'], ['go', 'started', `${id}-turn`, 'power'], [`${id}-turn`, 'tip', `${id}-tilt`, 'base']);
  } else {
    nodes.push([`${id}-tilt`, 'joint', { ...hinge, mount: { x: -tray.L / 2, y: up, z: 0 } }]);
    nodes.push([`${id}-tray`, 'link', { ...plate, length: tray.L, width: tray.W }]);
    wires.push([`${id}-body`, 'self', `${id}-tilt`, 'base']);
  }
  wires.push(['go', 'started', `${id}-tilt`, 'power'], [`${id}-angle`, 'value', `${id}-tilt`, 'angle'], [`${id}-tilt`, 'tip', `${id}-tray`, 'base']);
  const top = H + stand + tray.T;
  nodes.push([`${id}-parcel`, 'item', { shape: 'crate', position: { x: at.x, y: top + 0.11 + 0.004, z: at.z }, size: { x: 0.3, y: 0.22, z: 0.26 }, mass: 2, color: '#ecd2a2', ...(look ? { look: 'parcel-carton' } : {}) }]);
}

export function createFactoryShowcase(o: ShowcaseOptions = {}): Board {
  const look = o.classic !== true;
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 16, y: 1, z: 12 }, color: '#cfd2d7' }],
    ['go', 'on-start', {}],
  ];
  const wires: WireSpec[] = [];
  const tilt = o.tilt ?? 0;
  agv('a1', SPOTS.agvRear, false, look, tilt, nodes, wires);
  agv('a2', SPOTS.agvSide, true, look, tilt, nodes, wires);

  // ---- arm on its base
  const arm = SPOTS.arm;
  const f: Record<string, ParamValue> = look ? { look: 'factory' } : {};
  nodes.push(
    ['arm-base', 'block', { position: { x: arm.x, y: ARM.baseH / 2, z: arm.z }, size: { x: ARM.baseR * 2, y: ARM.baseH, z: ARM.baseR * 2 }, ...(look ? { style: 'arm-base' } : {}) }],
    ['a-j1', 'joint', { axis: 'pitch', start: 62, min: -180, max: 180, maxTorque: 2000, solid: 'no', mount: { x: 0, y: ARM.baseH / 2 + 0.12, z: 0 }, ...f }],
    ['a-l1', 'link', { length: ARM.L1, thickness: ARM.t, mass: 1, solid: 'no', ...f }],
    ['a-j2', 'joint', { axis: 'pitch', start: -95, min: -180, max: 180, maxTorque: 2000, solid: 'no', ...f }],
    ['a-l2', 'link', { length: ARM.L2, thickness: ARM.t, mass: 1, solid: 'no', ...f }],
    ['a-grip', 'gripper', { width: ARM.open, ...f }],
  );
  wires.push(['arm-base', 'self', 'a-j1', 'base'], ['a-j1', 'tip', 'a-l1', 'base'], ['a-l1', 'tip', 'a-j2', 'base'], ['a-j2', 'tip', 'a-l2', 'base'], ['a-l2', 'tip', 'a-grip', 'base']);
  wires.push(['go', 'started', 'a-j1', 'power'], ['go', 'started', 'a-j2', 'power']);
  if (o.gripperClosed) wires.push(['go', 'started', 'a-grip', 'close']);

  // ---- parcels: every look, in the six class colours
  const row = SPOTS.parcels;
  const looks = ['parcel-carton', 'parcel-carton', 'parcel-carton', 'parcel-1', 'parcel-2', 'parcel-3', 'parcel-4', 'parcel-5', 'parcel-box'];
  const sizes = [{ x: 0.24, y: 0.18, z: 0.22 }, { x: 0.3, y: 0.22, z: 0.26 }, { x: 0.42, y: 0.32, z: 0.36 }];
  const kg = [1, 2, 5];
  const colours = ['#ecd2a2', '#ef4444', '#22c55e', '#facc15', '#3b82f6', '#a855f7', '#f97316', '#ef4444', '#22c55e'];
  looks.forEach((l, i) => {
    const size = sizes[i] ?? { x: 0.4, y: 0.4, z: 0.4 };
    nodes.push([`p${i}`, 'item', { shape: 'crate', position: { x: row.x + (i - 4) * 0.7, y: size.y / 2 + 0.003, z: row.z }, size, mass: kg[i] ?? 2, color: colours[i] ?? '#ef4444', ...(look ? { look: l } : {}) }]);
  });

  // ---- chute in a raised floor
  const c = SPOTS.chute;
  const drop = 0.75;
  const hole = 0.94;
  const deck = 1.9;
  const rim = (deck - hole) / 2;
  const slab = (id: string, x: number, z: number, sx: number, sz: number): NodeSpec => ['deck-' + id, 'block', { position: { x: c.x + x, y: drop - 0.04, z: c.z + z }, size: { x: sx, y: 0.08, z: sz }, color: '#2c3038' }];
  nodes.push(
    slab('l', -(hole + rim) / 2, 0, rim, deck),
    slab('r', (hole + rim) / 2, 0, rim, deck),
    slab('f', 0, (hole + rim) / 2, hole, rim),
    slab('b', 0, -(hole + rim) / 2, hole, rim),
    ['chute', 'block', { position: { x: c.x, y: drop / 2, z: c.z }, size: { x: hole, y: drop, z: hole }, type: 'pickup', signText: '1', ...(look ? { style: 'chute' } : {}) }],
  );

  // ---- belt with a scan gate and two cartons riding on it
  const b = SPOTS.belt;
  const belt = { L: 2.4, W: 0.6, H: 0.5 };
  nodes.push(
    ['belt', 'block', { position: { x: b.x, y: belt.H / 2, z: b.z }, size: { x: belt.L, y: belt.H, z: belt.W }, beltSpeed: 0.35, beltDir: 'x', ...(look ? { style: 'belt-frame' } : {}) }],
    ['gate', 'block', { position: { x: b.x + belt.L * 0.2, y: belt.H - 0.05 + 0.36, z: b.z }, size: { x: 0.14, y: 0.72, z: belt.W + 0.19 }, type: 'pickup', ...(o.gateLamp ? { color: o.gateLamp } : {}), ...(look ? { style: 'scan-gate' } : {}) }],
    ['belt-p1', 'item', { shape: 'crate', position: { x: b.x - 0.7, y: belt.H + 0.11 + 0.004, z: b.z }, size: { x: 0.3, y: 0.22, z: 0.26 }, mass: 2, color: '#ecd2a2', ...(look ? { look: 'parcel-carton' } : {}) }],
    ['belt-p2', 'item', { shape: 'crate', position: { x: b.x - 0.1, y: belt.H + 0.09 + 0.004, z: b.z }, size: { x: 0.24, y: 0.18, z: 0.22 }, mass: 1, color: '#ecd2a2', ...(look ? { look: 'parcel-carton' } : {}) }],
  );

  wires.push(['go', 'started', 'belt', 'run']);

  const graph: Graph = {
    nodes: nodes.map(([id, kind, params], n): GraphNode => {
      const def = getNodeDef(kind);
      if (!def) throw new Error(`unknown kind ${kind}`);
      const base: Record<string, ParamValue> = {};
      for (const p of def.params) base[p.id] = p.default;
      return { id, kind, params: { ...base, ...(params ?? {}) }, pos: { x: (n % 10) * 260, y: Math.floor(n / 10) * 220 } };
    }),
    wires: wires.map(([from, fp, to, tp], n) => ({ id: `w${n}`, from: { node: from, port: fp }, to: { node: to, port: tp } })),
    settings: { wireRule: true, realPhysics: true },
  };
  return { name: 'Factory looks', mode: '3d', graph };
}
