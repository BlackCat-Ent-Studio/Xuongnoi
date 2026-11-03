import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Graph, type ParamValue, type PortRef, type ViewMode } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { chapterOf, lessonName } from '../../src/tutorial/course';
import { findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import type { Lesson, Snapshot, TargetList } from '../../src/tutorial/types';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });
const MODE: ViewMode = '2d-side';

/** An editor plus a lesson runner fed after every edit, like the real controller does. */
function session(id: string) {
  const lesson = findLesson(id) as Lesson;
  const state = createEditorState(lesson.createBoard());
  const runner = createRunner(lesson);
  const snapshot = (ended: Snapshot['ended'] = null): Snapshot => ({
    graph: state.getGraph(),
    mode: state.getMode(),
    playing: state.isPlaying(),
    ended,
  });
  const tick = (ended: Snapshot['ended'] = null): void => void runner.evaluate(snapshot(ended));
  tick();
  const nodeOf = (kind: string, where?: (params: Record<string, ParamValue>) => boolean): string => {
    const n = state.getGraph().nodes.find((x) => x.kind === kind && (!where || where(x.params)));
    if (!n) throw new Error(`no ${kind}`);
    return n.id;
  };
  return {
    lesson,
    state,
    runner,
    tick,
    snapshot,
    nodeOf,
    stepId: () => runner.step().id,
    expectStep(id: string): void {
      expect(runner.step().id).toBe(id);
    },
    add(kind: string): string {
      const nodeId = state.addNode(kind, { x: 0, y: 0 });
      if (!nodeId) throw new Error(`cannot add ${kind}`);
      tick();
      return nodeId;
    },
    wire(from: PortRef, to: PortRef): void {
      expect(state.connect(from, to, { replace: true })).toEqual({ ok: true });
      tick();
    },
    set(nodeId: string, param: string, value: ParamValue): void {
      state.setParam(nodeId, param, value);
      tick();
    },
    play(on: boolean): void {
      state.setPlaying(on);
      tick();
    },
  };
}
type Session = ReturnType<typeof session>;

/** Runs the finished graph headless; `keys` decides which keys are held on each tick. */
function simulate(
  graph: Graph,
  ticks: number,
  keys: (tick: number, view: (owner: string) => ReturnType<ReturnType<typeof createWorld>['entities']>[number]) => string[],
  stopWhenEnded = true,
) {
  const world = createWorld(MODE);
  const rt = createRuntime(graph, world, MODE);
  const view = (owner: string) => {
    const e = world.entities().find((x) => x.ownerNodeId === owner);
    if (!e) throw new Error(`no entity of ${owner}`);
    return e;
  };
  let t = 0;
  for (; t < ticks; t++) {
    if (stopWhenEnded && world.ended) break;
    rt.tick({ keysDown: new Set(keys(t, view)) });
    world.step(TICK_DT);
  }
  return { world, view, ticks: t };
}

// ---------- one solver per lesson: applies the intended edit of each step and checks the step order ----------

function solveSecretDoor(s: Session) {
  const g = s.state.getGraph();
  const door = s.nodeOf('block', (q) => (q.size as { y: number }).y === 5);
  const room = s.nodeOf('zone');
  s.expectStep('intro');
  s.runner.next();
  s.expectStep('add-on-start');
  const start = s.add('on-start');
  s.expectStep('wire-open');
  s.wire(p(start, 'fired'), p(door, 'hide'));
  s.expectStep('add-not');
  const not = s.add('not');
  s.expectStep('wire-not-in');
  s.wire(p(room, 'inside'), p(not, 'in'));
  s.expectStep('wire-close');
  s.wire(p(not, 'out'), p(door, 'show'));
  s.expectStep('play');
  s.play(true);
  s.expectStep('win');
  return { door, hero: g.nodes.find((n) => n.kind === 'character')!.id };
}

