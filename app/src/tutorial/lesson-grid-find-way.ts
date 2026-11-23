import type { Endpoint } from './graph-checks';
import { followsRoute, robotsOf } from './grid-lesson-checks';
import { FIND_WAY_SCENE_WIRES, findWayScene } from './grid-lesson-scenes';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson, Snapshot } from './types';

/**
 * "Robot tự tìm đường trên lưới": a floor of nine numbered cells with arrows, a robot on cell 1 whose driver already
 * drives the two motors but has nowhere to go, and the number of the goal cell. The learner adds the marker reader, the
 * route finder and the number-to-marker lookup, so the driver is sent to one next cell at a time. The lesson is done when
 * the robot stands on the goal cell, which it can only reach along the arrows by turning once.
 */

const T = {
  title: 'Robot tự tìm đường trên lưới',
  summary: 'Cho robot tự chọn từng ô kế tiếp theo mũi tên trên sàn để tới ô đích.',
  boardName: 'Robot tự tìm đường trên lưới',
  intro: {
    title: 'Sàn kẻ ô có mũi tên',
    text: 'Nhìn từ trên xuống: sàn có 9 ô mốc đánh số 1 đến 9, mỗi ô có mũi tên chỉ chiều được đi. Robot đứng ở ô 1. Số cố định bên trái (đang là 8) là ô đích. Mảnh "Đi tới điểm" đã nối sẵn hai động cơ, nhưng chưa biết phải tới đâu.',
    explain: 'Trong kho hàng thật, xe tự hành chạy theo làn một chiều để không đâm đầu vào nhau.',
  },
  reader: {
    title: 'Thêm Đọc mốc sàn',
    text: 'Kéo mảnh "Đọc mốc sàn" (nhóm Logic) vào bảng.',
    explain: 'Muốn tìm đường thì trước hết robot phải biết mình đang đứng ở ô nào.',
  },
  who: { title: 'Ai đọc mốc?', text: 'Nối "Đối tượng" của Thân robot sang "Đối tượng" của Đọc mốc sàn.' },
  route: {
    title: 'Thêm Tìm đường trên lưới',
    text: 'Kéo mảnh "Tìm đường trên lưới" (nhóm Tính toán) vào bảng.',
    explain: 'Mảnh này là tấm bản đồ: nó đọc các mũi tên trên sàn và chỉ ra ô kế tiếp phải sang, theo đường ngắn nhất.',
  },
  at: { title: 'Đang đứng ở đâu?', text: 'Nối "Số mốc" của Đọc mốc sàn sang "Ô đang đứng" của Tìm đường trên lưới.' },
  goal: { title: 'Muốn tới đâu?', text: 'Nối "Giá trị" của Số cố định sang "Ô đích" của Tìm đường trên lưới.' },
  find: {
    title: 'Thêm Tìm mốc sàn',
    text: 'Kéo mảnh "Tìm mốc sàn" (nhóm Logic) vào bảng.',
    explain: '"Ô kế tiếp" mới chỉ là một con số. Tìm mốc sàn đổi con số đó thành đúng ô mốc trên sàn.',
  },
  next: { title: 'Ô kế tiếp là ô nào?', text: 'Nối "Ô kế tiếp" của Tìm đường trên lưới sang "Số mốc" của Tìm mốc sàn.' },
  target: {
    title: 'Lái tới ô kế tiếp',
    text: 'Nối "Mốc" của Tìm mốc sàn sang "Đích" của Đi tới điểm.',
    explain: 'Robot chỉ lái tới ô kế tiếp. Vào ô đó rồi thì "Ô kế tiếp" đổi sang ô sau nữa, cứ thế cho tới ô đích.',
  },
  play: {
    title: 'Xem robot tìm đường',
    text: 'Bấm Chạy. Robot đi về phía ô 2, rẽ xuống ô 5 rồi tới ô 8. Robot có thể rẽ sớm và cắt qua góc ô; ở bài sau, "Bảng giữ ô" sẽ bắt nó vào giữa ô rồi mới rẽ.',
    explain: 'Ô 2 có hai mũi tên. Robot rẽ xuống vì lối đó chỉ còn 2 ô nữa là tới; đi vòng ngoài thì còn 4 ô.',
  },
  won: {
    title: 'Chờ robot tới ô 8',
    text: 'Mảnh "Đo khoảng cách" bên phải canh ô 8: robot đứng vào giữa ô đích thì trò chơi báo Thắng.',
  },
  done: {
    title: 'Xong rồi!',
    text: 'Robot của bạn đã tự tìm đường theo mũi tên. Thử đổi Số cố định thành 4 rồi bấm Chạy: ô 4 ở ngay dưới ô 1 nhưng robot phải đi vòng qua ô 2, 5, 8, 7, vì không mũi tên nào cho đi ngược chiều. Lần đó không có chữ Thắng, vì mảnh Đo khoảng cách chỉ canh ô 8.',
  },
};

const BODY: Endpoint = { kind: 'robot-body', port: 'self' };
const GOAL: Endpoint = { kind: 'const', port: 'value' };
const READER_WHO: Endpoint = { kind: 'floor-marker-sensor', port: 'who' };
const READER_NUMBER: Endpoint = { kind: 'floor-marker-sensor', port: 'number' };
const ROUTE = (port: string): Endpoint => ({ kind: 'grid-route', port });
const FIND_NUMBER: Endpoint = { kind: 'floor-marker-find', port: 'number' };
const FIND_MARKER: Endpoint = { kind: 'floor-marker-find', port: 'marker' };
const DRIVE_TARGET: Endpoint = { kind: 'robot-goto', port: 'target' };

/** The robot is sent where its own route finder says: reader → route finder → lookup → driver, all on one chassis. */
const routed = (s: Snapshot): boolean => robotsOf(s.graph).some((r) => followsRoute(s.graph, r));

export function createGridFindWayLesson(kit: LessonKit): Lesson {
  return {
    id: 'grid-find-way',
    title: T.title,
    summary: T.summary,
    createBoard: () => ({ ...kit.buildBoard(T.boardName, findWayScene(), FIND_WAY_SCENE_WIRES), mode: '2d-top' }),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-reader', 'floor-marker-sensor'), title: T.reader.title, text: T.reader.text, explain: T.reader.explain },
      { ...kit.wireStep('wire-who', BODY, READER_WHO), title: T.who.title, text: T.who.text },
      { ...kit.addStep('add-route', 'grid-route'), title: T.route.title, text: T.route.text, explain: T.route.explain },
      { ...kit.wireStep('wire-at', READER_NUMBER, ROUTE('at')), title: T.at.title, text: T.at.text },
      { ...kit.wireStep('wire-goal', GOAL, ROUTE('goal')), title: T.goal.title, text: T.goal.text },
      { ...kit.addStep('add-find', 'floor-marker-find'), title: T.find.title, text: T.find.text, explain: T.find.explain },
      { ...kit.wireStep('wire-next', ROUTE('next'), FIND_NUMBER), title: T.next.title, text: T.next.text },
      // Any lookup wired to the driver would move the robot; only the one fed by the route finder follows the arrows.
      { id: 'wire-target', target: kit.wireStep('', FIND_MARKER, DRIVE_TARGET).target, check: routed, title: T.target.title, text: T.target.text, explain: T.target.explain },
      { id: 'play', title: T.play.title, text: T.play.text, explain: T.play.explain, target: () => [kit.playButton], check: (s) => s.playing },
      // The win comes from the cards on the board (robot on the middle of the goal cell), and counts only with the route still wired.
      { id: 'win', title: T.won.title, text: T.won.text, check: (s) => s.ended === 'win' && routed(s) },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
