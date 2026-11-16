import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { activeOutputs } from '../../src/engine/registry';
import { TICK_DT, type Graph } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { pidNode } from '../../src/nodes/pid';
import { DEFAULT_PID_CONFIG, createPidState, pidHold, pidStep, resetPid, type PidConfig } from '../../src/nodes/pid-math';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx, makeWorld } from './fake-world';

const cfg = (over: Partial<PidConfig> = {}): PidConfig => ({ ...DEFAULT_PID_CONFIG, ...over });

/** First-order plant: x' = (gain * u - x) / tau, driven by the controller for `seconds`. */
function simulate(c: PidConfig, target: number, seconds: number, plant = { gain: 1, tau: 0.5 }) {
  const s = createPidState();
  let x = 0;
  const trace: { x: number; out: number; error: number; i: number; saturated: boolean }[] = [];
  for (let k = 0; k < Math.round(seconds * 60); k++) {
    const r = pidStep(s, c, x, target);
    x += (TICK_DT * (plant.gain * r.out - x)) / plant.tau;
    trace.push({ x, out: r.out, error: r.error, i: r.i, saturated: r.saturated });
  }
  return { trace, state: s, final: x };
}

describe('pid math', () => {
  it('P only: output is Kp times the error and the plant settles short of the target', () => {
    const c = cfg({ kp: 4, outMin: -100, outMax: 100 });
    const first = pidStep(createPidState(), c, 1, 3);
    expect(first).toMatchObject({ error: 2, p: 8, i: 0, d: 0, out: 8, saturated: false });
    const { final } = simulate(c, 1, 8);
    // Steady state of a unit-gain plant under P control: target * Kp / (1 + Kp) = 0.8.
    expect(final).toBeCloseTo(0.8, 2);
  });

  it('I removes the steady-state error that P leaves', () => {
    const p = simulate(cfg({ kp: 1, ki: 0, outMin: -100, outMax: 100 }), 1, 40).final;
    const pi = simulate(cfg({ kp: 1, ki: 1, outMin: -100, outMax: 100 }), 1, 40).final;
    expect(Math.abs(1 - p)).toBeGreaterThan(0.3);
    expect(Math.abs(1 - pi)).toBeLessThan(0.01);
  });

  it('clamps the output to the limits and reports it', () => {
    const r = pidStep(createPidState(), cfg({ kp: 10, outMin: -1, outMax: 1 }), 0, 5);
    expect(r.out).toBe(1);
    expect(r.saturated).toBe(true);
    expect(pidStep(createPidState(), cfg({ kp: 10 }), 0, -5).out).toBe(-1);
    expect(pidStep(createPidState(), cfg({ kp: 10 }), 0, 0.01).saturated).toBe(false);
  });

  it('repairs reversed limits', () => {
    const r = pidStep(createPidState(), cfg({ kp: 10, outMin: 2, outMax: -2 }), 0, 5);
    expect(r.out).toBe(2);
  });

  it('anti-windup stops the integral growing while saturated; without it the integral keeps growing', () => {
    // Plant that never reaches the target (gain too small), so the output stays saturated for the whole run.
    const hopeless = { gain: 0.1, tau: 0.5 };
    const on = simulate(cfg({ kp: 1, ki: 2, antiWindup: true }), 10, 10, hopeless);
    const off = simulate(cfg({ kp: 1, ki: 2, antiWindup: false }), 10, 10, hopeless);
    expect(on.state.integral).toBeLessThanOrEqual(1);
    expect(off.state.integral).toBeGreaterThan(50);
  });

  it('anti-windup recovers faster after saturation', () => {
    const run = (antiWindup: boolean): number => {
      const s = createPidState();
      let x = 0;
      let target = 10; // far away: saturated for a long time
      let overshoot = 0;
      for (let k = 0; k < 60 * 30; k++) {
        if (k === 60 * 10) target = 1;
        const r = pidStep(s, cfg({ kp: 2, ki: 2, antiWindup }), x, target);
        x += (TICK_DT * (r.out * 1.2 - x)) / 0.5;
        if (k >= 60 * 10) overshoot = Math.max(overshoot, x - 1);
      }
      return overshoot;
    };
    expect(run(true)).toBeLessThan(run(false));
  });

  it('reset clears the integral and the derivative memory', () => {
    const s = createPidState();
    for (let k = 0; k < 120; k++) pidStep(s, cfg({ ki: 1, outMin: -100, outMax: 100 }), 0, 1);
    expect(s.integral).toBeGreaterThan(1);
    resetPid(s);
    expect(s).toEqual(createPidState());
    expect(pidStep(s, cfg({ kp: 0, ki: 1, kd: 5 }), 0, 1).d).toBe(0);
  });

  it('derivative on measurement does not kick when the target jumps; on error it does', () => {
    const kick = (onMeasurement: boolean): number => {
      const s = createPidState();
      const c = cfg({ kp: 0, kd: 1, dFilter: 0, dOnMeasurement: onMeasurement, outMin: -1000, outMax: 1000 });
      pidStep(s, c, 0, 0);
      return pidStep(s, c, 0, 5).d;
    };
    expect(kick(true)).toBeCloseTo(0, 9);
    expect(kick(false)).toBeCloseTo(5 * 60, 6);
  });

  it('D opposes a fast approach and the filter smooths it', () => {
    const slope = (dFilter: number): number => {
      const s = createPidState();
      const c = cfg({ kp: 0, kd: 1, dFilter, outMin: -1000, outMax: 1000 });
      pidStep(s, c, 0, 10);
      return pidStep(s, c, 0.1, 10).d;
    };
    expect(slope(0)).toBeCloseTo(-6, 6);
    expect(slope(0.9)).toBeCloseTo(-0.6, 6);
  });

  it('a held (disabled) controller outputs 0, accumulates nothing and does not jump when switched back on', () => {
    const s = createPidState();
    const c = cfg({ kp: 1, ki: 1, kd: 1, outMin: -100, outMax: 100 });
    for (let k = 0; k < 60; k++) pidStep(s, c, 0, 1);
    const kept = s.integral;
    const held = pidHold(s, 0.5, 1);
    expect(held).toMatchObject({ out: 0, error: 0.5, saturated: false });
    for (let k = 0; k < 60; k++) pidHold(s, 0.5, 1);
    expect(s.integral).toBe(kept);
    expect(pidStep(s, c, 0.5, 1).d).toBe(0);
  });

  it('ignores non-finite numbers', () => {
    const r = pidStep(createPidState(), cfg({ kp: Number.NaN }), Number.NaN, Number.POSITIVE_INFINITY);
    expect(Object.values(r).every((v) => typeof v === 'boolean' || Number.isFinite(v))).toBe(true);
  });

  it('is deterministic: the same run twice gives identical numbers', () => {
    const c = cfg({ kp: 3, ki: 1.5, kd: 0.4, dFilter: 0.3 });
    expect(simulate(c, 2, 5).trace).toEqual(simulate(c, 2, 5).trace);
  });
});