function solveChaseGame(s: Session) {
  const nodes = s.state.getGraph().nodes;
  const hero = nodes.find((n) => n.kind === 'character' && n.params.role !== 'bot')!.id;
  const chaser = nodes.find((n) => n.kind === 'character' && n.params.color === '#ef4444')!.id;
  const runner = nodes.find((n) => n.kind === 'character' && n.params.color === '#22c55e')!.id;
  s.expectStep('intro');
  s.runner.next();
  s.expectStep('add-chase');
  const chase1 = s.add('chase');
  s.expectStep('wire-chaser');
  s.wire(p(chaser, 'self'), p(chase1, 'self'));
  s.wire(p(hero, 'self'), p(chase1, 'target'));
  s.expectStep('wire-chaser'); // one wire is still missing
  s.wire(p(chase1, 'moveX'), p(chaser, 'moveX'));
  s.expectStep('catch-distance');
  s.set(chase1, 'catchDistance', 0.8);
  s.expectStep('add-chase-2');
  const chase2 = s.add('chase');
  s.expectStep('set-flee');
  s.set(chase2, 'mode', 'flee');
  s.expectStep('wire-runner');
  s.wire(p(runner, 'self'), p(chase2, 'self'));
  s.wire(p(hero, 'self'), p(chase2, 'target'));
  s.wire(p(chase2, 'moveX'), p(runner, 'moveX'));
  s.expectStep('start-chase-go');
  const start = s.nodeOf('on-start');
  s.wire(p(start, 'started'), p(chase1, 'go'));
  s.wire(p(start, 'started'), p(chase2, 'go'));
  s.expectStep('play');
  s.play(true);
  s.expectStep('win');
  return { hero, chaser, runner };
}

function solveColliderGravity(s: Session) {
  const nodes = s.state.getGraph().nodes;
  const hero = nodes.find((n) => n.kind === 'character')!.id;
  const crate = nodes.find((n) => n.kind === 'item')!.id;
  const pad = nodes.find((n) => n.kind === 'block' && n.params.type === 'pickup')!.id;
  const end = nodes.find((n) => n.kind === 'win-lose')!.id;
  s.expectStep('intro');
  s.runner.next();
  s.expectStep('add-touch');
  const touch = s.add('touch');
  s.expectStep('wire-touch');
  s.wire(p(crate, 'self'), p(touch, 'a'));
  s.expectStep('wire-touch');
  s.wire(p(pad, 'self'), p(touch, 'b'));
  s.expectStep('wire-win');
  s.wire(p(touch, 'touching'), p(end, 'win'));
  s.expectStep('set-inside');
  s.set(touch, 'mode', 'inside');
  s.expectStep('set-hold');
  s.set(touch, 'hold', 0.5);
  s.expectStep('hero-gravity');
  s.set(hero, 'gravityScale', 0.3);
  s.expectStep('crate-gravity');
  s.set(crate, 'gravityScale', 0);
  s.expectStep('crate-collider');
  s.set(crate, 'colliderSize', { x: 1, y: 1, z: 1 });
  s.expectStep('play');
  s.play(true);
  s.expectStep('win');
  return { hero, crate, touch };
}

function solveConveyor(s: Session) {
  const nodes = s.state.getGraph().nodes;
  const belt = nodes.find((n) => n.kind === 'block' && (n.params.size as { y: number }).y === 0.4)!.id;
  const bin = nodes.find((n) => n.kind === 'zone')!.id;
  const end = nodes.find((n) => n.kind === 'win-lose')!.id;
  s.expectStep('intro');
  s.runner.next();
  s.expectStep('belt-style');
  s.set(belt, 'style', 'conveyor');
  s.expectStep('belt-direction');
  s.set(belt, 'beltDir', '-x');
  s.expectStep('start-block-run');
  s.wire(p(s.nodeOf('on-start'), 'started'), p(belt, 'run'));
  s.expectStep('add-key');
  const key = s.add('key');
  s.expectStep('wire-reverse');
  s.wire(p(key, 'held'), p(belt, 'reverse'));
  s.expectStep('bin-filter');
  s.set(bin, 'filter', 'item');
  s.expectStep('bin-goods');
  s.set(bin, 'goods', 'xanh');
  s.expectStep('bin-count');
  s.set(bin, 'minCount', 3);
  s.expectStep('wire-win');
  s.wire(p(bin, 'inside'), p(end, 'win'));
  s.expectStep('play');
  s.play(true);
  s.expectStep('win');
  return { belt, bin };
}

const SOLVERS = {
  'secret-door': solveSecretDoor,
  'chase-game': solveChaseGame,
  'collider-gravity': solveColliderGravity,
  conveyor: solveConveyor,
} as const;
const TITLES = {
  'secret-door': ['basics', 'Cửa bí mật'],
  'chase-game': ['bots', 'Trò đuổi bắt'],
  'collider-gravity': ['world', 'Va chạm và trọng lực'],
  conveyor: ['world', 'Băng chuyền'],
} as const;
const IDS = Object.keys(SOLVERS) as (keyof typeof SOLVERS)[];

