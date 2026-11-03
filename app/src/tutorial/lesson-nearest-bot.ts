import { STOP_BUTTON, type Resolve, first, link, wiresStep } from './lesson-b-helpers';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * "Bot tìm thùng gần nhất": one bot, two crates on the floor, one near and one far. "Tìm vật gần nhất" picks the
 * near one and "Đi tới" walks the bot there.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

const T = {
  title: 'Bot tìm thùng gần nhất',
  summary: 'Cho bot tự chọn thùng nằm gần nhất rồi đi tới đó.',
  boardName: 'Bot tìm thùng',
  intro: {
    title: 'Hai thùng, một bot',
    text: 'Bot xanh đứng giữa sàn. Bên trái có một thùng ở xa, bên phải có một thùng ở gần. Ta sẽ cho bot tự tìm thùng gần nhất rồi đi tới.',
    explain: 'Không cần chỉ tay vào thùng nào: mảnh ghép tự nhìn khắp sàn.',
  },
  finder: {
    title: 'Tìm thùng gần nhất',
    text: 'Kéo mảnh ghép "Tìm vật gần nhất" (nhóm Logic) vào bảng.',
    explain: 'Nó chỉ ra món đồ nằm rời gần "Ai" nhất. Đồ đang được khiêng thì không tính.',
  },
  wireWho: {
    title: 'Nói cho nó biết "Ai"',
    text: 'Nối "Nhân vật" của bot xanh sang "Ai" của Tìm vật gần nhất.',
  },
  goTo: {
    title: 'Cho bot đi',
    text: 'Kéo mảnh ghép "Đi tới" (nhóm Bộ não) vào bảng.',
  },
  wireGo: {
    title: 'Đi tới thùng đó',
    text: 'Nối "Nhân vật" của bot sang "Bot" của Đi tới, "Vật gần nhất" sang "Đích (vật)", "Có" sang "Cho đi", và "Đi ngang" của Đi tới sang "Đi ngang" của bot.',
    explain: '"Có" bật khi còn thùng để lấy. Hết thùng thì tắt, và bot đứng yên thay vì đi lung tung.',
  },
  play: { title: 'Chơi thử', text: 'Bấm Chơi. Bot đi tới thùng bên phải vì nó gần hơn.' },
  done: {
    title: 'Xong rồi!',
    text: 'Ghép thêm "Khiêng đồ" và "Ô trống kế tiếp" là bot tự nhặt từng thùng gần nhất rồi cất vào kho. Xem thêm trong Sổ tay.',
  },
};

const NODES: BuildArgs[1] = [
  { alias: 'floor', kind: 'block', x: 20, y: 20, params: { position: { x: 0, y: 0, z: 0 }, size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
  { alias: 'bot', kind: 'character', x: 270, y: 20, params: { position: { x: 0, y: 1, z: 0 }, role: 'bot', color: '#3b82f6', speed: 4 } },
  { alias: 'far', kind: 'item', x: 520, y: 20, params: { position: { x: -9, y: 1, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, shape: 'crate', color: '#b45309' } },
  { alias: 'near', kind: 'item', x: 770, y: 20, params: { position: { x: 5, y: 1, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, shape: 'crate', color: '#b45309' } },
];
const WIRES: BuildArgs[2] = [];

const bot: Resolve = (g) => first(g, 'character');
const finder: Resolve = (g) => first(g, 'nearest-item');
const goTo: Resolve = (g) => first(g, 'go-to');

export function createNearestBotLesson(kit: LessonKit): Lesson {
  const play = (id: string, t: { title: string; text: string }, on: boolean) => ({
    id,
    title: t.title,
    text: t.text,
    target: () => [on ? kit.playButton : STOP_BUTTON],
    check: (s: { playing: boolean }) => s.playing === on,
  });
  return {
    id: 'nearest-bot',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-finder', 'nearest-item'), title: T.finder.title, text: T.finder.text, explain: T.finder.explain },
      { ...wiresStep('wire-who', [link(bot, 'self', finder, 'who')]), title: T.wireWho.title, text: T.wireWho.text },
      { ...kit.addStep('add-go-to', 'go-to'), title: T.goTo.title, text: T.goTo.text },
      {
        ...wiresStep('wire-go', [
          link(bot, 'self', goTo, 'self'),
          link(finder, 'item', goTo, 'target'),
          link(finder, 'found', goTo, 'go'),
          link(goTo, 'moveX', bot, 'moveX'),
        ]),
        title: T.wireGo.title,
        text: T.wireGo.text,
        explain: T.wireGo.explain,
      },
      play('play', T.play, true),
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
