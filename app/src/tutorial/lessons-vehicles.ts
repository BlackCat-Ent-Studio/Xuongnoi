import type { Board, Params } from '../engine/types';
import { type Endpoint, type NodeFilter, hasNode, nodesOfKind, paramOf } from './graph-checks';
import type { Lesson, Snapshot, Step, TargetList } from './types';

/**
 * Lesson 9, "Lái xe": build a car you can climb into and drive. Self-contained: the shared step builders of
 * `lessons.ts` arrive through `LessonKit`, so this file adds one lesson without touching the earlier ones.
 */

type NodeSpec = { alias: string; kind: string; x: number; y: number; params?: Params };
type WireSpec = [fromAlias: string, fromPort: string, toAlias: string, toPort: string];

export interface LessonKit {
  buildBoard(name: string, nodes: NodeSpec[], wires: WireSpec[]): Board;
  addStep(id: string, kind: string, count?: number): Pick<Step, 'id' | 'target' | 'check'>;
  wireStep(id: string, from: Endpoint, to: Endpoint): Pick<Step, 'id' | 'target' | 'check'>;
  playButton: string;
}

const T = {
  title: '10. Lái xe',
  summary: 'Làm một chiếc xe, leo lên xe và lái đi.',
  boardName: 'Bài 10 - Lái xe',
  intro: {
    title: 'Làm một chiếc xe',
    text: 'Bảng này có sẵn nhân vật và sàn nhà. Ta sẽ thêm một chiếc xe, rồi cho nhân vật leo lên xe và lái đi.',
    explain: 'Xe là một mảnh ghép riêng. Nó chỉ chạy khi có người ngồi trên xe.',
  },
  vehicle: {
    title: 'Thêm chiếc xe',
    text: 'Kéo mảnh ghép "Phương tiện" (nhóm Vật thể) vào bảng.',
    explain: 'Trong Thuộc tính bạn chọn được xe hơi, xe máy hay xe tải nhỏ, và chọn cách lái.',
  },
  wireDrive: {
    title: 'Nối cần lái vào xe',
    text: 'Nối cổng "Ngang (trái-phải)" của Cần điều khiển sang cổng "Đi ngang" của mảnh ghép Phương tiện.',
    explain: 'Giống như điều khiển nhân vật: phải là số dương, trái là số âm. Xe sẽ tăng tốc và giảm tốc từ từ chứ không dừng ngay.',
  },
  enter: {
    title: 'Thêm mảnh ghép lên xe',
    text: 'Kéo mảnh ghép "Lên / Xuống xe" (nhóm Hành động) vào bảng.',
    explain: 'Mỗi lần bạn bấm nút, nhân vật đứng gần xe sẽ lên xe. Bấm nữa thì xuống xe.',
  },
  wireWho: {
    title: 'Nói ai sẽ lên xe',
    text: 'Nối cổng "Nhân vật" của nhân vật sang cổng "Ai" của mảnh ghép Lên / Xuống xe.',
  },
  key: {
    title: 'Thêm nút bấm',
    text: 'Kéo thêm một mảnh ghép "Phím bấm" vào bảng.',
  },
  keyE: {
    title: 'Chọn phím E',
    text: 'Chọn mảnh ghép Phím bấm mới thêm. Ở Thuộc tính, bấm vào ô "Phím" rồi nhấn phím E.',
  },
  wirePress: {
    title: 'Bấm E để lên xe',
    text: 'Nối cổng "Vừa bấm" của mảnh ghép Phím bấm (phím E) sang cổng "Bấm" của mảnh ghép Lên / Xuống xe.',
    explain: '"Vừa bấm" chỉ bật một nhịp mỗi lần nhấn, nên mỗi lần nhấn E là một lần lên hoặc xuống.',
  },
  play: {
    title: 'Thử lái xe',
    text: 'Bấm "Chơi". Đi sang phải bằng mũi tên cho tới gần xe, bấm E để lên xe, rồi dùng mũi tên trái/phải để lái. Bấm E nữa để xuống xe.',
  },
  edit: {
    title: 'Quay lại sửa',
    text: 'Bấm nút "Dừng" để làm tiếp.',
  },
  model: {
    title: 'Đổi loại xe',
    text: 'Chọn mảnh ghép Phương tiện. Ở Thuộc tính, đổi "Loại xe" sang Xe máy hoặc Xe tải nhỏ rồi bấm "Chơi" thử lại.',
    explain: 'Xe tải to và nặng hơn, xe máy gọn và quay đầu nhanh. Nếu đổi "Cách lái" sang "Ga - Lái" thì mũi tên lên là ga, xuống là lùi.',
  },
  done: {
    title: 'Bạn lái được xe rồi!',
    text: 'Bạn đã biết thêm xe, cho nhân vật lên xuống xe và lái. Hãy thử game mẫu "Đua xe về đích" để xem một bot cũng tự lái xe được.',
  },
} as const;

