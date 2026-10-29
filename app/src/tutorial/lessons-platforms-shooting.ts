import { createNode } from '../editor/editor-state';
import type { Board, Graph, GraphNode, Params } from '../engine/types';
import { addWire } from '../engine/wiring';
import { type Endpoint, type NodeFilter, hasWire, nodesOfKind, numParam, paramOf, vecParam } from './graph-checks';
import type { Lesson, Snapshot, Step, TargetList } from './types';

/**
 * Lesson 12: platforms and shooting. The board has two grassy banks with a pit between them, a red target with
 * a health bar on the far bank and a flag behind it. The learner bridges the pit with a moving platform, shoots
 * the target, drops rocks with a timer as a light hazard and finally builds a rotating gate that turns away once
 * the target is down.
 */

// ---------- Vietnamese text ----------

const T = {
  title: '12. Bệ và bắn đạn',
  summary: 'Bắc bệ di chuyển qua hố, bắn hạ mục tiêu, thả đá bằng hẹn giờ và mở cổng xoay.',
  boardName: 'Bài 12 - Bệ và bắn đạn',
  intro: {
    title: 'Qua hố, hạ mục tiêu, tới cờ',
    text: 'Bảng này có hai bờ cỏ với một cái hố ở giữa, một mục tiêu đỏ có thanh máu bên bờ phải, và lá cờ vàng phía sau. Bạn sẽ bắc cầu, bắn mục tiêu rồi mở đường tới cờ.',
    explain: 'Rơi xuống hố là thua. Phím J đã có sẵn trên bảng để dành cho việc bắn.',
  },
  addPlatform: {
    title: 'Thêm bệ di chuyển',
    text: 'Kéo khối "Bệ di chuyển" (nhóm Vật thể) vào bảng.',
    explain: 'Bệ tự chạy từ điểm A tới điểm B rồi quay lại. Ai đứng trên bệ sẽ đi theo bệ.',
  },
  platformA: {
    title: 'Đặt điểm A bên bờ trái',
    text: 'Chọn Bệ di chuyển, sửa "Điểm A (xuất phát)" thành x = -2, y = -0.25, z = 0.',
    explain: 'Bệ rộng 3 khối nên đặt ở -2 thì mép bệ chạm sát bờ trái, bước lên rất dễ.',
  },
  platformB: {
    title: 'Đặt điểm B bên bờ phải',
    text: 'Sửa "Điểm B" thành x = 2, y = -0.25, z = 0.',
    explain: 'Giữ y bằng nhau ở hai điểm để bệ chạy ngang, không lên xuống.',
  },
  playRide: {
    title: 'Đi nhờ bệ',
    text: 'Bấm "Chơi". Đi sang phải (mũi tên), đợi bệ vào sát bờ rồi bước lên. Đứng yên trên bệ, nó sẽ đưa bạn sang bờ bên kia.',
  },
  back1: {
    title: 'Quay lại sửa',
    text: 'Bấm nút "Sửa" để làm tiếp.',
  },
  addShooter: {
    title: 'Thêm khối Bắn đạn',
    text: 'Kéo khối "Bắn đạn" (nhóm Hành động) vào bảng.',
    explain: 'Mỗi lần "Bắn" bật, người bắn phóng ra một viên đạn theo hướng đang nhìn. Đạn trúng nhân vật có khối Máu thì làm mất máu.',
  },
  wireShooter: {
    title: 'Ai là người bắn?',
    text: 'Nối cổng "Nhân vật" của nhân vật xanh (bạn) sang cổng "Người bắn" của khối Bắn đạn.',
  },
  wireFire: {
    title: 'Bấm J để bắn',
    text: 'Nối cổng "Đang giữ" của khối Phím bấm (phím J, đặt sẵn trên bảng) sang cổng "Bắn" của khối Bắn đạn.',
    explain: 'Muốn đổi phím khác, chọn khối Phím bấm rồi đổi ô "Phím".',
  },
  playShoot: {
    title: 'Bắn mục tiêu',
    text: 'Bấm "Chơi". Qua hố bằng bệ, đứng trên bờ phải, quay mặt về phía mục tiêu rồi bấm J ba lần. Đừng chạy tới cờ vội, còn bước mở cổng nữa.',
  },
  hitTarget: {
    title: 'Bắn đủ ba phát',
    text: 'Mục tiêu có 3 máu, mỗi viên đạn mất 1. Khi nó ngã xuống, bấm "Sửa" để làm tiếp.',
    explain: 'Muốn đạn mạnh hơn hay bay xa hơn, chỉnh "Sát thương" và "Bay bao lâu" trong khối Bắn đạn.',
  },
  addSpawner: {
    title: 'Thêm khối Sinh vật thể',
    text: 'Kéo khối "Sinh vật thể" (nhóm Hành động) vào bảng.',
    explain: 'Mỗi lần "Sinh ra" bật, nó tạo thêm một đồ vật (ở đây là hòn đá). Mỗi hòn chỉ tồn tại một lúc rồi biến mất.',
  },
  spawnerSetup: {
    title: 'Cho đá rơi trên đường tới cổng',
    text: 'Chọn khối Sinh vật thể: sửa "Vị trí" thành x = 10.5, y = 6, z = 0 (rơi từ trên cao xuống) và "Sống bao lâu" thành 1.',
    explain: 'Hòn đá có sẵn dáng tròn. Ai chạm vào đá khi nó đang rơi thì thua.',
  },
  wireToucher: {
    title: 'Ai bị đá làm hại?',
    text: 'Nối cổng "Nhân vật" của nhân vật xanh (bạn) sang cổng "Ai chạm" của khối Sinh vật thể.',
  },
  wireLose: {
    title: 'Chạm đá là thua',
    text: 'Nối cổng "Đang chạm" của khối Sinh vật thể sang cổng còn trống của khối Hoặc (cổng B).',
    explain: 'Khối Hoặc đã có sẵn: rơi xuống hố hoặc chạm đá, một trong hai là thua.',
  },
  addTimer: {
    title: 'Thêm Hẹn giờ 3 giây',
    text: 'Kéo khối "Hẹn giờ" (nhóm Tính toán) vào bảng và đặt "Số giây" là 3.',
    explain: 'Hẹn giờ đếm ngược, hết giờ thì cổng "Hết giờ" bật.',
  },
  wireSpawn: {
    title: 'Hết giờ là thả đá',
    text: 'Nối cổng "Hết giờ" của Hẹn giờ sang cổng "Sinh ra" của khối Sinh vật thể.',
  },
  addLoopOr: {
    title: 'Thêm một khối Hoặc để lặp',
    text: 'Kéo thêm một khối "Hoặc" (nhóm Logic) vào bảng.',
    explain: 'Một khối không nối thẳng ra chính nó được, nên ta cho tín hiệu đi vòng qua khối Hoặc.',
  },
  wireLoopIn: {
    title: 'Hết giờ vào khối Hoặc mới',
    text: 'Nối cổng "Hết giờ" của Hẹn giờ sang cổng A của khối Hoặc bạn vừa thêm.',
  },
  wireLoopOut: {
    title: 'Đếm lại mãi mãi',
    text: 'Nối cổng "Kết quả" của khối Hoặc mới về cổng "Đếm lại" của Hẹn giờ.',
    explain: 'Cứ hết giờ là đếm lại từ đầu, nên cứ 3 giây lại có một hòn đá rơi.',
  },
  addRotating: {
    title: 'Thêm bệ xoay làm cổng',
    text: 'Kéo khối "Bệ xoay" (nhóm Vật thể) vào bảng.',
    explain: 'Kiểu "Xoay từng nấc 90°": khối rắn, mỗi lần "Xoay" bật nó quay một góc vuông. Một bức tường đứng khi quay nằm ngang sẽ chừa lối đi bên dưới.',
  },
  rotatingSetup: {
    title: 'Dựng cổng trước cờ',
    text: 'Chọn Bệ xoay: "Vị trí (tâm)" x = 13, y = 2, z = 0; "Kích thước" x = 0.5, y = 4, z = 1.',
    explain: 'Giờ nó là bức tường cao 4 khối chắn giữa mục tiêu và lá cờ.',
  },
  wireTurn: {
    title: 'Mục tiêu gục thì cổng xoay',
    text: 'Nối cổng "Hết máu" của khối Máu (của mục tiêu) sang cổng "Xoay" của Bệ xoay.',
  },
  playFinal: {
    title: 'Chơi cả ván',
    text: 'Bấm "Chơi". Qua hố bằng bệ, bắn mục tiêu ba phát, đợi cổng nằm ngang rồi chạy bên dưới tới lá cờ. Chạy ngay sau khi một hòn đá biến mất để khỏi bị đá rơi trúng.',
  },
  win: {
    title: 'Tới cờ rồi!',
    text: 'Bạn đã bắc cầu, bắn hạ mục tiêu, tránh đá và qua cổng. Nếu thua, bấm "Sửa" rồi "Chơi" thử lại.',
    explain: 'Bệ di chuyển, Bệ xoay, Bắn đạn và Sinh vật thể kết hợp lại là đủ làm một màn nhảy bắn hoàn chỉnh.',
  },
  done: {
    title: 'Bạn đã biết làm màn nhảy bắn!',
    text: 'Bạn đã dùng Bệ di chuyển, Bắn đạn, Sinh vật thể và Bệ xoay. Thử mở game mẫu "Né và bắn" để xem một màn tương tự.',
  },
} as const;

