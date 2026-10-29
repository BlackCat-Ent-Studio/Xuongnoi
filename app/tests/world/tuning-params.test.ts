import { describe, expect, it } from 'vitest';
import { carryNode } from '../../src/nodes/carry';
import { characterNode } from '../../src/nodes/character';
import { fightNode } from '../../src/nodes/fight';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx, runNode } from '../nodes/fake-world';
import type { EntityId, EntitySpec, Params, ViewMode, World } from '../../src/engine/types';

const DT = 1 / 60;
const run = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) w.step(DT);
};

const floor = (w: World, mode: ViewMode): void => {
  if (mode === '3d') for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) w.spawn(blockAt(x, -0.5, z));
  else for (let x = -8; x <= 8; x++) w.spawn(blockAt(x, -0.5, 0));
};
const blockAt = (x: number, y: number, z: number): EntitySpec => ({
  kind: 'block', ownerNodeId: 'b', position: { x, y, z }, size: { x: 1, y: 1, z: 1 }, color: '#fff', solid: true,
});

/** A character made by the real node (so the node params reach the world), at x. */
function makeChar(w: World, x: number, over: Params = {}): EntityId {
  const params = defaultParams(characterNode, { position: { x, y: 1, z: 0 }, ...over });
  return characterNode.create!(makeCtx(w), params).id;
}

describe('character hit-reaction params', () => {
  /** Attacker at x=0 hits the victim at x=1 once; returns the victim after `ticks` more steps. */
  function hit(over: Params, ticks: number) {
    const w = createWorld('2d-side');
    floor(w, '2d-side');
    const a = makeChar(w, 0);
    const b = makeChar(w, 1, over);
    w.setHealth(b, 10, false);
    run(w, 5);
    w.setCharacterIntent(a, { moveX: 1, moveY: 0, jump: false, speed: 0.01, jumpPower: 0 });
    run(w, 2);
    w.setCharacterIntent(a, { moveX: 0, moveY: 0, jump: false, speed: 0, jumpPower: 0 });
    const x0 = w.getEntity(b)!.position.x;
    expect(w.useTool(a, 1.3)).toEqual({ target: b });
    run(w, ticks);
    return { w, a, b, dx: w.getEntity(b)!.position.x - x0 };
  }

  it('defaults reproduce the built-in numbers', () => {
    const p = defaultParams(characterNode);
    expect([p.invulnSeconds, p.knockSpeed, p.knockLift]).toEqual([0.5, 7, 5]);
    const w = createWorld('2d-side');
    expect(characterNode.params.filter((d) => d.advanced).map((d) => d.id)).toEqual(expect.arrayContaining(['invulnSeconds', 'knockSpeed', 'knockLift']));
    expect(w.mode).toBe('2d-side');
  });

  it('knockSpeed changes how far the push carries', () => {
    const base = hit({}, 20).dx;
    const strong = hit({ knockSpeed: 14 }, 20).dx;
    const none = hit({ knockSpeed: 0 }, 20).dx;
    expect(strong).toBeGreaterThan(base + 0.5);
    expect(none).toBeLessThan(base - 0.5);
  });

  it('knockLift changes the hop height', () => {
    const peak = (over: Params): number => {
      const { w, b } = hit(over, 0);
      let top = 0;
      for (let i = 0; i < 40; i++) {
        w.step(DT);
        top = Math.max(top, w.getEntity(b)!.position.y);
      }
      return top;
    };
    const base = peak({});
    expect(peak({ knockLift: 10 })).toBeGreaterThan(base + 0.5);
    expect(peak({ knockLift: 0 })).toBeLessThan(base - 0.3);
  });

  it('invulnSeconds decides when a second hit lands', () => {
    const second = (over: Params): number | undefined => {
      const { w, a, b } = hit({ knockSpeed: 0, ...over }, 21); // 0.35 s after the first hit; no push, so still in reach
      w.useTool(a, 1.3);
      return w.healthOf(b)?.hp;
    };
    expect(second({})).toBe(9); // default 0.5 s: second swing ignored
    expect(second({ invulnSeconds: 0.1 })).toBe(8); // short window: second swing lands
  });
});

describe('carry drop distance and throw lift', () => {
  const setup = (mode: ViewMode) => {
    const w = createWorld(mode);
    floor(w, mode);
    const c = makeChar(w, 0);
    const it = w.spawn({ kind: 'item', ownerNodeId: 'i', position: { x: 0.3, y: 0.3, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#ff0', solid: false });
    run(w, 5);
    w.grab(c, 1.2);
    run(w, 5);
    return { w, c, it };
  };

  it('dropDistance 0 keeps the default spot; a larger value drops farther', () => {
    const drop = (over: Params): number => {
      const { w, c, it } = setup('3d');
      runNode(carryNode, [{ inputs: { character: c, drop: true } }], over, w);
      run(w, 90);
      return w.getEntity(it)!.position.x - w.getEntity(c)!.position.x;
    };
    const def = drop({});
    expect(drop({ dropDistance: 0 })).toBeCloseTo(def, 6);
    expect(drop({ dropDistance: 2 })).toBeGreaterThan(def + 0.8);
    expect(carryNode.params.find((d) => d.id === 'dropDistance')?.advanced).toBe(true);
  });

  it('throwLift 0.5 keeps the default arc; 0 throws flat, more throws higher', () => {
    const peak = (over: Params): number => {
      const { w, c, it } = setup('2d-side');
      runNode(carryNode, [{ inputs: { character: c, throw: true } }], { throwPower: 8, ...over }, w);
      const y0 = w.getEntity(it)!.position.y;
      let top = y0;
      for (let i = 0; i < 60; i++) {
        w.step(DT);
        top = Math.max(top, w.getEntity(it)!.position.y);
      }
      return top - y0;
    };
    const def = peak({});
    expect(peak({ throwLift: 0.5 })).toBeCloseTo(def, 6);
    expect(peak({ throwLift: 1.5 })).toBeGreaterThan(def + 1);
    expect(peak({ throwLift: 0 })).toBeLessThan(def - 0.1);
  });
});

describe('fight backoffSeconds', () => {
  /** Bot at x=0, target at x=1 (in range); returns the bot's horizontal stick on the tick after its first attack. */
  function afterAttack(over: Params): { attacked: boolean; moveX: number } {
    const w = createWorld('2d-side');
    floor(w, '2d-side');
    const bot = makeChar(w, 0, { role: 'bot' });
    const target = makeChar(w, 1);
    run(w, 5);
    const out = runNode(fightNode, [{ inputs: { self: bot, target } }, { inputs: { self: bot, target } }], { sightRange: 30, ...over }, w);
    return { attacked: out[0]!.attack === true, moveX: Number(out[1]!.moveX) };
  }

  it('steps back by default and stays put when set to 0', () => {
    const def = afterAttack({});
    expect(def.attacked).toBe(true);
    expect(Math.abs(def.moveX)).toBeGreaterThan(0.5);
    expect(afterAttack({ backoffSeconds: 0.25 }).moveX).toBeCloseTo(def.moveX, 6);
    expect(Math.abs(afterAttack({ backoffSeconds: 0 }).moveX)).toBeLessThan(0.1);
    expect(fightNode.params.find((d) => d.id === 'backoffSeconds')?.advanced).toBe(true);
  });
});
