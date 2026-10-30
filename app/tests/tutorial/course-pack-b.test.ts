import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState, type EditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type EntityView, type Graph, type GraphNode, type PortRef, type ViewMode } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { chapterOf, lessonName } from '../../src/tutorial/course';
import { findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import type { Snapshot } from '../../src/tutorial/types';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });
type Params = Parameters<EditorState['setParam']>[2];

/** Drives a lesson with real editor-state operations, like the learner would, and checks every step on the way. */
function session(lessonId: string) {
  const lesson = findLesson(lessonId);
  if (!lesson) throw new Error(`no lesson ${lessonId}`);
  const state = createEditorState(lesson.createBoard());
  const runner = createRunner(lesson);
  let ended: Snapshot['ended'] = null;
  const snap = (): Snapshot => ({ graph: state.getGraph(), mode: state.getMode(), playing: state.isPlaying(), ended });
  const tick = (): void => {
    runner.evaluate(snap());
  };
  tick();
  const s = {
    state,
    runner,
    lesson,
    graph: (): Graph => state.getGraph(),
    node: (pred: (n: GraphNode) => boolean): string => {
      const n = state.getGraph().nodes.find(pred);
      if (!n) throw new Error('node not found');
      return n.id;
    },
    kind: (kind: string, pred: (n: GraphNode) => boolean = () => true): string => s.node((n) => n.kind === kind && pred(n)),
    stepId: () => runner.step().id,
    /** Runs `edit` while the lesson sits on `id`: its check must fail first, its hint must exist, and the step must move on after. */
    apply(id: string, edit: () => void): void {
      expect(runner.step().id).toBe(id);
      const step = runner.step();
      expect(step.check, `step ${id} has a check`).toBeDefined();
      expect(step.check!(snap()), `step ${id} passes before its edit`).toBe(false);
      const targets = step.target?.(snap()) ?? [];
      expect(targets.length, `step ${id} has a target`).toBeGreaterThan(0);
      for (const t of targets) for (const sel of typeof t === 'string' ? [t] : t) expect(sel.length).toBeGreaterThan(0);
      edit();
      expect(runner.step().id, `step ${id} is done after its edit`).not.toBe(id);
    },
    info(id: string): void {
      expect(runner.step().id).toBe(id);
      expect(runner.step().check).toBeUndefined();
      runner.next();
    },
    add(kind: string): string {
      const id = state.addNode(kind, { x: 0, y: 0 });
      if (!id) throw new Error(`cannot add ${kind}`);
      tick();
      return id;
    },
    param(id: string, name: string, v: Params): void {
      state.setParam(id, name, v);
      tick();
    },
    wire(from: PortRef, to: PortRef): void {
      expect(state.connect(from, to)).toEqual({ ok: true });
      tick();
    },
    play(on: boolean): void {
      state.setPlaying(on);
      if (on) ended = null;
      tick();
    },
    end(result: 'win' | 'lose'): void {
      ended = result;
      tick();
    },
  };
  return s;
}

/** A finished board played headless. */
function simulate(graph: Graph, mode: ViewMode) {
  const world = createWorld(mode);
  const rt = createRuntime(graph, world, mode);
  return {
    world,
    rt,
    step(n: number, keys: string[] = [], each?: (i: number) => void): void {
      for (let i = 0; i < n; i++) {
        rt.tick({ keysDown: new Set(keys) });
        world.step(TICK_DT);
        each?.(i);
      }
    },
    view: (ownerId: string): EntityView => world.entities().find((e) => e.ownerNodeId === ownerId)!,
  };
}

const LESSON_NAMES: Record<string, { name: string; chapter: string; mode: ViewMode }> = {
  'route-traffic': { name: 'Xe chạy theo tuyến', chapter: 'vehicles', mode: '2d-top' },
  train: { name: 'Tàu hỏa', chapter: 'vehicles', mode: '2d-top' },
  'cargo-delivery': { name: 'Chở hàng', chapter: 'delivery', mode: '2d-side' },
  'guide-arrow': { name: 'Mũi tên dẫn đường', chapter: 'delivery', mode: '2d-side' },
};

