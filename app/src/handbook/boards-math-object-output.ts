import { migrateBoardWireRule } from '../editor/graph/wire-rule-migration';
import { registerAllNodes } from '../nodes';
import { addWire } from '../engine/wiring';
import type { Board, GraphNode, Graph, Params, ViewMode } from '../engine/types';

/** Ready-wired "Thử ngay" boards for the math, object and output handbook pages. */

type Wire = readonly [fromNode: string, fromPort: string, toNode: string, toPort: string];

interface Spec {
  id: string;
  kind: string;
  /** Column (0 = inputs, 1 = world, 2 = outputs) and row on the canvas. */
  col: number;
  row: number;
  params?: Params;
}

const v = (x: number, y: number, z = 0) => ({ x, y, z });

function node(s: Spec): GraphNode {
  return { id: s.id, kind: s.kind, params: s.params ?? {}, pos: { x: 40 + s.col * 280, y: 40 + s.row * 170 } };
}

function build(name: string, mode: ViewMode, note: string, specs: Spec[], wires: Wire[]): Board {
  registerAllNodes();
  let graph: Graph = { nodes: specs.map(node), wires: [] };
  for (const [fn, fp, tn, tp] of wires) {
    const res = addWire(graph, { node: fn, port: fp }, { node: tn, port: tp });
    if ('ok' in res) throw new Error(`Bảng thử "${name}": không nối được ${fn}.${fp} -> ${tn}.${tp} (${res.reason})`);
    graph = res;
  }
  return migrateBoardWireRule({ name, mode, graph, notes: [{ id: 'note1', text: note, color: 'yellow', pos: { x: 40, y: -130 }, size: { w: 520, h: 100 } }] });
}

const floor = (w = 24): Spec => ({
  id: 'floor',
  kind: 'block',
  col: 1,
  row: 3,
  params: { position: v(0, -0.5), size: v(w, 1, 1), color: '#65a30d' },
});

/** Arrow-key stick plus a character standing on a floor. `jump` also wires the Space key to jumping. */
function sideBase(opts: { jump: boolean; startX?: number; look?: string }): { specs: Spec[]; wires: Wire[] } {
  const specs: Spec[] = [
    { id: 'stick', kind: 'stick', col: 0, row: 0 },
    { id: 'character', kind: 'character', col: 1, row: 0, params: { position: v(opts.startX ?? -6, 1), ...(opts.look ? { look: opts.look } : {}) } },
    floor(),
  ];
  const wires: Wire[] = [['stick', 'x', 'character', 'moveX']];
  if (opts.jump) {
    specs.push({ id: 'jump-key', kind: 'key', col: 0, row: 1, params: { key: 'Space' } });
    wires.push(['jump-key', 'held', 'character', 'jump']);
  }
  return { specs, wires };
}

function tryConst(): Board {
  const b = sideBase({ jump: false });
  return build(
    'Thử: Số cố định',
    '2d-side',
    'Số cố định đặt là 1 được nối vào "Đi ngang" của Nhân vật, nên nhân vật tự đi sang phải. Đổi "Giá trị" thành 0.3 để đi chậm, thành -1 để đi lùi.',
    [
      ...b.specs.filter((s) => s.id !== 'stick'),
      { id: 'const', kind: 'const', col: 0, row: 0, params: { value: 1 } },
      { id: 'show', kind: 'show-number', col: 2, row: 0, params: { label: 'Số cố định' } },
    ],
    [['const', 'value', 'character', 'moveX'], ['const', 'value', 'show', 'value']],
  );
}

function tryMath(): Board {
  const b = sideBase({ jump: false });
  return build(
    'Thử: Phép tính',
    '2d-side',
    'Mũi tên trái/phải đưa số -1..1 vào "Số A", Số cố định 0.5 vào "Số B", phép Nhân ra nửa tốc độ. Bấm mũi tên để đi chậm. Thử đổi sang phép Cộng.',
    [
      ...b.specs,
      { id: 'half', kind: 'const', col: 0, row: 1, params: { value: 0.5 } },
      { id: 'math', kind: 'math', col: 1, row: 1, params: { op: 'mul' } },
      { id: 'show', kind: 'show-number', col: 2, row: 1, params: { label: 'Kết quả' } },
    ],
    [['stick', 'x', 'math', 'a'], ['half', 'value', 'math', 'b'], ['math', 'out', 'character', 'moveX'], ['math', 'out', 'show', 'value']],
  );
}

