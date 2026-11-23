import { beforeAll, describe, expect, it } from 'vitest';
import { estimateNodeSize } from '../../src/editor/graph/graph-geometry';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board } from '../../src/engine/types';
import { listAllSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { createWorld } from '../../src/world/world';
import { overlapDepth } from '../helpers/chassis-metrics';

beforeAll(() => registerAllNodes());

const sample = (): Board => structuredClone(listAllSamples().find((s) => s.id === 'robot-avoid')!.board);

const ALLOWED = new Set([
  'block', 'robot-body', 'motor', 'ahead-sensor', 'math', 'map-range', 'compare', 'const', 'or', 'not', 'timer', 'counter',
  'show-number', 'show-text', 'signal-plot', 'camera', 'on-start',
]);
/** Pieces that would make it a hand-driven or hidden-helper machine. */
const FORBIDDEN = ['key', 'stick', 'ui-button', 'character', 'vehicle', 'go-to', 'path-follower', 'patrol', 'chase'];

interface Run {
  /** Smallest gap (m) between the robot's outline (length by width, turned to its heading) and any wall or box; 0 = touching. */
  minGap: number;
  /** Path length driven (m). */
  distance: number;
  /** Extent of the area the robot centre visited (m). */
  spanX: number;
  spanZ: number;
  reversed: boolean;
}

/** Plays the board and measures how close the robot came to the walls and boxes (floor excluded). */
function run(board: Board, seconds: number): Run {
  const world = createWorld(board.mode, worldOptionsForGraph(board.graph));
  const rt = createRuntime(board.graph, world, board.mode);
  const res: Run = { minGap: Infinity, distance: 0, spanX: 0, spanZ: 0, reversed: false };
  let last: { x: number; z: number } | null = null;
  const lo = { x: Infinity, z: Infinity };
  const hi = { x: -Infinity, z: -Infinity };
  for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
    const all = world.entities();
    const r = all.find((e) => e.kind === 'robot')!;
    if (last) res.distance += Math.hypot(r.position.x - last.x, r.position.z - last.z);
    last = { x: r.position.x, z: r.position.z };
    lo.x = Math.min(lo.x, r.position.x);
    hi.x = Math.max(hi.x, r.position.x);
    lo.z = Math.min(lo.z, r.position.z);
    hi.z = Math.max(hi.z, r.position.z);
    if ((r.robot?.speed ?? 0) < -0.1) res.reversed = true;
    for (const e of all) {
      if (e.kind !== 'block' || e.position.y < 0.9) continue; // the floor is a block too
      res.minGap = Math.min(res.minGap, -overlapDepth(r, e));
    }
  }
  res.spanX = hi.x - lo.x;
  res.spanZ = hi.z - lo.z;
  return res;
}

const cut = (b: Board, from: string, fp: string, to: string, tp: string): void => {
  const before = b.graph.wires.length;
  b.graph.wires = b.graph.wires.filter((w) => !(w.from.node === from && w.from.port === fp && w.to.node === to && w.to.port === tp));
  expect(b.graph.wires.length, `${from}.${fp}->${to}.${tp}`).toBe(before - 1);
};

