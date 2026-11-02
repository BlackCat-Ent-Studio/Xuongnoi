import { describe, expect, it } from 'vitest';
import type { EntityView } from '../../src/engine/types';
import { PULSE_SECONDS, pulseStrength } from '../../src/render/object-highlight';
import { SceneView } from '../../src/render/scene-view';

function block(id: string, owner: string, x: number, visible = true): EntityView {
  return { id, kind: 'block', ownerNodeId: owner, position: { x, y: 1, z: 0 }, size: { x: 2, y: 2, z: 1 }, color: '#ef4444', visible };
}

describe('pulseStrength', () => {
  it('breathes between 0.3 and 1 while new, then holds one calm level', () => {
    for (let t = 0; t < PULSE_SECONDS; t += 0.05) {
      const s = pulseStrength(t);
      expect(s).toBeGreaterThanOrEqual(0.29);
      expect(s).toBeLessThanOrEqual(1);
    }
    expect(pulseStrength(PULSE_SECONDS)).toBe(pulseStrength(PULSE_SECONDS + 30));
  });
});

describe('SceneView highlight', () => {
  const scene = [block('a', 'node-a', -3), block('b', 'node-b', 3), block('c', 'node-a', 8, false)];

  it('frames only the visible objects of the chosen nodes', () => {
    const view = new SceneView();
    view.sync(scene, 0);
    view.syncHighlight(scene, new Set(['node-a']), 1, 800, 400);
    expect(view.highlightCount).toBe(1);
    view.syncHighlight(scene, new Set(['node-a', 'node-b']), 1, 800, 400);
    expect(view.highlightCount).toBe(2);
    view.dispose();
  });

  it('shows nothing for a node that owns no object (a logic card) or an empty set', () => {
    const view = new SceneView();
    view.sync(scene, 0);
    view.syncHighlight(scene, new Set(['and-gate']), 1, 800, 400);
    expect(view.highlightCount).toBe(0);
    view.syncHighlight(scene, new Set(['node-a']), 1, 800, 400);
    view.syncHighlight(scene, new Set(), 1, 800, 400);
    expect(view.highlightCount).toBe(0);
    view.dispose();
  });

  it('carries no owner id, so picking never lands on a frame', () => {
    const view = new SceneView();
    view.sync(scene, 0);
    view.syncHighlight(scene, new Set(['node-a']), 1, 800, 400);
    const owners = new Set<string>();
    view.scene.traverse((o) => {
      if (typeof o.userData.ownerNodeId === 'string') owners.add(o.userData.ownerNodeId);
    });
    expect([...owners].sort()).toEqual(['node-a', 'node-b']);
    view.dispose();
  });
});
