import { type Resolve, STOP_BUTTON, first, link, paramStep, wiresStep } from './lesson-b-helpers';
import { nodesOfKind, numParam } from './graph-checks';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * "Robot hai động cơ": the board only has the arrow-key stick and two ready-made sums that turn it into a left and a right
 * power (up + right for the left wheel, up - right for the right wheel). The player adds the chassis and two motors, mounts
 * the motors on the chassis, puts one on the left, and wires the powers. Nothing drives until every wire is there.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

const T = {
  title: 'Robot hai động cơ',
  summary: 'Lắp thân robot với hai bánh xe có động cơ, rồi lái nó bằng phím mũi tên.',
  boardName: 'Robot hai động cơ',
  intro: {
    title: 'Robot chạy bằng bánh',
    text: 'Bảng này nhìn từ trên xuống, có sẵn Cần điều khiển và hai Phép tính trộn phím mũi tên thành công suất cho bánh trái và bánh phải. Ta sẽ lắp thân robot và hai động cơ.',
    explain: 'Robot thật không có "chân ga" chung. Mỗi bánh có một động cơ riêng, và robot rẽ được nhờ hai bánh quay nhanh chậm khác nhau.',
  },
  body: {
    title: 'Thêm thân robot',
    text: 'Kéo mảnh ghép "Thân robot" (nhóm Vật thể) vào bảng.',
    explain: 'Thân là một khối nằm trên đất, có khối lượng và độ bám mặt đất. Tự nó không chạy được.',
  },
  motors: {
    title: 'Thêm hai động cơ',
    text: 'Kéo mảnh ghép "Động cơ" (nhóm Hành động) vào bảng hai lần: mỗi bánh một cái.',
    explain: 'Mỗi Động cơ là một bánh xe. Bánh đẩy thân robot về phía trước hay phía sau theo vòng quay của nó.',
  },
  mount: {
    title: 'Gắn bánh lên thân',
    text: 'Nối "Đối tượng" của Thân robot sang cổng "Thân" của cả hai Động cơ.',
    explain: 'Cổng "Thân" cho động cơ biết nó gắn lên robot nào. Động cơ không gắn lên đâu thì bánh quay trơ.',
  },
  side: {
    title: 'Đặt một bánh bên trái',
    text: 'Chọn một Động cơ, trong Thuộc tính đặt "Vị trí ngang" thành số âm, ví dụ -0.4. Động cơ còn lại giữ 0.4 là bánh bên phải.',
    explain: 'Số âm là bên trái, số dương là bên phải, tính bằng mét từ đường giữa thân. Hai bánh cách nhau 0.8 m.',
  },
  power: {
    title: 'Cấp công suất',
    text: 'Nối "Kết quả" của phép Cộng sang "Công suất" của động cơ bên trái, và "Kết quả" của phép Trừ sang "Công suất" của động cơ bên phải.',
    explain: 'Phép Cộng là lên + phải: rẽ phải thì bánh trái quay nhanh hơn. Phép Trừ là lên − phải. Bánh không có dây công suất thì đứng yên.',
  },
  play: {
    title: 'Lái thử',
    text: 'Bấm Chơi. Mũi tên lên để chạy tới, xuống để lùi, trái hoặc phải để rẽ. Chỉ bấm trái hoặc phải mà không bấm lên thì robot quay tại chỗ.',
  },
  edit: { title: 'Quay lại sửa', text: 'Bấm nút Dừng để quay lại bảng lắp ghép.' },
  heavy: {
    title: 'Làm robot nặng hơn',
    text: 'Chọn Thân robot và đặt "Khối lượng" thành 10 kg hoặc hơn, rồi chơi lại.',
    explain: 'Robot nặng thì cùng một lực đẩy cho gia tốc nhỏ hơn: nó ì khi bắt đầu chạy và khi dừng.',
  },
  done: {
    title: 'Xong rồi!',
    text: 'Bạn đã lắp robot từ các mảnh nhỏ: một Thân và hai Động cơ. Thử đặt một bánh lệch khỏi tâm hoặc bỏ dây của một bánh để xem robot đi vòng tròn. Xem thêm trong Sổ tay.',
  },
};

const NODES: BuildArgs[1] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'left-mix', kind: 'math', x: 300, y: 20, params: { op: 'add' } },
  { alias: 'right-mix', kind: 'math', x: 300, y: 200, params: { op: 'sub' } },
  { alias: 'wall', kind: 'block', x: 20, y: 380, params: { position: { x: 8, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 8 }, color: '#737373' } },
];
const WIRES: BuildArgs[2] = [
  ['stick', 'y', 'left-mix', 'a'],
  ['stick', 'x', 'left-mix', 'b'],
  ['stick', 'y', 'right-mix', 'a'],
  ['stick', 'x', 'right-mix', 'b'],
];

const body: Resolve = (g) => first(g, 'robot-body');
/** The motor that stays on the right (added first) and the one the player moves to the left (added second). */
const rightMotor: Resolve = (g) => nodesOfKind(g, 'motor')[0];
const leftMotor: Resolve = (g) => nodesOfKind(g, 'motor')[1];
const leftMix: Resolve = (g) => first(g, 'math', (n) => n.params.op === 'add');
const rightMix: Resolve = (g) => first(g, 'math', (n) => n.params.op === 'sub');

export function createTwoMotorRobotLesson(kit: LessonKit): Lesson {
  const play = (id: string, t: { title: string; text: string }, on: boolean) => ({
    id,
    title: t.title,
    text: t.text,
    target: () => [on ? kit.playButton : STOP_BUTTON],
    check: (s: { playing: boolean }) => s.playing === on,
  });
  return {
    id: 'two-motor-robot',
    title: T.title,
    summary: T.summary,
    createBoard: () => ({ ...kit.buildBoard(T.boardName, NODES, WIRES), mode: '2d-top' }),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-body', 'robot-body'), title: T.body.title, text: T.body.text, explain: T.body.explain },
      { ...kit.addStep('add-motors', 'motor', 2), title: T.motors.title, text: T.motors.text, explain: T.motors.explain },
      {
        ...wiresStep('mount', [link(body, 'self', rightMotor, 'body'), link(body, 'self', leftMotor, 'body')]),
        title: T.mount.title,
        text: T.mount.text,
        explain: T.mount.explain,
      },
      {
        ...paramStep('left-side', leftMotor, 'side', (n) => (numParam(n, 'side') ?? 0) < -0.05),
        title: T.side.title,
        text: T.side.text,
        explain: T.side.explain,
      },
      {
        ...wiresStep('power', [link(leftMix, 'out', leftMotor, 'power'), link(rightMix, 'out', rightMotor, 'power')]),
        title: T.power.title,
        text: T.power.text,
        explain: T.power.explain,
      },
      play('play', T.play, true),
      play('back-to-edit', T.edit, false),
      {
        ...paramStep('heavy', body, 'mass', (n) => (numParam(n, 'mass') ?? 0) >= 10),
        title: T.heavy.title,
        text: T.heavy.text,
        explain: T.heavy.explain,
      },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