function tryCounter(): Board {
  const b = sideBase({ jump: false });
  return build(
    'Thử: Bộ đếm',
    '2d-side',
    'Bấm Space vài lần: mỗi lần "Vừa nhấn" làm Bộ đếm +1 và con số hiện lên góc màn hình. Đếm tới 3 là "Đã đủ" bật và bạn thắng. Bấm phím R để đưa về 0.',
    [
      ...b.specs,
      { id: 'press', kind: 'key', col: 0, row: 1, params: { key: 'Space' } },
      { id: 'reset-key', kind: 'key', col: 0, row: 2, params: { key: 'KeyR' } },
      { id: 'counter', kind: 'counter', col: 1, row: 1, params: { start: 0, target: 3 } },
      { id: 'show', kind: 'show-number', col: 2, row: 0, params: { label: 'Đã bấm' } },
      { id: 'end', kind: 'win-lose', col: 2, row: 1, params: { winMessage: 'Đủ 3 lần rồi!' } },
    ],
    [
      ['press', 'pressed', 'counter', 'up'],
      ['reset-key', 'pressed', 'counter', 'reset'],
      ['counter', 'value', 'show', 'value'],
      ['counter', 'reached', 'end', 'win'],
    ],
  );
}

function tryTimer(): Board {
  const b = sideBase({ jump: true });
  return build(
    'Thử: Hẹn giờ',
    '2d-side',
    'Hẹn giờ đếm ngược 10 giây, số giây còn lại hiện ở góc màn hình. Hết giờ thì "Hết giờ" bật và bạn thua. Thử đi nhảy cho vui trong lúc chờ.',
    [
      ...b.specs,
      { id: 'timer', kind: 'timer', col: 1, row: 1, params: { seconds: 10 } },
      { id: 'show', kind: 'show-number', col: 2, row: 0, params: { label: 'Còn lại (giây)' } },
      { id: 'end', kind: 'win-lose', col: 2, row: 1, params: { loseMessage: 'Hết giờ rồi!' } },
    ],
    [...b.wires, ['timer', 'left', 'show', 'value'], ['timer', 'done', 'end', 'lose']],
  );
}

function tryRandom(): Board {
  const b = sideBase({ jump: false });
  return build(
    'Thử: Số ngẫu nhiên',
    '2d-side',
    'Mỗi lần bấm Space là tung một viên xúc xắc từ 1 đến 6, kết quả hiện ở góc màn hình (chưa tung thì là 0). Thử đổi "Lớn nhất" thành 20.',
    [
      ...b.specs,
      { id: 'roll-key', kind: 'key', col: 0, row: 1, params: { key: 'Space' } },
      { id: 'random', kind: 'random', col: 1, row: 1, params: { min: 1, max: 6, mode: 'press' } },
      { id: 'show', kind: 'show-number', col: 2, row: 0, params: { label: 'Xúc xắc' } },
    ],
    [...b.wires, ['roll-key', 'pressed', 'random', 'roll'], ['random', 'value', 'show', 'value']],
  );
}

function tryMapRange(): Board {
  const b = sideBase({ jump: false });
  return build(
    'Thử: Đổi thang số',
    '2d-side',
    'Vị trí X của nhân vật chạy từ -8 đến 8. Đổi thang số biến nó thành 0..100 để Thanh đo đầy dần. Đi sang phải và nhìn thanh đầy lên.',
    [
      ...b.specs,
      { id: 'map', kind: 'map-range', col: 1, row: 1, params: { inMin: -8, inMax: 8, outMin: 0, outMax: 100 } },
      { id: 'meter', kind: 'ui-meter', col: 2, row: 1, params: { label: 'Đã đi', min: 0, max: 100, color: '#22c55e' } },
    ],
    [...b.wires, ['character', 'x', 'map', 'value'], ['map', 'value', 'meter', 'value']],
  );
}

function tryCharacter(): Board {
  const b = sideBase({ jump: true, look: 'robot' });
  return build(
    'Thử: Nhân vật',
    '2d-side',
    'Mũi tên trái/phải để đi, Space để nhảy. Nhân vật chỉ nhảy được khi đang chạm đất. Thử đổi "Kiểu dáng", "Tốc độ chạy" và "Sức nhảy" rồi chơi lại.',
    [
      ...b.specs,
      { id: 'step', kind: 'block', col: 1, row: 4, params: { position: v(3, 0.75), size: v(3, 0.5, 1), color: '#a16207' } },
      { id: 'show', kind: 'show-number', col: 2, row: 0, params: { label: 'Vị trí X' } },
    ],
    [...b.wires, ['character', 'x', 'show', 'value']],
  );
}