describe('sample Robot tránh vật cản', () => {
  it('is an automated 3D machine from general pieces only, with a floor, a camera and readouts; cards do not overlap', () => {
    const b = sample();
    expect(b.mode).toBe('3d');
    for (const n of b.graph.nodes) {
      expect(ALLOWED.has(n.kind), n.kind).toBe(true);
      expect(FORBIDDEN.includes(n.kind), n.kind).toBe(false);
    }
    expect(new Set(b.graph.nodes.map((n) => n.kind))).toEqual(ALLOWED);
    expect(b.graph.nodes.filter((n) => n.kind === 'ahead-sensor')).toHaveLength(3);
    expect(b.graph.nodes.filter((n) => n.kind === 'motor')).toHaveLength(2);
    const angles = b.graph.nodes.filter((n) => n.kind === 'ahead-sensor').map((n) => Number(n.params.lookAngle ?? 0)).sort((x, y) => x - y);
    expect(angles[0]).toBeLessThan(0);
    expect(angles[1]).toBe(0);
    expect(angles[2]).toBeGreaterThan(0);
    expect((b.notes ?? []).length).toBeGreaterThanOrEqual(3);
    expect((b.notes ?? []).some((n) => n.text.includes('Thử đổi'))).toBe(true);
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

  it('drives 3 minutes around the room without touching a wall or a box, covering the room; readouts and camera on the robot', { timeout: 300_000 }, () => {
    const b = sample();
    const r = run(b, 180);
    expect(r.minGap).toBeGreaterThan(0.3);
    expect(r.distance).toBeGreaterThan(200);
    expect(r.spanX).toBeGreaterThan(5);
    expect(r.spanZ).toBeGreaterThan(4);
    const world = createWorld(b.mode, worldOptionsForGraph(b.graph));
    const rt = createRuntime(b.graph, world, b.mode);
    for (let i = 0; i < 300; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    const robot = world.entities().find((e) => e.kind === 'robot')!;
    expect(world.cameraCommand()?.target).toBe(robot.id);
    const hud = world.hudItems() as readonly { label?: string; text?: string; hidden?: boolean; widget?: { type?: string } }[];
    expect(hud.some((h) => h.label === 'Cách vật cản phía trước (m)')).toBe(true);
    expect(hud.some((h) => h.widget?.type === 'plot')).toBe(true);
    expect(hud.filter((h) => h.text && !h.hidden)).toHaveLength(1);
  });

  it('very near a wall it reverses and turns away without touching it', { timeout: 120_000 }, () => {
    const b = sample();
    const body = b.graph.nodes.find((n) => n.kind === 'robot-body')!;
    // Nose 0.6 m from the wall: nearer than the 0.6 m at which the front eye calls for backing up.
    body.params.position = { x: -6.95, y: 0.8, z: 0 };
    body.params.heading = 180;
    const r = run(b, 10);
    expect(r.reversed).toBe(true);
    expect(r.minGap).toBeGreaterThan(0.03);
  });

  it('works from other starting spots and headings too', { timeout: 300_000 }, () => {
    for (const [x, z, h] of [[-6, -4, -90], [5, -4, 200], [0, 0, 45], [-6, 3.5, 0]] as const) {
      const b = sample();
      const body = b.graph.nodes.find((n) => n.kind === 'robot-body')!;
      body.params.position = { x, y: 0.8, z };
      body.params.heading = h;
      const r = run(b, 60);
      expect(r.minGap, `${x},${z},${h}`).toBeGreaterThan(0.1);
      expect(r.distance, `${x},${z},${h}`).toBeGreaterThan(50);
    }
  });

  it('a 20 kg robot turns slowly and comes nearer to a wall or box than the 2 kg one (35 cm against 37), but still does not touch', { timeout: 120_000 }, () => {
    const b = sample();
    b.graph.nodes.find((n) => n.kind === 'robot-body')!.params.mass = 20;
    const r = run(b, 180);
    expect(r.minGap).toBeGreaterThan(0);
    expect(r.minGap).toBeLessThan(0.35);
  });

  it('is anti-forced: without the front eye it hits a wall, without a motor wire it stops or circles', { timeout: 300_000 }, () => {
    // Front eye loses its robot: it sees nothing, so it drives full speed at the wall.
    const blind = sample();
    cut(blind, 'than', 'self', 'cb-giua', 'who');
    expect(run(blind, 60).minGap).toBeLessThan(0.02);
    // Front distance no longer reaches the speed rule: the speed rule reads "no space" and the robot never goes forward.
    const noSpeed = sample();
    cut(noSpeed, 'cb-giua', 'distance', 'tien', 'value');
    expect(run(noSpeed, 60).distance).toBeLessThan(40);
    // One motor wire gone: it only circles on the spot.
    for (const [from, to] of [['cong-trai', 'dc-trai'], ['tru-phai', 'dc-phai']] as const) {
      const b = sample();
      cut(b, from, 'out', to, 'power');
      const r = run(b, 60);
      expect(Math.max(r.spanX, r.spanZ), `${from} cut`).toBeLessThan(4);
    }
    // A motor not mounted on the chassis: the other wheel alone only circles.
    for (const m of ['dc-trai', 'dc-phai']) {
      const b = sample();
      cut(b, 'than', 'self', m, 'body');
      const r = run(b, 20);
      expect(Math.max(r.spanX, r.spanZ), m).toBeLessThan(4);
    }
  });
});
