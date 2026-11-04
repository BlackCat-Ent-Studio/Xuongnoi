import type { Endpoint, NodeFilter } from './graph-checks';
import { nodesOfKind, numParam, paramOf } from './graph-checks';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson, Snapshot, Step, TargetList } from './types';

/**
 * Lesson 11, "Xúc xắc và vùng": stand on a pad, roll a die, and a lucky roll opens the gate to the flag.
 * Self-contained like lessons 9 and 10: the shared builders of `lessons.ts` arrive through `LessonKit`.
 */

const T = {
  title: '12. Xúc xắc và vùng',
  summary: 'Đứng trên bệ, bấm E đổ xúc xắc: ra 5 hoặc 6 thì cổng mở, chạy tới lá cờ.',
  boardName: 'Bài 12 - Xúc xắc và vùng',
  intro: {
    title: 'Thử vận may',
    text: 'Bảng này có nhân vật, bệ vàng giữa sàn, một cổng xám chắn đường và lá cờ đỏ phía sau. Ta sẽ làm trò đổ xúc xắc: đứng trên bệ, bấm E, được 5 hoặc 6 thì cổng mở.',
    explain: 'Bảng đã có sẵn phím E. Phần còn lại ta tự nối.',
  },
  watch: { title: 'Xem thử trước', text: 'Bấm "Chơi", thử chạy sang phải. Cổng chặn đường, chưa qua được.' },
  edit: { title: 'Quay lại sửa', text: 'Bấm nút "Dừng" để làm tiếp.' },
  zone: {
    title: 'Thêm Vùng kích hoạt',
    text: 'Kéo mảnh ghép "Vùng kích hoạt" (nhóm Logic) vào bảng. Một hộp xanh mờ sẽ hiện quanh bệ vàng.',
    explain: 'Vùng kích hoạt là một hộp vô hình, nó biết có ai đang đứng trong hộp hay không. Lúc chơi hộp biến mất, chỉ còn tín hiệu.',
  },
  random: {
    title: 'Thêm Số ngẫu nhiên',
    text: 'Kéo mảnh ghép "Số ngẫu nhiên" (nhóm Toán) vào bảng.',
    explain: 'Mỗi lần cổng "Tung" bật lên, nó cho ra một số bất kỳ từ 1 đến 6, như một viên xúc xắc.',
  },
  and: {
    title: 'Thêm mảnh ghép Và',
    text: 'Kéo mảnh ghép "Và" (nhóm Logic) vào bảng.',
    explain: 'Mảnh ghép Và chỉ bật khi cả hai cổng vào cùng bật: bấm E và đang đứng trong vùng.',
  },
  andIn: {
    title: 'Bấm E và đứng trong vùng',
    text: 'Nối "Khi nhấn phím" của Phím bấm (phím E) sang cổng "A" của mảnh ghép Và. Rồi nối "Đang có đối tượng" của Vùng kích hoạt sang cổng "B".',
  },
  roll: {
    title: 'Cho phép tung',
    text: 'Nối "Kết quả" của mảnh ghép Và sang cổng "Tung" của Số ngẫu nhiên.',
    explain: 'Giờ chỉ khi đứng trên bệ mà bấm E thì xúc xắc mới được tung.',
  },
  show: { title: 'Thêm Hiện số', text: 'Kéo mảnh ghép "Hiện số" (nhóm Kết quả) vào bảng.' },
  showWire: {
    title: 'Xem số vừa tung',
    text: 'Nối cổng "Giá trị" của Số ngẫu nhiên sang cổng "Giá trị" của Hiện số.',
    explain: 'Số trên màn hình bằng 0 cho tới khi bạn tung lần đầu.',
  },
  compare: {
    title: 'Thêm So sánh',
    text: 'Kéo mảnh ghép "So sánh" (nhóm Logic) vào bảng. Mặc định nó là "≥ lớn hơn hoặc bằng", đúng điều ta cần.',
  },
  const: { title: 'Thêm Số cố định', text: 'Kéo mảnh ghép "Số cố định" (nhóm Toán) vào bảng.' },
  five: {
    title: 'Đặt số 5',
    text: 'Chọn mảnh ghép Số cố định. Ở Thuộc tính, đổi "Giá trị" thành 5.',
  },
  compareWire: {
    title: 'Số tung có từ 5 trở lên không?',
    text: 'Nối "Giá trị" của Số ngẫu nhiên sang "Số A" của So sánh. Rồi nối "Giá trị" của Số cố định sang "Số B".',
    explain: 'So sánh bật lên khi Số A lớn hơn hoặc bằng Số B, tức là khi tung được 5 hoặc 6.',
  },
  latch: {
    title: 'Thêm Công tắc nhớ',
    text: 'Kéo mảnh ghép "Công tắc nhớ" (nhóm Logic) vào bảng.',
    explain: 'Số tung chỉ đúng một nhịp ngắn. Công tắc nhớ chỉ cần một nhịp "Bật" là nhớ bật mãi, nên cổng mở rồi sẽ không tự đóng lại.',
  },
  latchWire: {
    title: 'Tung được số to thì bật nhớ',
    text: 'Nối "Kết quả" của So sánh sang cổng "Bật" của Công tắc nhớ.',
  },
  gate: {
    title: 'Mở cổng',
    text: 'Nối "Đang bật" của Công tắc nhớ sang cổng "Ẩn" của hộp cổng xám (hộp cao, màu xám).',
    explain: 'Hộp bị ẩn thì biến mất và không còn chặn đường nữa.',
  },
  playRoll: {
    title: 'Thử đổ xúc xắc',
    text: 'Bấm "Chơi". Đứng trên bệ vàng và bấm E. Chưa được 5 hoặc 6 thì cứ bấm E tung lại, tới khi cổng biến mất.',
  },
  edit2: { title: 'Quay lại sửa', text: 'Bấm nút "Dừng". Ta sẽ làm lá cờ chiến thắng.' },
  distance: {
    title: 'Thêm Đo khoảng cách',
    text: 'Kéo mảnh ghép "Đo khoảng cách" (nhóm Logic) vào bảng.',
    explain: 'Nó đo xem hai vật cách nhau bao xa. Khi đủ gần (mặc định trong 3 ô), cổng "Trong tầm" bật lên.',
  },
  distanceWire: {
    title: 'Đo từ nhân vật tới cờ',
    text: 'Nối cổng "Đối tượng" của nhân vật sang "Đối tượng A", và cổng "Đối tượng" của lá cờ đỏ sang "Đối tượng B" của Đo khoảng cách.',
  },
  show2: { title: 'Thêm Hiện số thứ hai', text: 'Kéo thêm một mảnh ghép "Hiện số" nữa vào bảng.' },
  show2Wire: {
    title: 'Xem khoảng cách',
    text: 'Nối cổng "Khoảng cách" của mảnh ghép Đo khoảng cách sang "Giá trị" của Hiện số mới.',
    explain: 'Con số nhỏ dần khi bạn tiến lại gần cờ. Hai ô số đều tên "Điểm": muốn đổi, chọn mảnh ghép Hiện số rồi sửa "Tên hiển thị".',
  },
  end: { title: 'Thêm mảnh ghép Thắng / Thua', text: 'Kéo mảnh ghép "Thắng / Thua" (nhóm Kết quả) vào bảng.' },
  win: { title: 'Tới gần cờ là thắng', text: 'Nối "Trong tầm" của Đo khoảng cách sang cổng "Thắng" của Thắng / Thua.' },
  play: {
    title: 'Chơi tới cờ',
    text: 'Bấm "Chơi", đứng trên bệ, bấm E cho tới khi cổng mở, rồi chạy tới lá cờ đỏ.',
  },
  won: { title: 'Chạy tới lá cờ', text: 'Khi bạn tới đủ gần lá cờ, trò chơi báo thắng.' },
  done: {
    title: 'Bạn gặp may rồi!',
    text: 'Bạn đã dùng vùng, xúc xắc, so sánh, công tắc nhớ và khoảng cách. Hãy thử đổi số 5 thành 3 cho dễ hơn, hoặc đổi "Hạt giống" của xúc xắc thành 7 để lần nào cũng ra y hệt.',
  },
} as const;

