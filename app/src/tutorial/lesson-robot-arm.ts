import type { Endpoint, NodeFilter } from './graph-checks';
import { numParam, paramOf } from './graph-checks';
import { paramStep } from './lesson-param-step';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * "Tay máy gắp thùng": a pillar, a table with a 2.5 kg crate and the arrow keys already wired to an angle. The learner
 * builds the arm from a joint, a link and a gripper, finds out that the default grip lets the crate slip, and raises the grip force.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

/** Grip force (N per finger) the crate needs: 2.5 kg x 9.81 / (2 fingers x mu 0.5) = 24.5 N, rounded up. */
export const GRIP_FORCE_N = 25;

const T = {
  title: 'Tay máy gắp thùng',
  summary: 'Lắp khớp, thanh nối và tay kẹp thành một cánh tay, rồi tìm lực kẹp vừa đủ để thùng không tuột.',
  boardName: 'Tay máy gắp thùng',
  intro: {
    title: 'Cánh tay của nhà máy',
    text: 'Bảng này có một cái cột, một cái bàn và một thùng nặng 2,5 kg. Các mũi tên đã nối sẵn với một số "góc". Ta sẽ lắp cánh tay lên cột: khớp, thanh nối, tay kẹp, rồi gắp thùng.',
    explain: 'Mỗi mảnh là một bộ phận thật có khối lượng và lực. Xem trang "Vật lý kỹ thuật" ở đầu Sổ tay.',
  },
  joint: {
    title: 'Thêm khớp',
    text: 'Kéo mảnh ghép "Khớp xoay (Servo)" (nhóm Hành động) vào bảng.',
    explain: 'Khớp là động cơ servo: quay tới góc đặt, nhưng chỉ khi đủ mô-men để giữ phần tay phía sau.',
  },
  jointBase: {
    title: 'Gắn khớp lên cột',
    text: 'Nối "Đối tượng" của Vật thể màu cam (đầu cột) sang "Gắn vào" của Khớp xoay.',
  },
  link: {
    title: 'Thêm thanh nối',
    text: 'Kéo mảnh "Thanh nối" (nhóm Vật thể) vào bảng.',
    explain: 'Thanh dài 1 m, nặng 1 kg. Khối lượng của nó là tải mà khớp phải giữ.',
  },
  linkBase: {
    title: 'Gắn thanh vào khớp',
    text: 'Nối "Đầu khớp" của Khớp xoay sang "Gắn vào" của Thanh nối.',
  },
  gripper: {
    title: 'Thêm tay kẹp',
    text: 'Kéo mảnh "Tay kẹp" (nhóm Hành động) vào bảng.',
  },
  gripperBase: {
    title: 'Gắn tay kẹp vào thanh',
    text: 'Nối "Đầu thanh" của Thanh nối sang "Gắn vào" của Tay kẹp.',
  },
  angle: {
    title: 'Điều khiển góc',
    text: 'Nối "Giá trị ra" của Quy đổi khoảng sang "Góc đặt" của Khớp xoay.',
    explain: 'Mũi tên lên / xuống cho số từ -1 đến 1; Quy đổi khoảng đổi nó thành góc từ -15 đến 30 độ.',
  },
  power: {
    title: 'Bật servo',
    text: 'Nối "Đã bắt đầu" của mảnh Khi bắt đầu sang "Bật" của Khớp xoay.',
    explain: 'Servo chưa được bật thì buông tay, cánh tay sẽ sụp xuống. Mọi việc đều cần một sợi dây.',
  },
  close: {
    title: 'Nút kẹp',
    text: 'Nối "Đang giữ phím" của Phím bấm (phím Cách) sang "Kẹp" của Tay kẹp.',
  },
  play1: {
    title: 'Thử gắp',
    text: 'Bấm Chơi. Giữ mũi tên xuống để hạ tay tới thùng, giữ phím Cách để kẹp, rồi thả mũi tên xuống và giữ mũi tên lên. Thùng sẽ tuột!',
    explain: 'Lực kẹp mặc định là 20 N mỗi ngón. Thùng 2,5 kg nặng 2,5 × 9,81 = 24,5 N, mà 2 ngón × 0,5 (ma sát) × 20 N chỉ giữ được 20 N.',
  },
  force: {
    title: 'Tăng lực kẹp',
    text: 'Bấm Dừng. Chọn Tay kẹp và đặt "Lực kẹp mặc định" thành 25 N hoặc hơn.',
    explain: 'Giữ được khi: số ngón × ma sát × lực ≥ khối lượng × 9,81, tức 2 × 0,5 × lực ≥ 24,5 N. Kẹp quá mạnh thì thùng dễ vỡ sẽ hỏng, nên đừng đặt quá cao.',
  },
  play2: { title: 'Gắp lại', text: 'Bấm Chơi và gắp lại: lần này thùng được nhấc lên và giữ chặt.' },
  done: {
    title: 'Xong rồi!',
    text: 'Bạn đã làm một cánh tay máy thật. Trong game mẫu "Tay máy gắp thùng" có thêm vai, khuỷu, thùng 6 kg làm khớp quá tải và thùng dễ vỡ. Thử xem!',
  },
};

