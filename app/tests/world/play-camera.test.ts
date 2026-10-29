import { describe, expect, it } from 'vitest';
import type { EntityView, PlayCameraCommand } from '../../src/engine/types';
import { createWorld } from '../../src/world/world';
import { CameraRig } from '../../src/render/cameras';
import { CameraDirector, rateForSmoothness } from '../../src/render/camera-director';
import { cameraNode } from '../../src/nodes/camera';
import { teleportNode } from '../../src/nodes/teleport';
import { defaultParams, makeCtx, makeWorld, runNode } from '../nodes/fake-world';

const cmd = (over: Partial<PlayCameraCommand> = {}): PlayCameraCommand => ({
  mode: 'follow',
  target: null,
  point: { x: 0, y: 0, z: 0 },
  zoom: 1,
  smoothness: 0,
  shake: 0,
  ...over,
});

const view = (id: string, x: number, y = 0, role: 'player' | 'bot' = 'player'): EntityView => ({
  id,
  kind: 'character',
  ownerNodeId: id,
  position: { x, y, z: 0 },
  size: { x: 1, y: 1, z: 1 },
  color: '#fff',
  role,
  visible: true,
});

describe('world play-camera requests', () => {
  it('is empty by default, and the most recently activated request wins', () => {
    const w = createWorld('2d-side');
    expect(w.cameraCommand()).toBeNull();
    w.setCamera('a', cmd({ zoom: 2 }));
    w.setCamera('b', cmd({ zoom: 3 }));
    expect(w.cameraCommand()?.zoom).toBe(3);
    w.setCamera('a', cmd({ zoom: 2.5 })); // refreshing does not re-activate
    expect(w.cameraCommand()?.zoom).toBe(3);
    w.setCamera('b', null);
    expect(w.cameraCommand()?.zoom).toBe(2.5);
    w.setCamera('b', cmd({ zoom: 3 })); // re-activated later than a
    expect(w.cameraCommand()?.zoom).toBe(3);
    w.setCamera('a', null);
    w.setCamera('b', null);
    expect(w.cameraCommand()).toBeNull();
  });
});

describe('camera director', () => {
  it('maps smoothness to a rate; 5 matches the default follow feel', () => {
    expect(rateForSmoothness(5)).toBe(8);
    expect(rateForSmoothness(0)).toBeGreaterThan(100);
    expect(rateForSmoothness(10)).toBeLessThan(rateForSmoothness(2));
  });

  it('aims follow at the target (plus offset), fixed at the point, and falls back when the target is gone', () => {
    const d = new CameraDirector();
    const es = [view('p', 0), view('t', 10, 2)];
    const base = { x: 0, y: 0, z: 0 };
    expect(d.goal(null, es, base)).toBe(base);
    expect(d.goal(cmd({ target: 't', point: { x: 1, y: 1, z: 0 } }), es, base)).toEqual({ x: 11, y: 3, z: 0 });
    expect(d.goal(cmd({ mode: 'fixed', point: { x: 5, y: 6, z: 7 } }), es, base)).toEqual({ x: 5, y: 6, z: 7 });
    expect(d.goal(cmd({ target: 'ghost' }), es, base)).toEqual(base);
  });

  it('eases zoom toward the request and shakes only while the strength is above zero', () => {
    const d = new CameraDirector();
    d.update(cmd({ zoom: 2, smoothness: 5 }), 0.1, false);
    expect(d.zoom).toBeGreaterThan(1);
    expect(d.zoom).toBeLessThan(2);
    d.update(cmd({ zoom: 2 }), 0.1, true);
    expect(d.zoom).toBe(2);
    d.update(cmd({ shake: 0 }), 0.1, false);
    expect(d.shakeOffset(10)).toEqual({ right: 0, up: 0 });
    d.update(cmd({ shake: 1 }), 0.013, false);
    const o = d.shakeOffset(10);
    expect(Math.hypot(o.right, o.up)).toBeGreaterThan(0);
    expect(Math.hypot(o.right, o.up)).toBeLessThan(10 * 0.04 * 2);
  });
});