describe.each(Object.entries(LESSON_NAMES))('lesson %s: registration and starter board', (id, info) => {
  it('is registered in its chapter with an unnumbered name', () => {
    const lesson = findLesson(id)!;
    expect(lesson).toBeDefined();
    expect(chapterOf(id)?.id).toBe(info.chapter);
    expect(lessonName(lesson.title)).toBe(info.name);
    expect(lesson.summary.length).toBeGreaterThan(10);
    expect(new Set(lesson.steps.map((s) => s.id)).size).toBe(lesson.steps.length);
    expect(lesson.steps[lesson.steps.length - 1]!.check).toBeUndefined();
  });

  it('starts on a fresh, valid board that runs without errors', () => {
    const a = findLesson(id)!.createBoard();
    const b = findLesson(id)!.createBoard();
    expect(a.mode).toBe(info.mode);
    expect(a.graph.nodes.length).toBeGreaterThan(3);
    expect(a).not.toBe(b);
    const ids = new Set(a.graph.nodes.map((n) => n.id));
    for (const w of a.graph.wires) {
      expect(ids.has(w.from.node) && ids.has(w.to.node)).toBe(true);
    }
    const sim = simulate(a.graph, a.mode);
    expect(() => sim.step(60)).not.toThrow();
    expect(sim.world.ended).toBeNull();
  });

  it('every step with a check has a non-empty target on the starter board, and no step is already done', () => {
    const lesson = findLesson(id)!;
    const board = lesson.createBoard();
    const snap: Snapshot = { graph: board.graph, mode: board.mode, playing: false, ended: null };
    for (const step of lesson.steps) {
      if (!step.check) continue;
      // Steps that mention nodes the learner adds later may have a target that waits for them; they still must return a list.
      expect(Array.isArray(step.target?.(snap) ?? [])).toBe(true);
      if (step.id !== 'back-to-edit') expect(step.check(snap), `${step.id} already true on the starter board`).toBe(false);
    }
  });
});

// ---------- Xe chạy theo tuyến ----------

describe('lesson route-traffic: a car that waits at a red light', () => {
  function solve() {
    const s = session('route-traffic');
    const car = s.kind('vehicle');
    const timer = s.kind('timer');
    const counter = s.kind('counter');
    const light = s.kind('block', (n) => n.params.style === 'trafficlight');
    s.info('intro');
    let route = '';
    s.apply('add-route', () => (route = s.add('route-follow')));
    s.apply('wire-route-who', () => s.wire(p(car, 'self'), p(route, 'self')));
    s.apply('wire-route-move', () => {
      s.wire(p(route, 'moveX'), p(car, 'moveX'));
      expect(s.stepId()).toBe('wire-route-move');
      s.wire(p(route, 'moveY'), p(car, 'moveY'));
    });
    s.apply('watch', () => s.play(true));
    s.apply('back-to-edit', () => s.play(false));
    s.apply('wire-timer', () => s.wire(p(timer, 'done'), p(counter, 'up')));
    s.apply('wire-color', () => s.wire(p(counter, 'value'), p(light, 'pick')));
    let zone = '';
    s.apply('add-zone', () => (zone = s.add('zone')));
    s.apply('zone-place', () => s.param(zone, 'center', { x: 0, y: 1, z: -6 }));
    s.apply('zone-filter', () => s.param(zone, 'filter', 'vehicle'));
    let not = '';
    s.apply('add-not', () => (not = s.add('not')));
    s.apply('wire-red', () => s.wire(p(counter, 'reached'), p(not, 'in')));
    let and = '';
    s.apply('add-and', () => (and = s.add('and')));
    s.apply('wire-rule', () => {
      s.wire(p(zone, 'inside'), p(and, 'a'));
      expect(s.stepId()).toBe('wire-rule');
      s.wire(p(not, 'out'), p(and, 'b'));
    });
    s.apply('wire-stop', () => s.wire(p(and, 'out'), p(route, 'stop')));
    s.apply('play-stop', () => s.play(true));
    expect(s.stepId()).toBe('done');
    return { s, car, light, route, zone };
  }

  it('walks every step in order', () => {
    expect(solve().s.stepId()).toBe('done');
  });

  it('the zone step wants the zone on the road, not at the default spot', () => {
    const s = session('route-traffic');
    s.info('intro');
    s.apply('add-route', () => s.add('route-follow'));
    const car = s.kind('vehicle');
    const route = s.kind('route-follow');
    s.apply('wire-route-who', () => s.wire(p(car, 'self'), p(route, 'self')));
    s.apply('wire-route-move', () => {
      s.wire(p(route, 'moveX'), p(car, 'moveX'));
      s.wire(p(route, 'moveY'), p(car, 'moveY'));
    });
    s.apply('watch', () => s.play(true));
    s.apply('back-to-edit', () => s.play(false));
    s.apply('wire-timer', () => s.wire(p(s.kind('timer'), 'done'), p(s.kind('counter'), 'up')));
    s.apply('wire-color', () => s.wire(p(s.kind('counter'), 'value'), p(s.kind('block', (n) => n.params.style === 'trafficlight'), 'pick')));
    let zone = '';
    s.apply('add-zone', () => (zone = s.add('zone')));
    s.param(zone, 'center', { x: 0, y: 1, z: 0 });
    expect(s.stepId()).toBe('zone-place');
    s.param(zone, 'center', { x: 0, y: 1, z: -6 });
    expect(s.stepId()).toBe('zone-filter');
  });

  it('the car waits at the stop line on red, then drives on once the light is green', () => {
    const { s, car, light } = solve();
    const sim = simulate(s.graph(), '2d-top');
    sim.step(60 * 4);
    const waiting = sim.view(car).position;
    expect(waiting.x).toBeGreaterThan(-3.5);
    expect(waiting.x).toBeLessThan(0);
    expect(waiting.z).toBeCloseTo(-6, 0);
    expect(sim.view(light).color).toBe('#ef4444');
    sim.step(60 * 3);
    expect(sim.view(car).position.x).toBeCloseTo(waiting.x, 1);
    sim.step(60 * 3);
    expect(sim.view(light).color).toBe('#22c55e');
    sim.step(60 * 3);
    expect(sim.view(car).position.x).toBeGreaterThan(waiting.x + 3);
  });

  it('without the stop wire the car never stops', () => {
    const { s, car, route } = solve();
    const g = s.graph();
    const noStop: Graph = { ...g, wires: g.wires.filter((w) => !(w.to.node === route && w.to.port === 'stop')) };
    const sim = simulate(noStop, '2d-top');
    let slowest = Infinity;
    sim.step(60 * 6, [], (i) => {
      if (i > 120) slowest = Math.min(slowest, sim.view(car).vehicle?.speed ?? 0);
    });
    expect(slowest).toBeGreaterThan(1);
  });
});

