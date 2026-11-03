import { describe, expect, it } from 'vitest';
import type { InputSnapshot, NodeDef, Params, PortValues, UiInput } from '../../src/engine/types';
import { uiButtonNode } from '../../src/nodes/ui-button';
import { dialogAnswers, uiDialogNode } from '../../src/nodes/ui-dialog';
import { meterFraction, uiMeterNode } from '../../src/nodes/ui-meter';
import { uiPickNode } from '../../src/nodes/ui-pick';
import { uiStartNode } from '../../src/nodes/ui-start';
import { defaultParams, makeCtx, makeWorld, type FakeWorld } from './fake-world';

const NODE_ID = 'n1';

function ui(over: { clicked?: string[]; held?: string[]; picked?: string[] } = {}): UiInput {
  return { clicked: new Set(over.clicked ?? []), held: new Set(over.held ?? []), picked: new Set(over.picked ?? []) };
}

/** One evaluate call with simulated pointer input (omit `input` for "no UI input at all"). */
function run<S>(def: NodeDef<S>, state: S, w: FakeWorld, inputs: PortValues, params: Params, input?: UiInput): PortValues {
  const ctx = makeCtx(w, { nodeId: NODE_ID });
  const snapshot: InputSnapshot = input ? { keysDown: new Set(), ui: input } : { keysDown: new Set() };
  return def.evaluate({ ...ctx, input: snapshot }, inputs, params, state);
}

const lastHud = (w: FakeWorld) => w.huds[w.huds.length - 1]!;

describe('ui-button', () => {
  const params = defaultParams(uiButtonNode, { text: 'Chơi lại', corner: 'top-right' });

  it('draws a visible button widget in its corner', () => {
    const w = makeWorld();
    run(uiButtonNode, null, w, { show: true }, params);
    expect(lastHud(w)).toMatchObject({
      key: NODE_ID,
      corner: 'top-right',
      hidden: false,
      widget: { type: 'button', text: 'Chơi lại' },
    });
  });

  it('pulses "Vừa bấm" for the tick of the click and reports "Đang giữ chuột" while held', () => {
    const w = makeWorld();
    expect(run(uiButtonNode, null, w, { show: true }, params, ui({ clicked: [NODE_ID], held: [NODE_ID] }))).toEqual({ pressed: true, held: true });
    expect(run(uiButtonNode, null, w, { show: true }, params, ui({ held: [NODE_ID] }))).toEqual({ pressed: false, held: true });
    expect(run(uiButtonNode, null, w, { show: true }, params, ui())).toEqual({ pressed: false, held: false });
  });

  it('ignores other widgets and works without any UI input', () => {
    const w = makeWorld();
    expect(run(uiButtonNode, null, w, { show: true }, params, ui({ clicked: ['other'] }))).toEqual({ pressed: false, held: false });
    expect(run(uiButtonNode, null, w, {}, params)).toEqual({ pressed: false, held: false });
  });

  it('is hidden and cannot be pressed while "Hiện" is off', () => {
    const w = makeWorld();
    const out = run(uiButtonNode, null, w, { show: false }, params, ui({ clicked: [NODE_ID], held: [NODE_ID] }));
    expect(out).toEqual({ pressed: false, held: false });
    expect(lastHud(w).hidden).toBe(true);
  });

  it('falls back to a known corner and caps very long text', () => {
    const w = makeWorld();
    run(uiButtonNode, null, w, {}, defaultParams(uiButtonNode, { corner: 'middle', text: 'x'.repeat(300) }));
    const hud = lastHud(w);
    expect(hud.corner).toBe('bottom-right');
    expect(hud.widget?.type === 'button' && hud.widget.text.length).toBe(80);
  });
});

