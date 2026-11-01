import { beforeEach, describe, expect, it } from 'vitest';
import type { PortValues } from '../../src/engine/types';
import { clearRegistry, listNodeDefs } from '../../src/engine/registry';
import { NODE_CATEGORY_LABELS, STEP_1_NODES, registerAllNodes } from '../../src/nodes';
import { andNode, notNode, orNode } from '../../src/nodes/bool-gates';
import { blockNode } from '../../src/nodes/block';
import { characterNode } from '../../src/nodes/character';
import { compareNode } from '../../src/nodes/compare';
import { constNode } from '../../src/nodes/const';
import { counterNode } from '../../src/nodes/counter';
import { keyNode } from '../../src/nodes/key';
import { mathNode } from '../../src/nodes/math';
import { onStartNode } from '../../src/nodes/on-start';
import { showNumberNode } from '../../src/nodes/show-number';
import { stickNode } from '../../src/nodes/stick';
import { timerNode } from '../../src/nodes/timer';
import { touchNode } from '../../src/nodes/touch';
import { winLoseNode } from '../../src/nodes/win-lose';
import { defaultParams, makeCtx, makeWorld, runNode } from './fake-world';

describe('registration', () => {
  beforeEach(() => clearRegistry());

  it('registers 54 kinds and is idempotent', () => {
    registerAllNodes();
    registerAllNodes();
    registerAllNodes();
    const defs = listNodeDefs();
    expect(defs).toHaveLength(54);
    expect(new Set(defs.map((d) => d.kind)).size).toBe(54);
  });

  it('every node has vi text, valid category and a value for every declared default', () => {
    for (const d of STEP_1_NODES) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
      expect(NODE_CATEGORY_LABELS[d.category]).toBeTruthy();
      for (const p of d.params) expect(p.default).toBeDefined();
      for (const p of [...d.inputs, ...d.outputs]) expect(p.label.length).toBeGreaterThan(0);
    }
  });
});

describe('key', () => {
  it('held stays on, pressed is a single pulse', () => {
    const out = runNode(keyNode, [{}, { keys: ['Space'] }, { keys: ['Space'] }, { keys: ['Space'] }, {}, { keys: ['Space'] }]);
    expect(out.map((o) => o.held)).toEqual([false, true, true, true, false, true]);
    expect(out.map((o) => o.pressed)).toEqual([false, true, false, false, false, true]);
  });

  it('uses the configured key', () => {
    const out = runNode(keyNode, [{ keys: ['Space'] }, { keys: ['KeyE'] }], { key: 'KeyE' });
    expect(out.map((o) => o.held)).toEqual([false, true]);
  });
});

describe('stick', () => {
  it('arrows: right = +x, up = +y', () => {
    const [a, b] = runNode(stickNode, [{ keys: ['ArrowRight', 'ArrowUp'] }, { keys: ['ArrowLeft', 'ArrowDown'] }]);
    expect(a).toEqual({ x: 1, y: 1 });
    expect(b).toEqual({ x: -1, y: -1 });
  });

  it('opposite keys cancel', () => {
    const [o] = runNode(stickNode, [{ keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] }]);
    expect(o).toEqual({ x: 0, y: 0 });
  });

  it('wasd scheme ignores arrows', () => {
    const out = runNode(stickNode, [{ keys: ['KeyD', 'KeyW'] }, { keys: ['ArrowRight'] }], { scheme: 'wasd' });
    expect(out[0]).toEqual({ x: 1, y: 1 });
    expect(out[1]).toEqual({ x: 0, y: 0 });
  });
});

describe('on-start', () => {
  it('fires only on tick 0', () => {
    const out = runNode(onStartNode, [{}, {}, {}]);
    expect(out.map((o) => o.fired)).toEqual([true, false, false]);
  });
});

describe('logic gates', () => {
  it('and / or / not truth tables, missing inputs are false', () => {
    const cases: [boolean, boolean][] = [[false, false], [false, true], [true, false], [true, true]];
    const w = makeWorld();
    const ev = (d: typeof andNode, i: Record<string, boolean>) => d.evaluate(makeCtx(w), i, {}, null).out;
    expect(cases.map(([a, b]) => ev(andNode, { a, b }))).toEqual([false, false, false, true]);
    expect(cases.map(([a, b]) => ev(orNode, { a, b }))).toEqual([false, true, true, true]);
    expect(ev(notNode, { in: true })).toBe(false);
    expect(ev(notNode, {})).toBe(true);
    expect(ev(andNode, {})).toBe(false);
  });
});

