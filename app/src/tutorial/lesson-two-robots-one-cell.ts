import type { Endpoint, NodeFilter } from './graph-checks';
import { paramOf } from './graph-checks';
import { robotsHeld } from './grid-lesson-checks';
import { ORANGE, CROSSING_SCENE_WIRES, GREEN, crossingScene, crossingSecondRobotY } from './grid-lesson-scenes';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson, Snapshot } from './types';

/**
 * "Hai robot, một ô": two robots that each find their way on a floor shaped like a plus, and whose ways cross in the
 * middle cell. The learner first runs the board and sees them collide, then adds the table of held cells and passes each
 * robot's request and permission through it, so only one robot enters the middle cell at a time.
 */

const T = {
  title: 'Hai robot, một ô',
  summary: 'Dùng Bảng giữ ô để hai robot đi qua cùng một ô mà không đụng nhau.',
  boardName: 'Hai robot, một ô',
  intro: {
    title: 'Hai đường cắt nhau',
    text: 'Nhìn từ trên xuống: sàn hình chữ thập. Robot màu cam đi từ ô 4 sang ô 6, robot xanh lá đi từ ô 2 xuống ô 8. Mỗi robot đã có đủ bộ tìm đường như bài trước. Cả hai đều phải đi qua ô 5 ở giữa.',
    explain: 'Mảnh "Va chạm" bên phải canh hai thân robot: chạm nhau là Thua. Cả hai đứng vào giữa ô đích của mình là Thắng.',
  },
  play1: { title: 'Chạy thử xem sao', text: 'Bấm Chạy và nhìn ô 5 ở giữa.' },
  crash: {
    title: 'Nhìn ô 5',
    text: 'Hai robot cùng lao vào ô 5 một lúc. Chờ xem chuyện gì xảy ra.',
    explain: 'Tìm đường trên lưới chỉ biết mũi tên trên sàn, không biết có robot khác.',
  },
  hold: {
    title: 'Thêm Bảng giữ ô',
    text: 'Hai robot đụng nhau, vì không ai biết ô 5 đã có xe khác muốn vào. Bấm Dừng, rồi kéo mảnh "Bảng giữ ô" (nhóm Bộ não) vào bảng.',
    explain: 'Luật của bảng chỉ có một câu: mỗi ô chỉ một xe. Xe giữ ô mình đang đứng, muốn sang ô khác thì xin, ô trống mới được đi.',
  },
  robot1: {
    title: 'Bảng phải biết robot',
    text: 'Nối "Đối tượng" của Thân robot màu cam (phía trên) sang "Robot 1" của Bảng giữ ô.',
    explain: 'Bảng nhìn chỗ robot đứng để biết thân nó đang đè lên những ô nào.',
  },
  want1: {
    title: 'Xin ô kế tiếp',
    text: 'Nối "Ô kế tiếp" của Tìm đường trên lưới phía trên sang "Ô robot 1 muốn tới" của Bảng giữ ô.',
    explain: 'Trước đây "Ô kế tiếp" đi thẳng tới bộ lái. Giờ nó là lời xin gửi cho bảng.',
  },
  cell1: {
    title: 'Được phép mới đi',
    text: 'Nối "Ô robot 1 được đi" sang "Số mốc" của Tìm mốc sàn phía trên. Sợi dây cũ ở cổng đó tự được thay.',
    explain: 'Robot chỉ lái tới ô mà bảng cho phép. Ô chưa trống thì nó đứng chờ ở giữa ô của mình.',
  },
  robot2: { title: 'Tới lượt robot xanh lá', text: 'Nối "Đối tượng" của Thân robot xanh lá (phía dưới) sang "Robot 2" của Bảng giữ ô.' },
  want2: { title: 'Robot 2 xin ô', text: 'Nối "Ô kế tiếp" của Tìm đường trên lưới phía dưới sang "Ô robot 2 muốn tới".' },
  cell2: { title: 'Robot 2 chờ được phép', text: 'Nối "Ô robot 2 được đi" sang "Số mốc" của Tìm mốc sàn phía dưới.' },
  play2: {
    title: 'Chạy lại',
    text: 'Bấm Chạy. Ô nào đang có robot giữ thì đổi sang màu đỏ. Hai robot cùng xin ô 5: robot nối vào hàng số nhỏ hơn của bảng được vào trước, robot kia đứng chờ ở ô của mình cho tới khi ô 5 trống.',
    explain: 'Hai robot xin cùng một ô trong cùng một nhịp thì robot số nhỏ hơn được đi.',
  },
  won: {
    title: 'Chờ hai robot tới đích',
    text: 'Robot màu cam tới ô 6, robot xanh lá tới ô 8. Không ai đụng ai thì trò chơi báo Thắng.',
  },
  done: {
    title: 'Xong rồi!',
    text: 'Hai robot đã qua cùng một ô mà không đụng nhau: mỗi ô chỉ một xe. Thử gỡ sợi dây "Ô robot 2 được đi" rồi bấm Chạy: robot xanh lá đứng im, vì không ai cho nó đi.',
  },
};