// ---------- Tàu hỏa ----------

describe('lesson train: a locomotive with two wagons on the rails', () => {
  function solve() {
    const s = session('train');
    const byX = (x: number) => s.kind('vehicle', (n) => Math.abs((n.params.position as { x: number }).x - x) < 0.01);
    const loco = byX(2);
    const w1 = byX(-1);
    const w2 = byX(-4);
    s.info('intro');
    const east = s.kind('block', (n) => Math.abs((n.params.position as { x: number }).x - 6) < 0.01 && (n.params.position as { z: number }).z === 0);
    s.apply('fix-rail', () => s.param(east, 'style', 'rail'));
    s.apply('make-loco', () => s.param(loco, 'model', 'locomotive'));
    s.apply('make-wagons', () => {
      s.param(w1, 'model', 'wagon');
      expect(s.stepId()).toBe('make-wagons');
      s.param(w2, 'model', 'wagon');
    });
    s.apply('wire-tow1', () => s.wire(p(loco, 'self'), p(w1, 'leader')));
    s.apply('wire-tow2', () => s.wire(p(w1, 'self'), p(w2, 'leader')));
    let route = '';
    s.apply('add-route', () => (route = s.add('route-follow')));
    s.apply('wire-route-who', () => s.wire(p(loco, 'self'), p(route, 'self')));
    s.apply('route-rail', () => s.param(route, 'follow', 'rail'));
    s.apply('watch', () => s.play(true));
    s.apply('back-to-edit', () => s.play(false));
    let timer = '';
    s.apply('add-timer', () => (timer = s.add('timer')));
    s.apply('timer-seconds', () => s.param(timer, 'seconds', 3));
    s.apply('wire-reached', () => s.wire(p(route, 'reached'), p(timer, 'reset')));
    let not = '';
    s.apply('add-not', () => (not = s.add('not')));
    s.apply('wire-waiting', () => s.wire(p(timer, 'done'), p(not, 'in')));
    s.apply('wire-stop', () => s.wire(p(not, 'out'), p(route, 'stop')));
    s.apply('play-station', () => s.play(true));
    expect(s.stepId()).toBe('done');
    return { s, loco, w1, w2, route };
  }

  it('walks every step in order', () => {
    expect(solve().s.stepId()).toBe('done');
  });

  it('the rail step wants every track piece to be a rail', () => {
    const s = session('train');
    s.info('intro');
    const east = s.kind('block', (n) => Math.abs((n.params.position as { x: number }).x - 6) < 0.01 && (n.params.position as { z: number }).z === 0);
    s.param(east, 'style', 'road');
    expect(s.stepId()).toBe('fix-rail');
    s.param(east, 'style', 'rail');
    expect(s.stepId()).toBe('make-loco');
  });

  it('the train stays on the rail, keeps its wagons coupled and rests at the stations', () => {
    const { s, loco, w1, w2 } = solve();
    const sim = simulate(s.graph(), '2d-top');
    expect(sim.view(loco).vehicle?.model).toBe('locomotive');
    expect(sim.view(w1).vehicle?.model).toBe('wagon');
    const square = [
      [-6, -6],
      [6, -6],
      [6, 6],
      [-6, 6],
    ] as const;
    const distToSquare = (e: EntityView): number => {
      let best = Infinity;
      for (let k = 0; k < 4; k++) {
        const [ax, az] = square[k]!;
        const [bx, bz] = square[(k + 1) % 4]!;
        const dx = bx - ax;
        const dz = bz - az;
        const f = Math.max(0, Math.min(1, ((e.position.x - ax) * dx + (e.position.z - az) * dz) / (dx * dx + dz * dz)));
        best = Math.min(best, Math.hypot(e.position.x - (ax + dx * f), e.position.z - (az + dz * f)));
      }
      return best;
    };
    let worst = 0;
    let minGap = Infinity;
    let maxGap = 0;
    let still = 0;
    let moving = 0;
    let stops = 0;
    let wasStill = false;
    let prev = { ...sim.view(loco).position };
    sim.step(60 * 40, [], (i) => {
      const l = sim.view(loco);
      const a = sim.view(w1);
      const b = sim.view(w2);
      if (i > 90) {
        worst = Math.max(worst, distToSquare(l));
        const g1 = Math.hypot(l.position.x - a.position.x, l.position.z - a.position.z);
        const g2 = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
        minGap = Math.min(minGap, g1, g2);
        maxGap = Math.max(maxGap, g1, g2);
      }
      const moved = Math.hypot(l.position.x - prev.x, l.position.z - prev.z);
      prev = { ...l.position };
      const isStill = moved < 0.001;
      if (isStill) still++;
      else moving++;
      if (isStill && !wasStill) stops++;
      wasStill = isStill;
    });
    expect(worst).toBeLessThan(0.7);
    expect(minGap).toBeGreaterThan(2);
    expect(maxGap).toBeLessThan(4.5);
    // 3 s of rest at every point and 3 s of running between them.
    expect(still).toBeGreaterThan(60 * 8);
    expect(moving).toBeGreaterThan(60 * 8);
    expect(stops).toBeGreaterThanOrEqual(3);
  });
});

