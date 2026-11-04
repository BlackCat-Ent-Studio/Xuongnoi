import type { Graph, GraphNode, Params } from '../engine/types';
import type { LessonKit } from './lessons-vehicles';
import { GROUPS_TEXT as T } from './text-vi-course-d';
import type { Lesson, Snapshot, TargetList } from './types';

/**
 * "Gom nhóm mảnh ghép": group nodes (Ctrl+G), rename, enter and leave a group, duplicate it, then a word on the game
 * library. Checks read editor state only (graph.groups, the selection, the entered group), so a shortcut, a button or
 * a double-click all count.
 */

type NodeSpec = { alias: string; kind: string; x: number; y: number; params?: Params };
type WireSpec = [fromAlias: string, fromPort: string, toAlias: string, toPort: string];

const botParams = (x: number, color: string): Params => ({ position: { x, y: 1, z: 0 }, color, look: 'robot', role: 'bot' });
const goParams = (x: number): Params => ({ targetPos: { x, y: 1, z: 0 }, stopDistance: 0.5 });

/** Two identical little setups (a bot and its "Di chuyển" brick) lying apart on the board, plus a floor. */
const NODES: NodeSpec[] = [
  { alias: 'floor', kind: 'block', x: 300, y: 560, params: { size: { x: 24, y: 1, z: 1 }, color: '#65a30d' } },
  { alias: 'bot-a', kind: 'character', x: 40, y: 20, params: botParams(-8, '#f59e0b') },
  { alias: 'go-a', kind: 'go-to', x: 300, y: 20, params: goParams(-3) },
  { alias: 'bot-b', kind: 'character', x: 40, y: 300, params: botParams(2, '#38bdf8') },
  { alias: 'go-b', kind: 'go-to', x: 300, y: 300, params: goParams(8) },
];
const WIRES: WireSpec[] = [
  ['bot-a', 'self', 'go-a', 'self'],
  ['go-a', 'moveX', 'bot-a', 'moveX'],
  ['bot-b', 'self', 'go-b', 'self'],
  ['go-b', 'moveX', 'bot-b', 'moveX'],
];

const DEFAULT_GROUP_NAME = /^Nhóm \d+$/;
const PAIR_SIZE = 2;

const groupsOf = (s: Snapshot): NonNullable<Graph['groups']> => s.graph.groups ?? [];
const kindOf = (s: Snapshot, id: string): string | undefined => s.graph.nodes.find((n) => n.id === id)?.kind;
const firstOf = (s: Snapshot, kind: string): GraphNode | undefined => s.graph.nodes.find((n) => n.kind === kind);
const groupBox = (id: string): string => `.wc-group[data-id="${id}"]`;

/** Exactly one bot and one "Di chuyển" brick are selected. */
function pairSelected(s: Snapshot): boolean {
  const ids = s.selectedIds ?? [];
  if (ids.length !== PAIR_SIZE) return false;
  const kinds = ids.map((id) => kindOf(s, id)).sort();
  return kinds[0] === 'character' && kinds[1] === 'go-to';
}

function pairTarget(s: Snapshot): TargetList {
  return [firstOf(s, 'character'), firstOf(s, 'go-to')].filter((n): n is GraphNode => n !== undefined).map((n) => `.wc-node[data-id="${n.id}"]`);
}

function groupTarget(s: Snapshot): TargetList {
  const g = groupsOf(s)[0];
  return g ? [groupBox(g.id)] : [];
}

/** The one group the learner made, once it carries a name of their own. */
const renamed = (s: Snapshot): boolean => groupsOf(s).some((g) => g.name.trim() !== '' && !DEFAULT_GROUP_NAME.test(g.name));

const insideGroup = (s: Snapshot): boolean => (s.scope ?? null) !== null;

function groupOnlySelected(s: Snapshot): boolean {
  const ids = s.selectedIds ?? [];
  return (s.scope ?? null) === null && ids.length === 1 && groupsOf(s).some((g) => g.id === ids[0]);
}

export function createGroupsLesson(kit: Pick<LessonKit, 'buildBoard'>): Lesson {
  return {
    id: 'groups',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { id: 'select-pair', title: T.select.title, text: T.select.text, explain: T.select.explain, target: pairTarget, check: pairSelected },
      {
        id: 'make-group',
        title: T.group.title,
        text: T.group.text,
        explain: T.group.explain,
        target: pairTarget,
        check: (s) => groupsOf(s).length >= 1,
      },
      {
        id: 'rename-group',
        title: T.rename.title,
        text: T.rename.text,
        explain: T.rename.explain,
        target: (s) => {
          const g = groupsOf(s)[0];
          return g ? [['.pn-group-name', groupBox(g.id)]] : [];
        },
        check: renamed,
      },
      { id: 'enter-group', title: T.enter.title, text: T.enter.text, explain: T.enter.explain, target: groupTarget, check: insideGroup },
      { id: 'exit-group', title: T.exit.title, text: T.exit.text, check: (s) => !insideGroup(s) && groupsOf(s).length >= 1 },
      { id: 'select-group', title: T.select2.title, text: T.select2.text, target: groupTarget, check: groupOnlySelected },
      {
        id: 'duplicate-group',
        title: T.duplicate.title,
        text: T.duplicate.text,
        explain: T.duplicate.explain,
        check: (s) => groupsOf(s).length >= 2,
      },
      { id: 'library', title: T.library.title, text: T.library.text, explain: T.library.explain },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
