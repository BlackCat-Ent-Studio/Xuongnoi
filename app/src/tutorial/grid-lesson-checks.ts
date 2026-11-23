import type { Graph, GraphNode } from '../engine/types';

/**
 * Graph checks shared by the lessons about a floor of numbered cells: they follow the wires from a chassis to the cards
 * that work for it, so a step only counts when the wire is drawn on the cards of the right robot.
 */

/** The card whose output `fromPort` feeds input `port` of `node`, when it is of the kind asked for. */
function feeder(g: Graph, node: GraphNode, port: string, kind: string, fromPort: string): GraphNode | null {
  const wire = g.wires.find((w) => w.to.node === node.id && w.to.port === port && w.from.port === fromPort);
  const from = wire ? g.nodes.find((n) => n.id === wire.from.node) : undefined;
  return from && from.kind === kind ? from : null;
}

const hasInput = (g: Graph, node: GraphNode, port: string): boolean => g.wires.some((w) => w.to.node === node.id && w.to.port === port);

/** A chassis and the cards that work for it. */
export interface RoutedRobot {
  body: GraphNode;
  /** The driver whose "Robot" is this chassis. */
  drive: GraphNode | null;
  /** The route finder that is told where this chassis stands (through a marker reader) and where it has to go. */
  route: GraphNode | null;
}

export function robotsOf(g: Graph): RoutedRobot[] {
  const fedBy = (kind: string, port: string, from: GraphNode, fromPort: string): GraphNode[] =>
    g.nodes.filter((n) => n.kind === kind && feeder(g, n, port, from.kind, fromPort) === from);
  return g.nodes
    .filter((n) => n.kind === 'robot-body')
    .map((body) => {
      const readers = fedBy('floor-marker-sensor', 'who', body, 'self');
      const route = readers.flatMap((r) => fedBy('grid-route', 'at', r, 'number')).find((r) => hasInput(g, r, 'goal')) ?? null;
      return { body, drive: fedBy('robot-goto', 'robot', body, 'self')[0] ?? null, route };
    });
}

/** The number-to-marker lookup that gives the driver of this robot its goal. */
function lookupOf(g: Graph, robot: RoutedRobot): GraphNode | null {
  return robot.drive ? feeder(g, robot.drive, 'target', 'floor-marker-find', 'marker') : null;
}

/** True when the robot drives to the cell its own route finder names: "Ô kế tiếp" → "Tìm mốc sàn" → "Đích". */
export function followsRoute(g: Graph, robot: RoutedRobot): boolean {
  const lookup = lookupOf(g, robot);
  return lookup !== null && robot.route !== null && feeder(g, lookup, 'number', 'grid-route', 'next') === robot.route;
}

/**
 * How far the robot is wired into a "Bảng giữ ô": 0 = not at all, 1 = the card knows the chassis (row k), 2 = the robot
 * also asks row k for the cell its route finder names, 3 = and it drives only to the cell row k grants.
 */
export function holdLevel(g: Graph, robot: RoutedRobot): 0 | 1 | 2 | 3 {
  let best: 0 | 1 | 2 | 3 = 0;
  for (const w of g.wires) {
    const hold = g.nodes.find((n) => n.id === w.to.node);
    const row = /^robot(\d+)$/.exec(w.to.port)?.[1];
    if (w.from.node !== robot.body.id || w.from.port !== 'self' || hold?.kind !== 'cell-hold' || !row) continue;
    const asks = robot.route !== null && feeder(g, hold, `want${row}`, 'grid-route', 'next') === robot.route;
    const lookup = lookupOf(g, robot);
    const obeys = lookup !== null && feeder(g, lookup, 'number', 'cell-hold', `cell${row}`) === hold;
    const level = !asks ? 1 : !obeys ? 2 : 3;
    if (level > best) best = level;
  }
  return best;
}

/** How many robots on the board are wired into a hold card at least that far. */
export function robotsHeld(g: Graph, level: 1 | 2 | 3): number {
  return robotsOf(g).filter((r) => holdLevel(g, r) >= level).length;
}