describe('ui-pick', () => {
  const params = defaultParams(uiPickNode);

  it('pulses only when the wired entity was clicked', () => {
    const w = makeWorld();
    const chest = w.spawn({ kind: 'block', ownerNodeId: 'b', position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#fff', solid: false });
    expect(run(uiPickNode, null, w, { target: chest }, params, ui({ picked: [chest] }))).toEqual({ pressed: true });
    expect(run(uiPickNode, null, w, { target: chest }, params, ui({ picked: ['elsewhere'] }))).toEqual({ pressed: false });
    expect(run(uiPickNode, null, w, { target: chest }, params, ui())).toEqual({ pressed: false });
    expect(run(uiPickNode, null, w, { target: chest }, params)).toEqual({ pressed: false });
  });

  it('does nothing without a wired target and ignores a hidden entity', () => {
    const w = makeWorld();
    const chest = w.spawn({ kind: 'block', ownerNodeId: 'b', position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#fff', solid: false });
    expect(run(uiPickNode, null, w, { target: null }, params, ui({ picked: [chest] }))).toEqual({ pressed: false });
    w.entities.set(chest, { ...w.entities.get(chest)!, visible: false });
    expect(run(uiPickNode, null, w, { target: chest }, params, ui({ picked: [chest] }))).toEqual({ pressed: false });
  });
});

describe('ui-meter', () => {
  it('maps the value between min and max and clamps outside it', () => {
    expect(meterFraction(5, 0, 10)).toBe(0.5);
    expect(meterFraction(-3, 0, 10)).toBe(0);
    expect(meterFraction(99, 0, 10)).toBe(1);
    expect(meterFraction(15, 10, 20)).toBe(0.5);
    expect(meterFraction(3, 5, 5)).toBe(0);
    expect(meterFraction(5, 5, 5)).toBe(1);
  });

  it('draws a corner bar with its label, value and colour', () => {
    const w = makeWorld();
    const params = defaultParams(uiMeterNode, { label: 'Giờ', max: 10, color: '#00ff00', corner: 'bottom-left' });
    run(uiMeterNode, null, w, { value: 2.5, show: true }, params);
    expect(lastHud(w)).toEqual({
      key: NODE_ID,
      label: 'Giờ',
      value: 2.5,
      corner: 'bottom-left',
      color: '#00ff00',
      hidden: false,
      widget: { type: 'bar', fraction: 0.25 },
    });
  });

  it('follows an entity when wired and can be switched off', () => {
    const w = makeWorld();
    const params = defaultParams(uiMeterNode);
    run(uiMeterNode, null, w, { value: 100, anchor: 'e7', show: false }, params);
    expect(lastHud(w)).toMatchObject({ anchor: 'e7', hidden: true, widget: { type: 'bar', fraction: 1 } });
    run(uiMeterNode, null, w, { value: 1 }, params);
    expect('anchor' in lastHud(w)).toBe(false);
  });
});

describe('ui-dialog', () => {
  const params = defaultParams(uiDialogNode, { question: 'Mở rương?', answer1: 'Mở', answer2: 'Thôi', answer3: 'Hỏi lại' });
  const fresh = () => uiDialogNode.create!(makeCtx(makeWorld()), params);

  it('opens on a rising edge of "Hỏi" and lists the answers', () => {
    const w = makeWorld();
    const s = fresh();
    expect(run(uiDialogNode, s, w, { ask: false }, params)).toMatchObject({ asking: false });
    expect(lastHud(w).hidden).toBe(true);
    expect(run(uiDialogNode, s, w, { ask: true }, params)).toMatchObject({ asking: true });
    expect(lastHud(w)).toMatchObject({ hidden: false, widget: { type: 'dialog', question: 'Mở rương?', answers: ['Mở', 'Thôi', 'Hỏi lại'] } });
  });

  it('pulses one answer, then closes and stays closed while "Hỏi" is held', () => {
    const w = makeWorld();
    const s = fresh();
    run(uiDialogNode, s, w, { ask: true }, params);
    const out = run(uiDialogNode, s, w, { ask: true }, params, ui({ clicked: [`${NODE_ID}#1`] }));
    expect(out).toEqual({ a1: false, a2: true, a3: false, asking: false });
    expect(lastHud(w).hidden).toBe(true);
    expect(run(uiDialogNode, s, w, { ask: true }, params)).toMatchObject({ asking: false });
    run(uiDialogNode, s, w, { ask: false }, params);
    expect(run(uiDialogNode, s, w, { ask: true }, params)).toMatchObject({ asking: true });
  });

  it('ignores answer clicks while closed and the third answer when its text is empty', () => {
    const w = makeWorld();
    const s = fresh();
    expect(run(uiDialogNode, s, w, { ask: false }, params, ui({ clicked: [`${NODE_ID}#0`] }))).toMatchObject({ a1: false });
    expect(dialogAnswers(defaultParams(uiDialogNode))).toEqual(['Có', 'Không']);
    expect(dialogAnswers(defaultParams(uiDialogNode, { answer1: '  ', answer3: 'Có thể' }))).toEqual(['Có', 'Không', 'Có thể']);
  });
});

describe('ui-start', () => {
  const params = defaultParams(uiStartNode, { title: 'Rương bí mật', buttonText: 'Vào chơi' });

  it('stays "not started" and visible until its button is clicked, then stays started', () => {
    const w = makeWorld();
    const s = uiStartNode.create!(makeCtx(w), params);
    expect(run(uiStartNode, s, w, {}, params)).toEqual({ started: false });
    expect(lastHud(w)).toMatchObject({ hidden: false, widget: { type: 'start', title: 'Rương bí mật', buttonText: 'Vào chơi', pauseMenu: true } });
    expect(run(uiStartNode, s, w, {}, params, ui({ clicked: ['other'] }))).toEqual({ started: false });
    expect(run(uiStartNode, s, w, {}, params, ui({ clicked: [NODE_ID] }))).toEqual({ started: true });
    expect(lastHud(w).hidden).toBe(true);
    expect(run(uiStartNode, s, w, {}, params, ui())).toEqual({ started: true });
  });

  it('reports whether the pause menu is wanted', () => {
    const w = makeWorld();
    const off = defaultParams(uiStartNode, { pauseMenu: 'no' });
    run(uiStartNode, { started: false }, w, {}, off);
    expect(lastHud(w).widget).toMatchObject({ pauseMenu: false });
  });
});
