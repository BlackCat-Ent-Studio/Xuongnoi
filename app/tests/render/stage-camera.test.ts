import { describe, expect, it } from 'vitest';
import type { EntityView } from '../../src/engine/types';
import { CameraRig, USER_ZOOM_MAX, clampCenter } from '../../src/render/cameras';
import { wheelZoomFactor } from '../../src/puzzle/ui/stage-camera-input';

function entity(id: string, kind: EntityView['kind'], x: number, y: number, w: number, h: number): EntityView {
  return { id, kind, ownerNodeId: id, position: { x, y, z: 0 }, size: { x: w, y: h, z: 1 }, color: '#fff', visible: true };
}

/** A 30-wide floor with a character on the left and a flag on the right, like the side-view puzzle levels. */
const SCENE: EntityView[] = [entity('ground', 'block', 0, -0.5, 30, 1), entity('bot', 'character', -10, 1, 1, 2), entity('flag', 'block', 10, 0.6, 0.8, 1.2)];

function stageRig(follow: string | null): CameraRig {
  const rig = new CameraRig('2d-side');
  rig.resize(844, 390);
  rig.setFit({ top: 0.12, bottom: 0.03, follow, heroScale: 1.6, sidePitch: 0.2 });
  rig.update(SCENE, 0, false);
  return rig;
}

/** Half of the visible world width of the framed view. */
const halfWidth = (rig: CameraRig): number => (rig.size * (844 / 390 / (1 - 0.12 - 0.03))) / 2;

describe('clampCenter', () => {
  it('keeps the view inside the span', () => {
    expect(clampCenter(100, 0, 10, 2)).toBe(8);
    expect(clampCenter(-100, 0, 10, 2)).toBe(2);
    expect(clampCenter(5, 0, 10, 2)).toBe(5);
  });
  it('centres a view bigger than the span', () => {
    expect(clampCenter(1, 0, 10, 8)).toBe(5);
  });
});

describe('stage camera of the player', () => {
  it('starts at the default framing', () => {
    const rig = stageRig(null);
    expect(rig.userCamera).toEqual({ zoom: 1, custom: false });
  });

  it('cannot pan or zoom out past the whole-scene view', () => {
    const rig = stageRig(null);
    const x0 = rig.focus.x;
    rig.userPanBy(900, 0);
    rig.update(SCENE, 0, false);
    expect(rig.focus.x).toBeCloseTo(x0, 5);
    rig.userZoomBy(0.1);
    expect(rig.userCamera.zoom).toBe(1);
  });

  it('zooms in up to the limit and then keeps the level in view while panning', () => {
    const rig = stageRig(null);
    rig.userZoomBy(100);
    expect(rig.userCamera.zoom).toBe(USER_ZOOM_MAX);
    const left = -15;
    const right = 15;
    for (const dx of [5000, -5000]) {
      rig.userPanBy(dx, 0);
      rig.update(SCENE, 0, false);
      expect(rig.focus.x - halfWidth(rig)).toBeGreaterThanOrEqual(left - 1e-6);
      expect(rig.focus.x + halfWidth(rig)).toBeLessThanOrEqual(right + 1e-6);
    }
    expect(rig.userCamera.custom).toBe(true);
  });

  it('zooms around the pointer in the whole-scene view and returns to the default at 1x', () => {
    const rig = stageRig(null);
    const { x, y } = rig.focus;
    rig.userZoomBy(3, { x: 0.8, y: -0.8 }); // lower right of the canvas
    rig.update(SCENE, 0, false);
    expect(rig.focus.x).toBeGreaterThan(x);
    expect(rig.focus.y).toBeLessThanOrEqual(y); // this scene is shallow, so the view stays centred vertically
    rig.userZoomBy(0.01, { x: 0.8, y: -0.8 });
    rig.update(SCENE, 0, false);
    expect(rig.userCamera).toEqual({ zoom: 1, custom: false });
    expect(rig.focus.x).toBeCloseTo(x, 5);
  });

  it('zoom shrinks the visible height by the factor', () => {
    const rig = stageRig(null);
    const before = rig.size;
    rig.userZoomBy(2);
    rig.update(SCENE, 0, false);
    expect(rig.size).toBeCloseTo(before / 2, 5);
  });

  it('a double tap or the reset button returns to the default', () => {
    const rig = stageRig(null);
    rig.userZoomBy(3);
    rig.userPanBy(120, 40);
    rig.update(SCENE, 0, false);
    expect(rig.userCamera.custom).toBe(true);
    rig.resetUserCamera(false);
    rig.update(SCENE, 0, false);
    expect(rig.userCamera).toEqual({ zoom: 1, custom: false });
  });

  it('a following camera can be zoomed out to the whole scene and stops following once dragged', () => {
    const overview = stageRig(null).size;
    const rig = stageRig('bot');
    expect(rig.size).toBeLessThan(overview);
    rig.userZoomBy(0.001);
    rig.update(SCENE, 0, false);
    expect(rig.size).toBeCloseTo(overview, 5);
    const rig2 = stageRig('bot');
    const followX = rig2.focus.x;
    rig2.userPanBy(-300, 0);
    rig2.update(SCENE, 0, false);
    expect(rig2.focus.x).toBeGreaterThan(followX);
  });

  it('handing the camera to a follow resets the player view', () => {
    const rig = stageRig(null);
    rig.userZoomBy(3);
    rig.setFit({ top: 0.12, bottom: 0.03, follow: 'bot', heroScale: 1.6, sidePitch: 0.2 });
    expect(rig.userCamera.zoom).toBe(1);
  });
});

describe('wheelZoomFactor', () => {
  it('zooms in when scrolling up and out when scrolling down', () => {
    expect(wheelZoomFactor(-100, false)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100, false)).toBeLessThan(1);
  });
  it('is steeper for a trackpad pinch and never extreme', () => {
    expect(wheelZoomFactor(-10, true)).toBeGreaterThan(wheelZoomFactor(-10, false));
    expect(wheelZoomFactor(-100000, false)).toBeLessThan(1.3);
  });
});
