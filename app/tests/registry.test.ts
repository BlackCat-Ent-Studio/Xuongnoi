import { describe, expect, it, beforeEach } from 'vitest';
import { clearRegistry, getNodeDef, listNodeDefs, registerNode } from '../src/engine/registry';

describe('registry', () => {
  beforeEach(() => clearRegistry());

  it('registers and filters by mode', () => {
    registerNode({ kind: 'a', label: 'A', category: 'logic', description: '', inputs: [], outputs: [], params: [], evaluate: () => ({}) });
    registerNode({ kind: 'b', label: 'B', category: 'logic', description: '', inputs: [], outputs: [], params: [], modes: ['3d'], evaluate: () => ({}) });
    expect(getNodeDef('a')?.label).toBe('A');
    expect(listNodeDefs('2d-side').map((d) => d.kind)).toEqual(['a']);
    expect(listNodeDefs('3d')).toHaveLength(2);
  });
});
