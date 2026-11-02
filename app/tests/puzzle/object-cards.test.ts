import { beforeAll, describe, expect, it } from 'vitest';
import type { GraphNode } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { hasNamedTitle, isFloorLike, isObjectKind, objectName } from '../../src/puzzle/ui/object-cards';

const node = (kind: string, params: GraphNode['params']): GraphNode => ({ id: 'n', kind, params, pos: { x: 0, y: 0 } });

beforeAll(() => registerAllNodes());

describe('object cards', () => {
  it('object kinds and the zone sensor stand for stage objects; logic pieces do not', () => {
    for (const kind of ['block', 'character', 'item', 'vehicle', 'zone']) expect(isObjectKind(kind), kind).toBe(true);
    for (const kind of ['and', 'timer', 'touch', 'latch', 'win-lose']) expect(isObjectKind(kind), kind).toBe(false);
  });

  it('only a named object card takes the object name as its title', () => {
    expect(hasNamedTitle(node('block', { name: 'Cờ' }))).toBe(true);
    expect(objectName(node('block', { name: '  Cửa kho ' }))).toBe('Cửa kho');
    expect(hasNamedTitle(node('block', {}))).toBe(false);
    expect(hasNamedTitle(node('block', { name: '   ' }))).toBe(false);
    expect(hasNamedTitle(node('and', { name: 'Và' }))).toBe(false);
    expect(hasNamedTitle(node('zone', { name: 'Vùng' }))).toBe(false);
  });

  it('a long thin block is the floor and is not picked by tapping the stage', () => {
    expect(isFloorLike(node('block', { size: { x: 30, y: 1, z: 1 } }))).toBe(true);
    expect(isFloorLike(node('block', { size: { x: 1.6, y: 0.2, z: 1.6 } }))).toBe(false);
    expect(isFloorLike(node('block', { size: { x: 1, y: 8, z: 1 } }))).toBe(false);
    expect(isFloorLike(node('character', { size: { x: 30, y: 1, z: 1 } }))).toBe(false);
    expect(isFloorLike(node('block', {}))).toBe(false);
  });

  it('every object the levels name gets its own title, and no two cards of a level share one', () => {
    for (const level of PUZZLE_LEVELS) {
      const titles = level.base.nodes.filter(hasNamedTitle).map(objectName);
      expect(new Set(titles).size, `${level.id}: ${titles.join(', ')}`).toBe(titles.length);
    }
  });
});
