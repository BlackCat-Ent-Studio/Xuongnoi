import { beforeAll, describe, expect, it } from 'vitest';
import { estimateNodeSize } from '../../src/editor/graph/graph-geometry';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board } from '../../src/engine/types';
import { listAllSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const sample = (): Board => structuredClone(listAllSamples().find((s) => s.id === 'robot-square')!.board);

const ALLOWED = new Set([
  'block', 'line-track', 'robot-body', 'motor', 'sequence', 'counter', 'compare', 'and', 'or', 'math', 'const', 'map-range', 'angle-diff',
  'show-number', 'show-text', 'signal-plot', 'camera', 'on-start',
]);
/** Pieces that would make it a hand-driven or hidden-helper machine. */
const FORBIDDEN = ['key', 'stick', 'ui-button', 'character', 'vehicle', 'go-to', 'path-follower', 'patrol', 'chase', 'route-follow'];

const START = { x: -1, z: -1 };

interface Corner {
  /** Time the turn finished (s). */
  t: number;
  sides: number;
  x: number;
  z: number;
  /** Heading in degrees, 0 = the starting direction, wrapped to -180..180. */
  heading: number;
}

interface Run {
  /** Every moment a turn finished, with where the robot was and which way it faced. */
  corners: Corner[];
  sides: number;
  /** Steps of the sequence (1 = straight, 2 = turning) at the end. */
  step: number;
  /** Total change of heading, summed over small steps (degrees, signed). */
  spun: number;
  distance: number;
}

const wrap = (deg: number): number => ((((deg + 180) % 360) + 360) % 360) - 180;

function run(board: Board, seconds: number): Run {
  const world = createWorld(board.mode, worldOptionsForGraph(board.graph));
  const rt = createRuntime(board.graph, world, board.mode);
  const res: Run = { corners: [], sides: 0, step: 0, spun: 0, distance: 0 };
  let prevStep = 0;
  let lastHeading: number | null = null;
  let last: { x: number; z: number } | null = null;
  for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
    const r = world.entities().find((e) => e.kind === 'robot')!;
    const step = Number(rt.getOutput('buoc', 'index'));
    const sides = Number(rt.getOutput('dem-canh', 'value'));
    const heading = Number(rt.getOutput('than', 'heading'));
    if (lastHeading !== null) res.spun += wrap(heading - lastHeading);
    lastHeading = heading;
    if (last) res.distance += Math.hypot(r.position.x - last.x, r.position.z - last.z);
    last = { x: r.position.x, z: r.position.z };
    if (prevStep === 2 && step === 1) res.corners.push({ t: i * TICK_DT, sides, x: r.position.x, z: r.position.z, heading: wrap(heading) });
    prevStep = step;
    res.sides = sides;
    res.step = step;
  }
  return res;
}

/** Corners whose 4th side closes the square: back at the start (within 0.3 m), facing the start way (within 10 degrees). */
const closed = (c: Corner): boolean => c.sides % 4 === 0 && Math.hypot(c.x - START.x, c.z - START.z) < 0.3 && Math.abs(c.heading) < 10;
/** A real square: it closes, and every side of the walk is about 2 m (one working wheel can loop back to the start on a small circle, which is not a square). */
const realSquares = (r: Run): Corner[] =>
  r.corners.filter((c, k) => {
    if (!closed(c) || c.sides !== 4) return false;
    return r.corners.slice(0, k + 1).every((q, j) => j === 0 || Math.hypot(q.x - r.corners[j - 1]!.x, q.z - r.corners[j - 1]!.z) > 1.7);
  });

const cut = (b: Board, from: string, fp: string, to: string, tp: string): void => {
  const before = b.graph.wires.length;
  b.graph.wires = b.graph.wires.filter((w) => !(w.from.node === from && w.from.port === fp && w.to.node === to && w.to.port === tp));
  expect(b.graph.wires.length, `${from}.${fp}->${to}.${tp}`).toBe(before - 1);
};

