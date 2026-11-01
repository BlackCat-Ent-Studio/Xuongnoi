import { describe, expect, it } from 'vitest';
import { runLevel } from '../../../src/puzzle/run-level';
import { doorFixture } from './door-fixture';

describe('door fixture', () => {
  it('is won by its reference answer and stuck without it', () => {
    expect(runLevel(doorFixture, doorFixture.solution).outcome).toBe('win');
    expect(runLevel(doorFixture, { nodes: [], wires: [] }).outcome).not.toBe('win');
  });
});