const isKeyE: NodeFilter = (n) => paramOf(n, 'key') === 'KeyE';
/** The tall solid block that shuts the path; the floor is a flat one. */
const isGate: NodeFilter = (n) => {
  if (paramOf(n, 'type') === 'pickup') return false;
  const size = paramOf(n, 'size');
  return !!size && typeof size === 'object' && size.y >= 3;
};
const isFlag: NodeFilter = (n) => paramOf(n, 'type') === 'pickup' && !!(paramOf(n, 'color') === '#ef4444');

const KEY_E_PRESSED: Endpoint = { kind: 'key', port: 'pressed', where: isKeyE };
const ZONE_INSIDE: Endpoint = { kind: 'zone', port: 'inside' };
const AND_A: Endpoint = { kind: 'and', port: 'a' };
const AND_B: Endpoint = { kind: 'and', port: 'b' };
const AND_OUT: Endpoint = { kind: 'and', port: 'out' };
const RANDOM_ROLL: Endpoint = { kind: 'random', port: 'roll' };
const RANDOM_VALUE: Endpoint = { kind: 'random', port: 'value' };
const SHOW_IN: Endpoint = { kind: 'show-number', port: 'value' };
const COMPARE_A: Endpoint = { kind: 'compare', port: 'a' };
const COMPARE_B: Endpoint = { kind: 'compare', port: 'b' };
const COMPARE_OUT: Endpoint = { kind: 'compare', port: 'out' };
const CONST_VALUE: Endpoint = { kind: 'const', port: 'value' };
const LATCH_SET: Endpoint = { kind: 'latch', port: 'set' };
const LATCH_ON: Endpoint = { kind: 'latch', port: 'on' };
const GATE_HIDE: Endpoint = { kind: 'block', port: 'hide', where: isGate };
const HERO_SELF: Endpoint = { kind: 'character', port: 'self' };
const FLAG_SELF: Endpoint = { kind: 'block', port: 'self', where: isFlag };
const DIST_A: Endpoint = { kind: 'distance', port: 'a' };
const DIST_B: Endpoint = { kind: 'distance', port: 'b' };
const DIST_OUT: Endpoint = { kind: 'distance', port: 'distance' };
const DIST_WITHIN: Endpoint = { kind: 'distance', port: 'within' };
const WIN_IN: Endpoint = { kind: 'win-lose', port: 'win' };

