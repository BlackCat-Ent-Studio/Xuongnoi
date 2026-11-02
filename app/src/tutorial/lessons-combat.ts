import { createNode } from '../editor/editor-state';
import type { Board, Graph, Params } from '../engine/types';
import { addWire } from '../engine/wiring';
import { type Endpoint, type NodeFilter, hasWire, nodesOfKind, paramOf } from './graph-checks';
import type { Lesson, Snapshot, Step, TargetList } from './types';

/**
 * Lesson 8: health and fighting. The board already has a player who can punch and swing a sword, and a red
 * bot that stands still. The learner gives the bot health, wins by beating it, then teaches it to fight back.
 */

// ---------- Vietnamese text ----------

const T = {
  title: '9. Đánh địch',
  summary: 'Cho bot có máu, đánh bại nó, rồi dạy nó đánh lại bạn.',
  boardName: 'Bài 9 - Đánh địch',
  intro: {
    title: 'Đánh nhau trong game',
    text: 'Bảng này có sẵn bạn (xanh), một con bot đỏ đứng im, một thanh kiếm dưới sàn, và mảnh ghép Máu của bạn. Ta sẽ cho bot có máu để bạn đánh bại nó.',
    explain: 'Nhân vật chỉ bị đau khi có mảnh ghép "Máu". Không có mảnh ghép này thì đánh vào cũng không sao.',
  },
  addHealth: {
    title: 'Thêm mảnh ghép Máu cho bot',
    text: 'Kéo thêm một mảnh ghép "Máu" (nhóm Hành động) vào bảng.',
    explain: 'Mảnh ghép Máu cho nhân vật một thanh máu trên đầu. Mỗi cú đánh làm mất máu, và nhân vật bị đẩy lùi, nháy đỏ.',
  },
  wireSelf: {
    title: 'Nói mảnh ghép Máu của ai',
    text: 'Nối cổng "Nhân vật" của con bot đỏ sang cổng "Nhân vật" của mảnh ghép Máu mới.',
  },
  wireWin: {
    title: 'Hết máu là thắng',
    text: 'Nối cổng "Hết máu" của mảnh ghép Máu mới sang cổng "Thắng" của mảnh ghép Thắng / Thua.',
    explain: 'Khi máu về 0, nhân vật ngã xuống rồi biến mất, và cổng "Hết máu" bật lên.',
  },
  playWin: {
    title: 'Đánh bại bot',
    text: 'Bấm "Chơi". Đi sang phải (mũi tên). Bấm F để đấm; bấm E gần thanh kiếm để cầm nó, kiếm đánh đau hơn tay không.',
  },
  won: {
    title: 'Bot gục rồi!',
    text: 'Máu của bot về 0 nên bạn thắng.',
    explain: 'Tay không mất 1 máu mỗi đòn. Kiếm mất 3, búa và cuốc mất 2. Đồ vật có ô "Sát thương" để tự đặt.',
  },
  edit: {
    title: 'Quay lại sửa',
    text: 'Bấm nút "Dừng". Giờ ta dạy bot đánh lại.',
  },
  addFight: {
    title: 'Thêm bộ não đánh nhau',
    text: 'Kéo mảnh ghép "Đánh địch" (nhóm Bộ não) vào bảng.',
    explain: 'Bot tự tìm đường tới mục tiêu và ra đòn khi đủ gần. Đánh xong nó lùi lại một chút rồi vào tiếp.',
  },
  wireBot: {
    title: 'Bộ não điều khiển bot',
    text: 'Nối cổng "Nhân vật" của bot đỏ sang cổng "Bot" của mảnh ghép Đánh địch.',
  },
  wireTarget: {
    title: 'Mục tiêu là bạn',
    text: 'Nối cổng "Nhân vật" của nhân vật xanh (bạn) sang cổng "Mục tiêu" của mảnh ghép Đánh địch.',
  },
  wireMove: {
    title: 'Nối hướng đi',
    text: 'Nối cổng "Đi ngang" của mảnh ghép Đánh địch sang cổng "Đi ngang" của bot đỏ.',
  },
  wireAttack: {
    title: 'Nối cú đánh',
    text: 'Nối cổng "Ra đòn" của mảnh ghép Đánh địch sang cổng "Dùng" của mảnh ghép Cầm dụng cụ còn trống (của bot).',
    explain: 'Cổng "Ra đòn" bật lên một nhịp khi bot đủ gần. Mảnh ghép Cầm dụng cụ biến nhịp đó thành cú vung tay.',
  },
  playFight: {
    title: 'Đánh thử với bot',
    text: 'Bấm "Chơi". Lần này bot sẽ lao vào đánh bạn! Nhìn thanh máu trên đầu, đánh bại nó trước khi bạn gục.',
  },
  result: {
    title: 'Có người gục rồi',
    text: 'Ai hết máu trước thì ván đấu kết thúc.',
    explain: 'Muốn hồi máu thì dùng cổng "Hồi máu" của mảnh ghép Máu, nối với một nút bấm hoặc một vật nhặt được.',
  },
  done: {
    title: 'Bạn đã biết đánh nhau!',
    text: 'Bạn đã biết mảnh ghép Máu, đòn đánh bằng tay hoặc dụng cụ, và bộ não Đánh địch cho bot. Thử mở game mẫu "Võ đài".',
  },
} as const;

