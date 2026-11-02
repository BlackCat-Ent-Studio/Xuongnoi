import type { Graph, GraphNode } from '../engine/types';
import { nodesOfKind, numParam, paramOf } from './graph-checks';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson, Snapshot, Step, TargetList } from './types';

/**
 * Lesson 10, "Bot lái xe": a robot walks to a parked car, climbs in and drives it round a bend to the finish flag.
 * Self-contained like lesson 10: the shared builders of `lessons.ts` arrive through `LessonKit`.
 */

const T = {
  title: '11. Bot lái xe',
  summary: 'Dạy một con bot tự đi tới xe, lên xe và lái đến đích.',
  boardName: 'Bài 11 - Bot lái xe',
  intro: {
    title: 'Bot biết lái xe',
    text: 'Bảng này có một con bot, một chiếc xe đậu bên đường và lá cờ ở cuối đường. Ta sẽ dạy bot tự đi tới xe, lên xe và lái qua khúc cua đến cờ.',
    explain: 'Bot không có tay chân thật để bấm phím, nên ta dùng các mảnh ghép "bộ não" để ra lệnh cho nó.',
  },
  watch: {
    title: 'Xem thử trước',
    text: 'Bấm "Chơi". Bot đứng yên, xe đứng yên: chưa ai bảo chúng làm gì.',
  },
  edit: {
    title: 'Quay lại sửa',
    text: 'Bấm nút "Dừng" để làm tiếp.',
  },
  sequence: {
    title: 'Thêm Chuỗi việc',
    text: 'Kéo mảnh ghép "Chuỗi việc" (nhóm Bộ não) vào bảng.',
    explain: 'Chuỗi việc làm lần lượt từng việc. Mặc định có 2 việc: việc 1 là đi tới xe, việc 2 là lái xe tới cờ.',
  },
  goto1: {
    title: 'Thêm Đi tới cho bot',
    text: 'Kéo một mảnh ghép "Đi tới" (nhóm Bộ não) vào bảng. Mảnh ghép này sẽ dẫn bot đi bộ tới xe.',
    explain: 'Đi tới tự tìm đường vòng qua tường để tới đích, rồi bật "Vừa tới" một nhịp khi đã đến nơi.',
  },
  goto1Who: {
    title: 'Nói ai đi, đi đâu',
    text: 'Nối cổng "Nhân vật" của con bot sang cổng "Bot" của mảnh ghép Đi tới. Rồi nối cổng "Xe" của mảnh ghép Xe sang cổng "Đích (vật)".',
  },
  goto1Move: {
    title: 'Cho bot bước đi',
    text: 'Nối "Đi ngang" của mảnh ghép Đi tới sang "Đi ngang" của bot, và "Đi dọc" sang "Đi dọc" của bot.',
    explain: 'Mảnh ghép Đi tới chỉ nghĩ xem nên đi hướng nào. Bot chỉ bước khi ta nối hướng đó vào nó.',
  },
  goto1Stop: {
    title: 'Dừng cách xe một chút',
    text: 'Chọn mảnh ghép Đi tới đang dẫn bot. Ở Thuộc tính, đổi "Dừng cách đích" thành 1.5.',
    explain: 'Xe là vật cứng nên bot không thể đứng đúng giữa xe. Dừng cách xe một chút là bot đã đứng đủ gần để leo lên.',
  },
  step1: {
    title: 'Việc 1: đi tới xe',
    text: 'Nối "Việc 1" của Chuỗi việc sang cổng "Cho đi" của mảnh ghép Đi tới.',
    explain: '"Cho đi" là công tắc: mảnh ghép Đi tới chỉ làm việc khi nó bật.',
  },
  enter: {
    title: 'Thêm mảnh ghép lên xe',
    text: 'Kéo mảnh ghép "Lên / Xuống xe" (nhóm Hành động) vào bảng.',
    explain: 'Mỗi lần nó nhận một nhịp "Bấm", nhân vật đứng gần xe sẽ lên xe. Lần sau thì xuống xe.',
  },
  enterWho: {
    title: 'Nói bot sẽ lên xe',
    text: 'Nối cổng "Nhân vật" của con bot sang cổng "Ai" của mảnh ghép Lên / Xuống xe.',
  },
  arrive: {
    title: 'Tới nơi thì lên xe',
    text: 'Nối "Vừa tới" của mảnh ghép Đi tới (dẫn bot) vào hai chỗ: cổng "Bấm" của Lên / Xuống xe và cổng "Xong việc" của Chuỗi việc.',
    explain: 'Một cổng nối được nhiều dây. Khi bot vừa tới xe, nó lên xe và Chuỗi việc chuyển sang việc 2.',
  },
  goto2: {
    title: 'Thêm Đi tới cho xe',
    text: 'Kéo thêm một mảnh ghép "Đi tới" nữa vào bảng. Mảnh ghép này sẽ dẫn chiếc xe tới cờ.',
    explain: 'Bot ngồi trong xe thì bộ não lái luôn chiếc xe, nên lần này người đi là xe chứ không phải bot.',
  },
  goto2Who: {
    title: 'Xe đi tới cờ',
    text: 'Nối cổng "Xe" của mảnh ghép Xe sang cổng "Bot" của mảnh ghép Đi tới mới. Rồi nối cổng "Hộp" của lá cờ (hộp vàng) sang cổng "Đích (vật)".',
  },
  step2: {
    title: 'Việc 2: lái xe tới cờ',
    text: 'Nối "Việc 2" của Chuỗi việc sang cổng "Cho đi" của mảnh ghép Đi tới mới.',
  },
  goto2Move: {
    title: 'Cho xe chạy',
    text: 'Nối "Đi ngang" của mảnh ghép Đi tới mới sang "Đi ngang" của mảnh ghép Xe, và "Đi dọc" sang "Đi dọc".',
    explain: 'Xe được lái bằng đúng hai cổng này, giống như cần điều khiển lái xe.',
  },
  touch: {
    title: 'Thêm Chạm nhau',
    text: 'Kéo mảnh ghép "Chạm nhau" (nhóm Logic) vào bảng.',
  },
  touchWho: {
    title: 'Xe chạm cờ',
    text: 'Nối cổng "Xe" của mảnh ghép Xe sang "Vật chính" và cổng "Hộp" của lá cờ sang "Vật kia" của Chạm nhau.',
  },
  end: {
    title: 'Thêm mảnh ghép Thắng / Thua',
    text: 'Kéo mảnh ghép "Thắng / Thua" (nhóm Kết quả) vào bảng.',
  },
  win: {
    title: 'Chạm cờ là thắng',
    text: 'Nối "Đang chạm" của Chạm nhau sang cổng "Thắng" của mảnh ghép Thắng / Thua.',
  },
  play: {
    title: 'Chạy thử',
    text: 'Bấm "Chơi" và xem bot đi tới xe, lên xe rồi lái qua khúc cua tới cờ.',
  },
  won: {
    title: 'Chờ bot tới cờ',
    text: 'Cứ để bot tự lái. Khi xe chạm cờ, trò chơi báo thắng.',
  },
  done: {
    title: 'Bot lái xe giỏi quá!',
    text: 'Bạn đã dạy bot đi bộ, lên xe và lái xe theo từng việc. Hãy thử đổi loại xe, đổi cờ sang chỗ khác hoặc thêm tường để bot phải vòng đường khác.',
  },
} as const;