describe.each(IDS)('course lesson %s', (id) => {
  it('is registered in its chapter with a plain title', () => {
    const lesson = findLesson(id)!;
    expect(lesson).toBeDefined();
    expect(chapterOf(id)?.id).toBe(TITLES[id][0]);
    expect(lessonName(lesson.title)).toBe(TITLES[id][1]);
    expect(lesson.summary.length).toBeGreaterThan(10);
  });

  it('starts on a valid side-view board with no step finished and Vietnamese text everywhere', () => {
    const lesson = findLesson(id)!;
    const board = lesson.createBoard();
    expect(board.mode).toBe('2d-side');
    const s = session(id);
    expect(s.runner.index()).toBe(0);
    const ids = lesson.steps.map((st) => st.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const st of lesson.steps) {
      expect(st.title.length).toBeGreaterThan(0);
      expect(st.text.length).toBeGreaterThan(0);
    }
    expect(lesson.steps[lesson.steps.length - 1]?.check).toBeUndefined();
    expect(lesson.steps.length).toBeGreaterThanOrEqual(6);
  });

  it('no check passes before its edit, and each passes after it, in order', () => {
    const lesson = findLesson(id)!;
    // Every checked step except the playing/winning ones is false on the untouched board.
    const fresh = session(id).snapshot();
    for (const st of lesson.steps) {
      if (st.check && st.id !== 'intro') expect(st.check(fresh), `${st.id} must not pass on the starter board`).toBe(false);
    }
    const s = session(id);
    SOLVERS[id](s);
    s.tick('win');
    expect(s.stepId()).toBe('done');
    expect(s.runner.isLast()).toBe(true);
  });

  it('points every step at non-empty selectors, before and after solving', () => {
    const lesson = findLesson(id)!;
    const s = session(id);
    const checkTargets = (snap: Snapshot): void => {
      for (const st of lesson.steps) {
        const list: TargetList = st.target?.(snap) ?? [];
        for (const t of list) for (const sel of typeof t === 'string' ? [t] : t) expect(sel.length).toBeGreaterThan(0);
      }
    };
    checkTargets(s.snapshot());
    SOLVERS[id](s);
    checkTargets(s.snapshot());
    // Every step that asks for an edit points at something once the node exists.
    for (const st of lesson.steps) if (st.check && st.id !== 'win') expect(st.target?.(s.snapshot()).length ?? 0).toBeGreaterThan(0);
  });
});

describe('course lesson secret-door, played', () => {
  const RIGHT = ['ArrowRight'];

  it('without the wiring the door keeps the player in the room', () => {
    const s = session('secret-door');
    const hero = s.nodeOf('character');
    const { view, world } = simulate(s.state.getGraph(), 60 * 6, () => RIGHT);
    expect(view(hero).position.x).toBeLessThan(-6);
    expect(world.ended).toBeNull();
  });

  it('the door opens at the start, slams shut behind the player, and touching the flag wins', () => {
    const s = session('secret-door');
    const { door, hero } = solveSecretDoor(s);
    const graph = s.state.getGraph();
    let openedAtStart = false;
    let slammed = false;
    const sim = simulate(graph, 60 * 12, (t, view) => {
      if (t === 5 && !view(door).visible) openedAtStart = true;
      if (view(hero).position.x > 1 && view(door).visible) slammed = true;
      return RIGHT;
    });
    expect(openedAtStart).toBe(true);
    expect(slammed).toBe(true);
    expect(sim.world.ended?.result).toBe('win');
  });
});

describe('course lesson chase-game, played', () => {
  it('the red bot catches a player who stands still (lose)', () => {
    const s = session('chase-game');
    solveChaseGame(s);
    const sim = simulate(s.state.getGraph(), 60 * 15, () => []);
    expect(sim.world.ended?.result).toBe('lose');
  });

  it('the green bot runs away, the red bot trails behind, and the player catches the green one (win)', () => {
    const s = session('chase-game');
    const { chaser, runner, hero } = solveChaseGame(s);
    let runnerMoved = 0;
    const sim = simulate(s.state.getGraph(), 60 * 30, (t, view) => {
      if (t === 0) runnerMoved = view(runner).position.x;
      return view(hero).position.x < view(runner).position.x ? ['ArrowRight'] : ['ArrowLeft'];
    });
    expect(sim.view(runner).position.x).toBeGreaterThan(runnerMoved + 2);
    expect(sim.view(chaser).position.x).toBeLessThan(sim.view(hero).position.x);
    expect(sim.world.ended?.result).toBe('win');
  });

  it('without the brains the bots never move and nothing ends', () => {
    const s = session('chase-game');
    const sim = simulate(s.state.getGraph(), 60 * 5, () => []);
    expect(sim.world.ended).toBeNull();
  });
});