const paramSel = (id: string): string => `.prop-row[data-param="${id}"]`;

type Pick3 = Pick<Step, 'id' | 'target' | 'check'>;

/** Several wires in one step: done when all exist, and the hint points at the first one still missing. */
function wiresStep(kit: LessonKit, id: string, pairs: [Endpoint, Endpoint][]): Pick3 {
  const singles = pairs.map(([from, to]) => kit.wireStep(id, from, to));
  return {
    id,
    target: (snap: Snapshot): TargetList => {
      const next = singles.find((s) => !s.check?.(snap)) ?? singles[0];
      return next?.target?.(snap) ?? [];
    },
    check: (snap) => singles.every((s) => s.check?.(snap) ?? false),
  };
}

function constTarget(snap: Snapshot): TargetList {
  const node = nodesOfKind(snap.graph, 'const')[0];
  return [node ? [paramSel('value'), `.wc-node[data-id="${node.id}"]`] : paramSel('value')];
}

export function createChanceZonesLesson(kit: LessonKit): Lesson {
  return {
    id: 'chance-zones',
    title: T.title,
    summary: T.summary,
    createBoard: () =>
      kit.buildBoard(
        T.boardName,
        [
          { alias: 'stick', kind: 'stick', x: 20, y: 20 },
          { alias: 'jump', kind: 'key', x: 20, y: 190 },
          { alias: 'keyE', kind: 'key', x: 20, y: 320, params: { key: 'KeyE' } },
          { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: -6, y: 1, z: 0 }, speed: 5, jumpPower: 10 } },
          { alias: 'floor', kind: 'block', x: 300, y: 370, params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 24, y: 1, z: 1 }, color: '#65a30d' } },
          {
            alias: 'pad',
            kind: 'block',
            x: 300,
            y: 490,
            params: { type: 'pickup', position: { x: 0, y: 0.1, z: 0 }, size: { x: 3, y: 0.2, z: 1 }, color: '#facc15' },
          },
          { alias: 'gate', kind: 'block', x: 300, y: 610, params: { position: { x: 6, y: 3, z: 0 }, size: { x: 1, y: 6, z: 1 }, color: '#737373' } },
          {
            alias: 'flag',
            kind: 'block',
            x: 300,
            y: 730,
            params: { type: 'pickup', position: { x: 9, y: 1, z: 0 }, size: { x: 1, y: 2, z: 1 }, color: '#ef4444' },
          },
        ],
        [
          ['stick', 'x', 'hero', 'moveX'],
          ['jump', 'held', 'hero', 'jump'],
        ],
      ),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { id: 'watch', title: T.watch.title, text: T.watch.text, target: () => [kit.playButton], check: (s) => s.playing },
      { id: 'back-to-edit', title: T.edit.title, text: T.edit.text, target: () => [kit.playButton], check: (s) => !s.playing },
      { ...kit.addStep('add-zone', 'zone'), title: T.zone.title, text: T.zone.text, explain: T.zone.explain },
      { ...kit.addStep('add-random', 'random'), title: T.random.title, text: T.random.text, explain: T.random.explain },
      { ...kit.addStep('add-and', 'and'), title: T.and.title, text: T.and.text, explain: T.and.explain },
      {
        ...wiresStep(kit, 'wire-and-in', [
          [KEY_E_PRESSED, AND_A],
          [ZONE_INSIDE, AND_B],
        ]),
        title: T.andIn.title,
        text: T.andIn.text,
      },
      { ...kit.wireStep('wire-roll', AND_OUT, RANDOM_ROLL), title: T.roll.title, text: T.roll.text, explain: T.roll.explain },
      { ...kit.addStep('add-show', 'show-number'), title: T.show.title, text: T.show.text },
      { ...kit.wireStep('wire-show', RANDOM_VALUE, SHOW_IN), title: T.showWire.title, text: T.showWire.text, explain: T.showWire.explain },
      { ...kit.addStep('add-compare', 'compare'), title: T.compare.title, text: T.compare.text },
      { ...kit.addStep('add-const', 'const'), title: T.const.title, text: T.const.text },
      {
        id: 'set-five',
        title: T.five.title,
        text: T.five.text,
        target: constTarget,
        check: (s) => nodesOfKind(s.graph, 'const').some((n) => numParam(n, 'value') === 5),
      },
      {
        ...wiresStep(kit, 'wire-compare', [
          [RANDOM_VALUE, COMPARE_A],
          [CONST_VALUE, COMPARE_B],
        ]),
        title: T.compareWire.title,
        text: T.compareWire.text,
        explain: T.compareWire.explain,
      },
      { ...kit.addStep('add-latch', 'latch'), title: T.latch.title, text: T.latch.text, explain: T.latch.explain },
      { ...kit.wireStep('wire-latch', COMPARE_OUT, LATCH_SET), title: T.latchWire.title, text: T.latchWire.text },
      { ...kit.wireStep('wire-gate', LATCH_ON, GATE_HIDE), title: T.gate.title, text: T.gate.text, explain: T.gate.explain },
      { id: 'play-roll', title: T.playRoll.title, text: T.playRoll.text, target: () => [kit.playButton], check: (s) => s.playing },
      { id: 'back-to-edit-2', title: T.edit2.title, text: T.edit2.text, target: () => [kit.playButton], check: (s) => !s.playing },
      { ...kit.addStep('add-distance', 'distance'), title: T.distance.title, text: T.distance.text, explain: T.distance.explain },
      {
        ...wiresStep(kit, 'wire-distance', [
          [HERO_SELF, DIST_A],
          [FLAG_SELF, DIST_B],
        ]),
        title: T.distanceWire.title,
        text: T.distanceWire.text,
      },
      { ...kit.addStep('add-show-2', 'show-number', 2), title: T.show2.title, text: T.show2.text },
      { ...kit.wireStep('wire-show-2', DIST_OUT, SHOW_IN), title: T.show2Wire.title, text: T.show2Wire.text, explain: T.show2Wire.explain },
      { ...kit.addStep('add-end', 'win-lose'), title: T.end.title, text: T.end.text },
      { ...kit.wireStep('wire-win', DIST_WITHIN, WIN_IN), title: T.win.title, text: T.win.text },
      { id: 'play-final', title: T.play.title, text: T.play.text, target: () => [kit.playButton], check: (s) => s.playing },
      { id: 'win', title: T.won.title, text: T.won.text, check: (s) => s.ended === 'win' },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
