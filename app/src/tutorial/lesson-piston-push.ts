import { PUSH_TRIGGER_WIRES, pushScene } from '../handbook/boards-linear-actuator';
import type { Endpoint } from './graph-checks';
import { numParam } from './graph-checks';
import { paramStep } from './lesson-param-step';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * "Xi lanh đẩy thùng": a platform, a 30 kg crate and a zone sensor that already detects it. The learner adds a piston, wires the
 * trigger to it, finds out that the default 100 N cannot push 0.5 x 30 x 9.81 = 147 N, and raises the maximum force.
 */

/** Maximum force (N) the 30 kg crate needs: 0.5 x 30 x 9.81 = 147.15 N, rounded up. */
export const PUSH_FORCE_N = 150;

const T = {
  title: 'Xi lanh đẩy thùng',
  summary: 'Dùng xi lanh đẩy một thùng nặng khỏi bệ, và tìm lực đẩy tối đa vừa đủ.',
  boardName: 'Xi lanh đẩy thùng',
  intro: {
    title: 'Đẩy thùng khỏi bệ',
    text: 'Bảng này có một cái bệ, một thùng nặng 30 kg ở mép bệ và một "Vùng kích hoạt" đã được nối với "Chốt nhớ": thấy thùng là chốt bật. Ta sẽ lắp xi lanh để đẩy thùng rơi khỏi bệ.',
    explain: 'Mỗi mảnh là một bộ phận thật có lực giới hạn. Xem trang "Vật lý kỹ thuật" ở đầu Sổ tay.',
  },
  piston: {
    title: 'Thêm xi lanh',
    text: 'Kéo mảnh "Xi lanh đẩy" (nhóm Hành động) vào bảng.',
    explain: 'Xi lanh nằm ở gốc bệ, đẩy sang phải. Thanh dài 2 m, đẩy tối đa 100 N.',
  },
  extend: {
    title: 'Ra lệnh đẩy',
    text: 'Nối "Đang bật" của Chốt nhớ sang "Đẩy ra" của Xi lanh đẩy.',
    explain: 'Chưa có dây thì xi lanh nằm yên: mọi việc đều cần một sợi dây.',
  },
  reset: {
    title: 'Rút về khi đã ra hết',
    text: 'Nối "Đã ra hết" của Xi lanh đẩy sang "Tắt" của Chốt nhớ.',
  },
  play1: {
    title: 'Thử đẩy',
    text: 'Bấm Chơi. Xi lanh chạm thùng rồi đứng lại, và báo "Quá tải".',
    explain: 'Lực cần để đẩy: F = μ × m × 9,81 = 0,5 × 30 × 9,81 = 147 N. Xi lanh chỉ có 100 N nên không đẩy nổi.',
  },
  force: {
    title: 'Tăng lực đẩy',
    text: 'Bấm Dừng. Chọn Xi lanh đẩy và đặt "Lực đẩy tối đa" thành 150 N hoặc hơn.',
    explain: 'Đẩy được khi lực tối đa ≥ μ × m × 9,81 = 147 N. Thùng nhẹ hơn thì cần ít lực hơn.',
  },
  play2: { title: 'Đẩy lại', text: 'Bấm Chơi: lần này xi lanh đẩy thùng rơi khỏi bệ.' },
  done: {
    title: 'Xong rồi!',
    text: 'Bạn đã làm một cơ cấu đẩy tự động: cảm biến thấy thùng, xi lanh đẩy, rồi tự dừng khi ra hết. Thử gắn tay kẹp vào "Đầu đẩy" hoặc đặt thùng nặng hơn!',
  },
};

const NODES = pushScene(30);
const WIRES = PUSH_TRIGGER_WIRES.filter(([from, , to]) => from === 'zone' && to === 'latch');

const LATCH_ON: Endpoint = { kind: 'latch', port: 'on' };
const LATCH_RESET: Endpoint = { kind: 'latch', port: 'reset' };
const PISTON_EXTEND: Endpoint = { kind: 'linear-actuator', port: 'extend' };
const PISTON_EXTENDED: Endpoint = { kind: 'linear-actuator', port: 'extended' };

export function createPistonPushLesson(kit: LessonKit): Lesson {
  return {
    id: 'piston-push',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-piston', 'linear-actuator'), title: T.piston.title, text: T.piston.text, explain: T.piston.explain },
      { ...kit.wireStep('wire-extend', LATCH_ON, PISTON_EXTEND), title: T.extend.title, text: T.extend.text, explain: T.extend.explain },
      { ...kit.wireStep('wire-reset', PISTON_EXTENDED, LATCH_RESET), title: T.reset.title, text: T.reset.text },
      { id: 'play-1', title: T.play1.title, text: T.play1.text, explain: T.play1.explain, target: () => [kit.playButton], check: (s) => s.playing },
      {
        ...paramStep({
          id: 'push-force',
          kind: 'linear-actuator',
          param: 'maxForce',
          done: (n) => (numParam(n, 'maxForce') ?? 0) >= PUSH_FORCE_N,
        }),
        title: T.force.title,
        text: T.force.text,
        explain: T.force.explain,
      },
      { id: 'play-2', title: T.play2.title, text: T.play2.text, target: () => [kit.playButton], check: (s) => s.playing },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
