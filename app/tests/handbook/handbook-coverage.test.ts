import { describe, expect, it } from 'vitest';
import { listNodeDefs } from '../../src/engine/registry';
import { HANDBOOK } from '../../src/handbook';
import { registerAllNodes } from '../../src/nodes';

describe('handbook coverage', () => {
  it('has exactly one page for every node kind', () => {
    registerAllNodes();
    const kinds = listNodeDefs().map((d) => d.kind).sort();
    expect(HANDBOOK.map((e) => e.kind).sort()).toEqual(kinds);
  });
});
