import { describe, expect, it } from 'vitest';
import type { Frame } from '../../src/world/arm-kinematics';
import { coverCubes, FINGER_SLICES, handBoxes, handCubeCount, handCubes, palmSizeOf } from '../../src/world/hand-solid';
import { obbCorners, obbOf } from '../../src/world/oriented-box';

/**
 * The solid body of a gripper: a palm and two fingers (palm 0.15 deep x 0.25 x (opening + 0.24) wide, fingers 0.3 x 0.12 x 0.12), each
 * covered by upright cubes that are the bounds of slices of the real box. A hand standing square to the axes is covered exactly;
 * a tilted one is covered from outside, never from inside.
 */
const DEG = Math.PI / 180;
const OPEN: [number, number] = [0.56, -0.56];
const volume = (c: { size: { x: number; y: number; z: number } }): number => c.size.x * c.size.y * c.size.z;

describe('cover cubes of the hand', () => {
  it('a hand pointing straight down: the cubes are the box exactly (same volume, same bounds), 3 cubes a finger and 1 + 4 for a 1 m opening palm', () => {
    const base: Frame = { pos: { x: 0, y: 2, z: 0 }, yaw: 0, pitch: -90 * DEG };
    const boxes = handBoxes(base, '3d', 1, OPEN);
    expect(boxes).toHaveLength(3);
    for (const b of boxes) {
      const cubes = coverCubes(b);
      const real = b.size.x * b.size.y * b.size.z;
      expect(cubes.reduce((v, c) => v + volume(c), 0)).toBeCloseTo(real, 9);
      const lo = { x: Math.min(...cubes.map((c) => c.pos.x - c.size.x / 2)), y: Math.min(...cubes.map((c) => c.pos.y - c.size.y / 2)), z: Math.min(...cubes.map((c) => c.pos.z - c.size.z / 2)) };
      const hi = { x: Math.max(...cubes.map((c) => c.pos.x + c.size.x / 2)), y: Math.max(...cubes.map((c) => c.pos.y + c.size.y / 2)), z: Math.max(...cubes.map((c) => c.pos.z + c.size.z / 2)) };
      // Pointing down: the box's local x is world -y, its local y is world +x, its local z is world z.
      expect(hi.y - lo.y).toBeCloseTo(b.size.x, 9);
      expect(hi.x - lo.x).toBeCloseTo(b.size.y, 9);
      expect(hi.z - lo.z).toBeCloseTo(b.size.z, 9);
    }
    expect(coverCubes(boxes[1]!)).toHaveLength(FINGER_SLICES);
    expect(handCubes(base, '3d', 1, OPEN)).toHaveLength(handCubeCount('3d', 1));
    // Palm span 1 + 2 x 0.12 = 1.24 m cut into slices of about 0.25 m.
    expect(handCubeCount('3d', 1)).toBe(5 + 2 * FINGER_SLICES);
  });

  it('a tilted or turned hand: every corner of every box lies inside the cubes, the cover is a little bigger than the box, and the count never changes', () => {
    for (const [yaw, pitch] of [[0, -70], [0, -35], [30, -60], [90, -45], [-50, 20]] as const) {
      const base: Frame = { pos: { x: 1, y: 2, z: -1 }, yaw: yaw * DEG, pitch: pitch * DEG };
      expect(handCubes(base, '3d', 1, OPEN)).toHaveLength(handCubeCount('3d', 1));
      for (const b of handBoxes(base, '3d', 1, OPEN)) {
        const cubes = coverCubes(b);
        const inside = (p: { x: number; y: number; z: number }): boolean =>
          cubes.some((c) => Math.abs(p.x - c.pos.x) <= c.size.x / 2 + 1e-9 && Math.abs(p.y - c.pos.y) <= c.size.y / 2 + 1e-9 && Math.abs(p.z - c.pos.z) <= c.size.z / 2 + 1e-9);
        for (const corner of obbCorners(obbOf(b.centre, b.size, b.turn))) expect(inside(corner), `yaw ${yaw} pitch ${pitch}`).toBe(true);
        expect(cubes.reduce((v, c) => v + volume(c), 0)).toBeGreaterThanOrEqual(b.size.x * b.size.y * b.size.z - 1e-9);
      }
    }
  });

  it('the side view has the palm span along the arm normal: a 1 m opening gives a palm 0.15 x 1.24 x 0.25', () => {
    expect(palmSizeOf('2d-side', 1)).toEqual({ x: 0.15, y: 1.24, z: 0.25 });
    expect(palmSizeOf('3d', 1)).toEqual({ x: 0.15, y: 0.25, z: 1.24 });
  });
});
