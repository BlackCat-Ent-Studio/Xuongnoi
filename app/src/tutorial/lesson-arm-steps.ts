import { numParam, paramOf } from './graph-checks';
import { STOP_BUTTON, type Resolve, first, link, paramStep, wiresStep } from './lesson-b-helpers';
import { paramStep as advancedParamStep } from './lesson-param-step';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * "Bảng giá trị và chuỗi bước": the arm of the lesson before is already built (joint, link, gripper, a crate on a table).
 * The learner makes it work by itself: a Chuỗi bước with "Xong bước" ports picks the step, a Bảng giá trị turns the step
 * number into the joint angle (lower, hold, lift), and the gripper's own state ends each step. Then Chênh lệch góc shows how
 * far the arm still has to turn and Đổi thành số turns "đang giữ" into a number for a readout.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

const T = {
  title: 'Bảng giá trị và chuỗi bước',
  summary: 'Cho tay máy tự làm ba việc: hạ xuống thùng, kẹp, nhấc lên. Mỗi bước tự báo "xong", mỗi bước có một góc trong bảng.',
  boardName: 'Tay máy tự làm theo bước',
  intro: {
    title: 'Tay máy tự làm',
    text: 'Cánh tay đã lắp sẵn: khớp, thanh nối, tay kẹp (treo xuống từ một khớp cổ tay cố định), và một thùng nặng 2,5 kg trên bàn. Lần này không có phím nào: ta cho nó tự làm ba bước: hạ xuống, kẹp, nhấc lên.',
    explain: 'Máy tự động là máy tự biết việc nào xong rồi mới làm việc kế tiếp. Ta cần một mảnh nhớ "đang ở bước nào" và một bảng ghi góc của từng bước.',
  },
  seq: {
    title: 'Thêm Chuỗi bước',
    text: 'Kéo mảnh ghép "Chuỗi bước" (nhóm Bộ não) vào bảng.',
    explain: 'Mỗi lúc chỉ một bước bật. Cổng "Bước hiện tại" cho biết số của bước đó: 1, 2, 3...',
  },
  count: {
    title: 'Ba bước',
    text: 'Chọn Chuỗi bước và đặt "Số bước" thành 3.',
    explain: 'Bước 1: hạ xuống. Bước 2: kẹp. Bước 3: nhấc lên.',
  },
  showDone: {
    title: 'Mỗi bước tự báo xong',
    text: 'Vẫn ở Chuỗi bước, mở mục "Nâng cao" và đặt "Hiện cổng Xong từng bước" thành "Có".',
    explain: 'Mỗi bước có cổng "Xong bước" của riêng nó. Đang ở bước k mà cổng "Xong bước k" bật thì chuỗi sang bước kế. Chuỗi không cần thứ tự thẻ nào cả.',
  },
  table: {
    title: 'Thêm Bảng giá trị',
    text: 'Kéo mảnh ghép "Bảng giá trị" (nhóm Tính toán) vào bảng.',
    explain: 'Bảng có nhiều hàng, mỗi hàng một con số. "Số thứ tự" chọn hàng nào được đọc ra.',
  },
  rows: {
    title: 'Điền góc của từng bước',
    text: 'Chọn Bảng giá trị (giữ 3 hàng) và điền "Giá trị 1" = -12, "Giá trị 2" = -12, "Giá trị 3" = 30.',
    explain: 'Hàng 1 và 2 là góc hạ tay xuống thùng (số âm là cúi xuống), hàng 3 là góc nhấc lên.',
  },
  index: {
    title: 'Bước nào thì hàng đó',
    text: 'Nối "Bước hiện tại" của Chuỗi bước sang "Số thứ tự" của Bảng giá trị.',
  },
  angle: {
    title: 'Từ bảng sang khớp',
    text: 'Nối "Giá trị" của Bảng giá trị sang "Góc đặt" của Khớp xoay.',
    explain: 'Giờ mỗi lần chuỗi đổi bước, khớp nhận một góc khác trong bảng.',
  },
  close: {
    title: 'Kẹp ở bước 2 và 3',
    text: 'Nối "Bước 2" và "Bước 3" của Chuỗi bước vào hai cổng của mảnh Hoặc (đã đặt sẵn, nối sẵn với "Kẹp" của Tay kẹp).',
    explain: 'Tay kẹp phải giữ chặt cả lúc nhấc lên, nên nó kẹp khi bước 2 hoặc bước 3 bật.',
  },
  done: {
    title: 'Báo xong từng bước',
    text: 'Nối "Có vật trong tầm" của Tay kẹp sang "Xong bước 1", và "Đang giữ" của Tay kẹp sang "Xong bước 2".',
    explain: 'Tay kẹp chỉ báo "có vật" khi thùng nằm giữa hai ngón, nên cánh tay phải hạ xuống thật mới xong bước 1. Bước 3 là bước cuối, không cần báo xong.',
  },
  play1: {
    title: 'Chạy thử',
    text: 'Bấm Chạy và chỉ nhìn: tay tự hạ xuống, kẹp rồi nhấc thùng lên, không cần bấm phím nào.',
  },
  stop: { title: 'Quay lại sửa', text: 'Bấm nút Dừng để quay lại bảng lắp ghép.' },
  diff: {
    title: 'Thêm Chênh lệch góc',
    text: 'Kéo mảnh ghép "Chênh lệch góc" (nhóm Tính toán) vào bảng.',
    explain: 'Nó tính góc A trừ góc B rồi đưa về khoảng -180 đến 180 độ, nên 350 trừ 10 ra -20 chứ không phải 340.',
  },
  diffWires: {
    title: 'Còn phải quay bao nhiêu?',
    text: 'Nối "Giá trị" của Bảng giá trị sang "Góc A", "Góc hiện tại" của Khớp xoay sang "Góc B", rồi "Chênh lệch" sang thẻ Hiện số "Còn phải quay (độ)".',
    explain: 'Góc A là góc muốn tới, góc B là góc đang có. Hiệu của chúng là quãng còn lại; về 0 thì tay đã tới.',
  },
  bool: {
    title: 'Thêm Đổi thành số',
    text: 'Kéo mảnh ghép "Đổi thành số" (nhóm Tính toán) vào bảng.',
    explain: 'Nhiều mảnh chỉ nhận số. Mảnh này đổi công tắc bật/tắt thành số: bật ra 1, tắt ra 0 (đổi được trong Thuộc tính).',
  },
  boolWires: {
    title: 'Đang giữ thành số',
    text: 'Nối "Đang giữ" của Tay kẹp sang "Bật/tắt" của Đổi thành số, rồi "Giá trị" sang thẻ Hiện số "Đang giữ (1 = có)".',
  },
  play2: { title: 'Chạy lại', text: 'Bấm Chạy: xem "Còn phải quay" giảm về 0 mỗi lần đổi bước, và số "Đang giữ" nhảy từ 0 lên 1 khi tay kẹp thùng.' },
  end: {
    title: 'Xong rồi!',
    text: 'Bạn đã làm một tay máy tự chạy bằng Chuỗi bước và Bảng giá trị. Bài mẫu "Tay máy tự gắp và đặt" dùng đúng cách này cho 5 bước và 3 khớp.',
  },
};