type Pick2 = Pick<Step, 'id' | 'target' | 'check'>;

// ---------- finding the nodes of this board ----------

const isBotChar = (n: GraphNode): boolean => paramOf(n, 'role') === 'bot';
const isFlag = (n: GraphNode): boolean => n.kind === 'block' && paramOf(n, 'type') === 'pickup';

function first(graph: Graph, kind: string, where?: (n: GraphNode) => boolean): GraphNode | undefined {
  return nodesOfKind(graph, kind, where)[0];
}

function wired(graph: Graph, from: GraphNode | undefined, fromPort: string, to: GraphNode | undefined, toPort: string): boolean {
  if (!from || !to) return false;
  return graph.wires.some((w) => w.from.node === from.id && w.from.port === fromPort && w.to.node === to.id && w.to.port === toPort);
}

/** The "Đi tới" that walks the bot: the one fed by the bot, else the first one on the board. */
function walker(graph: Graph): GraphNode | undefined {
  const bot = first(graph, 'character', isBotChar);
  const all = nodesOfKind(graph, 'go-to');
  return all.find((g) => wired(graph, bot, 'self', g, 'self')) ?? all[0];
}

/** The "Đi tới" that drives the car: the one fed by the car, else the first one that is not the walker. */
function driver(graph: Graph): GraphNode | undefined {
  const car = first(graph, 'vehicle');
  const walk = walker(graph);
  const all = nodesOfKind(graph, 'go-to').filter((g) => g !== walk);
  return all.find((g) => wired(graph, car, 'self', g, 'self')) ?? all[0];
}

