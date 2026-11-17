import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { getNodeDef, knownInputs, knownOutputs } from '../../src/engine/registry';
import { TICK_DT } from '../../src/engine/types';
import { HANDBOOK_LOGIC_EXTRAS } from '../../src/handbook/content-logic-extras';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { angleDiffNode, angleDifference } from '../../src/nodes/angle-diff';
import { boolToNumberNode } from '../../src/nodes/bool-to-number';
import { mathNode } from '../../src/nodes/math';
import { valueTableNode } from '../../src/nodes/value-table';
import { nodeSearchAliases } from '../../src/nodes/node-names';
import { LESSONS } from '../../src/tutorial/lessons';
import { createWorld } from '../../src/world/world';
import { runNode } from './fake-world';

registerAllNodes();

const sorted = (a: Iterable<string>): string[] => [...a].sort();

describe('bool-to-number', () => {
  const run = (on: boolean | undefined, params = {}) => runNode(boolToNumberNode, [{ inputs: on === undefined ? {} : { on } }], params)[0]?.value;
  it('defaults to 1 when on and 0 when off or unwired', () => {
    expect(run(true)).toBe(1);
    expect(run(false)).toBe(0);
    expect(run(undefined)).toBe(0);
  });
  it('uses the open numbers', () => {
    expect(run(true, { whenOn: 5, whenOff: -2 })).toBe(5);
    expect(run(false, { whenOn: 5, whenOff: -2 })).toBe(-2);
  });
});

describe('value-table', () => {
  const v = { rows: 3, v1: 10, v2: 20, v3: 30, v4: 40, v12: 120 };
  const run = (index: number | undefined, params = {}) =>
    runNode(valueTableNode, [{ inputs: index === undefined ? {} : { index } }], { ...v, ...params })[0]?.value;
  it('reads the row of a 1-based index, rounded', () => {
    expect(run(1)).toBe(10);
    expect(run(2)).toBe(20);
    expect(run(3)).toBe(30);
    expect(run(2.4)).toBe(20);
    expect(run(2.6)).toBe(30);
  });
  it('holds the nearest row outside the table by default', () => {
    expect(run(0)).toBe(10);
    expect(run(-7)).toBe(10);
    expect(run(4)).toBe(30);
    expect(run(99)).toBe(30);
    expect(run(undefined)).toBe(10);
  });
  it('outputs 0 outside the table when asked', () => {
    expect(run(0, { outside: 'zero' })).toBe(0);
    expect(run(4, { outside: 'zero' })).toBe(0);
    expect(run(3, { outside: 'zero' })).toBe(30);
  });
  it('clamps the row count to 2..12 and ignores rows beyond it', () => {
    expect(run(4, { rows: 4 })).toBe(40);
    expect(run(12, { rows: 12 })).toBe(120);
    expect(run(99, { rows: 50 })).toBe(120);
    expect(run(2, { rows: 1 })).toBe(20);
    expect(run(3, { rows: 1, outside: 'zero' })).toBe(0);
  });
  it('has 12 row params named Giá trị 1..12', () => {
    const rows = valueTableNode.params.filter((p) => /^v\d+$/.test(p.id));
    expect(rows.map((p) => p.label)).toEqual(Array.from({ length: 12 }, (_, k) => 'Giá trị ' + (k + 1)));
  });
});

describe('angle-diff', () => {
  const run = (a: number, b: number) => runNode(angleDiffNode, [{ inputs: { a, b } }], {})[0]?.diff;
  it('wraps A - B to (-180, 180]', () => {
    expect(run(90, 30)).toBe(60);
    expect(run(30, 90)).toBe(-60);
    expect(run(350, 10)).toBe(-20);
    expect(run(10, 350)).toBe(20);
    expect(run(180, 0)).toBe(180);
    expect(run(0, 180)).toBe(180);
    expect(run(-90, 90)).toBe(180);
    expect(run(725, 5)).toBe(0);
    expect(run(-170, 170)).toBe(20);
  });
  it('reads non-finite inputs as 0', () => {
    expect(run(Number.NaN, 30)).toBe(-30);
    expect(run(Infinity, 0)).toBe(0);
    expect(angleDifference(1e308, -1e308)).toBe(0);
  });
});