describe('CameraRig with a play camera', () => {
  const modes = ['2d-side', '2d-top', '3d'] as const;
  for (const mode of modes) {
    it(`${mode}: fixed camera ignores the player; zoom narrows the view; no request keeps default follow`, () => {
      const rig = new CameraRig(mode);
      rig.resize(800, 600);
      const es = [view('p', 5, 0)];
      rig.update(es, 0.016, true);
      const plainSize = rig.size;
      const plainX = rig.camera.position.x;
      expect(plainX).toBeCloseTo(mode === '3d' ? plainX : 5, 0);
      rig.update(es, 0.016, true, cmd({ mode: 'fixed', point: { x: -20, y: 0, z: 0 }, zoom: 2 }));
      for (let i = 0; i < 200; i++) rig.update(es, 0.016, true, cmd({ mode: 'fixed', point: { x: -20, y: 0, z: 0 }, zoom: 2 }));
      expect(rig.size).toBeCloseTo(plainSize / 2, 3);
      expect(rig.camera.position.x).toBeLessThan(-15);
      // Back to no request: returns to following the player at the usual zoom.
      for (let i = 0; i < 400; i++) rig.update(es, 0.016, true, null);
      expect(rig.size).toBeCloseTo(plainSize, 3);
      expect(rig.camera.position.x).toBeCloseTo(plainX, 1);
    });
  }

  it('leaves the edit camera alone even when a request exists', () => {
    const rig = new CameraRig('2d-side');
    rig.resize(800, 600);
    const es = [view('p', 5, 0)];
    rig.update(es, 0.016, false);
    const size = rig.size;
    const x = rig.camera.position.x;
    for (let i = 0; i < 50; i++) rig.update(es, 0.016, false, cmd({ mode: 'fixed', point: { x: 99, y: 0, z: 0 }, zoom: 3, shake: 2 }));
    expect(rig.size).toBe(size);
    expect(rig.camera.position.x).toBe(x);
  });

  it('shakes the camera position while a request carries shake, then settles', () => {
    const rig = new CameraRig('2d-side');
    rig.resize(800, 600);
    const es = [view('p', 5, 0)];
    for (let i = 0; i < 30; i++) rig.update(es, 0.016, true, cmd());
    const still = rig.camera.position.clone();
    let moved = false;
    for (let i = 0; i < 20; i++) {
      rig.update(es, 0.016, true, cmd({ shake: 1 }));
      if (rig.camera.position.distanceTo(still) > 1e-3) moved = true;
    }
    expect(moved).toBe(true);
    for (let i = 0; i < 5; i++) rig.update(es, 0.016, true, cmd({ shake: 0 }));
    expect(rig.camera.position.distanceTo(still)).toBeLessThan(1e-3);
  });
});

describe('camera node', () => {
  it('sends a clamped request, clears it when off, and starts a shake on a pulse', () => {
    const w = makeWorld();
    const sent: (PlayCameraCommand | null)[] = [];
    w.setCamera = (_o, c) => void sent.push(c);
    const def = cameraNode;
    const params = defaultParams(def, { zoom: 9, shakeTime: 0.5 });
    const state = def.create!(makeCtx(w), params);
    const run = (inputs: Record<string, never | boolean | number | string | null>) => def.evaluate(makeCtx(w), inputs, params, state);
    expect(run({ target: 'e1' })).toEqual({ active: true });
    expect(sent[0]).toMatchObject({ mode: 'follow', target: 'e1', zoom: 4, shake: 0 });
    run({ zoom: 2 });
    expect(sent[1]!.zoom).toBe(2);
    run({ shake: true });
    expect(sent[2]!.shake).toBeGreaterThan(0.9);
    run({ shake: true }); // held, not a new pulse; decays
    expect(sent[3]!.shake).toBeLessThan(sent[2]!.shake);
    expect(run({ on: false })).toEqual({ active: false });
    expect(sent[4]).toBeNull();
  });
});

describe('teleport node', () => {
  it('fires once per pulse, prefers the destination object and reports done', () => {
    const w = makeWorld();
    const calls: { id: string; to: { x: number; y: number; z: number }; keep: boolean }[] = [];
    w.teleport = (id, to, keep) => {
      calls.push({ id, to, keep });
      return to;
    };
    w.entities.set('dst', { id: 'dst', kind: 'block', ownerNodeId: 'x', position: { x: 7, y: 1, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#fff', visible: true });
    const out = runNode(
      teleportNode,
      [
        { inputs: { who: 'p', go: false } },
        { inputs: { who: 'p', go: true } },
        { inputs: { who: 'p', go: true } },
        { inputs: { who: 'p', go: false, dest: 'dst' } },
        { inputs: { who: 'p', go: true, dest: 'dst' } },
        { inputs: { go: false } },
        { inputs: { go: true } },
      ],
      { position: { x: 1, y: 2, z: 3 }, keepVelocity: 'yes' },
      w,
    );
    expect(out.map((o) => o.done)).toEqual([false, true, false, false, true, false, false]);
    expect(calls).toEqual([
      { id: 'p', to: { x: 1, y: 2, z: 3 }, keep: true },
      { id: 'p', to: { x: 7, y: 1, z: 0 }, keep: true },
    ]);
  });

  it('reports not done when the world refuses', () => {
    const w = makeWorld();
    const out = runNode(teleportNode, [{ inputs: { who: 'p', go: true } }], {}, w);
    expect(out[0]!.done).toBe(false);
  });
});
