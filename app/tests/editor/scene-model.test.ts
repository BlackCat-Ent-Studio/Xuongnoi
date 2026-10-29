import { beforeAll, describe, expect, it } from 'vitest';
import { getNodeDef } from '../../src/engine/registry';
import { registerAllNodes } from '../../src/nodes';
import { buildSceneModel } from '../../src/editor/scene/scene-model';
import type { Graph, GraphNode } from '../../src/engine/types';

beforeAll(() => registerAllNodes());

const node = (id: string, kind: string, params: GraphNode['params'] = {}): GraphNode => ({
  id,
  kind,
  params,
  pos: { x: 0, y: 0 },
});
const graph = (nodes: GraphNode[]): Graph => ({ nodes, wires: [] });

describe('buildSceneModel', () => {
  it('returns nothing for an empty graph or logic-only graph', () => {
    expect(buildSceneModel(graph([]), getNodeDef)).toEqual([]);
    expect(buildSceneModel(graph([node('a', 'and'), node('b', 'timer')]), getNodeDef)).toEqual([]);
  });

  it('groups level objects and HUD separately', () => {
    const roots = buildSceneModel(
      graph([node('c', 'character'), node('b', 'block'), node('z', 'zone'), node('k', 'camera'), node('s', 'show-number')]),
      getNodeDef,
    );
    expect(roots.map((r) => r.id)).toEqual(['level', 'ui']);
    expect(roots[0]?.groups.map((g) => g.id)).toEqual(['characters', 'objects', 'zones', 'cameras']);
    expect(roots[1]?.groups[0]?.items[0]?.nodeId).toBe('s');
  });

  it('numbers same-kind nodes and hints bot role', () => {
    const roots = buildSceneModel(
      graph([node('c1', 'character'), node('c2', 'character', { role: 'bot' })]),
      getNodeDef,
    );
    const items = roots[0]?.groups[0]?.items ?? [];
    expect(items.map((i) => i.label)).toEqual(['Nhân vật #1', 'Nhân vật #2']);
    expect(items.map((i) => i.hint)).toEqual(['Người chơi', 'Bot']);
  });

  it('drops the HUD root when only level objects exist', () => {
    const roots = buildSceneModel(graph([node('b', 'block')]), getNodeDef);
    expect(roots.map((r) => r.id)).toEqual(['level']);
    expect(roots[0]?.groups[0]?.items[0]?.label).toBe(getNodeDef('block')?.label);
  });
});