function tryBlock(): Board {
  const b = sideBase({ jump: false });
  return build(
    'Thử: Vật thể',
    '2d-side',
    'Vật thể đỏ là bức tường chặn đường. Bấm Space để ẩn hộp (đi qua được), bấm R để hiện lại. Vật thể rắn chặn nhân vật, còn "Vật nhặt" thì đi xuyên qua.',
    [
      ...b.specs,
      { id: 'hide-key', kind: 'key', col: 0, row: 1, params: { key: 'Space' } },
      { id: 'show-key', kind: 'key', col: 0, row: 2, params: { key: 'KeyR' } },
      { id: 'wall', kind: 'block', col: 1, row: 1, params: { position: v(0, 1.5), size: v(1, 3, 1), color: '#ef4444' } },
    ],
    [...b.wires, ['hide-key', 'pressed', 'wall', 'hide'], ['show-key', 'pressed', 'wall', 'show']],
  );
}

/** Advanced "Báo đang ẩn": the extra "Đang ẩn" output is on while the box is hidden; here it calls the win. */
export function tryBlockHidden(): Board {
  const b = sideBase({ jump: false });
  return build(
    'Thử: Báo đang ẩn',
    '2d-side',
    'Vật thể đỏ là bức tường. Mục Nâng cao "Báo đang ẩn" đang bật nên có thêm ô ra "Đang ẩn". Bấm Space để ẩn hộp: "Đang ẩn" bật và nối sang "Thắng". Bấm R hiện lại thì "Đang ẩn" tắt.',
    [
      ...b.specs,
      { id: 'hide-key', kind: 'key', col: 0, row: 1, params: { key: 'Space' } },
      { id: 'show-key', kind: 'key', col: 0, row: 2, params: { key: 'KeyR' } },
      { id: 'wall', kind: 'block', col: 1, row: 1, params: { position: v(0, 1.5), size: v(1, 3, 1), color: '#ef4444', showHiddenOut: 'yes' } },
      { id: 'end', kind: 'win-lose', col: 2, row: 1, params: { winMessage: 'Hộp đang ẩn, bạn thắng!' } },
    ],
    [...b.wires, ['hide-key', 'pressed', 'wall', 'hide'], ['show-key', 'pressed', 'wall', 'show'], ['wall', 'hidden', 'end', 'win']],
  );
}

function tryItem(): Board {
  const b = sideBase({ jump: false });
  return build(
    'Thử: Đồ vật',
    '2d-side',
    'Quả bóng rơi xuống và nảy lên. Bấm Space để ẩn bóng, bấm R để nó hiện lại. Thử đổi "Hình dạng" thành Chìa khoá, hoặc "Độ nảy" thành 0.',
    [
      ...b.specs,
      { id: 'hide-key', kind: 'key', col: 0, row: 1, params: { key: 'Space' } },
      { id: 'show-key', kind: 'key', col: 0, row: 2, params: { key: 'KeyR' } },
      { id: 'ball', kind: 'item', col: 1, row: 1, params: { position: v(0, 5), shape: 'ball', color: '#f97316', bounce: 0.8 } },
    ],
    [...b.wires, ['hide-key', 'pressed', 'ball', 'hide'], ['show-key', 'pressed', 'ball', 'show']],
  );
}

function tryVehicle(): Board {
  return build(
    'Thử: Xe',
    '2d-top',
    'Nhìn từ trên xuống. Mũi tên lái chiếc xe (đã chọn "Tự chạy" nên không cần người ngồi). Lái xe vào cái hộp xám để đâm: số lần đâm tăng lên.',
    [
      { id: 'stick', kind: 'stick', col: 0, row: 0 },
      { id: 'car', kind: 'vehicle', col: 1, row: 0, params: { position: v(-5, 0.5), control: 'auto' } },
      { id: 'wall', kind: 'block', col: 1, row: 1, params: { position: v(4, 0.5), size: v(1, 1, 5), color: '#737373' } },
      { id: 'count', kind: 'counter', col: 1, row: 2, params: { start: 0, target: 99 } },
      { id: 'speed', kind: 'show-number', col: 2, row: 0, params: { label: 'Tốc độ' } },
      { id: 'hits', kind: 'show-number', col: 2, row: 2, params: { label: 'Số lần đâm', corner: 'top-right' } },
    ],
    [
      ['stick', 'x', 'car', 'moveX'],
      ['stick', 'y', 'car', 'moveY'],
      ['car', 'speed', 'speed', 'value'],
      ['car', 'crashed', 'count', 'up'],
      ['count', 'value', 'hits', 'value'],
    ],
  );
}