const isKeyE: NodeFilter = (n) => paramOf(n, 'key') === 'KeyE';

const STICK_X: Endpoint = { kind: 'stick', port: 'x' };
const VEHICLE_MOVE_X: Endpoint = { kind: 'vehicle', port: 'moveX' };
const HERO_SELF: Endpoint = { kind: 'character', port: 'self' };
const ENTER_WHO: Endpoint = { kind: 'enter-exit', port: 'character' };
const KEY_E_PRESSED: Endpoint = { kind: 'key', port: 'pressed', where: isKeyE };
const ENTER_PRESS: Endpoint = { kind: 'enter-exit', port: 'press' };

const paramSel = (id: string): string => `.prop-row[data-param="${id}"]`;

/** The Phím bấm node added last, so the hint never points at the jump key that was already there. */
function newestKeyTarget(snap: Snapshot): TargetList {
  const keys = nodesOfKind(snap.graph, 'key');
  const node = keys[keys.length - 1];
  return [node ? [paramSel('key'), `.wc-node[data-id="${node.id}"]`] : paramSel('key')];
}

function modelTarget(snap: Snapshot): TargetList {
  const node = nodesOfKind(snap.graph, 'vehicle')[0];
  return [node ? [paramSel('model'), `.wc-node[data-id="${node.id}"]`] : paramSel('model')];
}

/** The mover at the left of a long floor, nothing else. */
const NODES: NodeSpec[] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'key', kind: 'key', x: 20, y: 190 },
  { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: -6, y: 1, z: 0 } } },
  { alias: 'floor', kind: 'block', x: 300, y: 370, params: { size: { x: 24, y: 1, z: 1 }, color: '#65a30d' } },
];
const WIRES: WireSpec[] = [
  ['stick', 'x', 'hero', 'moveX'],
  ['key', 'held', 'hero', 'jump'],
];

export function createVehicleLesson(kit: LessonKit): Lesson {
  return {
    id: 'vehicles',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-vehicle', 'vehicle'), title: T.vehicle.title, text: T.vehicle.text, explain: T.vehicle.explain },
      {
        ...kit.wireStep('wire-drive', STICK_X, VEHICLE_MOVE_X),
        title: T.wireDrive.title,
        text: T.wireDrive.text,
        explain: T.wireDrive.explain,
      },
      { ...kit.addStep('add-enter', 'enter-exit'), title: T.enter.title, text: T.enter.text, explain: T.enter.explain },
      { ...kit.wireStep('wire-who', HERO_SELF, ENTER_WHO), title: T.wireWho.title, text: T.wireWho.text },
      { ...kit.addStep('add-key', 'key', 2), title: T.key.title, text: T.key.text },
      {
        id: 'key-e',
        title: T.keyE.title,
        text: T.keyE.text,
        target: newestKeyTarget,
        check: (s) => hasNode(s.graph, 'key', isKeyE),
      },
      {
        ...kit.wireStep('wire-press', KEY_E_PRESSED, ENTER_PRESS),
        title: T.wirePress.title,
        text: T.wirePress.text,
        explain: T.wirePress.explain,
      },
      {
        id: 'play-drive',
        title: T.play.title,
        text: T.play.text,
        target: () => [kit.playButton],
        check: (s) => s.playing,
      },
      {
        id: 'back-to-edit',
        title: T.edit.title,
        text: T.edit.text,
        target: () => [kit.playButton],
        check: (s) => !s.playing,
      },
      {
        id: 'change-model',
        title: T.model.title,
        text: T.model.text,
        explain: T.model.explain,
        target: modelTarget,
        check: (s) => hasNode(s.graph, 'vehicle', (n) => paramOf(n, 'model') !== undefined && paramOf(n, 'model') !== 'car'),
      },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