describe('const / math', () => {
  it('const outputs param', () => {
    expect(runNode(constNode, [{}], { value: 7.5 })[0]).toEqual({ value: 7.5 });
  });

  it('math ops and divide by zero', () => {
    const run = (op: string, a: number, b: number) => runNode(mathNode, [{ inputs: { a, b } }], { op })[0]?.out;
    expect(run('add', 2, 3)).toBe(5);
    expect(run('sub', 2, 3)).toBe(-1);
    expect(run('mul', 2, 3)).toBe(6);
    expect(run('div', 6, 3)).toBe(2);
    expect(run('div', 6, 0)).toBe(0);
  });
});

describe('compare', () => {
  const run = (op: string, a: number, b: number) => runNode(compareNode, [{ inputs: { a, b } }], { op })[0]?.out;

  it('all six operators', () => {
    expect([run('lt', 1, 2), run('lt', 2, 2)]).toEqual([true, false]);
    expect([run('le', 2, 2), run('le', 3, 2)]).toEqual([true, false]);
    expect([run('eq', 2, 2), run('eq', 2, 3)]).toEqual([true, false]);
    expect([run('ne', 2, 3), run('ne', 2, 2)]).toEqual([true, false]);
    expect([run('ge', 2, 2), run('ge', 1, 2)]).toEqual([true, false]);
    expect([run('gt', 3, 2), run('gt', 2, 2)]).toEqual([true, false]);
  });

  it('eq tolerates float noise', () => {
    expect(run('eq', 0.1 + 0.2, 0.3)).toBe(true);
    expect(run('ne', 0.1 + 0.2, 0.3)).toBe(false);
  });
});

describe('counter', () => {
  it('counts rising edges only, not held levels', () => {
    const t = { up: true };
    const out = runNode(counterNode, [{ inputs: t }, { inputs: t }, { inputs: {} }, { inputs: t }]);
    expect(out.map((o) => o.value)).toEqual([1, 1, 1, 2]);
  });

  it('down decrements, reset returns to start', () => {
    const out = runNode(
      counterNode,
      [{ inputs: { up: true } }, { inputs: {} }, { inputs: { up: true } }, { inputs: { down: true } }, { inputs: { reset: true } }],
      { start: 10 },
    );
    expect(out.map((o) => o.value)).toEqual([11, 11, 12, 11, 10]);
  });
  it('reached when value >= target', () => {
    const on: { inputs: PortValues } = { inputs: { up: true } };
    const off: { inputs: PortValues } = { inputs: {} };
    const pulse = (n: number) => Array.from({ length: n }, () => [on, off]).flat();
    const out = runNode(counterNode, pulse(3), { target: 3 });
    expect(out.map((o) => o.reached)).toEqual([false, false, false, false, true, true]);
  });
});

describe('timer', () => {
  it('done after seconds * 60 ticks, not before', () => {
    const out = runNode(timerNode, Array.from({ length: 180 }, () => ({})), { seconds: 3 });
    expect(out[178]?.done).toBe(false);
    expect(out[179]?.done).toBe(true);
    expect(out[179]?.left).toBe(0);
  });

  it('left never goes below zero and stays done', () => {
    const out = runNode(timerNode, Array.from({ length: 100 }, () => ({})), { seconds: 1 });
    expect(out[99]).toEqual({ left: 0, done: true });
  });

  it('run=false pauses', () => {
    const out = runNode(timerNode, [{ inputs: { run: false } }, { inputs: { run: false } }], { seconds: 2 });
    expect(out[1]?.left).toBe(2);
  });

  it('reset edge restarts the countdown', () => {
    const steps = [...Array.from({ length: 60 }, () => ({})), { inputs: { reset: true } }];
    const out = runNode(timerNode, steps, { seconds: 1 });
    expect(out[59]?.done).toBe(true);
    expect(out[60]?.done).toBe(false);
    expect(out[60]?.left).toBeCloseTo(1 - 1 / 60, 9);
  });
});

