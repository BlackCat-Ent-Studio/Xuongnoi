import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityView } from '../../src/engine/types';
import { buildBlockLook } from '../../src/render/block-looks';

const SIZE = { x: 6, y: 1, z: 2 };

function view(phase: number, axis: 'x' | 'z' = 'x', speed = 2): EntityView {
  return {
    id: 'b',
    kind: 'block',
    ownerNodeId: 'n',
    position: { x: 0, y: 0.5, z: 0 },
    size: SIZE,
    color: '#888888',
    blockStyle: 'conveyor',
    belt: { axis, speed, phase },
    visible: true,
  };
}

/** Sorted along-axis positions of the visible stripes (the animated meshes are the ones sharing one geometry and the stripe tint). */
function stripeCentres(fig: ReturnType<typeof buildBlockLook>, axis: 'x' | 'z'): number[] {
  const out: number[] = [];
  for (const o of fig.object.children) {
    if (o instanceof THREE.Mesh && o.scale.y < 0.01 && o.visible) out.push(o.position[axis]);
  }
  return out.sort((a, b) => a - b);
}

describe('belt look', () => {
  it('only the belt look animates', () => {
    expect(buildBlockLook('conveyor', '#888', SIZE).update).toBeTypeOf('function');
    expect(buildBlockLook('rail', '#888', SIZE).update).toBeUndefined();
    expect(buildBlockLook('box', '#888', SIZE).update).toBeUndefined();
  });

  it('scrolls stripes with the travelled distance, holds when stopped and reverses', () => {
    const fig = buildBlockLook('conveyor', '#888', SIZE);
    fig.update!(view(0));
    const a = stripeCentres(fig, 'x');
    expect(a.length).toBeGreaterThanOrEqual(5);
    fig.update!(view(0.2));
    const b = stripeCentres(fig, 'x');
    expect(b).not.toEqual(a);
    fig.update!(view(0.2, 'x', 0));
    expect(stripeCentres(fig, 'x')).toEqual(b); // stopped: same picture
    fig.update!(view(0));
    expect(stripeCentres(fig, 'x')).toEqual(a); // reversed back to the start
  });

  it('lays the stripes across the z axis for a belt running along z', () => {
    const fig = buildBlockLook('conveyor', '#888', { x: 2, y: 1, z: 6 });
    fig.update!({ ...view(0.3, 'z'), size: { x: 2, y: 1, z: 6 } });
    const zs = stripeCentres(fig, 'z');
    expect(zs.length).toBeGreaterThanOrEqual(5);
    expect(new Set(zs.map((z) => z.toFixed(3))).size).toBe(zs.length);
  });
});
