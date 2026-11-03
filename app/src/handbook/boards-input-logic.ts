import { createNode } from '../editor/editor-state';
import { addWire } from '../engine/wiring';
import type { Board, Graph, Note, Params } from '../engine/types';

type NodeSpec = { alias: string; kind: string; x: number; y: number; params?: Params };
type WireSpec = [fromAlias: string, fromPort: string, toAlias: string, toPort: string];

/** Builds a small side-view board from aliased nodes and wires, with one sticky note explaining what to try. */
function build(label: string, note: string, nodes: NodeSpec[], wires: WireSpec[]): Board {
  let graph: Graph = { nodes: [], wires: [] };
  const ids = new Map<string, string>();
  for (const spec of nodes) {
    const node = createNode(graph, spec.kind, { x: spec.x, y: spec.y });
    if (!node) throw new Error(`Unknown node kind in handbook board: ${spec.kind}`);
    node.params = { ...node.params, ...spec.params };
    ids.set(spec.alias, node.id);
    graph = { ...graph, nodes: [...graph.nodes, node] };
  }
  for (const [fa, fp, ta, tp] of wires) {
    const from = ids.get(fa);
    const to = ids.get(ta);
    if (!from || !to) throw new Error(`Unknown alias in handbook wire: ${fa} -> ${ta}`);
    const res = addWire(graph, { node: from, port: fp }, { node: to, port: tp });
    if (!('nodes' in res)) throw new Error(`Cannot wire ${fa}.${fp} -> ${ta}.${tp}: ${res.reason}`);
    graph = res;
  }
  const notes: Note[] = [{ id: 'note-1', text: note, color: 'yellow', pos: { x: 20, y: 420 }, size: { w: 300, h: 130 } }];
  return { name: `Thử: ${label}`, mode: '2d-side', graph, notes };
}

const text = (alias: string, x: number, y: number, t: string, corner = 'top-left'): NodeSpec => ({
  alias,
  kind: 'show-text',
  x,
  y,
  params: { text: t, corner },
});
const keyNode = (alias: string, y: number, code: string): NodeSpec => ({ alias, kind: 'key', x: 20, y, params: { key: code } });

