import { STOP_BUTTON, type Resolve, first, link, wiresStep } from './lesson-b-helpers';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * "Giữ đúng mục tiêu với PID": a robot, a target that jumps between two places and a floor. The learner adds a PID
 * controller to make the robot follow the target, then a signal plot to watch target, position and control.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

const T = {
  title: 'Giữ đúng mục tiêu với PID',
  summary: 'Cho rô-bốt tự đuổi theo một vị trí đặt bằng bộ điều khiển PID, rồi xem kết quả trên đồ thị.',
  boardName: 'Rô-bốt đuổi mục tiêu',
  intro: {
    title: 'Rô-bốt cần một bộ điều khiển',
    text: 'Bảng có sẵn một rô-bốt, một sàn, và một "vị trí đặt" cứ vài giây lại nhảy từ trái sang phải rồi quay lại (từ Hẹn giờ và Quy đổi khoảng). Ta sẽ cho rô-bốt tự đuổi theo vị trí đó.',
    explain: 'Bộ điều khiển PID nhìn độ lệch giữa chỗ đang đứng và chỗ cần tới, rồi tự tính lệnh đi vừa đủ.',
  },
  pid: {
    title: 'Thêm bộ điều khiển PID',
    text: 'Kéo mảnh ghép "Bộ điều khiển PID" (nhóm Tính toán) vào bảng.',
    explain: 'Kp quyết định đẩy mạnh bao nhiêu theo độ lệch. Ki xóa độ lệch còn sót, Kd hãm bớt khi tới quá nhanh.',
  },
  wireIn: {
    title: 'Cho PID nhìn và biết đích',
    text: 'Nối "Vị trí ngang" của rô-bốt sang "Giá trị đo" của PID, và "Giá trị ra" của Quy đổi khoảng sang "Giá trị đặt" của PID.',
    explain: '"Giá trị đo" là mắt của bộ điều khiển. "Giá trị đặt" là chỗ muốn tới.',
  },
  wireOut: {
    title: 'Cho lệnh đi vào rô-bốt',
    text: 'Nối "Điều khiển" của PID sang "Đi ngang" của rô-bốt.',
    explain: 'Lệnh nằm giữa -1 và 1: -1 là hết cỡ sang trái, 1 là hết cỡ sang phải, 0 là đứng yên.',
  },
  plot: {
    title: 'Thêm đồ thị',
    text: 'Kéo mảnh ghép "Đồ thị tín hiệu" (nhóm Kết quả) vào bảng.',
    explain: 'Đồ thị vẽ tối đa ba con số theo thời gian, giống máy hiện sóng.',
  },
  wirePlot: {
    title: 'Vẽ ba đường',
    text: 'Nối "Giá trị ra" của Quy đổi khoảng sang "Tín hiệu 1", "Vị trí ngang" của rô-bốt sang "Tín hiệu 2", và "Điều khiển" của PID sang "Tín hiệu 3".',
  },
  play: { title: 'Chạy thử', text: 'Bấm Chạy. Rô-bốt đuổi theo vị trí đặt, và đồ thị ở góc phải cho thấy đường vị trí bám theo đường giá trị đặt.' },
  done: {
    title: 'Xong rồi!',
    text: 'Bấm vào mảnh PID rồi thử đổi Kp (nhỏ hơn thì chậm và êm, lớn hơn thì nhanh). Xem thêm Ki, Kd và các ô nâng cao trong Sổ tay.',
  },
};

const NODES: BuildArgs[1] = [
  { alias: 'start', kind: 'on-start', x: 20, y: 20 },
  { alias: 'clock', kind: 'timer', x: 20, y: 200, params: { seconds: 8, repeat: 'yes' } },
  { alias: 'target', kind: 'map-range', x: 270, y: 20, params: { inMin: 3.99, inMax: 4.01, outMin: -5, outMax: 5 } },
  { alias: 'robot', kind: 'character', x: 270, y: 200, params: { position: { x: -5, y: 1, z: 0 }, color: '#3b82f6', look: 'robot', speed: 4 } },
  { alias: 'floor', kind: 'block', x: 270, y: 560, params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 24, y: 1, z: 1 }, color: '#65a30d' } },
];
const WIRES: BuildArgs[2] = [
  ['start', 'started', 'clock', 'run'],
  ['clock', 'left', 'target', 'value'],
];

const robot: Resolve = (g) => first(g, 'character');
const target: Resolve = (g) => first(g, 'map-range');
const pid: Resolve = (g) => first(g, 'pid');
const plot: Resolve = (g) => first(g, 'signal-plot');

export function createPidControlLesson(kit: LessonKit): Lesson {
  const play = (id: string, t: { title: string; text: string }, on: boolean) => ({
    id,
    title: t.title,
    text: t.text,
    target: () => [on ? kit.playButton : STOP_BUTTON],
    check: (s: { playing: boolean }) => s.playing === on,
  });
  return {
    id: 'pid-control',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-pid', 'pid'), title: T.pid.title, text: T.pid.text, explain: T.pid.explain },
      {
        ...wiresStep('wire-in', [link(robot, 'x', pid, 'measured'), link(target, 'value', pid, 'target')]),
        title: T.wireIn.title,
        text: T.wireIn.text,
        explain: T.wireIn.explain,
      },
      { ...wiresStep('wire-out', [link(pid, 'out', robot, 'moveX')]), title: T.wireOut.title, text: T.wireOut.text, explain: T.wireOut.explain },
      { ...kit.addStep('add-plot', 'signal-plot'), title: T.plot.title, text: T.plot.text, explain: T.plot.explain },
      {
        ...wiresStep('wire-plot', [link(target, 'value', plot, 'a'), link(robot, 'x', plot, 'b'), link(pid, 'out', plot, 'c')]),
        title: T.wirePlot.title,
        text: T.wirePlot.text,
      },
      play('play', T.play, true),
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
