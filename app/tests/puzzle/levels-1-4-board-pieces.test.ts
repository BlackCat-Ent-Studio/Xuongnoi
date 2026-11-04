import { describe, expect, it } from 'vitest';
import { clearRegistry, getNodeDef } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { level01 } from '../../src/puzzle/levels/level-01';
import { level02 } from '../../src/puzzle/levels/level-02';
import { level03 } from '../../src/puzzle/levels/level-03';
import { level04 } from '../../src/puzzle/levels/level-04';
import { buildPlayGraph } from '../../src/puzzle/run-level';
import { isSceneryNode } from '../../src/puzzle/ui/board-state';
import type { PuzzleLevel } from '../../src/puzzle/types';
import { puzzleWorldOptions } from '../../src/puzzle/world-options';
import { createWorld } from '../../src/world/world';

/**
 * Levels 1 to 4: the board shows only the characters and objects. Every behaviour (walking, noticing, remembering,
 * counting, choosing) comes from tray pieces the player wires; the level only hides its scenery and the win rule.
 */

const BOARD: { level: PuzzleLevel; visible: string[]; hidden: string[] }[] = [
  { level: level01!, visible: ['bot', 'flag'], hidden: ['end', 'ground', 'touch-flag'] },
  { level: level02!, visible: ['bot', 'button', 'door', 'flag'], hidden: ['end', 'ground', 'touch-flag'] },
  {
    level: level03!,
    visible: ['cat', 'gate', 'star-1', 'star-2', 'star-3'],
    hidden: ['end', 'goal', 'ground', 'touch-goal'],
  },
  {
    level: level04!,
    visible: ['bot-a', 'bot-b', 'button-a', 'button-b', 'door', 'flag'],
    hidden: ['both', 'end', 'ground', 'touch-a-flag', 'touch-b-button'],
  },
];

/** Pieces that hold the logic of a bot or a door: none may sit in a level's locked part. */
const LOGIC_KINDS = [
  'go-to', 'route-follow', 'sequence', 'latch', 'counter', 'compare', 'const', 'math', 'or', 'not', 'timer',
  'patrol', 'chase', 'carry', 'zone', 'distance', 'color-sensor', 'next-free-slot', 'select-number', 'key', 'stick',
];
/** Kinds the locked part may use, all of them scenery. */
const SCENERY_KINDS = ['block', 'touch', 'and', 'win-lose'];

describe.each(BOARD.map((b) => [b.level.order, b] as const))('level %i is made of editor pieces only', (_order, { level }) => {
  const allKinds = (): string[] => [...new Set([...level.base.nodes, ...level.solution.nodes].map((n) => n.kind).concat(level.tray.map((t) => t.kind)))];

  it('every node kind of the level is registered by the editor registry alone', () => {
    clearRegistry();
    registerAllNodes();
    for (const kind of allKinds()) expect(getNodeDef(kind), `${kind} is an editor piece`).toBeDefined();
  });

  it('the board builds and plays with only the editor pieces registered (no puzzle-only nodes)', () => {
    clearRegistry();
    registerAllNodes();
    const world = createWorld(level.mode, puzzleWorldOptions(level.mode));
    const rt = createRuntime(buildPlayGraph(level, level.solution), world, level.mode);
    for (let i = 0; i < 600; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    expect(world.listEntities().some((e) => e.kind === 'character')).toBe(true);
  });
});

describe.each(BOARD.map((b) => [b.level.order, b] as const))('level %i shows only characters and objects', (_order, { level, visible, hidden }) => {
  registerAllNodes();
  const visibleNodes = level.base.nodes.filter((n) => !isSceneryNode(level, n.id));

  it('the visible cards are exactly the characters and objects of the story', () => {
    expect(visibleNodes.map((n) => n.id).sort()).toEqual([...visible].sort());
    for (const n of visibleNodes) expect(['character', 'block'], `${n.id} is a character or an object`).toContain(n.kind);
  });

  it('only scenery is hidden: the ground, sensors for the win rule and the win/lose node', () => {
    const hiddenNodes = level.base.nodes.filter((n) => isSceneryNode(level, n.id));
    expect(hiddenNodes.map((n) => n.id).sort()).toEqual([...hidden].sort());
    for (const n of hiddenNodes) {
      if (n.kind === 'block') expect(['ground', 'goal']).toContain(n.id);
      else expect(SCENERY_KINDS).toContain(n.kind);
    }
  });

  it('the locked part holds no logic piece: nothing walks, counts, remembers or chooses on its own', () => {
    for (const n of level.base.nodes) expect(LOGIC_KINDS, `${n.id} (${n.kind})`).not.toContain(n.kind);
  });

  it('no locked wire drives a character or the door: those are the player\'s to wire', () => {
    const driven = level.base.wires.filter((w) => {
      const to = level.base.nodes.find((n) => n.id === w.to.node)!;
      return to.kind === 'character' || w.to.port === 'hiddenWhile';
    });
    expect(driven).toEqual([]);
  });

  it('locked wires only link objects to hidden sensors, hidden sensors to each other, or the star pick-up effect', () => {
    const isHidden = (id: string) => hidden.includes(id);
    for (const w of level.base.wires) {
      const ok = isHidden(w.to.node) || (w.to.port === 'hide' && isHidden(w.from.node));
      expect(ok, `${w.id} ends on a visible card`).toBe(true);
    }
  });

  it('the cards show exactly the ports the player wires, plus the object itself', () => {
    for (const n of visibleNodes) {
      const sp = level.shownPorts![n.id]!;
      const wiredIn = new Set(level.solution.wires.filter((w) => w.to.node === n.id).map((w) => w.to.port));
      const wiredOut = new Set(level.solution.wires.filter((w) => w.from.node === n.id).map((w) => w.from.port));
      expect([...(sp.in ?? [])].sort(), `${n.id} inputs`).toEqual([...wiredIn].sort());
      // Every character and object offers itself ("self"); the stars of level 3 are only there to look at.
      const outs = new Set([...wiredOut, ...(n.kind === 'block' && n.id.startsWith('star-') ? ['self'] : [])]);
      expect([...(sp.out ?? [])].sort(), `${n.id} outputs`).toEqual([...outs].sort());
    }
  });
});
