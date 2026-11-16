import { describe, expect, it } from 'vitest';
import { createEmptyBoard, listAllSamples, parseBoard, serializeBoard } from '../../src/io';
import { migrations } from '../../src/io/migrations';
import type { Board } from '../../src/engine/types';

function ok(text: string): Board {
  const res = parseBoard(text);
  if (!res.ok) throw new Error(res.error);
  return res.board;
}

function fail(text: string): string {
  const res = parseBoard(text);
  if (res.ok) throw new Error('expected parse failure');
  return res.error;
}

function sampleJson(patch: (o: any) => void): string {
  const o = JSON.parse(serializeBoard(listAllSamples()[0]!.board));
  patch(o);
  return JSON.stringify(o);
}

describe('save format', () => {
  it('roundtrips an empty board for every mode', () => {
    for (const mode of ['2d-side', '2d-top', '3d'] as const) {
      const board = createEmptyBoard(mode);
      expect(board.name).toBe('Game mới');
      expect(ok(serializeBoard(board))).toEqual(board);
    }
  });

  it('roundtrips every sample', () => {
    for (const s of listAllSamples()) {
      expect(ok(serializeBoard(s.board))).toEqual(s.board);
    }
  });

  it('loads a save whose nodes keep the internal kind "block"', () => {
    const board = ok(sampleJson(() => {}));
    const blocks = board.graph.nodes.filter((n) => n.kind === 'block');
    expect(blocks.length).toBeGreaterThan(0);
    expect(ok(serializeBoard(board)).graph.nodes.filter((n) => n.kind === 'block')).toHaveLength(blocks.length);
  });

  it('writes format_version 1', () => {
    expect(JSON.parse(serializeBoard(createEmptyBoard('3d'))).format_version).toBe(1);
  });

  it('fills missing params with defaults', () => {
    const text = JSON.stringify({
      format_version: 1,
      name: 'x',
      mode: '2d-top',
      graph: { nodes: [{ id: 'c', kind: 'counter', params: {}, pos: { x: 1, y: 2 } }], wires: [] },
    });
    expect(ok(text).graph.nodes[0]!.params).toEqual({ start: 0, target: 5 });
  });

  it('rejects invalid JSON', () => {
    expect(fail('{ not json')).toContain('JSON');
  });

  it('rejects non-board JSON', () => {
    expect(fail('[1,2]')).toContain('không phải');
  });

  it('rejects bad mode', () => {
    expect(fail(sampleJson((o) => (o.mode = 'vr')))).toContain('Kiểu game');
  });

  it('rejects unknown node kind', () => {
    const msg = fail(sampleJson((o) => (o.graph.nodes[0].kind = 'teleporter')));
    expect(msg).toContain('teleporter');
  });

  it('rejects wrong param type', () => {
    const msg = fail(sampleJson((o) => (o.graph.nodes.find((n: any) => n.kind === 'counter').params.target = 'many')));
    expect(msg).toContain('target');
  });

  it('rejects a type-mismatched wire', () => {
    const msg = fail(
      sampleJson((o) => {
        // stick.x (number) -> character.jump (bool)
        o.graph.wires.push({
          id: 'bad',
          from: { node: 'stick-1', port: 'x' },
          to: { node: 'character-1', port: 'jump' },
        });
        o.graph.wires = o.graph.wires.filter((w: any) => !(w.to.node === 'character-1' && w.to.port === 'jump' && w.id !== 'bad'));
      }),
    );
    expect(msg).toContain('bad');
    expect(msg).toContain('cùng màu');
  });

  it('rejects two wires into one input', () => {
    const msg = fail(
      sampleJson((o) => {
        o.graph.wires.push({ id: 'dup', from: { node: 'stick-1', port: 'y' }, to: { node: 'character-1', port: 'moveX' } });
      }),
    );
    expect(msg).toContain('đã có dây');
  });

  it('rejects a wire to a missing port or node', () => {
    expect(fail(sampleJson((o) => (o.graph.wires[0].to.port = 'nope')))).toContain('cổng');
    expect(fail(sampleJson((o) => (o.graph.wires[0].to.node = 'ghost')))).toContain('mảnh ghép');
  });

  it('rejects a newer version with a Vietnamese message', () => {
    const msg = fail(sampleJson((o) => (o.format_version = 99)));
    expect(msg).toContain('phiên bản mới hơn');
  });

  it('rejects a missing version', () => {
    expect(fail(sampleJson((o) => delete o.format_version))).toContain('phiên bản');
  });

  it('keeps migrations empty for v1', () => {
    expect(Object.keys(migrations)).toEqual([]);
  });
});
