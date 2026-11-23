import { describe, expect, it } from 'vitest';
import { createAccumulator } from '../../src/render/game-loop';
import {
  CameraRig,
  MAX_PITCH,
  MIN_PITCH,
  clampPitch,
  entityBounds,
  fitOrthoHeight,
  orbitOffset,
  smoothValue,
  yawForward,
  MAX_ZOOM,
  MIN_ZOOM,
  panGroundDelta,
  panOrthoDelta,
  zoomAfterWheel,
  zoomCenter,
} from '../../src/render/cameras';
import type { EntityView } from '../../src/engine/types';

const DT = 1 / 60;

describe('accumulator', () => {
  it('counts whole steps and carries remainder', () => {
    const a = createAccumulator(DT, 5);
    expect(a.advance(DT * 0.5)).toBe(0);
    expect(a.advance(DT * 0.5)).toBe(1);
    expect(a.advance(DT * 2)).toBe(2);
  });
  it('caps steps per frame and drops the backlog', () => {
    const a = createAccumulator(DT, 5);
    expect(a.advance(10)).toBe(5);
    expect(a.advance(0)).toBe(0);
  });
  it('ignores bad input', () => {
    const a = createAccumulator(DT, 5);
    expect(a.advance(NaN)).toBe(0);
    expect(a.advance(-1)).toBe(0);
  });
});

describe('camera math', () => {
  it('clamps pitch', () => {
    expect(clampPitch(-5)).toBe(MIN_PITCH);
    expect(clampPitch(5)).toBe(MAX_PITCH);
  });
  it('yaw 0 looks toward -Z and the camera sits behind (+Z)', () => {
    const f = yawForward(0);
    expect(f.x).toBeCloseTo(0);
    expect(f.z).toBeCloseTo(-1);
    const o = orbitOffset(0, 0.5, 10);
    expect(o.z).toBeGreaterThan(0);
    expect(o.y).toBeGreaterThan(0);
  });
  it('smoothing converges without overshoot', () => {
    let v = 0;
    for (let i = 0; i < 120; i++) v = smoothValue(v, 10, DT);
    expect(v).toBeGreaterThan(9.9);
    expect(v).toBeLessThanOrEqual(10);
  });
  it('bounds skip invisible entities', () => {
    const mk = (x: number, visible: boolean): EntityView => ({
      id: String(x),
      kind: 'block',
      ownerNodeId: 'n',
      position: { x, y: 0, z: 0 },
      size: { x: 2, y: 2, z: 2 },
      color: '#fff',
      visible,
    });
    const b = entityBounds([mk(0, true), mk(100, false)]);
    expect(b?.max.x).toBe(1);
    expect(entityBounds([mk(0, false)])).toBeNull();
  });
  it('fits ortho height to wide content', () => {
    expect(fitOrthoHeight(2, 2, 2)).toBe(16);
    expect(fitOrthoHeight(100, 2, 2)).toBe(52);
  });
  it('side rig follows a character and looks along -Z', () => {
    const rig = new CameraRig('2d-side');
    rig.resize(800, 400);
    const ch: EntityView = {
      id: 'c',
      kind: 'character',
      ownerNodeId: 'n',
      position: { x: 5, y: 3, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      color: '#f00',
      visible: true,
    };
    rig.update([ch], DT, true);
    expect(rig.camera.position.x).toBeCloseTo(5);
    expect(rig.camera.position.y).toBeCloseTo(3);
    expect(rig.camera.position.z).toBeGreaterThan(0);
  });
  it('3d rig clamps pitch when dragged', () => {
    const rig = new CameraRig('3d');
    rig.rotate(0, 100000);
    expect(rig.pitch).toBe(MAX_PITCH);
    rig.rotate(0, -1000000);
    expect(rig.pitch).toBe(MIN_PITCH);
  });
});

describe('edit camera math', () => {
  it('clamps wheel zoom to 0.3x-4x', () => {
    expect(zoomAfterWheel(1, -100000)).toBe(MAX_ZOOM);
    expect(zoomAfterWheel(1, 100000)).toBe(MIN_ZOOM);
    expect(zoomAfterWheel(1, -500)).toBeGreaterThan(1);
    expect(zoomAfterWheel(1, 500)).toBeLessThan(1);
  });
  it('zoom keeps the point under the cursor fixed', () => {
    const c = { u: 3, v: -2 };
    const ndc = { x: 0.5, y: -0.25 };
    const aspect = 1.6;
    const pointAt = (center: { u: number; v: number }, size: number) => ({
      u: center.u + (ndc.x * aspect * size) / 2,
      v: center.v + (ndc.y * size) / 2,
    });
    const next = zoomCenter(c, ndc, aspect, 10, 5);
    const before = pointAt(c, 10);
    const after = pointAt(next, 5);
    expect(after.u).toBeCloseTo(before.u);
    expect(after.v).toBeCloseTo(before.v);
    expect(zoomCenter(c, { x: 0, y: 0 }, aspect, 10, 5)).toEqual(c);
  });
  it('ortho pan moves the content with the pointer', () => {
    const d = panOrthoDelta(100, 50, 10, 500);
    expect(d.u).toBeCloseTo(-2);
    expect(d.v).toBeCloseTo(1);
  });
  it('ground pan follows yaw', () => {
    const a = panGroundDelta(0, 10, 0, 1);
    expect(a.x).toBeCloseTo(-10);
    expect(a.z).toBeCloseTo(0);
    const b = panGroundDelta(0, 0, 10, 1);
    expect(b.z).toBeCloseTo(-10);
  });
  it('default view is 1.5x closer and edit camera persists across updates', () => {
    const rig = new CameraRig('2d-side');
    rig.resize(800, 400);
    const block: EntityView = {
      id: 'b', ownerNodeId: 'n', kind: 'block', position: { x: 0, y: 0, z: 0 },
      size: { x: 2, y: 2, z: 1 }, color: '#fff', visible: true,
    } as EntityView;
    rig.update([block], 0, false);
    expect(rig.size).toBeCloseTo(16 / 1.5);
    rig.pan(80, 0);
    rig.update([block], 0, false);
    const x = rig.camera.position.x;
    expect(x).toBeLessThan(0);
    rig.update([{ ...block, position: { x: 1, y: 0, z: 0 } }], 0.1, false);
    expect(rig.camera.position.x).toBe(x);
    rig.resetView();
    rig.update([block], 0, false);
    expect(rig.camera.position.x).toBeCloseTo(0);
  });
});