function tryPortal(): Board {
  const b = sideBase({ jump: true });
  return build(
    'Thử: Cổng dịch chuyển',
    '2d-side',
    'Hai cổng tím cùng "Mã cặp" là một đôi. Đi vào cổng bên trái sẽ ra ở cổng bên phải và ngược lại. Số lần qua cổng hiện ở góc màn hình.',
    [
      ...b.specs,
      { id: 'gate-a', kind: 'portal', col: 1, row: 1, params: { position: v(-2, 1), pair: 'cap-1' } },
      { id: 'gate-b', kind: 'portal', col: 1, row: 2, params: { position: v(7, 1), pair: 'cap-1', color: '#f472b6' } },
      { id: 'count', kind: 'counter', col: 2, row: 1, params: { start: 0, target: 99 } },
      { id: 'show', kind: 'show-number', col: 2, row: 2, params: { label: 'Lần qua cổng' } },
    ],
    [...b.wires, ['gate-a', 'used', 'count', 'up'], ['count', 'value', 'show', 'value']],
  );
}

function tryMovingPlatform(): Board {
  const b = sideBase({ jump: true, startX: -3 });
  b.specs.find((s) => s.id === 'character')!.params = { position: v(-3, 2.5) };
  return build(
    'Thử: Bệ di chuyển',
    '2d-side',
    'Nhân vật đứng trên bệ cam, bệ chở đi từ điểm A sang điểm B rồi quay lại. Mỗi lần bệ tới một đầu, số đếm tăng lên. Thử nhảy xuống đất và lại nhảy lên bệ.',
    [
      ...b.specs,
      { id: 'lift', kind: 'moving-platform', col: 1, row: 1, params: { position: v(-3, 1.5), to: v(4, 1.5), speed: 2, wait: 1 } },
      { id: 'count', kind: 'counter', col: 2, row: 1, params: { start: 0, target: 99 } },
      { id: 'show', kind: 'show-number', col: 2, row: 2, params: { label: 'Lần tới đầu mút' } },
    ],
    [...b.wires, ['lift', 'arrived', 'count', 'up'], ['count', 'value', 'show', 'value']],
  );
}

function tryRotatingPlatform(): Board {
  const b = sideBase({ jump: true });
  return build(
    'Thử: Bệ xoay',
    '2d-side',
    'Bấm R để bệ xoay một góc vuông: từ tấm ván nằm ngang thành bức tường đứng. Số góc (độ) hiện ở góc màn hình. Thử đổi "Kiểu xoay" thành Quay liên tục.',
    [
      ...b.specs,
      { id: 'turn-key', kind: 'key', col: 0, row: 1, params: { key: 'KeyR' } },
      { id: 'spinner', kind: 'rotating-platform', col: 1, row: 1, params: { position: v(2, 2), mode: 'step' } },
      { id: 'show', kind: 'show-number', col: 2, row: 1, params: { label: 'Góc (độ)' } },
    ],
    [...b.wires, ['turn-key', 'pressed', 'spinner', 'turn'], ['spinner', 'angle', 'show', 'value']],
  );
}

function tryWinLose(): Board {
  const b = sideBase({ jump: false });
  return build(
    'Thử: Thắng / Thua',
    '2d-side',
    'Bấm Space để thắng, bấm L để thua. Màn hình báo kết quả bằng đúng lời bạn gõ ở "Lời khi thắng" / "Lời khi thua".',
    [
      ...b.specs,
      { id: 'win-key', kind: 'key', col: 0, row: 1, params: { key: 'Space' } },
      { id: 'lose-key', kind: 'key', col: 0, row: 2, params: { key: 'KeyL' } },
      { id: 'end', kind: 'win-lose', col: 2, row: 1, params: { winMessage: 'Hoan hô, bạn thắng!', loseMessage: 'Tiếc quá, thua rồi!' } },
    ],
    [...b.wires, ['win-key', 'pressed', 'end', 'win'], ['lose-key', 'pressed', 'end', 'lose']],
  );
}

