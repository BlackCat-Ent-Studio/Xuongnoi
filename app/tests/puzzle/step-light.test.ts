import { describe, expect, it } from 'vitest';
import { frameLit, stepLight, type StepWire } from '../../src/puzzle/ui/step-light';

const objects = new Set(['cat', 'star']);
const isObject = (id: string): boolean => objects.has(id);
const wires: StepWire[] = [
  { id: 'w-cat', from: 'cat', fromPort: 'who', to: 'hit' },
  { id: 'w-star', from: 'star', fromPort: 'who', to: 'hit' },
  { id: 'w-hide', from: 'hit', fromPort: 'touching', to: 'star' },
  { id: 'w-other', from: 'hit', fromPort: 'enter', to: 'latch' },
  { id: 'w-far', from: 'latch', fromPort: 'on', to: 'door' },
  { id: 'w-move', from: 'route', fromPort: 'sideways', to: 'cat' },
];

describe('stepLight', () => {
  it('lights the fired card, its fired wire and target, and the objects wired into it', () => {
    const l = stepLight(new Set(['hit|touching']), wires, isObject);
    expect([...l.cards].sort()).toEqual(['cat', 'hit', 'star']);
    expect([...l.wires].sort()).toEqual(['w-cat', 'w-hide', 'w-star']);
    expect([...l.objects].sort()).toEqual(['cat', 'star']);
    expect(l.pins.has('hit|touching')).toBe(true);
  });

  it('does not light a wire from a pin that did not fire to a non-object card', () => {
    const l = stepLight(new Set(['hit|touching']), wires, isObject);
    expect(l.wires.has('w-other')).toBe(false);
    expect(l.cards.has('latch')).toBe(false);
  });

  it('lights an action wire from a fired card to a character even when that pin did not fire', () => {
    const l = stepLight(new Set(['route|arrived']), wires, isObject);
    expect(l.wires.has('w-move')).toBe(true);
    expect(l.objects.has('cat')).toBe(true);
    expect([...l.cards].sort()).toEqual(['cat', 'route']);
  });

  it('a fired object card glows on the stage too', () => {
    const l = stepLight(new Set(['cat|hidden']), [], isObject);
    expect([...l.objects]).toEqual(['cat']);
  });

  it('a lit non-character card also lights the characters wired into or out of it', () => {
    const l = stepLight(new Set(['hit|enter']), wires, isObject);
    // latch is lit as the target; no character touches it, but hit (fired) has cat and star wired in.
    expect([...l.objects].sort()).toEqual(['cat', 'star']);
    const driven: StepWire[] = [
      { id: 'a', from: 'cmp', fromPort: 'ok', to: 'route' },
      { id: 'b', from: 'cat', fromPort: 'self', to: 'route' },
      { id: 'c', from: 'route', fromPort: 'sideways', to: 'cat' },
    ];
    const t = stepLight(new Set(['cmp|ok']), driven, isObject);
    expect([...t.cards].sort()).toEqual(['cat', 'cmp', 'route']);
    expect([...t.objects]).toEqual(['cat']);
    expect([...t.wires].sort()).toEqual(['a', 'b', 'c']);
  });

  it('why also lights the cards feeding the fired card, only when asked', () => {
    const chain: StepWire[] = [{ id: 'x', from: 'fore', fromPort: 'left', to: 'cmp' }];
    expect(stepLight(new Set(['cmp|ok']), chain, isObject).cards.has('fore')).toBe(false);
    const l = stepLight(new Set(['cmp|ok']), chain, isObject, true);
    expect([...l.cards].sort()).toEqual(['cmp', 'fore']);
    expect(l.wires.has('x')).toBe(true);
  });
});

describe('frameLit', () => {
  const area = { w: 1000, h: 500 };
  it('leaves a view that already shows the lit cards', () => {
    const v = { k: 1, x: 5, y: 7 };
    expect(frameLit(v, { x: 100, y: 100, w: 300, h: 200 }, area, 20, 0.25)).toBe(v);
  });
  it('pans the least when the cards fit but sit off screen', () => {
    const r = frameLit({ k: 1, x: 0, y: 0 }, { x: 100, y: -300, w: 300, h: 200 }, area, 20, 0.25);
    expect(r.k).toBe(1);
    expect(r.y).toBe(320);
    expect(r.x).toBe(0);
  });
  it('zooms out (not below the floor) when the cards do not fit', () => {
    const r = frameLit({ k: 1, x: 0, y: 0 }, { x: 0, y: 0, w: 2000, h: 200 }, area, 20, 0.25);
    expect(r.k).toBeCloseTo(960 / 2000, 5);
    const floor = frameLit({ k: 1, x: 0, y: 0 }, { x: 0, y: 0, w: 8000, h: 200 }, area, 20, 0.25);
    expect(floor.k).toBe(0.25);
  });
});
