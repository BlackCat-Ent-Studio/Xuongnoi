import { describe, expect, it } from 'vitest';
import type { EntityView } from '../../src/engine/types';
import { createAccumulator, createSimPacer } from '../../src/render/game-loop';
import { TickBlender } from '../../src/render/tick-blend';

function view(id: string, x: number, over: Partial<EntityView> = {}): EntityView {
  return { id, kind: 'character', ownerNodeId: id, position: { x, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#fff', visible: true, ...over };
}

describe('tick blend', () => {
  it('draws halfway between the last two ticks at alpha 0.5', () => {
    const b = new TickBlender();
    b.capture([view('a', 0)]);
    b.capture([view('a', 1)]);
    expect(b.blend([view('a', 1)], 0.5)[0]!.position.x).toBeCloseTo(0.5, 9);
    expect(b.blend([view('a', 1)], 0)[0]!.position.x).toBeCloseTo(0, 9);
  });

  it('shows the latest tick as it is at alpha 1 and for unknown or hidden entities', () => {
    const b = new TickBlender();
    b.capture([view('a', 0)]);
    b.capture([view('a', 1)]);
    const latest = [view('a', 1), view('new', 5), view('gone', 7, { visible: false })];
    expect(b.blend(latest, 1)).toBe(latest);
    const mid = b.blend(latest, 0.5);
    expect(mid[1]!.position.x).toBe(5);
    expect(mid[2]!.position.x).toBe(7);
  });

  it('does not slide a teleport', () => {
    const b = new TickBlender();
    b.capture([view('a', 0)]);
    b.capture([view('a', 30)]);
    expect(b.blend([view('a', 30)], 0.5)[0]!.position.x).toBe(30);
  });

  it('turns blocks by the short way round', () => {
    const b = new TickBlender();
    b.capture([view('a', 0, { angle: 3.0 })]);
    b.capture([view('a', 0, { angle: -3.0 })]);
    const turned = b.blend([view('a', 0, { angle: -3.0 })], 0.5)[0]!.angle!;
    expect(Math.abs(Math.abs(turned) - Math.PI)).toBeLessThan(0.2);
  });

  it('forgets a finished session', () => {
    const b = new TickBlender();
    b.capture([view('a', 0)]);
    b.capture([view('a', 1)]);
    b.clear();
    expect(b.blend([view('a', 1)], 0.5)[0]!.position.x).toBe(1);
  });
});

describe('pacer alpha', () => {
  it('reports the unspent share of a tick and 1 while paused', () => {
    const pacer = createSimPacer(createAccumulator(1 / 60));
    expect(pacer.stepsFor(1 / 120)).toBe(0);
    expect(pacer.alpha()).toBeCloseTo(0.5, 6);
    expect(pacer.stepsFor(1 / 120)).toBe(1);
    expect(pacer.alpha()).toBeCloseTo(0, 6);
    pacer.stepsFor(1 / 240);
    pacer.pause();
    expect(pacer.alpha()).toBe(1);
  });
});