interface Link {
  /** Resolve both ends from the current graph; undefined while a node is still missing. */
  ends(graph: Graph): { from?: GraphNode; fromPort: string; to?: GraphNode; toPort: string };
}

type Resolve = (g: Graph) => GraphNode | undefined;
const link = (from: Resolve, fromPort: string, to: Resolve, toPort: string): Link => ({
  ends: (g) => ({ from: from(g), fromPort, to: to(g), toPort }),
});

const bot: Resolve = (g) => first(g, 'character', isBotChar);
const car: Resolve = (g) => first(g, 'vehicle');
const flag: Resolve = (g) => first(g, 'block', isFlag);
const sequence: Resolve = (g) => first(g, 'sequence');
const enter: Resolve = (g) => first(g, 'enter-exit');
const touch: Resolve = (g) => first(g, 'touch');
const end: Resolve = (g) => first(g, 'win-lose');

function linkDone(graph: Graph, l: Link): boolean {
  const e = l.ends(graph);
  return wired(graph, e.from, e.fromPort, e.to, e.toPort);
}

/** A step finished when every listed wire exists; the hint shows the ports of the first one still missing. */
function wiresStep(id: string, links: Link[]): Pick2 {
  return {
    id,
    target: (snap: Snapshot): TargetList => {
      const missing = links.find((l) => !linkDone(snap.graph, l)) ?? links[0]!;
      const e = missing.ends(snap.graph);
      const out: string[] = [];
      if (e.from) out.push(`.wc-port[data-node="${e.from.id}"][data-port="${e.fromPort}"][data-dir="out"]`);
      if (e.to) out.push(`.wc-port[data-node="${e.to.id}"][data-port="${e.toPort}"][data-dir="in"]`);
      return out;
    },
    check: (snap) => links.every((l) => linkDone(snap.graph, l)),
  };
}

const paramSel = (id: string): string => `.prop-row[data-param="${id}"]`;

