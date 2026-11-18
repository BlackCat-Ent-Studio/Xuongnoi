import { beforeAll, describe, expect, it } from 'vitest';
import { nodesInScope } from '../../src/editor/groups/group-model';
import { estimateNodeSize } from '../../src/editor/graph/graph-geometry';
import { compileGraph } from '../../src/engine/compile';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type GraphNode } from '../../src/engine/types';
import { listAllSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { trackSpecOf } from '../../src/nodes/line-track';
import { AGV_SETTINGS, AGV_WIRES } from '../../src/samples/agv-board';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { distanceToTrack } from '../../src/world/line-track';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';

let rapier: RapierModule;
beforeAll(async () => {
  registerAllNodes();
  rapier = await loadRapier();
});

/** The world the board asks for through its settings ("Vật lý thật" on), with the crate engine loaded. */
const makeWorld = (b: Board) => createWorld('3d', { ...(worldOptionsForGraph(b.graph) ?? {}), rapier });

const sample = (): Board => structuredClone(listAllSamples().find((s) => s.id === 'agv-shuttle')!.board);
const byId = (b: Board, id: string): GraphNode => b.graph.nodes.find((n) => n.id === id)!;

/** General pieces only: nothing driven by a key, a stick or a screen button. */
const ALLOWED = new Set([
  'block', 'line-track', 'robot-body', 'line-sensor', 'math', 'map-range', 'const', 'pid', 'motor', 'zone', 'compare', 'and', 'or', 'not',
  'sequence', 'joint', 'link', 'gripper', 'spawner', 'linear-actuator', 'counter', 'show-number', 'show-text', 'camera', 'on-start', 'timer',
]);

interface Run {
  delivered: number;
  laps: number;
  /** Worst distance (m) of the chassis centre from the painted line. */
  maxOff: number;
  /** Lowest height of a crate centre after the first second: a crate on the floor would read 0.25. */
  minCrateY: number;
  agv: { x: number; z: number; speed: number; payload: number; overloaded: boolean };
  pistonOverloaded: boolean;
  step: number;
}

/** Plays the board for `seconds`, calling `each(world, rt, t)` every tick when given. */
function run(board: Board, seconds: number, each?: (world: ReturnType<typeof createWorld>, rt: ReturnType<typeof createRuntime>, t: number) => void): Run {
  const world = makeWorld(board);
  const rt = createRuntime(board.graph, world, '3d');
  const track = trackSpecOf(byId(board, 'duong').params, '3d');
  let maxOff = 0;
  let minCrateY = Infinity;
  const ticks = Math.round(seconds / TICK_DT);
  for (let i = 0; i < ticks; i++) {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
    const agv = world.entities().find((e) => e.kind === 'robot')!;
    maxOff = Math.max(maxOff, distanceToTrack(track, { u: agv.position.x, v: agv.position.z }));
    if (i > 60) for (const e of world.entities()) if (e.kind === 'item') minCrateY = Math.min(minCrateY, e.position.y);
    each?.(world, rt, i * TICK_DT);
  }
  const agv = world.entities().find((e) => e.kind === 'robot')!;
  const out: Run = {
    delivered: Number(rt.getOutput('dem-thung', 'value')),
    laps: Number(rt.getOutput('dem-vong', 'value')),
    maxOff,
    minCrateY,
    agv: { x: agv.position.x, z: agv.position.z, speed: agv.robot?.speed ?? 0, payload: agv.robot?.payload ?? 0, overloaded: agv.robot?.overloaded === true },
    pistonOverloaded: rt.getOutput('xi-lanh', 'overloaded') === true,
    step: Number(rt.getOutput('buoc', 'index')),
  };
  world.dispose?.();
  return out;
}

const RUN_SECONDS = 80;
const withoutWire = (b: Board, from: string, fromPort: string, to: string, toPort: string): Board => {
  const before = b.graph.wires.length;
  b.graph.wires = b.graph.wires.filter((w) => !(w.from.node === from && w.from.port === fromPort && w.to.node === to && w.to.port === toPort));
  expect(b.graph.wires.length, `${from}.${fromPort}->${to}.${toPort}`).toBe(before - 1);
  return b;
};

describe('sample Xe tự hành chở hàng (AGV)', () => {
  it('uses only general pieces, groups its cards and keeps them apart', () => {
    const b = sample();
    expect(b.mode).toBe('3d');
    for (const n of b.graph.nodes) expect(ALLOWED.has(n.kind), n.kind).toBe(true);
    expect(b.graph.groups!.map((g) => g.name)).toEqual(['Bám line', 'Trạm dừng', 'Tay máy nạp hàng', 'Dỡ hàng', 'Đếm và hiện số']);
    // Every card is either loose on the board or in exactly one group.
    const grouped = b.graph.groups!.flatMap((g) => g.nodeIds);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect((b.notes ?? []).length).toBeGreaterThanOrEqual(5);
    const label = listAllSamples().find((s) => s.id === 'agv-shuttle')!.label;
    for (const text of [label, b.name, ...(b.notes ?? []).map((n) => n.text), ...b.graph.nodes.map((n) => String(n.params.text ?? ''))]) expect(text).not.toMatch(/game/i);
    const overlaps = (nodes: GraphNode[]): string[] => {
      const boxes = nodes.map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y, ...estimateNodeSize(n) }));
      const bad: string[] = [];
      for (const p of boxes) for (const q of boxes) if (p.id < q.id && p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y) bad.push(`${p.id}/${q.id}`);
      return bad;
    };
    expect(overlaps(nodesInScope(b.graph, null))).toEqual([]);
    for (const g of b.graph.groups!) expect(overlaps(nodesInScope(b.graph, g.id)), g.name).toEqual([]);
    // Group blocks and notes on the main board do not sit on top of each other either.
    const things = [
      ...b.graph.groups!.map((g) => ({ id: g.id, x: g.x, y: g.y, w: 240, h: 500 })),
      ...(b.notes ?? []).map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y, w: n.size.w, h: n.size.h })),
    ];
    for (const p of things) for (const q of things) if (p.id < q.id) expect(p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y, `${p.id}/${q.id}`).toBe(false);
  });

  it('feedback wires loop back only into the step sequence', () => {
    const b = sample();
    const back = [...compileGraph(b.graph).backEdges].map((id) => b.graph.wires.find((w) => w.id === id)!);
    expect(back.map((w) => `${w.from.node}.${w.from.port}->${w.to.node}.${w.to.port}`)).toEqual(['dk-hop-4.out->buoc.next']);
  });

  it('delivers at least two crates by itself, stays on the line and never drops a crate', { timeout: 120_000 }, () => {
    const b = sample();
    const seen = { text: new Set<string>(), carrying: 0, peakSpeed: 0, waitedAtLoad: 0 };
    const r = run(b, RUN_SECONDS, (world, rt) => {
      for (const h of world.hudItems()) if (h.text !== undefined && h.hidden === false) seen.text.add(h.text);
      const agv = world.entities().find((e) => e.kind === 'robot')!;
      seen.peakSpeed = Math.max(seen.peakSpeed, Math.abs(agv.robot?.speed ?? 0));
      if ((agv.robot?.payload ?? 0) > 0.5) seen.carrying++;
      if (agv.position.x < -3 && Math.abs(agv.position.z) < 0.4 && Math.abs(agv.robot?.speed ?? 0) < 0.05) seen.waitedAtLoad++;
      void rt;
    });
    expect(r.delivered).toBeGreaterThanOrEqual(2);
    expect(r.laps).toBeGreaterThanOrEqual(2);
    expect(r.maxOff).toBeLessThan(0.25);
    expect(r.minCrateY).toBeGreaterThan(0.4);
    // It really stops at the loading station while the arm works (a few seconds), and it carries a crate for a good part of the run.
    expect(seen.waitedAtLoad * TICK_DT).toBeGreaterThan(3);
    expect(seen.carrying * TICK_DT).toBeGreaterThan(10);
    expect(seen.peakSpeed).toBeGreaterThan(0.8);
    // On-screen state texts come and go with what the machine is doing.
    for (const t of ['Đang chạy theo line', 'Trạm nạp: tay máy đặt thùng lên xe', 'Trạm dỡ: xi lanh đẩy thùng ra']) expect(seen.text.has(t), t).toBe(true);
    expect(seen.text.has('QUÁ TẢI: thùng nặng hơn tải tối đa, xe không đi')).toBe(false);
  });

  it('shows readouts and a camera that frames the whole machine', () => {
    const b = sample();
    const world = makeWorld(b);
    const rt = createRuntime(b.graph, world, '3d');
    for (let i = 0; i < 600; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    const labels = world.hudItems().map((h) => h.label);
    for (const l of ['Khối lượng đang chở (kg)', 'Tốc độ (m/s)', 'Thùng đã giao', 'Số vòng đã chạy']) expect(labels).toContain(l);
    const cam = world.cameraCommand()!;
    expect(cam.mode).toBe('fixed');
    expect(cam.pitch).toBeGreaterThan(0.9);
  });

  it('a crate heavier than the maximum load makes the chassis stay at the loading station with "Quá tải" on', { timeout: 120_000 }, () => {
    const b = sample();
    byId(b, 'than').params.maxPayload = 0.5;
    let shown = false;
    const r = run(b, 45, (world) => {
      if (world.hudItems().some((h) => h.text?.startsWith('QUÁ TẢI') && h.hidden === false)) shown = true;
    });
    expect(r.delivered).toBe(0);
    expect(r.agv.overloaded).toBe(true);
    expect(r.agv.payload).toBeCloseTo(1, 5);
    expect(r.agv.x).toBeLessThan(-3.3);
    expect(Math.abs(r.agv.z)).toBeLessThan(0.5);
    expect(Math.abs(r.agv.speed)).toBeLessThan(0.01);
    expect(shown).toBe(true);
    // Raising the limit above the crate weight lets it drive off again.
    const ok = sample();
    byId(ok, 'than').params.maxPayload = 1.5;
    expect(run(ok, RUN_SECONDS).delivered).toBeGreaterThanOrEqual(2);
  });

  it('the piston needs mu x m x 9.81 = 4.9 N per crate it pushes: 3 N stalls, 6 N manages one crate, 12 N manages two', { timeout: 120_000 }, () => {
    const weak = sample();
    byId(weak, 'xi-lanh').params.maxForce = 3;
    const w = run(weak, 45);
    expect(w.delivered).toBe(0);
    expect(w.pistonOverloaded).toBe(true);
    expect(w.agv.x).toBeGreaterThan(3.3);
    expect(w.agv.payload).toBeCloseTo(1, 5);
    // The second crate also shoves the first one along the platform: 2 x 4.9 N = 9.8 N.
    const one = sample();
    byId(one, 'xi-lanh').params.maxForce = 6;
    const o = run(one, RUN_SECONDS);
    expect(o.delivered).toBe(1);
    expect(o.pistonOverloaded).toBe(true);
    const two = sample();
    byId(two, 'xi-lanh').params.maxForce = 12;
    expect(run(two, RUN_SECONDS).delivered).toBeGreaterThanOrEqual(2);
  });

  it('ships with "Vật lý thật" on; each drive motor pulls 6 N x 0.7 power = 4.2 N', () => {
    const b = sample();
    expect(b.graph.settings?.realPhysics).toBe(true);
    for (const m of ['dc-trai', 'dc-phai']) expect(byId(b, m).params.maxForce).toBe(AGV_SETTINGS.motorForce);
    expect(AGV_SETTINGS.motorForce * AGV_SETTINGS.speedGain * 2).toBeCloseTo(8.4, 9);
  });

  it('a heavier chassis speeds up more slowly: a = F / m with F = 8.4 N', () => {
    const speedAfter = (mass: number): number => {
      const b = sample();
      byId(b, 'than').params.mass = mass;
      let v = 0;
      run(b, 0.8, (world, _rt, t) => {
        if (t > 0.75) v = Math.abs(world.entities().find((e) => e.kind === 'robot')!.robot?.speed ?? 0);
      });
      return v;
    };
    // 20 kg: 8.4 / 20 = 0.42 m/s2, about 0.34 m/s after 0.8 s; 5 kg already runs at its line speed (0.99 m/s).
    expect(speedAfter(20)).toBeLessThan(0.45);
    expect(speedAfter(5)).toBeGreaterThan(speedAfter(20) + 0.4);
  });

  it('repeats load / carry / unload for 3 minutes, and the loaded chassis starts off slower than the empty one (1.4 against 1.68 m/s2)', { timeout: 300_000 }, () => {
    const b = sample();
    const departures: { payload: number; seconds: number }[] = [];
    let still = true;
    let t0 = -1;
    let payload0 = 0;
    const r = run(b, 180, (world, _rt, t) => {
      const agv = world.entities().find((e) => e.kind === 'robot')!;
      const v = Math.abs(agv.robot?.speed ?? 0);
      if (v < 0.02) {
        still = true;
        t0 = -1;
      } else if (still) {
        still = false;
        t0 = t;
        payload0 = agv.robot?.payload ?? 0;
      }
      if (!still && t0 >= 0 && v >= 0.9) {
        departures.push({ payload: payload0, seconds: t - t0 });
        t0 = -1;
      }
    });
    expect(r.delivered).toBeGreaterThanOrEqual(6);
    expect(r.laps).toBeGreaterThanOrEqual(5);
    expect(r.maxOff).toBeLessThan(0.25);
    expect(r.minCrateY).toBeGreaterThan(0.4);
    const mean = (xs: number[]): number => xs.reduce((a, c) => a + c, 0) / xs.length;
    const loaded = departures.filter((d) => d.payload > 0.5).map((d) => d.seconds);
    const empty = departures.filter((d) => d.payload < 0.5).map((d) => d.seconds);
    expect(loaded.length).toBeGreaterThanOrEqual(5);
    expect(empty.length).toBeGreaterThanOrEqual(5);
    // Hand numbers: 0.9 m/s at 1.4 m/s2 = 0.64 s loaded, at 1.68 m/s2 = 0.54 s empty (a tick or two of slack).
    expect(mean(loaded)).toBeGreaterThan(mean(empty) + 0.06);
    expect(mean(loaded)).toBeCloseTo(0.64, 1);
    expect(mean(empty)).toBeCloseTo(0.54, 1);
  });

  it('Kp = 0 does not steer: the chassis cannot take the first corner, loses the line and never reaches a station', { timeout: 120_000 }, () => {
    const b = sample();
    byId(b, 'pid').params.kp = 0;
    const r = run(b, 40);
    expect(r.delivered).toBe(0);
    expect(r.laps).toBe(-1);
    expect(r.agv.z).toBeGreaterThan(1.4);
  });

  it('the PID steers through both motors: either path alone still follows the line, with both removed the chassis loses it', { timeout: 300_000 }, () => {
    for (const to of ['cong-trai', 'tru-phai']) {
      const r = run(withoutWire(sample(), 'pid', 'out', to, 'b'), RUN_SECONDS);
      expect(r.delivered, to).toBeGreaterThanOrEqual(2);
      expect(r.maxOff, to).toBeLessThan(0.25);
    }
    const none = withoutWire(withoutWire(sample(), 'pid', 'out', 'cong-trai', 'b'), 'pid', 'out', 'tru-phai', 'b');
    const r = run(none, 40);
    expect(r.delivered).toBe(0);
    expect(r.laps).toBe(-1);
  });

  it('is anti-forced: removing any essential wire breaks the delivery (and what each failure looks like)', { timeout: 900_000 }, () => {
    const intact = run(sample(), RUN_SECONDS);
    expect(intact.delivered).toBeGreaterThanOrEqual(2);
    /** What the machine does without the wire. */
    type Failure =
      | 'floor-drop' // drives through the loading station: the arm still moves and drops its crate on the floor
      | 'rides-on' // keeps circling with the crate: never stops at the unloading station
      | 'stuck-loaded-at-load' // stays at the loading station although it is loaded
      | 'arm-stuck' // waits empty at the loading station while the arm is stuck on one step
      | 'one-crate' // the first crate is delivered, the arm then waits forever
      | 'no-crate' // nothing is ever put on the table
      | 'stuck-at-unload' // waits loaded at the unloading station: the crate is never pushed off
      | 'lost-line'; // never gets round the first corner
    const essential: { wire: [string, string, string, string]; fails: Failure; note: string; crateMayFall?: boolean }[] = [
      // Stations (stop logic)
      { wire: ['vung-nap', 'count', 'dung-nap', 'a'], fails: 'floor-drop', note: 'the loading zone cannot stop the chassis' },
      { wire: ['vung-do', 'count', 'dung-do', 'a'], fails: 'rides-on', note: 'the unloading zone cannot stop the chassis' },
      { wire: ['than', 'payload', 'trong', 'value'], fails: 'stuck-loaded-at-load', note: 'it never learns that it is loaded, so it keeps waiting for an empty chassis' },
      { wire: ['than', 'payload', 'co-hang', 'value'], fails: 'rides-on', note: 'it never learns that it carries a crate, so it never stops to unload' },
      // Arm: feedback from the pieces advances the steps
      { wire: ['vai', 'reached', 'dk-tay-xong', 'a'], fails: 'arm-stuck', note: 'the arm waits forever for the shoulder to arrive' },
      { wire: ['khuyu', 'reached', 'dk-tay-xong', 'b'], fails: 'arm-stuck', note: 'the arm waits forever for the elbow to arrive' },
      { wire: ['kep', 'inReach', 'dk-tay-gan', 'b'], fails: 'arm-stuck', note: 'the arm never sees a crate within reach' },
      { wire: ['kep', 'holding', 'dk-tay-giu', 'b'], fails: 'arm-stuck', note: 'the arm never learns that it holds the crate' },
      { wire: ['cho-kep', 'done', 'dk-tay-giu', 'a'], fails: 'arm-stuck', note: 'the arm never learns that the grip has held for a moment' },
      // The hand is solid: left lowered round the crate it keeps the loaded chassis in the loading zone (before, it passed through the hand).
      { wire: ['co-tai', 'out', 'dk-b5', 'b'], fails: 'stuck-loaded-at-load', note: 'after placing the first crate the arm waits forever for "loaded", and its open hand stays down round the crate' },
      { wire: ['dk-kep', 'out', 'kep', 'close'], fails: 'arm-stuck', note: 'the gripper never closes' },
      { wire: ['dk-hop-4', 'out', 'buoc', 'next'], fails: 'arm-stuck', note: 'the step sequence never advances' },
      { wire: ['goc-vai-b', 'out', 'goc-vai-c', 'a'], fails: 'arm-stuck', note: 'the shoulder angle loses its taught values' },
      { wire: ['goc-khuyu-a', 'out', 'khuyu', 'angle'], fails: 'arm-stuck', note: 'the elbow keeps its start angle (the straight arm sweeps the crate off the table)', crateMayFall: true },
      { wire: ['buoc', 'step1', 'tao-thung', 'spawn'], fails: 'no-crate', note: 'no crate is ever put on the table' },
      // Unloading
      { wire: ['dk-do-hang', 'out', 'xi-lanh', 'extend'], fails: 'stuck-at-unload', note: 'the piston never pushes' },
      { wire: ['co-tai', 'out', 'dk-do-hang', 'b'], fails: 'stuck-at-unload', note: 'the piston is never triggered' },
      // Line following
      { wire: ['mat-phai', 'level', 'lech', 'b'], fails: 'lost-line', note: 'without the right eye the PID only sees the left eye' },
      { wire: ['mat-giua', 'level', 'toc-do', 'a'], fails: 'lost-line', note: 'without the middle eye there is no forward speed' },
      { wire: ['lech', 'out', 'pid', 'measured'], fails: 'lost-line', note: 'the PID gets no error' },
      { wire: ['cong-trai', 'out', 'dc-trai', 'power'], fails: 'lost-line', note: 'the left motor gets no power' },
      { wire: ['tru-phai', 'out', 'dc-phai', 'power'], fails: 'lost-line', note: 'the right motor gets no power' },
      { wire: ['than', 'self', 'dc-trai', 'body'], fails: 'lost-line', note: 'the left motor is not mounted on the chassis' },
      { wire: ['than', 'self', 'mat-giua', 'who'], fails: 'lost-line', note: 'the middle eye is not mounted on the chassis' },
    ];
    for (const { wire, fails, note, crateMayFall } of essential) {
      const r = run(withoutWire(sample(), ...wire), RUN_SECONDS);
      const name = `${wire.join(' ')} (${note}) -> delivered ${r.delivered}, laps ${r.laps}, x ${r.agv.x.toFixed(2)}, payload ${r.agv.payload}, lowest crate ${r.minCrateY.toFixed(2)}`;
      expect(r.maxOff, name).toBeLessThan(0.25);
      if (fails === 'one-crate') {
        expect(r.delivered, name).toBe(1);
        continue;
      }
      expect(r.delivered, name).toBe(0);
      if (fails === 'floor-drop') expect(r.minCrateY, name).toBeLessThan(0.3);
      else if (!crateMayFall) expect(r.minCrateY, name).toBeGreaterThan(0.4);
      if (fails === 'rides-on') {
        expect(r.agv.payload, name).toBeCloseTo(1, 5);
        expect(r.laps, name).toBeGreaterThanOrEqual(2);
      }
      if (fails === 'stuck-loaded-at-load') {
        expect(r.agv.payload, name).toBeCloseTo(1, 5);
        expect(r.agv.x, name).toBeLessThan(-3.3);
      }
      if (fails === 'arm-stuck') {
        expect(r.agv.payload, name).toBe(0);
        expect(r.agv.x, name).toBeLessThan(-3.3);
      }
      if (fails === 'stuck-at-unload') {
        expect(r.agv.payload, name).toBeCloseTo(1, 5);
        expect(r.agv.x, name).toBeGreaterThan(3.3);
      }
      if (fails === 'lost-line') expect(r.laps, name).toBe(-1);
    }
    // The list covers wires that exist on the board.
    for (const { wire } of essential) expect(AGV_WIRES.some((w) => w.join() === wire.join()), wire.join()).toBe(true);
  });
});
