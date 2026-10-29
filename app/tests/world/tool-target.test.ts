import { describe, expect, it } from 'vitest';
import { createWorld } from '../../src/world/world';
import type { CharacterIntent, EntitySpec, ViewMode, World } from '../../src/engine/types';

const DT = 1 / 60;
const intent = (p: Partial<CharacterIntent> = {}): CharacterIntent => ({
  moveX: 0, moveY: 0, jump: false, speed: 5, jumpPower: 10, ...p,
});
const box = (kind: 'block' | 'item', x: number, y: number, z: number, w: number, d: number, h = 0.8): EntitySpec => ({
  kind, ownerNodeId: kind, position: { x, y, z }, size: { x: w, y: h, z: d }, color: '#fff', solid: kind === 'block',
});
const char = (y: number): EntitySpec => ({
  kind: 'character', ownerNodeId: 'c', position: { x: 0, y, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#f00', solid: true,
});

/** An open floor with a character that has turned toward (dx, dz) by walking a tiny step and stopping. */
function setup(mode: ViewMode, dx: number, dz: number) {
  const w: World = createWorld(mode);
  const y = mode === '2d-top' ? 0 : 0.5;
  if (mode === '2d-side') for (let x = -10; x <= 10; x++) w.spawn(box('block', x, -0.5, 0, 1, 1, 1));
  if (mode === '3d') for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) w.spawn(box('block', x, -0.5, z, 1, 1, 1));
  const c = w.spawn(char(y));
  w.setCharacterIntent(c, intent({ moveX: dx, moveY: mode === '2d-side' ? 0 : -dz, speed: 0.01 }));
  for (let i = 0; i < 3; i++) w.step(DT);
  w.setCharacterIntent(c, intent());
  w.step(DT);
  const p = w.getEntity(c)!.position;
  const at = (fwd: number, side = 0) => {
    const n = Math.hypot(dx, dz);
    const ux = dx / n;
    const uz = dz / n;
    return { x: p.x + ux * fwd - uz * side, z: p.z + uz * fwd + ux * side, y };
  };
  return { w, c, y, at };
}

const facings: Array<[ViewMode, number, number]> = [
  ['2d-top', 1, 1],
  ['2d-top', -1, 1],
  ['3d', 1, 1],
  ['3d', -1, -1],
  ['2d-side', 1, 0],
  ['2d-side', -1, 0],
];

describe.each(facings)('tool target in %s facing (%d, %d)', (mode, dx, dz) => {
  it('prefers a close item in front over a wide wall whose surface is slightly farther', () => {
    const { w, c, y } = setup(mode, dx, dz);
    const o = w.getEntity(c)!.position;
    const sx = Math.sign(dx);
    const sz = mode === '2d-side' ? 0 : Math.sign(dz);
    // Wall across the x axis, long in z, so its centre projects far ahead of the diagonal facing.
    const wall = w.spawn(box('block', o.x + sx * 1.0, y, 0, 0.4, 4));
    const small = w.spawn(box('item', o.x + sx * 0.5, y, o.z + sz * 0.5, 0.3, 0.3, 0.3));
    w.step(DT);
    expect(w.useTool(c, 1.6)!.target).toBe(small);
    expect(small).not.toBe(wall);
  });

  it('never hits something behind the character', () => {
    const { w, c, at } = setup(mode, dx, dz);
    const b = at(-0.9);
    w.spawn({ ...box('block', b.x, b.y, mode === '2d-side' ? 0 : b.z, 1, 1), position: { x: b.x, y: b.y, z: mode === '2d-side' ? 0 : b.z } });
    w.step(DT);
    expect(w.useTool(c, 1.6)!.target).toBeNull();
  });

  it('breaks equal-distance ties the same way every time', () => {
    const picks = [0, 1, 2].map(() => {
      const { w, c, at } = setup(mode, dx, dz);
      const q = at(0.9);
      const pos = { x: q.x, y: q.y, z: mode === '2d-side' ? 0 : q.z };
      const first = w.spawn({ ...box('item', pos.x, pos.y, pos.z, 0.3, 0.3, 0.3), position: pos });
      w.spawn({ ...box('item', pos.x, pos.y, pos.z, 0.3, 0.3, 0.3), position: pos });
      w.step(DT);
      return { target: w.useTool(c, 1.6)!.target, first };
    });
    for (const p of picks) expect(p.target).toBe(p.first);
  });
});