// ---------- helpers ----------

const paletteSel = (kind: string): string => `.palette-item[data-kind="${kind}"]`;
const PLAY_BTN = '[data-tut="play"]';

function portSel(graph: Graph, ep: Endpoint, dir: 'in' | 'out'): string | null {
  const n = nodesOfKind(graph, ep.kind, ep.where)[0];
  return n ? `.wc-port[data-node="${n.id}"][data-port="${ep.port}"][data-dir="${dir}"]` : null;
}

function wireTarget(snap: Snapshot, from: Endpoint, to: Endpoint): TargetList {
  return [portSel(snap.graph, from, 'out'), portSel(snap.graph, to, 'in')].filter((s): s is string => s !== null);
}

function addStep(id: string, kind: string, count = 1): Pick<Step, 'id' | 'target' | 'check'> {
  return {
    id,
    target: () => [paletteSel(kind)],
    check: (s) => nodesOfKind(s.graph, kind).length >= count,
  };
}

function wireStep(id: string, from: Endpoint, to: Endpoint): Pick<Step, 'id' | 'target' | 'check'> {
  return { id, target: (s) => wireTarget(s, from, to), check: (s) => hasWire(s.graph, from, to) };
}

type NodeSpec = { alias: string; kind: string; x: number; y: number; params?: Params };
type WireSpec = [fromAlias: string, fromPort: string, toAlias: string, toPort: string];

function buildBoard(name: string, nodes: NodeSpec[], wires: WireSpec[]): Board {
  let graph: Graph = { nodes: [], wires: [] };
  const ids = new Map<string, string>();
  for (const spec of nodes) {
    const node = createNode(graph, spec.kind, { x: spec.x, y: spec.y });
    if (!node) throw new Error(`Unknown node kind in lesson board: ${spec.kind}`);
    node.params = { ...node.params, ...spec.params };
    ids.set(spec.alias, node.id);
    graph = { ...graph, nodes: [...graph.nodes, node] };
  }
  for (const [fa, fp, ta, tp] of wires) {
    const from = ids.get(fa);
    const to = ids.get(ta);
    if (!from || !to) throw new Error(`Unknown alias in lesson wire: ${fa} -> ${ta}`);
    const res = addWire(graph, { node: from, port: fp }, { node: to, port: tp });
    if (!('nodes' in res)) throw new Error(`Cannot wire ${fa}.${fp} -> ${ta}.${tp}: ${res.reason}`);
    graph = res;
  }
  return { name, mode: '2d-side', graph };
}

// ---------- board ----------

const isBot: NodeFilter = (n) => paramOf(n, 'role') === 'bot';
const isPlayer: NodeFilter = (n) => !isBot(n);

const NODES: NodeSpec[] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'jump', kind: 'key', x: 20, y: 190, params: { key: 'Space' } },
  { alias: 'equip', kind: 'key', x: 20, y: 330, params: { key: 'KeyE' } },
  { alias: 'use', kind: 'key', x: 20, y: 470, params: { key: 'KeyF' } },
  { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: -6, y: 1, z: 0 } } },
  { alias: 'hand', kind: 'hand-tool', x: 560, y: 20 },
  { alias: 'hp', kind: 'health', x: 820, y: 20 },
  { alias: 'end', kind: 'win-lose', x: 1080, y: 20, params: { winMessage: 'Bạn hạ được bot rồi!', loseMessage: 'Bạn gục mất rồi!' } },
  {
    alias: 'bot',
    kind: 'character',
    x: 300,
    y: 330,
    params: { position: { x: 1, y: 1, z: 0 }, color: '#ef4444', look: 'robot', role: 'bot', speed: 3.5 },
  },
  { alias: 'botHand', kind: 'hand-tool', x: 560, y: 330 },
  { alias: 'floor', kind: 'block', x: 300, y: 620, params: { size: { x: 24, y: 1, z: 1 }, position: { x: 0, y: -0.5, z: 0 }, color: '#65a30d' } },
  {
    alias: 'sword',
    kind: 'item',
    x: 560,
    y: 620,
    params: {
      position: { x: -4, y: 0.4, z: 0 },
      size: { x: 0.8, y: 0.8, z: 0.8 },
      color: '#94a3b8',
      shape: 'sword',
      holdStyle: 'hand',
    },
  },
];

