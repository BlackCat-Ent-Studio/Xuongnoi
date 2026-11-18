import { beforeAll, describe, expect, it } from 'vitest';
import { estimateNodeSize } from '../../src/editor/graph/graph-geometry';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board } from '../../src/engine/types';
import { listAllSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { distanceToPath, presetPath } from '../../src/world/line-track';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const sample = (): Board => structuredClone(listAllSamples().find((s) => s.id === 'robot-line-follow')!.board);

const ALLOWED = new Set(['block', 'line-track', 'on-start', 'robot-body', 'line-sensor', 'math', 'const', 'pid', 'motor', 'signal-plot', 'show-number', 'camera']);

interface Run {
  laps: number;
  maxOff: number;
  meanOff: number;
}

const trackNode = sample().graph.nodes.find((n) => n.kind === 'line-track')!;
const TRACK = presetPath('eight', 0, 0, trackNode.params.length as number, trackNode.params.breadth as number);
const PERIMETER = TRACK.path.reduce((sum, p, i) => {
  const q = TRACK.path[(i + 1) % TRACK.path.length]!;
  return sum + Math.hypot(q.u - p.u, q.v - p.v);
}, 0);

/** Plays the board; laps = driven distance / length of the figure eight, maxOff = worst distance of the robot centre from the line (m). */
function run(board: Board, seconds: number): Run {
  const world = createWorld(board.mode, worldOptionsForGraph(board.graph));
  const rt = createRuntime(board.graph, world, board.mode);
  let travelled = 0;
  let maxOff = 0;
  let sumOff = 0;
  let ticks = 0;
  let last: { x: number; z: number } | null = null;
  for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
    const e = world.entities().find((x) => x.kind === 'robot')!;
    if (last) travelled += Math.hypot(e.position.x - last.x, e.position.z - last.z);
    last = { x: e.position.x, z: e.position.z };
    const off = distanceToPath(TRACK.path, TRACK.closed, { u: e.position.x, v: e.position.z });
    maxOff = Math.max(maxOff, off);
    sumOff += off;
    ticks++;
  }
  return { laps: travelled / PERIMETER, maxOff, meanOff: sumOff / Math.max(1, ticks) };
}

/** Still following the line: more than a lap, never further than the line is wide from it. */
const stays = (r: Run): boolean => r.maxOff < 0.2 && r.laps > 1;
/** One missing wire may be partly made up by the others (one motor can still steer), so it also counts as broken when the tracking is clearly sloppier. */
const worse = (r: Run, intact: Run): boolean => !stays(r) || r.meanOff > intact.meanOff * 1.4;

