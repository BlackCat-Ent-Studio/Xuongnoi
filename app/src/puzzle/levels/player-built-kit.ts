import type { GraphNode, Wire } from '../../engine/types';

/** A wire between two ports, written short. */
export const wire = (id: string, from: [string, string], to: [string, string]): Wire => ({
  id,
  from: { node: from[0], port: from[1] },
  to: { node: to[0], port: to[1] },
});

/**
 * Scenery is never drawn on the board, so it only needs a spot of its own: a strip below the cards holds them all in rows.
 * Each level makes its own maker so the rows start at the top for every level.
 */
export function sceneryMaker(): (id: string, kind: string, params: GraphNode['params']) => GraphNode {
  let index = 0;
  return (id, kind, params) => {
    const i = index++;
    return { id, kind, params, pos: { x: 20 + (i % 5) * 190, y: 640 + Math.floor(i / 5) * 44 } };
  };
}

/** The ground every side-view level stands on: a long solid block, never drawn as a card. */
export const groundParams = (length: number): GraphNode['params'] => ({
  name: 'Mặt đất',
  position: { x: 0, y: -0.5, z: 0 },
  size: { x: length, y: 1, z: 1 },
  color: '#65a30d',
  type: 'solid',
});