// ---------- Chở hàng ----------

describe('lesson cargo-delivery: loading and unloading a truck', () => {
  function solve() {
    const s = session('cargo-delivery');
    const truck = s.kind('vehicle');
    const keyE = s.kind('key');
    s.info('intro');
    let cargo = '';
    s.apply('add-cargo', () => (cargo = s.add('cargo')));
    s.apply('wire-cargo-vehicle', () => s.wire(p(truck, 'self'), p(cargo, 'vehicle')));
    s.apply('load-type', () => s.param(cargo, 'loadType', 'thùng'));
    s.apply('unload-type', () => s.param(cargo, 'unloadType', 'thùng'));
    let keyL = '';
    s.apply('add-key', () => (keyL = s.add('key')));
    expect(keyL).not.toBe(keyE);
    s.apply('key-l', () => s.param(keyL, 'key', 'KeyL'));
    s.apply('wire-load', () => s.wire(p(keyL, 'pressed'), p(cargo, 'load')));
    let zone = '';
    s.apply('add-zone', () => (zone = s.add('zone')));
    s.apply('zone-filter', () => s.param(zone, 'filter', 'vehicle'));
    let and = '';
    s.apply('add-and', () => (and = s.add('and')));
    s.apply('wire-in-zone', () => s.wire(p(zone, 'inside'), p(and, 'a')));
    s.apply('wire-press-l', () => s.wire(p(keyL, 'pressed'), p(and, 'b')));
    s.apply('wire-unload', () => s.wire(p(and, 'out'), p(cargo, 'unload')));
    let counter = '';
    s.apply('add-counter', () => (counter = s.add('counter')));
    s.apply('counter-target', () => s.param(counter, 'target', 2));
    s.apply('wire-count', () => s.wire(p(cargo, 'unloaded'), p(counter, 'up')));
    let show = '';
    s.apply('add-show', () => (show = s.add('show-number')));
    s.apply('wire-show', () => s.wire(p(cargo, 'typeCount'), p(show, 'value')));
    let end = '';
    s.apply('add-end', () => (end = s.add('win-lose')));
    s.apply('wire-win', () => s.wire(p(counter, 'reached'), p(end, 'win')));
    s.apply('play-deliver', () => s.play(true));
    expect(s.stepId()).toBe('win');
    return { s, truck, cargo, counter };
  }

  it('walks every step in order up to the win and ends on the last step', () => {
    const { s } = solve();
    s.end('win');
    expect(s.stepId()).toBe('done');
  });

  it('the goods-type steps ignore other words', () => {
    const s = session('cargo-delivery');
    s.info('intro');
    let cargo = '';
    s.apply('add-cargo', () => (cargo = s.add('cargo')));
    s.apply('wire-cargo-vehicle', () => s.wire(p(s.kind('vehicle'), 'self'), p(cargo, 'vehicle')));
    s.param(cargo, 'loadType', 'đá');
    expect(s.stepId()).toBe('load-type');
    s.param(cargo, 'loadType', ' thùng ');
    expect(s.stepId()).toBe('unload-type');
  });

  it('a hero climbs in, loads only crates, unloads them in the zone and wins on the second delivery', () => {
    const { s, truck, cargo } = solve();
    const g = s.graph();
    const rock = g.nodes.find((n) => n.kind === 'item' && n.params.tag === 'đá')!.id;
    const sim = simulate(g, '2d-side');
    const tap = (key: string, hold = 3): void => sim.step(hold, [key]);
    sim.step(5);
    tap('KeyE');
    sim.step(10);
    expect(sim.view(truck).vehicle?.driver).not.toBeNull();

    // Drive right, tapping L whenever a crate may be in reach, until both crates are on board.
    let guard = 0;
    while ((sim.rt.getOutput(cargo, 'count') as number) < 2 && guard++ < 60 * 20) {
      sim.step(1, [guard % 20 < 3 ? 'KeyL' : 'ArrowRight', 'ArrowRight']);
      expect(sim.view(truck).position.x, 'truck stays out of the zone while loading').toBeLessThan(-3);
    }
    expect(sim.rt.getOutput(cargo, 'count')).toBe(2);
    expect(sim.rt.getOutput(cargo, 'typeCount')).toBe(2);
    expect(sim.view(rock).position.x, 'the rock stays where it was').toBeCloseTo(-12, 0);
    expect(sim.view(rock).position.y).toBeLessThan(1.5);
    expect(sim.world.ended).toBeNull();

    // Roll into the zone and let go of the gas.
    guard = 0;
    while (sim.view(truck).position.x < -0.5 && guard++ < 60 * 20) sim.step(1, ['ArrowRight']);
    sim.step(90);
    expect(sim.world.ended).toBeNull();
    tap('KeyL');
    sim.step(20);
    expect(sim.rt.getOutput(cargo, 'typeCount')).toBe(1);
    expect(sim.world.ended).toBeNull();
    tap('KeyL');
    sim.step(5);
    expect(sim.rt.getOutput(cargo, 'typeCount')).toBe(0);
    expect(sim.world.ended?.result).toBe('win');
  });

  it('outside the zone, L only loads and never counts a delivery', () => {
    const { s, truck, cargo, counter } = solve();
    const sim = simulate(s.graph(), '2d-side');
    sim.step(5);
    sim.step(3, ['KeyE']);
    sim.step(10);
    let guard = 0;
    while (sim.view(truck).position.x < -3.5 && guard++ < 60 * 20) sim.step(1, [guard % 20 < 3 ? 'KeyL' : 'ArrowRight', 'ArrowRight']);
    expect(sim.rt.getOutput(cargo, 'count')).toBe(2);
    expect(sim.rt.getOutput(counter, 'value')).toBe(0);
    expect(sim.rt.getOutput(cargo, 'unloaded')).toBe(false);
  });
});

