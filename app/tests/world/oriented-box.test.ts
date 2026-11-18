import { describe, expect, it } from 'vitest';
import {
  axesOf,
  conjQuat,
  extentOn,
  flattenObb,
  footprintsOverlap,
  growObb,
  isTurned,
  mulQuat,
  obbBounds,
  obbCorners,
  obbInside,
  obbOf,
  obbOfView,
  obbSeparation,
  pointInObb,
  quatFromAxes,
  rayObb,
  rotateBy,
  type Quat,
} from '../../src/world/oriented-box';

const S = Math.SQRT1_2;
/** Turns about z by 90 and 45 degrees, about x by 90, about y by 45. */
const Z90: Quat = { x: 0, y: 0, z: S, w: S };
const Z45: Quat = { x: 0, y: 0, z: Math.sin(Math.PI / 8), w: Math.cos(Math.PI / 8) };
const X90: Quat = { x: S, y: 0, z: 0, w: S };
const Y45: Quat = { x: 0, y: Math.sin(Math.PI / 8), z: 0, w: Math.cos(Math.PI / 8) };
const O = { x: 0, y: 0, z: 0 };

describe('turns', () => {
  it('a quarter turn about z carries the x axis onto y and the y axis onto -x', () => {
    const [ax, ay, az] = axesOf(Z90);
    expect(ax.x).toBeCloseTo(0, 12);
    expect(ax.y).toBeCloseTo(1, 12);
    expect(ay.x).toBeCloseTo(-1, 12);
    expect(ay.y).toBeCloseTo(0, 12);
    expect(az.z).toBeCloseTo(1, 12);
  });

  it('rounding noise is not a turn, a real one is', () => {
    expect(isTurned(undefined)).toBe(false);
    expect(isTurned({ x: 0, y: 0, z: 0, w: 1 })).toBe(false);
    expect(isTurned({ x: 1e-12, y: 0, z: 0, w: 1 })).toBe(false);
    expect(isTurned(Z45)).toBe(true);
  });

  it('turn from axes and back, and two turns compose', () => {
    const q = mulQuat(Z90, X90);
    const [ax, ay, az] = axesOf(q);
    const back = quatFromAxes(ax, ay, az);
    const a = axesOf(back);
    for (let i = 0; i < 3; i++) {
      expect(a[i]!.x).toBeCloseTo([ax, ay, az][i]!.x, 12);
      expect(a[i]!.y).toBeCloseTo([ax, ay, az][i]!.y, 12);
      expect(a[i]!.z).toBeCloseTo([ax, ay, az][i]!.z, 12);
    }
    // x -> (X90 leaves x) -> (Z90: x -> y): the product turns x onto y.
    expect(rotateBy(q, { x: 1, y: 0, z: 0 }).y).toBeCloseTo(1, 12);
    const undone = rotateBy(conjQuat(q), rotateBy(q, { x: 0.3, y: -0.2, z: 0.9 }));
    expect(undone.x).toBeCloseTo(0.3, 12);
    expect(undone.y).toBeCloseTo(-0.2, 12);
    expect(undone.z).toBeCloseTo(0.9, 12);
  });
});

describe('shape of a turned box', () => {
  it('a 0.4 x 2 x 0.4 crate laid on its side by a quarter turn is 2 wide and 0.4 high', () => {
    const b = obbBounds(obbOf({ x: 1, y: 0.2, z: 0 }, { x: 0.4, y: 2, z: 0.4 }, Z90));
    expect(b.size.x).toBeCloseTo(2, 12);
    expect(b.size.y).toBeCloseTo(0.4, 12);
    expect(b.size.z).toBeCloseTo(0.4, 12);
    expect(b.pos).toEqual({ x: 1, y: 0.2, z: 0 });
  });

  it('at 45 degrees its bounds are (2 + 0.4) x 0.7071 = 1.697 wide, but the outline reaches that far only at a corner', () => {
    const o = obbOf(O, { x: 0.4, y: 2, z: 0.4 }, Z45);
    expect(obbBounds(o).size.x).toBeCloseTo(1.6971, 4);
    const xs = obbCorners(o).map((c) => c.x);
    expect(Math.max(...xs)).toBeCloseTo(0.8485, 4);
    // The point of the bounds' corner (0.8, 0.8) is outside the crate: its distance across the crate is (0.8 + 0.8) x 0.7071 = 1.131 > 0.2.
    expect(pointInObb(o, { x: 0.8, y: 0.8, z: 0 })).toBe(false);
    expect(pointInObb(o, { x: -0.5, y: 0.5, z: 0 })).toBe(true);
  });

  it('shadow on a direction: a 2 m crate lying along x shades 2 m on x and 0.4 m on z', () => {
    const o = obbOf(O, { x: 0.4, y: 2, z: 0.4 }, Z90);
    expect(extentOn(o, { x: 1, y: 0, z: 0 })).toBeCloseTo(2, 12);
    expect(extentOn(o, { x: 0, y: 0, z: 1 })).toBeCloseTo(0.4, 12);
    expect(extentOn(o, { x: S, y: 0, z: S })).toBeCloseTo((2 + 0.4) * S, 12);
  });

  it('an entity view turns its collision box about its position', () => {
    // Box centred 0.5 above the position, the whole thing laid on its side: the box swings to 0.5 beside it.
    const o = obbOfView({ position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, collider: { position: { x: 0, y: 0.5, z: 0 }, size: { x: 0.2, y: 0.2, z: 0.2 } }, rotation: Z90 });
    expect(o.centre.x).toBeCloseTo(-0.5, 12);
    expect(o.centre.y).toBeCloseTo(0, 12);
    expect(obbOfView({ position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, collider: { position: { x: 0, y: 0.5, z: 0 }, size: { x: 0.2, y: 0.2, z: 0.2 } }, rotation: Z90 }, false).half.x).toBe(0.5);
  });
});

