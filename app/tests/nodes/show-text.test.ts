import { describe, expect, it } from 'vitest';
import { showTextNode, SHOW_TEXT_MAX_LENGTH } from '../../src/nodes/show-text';
import { defaultParams, makeCtx, makeWorld } from './fake-world';

describe('show-text node', () => {
  it('shows its text in the chosen corner while "Hiện" is on', () => {
    const w = makeWorld();
    const params = defaultParams(showTextNode, { text: 'Chào bạn', corner: 'bottom-left', color: '#ff0000' });
    showTextNode.evaluate(makeCtx(w, { nodeId: 't1' }), { show: true }, params, null);
    expect(w.huds).toEqual([
      { key: 't1', label: '', value: 0, corner: 'bottom-left', text: 'Chào bạn', color: '#ff0000', hidden: false },
    ]);
  });

  it('stays hidden when nothing is wired to "Hiện"', () => {
    const w = makeWorld();
    showTextNode.evaluate(makeCtx(w, { nodeId: 't1' }), {}, defaultParams(showTextNode, {}), null);
    expect(w.huds.map((h) => h.hidden)).toEqual([true]);
  });

  it('is hidden while "Hiện" is off and back when it turns on', () => {
    const w = makeWorld();
    const params = defaultParams(showTextNode, {});
    showTextNode.evaluate(makeCtx(w, { nodeId: 't1' }), { show: false }, params, null);
    showTextNode.evaluate(makeCtx(w, { nodeId: 't1' }), { show: true }, params, null);
    expect(w.huds.map((h) => h.hidden)).toEqual([true, false]);
  });

  it('floats above the wired object and omits the anchor when nothing is wired', () => {
    const w = makeWorld();
    const params = defaultParams(showTextNode, {});
    showTextNode.evaluate(makeCtx(w, { nodeId: 't1' }), { anchor: 'e7' }, params, null);
    showTextNode.evaluate(makeCtx(w, { nodeId: 't1' }), { anchor: null }, params, null);
    expect(w.huds[0]?.anchor).toBe('e7');
    expect('anchor' in (w.huds[1] ?? {})).toBe(false);
  });

  it('falls back to the first corner for a bad corner value and caps very long text', () => {
    const w = makeWorld();
    const params = defaultParams(showTextNode, { corner: 'nowhere', text: 'x'.repeat(500) });
    showTextNode.evaluate(makeCtx(w, { nodeId: 't1' }), {}, params, null);
    expect(w.huds[0]?.corner).toBe('top-left');
    expect(w.huds[0]?.text).toHaveLength(SHOW_TEXT_MAX_LENGTH);
  });

  describe('changing lines', () => {
    const lines = 'Chờ\nChạy\nDừng';
    const text = (line: number | undefined, over: Record<string, string> = {}) => {
      const w = makeWorld();
      const params = defaultParams(showTextNode, { text: 'Cố định', lines, ...over });
      showTextNode.evaluate(makeCtx(w, { nodeId: 't1' }), { show: true, ...(line === undefined ? {} : { line }) }, params, null);
      return w.huds[0]?.text;
    };

    it('shows the 1-based wired line, rounded', () => {
      expect(text(1)).toBe('Chờ');
      expect(text(2.4)).toBe('Chạy');
      expect(text(3)).toBe('Dừng');
    });

    it('shows nothing when the line is out of range', () => {
      expect(text(0)).toBe('');
      expect(text(4)).toBe('');
      expect(text(-2)).toBe('');
      const w = makeWorld();
      showTextNode.evaluate(makeCtx(w, { nodeId: 't1' }), { show: true, line: 9 }, defaultParams(showTextNode, { lines }), null);
      expect(w.huds[0]?.hidden).toBe(true);
    });

    it('falls back to the "Chữ" param when nothing is wired or the lines are empty', () => {
      expect(text(undefined)).toBe('Cố định');
      expect(text(2, { lines: '' })).toBe('Cố định');
      expect(text(2, { lines: '  \n ' })).toBe('Cố định');
    });

    it('splits on CRLF too and only shows the port while lines exist', () => {
      expect(text(2, { lines: 'a\r\nb' })).toBe('b');
      expect(showTextNode.optionalInputs!.active({ lines: '' })).toEqual([]);
      expect(showTextNode.optionalInputs!.active({ lines: 'a' }).map((p) => p.id)).toEqual(['line']);
    });
  });
});