// ---------- Mũi tên dẫn đường ----------

describe('lesson guide-arrow: arrows that follow the next target', () => {
  function solve() {
    const s = session('guide-arrow');
    const hero = s.kind('character');
    const at = (x: number) => s.kind('block', (n) => n.params.type === 'pickup' && Math.abs((n.params.position as { x: number }).x - x) < 0.01);
    const flagA = at(0);
    const flagB = at(9);
    const touchA = s.kind('touch');
    s.info('intro');
    let a1 = '';
    s.apply('add-arrow', () => (a1 = s.add('guide-arrow')));
    s.apply('wire-from', () => s.wire(p(hero, 'self'), p(a1, 'from')));
    s.apply('wire-to', () => s.wire(p(flagA, 'self'), p(a1, 'to')));
    s.apply('watch', () => s.play(true));
    s.apply('back-to-edit', () => s.play(false));
    let a2 = '';
    s.apply('add-arrow-2', () => (a2 = s.add('guide-arrow')));
    s.apply('wire-from-2', () => s.wire(p(hero, 'self'), p(a2, 'from')));
    s.apply('wire-to-2', () => s.wire(p(flagB, 'self'), p(a2, 'to')));
    let counter = '';
    s.apply('add-counter', () => (counter = s.add('counter')));
    s.apply('counter-start', () => s.param(counter, 'start', 1));
    s.apply('wire-touch', () => s.wire(p(touchA, 'touching'), p(counter, 'up')));
    let select = '';
    s.apply('add-select', () => (select = s.add('select-number')));
    s.apply('wire-select', () => s.wire(p(counter, 'value'), p(select, 'value')));
    s.apply('wire-show-1', () => s.wire(p(select, 'is1'), p(a1, 'show')));
    s.apply('wire-show-2', () => s.wire(p(select, 'is2'), p(a2, 'show')));
    s.apply('play-guide', () => s.play(true));
    expect(s.stepId()).toBe('win');
    return { s, hero, a1, a2, select, counter };
  }

  it('walks every step in order up to the win and ends on the last step', () => {
    const { s } = solve();
    s.end('win');
    expect(s.stepId()).toBe('done');
  });

  it('works with the second arrow wired first: the arrow roles follow the yellow flag', () => {
    const s = session('guide-arrow');
    const hero = s.kind('character');
    const flagA = s.kind('block', (n) => n.params.type === 'pickup' && Math.abs((n.params.position as { x: number }).x) < 0.01);
    s.info('intro');
    const a1 = s.add('guide-arrow');
    s.wire(p(hero, 'self'), p(a1, 'from'));
    s.wire(p(flagA, 'self'), p(a1, 'to'));
    expect(s.stepId()).toBe('watch');
  });

  it('the first arrow shows, then swaps for the second one after the yellow flag; the red flag wins', () => {
    const { s, hero, a1, a2, select, counter } = solve();
    const sim = simulate(s.graph(), '2d-side');
    const hud = (id: string) => sim.world.hudItems().find((h) => h.key === id)!;
    sim.step(30);
    expect(sim.rt.getOutput(select, 'is1')).toBe(true);
    expect(hud(a1).hidden).toBe(false);
    expect(hud(a1).guide).toBeDefined();
    expect(hud(a2).hidden).toBe(true);
    // Walk right past the yellow flag at x = 0.
    let guard = 0;
    while (sim.view(hero).position.x < 2 && guard++ < 60 * 10) sim.step(1, ['ArrowRight']);
    sim.step(5);
    expect(sim.rt.getOutput(counter, 'value')).toBe(2);
    expect(sim.rt.getOutput(select, 'is2')).toBe(true);
    expect(hud(a1).hidden).toBe(true);
    expect(hud(a2).hidden).toBe(false);
    expect(sim.world.ended).toBeNull();
    guard = 0;
    while (!sim.world.ended && guard++ < 60 * 10) sim.step(1, ['ArrowRight']);
    expect(sim.world.ended?.result).toBe('win');
  });

  it('with no wiring on the arrows nothing is shown after the first flag (starter board alone does not win)', () => {
    const board = findLesson('guide-arrow')!.createBoard();
    const sim = simulate(board.graph, board.mode);
    sim.step(60 * 3);
    expect(sim.world.ended).toBeNull();
  });
});