/** Hero on a floor, walking with the arrow keys: the base of the boards that need two objects. */
const WALKER: NodeSpec[] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: -6, y: 1, z: 0 } } },
  { alias: 'floor', kind: 'block', x: 300, y: 330, params: { position: { x: 0, y: 0, z: 0 }, size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
];
const WALKER_WIRES: WireSpec[] = [['stick', 'x', 'hero', 'moveX']];

export const tryKey = (): Board =>
  build(
    'Phím bấm',
    'Bấm Chơi, rồi giữ phím Cách (Space). Chữ trên hiện khi giữ; chữ dưới hiện và ở lại sau lần bấm đầu tiên.',
    [keyNode('key', 20, 'Space'), { alias: 'latch', kind: 'latch', x: 300, y: 200 }, text('held', 300, 20, 'Đang giữ phím Cách'), text('seen', 600, 200, 'Bạn đã bấm phím Cách rồi!', 'bottom-left')],
    [['key', 'held', 'held', 'show'], ['key', 'pressed', 'latch', 'set'], ['latch', 'on', 'seen', 'show']],
  );

export const tryStick = (): Board =>
  build(
    'Cần điều khiển',
    'Bấm Chơi, rồi bấm các phím mũi tên. Số Ngang đổi giữa -1, 0 và 1; số Dọc cũng vậy.',
    [
      { alias: 'stick', kind: 'stick', x: 20, y: 20 },
      { alias: 'nx', kind: 'show-number', x: 300, y: 20, params: { label: 'Ngang', corner: 'top-left' } },
      { alias: 'ny', kind: 'show-number', x: 300, y: 200, params: { label: 'Dọc', corner: 'top-right' } },
    ],
    [['stick', 'x', 'nx', 'value'], ['stick', 'y', 'ny', 'value']],
  );

export const tryOnStart = (): Board =>
  build(
    'Khi bắt đầu',
    'Bấm Chơi: dòng chữ hiện ngay lập tức, vì mảnh ghép Khi bắt đầu bật một nhịp rồi Công tắc nhớ giữ lại.',
    [{ alias: 'start', kind: 'on-start', x: 20, y: 20 }, { alias: 'latch', kind: 'latch', x: 300, y: 20 }, text('hi', 600, 20, 'Game đã bắt đầu!')],
    [['start', 'fired', 'latch', 'set'], ['latch', 'on', 'hi', 'show']],
  );

export const tryUiButton = (): Board =>
  build(
    'Nút bấm',
    'Bấm Chơi, rồi bấm nút ở góc dưới phải. Mỗi lần bấm, dòng chữ hiện hoặc ẩn đi.',
    [{ alias: 'btn', kind: 'ui-button', x: 20, y: 20, params: { text: 'Bật / tắt chữ' } }, { alias: 'latch', kind: 'latch', x: 300, y: 20 }, text('hi', 600, 20, 'Bạn vừa bấm nút!')],
    [['btn', 'pressed', 'latch', 'toggle'], ['latch', 'on', 'hi', 'show']],
  );

export const tryUiPick = (): Board =>
  build(
    'Bấm vào vật',
    'Bấm Chơi, rồi bấm chuột vào hộp cam ở giữa màn hình. Mỗi lần bấm trúng, dòng chữ hiện hoặc ẩn đi.',
    [
      { alias: 'box', kind: 'block', x: 20, y: 20, params: { position: { x: 0, y: 2, z: 0 }, size: { x: 2, y: 2, z: 1 }, color: '#f97316' } },
      { alias: 'pick', kind: 'ui-pick', x: 300, y: 20 },
      { alias: 'latch', kind: 'latch', x: 560, y: 20 },
      text('hi', 840, 20, 'Bạn đã bấm trúng hộp!'),
    ],
    [['box', 'self', 'pick', 'target'], ['pick', 'pressed', 'latch', 'toggle'], ['latch', 'on', 'hi', 'show']],
  );

export const tryUiDialog = (): Board =>
  build(
    'Hộp hỏi',
    'Bấm Chơi: hộp hỏi hiện ra ngay. Chọn "Có" hoặc "Không" và xem dòng chữ thay đổi.',
    [
      { alias: 'start', kind: 'on-start', x: 20, y: 20 },
      { alias: 'ask', kind: 'ui-dialog', x: 300, y: 20, params: { question: 'Bạn thích kẹo không?' } },
      { alias: 'yes', kind: 'latch', x: 620, y: 20 },
      { alias: 'no', kind: 'latch', x: 620, y: 200 },
      text('yesT', 900, 20, 'Bạn chọn: Có'),
      text('noT', 900, 200, 'Bạn chọn: Không', 'top-right'),
    ],
    [['start', 'fired', 'ask', 'ask'], ['ask', 'a1', 'yes', 'set'], ['ask', 'a2', 'no', 'set'], ['yes', 'on', 'yesT', 'show'], ['no', 'on', 'noT', 'show']],
  );

export const tryUiStart = (): Board =>
  build(
    'Màn hình mở đầu',
    'Bấm Chơi: màn hình mở đầu hiện ra. Bấm nút "Bấm để chơi" thì dòng chữ mới xuất hiện. Thử nhấn Esc để mở menu tạm dừng.',
    [{ alias: 'start', kind: 'ui-start', x: 20, y: 20 }, text('hi', 300, 20, 'Game đang chạy!')],
    [['start', 'started', 'hi', 'show']],
  );

export const tryAnd = (): Board =>
  build(
    'Và',
    'Bấm Chơi. Giữ phím Cách thì chưa đủ, giữ thêm phím E cùng lúc thì chữ mới hiện.',
    [keyNode('a', 20, 'Space'), keyNode('b', 190, 'KeyE'), { alias: 'and', kind: 'and', x: 300, y: 100 }, text('hi', 560, 100, 'Cả hai phím đang được giữ!')],
    [['a', 'held', 'and', 'a'], ['b', 'held', 'and', 'b'], ['and', 'out', 'hi', 'show']],
  );

export const tryOr = (): Board =>
  build(
    'Hoặc',
    'Bấm Chơi. Giữ phím Cách, hoặc phím E, hoặc cả hai: chữ hiện khi có ít nhất một phím đang giữ.',
    [keyNode('a', 20, 'Space'), keyNode('b', 190, 'KeyE'), { alias: 'or', kind: 'or', x: 300, y: 100 }, text('hi', 560, 100, 'Có ít nhất một phím đang giữ!')],
    [['a', 'held', 'or', 'a'], ['b', 'held', 'or', 'b'], ['or', 'out', 'hi', 'show']],
  );

export const tryNot = (): Board =>
  build(
    'Đảo ngược',
    'Bấm Chơi. Chữ hiện sẵn; giữ phím Cách thì chữ biến mất, thả ra thì hiện lại.',
    [keyNode('key', 20, 'Space'), { alias: 'not', kind: 'not', x: 300, y: 20 }, text('hi', 560, 20, 'Bạn không giữ phím Cách')],
    [['key', 'held', 'not', 'in'], ['not', 'out', 'hi', 'show']],
  );

export const tryCompare = (): Board =>
  build(
    'So sánh',
    'Bấm Chơi, rồi bấm mũi tên phải. Số Ngang lớn hơn 0 thì chữ hiện. Thử đổi "Kiểu so sánh" trong Thuộc tính.',
    [
      { alias: 'stick', kind: 'stick', x: 20, y: 20 },
      { alias: 'zero', kind: 'const', x: 20, y: 200, params: { value: 0 } },
      { alias: 'cmp', kind: 'compare', x: 300, y: 100, params: { op: 'gt' } },
      { alias: 'num', kind: 'show-number', x: 300, y: 300, params: { label: 'Ngang', corner: 'top-right' } },
      text('hi', 560, 100, 'Đang đi sang phải!'),
    ],
    [['stick', 'x', 'cmp', 'a'], ['zero', 'value', 'cmp', 'b'], ['stick', 'x', 'num', 'value'], ['cmp', 'out', 'hi', 'show']],
  );

export const tryTouch = (): Board =>
  build(
    'Chạm nhau',
    'Bấm Chơi, rồi bấm mũi tên phải để nhân vật đi tới bức tường đỏ. Chạm tới thì chữ hiện.',
    [
      ...WALKER,
      { alias: 'wall', kind: 'block', x: 300, y: 500, params: { position: { x: 3, y: 1.5, z: 0 }, size: { x: 1, y: 2, z: 1 }, color: '#dc2626' } },
      { alias: 'touch', kind: 'touch', x: 600, y: 20, params: { grow: 0.3 } },
      text('hi', 900, 20, 'Chạm rồi!'),
    ],
    [...WALKER_WIRES, ['hero', 'self', 'touch', 'a'], ['wall', 'self', 'touch', 'b'], ['touch', 'touching', 'hi', 'show']],
  );

export const trySelectNumber = (): Board =>
  build(
    'Chọn theo số',
    'Bấm Chơi: chỉ một dòng chữ hiện, ứng với số 2. Dừng game, đổi "Giá trị" của mảnh Số thành 1 hoặc 3 rồi Chơi lại.',
    [
      { alias: 'num', kind: 'const', x: 20, y: 20, params: { value: 2 } },
      { alias: 'sel', kind: 'select-number', x: 300, y: 20 },
      text('t1', 620, 20, 'Đây là lựa chọn 1', 'top-left'),
      text('t2', 620, 200, 'Đây là lựa chọn 2', 'top-right'),
      text('t3', 620, 380, 'Đây là lựa chọn 3', 'bottom-left'),
    ],
    [['num', 'value', 'sel', 'value'], ['sel', 'is1', 't1', 'show'], ['sel', 'is2', 't2', 'show'], ['sel', 'is3', 't3', 'show']],
  );

export const tryLatch = (): Board =>
  build(
    'Công tắc nhớ',
    'Bấm Chơi. Bấm phím Cách một lần để bật chữ lên (thả tay vẫn còn). Bấm phím R để tắt.',
    [keyNode('on', 20, 'Space'), keyNode('off', 190, 'KeyR'), { alias: 'latch', kind: 'latch', x: 300, y: 100 }, text('hi', 560, 100, 'Công tắc đang bật')],
    [['on', 'pressed', 'latch', 'set'], ['off', 'pressed', 'latch', 'reset'], ['latch', 'on', 'hi', 'show']],
  );

export const tryZone = (): Board =>
  build(
    'Vùng kích hoạt',
    'Bấm Chơi, rồi bấm mũi tên phải. Vùng vô hình nằm quanh chỗ x = 4: nhân vật bước vào thì chữ hiện và số lượng thành 1.',
    [
      ...WALKER,
      { alias: 'zone', kind: 'zone', x: 600, y: 20, params: { center: { x: 4, y: 1, z: 0 }, size: { x: 6, y: 3, z: 3 } } },
      text('hi', 900, 20, 'Bạn đang trong vùng!'),
      { alias: 'count', kind: 'show-number', x: 900, y: 200, params: { label: 'Trong vùng', corner: 'top-right' } },
    ],
    [...WALKER_WIRES, ['zone', 'inside', 'hi', 'show'], ['zone', 'count', 'count', 'value']],
  );

export const tryDistance = (): Board =>
  build(
    'Đo khoảng cách',
    'Bấm Chơi, rồi bấm mũi tên phải. Con số giảm dần khi nhân vật đến gần cờ xanh; còn 3 ô trở xuống thì chữ hiện.',
    [
      ...WALKER,
      { alias: 'flag', kind: 'block', x: 300, y: 500, params: { type: 'pickup', position: { x: 6, y: 1, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#2563eb' } },
      { alias: 'dist', kind: 'distance', x: 600, y: 20 },
      { alias: 'num', kind: 'show-number', x: 900, y: 20, params: { label: 'Cách cờ', corner: 'top-right' } },
      text('hi', 900, 200, 'Đã đủ gần cờ!'),
    ],
    [...WALKER_WIRES, ['hero', 'self', 'dist', 'a'], ['flag', 'self', 'dist', 'b'], ['dist', 'distance', 'num', 'value'], ['dist', 'within', 'hi', 'show']],
  );

export const trySpeedSensor = (): Board =>
  build(
    'Đo tốc độ',
    'Bấm Chơi, rồi bấm mũi tên phải. Số tốc độ lên khoảng 5 khi nhân vật chạy; lớn hơn 3 thì chữ hiện, đứng lại thì số về 0.',
    [
      ...WALKER,
      { alias: 'speed', kind: 'speed-sensor', x: 600, y: 20 },
      { alias: 'num', kind: 'show-number', x: 900, y: 20, params: { label: 'Tốc độ', corner: 'top-right' } },
      text('hi', 900, 200, 'Đang chạy nhanh!'),
    ],
    [...WALKER_WIRES, ['hero', 'self', 'speed', 'who'], ['speed', 'speed', 'num', 'value'], ['speed', 'fast', 'hi', 'show']],
  );

export const tryAheadSensor = (): Board =>
  build(
    'Dò phía trước',
    'Bấm Chơi, rồi bấm mũi tên phải. Khi cách bức tường còn 3 ô, chữ hiện lên và số khoảng cách giảm dần khi bạn tiến sát.',
    [
      ...WALKER,
      { alias: 'wall', kind: 'block', x: 300, y: 500, params: { position: { x: 0, y: 1.5, z: 0 }, size: { x: 1, y: 2, z: 1 }, color: '#a8a29e' } },
      { alias: 'ahead', kind: 'ahead-sensor', x: 600, y: 20 },
      { alias: 'num', kind: 'show-number', x: 900, y: 20, params: { label: 'Còn trống', corner: 'top-right' } },
      text('hi', 900, 200, 'Có vật cản phía trước!'),
    ],
    [...WALKER_WIRES, ['hero', 'self', 'ahead', 'who'], ['ahead', 'distance', 'num', 'value'], ['ahead', 'blocked', 'hi', 'show']],
  );

export const tryVisionSensor = (): Board =>
  build(
    'Tầm nhìn',
    'Bấm Chơi, rồi bấm mũi tên phải. Bot đứng bên trái, quay mặt sang phải: nó thấy bạn lúc đầu, bạn chạy xa quá 6 ô thì mất dấu.',
    [
      ...WALKER,
      { alias: 'bot', kind: 'character', x: 300, y: 500, params: { position: { x: -9, y: 1, z: 0 }, role: 'bot', color: '#ef4444' } },
      { alias: 'eyes', kind: 'vision-sensor', x: 600, y: 20 },
      text('hi', 900, 20, 'Bot đang thấy bạn!'),
      { alias: 'lost', kind: 'show-number', x: 900, y: 200, params: { label: 'Cách bot', corner: 'top-right' } },
    ],
    [...WALKER_WIRES, ['bot', 'self', 'eyes', 'viewer'], ['hero', 'self', 'eyes', 'target'], ['eyes', 'seen', 'hi', 'show'], ['eyes', 'distance', 'lost', 'value']],
  );

export const tryColorSensor = (): Board =>
  build(
    'Đọc màu',
    'Bấm Chơi, rồi bấm mũi tên phải. Nhân vật đứng trên ô đỏ nên Số màu là 1; bước sang ô xanh lá thì thành 3. Chỉ ba màu của bảng màu (đỏ, vàng, xanh lá) mới có số; màu khác ra 0.',
    [
      { alias: 'stick', kind: 'stick', x: 20, y: 20 },
      { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: -6, y: 1, z: 0 } } },
      { alias: 'red', kind: 'block', x: 300, y: 330, params: { position: { x: -5, y: 0, z: 0 }, size: { x: 10, y: 1, z: 1 }, color: '#ef4444' } },
      { alias: 'green', kind: 'block', x: 300, y: 500, params: { position: { x: 5, y: 0, z: 0 }, size: { x: 10, y: 1, z: 1 }, color: '#22c55e' } },
      { alias: 'eye', kind: 'color-sensor', x: 600, y: 20 },
      { alias: 'num', kind: 'show-number', x: 900, y: 20, params: { label: 'Số màu', corner: 'top-right' } },
      text('hi', 900, 200, 'Đang đứng trên màu đỏ!'),
    ],
    [['stick', 'x', 'hero', 'moveX'], ['hero', 'self', 'eye', 'who'], ['eye', 'index', 'num', 'value'], ['eye', 'match', 'hi', 'show']],
  );

export const tryNextFreeSlot = (): Board =>
  build(
    'Ô trống kế tiếp',
    'Bấm Chơi: ô vàng thứ nhất đã có thùng nên bot đi tới ô vàng thứ hai. Dừng game, xóa thùng đi rồi Chơi lại: bot sẽ đi tới ô thứ nhất.',
    [
      { alias: 'floor', kind: 'block', x: 20, y: 330, params: { position: { x: 0, y: 0, z: 0 }, size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
      { alias: 'bot', kind: 'character', x: 300, y: 20, params: { position: { x: -6, y: 1, z: 0 }, role: 'bot', color: '#ef4444', speed: 4 } },
      { alias: 'slotA', kind: 'block', x: 300, y: 330, params: { type: 'pickup', position: { x: 3, y: 0.55, z: 0 }, size: { x: 1.6, y: 0.1, z: 1 }, color: '#f59e0b' } },
      { alias: 'slotB', kind: 'block', x: 300, y: 500, params: { type: 'pickup', position: { x: 7, y: 0.55, z: 0 }, size: { x: 1.6, y: 0.1, z: 1 }, color: '#f59e0b' } },
      { alias: 'crate', kind: 'item', x: 20, y: 500, params: { position: { x: 3, y: 1, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, shape: 'crate', color: '#b45309' } },
      { alias: 'pick', kind: 'next-free-slot', x: 600, y: 20 },
      { alias: 'go', kind: 'go-to', x: 900, y: 20, params: { pathfind: 'off' } },
      text('full', 900, 330, 'Kho đầy rồi!'),
    ],
    [
      ['slotA', 'self', 'pick', 's1'],
      ['slotB', 'self', 'pick', 's2'],
      ['pick', 'slot', 'go', 'target'],
      ['bot', 'self', 'go', 'self'],
      ['go', 'moveX', 'bot', 'moveX'],
      ['pick', 'full', 'full', 'show'],
    ],
  );

export const tryNearestItem = (): Board =>
  build(
    'Tìm vật gần nhất',
    'Bấm Chơi: hai thùng nằm hai phía của bot, bot đi tới thùng gần hơn. Dừng game, kéo thùng bên kia lại gần bot hơn rồi Chơi lại: bot đổi sang thùng đó.',
    [
      { alias: 'floor', kind: 'block', x: 20, y: 330, params: { position: { x: 0, y: 0, z: 0 }, size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
      { alias: 'bot', kind: 'character', x: 300, y: 20, params: { position: { x: 0, y: 1, z: 0 }, role: 'bot', color: '#ef4444', speed: 4 } },
      { alias: 'near', kind: 'item', x: 20, y: 500, params: { position: { x: 5, y: 1, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, shape: 'crate', color: '#b45309' } },
      { alias: 'far', kind: 'item', x: 300, y: 500, params: { position: { x: -9, y: 1, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, shape: 'crate', color: '#b45309' } },
      { alias: 'look', kind: 'nearest-item', x: 600, y: 20 },
      { alias: 'go', kind: 'go-to', x: 900, y: 20, params: { pathfind: 'off' } },
      { alias: 'dist', kind: 'show-number', x: 900, y: 330, params: { label: 'Khoảng cách', corner: 'top-right' } },
    ],
    [
      ['bot', 'self', 'look', 'who'],
      ['bot', 'self', 'go', 'self'],
      ['look', 'item', 'go', 'target'],
      ['look', 'found', 'go', 'go'],
      ['go', 'moveX', 'bot', 'moveX'],
      ['look', 'distance', 'dist', 'value'],
    ],
  );