const isColor = (color: string): NodeFilter => (n) => paramOf(n, 'color') === color;
/** Cards of the second robot are drawn in the lower band of the board. The hints point there; the checks follow the wires instead. */
const isBand = (k: 1 | 2): NodeFilter => (n) => (k === 1 ? n.pos.y < crossingSecondRobotY() : n.pos.y >= crossingSecondRobotY());

const BODY = (k: 1 | 2): Endpoint => ({ kind: 'robot-body', port: 'self', where: isColor(k === 1 ? ORANGE : GREEN) });
const ROUTE_NEXT = (k: 1 | 2): Endpoint => ({ kind: 'grid-route', port: 'next', where: isBand(k) });
const FIND_NUMBER = (k: 1 | 2): Endpoint => ({ kind: 'floor-marker-find', port: 'number', where: isBand(k) });
const HOLD = (port: string): Endpoint => ({ kind: 'cell-hold', port });

export function createTwoRobotsOneCellLesson(kit: LessonKit): Lesson {
  /** The three wires of one robot. The hints name row k of the card; the checks take any row, as long as the three wires of a robot use the same one. */
  const robotSteps = (k: 1 | 2) => {
    const held =
      (level: 1 | 2 | 3) =>
      (s: Snapshot): boolean =>
        robotsHeld(s.graph, level) >= k;
    return {
      robot: { id: `wire-robot-${k}`, target: kit.wireStep('', BODY(k), HOLD(`robot${k}`)).target, check: held(1) },
      want: { id: `wire-want-${k}`, target: kit.wireStep('', ROUTE_NEXT(k), HOLD(`want${k}`)).target, check: held(2) },
      cell: { id: `wire-cell-${k}`, target: kit.wireStep('', HOLD(`cell${k}`), FIND_NUMBER(k)).target, check: held(3) },
    };
  };
  const r1 = robotSteps(1);
  const r2 = robotSteps(2);
  return {
    id: 'two-robots-one-cell',
    title: T.title,
    summary: T.summary,
    createBoard: () => ({ ...kit.buildBoard(T.boardName, crossingScene(), CROSSING_SCENE_WIRES), mode: '2d-top' }),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { id: 'play-1', title: T.play1.title, text: T.play1.text, target: () => [kit.playButton], check: (s) => s.playing },
      // The problem first: without the hold card the two chassis meet in the middle cell and the board's own judge says so.
      { id: 'crash', title: T.crash.title, text: T.crash.text, explain: T.crash.explain, check: (s) => s.ended === 'lose' },
      { ...kit.addStep('add-hold', 'cell-hold'), title: T.hold.title, text: T.hold.text, explain: T.hold.explain },
      { ...r1.robot, title: T.robot1.title, text: T.robot1.text, explain: T.robot1.explain },
      { ...r1.want, title: T.want1.title, text: T.want1.text, explain: T.want1.explain },
      { ...r1.cell, title: T.cell1.title, text: T.cell1.text, explain: T.cell1.explain },
      { ...r2.robot, title: T.robot2.title, text: T.robot2.text },
      { ...r2.want, title: T.want2.title, text: T.want2.text },
      { ...r2.cell, title: T.cell2.title, text: T.cell2.text },
      // A new run, not the lost one still on screen.
      { id: 'play-2', title: T.play2.title, text: T.play2.text, explain: T.play2.explain, target: () => [kit.playButton], check: (s) => s.playing && s.ended === null },
      // Both robots on their goal cells without touching, and both still wired through the hold card.
      { id: 'win', title: T.won.title, text: T.won.text, check: (s) => s.ended === 'win' && robotsHeld(s.graph, 3) >= 2 },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
