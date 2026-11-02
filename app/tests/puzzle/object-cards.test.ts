import { beforeAll, describe, expect, it } from 'vitest';
import type { GraphNode } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { isFloorLike, isObjectKind } from '../../src/puzzle/ui/object-cards';

const node = (kind: string, params: GraphNode['params']): GraphNode => ({ id: 'n', kind, params, pos: { x: 0, y: 0 } });

beforeAll(() => registerAllNodes());

describe('object cards', () => {
  it('object kinds and the zone sensor stand for stage objects; logic pieces do not', () => {
    for (const kind of ['block', 'character', 'item', 'vehicle', 'zone']) expect(isObjectKind(kind), kind).toBe(true);
    for (const kind of ['and', 'timer', 'touch', 'latch', 'win-lose']) expect(isObjectKind(kind), kind).toBe(false);
  });

  it('a long thin block is the floor and is not picked by tapping the stage', () => {
    expect(isFloorLike(node('block', { size: { x: 30, y: 1, z: 1 } }))).toBe(true);
    expect(isFloorLike(node('block', { size: { x: 1.6, y: 0.2, z: 1.6 } }))).toBe(false);
    expect(isFloorLike(node('block', { size: { x: 1, y: 8, z: 1 } }))).toBe(false);
    expect(isFloorLike(node('character', { size: { x: 30, y: 1, z: 1 } }))).toBe(false);
    expect(isFloorLike(node('block', {}))).toBe(false);
  });
});