// ---------- helpers ----------

const paletteSel = (kind: string): string => `.palette-item[data-kind="${kind}"]`;
const paramSel = (id: string): string => `.prop-row[data-param="${id}"]`;
const PLAY_BTN = '[data-tut="play"]';

function portSel(graph: Graph, ep: Endpoint, dir: 'in' | 'out'): string | null {
  const n = nodesOfKind(graph, ep.kind, ep.where)[0];
  return n ? `.wc-port[data-node="${n.id}"][data-port="${ep.port}"][data-dir="${dir}"]` : null;
}

function wireTarget(snap: Snapshot, from: Endpoint, to: Endpoint): TargetList {
  return [portSel(snap.graph, from, 'out'), portSel(snap.graph, to, 'in')].filter((s): s is string => s !== null);
}

function addStep(id: string, kind: string): Pick<Step, 'id' | 'target' | 'check'> {
  return { id, target: () => [paletteSel(kind)], check: (s) => nodesOfKind(s.graph, kind).length >= 1 };
}

function wireStep(id: string, from: Endpoint, to: Endpoint): Pick<Step, 'id' | 'target' | 'check'> {
  return { id, target: (s) => wireTarget(s, from, to), check: (s) => hasWire(s.graph, from, to) };
}

/** Param-editing step: pulses the property rows (or the node itself until a node of that kind exists). */
function paramStep(id: string, kind: string, rows: string[], ok: (n: GraphNode) => boolean): Pick<Step, 'id' | 'target' | 'check'> {
  return {
    id,
    target: (s) => {
      const n = nodesOfKind(s.graph, kind)[0];
      return rows.map((r) => (n ? [paramSel(r), `.wc-node[data-id="${n.id}"]`] : paramSel(r)));
    },
    check: (s) => nodesOfKind(s.graph, kind).some(ok),
  };
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

const ground = (alias: string, y: number, cx: number, width: number): NodeSpec => ({
  alias,
  kind: 'block',
  x: 300,
  y,
  params: { type: 'solid', position: { x: cx, y: -0.5, z: 0 }, size: { x: width, y: 1, z: 1 }, color: '#65a30d' },
});

const wall = (alias: string, y: number, cx: number): NodeSpec => ({
  alias,
  kind: 'block',
  x: 560,
  y,
  params: { type: 'solid', position: { x: cx, y: 3, z: 0 }, size: { x: 1, y: 8, z: 1 }, color: '#475569' },
});

const NODES: NodeSpec[] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20, params: { scheme: 'arrows' } },
  { alias: 'jump', kind: 'key', x: 20, y: 190, params: { key: 'Space' } },
  { alias: 'fire', kind: 'key', x: 20, y: 330, params: { key: 'KeyJ' } },
  {
    alias: 'hero',
    kind: 'character',
    x: 300,
    y: 20,
    params: { position: { x: -10, y: 1, z: 0 }, speed: 5, jumpPower: 10, color: '#3b82f6', look: 'human', role: 'player' },
  },
  {
    alias: 'dummy',
    kind: 'character',
    x: 300,
    y: 330,
    params: { position: { x: 8, y: 1, z: 0 }, speed: 0, jumpPower: 0, color: '#ef4444', look: 'robot', role: 'bot' },
  },
  { alias: 'hp', kind: 'health', x: 560, y: 330, params: { maxHp: 3 } },
  { alias: 'showHp', kind: 'show-number', x: 820, y: 330, params: { label: 'Máu mục tiêu', corner: 'top-right' } },
  { alias: 'fallLine', kind: 'const', x: 300, y: 190, params: { value: -6 } },
  { alias: 'fallCheck', kind: 'compare', x: 560, y: 190, params: { op: 'lt' } },
  { alias: 'loseOr', kind: 'or', x: 820, y: 190 },
  { alias: 'reachFlag', kind: 'touch', x: 820, y: 20 },
  { alias: 'end', kind: 'win-lose', x: 1080, y: 100, params: { winMessage: 'Bạn tới cờ rồi!', loseMessage: 'Bạn rơi xuống hố hoặc bị đá rơi trúng!' } },
  {
    alias: 'flag',
    kind: 'block',
    x: 560,
    y: 20,
    params: { type: 'pickup', position: { x: 17, y: 1, z: 0 }, size: { x: 1, y: 2, z: 1 }, color: '#fde047' },
  },
  {
    alias: 'hint',
    kind: 'show-text',
    x: 820,
    y: 480,
    params: { text: 'Mũi tên: đi, Space: nhảy, J: bắn. Qua hố, hạ mục tiêu, tới lá cờ!', color: '#111827', corner: 'bottom-left' },
  },
  ground('bankLeft', 620, -8.5, 11),
  ground('bankRight', 760, 11, 16),
  wall('wallLeft', 900, -14.5),
  wall('wallRight', 1040, 19.5),
];