describe('math mod', () => {
  const run = (a: number, b: number, op = 'mod') => runNode(mathNode, [{ inputs: { a, b } }], { op })[0]?.out;
  it('has the sign of the divisor and a zero divisor gives 0', () => {
    expect(run(7, 3)).toBe(1);
    expect(run(-1, 3)).toBe(2);
    expect(run(7, -3)).toBe(-2);
    expect(run(-7, -3)).toBe(-1);
    expect(run(6, 3)).toBe(0);
    expect(run(5.5, 2)).toBeCloseTo(1.5, 9);
    expect(run(5, 0)).toBe(0);
  });
  it('leaves the default and the other ops alone', () => {
    expect(mathNode.params[0]!.default).toBe('add');
    expect(run(7, 3, 'add')).toBe(10);
    expect(run(7, 3, 'div')).toBeCloseTo(7 / 3, 9);
  });
});

describe('registration and names', () => {
  it('registers the three kinds with VI + EN names and search aliases', () => {
    const want: Record<string, [string, string]> = {
      'bool-to-number': ['Đổi thành số', 'Bool to Number'],
      'value-table': ['Bảng giá trị', 'Lookup Table'],
      'angle-diff': ['Chênh lệch góc', 'Angle Difference'],
    };
    for (const [kind, [vi, en]] of Object.entries(want)) {
      const def = getNodeDef(kind)!;
      expect(def.label).toBe(vi);
      expect(def.labelEn).toBe(en);
      expect(nodeSearchAliases(kind)).toContain(en);
      for (const p of [...def.inputs, ...def.outputs]) expect(p.labelEn, kind + '.' + p.id).toBeTruthy();
    }
  });
});

type World = ReturnType<typeof createWorld>;
const robotX = (world: World): number => world.entities().find((e) => e.kind === 'character')!.position.x;

function play(kind: string, keys: (k: number) => Set<string>, seconds: number, probe: (world: World, k: number) => void): void {
  const board = HANDBOOK_LOGIC_EXTRAS.find((e) => e.kind === kind)!.tryBoard();
  const world = createWorld(board.mode);
  const rt = createRuntime(board.graph, world, board.mode);
  for (let k = 0; k < Math.round(seconds * 60); k++) {
    rt.tick({ keysDown: keys(k) });
    world.step(TICK_DT);
    probe(world, k);
  }
}

describe('handbook: logic extras', () => {
  it('covers the three kinds', () => {
    expect(sorted(HANDBOOK_LOGIC_EXTRAS.map((e) => e.kind))).toEqual(['angle-diff', 'bool-to-number', 'value-table']);
  });

  for (const entry of HANDBOOK_LOGIC_EXTRAS) {
    describe(entry.kind, () => {
      const def = getNodeDef(entry.kind)!;
      it('explains every port and param and points at a lesson', () => {
        expect(sorted(Object.keys(entry.ports))).toEqual(sorted(new Set([...knownInputs(def), ...knownOutputs(def)].map((p) => p.id))));
        expect(sorted(Object.keys(entry.params))).toEqual(sorted(def.params.map((p) => p.id)));
        for (const t of [entry.purpose, entry.whenToUse, entry.example, ...entry.tips, ...Object.values(entry.ports), ...Object.values(entry.params)]) {
          expect(t.trim().length).toBeGreaterThan(0);
        }
        expect(LESSONS.some((l) => l.id === entry.lessonId)).toBe(true);
      });
      it('has a try board that round-trips and uses the node', () => {
        const board = entry.tryBoard();
        expect(board.graph.nodes.some((n) => n.kind === entry.kind)).toBe(true);
        expect(parseBoard(serializeBoard(board)).ok).toBe(true);
      });
    });
  }

  it('bool-to-number board: holding Space walks right, releasing stops', () => {
    let atRelease = 0;
    let end = 0;
    play('bool-to-number', (k) => (k < 60 ? new Set(['Space']) : new Set<string>()), 2, (w, k) => {
      if (k === 59) atRelease = robotX(w);
      end = robotX(w);
    });
    expect(atRelease).toBeGreaterThan(-6 + 2);
    expect(end - atRelease).toBeLessThan(1.5);
  });

  it('value-table board: robot visits the three rows in turn', () => {
    const xs: number[] = [];
    play('value-table', () => new Set<string>(), 16, (w, k) => {
      if (k % 60 === 59) xs.push(robotX(w));
    });
    // Step 1 (-5) for 5 s, step 2 (0) 5-10 s, step 3 (5) 10-15 s.
    expect(Math.abs(xs[3]! + 5)).toBeLessThan(1);
    expect(Math.abs(xs[8]!)).toBeLessThan(1);
    expect(xs[13]!).toBeGreaterThan(4);
  });
});