describe('sample Robot đi hình vuông', () => {
  it('is an automated 3D machine from general pieces only, with a floor, a camera and readouts; cards do not overlap', () => {
    const b = sample();
    expect(b.mode).toBe('3d');
    for (const n of b.graph.nodes) {
      expect(ALLOWED.has(n.kind), n.kind).toBe(true);
      expect(FORBIDDEN.includes(n.kind), n.kind).toBe(false);
    }
    expect(new Set(b.graph.nodes.map((n) => n.kind))).toEqual(ALLOWED);
    const body = b.graph.nodes.find((n) => n.kind === 'robot-body')!;
    expect(body.params.showDistance).toBe('yes');
    expect(b.graph.nodes.filter((n) => n.kind === 'motor')).toHaveLength(2);
    expect((b.notes ?? []).length).toBeGreaterThanOrEqual(3);
    expect((b.notes ?? []).some((n) => n.text.includes('Thử đổi'))).toBe(true);
    const boxes = b.graph.nodes.map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y, ...estimateNodeSize(n) }));
    for (const p of boxes) {
      for (const q of boxes) {
        if (p.id < q.id) expect(p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y, `${p.id}/${q.id}`).toBe(false);
      }
    }
  });

  it('after 4 sides it is back at the start with the same heading, and it keeps going for at least 2 squares', { timeout: 120_000 }, () => {
    const r = run(sample(), 45);
    const fourth = r.corners.find((c) => c.sides === 4)!;
    expect(fourth, 'the 4th side is done').toBeDefined();
    expect(Math.hypot(fourth.x - START.x, fourth.z - START.z)).toBeLessThan(0.3);
    expect(Math.abs(fourth.heading)).toBeLessThan(10);
    const eighth = r.corners.find((c) => c.sides === 8)!;
    expect(eighth, 'two squares in the time limit').toBeDefined();
    expect(Math.hypot(eighth.x - START.x, eighth.z - START.z)).toBeLessThan(0.3);
    expect(Math.abs(eighth.heading)).toBeLessThan(10);
    // Each side is about 2 m long: the corners are 2 m apart.
    for (let k = 1; k < r.corners.length; k++) {
      const a = r.corners[k - 1]!;
      const c = r.corners[k]!;
      expect(Math.hypot(c.x - a.x, c.z - a.z), `side ${k}`).toBeGreaterThan(1.7);
      expect(Math.hypot(c.x - a.x, c.z - a.z), `side ${k}`).toBeLessThan(2.4);
    }
  });

  it('ships with "Vật lý thật" on, the robot weighs 2 kg and the motors say 30 N', () => {
    const b = sample();
    expect(b.graph.settings?.realPhysics).toBe(true);
    expect(worldOptionsForGraph(b.graph)?.realPhysics).toBe(true);
    const body = b.graph.nodes.find((n) => n.kind === 'robot-body')!;
    expect(body.params.mass).toBe(2);
    expect(body.params.friction).toBe(0.8);
    for (const m of b.graph.nodes.filter((n) => n.kind === 'motor')) expect(m.params.maxForce).toBe(30);
  });

  it('closes the square for 8 laps in a row: every 4th corner within 0.3 m of the start and within 10 degrees of the start heading', { timeout: 120_000 }, () => {
    const r = run(sample(), 180);
    const laps = r.corners.filter((c) => c.sides % 4 === 0);
    expect(laps.length).toBeGreaterThanOrEqual(8);
    for (const c of laps) {
      expect(Math.hypot(c.x - START.x, c.z - START.z), `after ${c.sides} sides`).toBeLessThan(0.3);
      expect(Math.abs(c.heading), `after ${c.sides} sides`).toBeLessThan(10);
    }
  });

  it('on a slippery floor (grip 0.2) the wheels slip, the readout shows it and the square no longer closes', { timeout: 120_000 }, () => {
    const b = sample();
    b.graph.nodes.find((n) => n.kind === 'robot-body')!.params.friction = 0.2;
    const world = createWorld(b.mode, worldOptionsForGraph(b.graph));
    const rt = createRuntime(b.graph, world, b.mode);
    let readout = 0;
    for (let i = 0; i < 1800; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
      readout = Math.max(readout, (world.hudItems() as readonly { label?: string; value?: number }[]).find((x) => x.label === 'Bánh trái trượt (m/s)')?.value ?? 0);
    }
    expect(readout).toBeGreaterThan(0.01);
    const r = run(b, 60);
    const fourth = r.corners.find((c) => c.sides === 4)!;
    expect(Math.hypot(fourth.x - START.x, fourth.z - START.z)).toBeGreaterThan(0.3);
  });

  it('shows the side count, the distance, the heading and a plot of the heading; the camera follows the robot', { timeout: 60_000 }, () => {
    const b = sample();
    const world = createWorld(b.mode, worldOptionsForGraph(b.graph));
    const rt = createRuntime(b.graph, world, b.mode);
    for (let i = 0; i < 600; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    const robot = world.entities().find((e) => e.kind === 'robot')!;
    expect(world.cameraCommand()?.target).toBe(robot.id);
    const hud = world.hudItems() as readonly { label?: string; text?: string; hidden?: boolean; value?: number; widget?: { type?: string } }[];
    for (const label of ['Số cạnh đã đi', 'Quãng đường cạnh này (m)', 'Hướng (độ)', 'Vòng bánh trái']) expect(hud.some((h) => h.label === label), label).toBe(true);
    expect(hud.find((h) => h.label === 'Số cạnh đã đi')!.value).toBeGreaterThanOrEqual(1);
    expect(hud.some((h) => h.widget?.type === 'plot')).toBe(true);
    expect(hud.filter((h) => h.text && !h.hidden)).toHaveLength(1);
    // One text card with two lines says what the robot is doing; the turn test is one angle-difference card.
    expect(b.graph.nodes.filter((n) => n.kind === 'show-text')).toHaveLength(1);
    expect(b.graph.nodes.filter((n) => n.kind === 'angle-diff')).toHaveLength(1);
    expect(b.graph.nodes.filter((n) => n.kind === 'compare').map((n) => n.id).sort()).toEqual(['du-goc', 'so-dai']);
  });

  it('is anti-forced: without the distance wire it never turns, without the heading wire it never stops turning', { timeout: 300_000 }, () => {
    const noDistance = sample();
    cut(noDistance, 'than', 'distance', 'so-dai', 'a');
    const a = run(noDistance, 25);
    expect(a.sides).toBe(0);
    expect(a.step).toBe(1);
    expect(a.corners).toHaveLength(0);
    expect(Math.abs(a.spun)).toBeLessThan(5);

    const noHeading = sample();
    cut(noHeading, 'than', 'heading', 'lech-goc', 'a');
    const h = run(noHeading, 25);
    expect(h.sides).toBe(1);
    expect(h.step).toBe(2);
    expect(h.corners).toHaveLength(0);
    expect(h.spun).toBeGreaterThan(360);
  });

  it('is anti-forced: every other essential wire stops the square', { timeout: 300_000 }, () => {
    const essential: [string, string, string, string][] = [
      ['buoc', 'step1', 'di-xong', 'a'], ['so-dai', 'out', 'di-xong', 'b'], ['di-xong', 'out', 'tiep', 'a'], ['tiep', 'out', 'buoc', 'next'],
      ['buoc', 'step2', 'quay-xong', 'a'], ['du-goc', 'out', 'quay-xong', 'b'], ['quay-xong', 'out', 'tiep', 'b'], ['lech-goc', 'diff', 'du-goc', 'a'], ['c-goc', 'value', 'du-goc', 'b'],
      ['buoc', 'step1', 'giu-huong', 'set'], ['giu-huong', 'value', 'lech-goc', 'b'], ['buoc', 'step2', 'than', 'resetDistance'],
      ['buoc', 'index', 'tien', 'value'], ['buoc', 'index', 'xoay', 'value'],
      ['cong-trai', 'out', 'dc-trai', 'power'], ['tru-phai', 'out', 'dc-phai', 'power'],
      ['than', 'self', 'dc-trai', 'body'], ['than', 'self', 'dc-phai', 'body'],
    ];
    for (const [fn, fp, tn, tp] of essential) {
      const b = sample();
      cut(b, fn, fp, tn, tp);
      const r = run(b, 40);
      expect(realSquares(r), `${fn}.${fp}->${tn}.${tp}`).toHaveLength(0);
    }
  });
});
