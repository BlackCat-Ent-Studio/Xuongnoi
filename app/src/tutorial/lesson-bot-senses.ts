import { numParam } from './graph-checks';
import { STOP_BUTTON, type Resolve, first, link, paramStep, wiresStep } from './lesson-b-helpers';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * "Giác quan cho bot": a guard bot stands at the left end of the track. The player wires the four new sensors:
 * the guard's eyes (tầm nhìn) lose the game for a runner it can see (tốc độ), a wall on the way is announced
 * (phía trước) and standing on the green strip wins (màu). Walking slowly past the guard is the way through.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

const T = {
  title: 'Giác quan cho bot',
  summary: 'Cho bot đôi mắt, đo tốc độ, nhìn phía trước và đọc màu sàn để làm trò "đi rón rén qua bot gác".',
  boardName: 'Giác quan cho bot',
  intro: {
    title: 'Đi rón rén qua bot gác',
    text: 'Bot đỏ đứng gác bên trái, quay mặt sang phải. Bạn phải đi qua dải sàn đỏ tới dải xanh lá bên phải. Bot thấy bạn CHẠY thì bạn thua; đi chậm thì qua được. Ta sẽ lắp bốn cảm biến để làm luật này.',
    explain: 'Cảm biến chỉ đọc thông tin, không điều khiển ai. Bạn nối kết quả của chúng vào các mảnh ghép khác.',
  },
  vision: {
    title: 'Đôi mắt cho bot',
    text: 'Kéo mảnh ghép "Cảm biến tầm nhìn" (nhóm Logic) vào bảng.',
    explain: 'Nó thấy vật nằm trong hình quạt phía trước mặt, trong tầm xa, và bị tường chắn thì không thấy.',
  },
  viewer: {
    title: 'Ai đang nhìn?',
    text: 'Nối cổng "Nhân vật" của Bot (nhân vật màu đỏ) sang cổng "Người nhìn" của Cảm biến tầm nhìn.',
  },
  target: {
    title: 'Bot canh ai?',
    text: 'Nối cổng "Nhân vật" của nhân vật xanh (người chơi) sang cổng "Mục tiêu" của Cảm biến tầm nhìn.',
    explain: 'Nối "Mục tiêu" thì bot chỉ canh đúng người đó. Để trống thì bot canh mọi vật thuộc loại đã chọn.',
  },
  speed: {
    title: 'Đo tốc độ',
    text: 'Kéo mảnh ghép "Cảm biến tốc độ" (nhóm Logic) vào bảng.',
    explain: 'Nó đo vật chạy nhanh bao nhiêu ô mỗi giây. Vượt quá "Ngưỡng" (mặc định 3) thì "Nhanh hơn ngưỡng" bật.',
  },
  speedWho: {
    title: 'Đo ai?',
    text: 'Nối cổng "Nhân vật" của nhân vật xanh sang cổng "Vật" của Cảm biến tốc độ.',
  },
  seenFast: {
    title: 'Thấy VÀ chạy nhanh',
    text: 'Mảnh "Và" đã có sẵn. Nối "Thấy" của Cảm biến tầm nhìn vào cổng "A", và "Nhanh hơn ngưỡng" của Cảm biến tốc độ vào cổng "B".',
    explain: 'Mảnh "Và" chỉ bật khi cả hai cùng bật: bot thấy bạn và bạn đang chạy nhanh.',
  },
  lose: {
    title: 'Thua khi bị bắt gặp',
    text: 'Nối "Kết quả" của mảnh "Và" sang cổng "Thua" của mảnh Thắng/Thua.',
  },
  ahead: {
    title: 'Nhìn phía trước',
    text: 'Kéo mảnh ghép "Cảm biến phía trước" (nhóm Logic) vào bảng.',
    explain: 'Nó nhìn thẳng theo hướng nhân vật quay mặt và báo khi có tường hay vật cản trong "Tầm xa".',
  },
  aheadWho: {
    title: 'Ai nhìn phía trước?',
    text: 'Nối cổng "Nhân vật" của nhân vật xanh sang cổng "Vật" của Cảm biến phía trước.',
  },
  aheadText: {
    title: 'Báo có tường',
    text: 'Nối "Có vật cản" của Cảm biến phía trước sang cổng "Hiện" của mảnh Hiện chữ. Chữ "Có tường, nhảy lên!" sẽ chỉ hiện khi có tường chắn trước mặt.',
    explain: 'Hiện chữ có cổng "Hiện" mặc định là bật. Nối vào thì chữ chỉ hiện khi tín hiệu bật.',
  },
  color: {
    title: 'Đọc màu sàn',
    text: 'Kéo mảnh ghép "Cảm biến màu" (nhóm Logic) vào bảng.',
    explain: 'Nó đọc màu hộp dưới chân và cho ra số 1 (đỏ), 2 (vàng) hoặc 3 (xanh lá). Màu khác thì ra 0.',
  },
  colorWho: {
    title: 'Đọc màu dưới chân ai?',
    text: 'Nối cổng "Nhân vật" của nhân vật xanh sang cổng "Vật" của Cảm biến màu.',
  },
  want: {
    title: 'Màu cần tìm là xanh lá',
    text: 'Chọn Cảm biến màu, trong Thuộc tính đặt "Màu cần tìm" thành 3 (xanh lá).',
  },
  win: {
    title: 'Thắng khi đứng trên dải xanh',
    text: 'Nối "Đúng màu" của Cảm biến màu sang cổng "Thắng" của mảnh Thắng/Thua.',
  },
  sneak: {
    title: 'Đi rón rén',
    text: 'Chọn nhân vật xanh, trong Thuộc tính đặt "Tốc độ chạy" thành 2 hoặc nhỏ hơn. Chạy nhanh 5 ô mỗi giây thì sẽ bị bot bắt gặp.',
    explain: 'Ngưỡng của Cảm biến tốc độ là 3, nên đi với tốc độ 2 thì không bị tính là chạy nhanh.',
  },
  play: {
    title: 'Chơi thử',
    text: 'Bấm Chơi. Giữ mũi tên phải để đi, bấm phím Cách để nhảy qua tường. Đi tới dải xanh lá là thắng.',
  },
  won: { title: 'Thắng!', text: 'Bạn đã lẻn qua bot gác. Hãy thử lại với "Tốc độ chạy" bằng 5 để xem bot bắt gặp bạn.' },
  done: {
    title: 'Xong rồi!',
    text: 'Bạn đã dùng cả bốn cảm biến: tầm nhìn, tốc độ, phía trước và màu. Bạn có thể tìm hiểu kỹ từng mảnh trong Sổ tay.',
  },
};