function tryShowNumber(): Board {
  const b = sideBase({ jump: true });
  return build(
    'Thử: Hiện số',
    '2d-side',
    'Hai ô số hiện ở hai góc màn hình: vị trí X và độ cao Y của nhân vật. Đi và nhảy để thấy số đổi. Thử đổi "Góc màn hình" và "Tên hiển thị".',
    [
      ...b.specs,
      { id: 'show-x', kind: 'show-number', col: 2, row: 0, params: { label: 'Vị trí X', corner: 'top-left' } },
      { id: 'show-y', kind: 'show-number', col: 2, row: 1, params: { label: 'Độ cao Y', corner: 'top-right' } },
    ],
    [...b.wires, ['character', 'x', 'show-x', 'value'], ['character', 'y', 'show-y', 'value']],
  );
}

function tryShowText(): Board {
  const b = sideBase({ jump: false });
  return build(
    'Thử: Hiện chữ',
    '2d-side',
    'Dòng chữ "Mình đây!" bay theo nhân vật vì đã nối "Gắn vào vật". Chữ ở góc chỉ hiện khi bạn giữ phím Space. Thử gõ chữ khác vào ô "Chữ".',
    [
      ...b.specs,
      { id: 'hold-key', kind: 'key', col: 0, row: 1, params: { key: 'Space' } },
      { id: 'tag', kind: 'show-text', col: 2, row: 0, params: { text: 'Mình đây!', color: '#1d4ed8' } },
      { id: 'corner-text', kind: 'show-text', col: 2, row: 1, params: { text: 'Bạn đang giữ phím Space', corner: 'top-right' } },
    ],
    [...b.wires, ['character', 'self', 'tag', 'anchor'], ['hold-key', 'held', 'corner-text', 'show']],
  );
}

function tryGuideArrow(): Board {
  const b = sideBase({ jump: true });
  return build(
    'Thử: Mũi tên chỉ đường',
    '2d-side',
    'Mũi tên trên đầu nhân vật chỉ về ngôi sao ở xa, kèm khoảng cách. Đi tới gần thì mũi tên tự ẩn và bạn thắng khi chạm sao.',
    [
      ...b.specs,
      { id: 'star', kind: 'block', col: 1, row: 1, params: { position: v(10, 0.6), size: v(0.6, 0.6, 1), color: '#facc15', type: 'pickup' } },
      { id: 'arrow', kind: 'guide-arrow', col: 2, row: 0 },
      { id: 'touch', kind: 'touch', col: 1, row: 2 },
      { id: 'end', kind: 'win-lose', col: 2, row: 2, params: { winMessage: 'Tới nơi rồi!' } },
    ],
    [
      ...b.wires,
      ['character', 'self', 'arrow', 'from'],
      ['star', 'self', 'arrow', 'to'],
      ['character', 'self', 'touch', 'a'],
      ['star', 'self', 'touch', 'b'],
      ['touch', 'began', 'end', 'win'],
    ],
  );
}

function tryUiMeter(): Board {
  const b = sideBase({ jump: true });
  return build(
    'Thử: Thanh đo',
    '2d-side',
    'Thanh đỏ nổi trên đầu nhân vật tụt dần theo 10 giây của Hẹn giờ (đầy lúc 10, rỗng lúc 0). Hết giờ là thua. Thử bỏ dây "Gắn vào vật" để thanh về góc màn hình.',
    [
      ...b.specs,
      { id: 'timer', kind: 'timer', col: 1, row: 1, params: { seconds: 10 } },
      { id: 'meter', kind: 'ui-meter', col: 2, row: 0, params: { label: 'Thời gian', min: 0, max: 10 } },
      { id: 'end', kind: 'win-lose', col: 2, row: 1, params: { loseMessage: 'Hết giờ rồi!' } },
    ],
    [...b.wires, ['timer', 'left', 'meter', 'value'], ['character', 'self', 'meter', 'anchor'], ['timer', 'done', 'end', 'lose']],
  );
}

export const TRY_BOARDS_MATH_OBJECT_OUTPUT = {
  const: tryConst,
  math: tryMath,
  counter: tryCounter,
  timer: tryTimer,
  random: tryRandom,
  'map-range': tryMapRange,
  character: tryCharacter,
  block: tryBlock,
  item: tryItem,
  vehicle: tryVehicle,
  portal: tryPortal,
  'moving-platform': tryMovingPlatform,
  'rotating-platform': tryRotatingPlatform,
  'win-lose': tryWinLose,
  'show-number': tryShowNumber,
  'show-text': tryShowText,
  'guide-arrow': tryGuideArrow,
  'ui-meter': tryUiMeter,
} as const satisfies Record<string, () => Board>;