describe('sample Robot dò đường', () => {
  it('uses only the general pieces and keeps its cards apart', () => {
    const b = sample();
    for (const n of b.graph.nodes) expect(ALLOWED.has(n.kind), n.kind).toBe(true);
    expect(new Set(b.graph.nodes.map((n) => n.kind))).toEqual(ALLOWED);
    expect((b.notes ?? []).length).toBeGreaterThanOrEqual(3);
    const boxes = b.graph.nodes.map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y, ...estimateNodeSize(n) }));
    for (const p of boxes) {
      for (const q of boxes) {
        if (p.id < q.id) expect(p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y, `${p.id}/${q.id}`).toBe(false);
      }
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

  it('follows the line for more than five laps in two minutes (mean drift under 6 cm); camera on the robot, plot and speed on screen', { timeout: 120_000 }, () => {
    const b = sample();
    const r = run(b, 120);
    expect(r.laps).toBeGreaterThan(5);
    expect(r.meanOff).toBeLessThan(0.06);
    expect(b.mode).toBe('3d');
    expect(b.graph.nodes.some((n) => n.kind === 'block'), 'a floor').toBe(true);
    expect(b.graph.nodes.find((n) => n.kind === 'camera')!.params.view).toBe('tilted');
    expect(r.laps).toBeGreaterThan(2);
    expect(r.maxOff).toBeLessThan(0.2);
    const world = createWorld(b.mode, worldOptionsForGraph(b.graph));
    const rt = createRuntime(b.graph, world, b.mode);
    for (let i = 0; i < 300; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    const robot = world.entities().find((e) => e.kind === 'robot')!;
    expect(world.cameraCommand()?.target).toBe(robot.id);
    const hud = world.hudItems();
    expect(hud.some((h) => h.label === 'Tốc độ (m/s)')).toBe(true);
    expect(hud.some((h) => (h as { widget?: { type?: string } }).widget?.type === 'plot' || (h as { type?: string }).type === 'plot')).toBe(true);
  });

  it('is anti-forced: removing any essential wire makes it leave the line or stop', { timeout: 300_000 }, () => {
    const essential: [string, string, string, string][] = [
      ['mat-trai', 'level', 'lech', 'a'], ['mat-phai', 'level', 'lech', 'b'], ['mat-giua', 'level', 'toc-do', 'a'],
      ['lech', 'out', 'pid', 'measured'], ['pid', 'out', 'cong-trai', 'b'], ['pid', 'out', 'tru-phai', 'b'],
      ['cong-trai', 'out', 'dc-trai', 'power'], ['tru-phai', 'out', 'dc-phai', 'power'],
      ['than', 'self', 'dc-trai', 'body'], ['than', 'self', 'dc-phai', 'body'],
      ['than', 'self', 'mat-trai', 'who'], ['than', 'self', 'mat-giua', 'who'], ['than', 'self', 'mat-phai', 'who'],
    ];
    const intact = run(sample(), 40);
    expect(stays(intact)).toBe(true);
    for (const [fn, fp, tn, tp] of essential) {
      const b = sample();
      const before = b.graph.wires.length;
      b.graph.wires = b.graph.wires.filter((w) => !(w.from.node === fn && w.from.port === fp && w.to.node === tn && w.to.port === tp));
      expect(b.graph.wires.length, `${fn}.${fp}->${tn}.${tp}`).toBe(before - 1);
      const r = run(b, 40);
      expect(worse(r, intact), `${fn}.${fp}->${tn}.${tp} laps ${r.laps.toFixed(2)} off ${r.maxOff.toFixed(2)}`).toBe(true);
    }
  });

  it('shows the real grip limit: never accelerates faster than mu*g, the wheels slip when asked for more, a heavy robot is slower but still follows', { timeout: 120_000 }, () => {
    const b = sample();
    const world = createWorld(b.mode, worldOptionsForGraph(b.graph));
    const rt = createRuntime(b.graph, world, b.mode);
    let prev = 0;
    let peak = 0;
    let slippedTicks = 0;
    let readoutShowedSlip = false;
    for (let i = 0; i < 600; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
      const v = Number(rt.getOutput('than', 'speed'));
      peak = Math.max(peak, Math.abs(v - prev) / TICK_DT);
      prev = v;
      if (rt.getOutput('dc-trai', 'slipping') === true) slippedTicks++;
      const h = (world.hudItems() as readonly { label?: string; value?: number }[]).find((x) => x.label === 'Bánh trái trượt (m/s)');
      if (h && (h.value ?? 0) > 0.01) readoutShowedSlip = true;
    }
    // mu * g = 0.8 * 9.81 = 7.85 m/s2 (a little room for the speed read-out being one tick old).
    expect(peak).toBeLessThan(7.85 * 1.1);
    expect(slippedTicks).toBeGreaterThan(0);
    expect(readoutShowedSlip).toBe(true);
    const heavy = sample();
    heavy.graph.nodes.find((n) => n.kind === 'robot-body')!.params.mass = 20;
    const light = run(sample(), 60);
    const slow = run(heavy, 60);
    expect(slow.laps).toBeLessThan(light.laps * 0.9);
    expect(slow.maxOff).toBeLessThan(0.2);
  });

  it('Kp = 0 fails to steer', { timeout: 60_000 }, () => {
    const b = sample();
    b.graph.nodes.find((n) => n.kind === 'pid')!.params.kp = 0;
    expect(stays(run(b, 40))).toBe(false);
  });
});
