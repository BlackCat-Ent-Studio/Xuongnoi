import { beforeAll, describe, expect, it } from 'vitest';
import { registerAllNodes } from '../../src/nodes';
import { createRobotArmBoard } from '../../src/samples/robot-arm-board';
import type { Board } from '../../src/engine/types';
import { loadEngine, playReal } from '../helpers/cell-run-real';

/**
 * With "Vật lý thật" on, a gripper closing on a rigid crate that rests on a solid keeps it where the fingers hold it (a resting
 * contact is not an overlap), and the grip rule alone decides slipping: the fingers hold a lifted crate when
 * fingers x min(finger mu, crate mu) x force >= mass x 9.81, i.e. 2 x 0.5 x F >= 2 x 9.81 = 19.62 N for the 2 kg crate.
 */
beforeAll(async () => {
  registerAllNodes();
  await loadEngine();
});

/** The key-driven arm with a fixed grip force (the force counter starts at 1 and the scale maps 1 step to `force`). */
function boardWithForce(force: number): Board {
  const b = createRobotArmBoard();
  b.graph.nodes.find((n) => n.id === 'scale-force')!.params.outMax = force * 12;
  return b;
}

function run(force: number) {
  let keys = new Set<string>();
  const p = playReal(boardWithForce(force), () => keys);
  const crate = () => p.entity('crate-light');
  const tap = (code: string, times: number, withSpace = false): void => {
    for (let i = 0; i < times; i++) {
      keys = new Set(withSpace ? ['Space', code] : [code]);
      p.ticks(3);
      keys = new Set(withSpace ? ['Space'] : []);
      p.ticks(3);
    }
  };
  p.seconds(1);
  // The hand is solid: elbow first (the open hand stays high), then the shoulder lowers it round the crate.
  tap('KeyA', 2);
  p.seconds(2);
  tap('KeyS', 2);
  p.seconds(3);
  return { p, crate, tap, setKeys: (k: string[]) => (keys = new Set(k)) };
}

describe('gripper on a crate resting on a table (Vật lý thật)', () => {
  it('the crate stays within 1 cm of where it rests on the closing tick and the ticks after', () => {
    const r = run(25);
    const y0 = r.crate().position.y;
    const x0 = r.crate().position.x;
    // The light crate is a 0.3 m cube on the 0.6 m table: its centre is 0.75 m up.
    expect(y0).toBeGreaterThan(0.7);
    expect(y0).toBeLessThan(0.8);
    r.setKeys(['Space']);
    for (let i = 0; i < 30; i++) {
      r.p.tick();
      expect(Math.abs(r.crate().position.y - y0), `tick ${i}`).toBeLessThan(0.01);
      expect(Math.abs(r.crate().position.x - x0), `tick ${i}`).toBeLessThan(0.01);
    }
    expect(r.p.out('gripper', 'holding')).toBe(true);
    expect(r.p.out('gripper', 'slipped')).toBe(false);
    r.p.dispose();
  });

  it('just below the needed force (19.62 N) the crate is held while it rests but slips once lifted; just above it holds', () => {
    const weak = run(19.62 - 1);
    weak.setKeys(['Space']);
    weak.p.seconds(0.5);
    expect(weak.p.out('gripper', 'holding')).toBe(true);
    let slipped = false;
    for (let i = 0; i < 2; i++) {
      weak.setKeys(['Space', 'KeyW']);
      for (let k = 0; k < 3; k++) {
        weak.p.tick();
        slipped ||= weak.p.out('gripper', 'slipped') === true;
      }
      weak.setKeys(['Space']);
      for (let k = 0; k < 120; k++) {
        weak.p.tick();
        slipped ||= weak.p.out('gripper', 'slipped') === true;
      }
    }
    expect(slipped).toBe(true);
    expect(weak.crate().position.y).toBeLessThan(0.8);
    weak.p.dispose();

    const strong = run(19.62 + 1);
    strong.setKeys(['Space']);
    strong.p.seconds(0.5);
    strong.tap('KeyW', 2, true);
    strong.setKeys(['Space']);
    strong.p.seconds(2);
    expect(strong.p.out('gripper', 'holding')).toBe(true);
    expect(strong.crate().position.y).toBeGreaterThan(1.3);
    strong.p.dispose();
  });
});