describe('separation, containment, rays', () => {
  it('a unit cube turned 45 degrees about y reaches 0.7071 along x: a cube 1.3 away has a gap of 1.3 - 0.5 - 0.7071 = 0.0929', () => {
    const a = obbOf(O, { x: 1, y: 1, z: 1 }, Y45);
    const b = obbOf({ x: 1.3, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    expect(obbSeparation(a, b)).toBeCloseTo(0.0929, 4);
    expect(obbSeparation(a, obbOf({ x: 1.2, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }))).toBeCloseTo(-0.0071, 4);
  });

  it('overlap is negative: two unit cubes 0.8 apart overlap by 0.2', () => {
    expect(obbSeparation(obbOf(O, { x: 1, y: 1, z: 1 }), obbOf({ x: 0.8, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }))).toBeCloseTo(-0.2, 12);
  });

  it('inside: a 0.4 cube is inside a 2 m box until its corner turns out past the wall', () => {
    const outer = obbOf(O, { x: 2, y: 2, z: 2 });
    expect(obbInside(obbOf({ x: 0.7, y: 0, z: 0 }, { x: 0.4, y: 0.4, z: 0.4 }), outer)).toBe(true);
    // Turned 45 degrees its half width becomes 0.2 x 1.4142 = 0.2828: 0.7 + 0.2828 = 0.983 still in, at 0.75 it is not (1.033 > 1).
    expect(obbInside(obbOf({ x: 0.7, y: 0, z: 0 }, { x: 0.4, y: 0.4, z: 0.4 }, Y45), outer)).toBe(true);
    expect(obbInside(obbOf({ x: 0.75, y: 0, z: 0 }, { x: 0.4, y: 0.4, z: 0.4 }, Y45), outer)).toBe(false);
  });

  it('a ray meets the turned crate where its near face is, not where the upright box was', () => {
    // 2 m crate lying along x centred at x = 3: near face at x = 2. Upright it would have been at x = 2.8.
    const lying = obbOf({ x: 3, y: 0.2, z: 0 }, { x: 0.4, y: 2, z: 0.4 }, Z90);
    expect(rayObb(lying, { x: 0, y: 0.2, z: 0 }, { x: 1, y: 0, z: 0 })).toBeCloseTo(2, 12);
    expect(rayObb(obbOf({ x: 3, y: 0.2, z: 0 }, { x: 0.4, y: 2, z: 0.4 }), { x: 0, y: 0.2, z: 0 }, { x: 1, y: 0, z: 0 })).toBeCloseTo(2.8, 12);
    expect(rayObb(lying, { x: 0, y: 0.2, z: 0 }, { x: 0, y: 1, z: 0 })).toBeNull();
    expect(rayObb(lying, { x: 3, y: 0.2, z: 0 }, { x: 0, y: 1, z: 0 })).toBe(0);
  });

  it('growing a box moves its faces out by the same amount', () => {
    const a = growObb(obbOf(O, { x: 1, y: 1, z: 1 }), 0.25);
    expect(a.half).toEqual({ x: 0.75, y: 0.75, z: 0.75 });
    expect(growObb(obbOf(O, { x: 1, y: 1, z: 1 }), -2).half).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('a flat view leaves out the axis it hides: boxes far apart in depth still meet', () => {
    const a = flattenObb(obbOf({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, Z45), 'z');
    const b = flattenObb(obbOf({ x: 0.9, y: 0, z: 5 }, { x: 1, y: 1, z: 1 }), 'z');
    expect(obbSeparation(a, b)).toBeLessThan(0);
  });
});

describe('footprints seen from above', () => {
  const rect = (x0: number, z0: number, x1: number, z1: number) => [
    { x: x0, y: 0, z: z0 },
    { x: x1, y: 0, z: z0 },
    { x: x1, y: 0, z: z1 },
    { x: x0, y: 0, z: z1 },
  ];

  it('overlap needs real area: touching edges do not count, a shared outline does', () => {
    expect(footprintsOverlap(rect(0, 0, 1, 1), rect(0.5, 0.5, 2, 2))).toBe(true);
    expect(footprintsOverlap(rect(0, 0, 1, 1), rect(1, 0, 2, 1))).toBe(false);
    expect(footprintsOverlap(rect(0, 0, 1, 1), rect(0, 0, 1, 1))).toBe(true);
    expect(footprintsOverlap(rect(0, 0, 1, 1), rect(1.5, 0, 2, 1))).toBe(false);
  });

  it('an edge or a corner holding the crate counts when it lies over the other footprint', () => {
    const edge = [{ x: 0.5, y: 0, z: -0.2 }, { x: 0.5, y: 0, z: 0.2 }];
    expect(footprintsOverlap(edge, rect(0, -1, 1, 1))).toBe(true);
    expect(footprintsOverlap([{ x: 1.5, y: 0, z: 0 }, { x: 1.5, y: 0, z: 0.4 }], rect(0, -1, 1, 1))).toBe(false);
    expect(footprintsOverlap([{ x: 0.5, y: 0, z: 0 }], rect(0, -1, 1, 1))).toBe(true);
    expect(footprintsOverlap([{ x: 2, y: 0, z: 0 }], rect(0, -1, 1, 1))).toBe(false);
  });
});