const WIRES: WireSpec[] = [
  ['stick', 'x', 'hero', 'moveX'],
  ['jump', 'held', 'hero', 'jump'],
  ['dummy', 'self', 'hp', 'self'],
  ['hp', 'hp', 'showHp', 'value'],
  ['hero', 'y', 'fallCheck', 'a'],
  ['fallLine', 'value', 'fallCheck', 'b'],
  ['fallCheck', 'out', 'loseOr', 'a'],
  ['loseOr', 'out', 'end', 'lose'],
  ['hero', 'self', 'reachFlag', 'a'],
  ['flag', 'self', 'reachFlag', 'b'],
  ['reachFlag', 'touching', 'end', 'win'],
];

const inRange = (v: number | undefined, lo: number, hi: number): boolean => v !== undefined && v >= lo && v <= hi;

const HERO_SELF: Endpoint = { kind: 'character', port: 'self', where: isPlayer };
const SHOOTER_WHO: Endpoint = { kind: 'shooter', port: 'shooter' };
const SHOOTER_FIRE: Endpoint = { kind: 'shooter', port: 'fire' };
const FIRE_KEY_HELD: Endpoint = { kind: 'key', port: 'held', where: (n) => paramOf(n, 'key') === 'KeyJ' };
const FIRE_KEY_PRESSED: Endpoint = { kind: 'key', port: 'pressed', where: (n) => paramOf(n, 'key') === 'KeyJ' };
const SPAWN_TOUCHER: Endpoint = { kind: 'spawner', port: 'toucher' };
const SPAWN_TOUCHED: Endpoint = { kind: 'spawner', port: 'touched' };
const SPAWN_IN: Endpoint = { kind: 'spawner', port: 'spawn' };
const OR_B: Endpoint = { kind: 'or', port: 'b' };
const TIMER_DONE: Endpoint = { kind: 'timer', port: 'done' };
const TIMER_RESET: Endpoint = { kind: 'timer', port: 'reset' };
const HEALTH_DEAD: Endpoint = { kind: 'health', port: 'dead' };
const ROTATE_TURN: Endpoint = { kind: 'rotating-platform', port: 'turn' };