const WIRES: WireSpec[] = [
  ['stick', 'x', 'hero', 'moveX'],
  ['jump', 'held', 'hero', 'jump'],
  ['hero', 'self', 'hand', 'character'],
  ['equip', 'held', 'hand', 'toggle'],
  ['use', 'held', 'hand', 'use'],
  ['hero', 'self', 'hp', 'self'],
  ['hp', 'dead', 'end', 'lose'],
  ['bot', 'self', 'botHand', 'character'],
];

const BOT_SELF: Endpoint = { kind: 'character', port: 'self', where: isBot };
const PLAYER_SELF: Endpoint = { kind: 'character', port: 'self', where: isPlayer };
const BOT_MOVE_X: Endpoint = { kind: 'character', port: 'moveX', where: isBot };
const HEALTH_SELF: Endpoint = { kind: 'health', port: 'self' };
const HEALTH_DEAD: Endpoint = { kind: 'health', port: 'dead' };
const WIN_IN: Endpoint = { kind: 'win-lose', port: 'win' };
const FIGHT_SELF: Endpoint = { kind: 'fight', port: 'self' };
const FIGHT_TARGET: Endpoint = { kind: 'fight', port: 'target' };
const FIGHT_MOVE_X: Endpoint = { kind: 'fight', port: 'moveX' };
const FIGHT_ATTACK: Endpoint = { kind: 'fight', port: 'attack' };
const TOOL_USE: Endpoint = { kind: 'hand-tool', port: 'use' };

export const combatLesson: Lesson = {
  id: 'combat',
  title: T.title,
  summary: T.summary,
  createBoard: () => buildBoard(T.boardName, NODES, WIRES),
  steps: [
    { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
    { ...addStep('add-health', 'health', 2), title: T.addHealth.title, text: T.addHealth.text, explain: T.addHealth.explain },
    { ...wireStep('wire-health-self', BOT_SELF, HEALTH_SELF), title: T.wireSelf.title, text: T.wireSelf.text },
    {
      ...wireStep('wire-win', HEALTH_DEAD, WIN_IN),
      title: T.wireWin.title,
      text: T.wireWin.text,
      explain: T.wireWin.explain,
    },
    {
      id: 'play-win',
      title: T.playWin.title,
      text: T.playWin.text,
      target: () => [PLAY_BTN],
      check: (s) => s.playing,
    },
    { id: 'won', title: T.won.title, text: T.won.text, explain: T.won.explain, check: (s) => s.ended === 'win' },
    {
      id: 'back-to-edit',
      title: T.edit.title,
      text: T.edit.text,
      target: () => [PLAY_BTN],
      check: (s) => !s.playing,
    },
    { ...addStep('add-fight', 'fight'), title: T.addFight.title, text: T.addFight.text, explain: T.addFight.explain },
    { ...wireStep('wire-fight-bot', BOT_SELF, FIGHT_SELF), title: T.wireBot.title, text: T.wireBot.text },
    { ...wireStep('wire-fight-target', PLAYER_SELF, FIGHT_TARGET), title: T.wireTarget.title, text: T.wireTarget.text },
    { ...wireStep('wire-fight-move', FIGHT_MOVE_X, BOT_MOVE_X), title: T.wireMove.title, text: T.wireMove.text },
    {
      ...wireStep('wire-fight-attack', FIGHT_ATTACK, TOOL_USE),
      title: T.wireAttack.title,
      text: T.wireAttack.text,
      explain: T.wireAttack.explain,
    },
    {
      id: 'play-fight',
      title: T.playFight.title,
      text: T.playFight.text,
      target: () => [PLAY_BTN],
      check: (s) => s.playing,
    },
    { id: 'result', title: T.result.title, text: T.result.text, explain: T.result.explain, check: (s) => s.ended !== null },
    { id: 'done', title: T.done.title, text: T.done.text },
  ],
};