describe('pid node', () => {
  const params = (over = {}) => defaultParams(pidNode, over);
  const state = () => pidNode.create!(makeCtx(makeWorld()), params());
  const NO_TARGET = Number.NaN;

  it('uses the "Giá trị đặt" setting while no wire gives a target, and the wire once there is one', () => {
    const s = state();
    const p = params({ target: 0.5, kp: 1 });
    expect(pidNode.evaluate(makeCtx(makeWorld()), { measured: 0, target: NO_TARGET, enable: true }, p, s)).toMatchObject({ error: 0.5 });
    expect(pidNode.evaluate(makeCtx(makeWorld()), { measured: 0, target: 0, enable: true }, p, s)).toMatchObject({ error: 0 });
  });

  it('shows the P, I, D outputs only when switched on', () => {
    expect(activeOutputs(pidNode, params()).map((o) => o.id)).toEqual(['out', 'error', 'saturated']);
    expect(activeOutputs(pidNode, params({ showParts: 'yes' })).map((o) => o.id)).toEqual(['out', 'error', 'saturated', 'p', 'i', 'd']);
  });

  it('reset pulse clears the integral', () => {
    const s = state();
    const p = params({ kp: 0, ki: 1, outMin: -100, outMax: 100 });
    const run = (reset: boolean) => pidNode.evaluate(makeCtx(makeWorld()), { measured: 0, target: 1, enable: true, reset }, p, s);
    for (let k = 0; k < 60; k++) run(false);
    expect(run(false).i as number).toBeGreaterThan(1);
    expect(run(true).i as number).toBeCloseTo(TICK_DT, 9);
  });

  it('through the runtime: an empty "Bật" means on and an empty "Giá trị đặt" means the setting', () => {
    registerAllNodes();
    const graph: Graph = { nodes: [{ id: 'pid', kind: 'pid', params: { kp: 1, target: 0.5 }, pos: { x: 0, y: 0 } }], wires: [] };
    const world = createWorld('2d-side');
    const rt = createRuntime(graph, world, '2d-side');
    rt.tick({ keysDown: new Set() });
    expect(rt.getOutput('pid', 'out')).toBe(0.5);
    expect(rt.getOutput('pid', 'error')).toBe(0.5);
  });
});
