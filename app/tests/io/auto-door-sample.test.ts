import { beforeAll, describe, expect, it } from 'vitest';
import { listSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { AUTO_DOOR, AUTO_DOOR_WIRES } from '../../src/samples/auto-door-board';
import type { Board } from '../../src/engine/types';
import { firstCardOverlap, without } from '../helpers/cell-run';
import { loadEngine, playReal as play } from '../helpers/cell-run-real';

beforeAll(async () => {
  registerAllNodes();
  await loadEngine();
});

const sample = (): Board => structuredClone(listSamples().find((s) => s.id === 'auto-door')!.board);

const KEYS_OR_BUTTONS = new Set(['key', 'stick', 'ui-button', 'ui-start', 'ui-pick', 'ui-dialog']);

/** Plays a board and reports the walker's z (the bar stands at z = 0) and the servo angle each tick. */
function walk(board: Board, seconds: number) {
  const p = play(board);
  const walker = p.entity('walker');
  const s = { maxZ: -Infinity, minZ: Infinity, maxAngle: 0, minAngleAfterOpen: 90, crossings: 0, stuckTicks: 0, overloaded: false };
  let opened = false;
  let prevZ = p.world.getEntity(walker.id)!.position.z;
  let still = 0;
  p.watch(seconds, () => {
    const z = p.world.getEntity(walker.id)!.position.z;
    const angle = p.out('servo', 'angleNow') as number;
    s.maxZ = Math.max(s.maxZ, z);
    s.minZ = Math.min(s.minZ, z);
    s.maxAngle = Math.max(s.maxAngle, angle);
    if (p.out('servo', 'overloaded') === true) s.overloaded = true;
    if (angle > 80) opened = true;
    if (opened) s.minAngleAfterOpen = Math.min(s.minAngleAfterOpen, angle);
    if (prevZ * z < 0) s.crossings++;
    // Standing still close to the bar (a patrol end is 5.5 m away) = held up by it.
    still = Math.abs(z - prevZ) < 1e-4 && Math.abs(z) < 2 ? still + 1 : 0;
    s.stuckTicks = Math.max(s.stuckTicks, still);
    prevZ = z;
  });
  return s;
}

describe('sample Cửa tự động', () => {
  it('is an automated 3D machine of palette pieces: no keys or buttons, a floor, a camera, readouts, notes', () => {
    const b = sample();
    expect(b.mode).toBe('3d');
    for (const n of b.graph.nodes) expect(KEYS_OR_BUTTONS.has(n.kind), n.kind).toBe(false);
    const kinds = new Set(b.graph.nodes.map((n) => n.kind));
    for (const k of ['camera', 'zone', 'timer', 'joint', 'link', 'latch', 'patrol', 'bool-to-number', 'show-number', 'show-text']) expect(kinds.has(k), k).toBe(true);
    expect(b.graph.nodes.find((n) => n.id === 'floor')?.kind).toBe('block');
    // The bar is a real obstacle, and the on-off memory becomes a number without a counter workaround.
    expect(b.graph.nodes.find((n) => n.id === 'bar')!.params.solid).toBe('yes');
    expect(b.graph.nodes.some((n) => n.kind === 'map-range')).toBe(false);
    expect(b.graph.nodes.filter((n) => n.kind === 'counter').map((n) => n.id)).toEqual(['passes']);
    // One text card with lines shows the door state, not one card per state.
    expect(b.graph.nodes.find((n) => n.id === 'status')!.params.lines).toContain('MỞ');
    expect((b.notes ?? []).length).toBeGreaterThanOrEqual(3);
    expect(firstCardOverlap(b)).toBeNull();
    expect(listSamples().find((s) => s.id === 'auto-door')!.label).not.toMatch(/game/i);
  });

  it('opens before the walker reaches the bar, really holds it up while closed, and closes again after it has left', () => {
    const p = play(sample());
    const walker = p.entity('walker');
    let maxAngle = 0;
    let minAngleAfterOpen = 90;
    let opened = false;
    let atBar = 0;
    let blockedAtBar = 0;
    let lastInside = 0;
    let lateWhileClear = 0;
    let crossings = 0;
    let prevZ = p.world.getEntity(walker.id)!.position.z;
    p.watch(80, (t) => {
      const angle = p.out('servo', 'angleNow') as number;
      const inside = p.out('sensor', 'inside') === true;
      const z = p.world.getEntity(walker.id)!.position.z;
      if (inside) lastInside = t;
      maxAngle = Math.max(maxAngle, angle);
      if (angle > 80) opened = true;
      if (opened) minAngleAfterOpen = Math.min(minAngleAfterOpen, angle);
      if (prevZ * z < 0) crossings++;
      prevZ = z;
      // The walker is at the bar (z about 0): the bar must be up by then, else it would be stopped.
      if (Math.abs(z) < 0.9) {
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
    // Every pass of the walker opened the door again, and the walker did pass the bar each time.
    expect(p.out('passes', 'value') as number).toBeGreaterThanOrEqual(3);
    expect(crossings).toBeGreaterThanOrEqual(5);
  });

  it('runs on "Vật lý thật" for two minutes: the bar rises and falls for every arrival and never traps or launches the walker', { timeout: 120_000 }, () => {
    const b = sample();
    expect(b.graph.settings?.realPhysics).toBe(true);
    expect(b.graph.settings?.gravity).toBeUndefined();
    const p = play(b);
    const walker = p.entity('walker');
    let prev = p.world.getEntity(walker.id)!.position;
    let maxStep = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    let rises = 0;
    let falls = 0;
    let up = false;
    let peakLoad = 0;
    let overloaded = false;
    p.watch(120, (t) => {
      const pos = p.world.getEntity(walker.id)!.position;
      // The walker is made 0.5 m above its standing height and settles in the first second.
      if (t < 1.5) {
        prev = pos;
        return;
      }
      maxStep = Math.max(maxStep, Math.hypot(pos.x - prev.x, pos.y - prev.y, pos.z - prev.z));
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
      prev = pos;
      const angle = p.out('servo', 'angleNow') as number;
      if (!up && angle > 80) {
        up = true;
        rises++;
      }
      if (up && angle < 1) {
        up = false;
        falls++;
      }
      peakLoad = Math.max(peakLoad, p.out('servo', 'load') as number);
      if (p.out('servo', 'overloaded') === true) overloaded = true;
    });
    // 120 s = about 5 patrol legs each way: the bar goes up and down for each one, and every rise has its fall.
    expect(rises).toBeGreaterThanOrEqual(5);
    expect(falls).toBeGreaterThanOrEqual(rises - 1);
    expect(p.out('passes', 'value') as number).toBeGreaterThanOrEqual(rises);
    // Walks at 3 m/s = 0.05 m a tick: no tick moves it much further, and it stays on the ground (never thrown up by the swinging bar).
    expect(maxStep).toBeLessThan(0.08);
    expect(minY).toBeGreaterThan(0.45);
    expect(maxY).toBeLessThan(0.65);
    expect(overloaded).toBe(false);
    // Holding the 4 kg, 3.6 m bar level takes m g L / 2 = 70.6 N m: the servo's 120 N m has room.
    expect(peakLoad).toBeCloseTo(AUTO_DOOR.barMassKg * 9.81 * (AUTO_DOOR.barLengthM / 2), 1);
    expect(peakLoad).toBeLessThan(AUTO_DOOR.servoTorque);
  });

  it('never holds the walker up at the bar (it is never standing still next to it)', () => {
    const r = walk(sample(), 60);
    expect(r.stuckTicks).toBeLessThan(5);
    expect(r.minZ).toBeLessThan(-AUTO_DOOR.patrolZ + 0.5);
    expect(r.maxZ).toBeGreaterThan(AUTO_DOOR.patrolZ - 0.5);
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

  it('a bar that is closed physically stops the walker: with the door never opened it stays on the near side', () => {
    const r = walk(without(sample(), ['sensor', 'entered', 'door-open', 'set']), 40);
    expect(r.maxAngle).toBeLessThan(5);
    expect(r.maxZ).toBeLessThan(0);
    expect(r.crossings).toBe(0);
    expect(r.stuckTicks).toBeGreaterThan(60 * 10);
  });

  it('with "Chắn vật" off the same closed bar is only a picture: the walker walks through it', () => {
    const b = without(sample(), ['sensor', 'entered', 'door-open', 'set']);
    b.graph.nodes.find((n) => n.id === 'bar')!.params.solid = 'no';
    const r = walk(b, 40);
    expect(r.maxAngle).toBeLessThan(5);
    expect(r.crossings).toBeGreaterThanOrEqual(2);
    expect(r.maxZ).toBeGreaterThan(AUTO_DOOR.patrolZ - 0.5);
  });

  it('is anti-forced: without the sensor, the servo power, or any link of the angle chain it never opens and the walker is held up', () => {
    const essential: [string, string, string, string][] = [
      ['sensor', 'entered', 'door-open', 'set'],
      ['door-open', 'on', 'to-angle', 'on'],
      ['to-angle', 'value', 'servo', 'angle'],
      ['go', 'started', 'servo', 'power'],
      ['post', 'self', 'servo', 'base'],
    ];
    for (const link of essential) {
      expect(AUTO_DOOR_WIRES.some((w) => w.join('.') === link.join('.')), link.join('.')).toBe(true);
      const r = walk(without(sample(), link), 40);
      expect(r.maxAngle, link.join('.')).toBeLessThan(5);
    }
    // The bar is a barrier only while the servo carries it: with the sensor, the angle or the power cut it stays down.
    for (const link of essential.filter((l) => l[0] !== 'post')) {
      expect(walk(without(sample(), link), 40).crossings, link.join('.')).toBe(0);
    }
    // Without the link servo -> bar there is no bar at all (nothing to open, nothing to stop the walker).
    const noBar = walk(without(sample(), ['servo', 'tip', 'bar', 'base']), 40);
    expect(noBar.crossings).toBeGreaterThanOrEqual(3);
  });

  it('wires that only report (readouts, door text, camera) are not essential: the door works without them', () => {
    for (const link of [
      ['door-open', 'on', 'to-state', 'on'],
      ['to-state', 'value', 'status', 'line'],
      ['servo', 'angleNow', 'show-angle', 'value'],
      ['servo', 'load', 'show-load', 'value'],
      ['go', 'started', 'cam', 'on'],
    ] as const) {
      const r = walk(without(sample(), link), 40);
      expect(r.maxAngle, link.join('.')).toBeGreaterThan(AUTO_DOOR.openAngle - 1);
      expect(r.crossings, link.join('.')).toBeGreaterThanOrEqual(3);
    }
  });

  it('one text card shows the door state: closed at the start, open while the walker passes', () => {
    const p = play(sample());
    const seen = new Set<string>();
    p.watch(30, () => {
      for (const h of p.world.hudItems() as readonly { text?: string; hidden?: boolean }[]) if (h.text && !h.hidden && h.text.startsWith('CỬA')) seen.add(h.text);
    });
    expect([...seen].sort()).toEqual(['CỬA ĐANG MỞ', 'CỬA ĐANG ĐÓNG']);
  });

  it('a weak servo cannot lift the bar: overloaded, stays down, the walker is held up', () => {
    const b = sample();
    b.graph.nodes.find((n) => n.id === 'servo')!.params.maxTorque = 50;
    const r = walk(b, 40);
    expect(r.overloaded).toBe(true);
    expect(r.maxAngle).toBeLessThan(5);
    expect(r.crossings).toBe(0);
  });
});