describe('course lesson collider-gravity, played', () => {
  /** Walk to the crate, pick it up, carry it under the pad, jump and let go at the top. */
  function carryUp(hero: string) {
    let grabbed = false;
    let dropped = false;
    let step = 0;
    return (t: number, view: (owner: string) => { position: { x: number; y: number } }): string[] => {
      const h = view(hero).position;
      if (step === 0) {
        if (h.x < -4.6) return ['ArrowRight'];
        step = 1;
        grabbed = true;
        return ['KeyG'];
      }
      if (step === 1) {
        if (h.x < 2.4) return ['ArrowRight'];
        step = 2;
      }
      if (step === 2) {
        if (h.y > 5.5 && !dropped) {
          dropped = true;
          step = 3;
          return ['Space', 'KeyG'];
        }
        return ['Space'];
      }
      void t;
      void grabbed;
      return [];
    };
  }

  it('with the intended edits the crate floats up, fits the pad and wins', () => {
    const s = session('collider-gravity');
    const { hero } = solveColliderGravity(s);
    const sim = simulate(s.state.getGraph(), 60 * 20, carryUp(hero));
    expect(sim.world.ended?.result).toBe('win');
  });

  it('with the default hero gravity the jump is too low to reach the pad', () => {
    const s = session('collider-gravity');
    const hero = s.nodeOf('character');
    const crate = s.nodeOf('item');
    const pad = s.nodeOf('block', (q) => q.type === 'pickup');
    const end = s.nodeOf('win-lose');
    const touch = s.add('touch');
    s.wire(p(crate, 'self'), p(touch, 'a'));
    s.wire(p(pad, 'self'), p(touch, 'b'));
    s.wire(p(touch, 'touching'), p(end, 'win'));
    s.set(touch, 'mode', 'inside');
    s.set(touch, 'hold', 0.5);
    let top = 0;
    const drive = carryUp(hero);
    const sim = simulate(s.state.getGraph(), 60 * 12, (t, view) => {
      top = Math.max(top, view(hero).position.y);
      return drive(t, view);
    });
    expect(top).toBeLessThan(3.5);
    expect(sim.world.ended).toBeNull();
  });

  /** The finished board with one of the three advanced settings put back to its default. */
  function withoutSetting(reset: (s: Session, ids: { hero: string; crate: string }) => void) {
    const s = session('collider-gravity');
    const ids = solveColliderGravity(s);
    s.play(false);
    reset(s, ids);
    return simulate(s.state.getGraph(), 60 * 12, carryUp(ids.hero));
  }

  it('a crate left at its full size does not fit the pad', () => {
    const sim = withoutSetting((s, { crate }) => s.set(crate, 'colliderSize', { x: 0, y: 0, z: 0 }));
    expect(sim.world.ended).toBeNull();
  });

  it('a crate that is not floating falls out of the pad and does not win', () => {
    const sim = withoutSetting((s, { crate }) => s.set(crate, 'gravityScale', 1));
    expect(sim.world.ended).toBeNull();
  });

  it('a hero with normal gravity cannot jump up to the pad', () => {
    const sim = withoutSetting((s, { hero }) => s.set(hero, 'gravityScale', 1));
    expect(sim.world.ended).toBeNull();
  });
});

describe('course lesson conveyor, played', () => {
  it('on the plain platform the crates stay put and nothing ends', () => {
    const s = session('conveyor');
    const sim = simulate(s.state.getGraph(), 60 * 8, () => []);
    expect(sim.world.ended).toBeNull();
  });

  it('the finished belt carries three green crates to the bin and wins', () => {
    const s = session('conveyor');
    solveConveyor(s);
    const sim = simulate(s.state.getGraph(), 60 * 30, () => []);
    expect(sim.world.ended?.result).toBe('win');
  });

  it('the red crate is not counted: with only two green crates the game does not end', () => {
    const s = session('conveyor');
    const { bin } = solveConveyor(s);
    s.play(false);
    s.set(bin, 'minCount', 4);
    const sim = simulate(s.state.getGraph(), 60 * 30, () => []);
    expect(sim.world.ended).toBeNull();
  });

  it('holding the reverse key sends the crates back to the right', () => {
    const s = session('conveyor');
    solveConveyor(s);
    const key = s.nodeOf('key');
    s.play(false);
    s.set(key, 'key', 'KeyR');
    const crate = s.nodeOf('item', (q) => q.tag === 'xanh');
    const sim = simulate(s.state.getGraph(), 60 * 3, () => ['KeyR']);
    expect(sim.view(crate).position.x).toBeGreaterThan(1);
  });
});