const NODES: BuildArgs[1] = [
  { alias: 'floor', kind: 'block', x: 20, y: 20, params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
  { alias: 'pillar', kind: 'block', x: 20, y: 200, params: { position: { x: -2, y: 0.65, z: 0 }, size: { x: 0.6, y: 1.3, z: 1 }, color: '#a3a3a3' } },
  { alias: 'cap', kind: 'block', x: 20, y: 360, params: { position: { x: -2, y: 1.6, z: 0 }, size: { x: 0.5, y: 0.5, z: 0.5 }, color: '#f59e0b' } },
  { alias: 'table', kind: 'block', x: 20, y: 520, params: { position: { x: -0.7, y: 0.3, z: 0 }, size: { x: 1.4, y: 0.6, z: 1 }, color: '#78716c' } },
  { alias: 'crate', kind: 'item', x: 20, y: 680, params: { shape: 'crate', position: { x: -0.9, y: 0.9, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#a16207', mass: 2.5 } },
  { alias: 'go', kind: 'on-start', x: 300, y: 20 },
  { alias: 'joint', kind: 'joint', x: 300, y: 160, params: { solid: 'no', start: 30, min: -30, max: 60, maxTorque: 60 } },
  { alias: 'link', kind: 'link', x: 300, y: 420, params: { solid: 'no' } },
  // The hand hangs down from a fixed wrist (-78 deg from the link): with the arm lowered 12 deg it points straight down, so it comes down
  // round the crate (a hand held out sideways could never get a pad under a crate that lies on a table).
  { alias: 'wrist', kind: 'joint', x: 300, y: 490, params: { solid: 'no', start: -78, min: -90, max: 0, maxTorque: 100 } },
  { alias: 'gripper', kind: 'gripper', x: 300, y: 560, params: { defaultForce: 30 } },
  { alias: 'either', kind: 'or', x: 580, y: 560 },
  { alias: 'left', kind: 'show-number', x: 860, y: 20, params: { label: 'Còn phải quay (độ)', corner: 'top-left' } },
  { alias: 'holding', kind: 'show-number', x: 860, y: 140, params: { label: 'Đang giữ (1 = có)', corner: 'top-left' } },
];
const WIRES: BuildArgs[2] = [
  ['cap', 'self', 'joint', 'base'],
  ['joint', 'tip', 'link', 'base'],
  ['link', 'tip', 'wrist', 'base'],
  ['wrist', 'tip', 'gripper', 'base'],
  ['go', 'started', 'joint', 'power'],
  ['go', 'started', 'wrist', 'power'],
  ['either', 'out', 'gripper', 'close'],
];

const seq: Resolve = (g) => first(g, 'sequence');
const table: Resolve = (g) => first(g, 'value-table');
const joint: Resolve = (g) => first(g, 'joint');
const gripper: Resolve = (g) => first(g, 'gripper');
const either: Resolve = (g) => first(g, 'or');
const diff: Resolve = (g) => first(g, 'angle-diff');
const toNumber: Resolve = (g) => first(g, 'bool-to-number');
const showLeft: Resolve = (g) => first(g, 'show-number', (n) => paramOf(n, 'label') === 'Còn phải quay (độ)');
const showHolding: Resolve = (g) => first(g, 'show-number', (n) => paramOf(n, 'label') === 'Đang giữ (1 = có)');

export function createArmStepsLesson(kit: LessonKit): Lesson {
  const play = (id: string, t: { title: string; text: string }, on: boolean) => ({
    id,
    title: t.title,
    text: t.text,
    target: () => [on ? kit.playButton : STOP_BUTTON],
    check: (s: { playing: boolean }) => s.playing === on,
  });
  return {
    id: 'arm-steps',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-sequence', 'sequence'), title: T.seq.title, text: T.seq.text, explain: T.seq.explain },
      {
        ...paramStep('step-count', seq, 'stepCount', (n) => numParam(n, 'stepCount') === 3),
        title: T.count.title,
        text: T.count.text,
        explain: T.count.explain,
      },
      {
        ...advancedParamStep({ id: 'show-done', kind: 'sequence', param: 'showDone', advanced: true, done: (n) => paramOf(n, 'showDone') === 'yes' }),
        title: T.showDone.title,
        text: T.showDone.text,
        explain: T.showDone.explain,
      },
      { ...kit.addStep('add-table', 'value-table'), title: T.table.title, text: T.table.text, explain: T.table.explain },
      {
        ...paramStep(
          'fill-table',
          table,
          'v1',
          (n) => (numParam(n, 'v1') ?? 0) <= -5 && (numParam(n, 'v2') ?? 0) <= -5 && (numParam(n, 'v3') ?? 0) >= 20,
        ),
        title: T.rows.title,
        text: T.rows.text,
        explain: T.rows.explain,
      },
      { ...wiresStep('wire-index', [link(seq, 'index', table, 'index')]), title: T.index.title, text: T.index.text },
      { ...wiresStep('wire-angle', [link(table, 'value', joint, 'angle')]), title: T.angle.title, text: T.angle.text, explain: T.angle.explain },
      {
        ...wiresStep('wire-close', [link(seq, 'step2', either, 'a'), link(seq, 'step3', either, 'b')]),
        title: T.close.title,
        text: T.close.text,
        explain: T.close.explain,
      },
      {
        ...wiresStep('wire-done', [link(gripper, 'inReach', seq, 'done1'), link(gripper, 'holding', seq, 'done2')]),
        title: T.done.title,
        text: T.done.text,
        explain: T.done.explain,
      },
      play('play-1', T.play1, true),
      play('back-to-edit', T.stop, false),
      { ...kit.addStep('add-angle-diff', 'angle-diff'), title: T.diff.title, text: T.diff.text, explain: T.diff.explain },
      {
        ...wiresStep('wire-diff', [link(table, 'value', diff, 'a'), link(joint, 'angleNow', diff, 'b'), link(diff, 'diff', showLeft, 'value')]),
        title: T.diffWires.title,
        text: T.diffWires.text,
        explain: T.diffWires.explain,
      },
      { ...kit.addStep('add-bool-to-number', 'bool-to-number'), title: T.bool.title, text: T.bool.text, explain: T.bool.explain },
      {
        ...wiresStep('wire-bool', [link(gripper, 'holding', toNumber, 'on'), link(toNumber, 'value', showHolding, 'value')]),
        title: T.boolWires.title,
        text: T.boolWires.text,
      },
      play('play-2', T.play2, true),
      { id: 'done', title: T.end.title, text: T.end.text },
    ],
  };
}
