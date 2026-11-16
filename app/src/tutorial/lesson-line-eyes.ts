import { numParam } from '../nodes/util';
import { STOP_BUTTON, type Resolve, first, link, paramStep, wiresStep } from './lesson-b-helpers';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * "Mắt dò line": paint a line on the floor and give a character an eye that tells whether it stands on the line.
 * The character, the stick and the two read-outs are already on the board; the learner adds the line and the eye,
 * wires them, moves the eye to one side and drives over the line.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

const T = {
  title: 'Mắt dò line',
  summary: 'Sơn một vạch lên sàn, gắn một "mắt" cho nhân vật và xem mắt báo khi đứng trên vạch.',
  boardName: 'Mắt dò line',
  intro: {
    title: 'Xe dò đường nhìn thấy gì?',
    text: 'Xe dò đường có một con mắt nhỏ nhìn xuống sàn để biết mình đang ở trên vạch hay đã lệch ra ngoài. Bảng này có sẵn nhân vật, cần điều khiển và hai chỗ hiện kết quả. Ta sẽ sơn một vạch và gắn con mắt cho nhân vật.',
    explain: 'Con mắt chỉ đọc, không điều khiển ai. Muốn xe tự bám vạch, sau này bạn sẽ nối kết quả của nó vào bộ điều khiển.',
  },
  track: {
    title: 'Sơn một vạch lên sàn',
    text: 'Kéo mảnh ghép "Đường line" (nhóm Vật thể) vào bảng.',
    explain: 'Mặc định là một vòng bầu dục màu đen. Bạn đổi dạng, bề rộng và màu trong Thuộc tính. Nhân vật đi qua vạch bình thường, vạch không cản đường.',
  },
  eye: {
    title: 'Gắn con mắt',
    text: 'Kéo mảnh ghép "Cảm biến dò line" (nhóm Logic) vào bảng.',
    explain: 'Mắt nhìn xuống chỗ ngay phía trước mũi vật mang nó, trong một vòng tròn nhỏ gọi là vòng đọc.',
  },
  who: {
    title: 'Mắt gắn vào ai, nhìn vạch nào',
    text: 'Nối "Đối tượng" của Nhân vật sang "Đối tượng" của Cảm biến dò line. Rồi nối "Đối tượng" của Đường line sang "Đường line" của Cảm biến.',
    explain: 'Nối nhân vật để mắt đi theo và xoay theo hướng nhân vật quay mặt. Nối đường line để mắt chỉ nhìn đúng vạch đó; không nối thì mắt thấy mọi vạch.',
  },
  out: {
    title: 'Xem mắt đọc được gì',
    text: 'Nối "Độ đậm" sang mảnh Hiện số, và "Thấy line" sang mảnh Hiện chữ.',
    explain: '"Độ đậm" là phần vòng đọc nằm trên vạch, từ 0 đến 1, như mắt hồng ngoại thật. "Thấy line" bật khi độ đậm đủ lớn (từ ngưỡng 0,5).',
  },
  side: {
    title: 'Dời mắt sang một bên',
    text: 'Chọn mảnh Cảm biến dò line, tìm ô "Lệch ngang" trong Thuộc tính và đặt 0,25 (sang phải) hoặc -0,25 (sang trái). Mắt đặt bên phải thì lúc chơi hãy lái nhân vật lệch sang trái vạch một chút, để vạch lọt xuống dưới mắt.',
    explain: 'Xe dò đường thường có hai hoặc ba mắt lệch trái, phải: mắt nào chạm vạch trước cho biết xe đang lệch về phía nào.',
  },
  play: { title: 'Chơi thử', text: 'Bấm Chơi, rồi đi bằng phím mũi tên dọc theo vạch. Nhìn số "Độ đậm" đổi và chấm xanh dưới chân nhân vật sáng lên khi mắt thấy vạch.' },
  edit: { title: 'Quay lại sửa', text: 'Bấm nút Dừng để quay lại bảng lắp ghép.' },
  done: {
    title: 'Xong rồi!',
    text: 'Bạn đã sơn một vạch và gắn mắt dò line. Thử đặt thêm một mắt ở bên kia, hoặc đổi "Dạng đường" thành chữ S hay số 8. Xem thêm trong Sổ tay.',
  },
};

const NODES: BuildArgs[1] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: 0, y: 0.5, z: 3 }, speed: 3, color: '#ef4444', look: 'robot-wheel' } },
  { alias: 'num', kind: 'show-number', x: 1020, y: 20, params: { label: 'Độ đậm', corner: 'top-right' } },
  { alias: 'seen', kind: 'show-text', x: 1020, y: 300, params: { text: 'Mắt thấy line!', corner: 'top-left' } },
];
const WIRES: BuildArgs[2] = [
  ['stick', 'x', 'hero', 'moveX'],
  ['stick', 'y', 'hero', 'moveY'],
];

const hero: Resolve = (g) => first(g, 'character');
const track: Resolve = (g) => first(g, 'line-track');
const eye: Resolve = (g) => first(g, 'line-sensor');
const num: Resolve = (g) => first(g, 'show-number');
const seen: Resolve = (g) => first(g, 'show-text');

export function createLineEyesLesson(kit: LessonKit): Lesson {
  const play = (id: string, t: { title: string; text: string }, on: boolean) => ({
    id,
    title: t.title,
    text: t.text,
    target: () => [on ? kit.playButton : STOP_BUTTON],
    check: (s: { playing: boolean }) => s.playing === on,
  });
  return {
    id: 'line-eyes',
    title: T.title,
    summary: T.summary,
    createBoard: () => ({ ...kit.buildBoard(T.boardName, NODES, WIRES), mode: '2d-top' }),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-track', 'line-track'), title: T.track.title, text: T.track.text, explain: T.track.explain },
      { ...kit.addStep('add-eye', 'line-sensor'), title: T.eye.title, text: T.eye.text, explain: T.eye.explain },
      { ...wiresStep('wire-who', [link(hero, 'self', eye, 'who'), link(track, 'self', eye, 'track')]), title: T.who.title, text: T.who.text, explain: T.who.explain },
      { ...wiresStep('wire-out', [link(eye, 'level', num, 'value'), link(eye, 'onLine', seen, 'show')]), title: T.out.title, text: T.out.text, explain: T.out.explain },
      { ...paramStep('set-side', eye, 'side', (n) => Math.abs(numParam(n.params, 'side', 0)) >= 0.1), title: T.side.title, text: T.side.text, explain: T.side.explain },
      play('play', T.play, true),
      play('back-to-edit', T.edit, false),
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