/** The Hoặc brick the learner adds for the timer loop: the board's own one (fall or rock) comes first. */
const loopOr = (graph: Graph): GraphNode | undefined => nodesOfKind(graph, 'or').slice(1).pop();

/** Both ends of a bridge level with the banks (top at ground height), one near each bank. */
const levelY = (v: { y: number } | null): boolean => v !== null && inRange(v.y, -0.8, 0.3);

export const platformsShootingLesson: Lesson = {
  id: 'platforms-shooting',
  title: T.title,
  summary: T.summary,
  createBoard: () => buildBoard(T.boardName, NODES, WIRES),
  steps: [
    { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
    { ...addStep('add-platform', 'moving-platform'), title: T.addPlatform.title, text: T.addPlatform.text, explain: T.addPlatform.explain },
    {
      ...paramStep('platform-a', 'moving-platform', ['position'], (n) => {
        const a = vecParam(n, 'position');
        return a !== null && inRange(a.x, -3.5, -1) && levelY(a);
      }),
      title: T.platformA.title,
      text: T.platformA.text,
      explain: T.platformA.explain,
    },
    {
      ...paramStep('platform-b', 'moving-platform', ['to'], (n) => {
        const a = vecParam(n, 'position');
        const b = vecParam(n, 'to');
        return a !== null && inRange(a.x, -3.5, -1) && b !== null && inRange(b.x, 1, 3.5) && levelY(b);
      }),
      title: T.platformB.title,
      text: T.platformB.text,
      explain: T.platformB.explain,
    },
    { id: 'play-ride', title: T.playRide.title, text: T.playRide.text, target: () => [PLAY_BTN], check: (s) => s.playing },
    { id: 'back-1', title: T.back1.title, text: T.back1.text, target: () => [PLAY_BTN], check: (s) => !s.playing },
    { ...addStep('add-shooter', 'shooter'), title: T.addShooter.title, text: T.addShooter.text, explain: T.addShooter.explain },
    { ...wireStep('wire-shooter', HERO_SELF, SHOOTER_WHO), title: T.wireShooter.title, text: T.wireShooter.text },
    {
      id: 'wire-fire',
      target: (s) => wireTarget(s, FIRE_KEY_HELD, SHOOTER_FIRE),
      check: (s) => hasWire(s.graph, FIRE_KEY_HELD, SHOOTER_FIRE) || hasWire(s.graph, FIRE_KEY_PRESSED, SHOOTER_FIRE),
      title: T.wireFire.title,
      text: T.wireFire.text,
      explain: T.wireFire.explain,
    },
    { id: 'play-shoot', title: T.playShoot.title, text: T.playShoot.text, target: () => [PLAY_BTN], check: (s) => s.playing },
    { id: 'hit-target', title: T.hitTarget.title, text: T.hitTarget.text, explain: T.hitTarget.explain, target: () => [PLAY_BTN], check: (s) => !s.playing },
    { ...addStep('add-spawner', 'spawner'), title: T.addSpawner.title, text: T.addSpawner.text, explain: T.addSpawner.explain },
    {
      ...paramStep('spawner-setup', 'spawner', ['position', 'lifetime'], (n) => {
        const at = vecParam(n, 'position');
        const life = numParam(n, 'lifetime');
        return at !== null && inRange(at.x, 8.5, 12.5) && at.y >= 3 && life !== null && life > 0 && life <= 2.5;
      }),
      title: T.spawnerSetup.title,
      text: T.spawnerSetup.text,
      explain: T.spawnerSetup.explain,
    },
    { ...wireStep('wire-toucher', HERO_SELF, SPAWN_TOUCHER), title: T.wireToucher.title, text: T.wireToucher.text },
    { ...wireStep('wire-lose', SPAWN_TOUCHED, OR_B), title: T.wireLose.title, text: T.wireLose.text, explain: T.wireLose.explain },
    {
      id: 'add-timer',
      target: (s) => {
        const n = nodesOfKind(s.graph, 'timer')[0];
        return [n ? [paramSel('seconds'), `.wc-node[data-id="${n.id}"]`] : paletteSel('timer')];
      },
      check: (s) =>
        nodesOfKind(s.graph, 'timer').some((n) => {
          const sec = numParam(n, 'seconds');
          return sec !== null && sec >= 1.5 && sec <= 6;
        }),
      title: T.addTimer.title,
      text: T.addTimer.text,
      explain: T.addTimer.explain,
    },
    { ...wireStep('wire-spawn', TIMER_DONE, SPAWN_IN), title: T.wireSpawn.title, text: T.wireSpawn.text },
    {
      id: 'add-loop-or',
      target: () => [paletteSel('or')],
      check: (s) => nodesOfKind(s.graph, 'or').length >= 2,
      title: T.addLoopOr.title,
      text: T.addLoopOr.text,
      explain: T.addLoopOr.explain,
    },
    {
      id: 'wire-loop-in',
      target: (s) => {
        const or = loopOr(s.graph);
        return or ? wireTarget(s, TIMER_DONE, { kind: 'or', port: 'a', where: (n) => n.id === or.id }) : [];
      },
      check: (s) => {
        const or = loopOr(s.graph);
        return or !== undefined && hasWire(s.graph, TIMER_DONE, { kind: 'or', port: 'a', where: (n) => n.id === or.id });
      },
      title: T.wireLoopIn.title,
      text: T.wireLoopIn.text,
    },
    {
      id: 'wire-loop-out',
      target: (s) => {
        const or = loopOr(s.graph);
        return or ? wireTarget(s, { kind: 'or', port: 'out', where: (n) => n.id === or.id }, TIMER_RESET) : [];
      },
      check: (s) => {
        const or = loopOr(s.graph);
        return or !== undefined && hasWire(s.graph, { kind: 'or', port: 'out', where: (n) => n.id === or.id }, TIMER_RESET);
      },
      title: T.wireLoopOut.title,
      text: T.wireLoopOut.text,
      explain: T.wireLoopOut.explain,
    },
    { ...addStep('add-rotating', 'rotating-platform'), title: T.addRotating.title, text: T.addRotating.text, explain: T.addRotating.explain },
    {
      ...paramStep('rotating-setup', 'rotating-platform', ['position', 'size'], (n) => {
        const at = vecParam(n, 'position');
        const size = vecParam(n, 'size');
        if (at === null || size === null) return false;
        return inRange(at.x, 9.5, 16.5) && size.y >= 3.5 && size.x <= 1.5 && Math.abs(at.y - size.y / 2) <= 0.6;
      }),
      title: T.rotatingSetup.title,
      text: T.rotatingSetup.text,
      explain: T.rotatingSetup.explain,
    },
    { ...wireStep('wire-turn', HEALTH_DEAD, ROTATE_TURN), title: T.wireTurn.title, text: T.wireTurn.text },
    { id: 'play-final', title: T.playFinal.title, text: T.playFinal.text, target: () => [PLAY_BTN], check: (s) => s.playing },
    { id: 'win', title: T.win.title, text: T.win.text, explain: T.win.explain, check: (s) => s.ended === 'win' },
    { id: 'done', title: T.done.title, text: T.done.text },
  ],
};