const NODES: BuildArgs[1] = [
  { alias: 'floor', kind: 'block', x: 20, y: 20, params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
  { alias: 'pillar', kind: 'block', x: 20, y: 200, params: { position: { x: -2, y: 0.5, z: 0 }, size: { x: 0.6, y: 1, z: 1 }, color: '#a3a3a3' } },
  { alias: 'cap', kind: 'block', x: 20, y: 360, params: { position: { x: -2, y: 1.25, z: 0 }, size: { x: 0.5, y: 0.5, z: 0.5 }, color: '#f59e0b' } },
  { alias: 'table', kind: 'block', x: 20, y: 520, params: { position: { x: -0.7, y: 0.3, z: 0 }, size: { x: 1.4, y: 0.6, z: 1 }, color: '#78716c' } },
  { alias: 'crate', kind: 'item', x: 20, y: 680, params: { shape: 'crate', position: { x: -0.7, y: 0.9, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#a16207', mass: 2.5 } },
  { alias: 'stick', kind: 'stick', x: 300, y: 20 },
  { alias: 'scale', kind: 'map-range', x: 300, y: 200, params: { inMin: -1, inMax: 1, outMin: -15, outMax: 30, clamp: 'yes' } },
  { alias: 'go', kind: 'on-start', x: 300, y: 380 },
  { alias: 'key', kind: 'key', x: 300, y: 520, params: { key: 'Space' } },
];
const WIRES: BuildArgs[2] = [['stick', 'y', 'scale', 'value']];

const isCap: NodeFilter = (n) => paramOf(n, 'color') === '#f59e0b';

const CAP_SELF: Endpoint = { kind: 'block', port: 'self', where: isCap };
const JOINT_BASE: Endpoint = { kind: 'joint', port: 'base' };
const JOINT_TIP: Endpoint = { kind: 'joint', port: 'tip' };
const JOINT_ANGLE: Endpoint = { kind: 'joint', port: 'angle' };
const JOINT_POWER: Endpoint = { kind: 'joint', port: 'power' };
const LINK_BASE: Endpoint = { kind: 'link', port: 'base' };
const LINK_TIP: Endpoint = { kind: 'link', port: 'tip' };
const GRIPPER_BASE: Endpoint = { kind: 'gripper', port: 'base' };
const GRIPPER_CLOSE: Endpoint = { kind: 'gripper', port: 'close' };
const SCALE_OUT: Endpoint = { kind: 'map-range', port: 'value' };
const STARTED: Endpoint = { kind: 'on-start', port: 'started' };
const KEY_HELD: Endpoint = { kind: 'key', port: 'held' };

export function createRobotArmLesson(kit: LessonKit): Lesson {
  return {
    id: 'robot-arm',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-joint', 'joint'), title: T.joint.title, text: T.joint.text, explain: T.joint.explain },
      { ...kit.wireStep('wire-joint-base', CAP_SELF, JOINT_BASE), title: T.jointBase.title, text: T.jointBase.text },
      { ...kit.addStep('add-link', 'link'), title: T.link.title, text: T.link.text, explain: T.link.explain },
      { ...kit.wireStep('wire-link-base', JOINT_TIP, LINK_BASE), title: T.linkBase.title, text: T.linkBase.text },
      { ...kit.addStep('add-gripper', 'gripper'), title: T.gripper.title, text: T.gripper.text },
      { ...kit.wireStep('wire-gripper-base', LINK_TIP, GRIPPER_BASE), title: T.gripperBase.title, text: T.gripperBase.text },
      { ...kit.wireStep('wire-angle', SCALE_OUT, JOINT_ANGLE), title: T.angle.title, text: T.angle.text, explain: T.angle.explain },
      { ...kit.wireStep('wire-power', STARTED, JOINT_POWER), title: T.power.title, text: T.power.text, explain: T.power.explain },
      { ...kit.wireStep('wire-close', KEY_HELD, GRIPPER_CLOSE), title: T.close.title, text: T.close.text },
      { id: 'play-1', title: T.play1.title, text: T.play1.text, explain: T.play1.explain, target: () => [kit.playButton], check: (s) => s.playing },
      {
        ...paramStep({
          id: 'grip-force',
          kind: 'gripper',
          param: 'defaultForce',
          done: (n) => (numParam(n, 'defaultForce') ?? 0) >= GRIP_FORCE_N,
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