const NODES: BuildArgs[1] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'jump', kind: 'key', x: 20, y: 250, params: { key: 'Space' } },
  { alias: 'hero', kind: 'character', x: 270, y: 20, params: { position: { x: -9, y: 1, z: 0 } } },
  { alias: 'guard', kind: 'character', x: 270, y: 300, params: { position: { x: -13, y: 1, z: 0 }, role: 'bot', color: '#ef4444' } },
  { alias: 'base', kind: 'block', x: 520, y: 20, params: { position: { x: -6.5, y: 0, z: 0 }, size: { x: 17, y: 1, z: 1 }, color: '#78716c' } },
  { alias: 'red', kind: 'block', x: 770, y: 20, params: { position: { x: 4, y: 0, z: 0 }, size: { x: 4, y: 1, z: 1 }, color: '#ef4444' } },
  { alias: 'green', kind: 'block', x: 1020, y: 20, params: { position: { x: 10.5, y: 0, z: 0 }, size: { x: 9, y: 1, z: 1 }, color: '#22c55e' } },
  { alias: 'wall', kind: 'block', x: 520, y: 300, params: { position: { x: -4, y: 1, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#a8a29e' } },
  { alias: 'both', kind: 'and', x: 770, y: 300 },
  { alias: 'end', kind: 'win-lose', x: 1020, y: 300 },
  { alias: 'hint', kind: 'show-text', x: 1270, y: 300, params: { text: 'Có tường, nhảy lên!', corner: 'bottom-left' } },
];
const WIRES: BuildArgs[2] = [
  ['stick', 'x', 'hero', 'moveX'],
  ['jump', 'held', 'hero', 'jump'],
];

const isGuard = (n: { params: Record<string, unknown> }): boolean => n.params.role === 'bot';
const hero: Resolve = (g) => first(g, 'character', (n) => !isGuard(n));
const guard: Resolve = (g) => first(g, 'character', isGuard);
const vision: Resolve = (g) => first(g, 'vision-sensor');
const speed: Resolve = (g) => first(g, 'speed-sensor');
const ahead: Resolve = (g) => first(g, 'ahead-sensor');
const colorEye: Resolve = (g) => first(g, 'color-sensor');
const both: Resolve = (g) => first(g, 'and');
const end: Resolve = (g) => first(g, 'win-lose');
const hint: Resolve = (g) => first(g, 'show-text');

export function createBotSensesLesson(kit: LessonKit): Lesson {
  const play = (id: string, t: { title: string; text: string }, on: boolean) => ({
    id,
    title: t.title,
    text: t.text,
    target: () => [on ? kit.playButton : STOP_BUTTON],
    check: (s: { playing: boolean }) => s.playing === on,
  });
  return {
    id: 'bot-senses',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-vision', 'vision-sensor'), title: T.vision.title, text: T.vision.text, explain: T.vision.explain },
      { ...wiresStep('wire-viewer', [link(guard, 'self', vision, 'viewer')]), title: T.viewer.title, text: T.viewer.text },
      { ...wiresStep('wire-target', [link(hero, 'self', vision, 'target')]), title: T.target.title, text: T.target.text, explain: T.target.explain },
      { ...kit.addStep('add-speed', 'speed-sensor'), title: T.speed.title, text: T.speed.text, explain: T.speed.explain },
      { ...wiresStep('wire-speed-who', [link(hero, 'self', speed, 'who')]), title: T.speedWho.title, text: T.speedWho.text },
      {
        ...wiresStep('wire-seen-fast', [link(vision, 'seen', both, 'a'), link(speed, 'fast', both, 'b')]),
        title: T.seenFast.title,
        text: T.seenFast.text,
        explain: T.seenFast.explain,
      },
      { ...wiresStep('wire-lose', [link(both, 'out', end, 'lose')]), title: T.lose.title, text: T.lose.text },
      { ...kit.addStep('add-ahead', 'ahead-sensor'), title: T.ahead.title, text: T.ahead.text, explain: T.ahead.explain },
      { ...wiresStep('wire-ahead-who', [link(hero, 'self', ahead, 'who')]), title: T.aheadWho.title, text: T.aheadWho.text },
      {
        ...wiresStep('wire-ahead-text', [link(ahead, 'blocked', hint, 'show')]),
        title: T.aheadText.title,
        text: T.aheadText.text,
        explain: T.aheadText.explain,
      },
      { ...kit.addStep('add-color', 'color-sensor'), title: T.color.title, text: T.color.text, explain: T.color.explain },
      { ...wiresStep('wire-color-who', [link(hero, 'self', colorEye, 'who')]), title: T.colorWho.title, text: T.colorWho.text },
      { ...paramStep('color-want', colorEye, 'want', (n) => numParam(n, 'want') === 3), title: T.want.title, text: T.want.text },
      { ...wiresStep('wire-win', [link(colorEye, 'match', end, 'win')]), title: T.win.title, text: T.win.text },
      {
        ...paramStep('sneak', hero, 'speed', (n) => (numParam(n, 'speed') ?? 5) <= 2),
        title: T.sneak.title,
        text: T.sneak.text,
        explain: T.sneak.explain,
      },
      play('play', T.play, true),
      { id: 'won', title: T.won.title, text: T.won.text, check: (s) => s.ended === 'win' },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
