import { ROBOT_NAV_SCENE_WIRES, STANDING_ON_LABEL, robotNavScene } from '../handbook/boards-robot-nav';
import type { Endpoint, NodeFilter } from './graph-checks';
import { numParam, paramOf } from './graph-checks';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * "Robot tự tới mốc": the board has a robot with two motors that nothing drives, floor markers 2 and 3, and a number card
 * that says which marker to go to. The learner paints marker 1, adds the number-to-marker lookup and the driver, wires the
 * driver to the two motors, and last adds the reader that tells which marker the robot stands on.
 */

const T = {
  title: 'Robot tự tới mốc',
  summary: 'Cho robot tự chạy tới một ô mốc đánh số trên sàn và biết mình đang đứng ở mốc nào.',
  boardName: 'Robot tự tới mốc',
  intro: {
    title: 'Sàn kho có đánh số',
    text: 'Nhìn từ trên xuống: một robot có hai động cơ nhưng chưa ai lái, và hai ô mốc số 2, số 3 sơn trên sàn. Số cố định bên trái (đang là 2) là số mốc ta muốn robot tới.',
    explain: 'Xe tự hành trong kho hàng thật cũng chạy trên sàn trống và tìm đường theo các mốc đánh số.',
  },
  marker: {
    title: 'Sơn thêm Mốc số 1',
    text: 'Kéo mảnh "Mốc sàn" (nhóm Vật thể) vào bảng. Nó mang số 1 và nằm giữa sàn.',
    explain: 'Mốc sàn chỉ là hình sơn: robot chạy đè lên được. Số và vị trí của nó chỉnh ở Thuộc tính.',
  },
  find: {
    title: 'Thêm Tìm mốc sàn',
    text: 'Kéo mảnh "Tìm mốc sàn" (nhóm Logic) vào bảng.',
    explain: 'Mảnh này đổi một con số thành đúng ô mốc mang số đó.',
  },
  number: { title: 'Đưa số mốc vào', text: 'Nối "Giá trị" của Số cố định sang "Số mốc" của Tìm mốc sàn.' },
  drive: {
    title: 'Thêm Đi tới điểm',
    text: 'Kéo mảnh "Đi tới điểm" (nhóm Bộ não) vào bảng.',
    explain: 'Đây là bộ lái: nó tính công suất cho bánh trái và bánh phải để robot chạy tới đích.',
  },
  robot: { title: 'Lái robot nào?', text: 'Nối "Đối tượng" của Thân robot sang "Robot" của Đi tới điểm.' },
  target: { title: 'Tới đâu?', text: 'Nối "Mốc" của Tìm mốc sàn sang "Đích" của Đi tới điểm.' },
  go: {
    title: 'Cho phép chạy',
    text: 'Nối "Đã bắt đầu" của Khi bắt đầu sang "Chạy" của Đi tới điểm.',
    explain: 'Tắt "Chạy" là robot dừng. Sau này bạn có thể nối cảm biến vào đây để robot nhường đường.',
  },
  left: {
    title: 'Nối bánh trái',
    text: 'Nối "Trái" của Đi tới điểm sang "Công suất" của Động cơ phía trên (bánh trái).',
    explain: 'Đi tới điểm chỉ ra lệnh. Chính động cơ và bánh xe mới đẩy robot đi.',
  },
  right: { title: 'Nối bánh phải', text: 'Nối "Phải" sang "Công suất" của Động cơ phía dưới (bánh phải).' },
  play1: {
    title: 'Xem robot chạy',
    text: 'Bấm Chạy. Robot quay mũi về phía Mốc số 2, chạy tới, chậm dần rồi dừng giữa ô.',
    explain: 'Đang chạy, thử đổi "Giá trị" của Số cố định thành 1 hoặc 3: robot đổi hướng ngay.',
  },
  reader: {
    title: 'Thêm Đọc mốc sàn',
    text: 'Bấm Dừng. Kéo mảnh "Đọc mốc sàn" (nhóm Logic) vào bảng.',
    explain: 'Giống robot kho hàng đọc mã dán dưới sàn để biết mình đang ở đâu.',
  },
  who: { title: 'Ai đọc mốc?', text: 'Nối "Đối tượng" của Thân robot sang "Đối tượng" của Đọc mốc sàn.' },
  show: { title: 'Hiện số mốc', text: `Nối "Số mốc" của Đọc mốc sàn sang "Giá trị" của Hiện số "${STANDING_ON_LABEL}".` },
  play2: {
    title: 'Chạy lại',
    text: `Bấm Chạy. "${STANDING_ON_LABEL}" là 0 lúc robot đang trên đường và đổi thành 2 khi nó vào ô mốc số 2.`,
  },
  done: {
    title: 'Xong rồi!',
    text: 'Robot của bạn đã tự tìm tới một mốc theo số. Thử thêm mốc số 4 ở chỗ khác rồi đổi Số cố định thành 4, hoặc thay Số cố định bằng một Bộ đếm để robot đi lần lượt qua các mốc!',
  },
};

