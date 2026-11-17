import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntitySpec, type PortValues, type Vec3, type ViewMode } from '../../src/engine/types';
import { blockNode } from '../../src/nodes/block';
import { counterNode } from '../../src/nodes/counter';
import { itemNode } from '../../src/nodes/item';
import { activeOutputs } from '../../src/engine/registry';
import { SELECT_MAX_CHOICES, selectNumberNode } from '../../src/nodes/select-number';
import { createWorld } from '../../src/world/world';
import { makeWorld, runNode } from './fake-world';

describe('hide then show again (nodes)', () => {
  for (const def of [blockNode, itemNode]) {
    it(`${def.kind}: a rising edge of "show" revives a hidden one, once per edge`, () => {
      const w = makeWorld();
      runNode(def, [{}, { inputs: { hide: true } }, { inputs: { hide: true } }, {}, { inputs: { show: true } }, { inputs: { show: true } }, {}, { inputs: { show: true } }], {}, w);
      expect(w.hidden).toHaveLength(1);
      // the second show edge finds it already visible, so it is not repeated
      expect(w.shown).toHaveLength(1);
    });

    it(`${def.kind}: show before any hide does nothing; hide works again after a revive`, () => {
      const w = makeWorld();
      runNode(def, [{ inputs: { show: true } }, {}, { inputs: { hide: true } }, {}, { inputs: { show: true } }, {}, { inputs: { hide: true } }], {}, w);
      expect(w.shown).toHaveLength(1);
      expect(w.hidden).toHaveLength(2);
    });

    it(`${def.kind}: hide and show on the same tick end visible`, () => {
      const w = makeWorld();
      runNode(def, [{ inputs: { hide: true, show: true } }], {}, w);
      expect(w.hidden).toHaveLength(1);
      expect(w.shown).toHaveLength(1);
    });
  }

  it('block drives a real world: hide then show', () => {
    const w = createWorld('2d-side');
    const params = { position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#fff', type: 'solid' };
    const ctx = { dt: TICK_DT, tick: 0, mode: w.mode, input: { keysDown: new Set<string>() }, world: w, nodeId: 'b' };
    const st = blockNode.create!(ctx, params);
    blockNode.evaluate(ctx, { hide: true }, params, st);
    expect(w.getEntity(st.id)!.visible).toBe(false);
    blockNode.evaluate(ctx, { hide: false }, params, st);
    blockNode.evaluate(ctx, { show: true }, params, st);
    expect(w.getEntity(st.id)!.visible).toBe(true);
  });
});

const spec = (kind: 'block' | 'item' | 'character', position: Vec3, size: Vec3, solid: boolean): EntitySpec => ({
  kind,
  ownerNodeId: kind,
  position,
  size,
  color: '#888',
  solid,
});

describe('world.show', () => {
  const modes: ViewMode[] = ['2d-side', '2d-top', '3d'];
  for (const mode of modes) {
    it(`${mode}: a hidden solid block is solid again and bumps the solid revision`, () => {
      const w = createWorld(mode);
      const floor = w.spawn(spec('block', { x: 0, y: -0.5, z: 0 }, { x: 20, y: 1, z: 20 }, true));
      w.hide(floor);
      const hiddenRev = w.solidRevision();
      expect(w.solidBoxes()).toHaveLength(0);
      w.show(floor);
      expect(w.getEntity(floor)!.visible).toBe(true);
      expect(w.solidRevision()).toBeGreaterThan(hiddenRev);
      expect(w.solidBoxes()).toHaveLength(1);
    });

    it(`${mode}: showing something already visible, or unknown, is a no-op`, () => {
      const w = createWorld(mode);
      const b = w.spawn(spec('block', { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, true));
      const rev = w.solidRevision();
      w.show(b);
      w.show('nope');
      expect(w.solidRevision()).toBe(rev);
    });
  }

  it('a revived floor holds a character up again (side view)', () => {
    const w = createWorld('2d-side');
    const floor = w.spawn(spec('block', { x: 0, y: -0.5, z: 0 }, { x: 20, y: 1, z: 1 }, true));
    const me = w.spawn(spec('character', { x: 0, y: 3, z: 0 }, { x: 1, y: 1, z: 1 }, true));
    w.hide(floor);
    w.show(floor);
    for (let i = 0; i < 120; i++) w.step(TICK_DT);
    expect(w.isOnGround(me)).toBe(true);
    expect(w.getEntity(me)!.position.y).toBeGreaterThan(-0.1);
  });

  it('a pickup block (not solid) comes back without touching the solid revision', () => {
    const w = createWorld('2d-side');
    const b = w.spawn(spec('block', { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, false));
    w.hide(b);
    const rev = w.solidRevision();
    w.show(b);
    expect(w.getEntity(b)!.visible).toBe(true);
    expect(w.solidRevision()).toBe(rev);
  });

  it('a hidden item returns visible and is not held any more', () => {
    const w = createWorld('2d-side');
    w.spawn(spec('block', { x: 0, y: -0.5, z: 0 }, { x: 20, y: 1, z: 1 }, true));
    const me = w.spawn(spec('character', { x: 0, y: 0.5, z: 0 }, { x: 1, y: 1, z: 1 }, true));
    const it = w.spawn({ ...spec('item', { x: 0.3, y: 0.3, z: 0 }, { x: 0.6, y: 0.6, z: 0.6 }, false), carryable: true });
    w.step(TICK_DT);
    expect(w.grab(me, 2)).toBe(it);
    w.hide(it);
    w.show(it);
    expect(w.getEntity(it)!.visible).toBe(true);
    expect(w.heldItem(me)).toBeNull();
  });

  it('a block revived onto a character still shows and is not moved (documented rule)', () => {
    const w = createWorld('2d-side');
    const b = w.spawn(spec('block', { x: 0, y: 0.5, z: 0 }, { x: 1, y: 1, z: 1 }, true));
    w.hide(b);
    const me = w.spawn(spec('character', { x: 0, y: 0.5, z: 0 }, { x: 1, y: 1, z: 1 }, true));
    w.show(b);
    expect(w.getEntity(b)!.visible).toBe(true);
    expect(w.getEntity(b)!.position).toEqual({ x: 0, y: 0.5, z: 0 });
    expect(w.getEntity(me)!.visible).toBe(true);
  });

  it('does not bring back dropped copies', () => {
    const w = createWorld('2d-side');
    const copy = w.spawn({ ...spec('block', { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, false), disposable: true });
    w.hide(copy);
    w.show(copy);
    expect(w.getEntity(copy)?.visible ?? false).toBe(false);
  });
});

describe('counter number inputs', () => {
  const val = (steps: Parameters<typeof runNode>[1], params = {}) => runNode(counterNode, steps, params).map((o) => o.value);

  it('old behaviour unchanged when the new ports are empty', () => {
    expect(val([{ inputs: { up: true } }, { inputs: { up: false } }, { inputs: { up: true } }, { inputs: { down: true } }])).toEqual([1, 1, 2, 1]);
  });

  it('adds the number on a rising edge only, negatives allowed', () => {
    const out = val([
      { inputs: { addAmount: 5, add: true } },
      { inputs: { addAmount: 5, add: true } },
      { inputs: { addAmount: -2, add: false } },
      { inputs: { addAmount: -2, add: true } },
    ]);
    expect(out).toEqual([5, 5, 5, 3]);
  });

  it('add with no number wired adds 0; NaN is ignored', () => {
    expect(val([{ inputs: { add: true } }, { inputs: { add: false } }, { inputs: { add: true, addAmount: Number.NaN } }])).toEqual([0, 0, 0]);
  });

  it('sets the count on a rising edge and keeps reached semantics', () => {
    const out = runNode(
      counterNode,
      [
        { inputs: { setAmount: 7, set: true } },
        { inputs: { setAmount: 7, set: true } },
        { inputs: { up: true, setAmount: 7, set: false } },
        { inputs: { setAmount: 2, set: true } },
      ],
      { target: 5 },
    );
    expect(out.map((o) => o.value)).toEqual([7, 7, 8, 2]);
    expect(out.map((o) => o.reached)).toEqual([true, true, true, false]);
  });

  it('set wins over +1 on the same tick; reset then add still works', () => {
    expect(val([{ inputs: { up: true, set: true, setAmount: 10 } }])).toEqual([10]);
    expect(val([{ inputs: { up: true } }, { inputs: { reset: true, add: true, addAmount: 4 } }], { start: 3 })).toEqual([4, 7]);
  });
});

describe('select-number node', () => {
  const run = (values: (number | undefined)[], choices = 3) =>
    runNode(selectNumberNode, values.map((value) => ({ inputs: (value === undefined ? {} : { value }) as PortValues })), { choices });
  const picked = (o: Record<string, unknown>) =>
    Array.from({ length: SELECT_MAX_CHOICES }, (_, k) => (o[`is${k + 1}`] ? k + 1 : 0)).filter(Boolean);

  it('lights exactly the matching output, rounding the input', () => {
    const [a, b, c, d] = run([1, 2.4, 2.6, 3]);
    expect(picked(a!)).toEqual([1]);
    expect(picked(b!)).toEqual([2]);
    expect(picked(c!)).toEqual([3]);
    expect(picked(d!)).toEqual([3]);
  });

  it('nothing lit when out of range, zero, negative, NaN or unwired; ports above N stay false', () => {
    for (const o of run([0, 4, -1, 99, undefined, Number.NaN])) expect(picked(o)).toEqual([]);
    expect(picked(run([5], 6)[0]!)).toEqual([5]);
    expect(picked(run([5], 3)[0]!)).toEqual([]);
  });

  it('emits exactly the ports the card shows: the old six up to 6 choices, more only above; the count is clamped to 2..12', () => {
    const keys = (n: number) => Object.keys(run([1], n)[0]!).sort();
    const shown = (n: number) => activeOutputs(selectNumberNode, { choices: n }).map((p) => p.id).sort();
    for (const n of [2, 3, 6, 7, 9, 12]) expect(keys(n)).toEqual(shown(n));
    expect(keys(2)).toEqual(keys(6));
    expect(keys(3)).toEqual(selectNumberNode.outputs.map((p) => p.id).sort());
    expect(shown(12)).toHaveLength(13);
    expect(picked(run([3], 1)[0]!)).toEqual([]);
    expect(picked(run([12], 99)[0]!)).toEqual([12]);
    expect(picked(run([7], 6)[0]!)).toEqual([]);
    expect(picked(run([7], 7)[0]!)).toEqual([7]);
    expect(picked(run([11], 12)[0]!)).toEqual([11]);
  });

  it('lists the extra ports (7-12) as optional, so old saved wires still resolve', () => {
    expect(selectNumberNode.outputs.map((p) => p.id)).toEqual(['is1', 'is2', 'is3', 'is4', 'is5', 'is6', 'changed']);
    expect(selectNumberNode.optionalOutputs?.all.map((p) => p.id)).toEqual(['is7', 'is8', 'is9', 'is10', 'is11', 'is12']);
  });

  it('"Khi đổi" pulses when the choice changes, not on the first tick or while steady', () => {
    const out = run([2, 2, 3, 3, 3.4, 1, 9, 9]);
    expect(out.map((o) => o.changed)).toEqual([false, false, true, false, false, true, true, false]);
  });
});
