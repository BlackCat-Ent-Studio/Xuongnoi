import { describe, expect, it } from 'vitest';
import type { EntityId, HudItem } from '../../src/engine/types';
import { GUIDE_ARRIVED_DISTANCE, guideArrowNode } from '../../src/nodes/guide-arrow';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx } from './fake-world';

type W = ReturnType<typeof createWorld>;

function thing(w: W, x: number, z: number, y = 0.5): EntityId {
  return w.spawn({ kind: 'block', ownerNodeId: 'b', position: { x, y, z }, size: { x: 1, y: 1, z: 1 }, color: '#888', solid: false });
}
function run(w: W, inputs: Record<string, EntityId | boolean | null>, over: Record<string, string> = {}) {
  const params = defaultParams(guideArrowNode, over);
  const out = guideArrowNode.evaluate(makeCtx(w, { nodeId: 'arrow' }), { show: true, ...inputs }, params, null);
  const hud = w.hudItems().find((h) => h.key === 'arrow') as HudItem;
  return { out, hud };
}

describe('guide arrow node', () => {
  it('points from "Từ" to "Tới" with a rounded ground distance', () => {
    const w = createWorld('3d');
    const a = thing(w, 0, 0);
    const b = thing(w, 6, 8, 5); // height must not count
    const { out, hud } = run(w, { from: a, to: b }, { color: '#ff0000' });
    expect(out.distance).toBeCloseTo(10);
    expect(hud).toMatchObject({ value: 10, anchor: a, guide: { to: b, showDistance: true }, color: '#ff0000', hidden: false });
  });

  it('can hide the distance label', () => {
    const w = createWorld('3d');
    const { hud } = run(w, { from: thing(w, 0, 0), to: thing(w, 9, 0) }, { showDistance: 'no' });
    expect(hud.guide?.showDistance).toBe(false);
  });

  it('hides when "Tới" is empty, hidden, "Hiện" is off, or the target is within reach', () => {
    const w = createWorld('3d');
    const a = thing(w, 0, 0);
    const far = thing(w, 9, 0);
    expect(run(w, { from: a, to: null }).hud.hidden).toBe(true);
    expect(run(w, { from: a, to: null }).out.distance).toBe(0);
    expect(run(w, { from: a, to: far, show: false }).hud.hidden).toBe(true);
    expect(run(w, { from: a, to: thing(w, GUIDE_ARRIVED_DISTANCE - 0.1, 0) }).hud.hidden).toBe(true);
    expect(run(w, { from: a, to: thing(w, GUIDE_ARRIVED_DISTANCE + 0.1, 0) }).hud.hidden).toBe(false);
    w.hide(far);
    expect(run(w, { from: a, to: far }).hud.hidden).toBe(true);
    expect(run(w, { from: null, to: far }).hud.hidden).toBe(true);
  });

  it('works in the side view, where only x counts', () => {
    const w = createWorld('2d-side');
    const { out } = run(w, { from: thing(w, 1, 0), to: thing(w, 8, 0, 4) });
    expect(out.distance).toBeCloseTo(7);
  });
});
