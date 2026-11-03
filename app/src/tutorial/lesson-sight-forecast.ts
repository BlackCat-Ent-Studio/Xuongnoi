import { STOP_BUTTON, type Resolve, first, link, wiresStep } from './lesson-b-helpers';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * "Đoán trước lính gác": a guard bot walks to and fro, looking where it walks, and you stand still on the right.
 * The guard's eyes and walk are already on the board. The player adds "Dự đoán tầm nhìn" and reads how many seconds
 * are left before the guard sees the player, before it happens.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

const GUARD = '#ef4444';
const YOU = '#3b82f6';

const T = {
  title: 'Đoán trước lính gác',
  summary: 'Cho bot biết trước bao lâu nữa lính gác sẽ thấy nó, để chọn lúc nên chạy.',
  boardName: 'Đoán trước lính gác',
  intro: {
    title: 'Lính gác đi tuần',
    text: 'Bot đỏ là lính gác, đi qua đi lại và nhìn theo hướng đi. Nhân vật xanh đứng yên bên phải. Mắt và đường đi tuần của lính gác đã lắp sẵn. Ta sẽ đoán trước lúc lính gác thấy nhân vật xanh.',
    explain: 'Đoán trước nghĩa là biết kết quả mà không cần chờ tới lúc đó. Mảnh này không điều khiển ai, nó chỉ tính.',
  },
  add: {
    title: 'Thêm mảnh đoán trước',
    text: 'Kéo mảnh ghép "Dự đoán tầm nhìn" (nhóm Logic) vào bảng.',
    explain: 'Nó chơi thử trước đường đi tuần và tầm nhìn của lính gác, bằng đúng luật của mảnh "Tầm nhìn".',
  },
  viewer: {
    title: 'Ai đang nhìn?',
    text: 'Nối "Nhân vật" của bot đỏ sang "Người nhìn" của Dự đoán tầm nhìn. Rồi nối "Tuyến đi tuần" của mảnh Đi tuần sang "Đường đi tuần".',
    explain: 'Mảnh đoán trước chỉ biết những gì được nối dây vào: không nối "Đường đi tuần" thì nó coi như lính gác đứng yên.',
  },
  target: {
    title: 'Canh chỗ nào?',
    text: 'Nối "Nhân vật" của nhân vật xanh sang "Mục tiêu".',
    explain: 'Chỗ nhân vật xanh đứng chính là chỗ được canh.',
  },
  out: {
    title: 'Xem kết quả',
    text: 'Nối "Còn (giây)" sang mảnh hiện số, và "An toàn" sang mảnh hiện chữ.',
    explain: '"Còn" là số giây tới lần đầu lính gác thấy chỗ đó, bằng 0 nếu đang bị thấy. Số 99 là chưa bị thấy trong 12 giây tới, và lúc đó "An toàn" bật.',
  },
  play: { title: 'Chơi thử', text: 'Bấm Chơi. Số ở góc phải đếm ngược tới lúc lính gác quay lại nhìn thấy nhân vật xanh.' },
  edit: { title: 'Quay lại sửa', text: 'Bấm nút Dừng để quay lại bảng lắp ghép.' },
  done: {
    title: 'Xong rồi!',
    text: 'Bạn đã dùng "Dự đoán tầm nhìn". Đem "Còn" so với thời gian bot cần để chạy qua một đoạn (cổng "Cần" của Chạy theo tuyến) là bot biết lúc nào nên lẻn. Xem thêm trong Sổ tay.',
  },
};

const NODES: BuildArgs[1] = [
  { alias: 'floor', kind: 'block', x: 20, y: 20, params: { position: { x: 0, y: 0, z: 0 }, size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
  { alias: 'guard', kind: 'character', x: 270, y: 20, params: { position: { x: -9, y: 1, z: 0 }, role: 'bot', color: GUARD, speed: 2 } },
  { alias: 'you', kind: 'character', x: 270, y: 300, params: { position: { x: 5, y: 1, z: 0 }, role: 'bot', color: YOU } },
  { alias: 'walk', kind: 'patrol', x: 520, y: 20, params: { pointA: { x: -9, y: 1, z: 0 }, pointB: { x: 0, y: 1, z: 0 }, wait: 1, pathfind: 'off' } },
  { alias: 'eyes', kind: 'vision-sensor', x: 520, y: 300, params: { range: 6, angle: 90 } },
  { alias: 'num', kind: 'show-number', x: 1020, y: 20, params: { label: 'Còn (giây)', corner: 'top-right' } },
  { alias: 'safe', kind: 'show-text', x: 1020, y: 300, params: { text: 'An toàn: chưa bị thấy', corner: 'top-left' } },
];
const WIRES: BuildArgs[2] = [
  ['guard', 'self', 'walk', 'self'],
  ['walk', 'moveX', 'guard', 'moveX'],
  ['guard', 'self', 'eyes', 'viewer'],
  ['you', 'self', 'eyes', 'target'],
];

const guard: Resolve = (g) => first(g, 'character', (n) => n.params.color === GUARD);
const you: Resolve = (g) => first(g, 'character', (n) => n.params.color === YOU);
const fore: Resolve = (g) => first(g, 'sight-forecast');
const walk: Resolve = (g) => first(g, 'patrol');
const num: Resolve = (g) => first(g, 'show-number');
const safe: Resolve = (g) => first(g, 'show-text');

export function createSightForecastLesson(kit: LessonKit): Lesson {
  const play = (id: string, t: { title: string; text: string }, on: boolean) => ({
    id,
    title: t.title,
    text: t.text,
    target: () => [on ? kit.playButton : STOP_BUTTON],
    check: (s: { playing: boolean }) => s.playing === on,
  });
  return {
    id: 'sight-forecast',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-forecast', 'sight-forecast'), title: T.add.title, text: T.add.text, explain: T.add.explain },
      { ...wiresStep('wire-viewer', [link(guard, 'self', fore, 'viewer'), link(walk, 'route', fore, 'patrol')]), title: T.viewer.title, text: T.viewer.text, explain: T.viewer.explain },
      { ...wiresStep('wire-target', [link(you, 'self', fore, 'target')]), title: T.target.title, text: T.target.text, explain: T.target.explain },
      {
        ...wiresStep('wire-out', [link(fore, 'window', num, 'value'), link(fore, 'safe', safe, 'show')]),
        title: T.out.title,
        text: T.out.text,
        explain: T.out.explain,
      },
      play('play', T.play, true),
      play('back-to-edit', T.edit, false),
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