const isStanding: NodeFilter = (n) => paramOf(n, 'label') === STANDING_ON_LABEL;
const isLeft: NodeFilter = (n) => (numParam(n, 'side') ?? 0) < 0;
const isRight: NodeFilter = (n) => (numParam(n, 'side') ?? 0) > 0;

const WANTED: Endpoint = { kind: 'const', port: 'value' };
const FIND_NUMBER: Endpoint = { kind: 'floor-marker-find', port: 'number' };
const FIND_MARKER: Endpoint = { kind: 'floor-marker-find', port: 'marker' };
const BODY: Endpoint = { kind: 'robot-body', port: 'self' };
const STARTED: Endpoint = { kind: 'on-start', port: 'started' };
const DRIVE = (port: string): Endpoint => ({ kind: 'robot-goto', port });
const MOTOR = (where: NodeFilter): Endpoint => ({ kind: 'motor', port: 'power', where });
const READER_WHO: Endpoint = { kind: 'floor-marker-sensor', port: 'who' };
const READER_NUMBER: Endpoint = { kind: 'floor-marker-sensor', port: 'number' };
const SHOW: Endpoint = { kind: 'show-number', port: 'value', where: isStanding };

export function createRobotToMarkerLesson(kit: LessonKit): Lesson {
  const play = (id: string) => ({ id, target: () => [kit.playButton], check: (s: { playing: boolean }) => s.playing });
  return {
    id: 'robot-to-marker',
    title: T.title,
    summary: T.summary,
    createBoard: () => ({ ...kit.buildBoard(T.boardName, robotNavScene(), ROBOT_NAV_SCENE_WIRES), mode: '2d-top' }),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      // The board starts with markers 2 and 3: the third one is the learner's.
      { ...kit.addStep('add-marker', 'floor-marker', 3), title: T.marker.title, text: T.marker.text, explain: T.marker.explain },
      { ...kit.addStep('add-find', 'floor-marker-find'), title: T.find.title, text: T.find.text, explain: T.find.explain },
      { ...kit.wireStep('wire-number', WANTED, FIND_NUMBER), title: T.number.title, text: T.number.text },
      { ...kit.addStep('add-drive', 'robot-goto'), title: T.drive.title, text: T.drive.text, explain: T.drive.explain },
      { ...kit.wireStep('wire-robot', BODY, DRIVE('robot')), title: T.robot.title, text: T.robot.text },
      { ...kit.wireStep('wire-target', FIND_MARKER, DRIVE('target')), title: T.target.title, text: T.target.text },
      { ...kit.wireStep('wire-go', STARTED, DRIVE('go')), title: T.go.title, text: T.go.text, explain: T.go.explain },
      { ...kit.wireStep('wire-left', DRIVE('left'), MOTOR(isLeft)), title: T.left.title, text: T.left.text, explain: T.left.explain },
      { ...kit.wireStep('wire-right', DRIVE('right'), MOTOR(isRight)), title: T.right.title, text: T.right.text },
      { ...play('play-1'), title: T.play1.title, text: T.play1.text, explain: T.play1.explain },
      { ...kit.addStep('add-reader', 'floor-marker-sensor'), title: T.reader.title, text: T.reader.text, explain: T.reader.explain },
      { ...kit.wireStep('wire-who', BODY, READER_WHO), title: T.who.title, text: T.who.text },
      { ...kit.wireStep('wire-show', READER_NUMBER, SHOW), title: T.show.title, text: T.show.text },
      { ...play('play-2'), title: T.play2.title, text: T.play2.text },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
