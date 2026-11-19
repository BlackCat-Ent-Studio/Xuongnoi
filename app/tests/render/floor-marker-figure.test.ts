import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { EntityView, ViewMode } from '../../src/engine/types';
import { FLOOR_MARKER_LOOK } from '../../src/nodes/floor-marker';
import { FloorMarkerFigure } from '../../src/render/floor-marker-figure';
import { SceneView } from '../../src/render/scene-view';

const tile = (over: Partial<EntityView> = {}): EntityView => ({
  id: 'e1',
  kind: 'block',
  ownerNodeId: 'n1',
  position: { x: 3, y: 0.5, z: -2 },
  size: { x: 1.4, y: 0.02, z: 1.4 },
  color: '#f59e0b',
  look: FLOOR_MARKER_LOOK,
  label: '7',
  zone: true,
  visible: true,
  ...over,
});

function bounds(view: EntityView, mode: ViewMode): THREE.Box3 {
  const fig = new FloorMarkerFigure(view, mode);
  fig.object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(fig.object);
}

describe('floor marker figure', () => {
  it('lies flat on the floor, exactly as wide and deep as the marker, a hair above it', () => {
    for (const mode of ['3d', '2d-top'] as const) {
      const b = bounds(tile(), mode);
      expect(b.min.x).toBeCloseTo(3 - 0.7, 6);
      expect(b.max.x).toBeCloseTo(3 + 0.7, 6);
      expect(b.min.z).toBeCloseTo(-2 - 0.7, 6);
      expect(b.max.z).toBeCloseTo(-2 + 0.7, 6);
      expect(b.min.y).toBeGreaterThan(0.5);
      expect(b.max.y).toBeLessThan(0.53);
    }
  });

  it('side view: a low strip along the floor as long as the tile', () => {
    const b = bounds(tile({ position: { x: 3, y: 0.5, z: 0 }, size: { x: 1.4, y: 0.02, z: 0.1 } }), '2d-side');
    expect(b.min.x).toBeCloseTo(3 - 0.7, 6);
    expect(b.max.x).toBeCloseTo(3 + 0.7, 6);
    expect(b.min.y).toBeCloseTo(0.5, 6);
    expect(b.max.y).toBeLessThan(0.6);
  });

  it('takes the marker colour, a darker rim, follows a colour change, and every part maps back to the card', () => {
    const fig = new FloorMarkerFigure(tile(), '3d');
    const colours = (): string[] => {
      const out: string[] = [];
      fig.object.traverse((o) => {
        if (o instanceof THREE.Mesh) out.push(`#${(o.material as THREE.MeshBasicMaterial).color.getHexString()}`);
      });
      return out;
    };
    const [rim, face] = colours();
    expect(face).toBe('#f59e0b');
    expect(rim).not.toBe(face);
    fig.update(tile({ color: '#22c55e' }));
    expect(colours()[1]).toBe('#22c55e');
    fig.object.traverse((o) => expect(o.userData.ownerNodeId).toBe('n1'));
    fig.dispose();
  });

  it('the scene draws a marker as this figure (not as a zone box), moves it with the entity and removes it', () => {
    const view = new SceneView();
    view.setMode('3d');
    view.sync([tile()]);
    const entries = (view as unknown as { entries: Map<string, { type: string; figure: FloorMarkerFigure }> }).entries;
    expect(entries.get('e1')?.type).toBe('marker');
    view.sync([tile({ position: { x: 5, y: 0.5, z: 1 } })]);
    expect(entries.get('e1')!.figure.object.position.x).toBe(5);
    // The same entity turning into a plain zone box swaps the figure.
    view.sync([tile({ look: undefined, label: undefined })]);
    expect(entries.get('e1')?.type).toBe('block');
    view.sync([]);
    expect(entries.size).toBe(0);
    view.dispose();
  });
});