describe('character', () => {
  it('spawns a solid character owned by the node and reports its position', () => {
    const w = makeWorld();
    const params = defaultParams(characterNode, { position: { x: 2, y: 3, z: 4 } });
    const ctx = makeCtx(w, { nodeId: 'hero' });
    const s = characterNode.create!(ctx, params);
    expect(w.spawned[0]).toMatchObject({ kind: 'character', ownerNodeId: 'hero', position: { x: 2, y: 3, z: 4 }, color: '#3b82f6', solid: true });
    w.grounded = true;
    const out = characterNode.evaluate(ctx, {}, params, s);
    expect(out).toEqual({ self: 'e1', onGround: true, x: 2, y: 3, z: 4 });
  });

  it('clamps move intent and forwards jump/speed/jumpPower', () => {
    const w = makeWorld();
    const params = defaultParams(characterNode, { speed: 8, jumpPower: 12 });
    const s = characterNode.create!(makeCtx(w), params);
    characterNode.evaluate(makeCtx(w), { moveX: 5, moveY: -9, jump: true }, params, s);
    characterNode.evaluate(makeCtx(w), {}, params, s);
    expect(w.intents[0]?.intent).toEqual({ moveX: 1, moveY: -1, jump: true, speed: 8, jumpPower: 12 });
    expect(w.intents[1]?.intent).toEqual({ moveX: 0, moveY: 0, jump: false, speed: 8, jumpPower: 12 });
  });
});

describe('block', () => {
  it('solid vs pickup spawn', () => {
    const w = makeWorld();
    blockNode.create!(makeCtx(w), defaultParams(blockNode));
    blockNode.create!(makeCtx(w), defaultParams(blockNode, { type: 'pickup', color: '#facc15' }));
    expect(w.spawned[0]).toMatchObject({ kind: 'block', solid: true, color: '#a3a3a3', size: { x: 1, y: 1, z: 1 } });
    expect(w.spawned[1]).toMatchObject({ solid: false, color: '#facc15' });
  });

  it('hide is called once even if the input stays on or toggles again', () => {
    const w = makeWorld();
    const out = runNode(
      blockNode,
      [{}, { inputs: { hide: true } }, { inputs: { hide: true } }, { inputs: {} }, { inputs: { hide: true } }],
      {},
      w,
    );
    expect(w.hidden).toEqual(['e1']);
    expect(out.every((o) => o.self === 'e1')).toBe(true);
  });
});

describe('touch', () => {
  it('began fires once per contact', () => {
    const w = makeWorld();
    const state = touchNode.create!(makeCtx(w), {});
    const step = (touch: boolean) => {
      if (touch) w.touching.add('a|b');
      else w.touching.clear();
      return touchNode.evaluate(makeCtx(w), { a: 'a', b: 'b' }, {}, state);
    };
    const seq = [false, true, true, false, true].map(step);
    expect(seq.map((o) => o.touching)).toEqual([false, true, true, false, true]);
    expect(seq.map((o) => o.began)).toEqual([false, true, false, false, true]);
  });

  it('nothing connected means not touching', () => {
    const w = makeWorld();
    w.touching.add('a|b');
    const out = runNode(touchNode, [{ inputs: { a: 'a', b: null } }, { inputs: { a: 'a' } }], {}, w);
    expect(out.every((o) => o.touching === false && o.began === false)).toBe(true);
  });
});

describe('win-lose', () => {
  it('calls endGame with messages', () => {
    const w = makeWorld();
    runNode(winLoseNode, [{}, { inputs: { win: true } }], {}, w);
    expect(w.endCalls).toEqual([{ result: 'win', message: 'Bạn thắng rồi!' }]);
    const w2 = makeWorld();
    runNode(winLoseNode, [{ inputs: { lose: true } }], { loseMessage: 'Hỏng' }, w2);
    expect(w2.endCalls).toEqual([{ result: 'lose', message: 'Hỏng' }]);
  });

  it('does nothing when neither input is on', () => {
    const w = makeWorld();
    runNode(winLoseNode, [{}, { inputs: { win: false, lose: false } }], {}, w);
    expect(w.endCalls).toHaveLength(0);
  });
});

describe('show-number', () => {
  it('pushes a HUD item each tick keyed by node id', () => {
    const w = makeWorld();
    const params = defaultParams(showNumberNode, { label: 'Xu', corner: 'bottom-right' });
    showNumberNode.evaluate(makeCtx(w, { nodeId: 'hud1' }), { value: 3 }, params, null);
    showNumberNode.evaluate(makeCtx(w, { nodeId: 'hud1' }), {}, params, null);
    expect(w.huds).toEqual([
      { key: 'hud1', label: 'Xu', value: 3, corner: 'bottom-right' },
      { key: 'hud1', label: 'Xu', value: 0, corner: 'bottom-right' },
    ]);
  });
});
