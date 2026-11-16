import { beforeAll, describe, expect, it } from 'vitest';
import { listSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { AUTO_DOOR, AUTO_DOOR_WIRES } from '../../src/samples/auto-door-board';
import type { Board } from '../../src/engine/types';
import { firstCardOverlap, play, without } from '../helpers/cell-run';

beforeAll(() => registerAllNodes());

const sample = (): Board => structuredClone(listSamples().find((s) => s.id === 'auto-door')!.board);

const KEYS_OR_BUTTONS = new Set(['key', 'stick', 'ui-button', 'ui-start', 'ui-pick', 'ui-dialog']);

describe('sample Cửa tự động', () => {
  it('is an automated 3D machine of palette pieces: no keys or buttons, a floor, a camera, readouts, notes', () => {
    const b = sample();
    expect(b.mode).toBe('3d');
    for (const n of b.graph.nodes) expect(KEYS_OR_BUTTONS.has(n.kind), n.kind).toBe(false);
    const kinds = new Set(b.graph.nodes.map((n) => n.kind));
    for (const k of ['camera', 'zone', 'timer', 'joint', 'link', 'latch', 'patrol', 'show-number', 'show-text']) expect(kinds.has(k), k).toBe(true);
    expect(b.graph.nodes.find((n) => n.id === 'floor')?.kind).toBe('block');
    expect((b.notes ?? []).length).toBeGreaterThanOrEqual(3);
    expect(firstCardOverlap(b)).toBeNull();
    expect(listSamples().find((s) => s.id === 'auto-door')!.label).not.toMatch(/game/i);
  });

  it('opens while the walker is near, never blocks it, and closes after the zone has been clear for the delay', () => {
    const p = play(sample());
    const walker = p.entity('walker');
    let maxAngle = 0;
    let minAngleAfterOpen = 90;
    let opened = false;
    let atBar = 0;
    let blockedAtBar = 0;
    let lastInside = 0;
    let lateWhileClear = 0;
    p.watch(80, (t) => {
      const angle = p.out('servo', 'angleNow') as number;
      const inside = p.out('sensor', 'inside') === true;
      const z = p.world.getEntity(walker.id)!.position.z;
      if (inside) lastInside = t;
      maxAngle = Math.max(maxAngle, angle);
      if (angle > 80) opened = true;
      if (opened) minAngleAfterOpen = Math.min(minAngleAfterOpen, angle);
      // The walker passes the bar (z about 0): the bar must be up by then.
      if (Math.abs(z) < 0.6) {
        atBar++;
        if (angle < 80) blockedAtBar++;
      }
      // Clear for longer than the delay plus the time the servo needs to fall: closed.
      if (!inside && t - lastInside > AUTO_DOOR.closeDelayS + 1.5 && t > 5 && angle > 2) lateWhileClear++;
    });
    expect(maxAngle).toBeGreaterThan(AUTO_DOOR.openAngle - 1);
    expect(minAngleAfterOpen).toBeLessThan(1);
    expect(atBar).toBeGreaterThan(30);
    expect(blockedAtBar).toBe(0);
    expect(lateWhileClear).toBe(0);
    // Every pass of the walker opened the door again.
    expect(p.out('passes', 'value') as number).toBeGreaterThanOrEqual(3);
  });

  it('stays open for the delay after the walker leaves (2 s), not longer', () => {
    const p = play(sample());
    let leftAt = -1;
    let openAfter = 0;
    let closedAt = -1;
    p.watch(30, (t) => {
      const inside = p.out('sensor', 'inside') === true;
      const angle = p.out('servo', 'angleNow') as number;
      const entered = p.out('passes', 'value') as number;
      if (entered >= 1 && !inside && leftAt < 0) leftAt = t;
      if (leftAt >= 0 && closedAt < 0) {
        if (angle > 80) openAfter = t - leftAt;
        if (angle < 1) closedAt = t;
      }
    });
    expect(openAfter).toBeGreaterThan(AUTO_DOOR.closeDelayS - 0.2);
    expect(openAfter).toBeLessThan(AUTO_DOOR.closeDelayS + 0.3);
    expect(closedAt).toBeGreaterThan(0);
  });

  it('is anti-forced: without the sensor, the servo power, or any link of the angle chain it never opens', () => {
    const essential: [string, string, string, string][] = [
      ['sensor', 'entered', 'door-open', 'set'],
      ['door-open', 'on', 'bit', 'up'],
      ['bit', 'value', 'to-angle', 'value'],
      ['to-angle', 'value', 'servo', 'angle'],
      ['go', 'started', 'servo', 'power'],
      ['post', 'self', 'servo', 'base'],
    ];
    for (const link of essential) {
      expect(AUTO_DOOR_WIRES.some((w) => w.join('.') === link.join('.')), link.join('.')).toBe(true);
      const p = play(without(sample(), link));
      let maxAngle = 0;
      p.watch(40, () => {
        maxAngle = Math.max(maxAngle, p.out('servo', 'angleNow') as number);
      });
      expect(maxAngle, link.join('.')).toBeLessThan(5);
    }
  });

  it('a weak servo cannot lift the bar: overloaded, stays down', () => {
    const b = sample();
    b.graph.nodes.find((n) => n.id === 'servo')!.params.maxTorque = 50;
    const p = play(b);
    let maxAngle = 0;
    let overloaded = false;
    p.watch(40, () => {
      maxAngle = Math.max(maxAngle, p.out('servo', 'angleNow') as number);
      if (p.out('servo', 'overloaded') === true) overloaded = true;
    });
    expect(overloaded).toBe(true);
    expect(maxAngle).toBeLessThan(5);
  });
});
