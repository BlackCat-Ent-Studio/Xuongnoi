/**
 * Development-only: the plan of the ground floor of the design mock-up, shared by the scenery (painted lanes, docks) and
 * by the tug fleet that drives on it. The ground uses the same cell pitch as the sorting floor above, so a roll cage
 * stands exactly under its drop hole; lanes run on even rows and even columns, each one way, and the outermost lanes form
 * a loop: dock road (north, westward) → empty-cage lane (north-west corner) → down the west side → under the holes →
 * back up to the docks.
 */

export const PITCH = 1.4;
/** Height of the sorting floor above the ground floor. */
export const GROUND = 2.6;
/** The back wall with the dock doors, the edge of the hall floor at the docks, and how deep a truck stands below it. */
export const WALL_Z = -10.8, DOCK_Z = -4.9, PIT = 0.95;
/** Cages a truck takes: two side by side, two deep. */
export const TRUCK_CAGES = 4;

export interface GNode { id: number; r: number; c: number; x: number; z: number; out: number[]; kind: 'lane' | 'pocket' | 'bay' }
export interface DoorPlan {
  /** 1-based door number and the hole numbers (routes) it ships. */
  n: number; holes: number[];
  x: number;
  /** The bay cell in front of the truck, and the cell beside it a tug leaves by. */
  bay: number; exit: number;
  /** Where the cages stand in the truck, in loading order (deepest first). */
  slots: { x: number; z: number }[];
}
export interface GroundPlan {
  nodes: Map<number, GNode>;
  doors: DoorPlan[];
  /** Empty-cage lane: the pick-up cell and the places of the queue behind it, front first. */
  buffer: { node: number; x: number; queue: number[] };
  /** Waiting bays of the tugs. */
  pockets: number[];
  /** The two lane cells north and south of the cage under a hole. */
  stops: (holeRow: number, holeCol: number) => [number, number];
  cageCell: (holeRow: number, holeCol: number) => { x: number; z: number };
  rows: [number, number]; cols: [number, number];
}

export const nodeId = (r: number, c: number): number => (r + 8) * 100 + (c + 8);

export function planGround(holeRows: number, holeCols: number): GroundPlan {
  const R1 = 2 * holeRows + 2, C1 = 2 * holeCols + 2;
  const nodes = new Map<number, GNode>();
  const odd = (v: number): boolean => Math.abs(v) % 2 === 1;
  const isLane = (r: number, c: number): boolean => r >= -2 && r <= R1 && c >= -2 && c <= C1 && (!odd(r) || !odd(c));
  const node = (r: number, c: number, kind: GNode['kind']): GNode => {
    let n = nodes.get(nodeId(r, c));
    if (!n) { n = { id: nodeId(r, c), r, c, x: c * PITCH, z: r * PITCH, out: [], kind }; nodes.set(n.id, n); }
    return n;
  };
  const link = (a: GNode, b: GNode): void => { if (!a.out.includes(b.id)) a.out.push(b.id); };
  for (let r = -2; r <= R1; r++) for (let c = -2; c <= C1; c++) if (isLane(r, c)) node(r, c, 'lane');
  for (let r = -2; r <= R1; r++) for (let c = -2; c <= C1; c++) {
    if (!isLane(r, c)) continue;
    const a = node(r, c, 'lane');
    if (!odd(r)) { const to = c + (((r + 2) / 2) % 2 === 0 ? -1 : 1); if (isLane(r, to)) link(a, node(r, to, 'lane')); }
    if (!odd(c)) { const to = r + (((c + 2) / 2) % 2 === 0 ? 1 : -1); if (isLane(to, c)) link(a, node(to, c, 'lane')); }
  }
  // waiting bays between the two westmost lanes: in from the west lane, out to the next one
  const pockets: number[] = [];
  for (let r = -1; r <= R1 - 1; r += 2) {
    const p = node(r, -1, 'pocket');
    link(node(r, -2, 'lane'), p); link(p, node(r, 0, 'lane'));
    pockets.push(p.id);
  }
  // and, for the larger fleets, the same between the two eastmost lanes
  for (let r = -1; r <= R1 - 1; r += 2) {
    const p = node(r, C1 - 1, 'pocket');
    link(node(r, C1, 'lane'), p); link(p, node(r, C1 - 2, 'lane'));
    pockets.push(p.id);
  }
  // empty-cage lane at the north-west corner: off the dock road, under the first cage, back onto the corner
  const bufferIn = node(-3, -1, 'bay'), buffer = node(-3, -2, 'bay');
  link(node(-2, -1, 'lane'), bufferIn); link(bufferIn, buffer); link(buffer, node(-2, -2, 'lane'));
  // one dock door per row of holes; a bay in front of each truck, left by the cell west of it
  const doors: DoorPlan[] = [];
  for (let j = 0; j < holeRows; j++) {
    const col = holeCols + 3 * j - Math.round((3 * (holeRows - 1)) / 2);
    const bay = node(-3, col, 'bay');
    link(node(-2, col, 'lane'), bay);
    const exit = node(-3, col - 1, 'bay');
    link(bay, exit);
    if (exit !== bufferIn) link(exit, node(-2, col - 1, 'lane'));
    const x = col * PITCH, slots: { x: number; z: number }[] = [];
    for (const depth of [2.1, 0.95]) for (const side of [-1, 1]) slots.push({ x: x + side * 0.57, z: DOCK_Z - 0.06 - depth });
    doors.push({ n: j + 1, holes: Array.from({ length: holeCols }, (_, i) => j * holeCols + i + 1), x, bay: bay.id, exit: exit.id, slots });
  }
  const queue: number[] = [];
  for (let z = buffer.z; z > WALL_Z + 0.9; z -= 1.1) queue.push(z);
  return {
    nodes, doors, pockets, buffer: { node: buffer.id, x: buffer.x, queue },
    stops: (hr, hc) => [nodeId(2 * hr, 2 * hc + 1), nodeId(2 * hr + 2, 2 * hc + 1)],
    cageCell: (hr, hc) => ({ x: (2 * hc + 1) * PITCH, z: (2 * hr + 1) * PITCH }),
    rows: [-2, R1], cols: [-2, C1],
  };
}

/** Shortest way along the lanes to the nearest goal; `blocked` cells are walked around. Empty when there is none. */
export function groundRoute(plan: GroundPlan, from: number, goals: readonly number[], blocked?: ReadonlySet<number>): number[] {
  if (goals.includes(from)) return [];
  const prev = new Map<number, number>();
  const seen = new Set<number>([from]);
  let frontier = [from];
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const at of frontier) {
      for (const n of plan.nodes.get(at)!.out) {
        const goal = goals.includes(n);
        if (seen.has(n) || (blocked?.has(n) && !goal)) continue;
        seen.add(n);
        prev.set(n, at);
        if (goal) {
          const path = [n];
          for (let p = at; p !== from; p = prev.get(p)!) path.unshift(p);
          return path;
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  return [];
}