/** The lesson board: a robot, a parked car, a flag and walls forming a road with one bend (no hero, so the camera follows the bot). */
export function createBotDriverLesson(kit: LessonKit): Lesson {
  const solid = (alias: string, x: number, z: number, sx: number, sz: number, y: number) => ({
    alias,
    kind: 'block',
    x: 20,
    y,
    params: { type: 'solid', position: { x, y: 0.5, z }, size: { x: sx, y: 1, z: sz }, color: '#64748b' },
  });
  const nodes: Parameters<LessonKit['buildBoard']>[1] = [
    { alias: 'bot', kind: 'character', x: 300, y: 20, params: { position: { x: -10.5, y: 0.5, z: 5 }, role: 'bot', look: 'robot', color: '#ef4444' } },
    {
      alias: 'car',
      kind: 'vehicle',
      x: 300,
      y: 260,
      params: { position: { x: -4, y: 0.4, z: 5 }, model: 'car', steerMode: 'direction', color: '#3b82f6' },
    },
    {
      alias: 'flag',
      kind: 'block',
      x: 300,
      y: 560,
      params: { type: 'pickup', position: { x: 7.5, y: 0.5, z: -7.5 }, size: { x: 4, y: 1, z: 1 }, color: '#fde047' },
    },
    solid('wall-island', -4.5, -3.5, 19, 11, 20),
    solid('wall-south', -1.5, 8.75, 25, 1.5, 140),
    solid('wall-west', -13.5, 5.75, 1, 7.5, 260),
    solid('wall-east', 10.5, -0.25, 1, 19.5, 380),
    solid('wall-north', 8, -9.5, 6, 1, 500),
  ];

  return {
    id: 'bot-driver',
    title: T.title,
    summary: T.summary,
    createBoard: () => ({ ...kit.buildBoard(T.boardName, nodes, []), mode: '2d-top' }),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { id: 'watch', title: T.watch.title, text: T.watch.text, target: () => [kit.playButton], check: (s) => s.playing },
      { id: 'back-to-edit', title: T.edit.title, text: T.edit.text, target: () => [kit.playButton], check: (s) => !s.playing },
      { ...kit.addStep('add-sequence', 'sequence'), title: T.sequence.title, text: T.sequence.text, explain: T.sequence.explain },
      { ...kit.addStep('add-goto-walk', 'go-to'), title: T.goto1.title, text: T.goto1.text, explain: T.goto1.explain },
      {
        ...wiresStep('wire-walk-who', [link(bot, 'self', walker, 'self'), link(car, 'self', walker, 'target')]),
        title: T.goto1Who.title,
        text: T.goto1Who.text,
      },
      {
        ...wiresStep('wire-walk-move', [link(walker, 'moveX', bot, 'moveX'), link(walker, 'moveY', bot, 'moveY')]),
        title: T.goto1Move.title,
        text: T.goto1Move.text,
        explain: T.goto1Move.explain,
      },
      {
        id: 'walk-stop',
        title: T.goto1Stop.title,
        text: T.goto1Stop.text,
        explain: T.goto1Stop.explain,
        target: (s) => {
          const g = walker(s.graph);
          return [g ? [paramSel('stopDistance'), `.wc-node[data-id="${g.id}"]`] : paramSel('stopDistance')];
        },
        check: (s) => {
          const g = walker(s.graph);
          const v = g ? numParam(g, 'stopDistance') : null;
          return v !== null && v >= 1;
        },
      },
      {
        ...wiresStep('wire-step1', [link(sequence, 'step1', walker, 'go')]),
        title: T.step1.title,
        text: T.step1.text,
        explain: T.step1.explain,
      },
      { ...kit.addStep('add-enter', 'enter-exit'), title: T.enter.title, text: T.enter.text, explain: T.enter.explain },
      { ...wiresStep('wire-enter-who', [link(bot, 'self', enter, 'character')]), title: T.enterWho.title, text: T.enterWho.text },
      {
        ...wiresStep('wire-arrive', [link(walker, 'arrivedPulse', enter, 'press'), link(walker, 'arrivedPulse', sequence, 'next')]),
        title: T.arrive.title,
        text: T.arrive.text,
        explain: T.arrive.explain,
      },
      { ...kit.addStep('add-goto-drive', 'go-to', 2), title: T.goto2.title, text: T.goto2.text, explain: T.goto2.explain },
      {
        ...wiresStep('wire-drive-who', [link(car, 'self', driver, 'self'), link(flag, 'self', driver, 'target')]),
        title: T.goto2Who.title,
        text: T.goto2Who.text,
      },
      { ...wiresStep('wire-step2', [link(sequence, 'step2', driver, 'go')]), title: T.step2.title, text: T.step2.text },
      {
        ...wiresStep('wire-drive-move', [link(driver, 'moveX', car, 'moveX'), link(driver, 'moveY', car, 'moveY')]),
        title: T.goto2Move.title,
        text: T.goto2Move.text,
        explain: T.goto2Move.explain,
      },
      { ...kit.addStep('add-touch', 'touch'), title: T.touch.title, text: T.touch.text },
      { ...wiresStep('wire-touch', [link(car, 'self', touch, 'a'), link(flag, 'self', touch, 'b')]), title: T.touchWho.title, text: T.touchWho.text },
      { ...kit.addStep('add-end', 'win-lose'), title: T.end.title, text: T.end.text },
      { ...wiresStep('wire-win', [link(touch, 'touching', end, 'win')]), title: T.win.title, text: T.win.text },
      { id: 'play-trip', title: T.play.title, text: T.play.text, target: () => [kit.playButton], check: (s) => s.playing },
      { id: 'win', title: T.won.title, text: T.won.text, check: (s) => s.ended === 'win' },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
