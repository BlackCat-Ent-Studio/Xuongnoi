import { numParam } from './graph-checks';
import { STOP_BUTTON, type Resolve, first, link, paramStep, wiresStep } from './lesson-b-helpers';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * "Bot cất thùng": two bots on one floor. The guard walks between two points and stops a moment at each ("Chạy theo
 * tuyến" with "Dừng ở mỗi điểm"). The porter looks at two marked slots, one of them already holding a crate, and
 * walks to the one that is still free ("Ô trống kế tiếp" + "Di chuyển").
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

const T = {
  title: 'Bot cất thùng',
  summary: 'Cho bot gác dừng lại ở mỗi điểm, và cho bot khuân vác tự tìm ô trống để cất thùng.',
  boardName: 'Bot cất thùng',
  intro: {
    title: 'Hai bot, hai việc',
    text: 'Bot đỏ là bot gác, bot xanh là bot khuân vác. Bên phải có hai ô vàng trên sàn, ô thứ nhất đã có thùng. Ta sẽ cho bot đỏ đi tuần và dừng ở mỗi điểm, còn bot xanh tự tìm ô trống.',
    explain: 'Hai việc dùng các mảnh ghép nhỏ nối lại với nhau, không có mảnh nào làm sẵn cả hành trình.',
  },
  route: {
    title: 'Cho bot gác đi tuần',
    text: 'Kéo mảnh ghép "Chạy theo tuyến" (nhóm Bộ não) vào bảng.',
    explain: 'Nó cho bot đi qua các Điểm 1, 2, 3... Mặc định các điểm nằm ở hai đầu sàn, nên bot đi qua đi lại.',
  },
  wireRoute: {
    title: 'Nối bot gác vào tuyến',
    text: 'Nối "Đối tượng" của bot đỏ sang "Đối tượng" của Chạy theo tuyến, rồi nối "Đi ngang" của Chạy theo tuyến sang "Đi ngang" của bot đỏ.',
  },
  stopFor: {
    title: 'Dừng ở mỗi điểm',
    text: 'Chọn Chạy theo tuyến, mở mục "Nâng cao" trong Thuộc tính và đặt "Dừng ở mỗi điểm" thành 1 giây hoặc hơn.',
    explain: 'Trong lúc dừng, cổng "Đang ở điểm" bật lên. Bạn có thể nối nó vào mảnh khác, ví dụ để chỉ cho nhặt đồ khi bot đang đứng yên.',
  },
  watch: { title: 'Xem bot gác', text: 'Bấm Chơi. Bot đỏ đi tới đầu sàn, đứng lại một chút rồi quay lại.' },
  edit: { title: 'Quay lại sửa', text: 'Bấm nút Dừng để quay lại bảng lắp ghép.' },
  picker: {
    title: 'Tìm ô trống',
    text: 'Kéo mảnh ghép "Ô trống kế tiếp" (nhóm Logic) vào bảng.',
    explain: 'Nó nhìn các ô đánh dấu và cho biết ô nào chưa có thùng, theo thứ tự Ô 1, Ô 2... Hết chỗ thì cổng "Đầy" bật.',
  },
  slots: {
    title: 'Cho nó xem hai ô vàng',
    text: 'Nối "Đối tượng" của ô vàng thứ nhất (bên trái) sang "Ô 1", và của ô vàng thứ hai (bên phải) sang "Ô 2" của Ô trống kế tiếp.',
  },
  goTo: {
    title: 'Cho bot khuân vác đi',
    text: 'Kéo mảnh ghép "Di chuyển" (nhóm Bộ não) vào bảng.',
  },
  wireGo: {
    title: 'Đi tới ô trống',
    text: 'Nối "Đối tượng" của bot xanh sang "Bot" của Di chuyển, "Ô trống" sang "Điểm đến", và "Đi ngang" của Di chuyển sang "Đi ngang" của bot xanh.',
    explain: 'Ô thứ nhất đã có thùng nên "Ô trống" chỉ vào ô thứ hai. Cất thùng vào ô thứ nhất thì nó sẽ chỉ sang ô thứ hai.',
  },
  play: { title: 'Chơi thử', text: 'Bấm Chơi. Bot đỏ đi tuần và dừng ở mỗi điểm, còn bot xanh đi thẳng tới ô vàng thứ hai.' },
  done: {
    title: 'Xong rồi!',
    text: 'Bạn đã dùng "Dừng ở mỗi điểm", "Ô trống kế tiếp" và "Di chuyển". Ghép chúng với "Khiêng đồ" là bot tự lấy thùng và cất vào kho. Xem thêm trong Sổ tay.',
  },
};

const NODES: BuildArgs[1] = [
  { alias: 'floor', kind: 'block', x: 20, y: 20, params: { position: { x: 0, y: 0, z: 0 }, size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
  { alias: 'guard', kind: 'character', x: 270, y: 20, params: { position: { x: -9, y: 1, z: 0 }, role: 'bot', color: '#ef4444', speed: 4 } },
  { alias: 'porter', kind: 'character', x: 270, y: 300, params: { position: { x: -4, y: 1, z: 0 }, role: 'bot', color: '#3b82f6', speed: 4 } },
  { alias: 'slot-a', kind: 'block', x: 520, y: 20, params: { type: 'pickup', position: { x: 6, y: 0.55, z: 0 }, size: { x: 1.6, y: 0.1, z: 1 }, color: '#f59e0b' } },
  { alias: 'slot-b', kind: 'block', x: 520, y: 300, params: { type: 'pickup', position: { x: 10, y: 0.55, z: 0 }, size: { x: 1.6, y: 0.1, z: 1 }, color: '#f59e0b' } },
  { alias: 'crate', kind: 'item', x: 770, y: 20, params: { position: { x: 6, y: 1, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, shape: 'crate', color: '#b45309' } },
];
const WIRES: BuildArgs[2] = [];

const guard: Resolve = (g) => first(g, 'character', (n) => n.params.color === '#ef4444');
const porter: Resolve = (g) => first(g, 'character', (n) => n.params.color === '#3b82f6');
const slotAt =
  (x: number): Resolve =>
  (g) =>
    first(g, 'block', (n) => n.params.color === '#f59e0b' && Math.abs(((n.params.position as { x?: number } | undefined)?.x ?? Number.NaN) - x) < 0.01);
const slotA = slotAt(6);
const slotB = slotAt(10);
const route: Resolve = (g) => first(g, 'route-follow');
const picker: Resolve = (g) => first(g, 'next-free-slot');
const goTo: Resolve = (g) => first(g, 'go-to');

export function createTidyBotLesson(kit: LessonKit): Lesson {
  const play = (id: string, t: { title: string; text: string }, on: boolean) => ({
    id,
    title: t.title,
    text: t.text,
    target: () => [on ? kit.playButton : STOP_BUTTON],
    check: (s: { playing: boolean }) => s.playing === on,
  });
  return {
    id: 'tidy-bot',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-route', 'route-follow'), title: T.route.title, text: T.route.text, explain: T.route.explain },
      {
        ...wiresStep('wire-route', [link(guard, 'self', route, 'self'), link(route, 'moveX', guard, 'moveX')]),
        title: T.wireRoute.title,
        text: T.wireRoute.text,
      },
      {
        ...paramStep('stop-for', route, 'stopFor', (n) => (numParam(n, 'stopFor') ?? 0) >= 1),
        title: T.stopFor.title,
        text: T.stopFor.text,
        explain: T.stopFor.explain,
      },
      play('watch-guard', T.watch, true),
      play('back-to-edit', T.edit, false),
      { ...kit.addStep('add-picker', 'next-free-slot'), title: T.picker.title, text: T.picker.text, explain: T.picker.explain },
      {
        ...wiresStep('wire-slots', [link(slotA, 'self', picker, 's1'), link(slotB, 'self', picker, 's2')]),
        title: T.slots.title,
        text: T.slots.text,
      },
      { ...kit.addStep('add-go-to', 'go-to'), title: T.goTo.title, text: T.goTo.text },
      {
        ...wiresStep('wire-go', [link(porter, 'self', goTo, 'self'), link(picker, 'slot', goTo, 'target'), link(goTo, 'moveX', porter, 'moveX')]),
        title: T.wireGo.title,
        text: T.wireGo.text,
        explain: T.wireGo.explain,
      },
      play('play', T.play, true),
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
