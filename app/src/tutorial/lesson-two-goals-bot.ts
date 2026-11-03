import { type Resolve, first, link, wiresStep } from './lesson-b-helpers';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * "Bot có hai đích": one bot, a green mark on the left and a yellow mark on the right, and a key. "Đi tới" walks to
 * the green mark (Đích); while the key is held "Dùng đích 2" turns it to the yellow mark (Đích 2).
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

const T = {
  title: 'Bot có hai đích',
  summary: 'Một mảnh Đi tới, hai nơi để đi, đổi nơi bằng một phím.',
  boardName: 'Bot hai đích',
  intro: {
    title: 'Hai ô, một bot',
    text: 'Bot xanh đứng giữa sàn. Bên trái có ô xanh lá, bên phải có ô vàng. Ta sẽ cho bot đi tới ô xanh lá, và đổi sang ô vàng khi giữ phím Space.',
    explain: 'Một mảnh Đi tới có thể có hai đích. Bật "Dùng đích 2" là nó đổi đích.',
  },
  goTo: { title: 'Cho bot đi', text: 'Kéo mảnh ghép "Đi tới" (nhóm Bộ não) vào bảng.' },
  wireGo: {
    title: 'Nối hai đích',
    text: 'Nối "Nhân vật" của bot sang "Bot", ô xanh lá sang "Đích (vật)", ô vàng sang "Đích 2 (vật)", "Đi ngang" sang "Đi ngang" của bot.',
  },
  wireSwitch: {
    title: 'Phím đổi đích',
    text: 'Nối "Đang giữ phím" của Phím bấm sang "Dùng đích 2" của Đi tới.',
    explain: 'Không giữ phím thì bot đi tới Đích. Giữ phím thì bot quay sang Đích 2.',
  },
  play: { title: 'Chơi thử', text: 'Bấm Chơi. Bot đi tới ô xanh lá. Giữ Space là nó quay sang ô vàng.' },
  done: { title: 'Xong rồi!', text: 'Đích 2 hợp với việc đi lấy rồi đi cất: nối "Đang khiêng" vào "Dùng đích 2". Xem thêm trong Sổ tay.' },
};

const NODES: BuildArgs[1] = [
  { alias: 'floor', kind: 'block', x: 20, y: 20, params: { position: { x: 0, y: 0, z: 0 }, size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
  { alias: 'bot', kind: 'character', x: 270, y: 20, params: { position: { x: 0, y: 1, z: 0 }, role: 'bot', color: '#3b82f6', speed: 4 } },
  { alias: 'green', kind: 'block', x: 520, y: 20, params: { name: 'Ô xanh lá', type: 'pickup', position: { x: -7, y: 0.55, z: 0 }, size: { x: 1.6, y: 0.1, z: 1 }, color: '#22c55e' } },
  { alias: 'yellow', kind: 'block', x: 770, y: 20, params: { name: 'Ô vàng', type: 'pickup', position: { x: 7, y: 0.55, z: 0 }, size: { x: 1.6, y: 0.1, z: 1 }, color: '#f59e0b' } },
  { alias: 'key', kind: 'key', x: 20, y: 200, params: { key: 'Space' } },
];
const WIRES: BuildArgs[2] = [];

const bot: Resolve = (g) => first(g, 'character');
const green: Resolve = (g) => first(g, 'block', (n) => n.params.name === 'Ô xanh lá');
const yellow: Resolve = (g) => first(g, 'block', (n) => n.params.name === 'Ô vàng');
const key: Resolve = (g) => first(g, 'key');
const goTo: Resolve = (g) => first(g, 'go-to');

export function createTwoGoalsBotLesson(kit: LessonKit): Lesson {
  return {
    id: 'two-goals-bot',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-go-to', 'go-to'), title: T.goTo.title, text: T.goTo.text },
      {
        ...wiresStep('wire-go', [
          link(bot, 'self', goTo, 'self'),
          link(green, 'self', goTo, 'target'),
          link(yellow, 'self', goTo, 'target2'),
          link(goTo, 'moveX', bot, 'moveX'),
        ]),
        title: T.wireGo.title,
        text: T.wireGo.text,
      },
      { ...wiresStep('wire-switch', [link(key, 'held', goTo, 'useTarget2')]), title: T.wireSwitch.title, text: T.wireSwitch.text, explain: T.wireSwitch.explain },
      {
        id: 'play',
        title: T.play.title,
        text: T.play.text,
        target: () => [kit.playButton],
        check: (s: { playing: boolean }) => s.playing,
      },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
