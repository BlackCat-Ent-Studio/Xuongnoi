import { describe, expect, it } from 'vitest';
import { MAX_SPARKS, PULSE_HOLD_MS, canSpawnSpark, isActive, newWireMemory, sparkFrame, stepWire } from '../../src/editor/graph/wire-energy';

describe('isActive', () => {
  it('reads each wire type', () => {
    expect(isActive('bool', true)).toBe(true);
    expect(isActive('bool', false)).toBe(false);
    expect(isActive('number', 0)).toBe(false);
    expect(isActive('number', -0.5)).toBe(true);
    expect(isActive('object', 'e1')).toBe(true);
    expect(isActive('object', null)).toBe(false);
  });
});

describe('stepWire bool', () => {
  it('lights while true and dims while false', () => {
    const m = newWireMemory();
    expect(stepWire(m, 'bool', false, false, 0).lit).toBe(false);
    expect(stepWire(m, 'bool', true, false, 16).lit).toBe(true);
    expect(stepWire(m, 'bool', true, false, 32).lit).toBe(true);
  });

  it('fires one spark on a false -> true edge only', () => {
    const m = newWireMemory();
    stepWire(m, 'bool', false, false, 0);
    expect(stepWire(m, 'bool', true, false, 16).spark).not.toBeNull();
    expect(stepWire(m, 'bool', true, false, 32).spark).toBeNull();
    expect(stepWire(m, 'bool', false, false, 48).spark).toBeNull();
  });

  it('does not spark for a wire that is already true on the first frame', () => {
    expect(stepWire(newWireMemory(), 'bool', true, false, 0).spark).toBeNull();
  });

  it('sparks and stays lit for a pulse the engine saw but the frame did not', () => {
    const m = newWireMemory();
    stepWire(m, 'bool', false, false, 0);
    const s = stepWire(m, 'bool', false, true, 16);
    expect(s.spark).not.toBeNull();
    expect(s.lit).toBe(true);
    expect(stepWire(m, 'bool', false, false, 16 + PULSE_HOLD_MS - 1).lit).toBe(true);
    expect(stepWire(m, 'bool', false, false, 16 + PULSE_HOLD_MS + 1).lit).toBe(false);
  });
});

describe('stepWire number', () => {
  it('is lit when non-zero and sparks on change', () => {
    const m = newWireMemory();
    expect(stepWire(m, 'number', 0, false, 0).lit).toBe(false);
    const s = stepWire(m, 'number', 0.5, false, 16);
    expect(s.lit).toBe(true);
    expect(s.spark).not.toBeNull();
  });

  it('ignores tiny jitter', () => {
    const m = newWireMemory();
    stepWire(m, 'number', 1, false, 0);
    expect(stepWire(m, 'number', 1.01, false, 500).spark).toBeNull();
  });

  it('rate-limits sparks per wire', () => {
    const m = newWireMemory();
    stepWire(m, 'number', 0, false, 0);
    expect(stepWire(m, 'number', 1, false, 1000).spark).not.toBeNull();
    expect(stepWire(m, 'number', 2, false, 1016).spark).toBeNull();
    expect(stepWire(m, 'number', 3, false, 1200).spark).not.toBeNull();
  });
});

describe('stepWire object', () => {
  it('glows with an object, dims without, never sparks', () => {
    const m = newWireMemory();
    expect(stepWire(m, 'object', 'e1', false, 0)).toEqual({ lit: true, spark: null });
    expect(stepWire(m, 'object', null, false, 16)).toEqual({ lit: false, spark: null });
  });
});

describe('spark budget and travel', () => {
  it('caps simultaneous sparks', () => {
    expect(canSpawnSpark(MAX_SPARKS - 1)).toBe(true);
    expect(canSpawnSpark(MAX_SPARKS)).toBe(false);
    expect(canSpawnSpark(2, 2)).toBe(false);
  });

  it('travels from the output end to the input end and fades out at the end', () => {
    expect(sparkFrame(0, 500)).toEqual({ t: 0, opacity: 1, done: false });
    const mid = sparkFrame(250, 500);
    expect(mid.t).toBeCloseTo(0.5);
    expect(mid.opacity).toBe(1);
    expect(sparkFrame(475, 500).opacity).toBeLessThan(1);
    expect(sparkFrame(500, 500).done).toBe(true);
    expect(sparkFrame(900, 500).t).toBe(1);
  });
});
