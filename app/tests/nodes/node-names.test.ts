import { beforeAll, describe, expect, it } from 'vitest';
import { listNodeDefs } from '../../src/engine/registry';
import { STEP_1_NODES, registerAllNodes } from '../../src/nodes';
import { NODE_NAMES, nodeSearchAliases } from '../../src/nodes/node-names';
import { searchItems } from '../../src/editor/panels/palette-search';
import { buildRows, filterRows } from '../../src/handbook/handbook-model';
import { cardSubtitle } from '../../src/editor/graph/node-view';
import type { GraphNode } from '../../src/engine/types';

beforeAll(() => registerAllNodes());

describe('node display names', () => {
  it('names every registered kind, with an English term on the node and on every port', () => {
    expect(Object.keys(NODE_NAMES).sort()).toEqual(STEP_1_NODES.map((d) => d.kind).sort());
    for (const def of STEP_1_NODES) {
      const names = NODE_NAMES[def.kind];
      if (!names) throw new Error(`no names for ${def.kind}`);
      expect(def.label, def.kind).toBe(names.vi);
      expect(def.labelEn, def.kind).toBe(names.en);
      for (const [dir, ports] of [['in', def.inputs], ['out', def.outputs]] as const) {
        for (const p of ports) {
          expect(p.labelEn, `${def.kind} ${dir} ${p.id}`).toBeTruthy();
          const row = names.ports[dir]?.[p.id];
          if (row) expect(p.label, `${def.kind} ${dir} ${p.id}`).toBe(row[0]);
        }
      }
    }
  });

  it('keeps the ids the saved boards use', () => {
    const touch = STEP_1_NODES.find((d) => d.kind === 'touch');
    expect(touch?.inputs.map((p) => p.id)).toEqual(['a', 'b']);
    expect(touch?.outputs.map((p) => p.id)).toEqual(['touching', 'began', 'ended']);
    expect(touch?.label).toBe('Chạm nhau');
    expect(touch?.inputs.map((p) => p.label)).toEqual(['Vật chính', 'Vật kia']);
  });

  it('names the extra choice and step ports of the number switch and the sequence', () => {
    const sel = STEP_1_NODES.find((d) => d.kind === 'select-number');
    expect(sel?.outputs.filter((p) => /^is\d$/.test(p.id)).map((p) => [p.label, p.labelEn])).toEqual([
      ['Bằng 1', 'Case 1'], ['Bằng 2', 'Case 2'], ['Bằng 3', 'Case 3'], ['Bằng 4', 'Case 4'], ['Bằng 5', 'Case 5'], ['Bằng 6', 'Case 6'],
    ]);
    const seq = STEP_1_NODES.find((d) => d.kind === 'sequence');
    expect(seq?.outputs.find((p) => p.id === 'step6')?.labelEn).toBe('Step 6');
  });
});

describe('finding a renamed node by its old or English name', () => {
  const items = () =>
    listNodeDefs('2d-side').map((d) => ({ kind: d.kind, title: d.label, description: d.description, aliases: nodeSearchAliases(d.kind) }));

  it('palette search still finds the old Vietnamese name', () => {
    expect(searchItems(items(), 'Cảm biến chạm')[0]?.kind).toBe('touch');
    expect(searchItems(items(), 'cam bien vung').map((i) => i.kind)).toContain('zone');
    expect(searchItems(items(), 'Cầm tay').map((i) => i.kind)).toContain('hand-tool');
  });

  it('palette search finds a node by its English term', () => {
    expect(searchItems(items(), 'raycast')[0]?.kind).toBe('ahead-sensor');
    expect(searchItems(items(), 'trigger zone')[0]?.kind).toBe('zone');
  });

  it('handbook search finds the old and English names', () => {
    const rows = buildRows(listNodeDefs('2d-side'), () => undefined);
    expect(filterRows(rows, 'Cảm biến chạm').map((r) => r.kind)).toContain('touch');
    expect(filterRows(rows, 'collision').map((r) => r.kind)).toContain('touch');
  });

  it('the block kind is Vật thể / Object and is still found by Hộp and Block', () => {
    const d = listNodeDefs('2d-side').find((x) => x.kind === 'block');
    expect(d?.label).toBe('Vật thể');
    expect(d?.labelEn).toBe('Object');
    expect(d?.outputs.find((p) => p.id === 'self')?.label).toBe('Vật thể');
    expect(searchItems(items(), 'Hộp').map((i) => i.kind)).toContain('block');
    expect(searchItems(items(), 'Block').map((i) => i.kind)).toContain('block');
    const rows = buildRows(listNodeDefs('2d-side'), () => undefined);
    expect(filterRows(rows, 'Hộp').map((r) => r.kind)).toContain('block');
  });
});

describe('card subtitle', () => {
  const node = (kind: string, params: GraphNode['params'] = {}): GraphNode => ({ id: 'n1', kind, params, pos: { x: 0, y: 0 } });
  const def = (kind: string) => listNodeDefs().find((d) => d.kind === kind);

  it('shows the English term on the line the card always had', () => {
    expect(cardSubtitle(node('touch'), def('touch'))).toBe('Collision / Touch');
  });

  it('puts the kind on top and the typed name below for object cards', () => {
    expect(def('block')?.label).toBe('Vật thể');
    expect(cardSubtitle(node('block', { name: 'Cờ' }), def('block'))).toBe('Cờ');
    expect(cardSubtitle(node('block'), def('block'))).toBe('Object');
  });

  it('lets the name typed for the piece take that line', () => {
    expect(cardSubtitle(node('touch', { name: 'Chạm cờ' }), def('touch'))).toBe('Chạm cờ');
  });
});
