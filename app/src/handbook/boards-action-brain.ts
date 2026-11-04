import { createNode } from '../editor/editor-state';
import { migrateBoardWireRule } from '../editor/graph/wire-rule-migration';
import type { Board, Graph, NoteColor, Params, ViewMode } from '../engine/types';
import { addWire } from '../engine/wiring';

type NodeSpec = { alias: string; kind: string; x: number; y: number; params?: Params };
type WireSpec = [fromAlias: string, fromPort: string, toAlias: string, toPort: string];

/** Builds a small ready-wired board; throws on a typo so the handbook tests catch it. */
function build(name: string, mode: ViewMode, nodes: NodeSpec[], wires: WireSpec[], note: string, noteColor: NoteColor = 'yellow'): Board {
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
  return migrateBoardWireRule({ name, mode, graph, notes: [{ id: 'note-1', text: note, color: noteColor, pos: { x: 20, y: 520 }, size: { w: 340, h: 130 } }] });
}

const at = (x: number, z: number): Params => ({ position: { x, y: 0.5, z } });
const hero = (x: number, z: number): NodeSpec => ({ alias: 'hero', kind: 'character', x: 300, y: 20, params: at(x, z) });
const bot = (alias: string, x: number, z: number, extra: Params = {}): NodeSpec => ({
  alias,
  kind: 'character',
  x: 300,
  y: 260,
  params: { ...at(x, z), role: 'bot', color: '#ef4444', look: 'robot', speed: 3.5, ...extra },
});
const key = (alias: string, code: string, y: number): NodeSpec => ({ alias, kind: 'key', x: 20, y, params: { key: code } });
const STICK: NodeSpec = { alias: 'stick', kind: 'stick', x: 20, y: 20, params: { scheme: 'wasd' } };
const MOVE: WireSpec[] = [
  ['stick', 'x', 'hero', 'moveX'],
  ['stick', 'y', 'hero', 'moveY'],
];
const thing = (alias: string, x: number, z: number, extra: Params = {}): NodeSpec => ({
  alias,
  kind: 'item',
  x: 560,
  y: 400,
  params: { ...at(x, z), ...extra },
});

export const carryBoard = (): Board =>
  build(
    'Thử: Khiêng đồ',
    '2d-top',
    [STICK, hero(-3, 0), key('grab', 'KeyE', 190), key('drop', 'KeyQ', 330), key('toss', 'KeyF', 470), { alias: 'carry', kind: 'carry', x: 560, y: 20 }, thing('ball', -1.5, 0, { shape: 'ball' })],
    [...MOVE, ['hero', 'self', 'carry', 'character'], ['grab', 'pressed', 'carry', 'grab'], ['drop', 'pressed', 'carry', 'drop'], ['toss', 'pressed', 'carry', 'throw']],
    'Chơi: đi tới quả bóng bằng W A S D, bấm E để cầm, Q để thả, F để ném.',
  );

export const interactBoard = (): Board =>
  build(
    'Thử: Tương tác',
    '2d-top',
    [
      STICK,
      hero(-3, 0),
      key('use', 'KeyE', 190),
      { alias: 'act', kind: 'interact', x: 560, y: 20 },
      thing('button', -1.5, 0, { shape: 'box', carryable: 'no', color: '#22c55e' }),
      { alias: 'door', kind: 'block', x: 800, y: 20, params: { position: { x: 3, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 4 }, color: '#92400e' } },
    ],
    [...MOVE, ['hero', 'self', 'act', 'character'], ['use', 'pressed', 'act', 'press'], ['button', 'interacted', 'door', 'hide']],
    'Chơi: đi tới ô xanh lá, bấm E. Ô xanh "được dùng" và cánh cửa nâu biến mất.',
  );

export const handToolBoard = (): Board =>
  build(
    'Thử: Cầm dụng cụ',
    '2d-top',
    [
      STICK,
      hero(-4, 0),
      key('take', 'KeyE', 190),
      key('swing', 'KeyF', 330),
      { alias: 'hand', kind: 'hand-tool', x: 560, y: 20 },
      thing('pick', -2.5, 0, { shape: 'box', holdStyle: 'hand', color: '#a16207' }),
      { alias: 'rock', kind: 'block', x: 800, y: 20, params: { position: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#78716c' } },
      { alias: 'gate', kind: 'block', x: 800, y: 200, params: { position: { x: 3, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 4 }, color: '#92400e' } },
    ],
    [...MOVE, ['hero', 'self', 'hand', 'character'], ['take', 'pressed', 'hand', 'toggle'], ['swing', 'pressed', 'hand', 'use'], ['rock', 'usedOn', 'gate', 'hide']],
    'Chơi: nhặt cái cuốc nâu bằng E, đi tới sát tảng đá xám rồi bấm F để vung. Đá bị đập thì cánh cổng nâu biến mất.',
  );

export const healthBoard = (): Board =>
  build(
    'Thử: Máu',
    '2d-top',
    [
      STICK,
      hero(-4, 0),
      { alias: 'hp', kind: 'health', x: 560, y: 20, params: { maxHp: 5 } },
      key('heal', 'KeyH', 190),
      { alias: 'show', kind: 'show-number', x: 800, y: 20, params: { label: 'Máu' } },
      bot('foe', 4, 0, { speed: 2.5 }),
      { alias: 'fight', kind: 'fight', x: 560, y: 260 },
      { alias: 'hand', kind: 'hand-tool', x: 800, y: 260 },
    ],
    [
      ...MOVE,
      ['hero', 'self', 'hp', 'self'],
      ['heal', 'pressed', 'hp', 'heal'],
      ['hp', 'hp', 'show', 'value'],
      ['foe', 'self', 'fight', 'self'],
      ['hero', 'self', 'fight', 'target'],
      ['fight', 'moveX', 'foe', 'moveX'],
      ['fight', 'moveY', 'foe', 'moveY'],
      ['foe', 'self', 'hand', 'character'],
      ['fight', 'attack', 'hand', 'use'],
    ],
    'Chơi: bot đỏ chạy tới đấm bạn, thanh máu trên đầu và số "Máu" tụt dần. Bấm H để hồi máu.',
    'pink',
  );

export const enterExitBoard = (): Board =>
  build(
    'Thử: Lên / Xuống xe',
    '2d-top',
    [
      STICK,
      hero(-3, 0),
      key('seat', 'KeyE', 190),
      { alias: 'ride', kind: 'enter-exit', x: 560, y: 20 },
      { alias: 'car', kind: 'vehicle', x: 560, y: 260, params: { position: { x: 0, y: 0.5, z: 0 } } },
    ],
    [...MOVE, ['stick', 'x', 'car', 'moveX'], ['stick', 'y', 'car', 'moveY'], ['hero', 'self', 'ride', 'character'], ['seat', 'pressed', 'ride', 'press']],
    'Chơi: đi tới sát chiếc xe, bấm E để lên, lái bằng W A S D, bấm E lần nữa để xuống.',
  );

export const cargoBoard = (): Board =>
  build(
    'Thử: Chở hàng',
    '2d-top',
    [
      STICK,
      hero(-4, 0),
      key('load', 'KeyE', 190),
      key('unload', 'KeyQ', 330),
      { alias: 'truck', kind: 'vehicle', x: 300, y: 260, params: { position: { x: 0, y: 0.5, z: 0 }, model: 'truck' } },
      { alias: 'cargo', kind: 'cargo', x: 560, y: 20 },
      { alias: 'show', kind: 'show-number', x: 800, y: 20, params: { label: 'Hàng trên xe' } },
      thing('box1', 2.5, 2, { shape: 'box', color: '#f59e0b' }),
      thing('box2', 3.5, 2, { shape: 'box', color: '#f59e0b' }),
    ],
    [...MOVE, ['truck', 'self', 'cargo', 'vehicle'], ['load', 'pressed', 'cargo', 'load'], ['unload', 'pressed', 'cargo', 'unload'], ['cargo', 'count', 'show', 'value']],
    'Chơi: đi tới gần xe tải và các thùng vàng, bấm E để chất từng thùng lên xe, Q để dỡ xuống. Số hàng hiện ở góc.',
  );

export const cameraBoard = (): Board =>
  build(
    'Thử: Máy quay',
    '2d-top',
    [
      STICK,
      hero(0, 0),
      key('shake', 'KeyE', 190),
      { alias: 'cam', kind: 'camera', x: 560, y: 20, params: { zoom: 1.6, smoothness: 4, shakeStrength: 1.5 } },
      { alias: 'mark1', kind: 'block', x: 800, y: 20, params: { position: { x: 5, y: 0.5, z: -3 }, size: { x: 1, y: 1, z: 1 }, color: '#0ea5e9' } },
      { alias: 'mark2', kind: 'block', x: 800, y: 190, params: { position: { x: -5, y: 0.5, z: 3 }, size: { x: 1, y: 1, z: 1 }, color: '#f43f5e' } },
    ],
    [...MOVE, ['hero', 'self', 'cam', 'target'], ['shake', 'pressed', 'cam', 'shake']],
    'Chơi: màn hình phóng to và bám theo bạn. Bấm E để rung màn hình. Đi tới hai khối màu để thấy cảnh trượt mượt.',
  );

export const teleportBoard = (): Board =>
  build(
    'Thử: Dịch chuyển',
    '2d-top',
    [
      STICK,
      hero(-5, 0),
      key('go', 'KeyE', 190),
      { alias: 'pad', kind: 'block', x: 560, y: 190, params: { type: 'pickup', position: { x: 6, y: 0.5, z: 0 }, size: { x: 1.6, y: 0.2, z: 1.6 }, color: '#8b5cf6' } },
      { alias: 'tp', kind: 'teleport', x: 560, y: 20 },
    ],
    [...MOVE, ['hero', 'self', 'tp', 'who'], ['go', 'pressed', 'tp', 'go'], ['pad', 'self', 'tp', 'dest']],
    'Chơi: bấm E, nhân vật nhảy ngay sang tấm bệ tím ở bên phải, không cần đi bộ.',
  );

export const shooterBoard = (): Board =>
  build(
    'Thử: Bắn đạn',
    '2d-top',
    [
      STICK,
      hero(-5, 0),
      key('fire', 'KeyF', 190),
      { alias: 'gun', kind: 'shooter', x: 560, y: 20, params: { damage: 1, cooldown: 0.3 } },
      bot('dummy', 4, 0, { speed: 0 }),
      { alias: 'hp', kind: 'health', x: 560, y: 260, params: { maxHp: 4 } },
    ],
    [...MOVE, ['hero', 'self', 'gun', 'shooter'], ['dummy', 'self', 'gun', 'target'], ['fire', 'pressed', 'gun', 'fire'], ['dummy', 'self', 'hp', 'self']],
    'Chơi: bấm F để bắn bot đỏ đứng yên. Mỗi viên trúng làm nó mất 1 máu. Gỡ dây "Ngắm vào" để đạn bay theo hướng bạn nhìn.',
    'blue',
  );

export const spawnerBoard = (): Board =>
  build(
    'Thử: Tạo vật mới',
    '2d-top',
    [
      STICK,
      hero(0, 0),
      key('make', 'KeyE', 190),
      {
        alias: 'maker',
        kind: 'spawner',
        x: 560,
        y: 20,
        params: { position: { x: 2.5, y: 0.5, z: 0 }, size: { x: 0.8, y: 0.8, z: 0.8 }, carryable: 'yes', shape: 'ball', maxAlive: 4, lifetime: 8 },
      },
      { alias: 'show', kind: 'show-number', x: 800, y: 20, params: { label: 'Đang có' } },
    ],
    [...MOVE, ['hero', 'self', 'maker', 'at'], ['make', 'pressed', 'maker', 'spawn'], ['maker', 'count', 'show', 'value']],
    'Chơi: bấm E, một quả bóng đỏ xuất hiện cạnh bạn. Tối đa 4 quả, mỗi quả biến mất sau 8 giây.',
  );

export const patrolBoard = (): Board =>
  build(
    'Thử: Đi tuần',
    '2d-top',
    [bot('guard', -4, 0), { alias: 'walk', kind: 'patrol', x: 560, y: 20, params: { pointA: { x: -4, y: 0.5, z: 0 }, pointB: { x: 4, y: 0.5, z: 0 }, wait: 1 } }],
    [['guard', 'self', 'walk', 'self'], ['walk', 'moveX', 'guard', 'moveX'], ['walk', 'moveY', 'guard', 'moveY']],
    'Chơi: bot đỏ tự đi qua đi lại giữa hai đầu, dừng 1 giây ở mỗi đầu.',
    'green',
  );

export const goToBoard = (): Board =>
  build(
    'Thử: Đi tới',
    '2d-top',
    [
      bot('walker', -5, 0),
      { alias: 'goal', kind: 'block', x: 560, y: 190, params: { type: 'pickup', position: { x: 5, y: 0.5, z: 0 }, size: { x: 0.8, y: 1, z: 0.8 }, color: '#22c55e' } },
      { alias: 'wall', kind: 'block', x: 560, y: 340, params: { position: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 4 }, color: '#525252' } },
      { alias: 'go', kind: 'go-to', x: 560, y: 20 },
    ],
    [['walker', 'self', 'go', 'self'], ['goal', 'self', 'go', 'target'], ['go', 'moveX', 'walker', 'moveX'], ['go', 'moveY', 'walker', 'moveY'], ['go', 'arrivedPulse', 'goal', 'hide']],
    'Chơi: bot đỏ tự đi vòng qua bức tường xám tới ô xanh, tới nơi thì ô xanh biến mất.',
    'green',
  );

export const routeFollowBoard = (): Board =>
  build(
    'Thử: Chạy theo tuyến',
    '2d-top',
    [
      { alias: 'car', kind: 'vehicle', x: 300, y: 20, params: { position: { x: -6, y: 0.5, z: -6 } } },
      { alias: 'route', kind: 'route-follow', x: 560, y: 20, params: { count: 4, style: 'loop', follow: 'rail', speed: 5 } },
    ],
    [['car', 'self', 'route', 'self'], ['route', 'moveX', 'car', 'moveX'], ['route', 'moveY', 'car', 'moveY']],
    'Chơi: chiếc xe không có người lái tự chạy vòng quanh 4 góc hình vuông, bám đúng đường nối các điểm.',
    'green',
  );

/** Advanced "Lấy điểm từ vật": the route points are the bot (you steer it), and two boxes; the car drives to wherever they stand. */
export const routeObjectsBoard = (): Board =>
  build(
    'Thử: Tuyến theo vật',
    '2d-top',
    [
      STICK,
      hero(-6, -4),
      { alias: 'markA', kind: 'block', x: 300, y: 400, params: { type: 'pickup', position: { x: 6, y: 0.5, z: -4 }, size: { x: 1, y: 0.4, z: 1 }, color: '#0ea5e9' } },
      { alias: 'markB', kind: 'block', x: 300, y: 560, params: { type: 'pickup', position: { x: 0, y: 0.5, z: 5 }, size: { x: 1, y: 0.4, z: 1 }, color: '#f43f5e' } },
      { alias: 'car', kind: 'vehicle', x: 560, y: 400, params: { position: { x: 0, y: 0.5, z: 0 } } },
      { alias: 'route', kind: 'route-follow', x: 560, y: 20, params: { count: 3, style: 'loop', follow: 'steer', speed: 4, pointsFrom: 'objects' } },
    ],
    [
      ...MOVE,
      ['car', 'self', 'route', 'self'],
      ['hero', 'self', 'route', 'obj1'],
      ['markA', 'self', 'route', 'obj2'],
      ['markB', 'self', 'route', 'obj3'],
      ['route', 'moveX', 'car', 'moveX'],
      ['route', 'moveY', 'car', 'moveY'],
    ],
    'Chơi: xe chạy vòng qua 3 điểm: bạn (nhân vật), ô xanh và ô đỏ. Dùng W A S D đi chỗ khác thì điểm 1 dời theo bạn và đường xe chạy đổi theo.',
    'green',
  );

export const chaseBoard = (): Board =>
  build(
    'Thử: Đuổi theo',
    '2d-top',
    [
      STICK,
      hero(-6, 0),
      bot('hunter', 0, 0),
      { alias: 'chase', kind: 'chase', x: 560, y: 20, params: { mode: 'chase', sightRange: 8, giveUpRange: 12 } },
    ],
    [...MOVE, ['hunter', 'self', 'chase', 'self'], ['hero', 'self', 'chase', 'target'], ['chase', 'moveX', 'hunter', 'moveX'], ['chase', 'moveY', 'hunter', 'moveY']],
    'Chơi: bot đỏ thấy bạn trong tầm 8 nên chạy tới. Chạy ra xa quá 12 thì nó bỏ cuộc. Đổi "Cách làm" thành Tránh xa để nó chạy trốn bạn.',
    'pink',
  );

export const sequenceBoard = (): Board =>
  build(
    'Thử: Chuỗi việc',
    '2d-top',
    [
      bot('worker', -5, -3),
      { alias: 'goA', kind: 'go-to', x: 560, y: 20, params: { targetPos: { x: 5, y: 0.5, z: -3 } } },
      { alias: 'goB', kind: 'go-to', x: 560, y: 260, params: { targetPos: { x: 5, y: 0.5, z: 3 } } },
      { alias: 'either', kind: 'or', x: 800, y: 140 },
      { alias: 'seq', kind: 'sequence', x: 800, y: 300, params: { stepCount: 2, loop: 'yes' } },
      { alias: 'sumX', kind: 'math', x: 1040, y: 20, params: { op: 'add' } },
      { alias: 'sumY', kind: 'math', x: 1040, y: 200, params: { op: 'add' } },
    ],
    [
      ['worker', 'self', 'goA', 'self'],
      ['worker', 'self', 'goB', 'self'],
      ['seq', 'step1', 'goA', 'go'],
      ['seq', 'step2', 'goB', 'go'],
      ['goA', 'arrivedPulse', 'either', 'a'],
      ['goB', 'arrivedPulse', 'either', 'b'],
      ['either', 'out', 'seq', 'next'],
      ['goA', 'moveX', 'sumX', 'a'],
      ['goB', 'moveX', 'sumX', 'b'],
      ['goA', 'moveY', 'sumY', 'a'],
      ['goB', 'moveY', 'sumY', 'b'],
      ['sumX', 'out', 'worker', 'moveX'],
      ['sumY', 'out', 'worker', 'moveY'],
    ],
    'Chơi: bot đỏ làm hai việc lần lượt: đi tới góc trên phải, xong rồi mới đi góc dưới phải, rồi lặp lại.',
    'green',
  );

export const fightBoard = (): Board =>
  build(
    'Thử: Đánh địch',
    '2d-top',
    [
      STICK,
      hero(-5, 0),
      { alias: 'hp', kind: 'health', x: 560, y: 20, params: { maxHp: 6 } },
      bot('brawler', 1, 0, { speed: 3 }),
      { alias: 'fight', kind: 'fight', x: 560, y: 260, params: { range: 1.2, attackCooldown: 0.8 } },
      { alias: 'hand', kind: 'hand-tool', x: 800, y: 260 },
    ],
    [
      ...MOVE,
      ['hero', 'self', 'hp', 'self'],
      ['brawler', 'self', 'fight', 'self'],
      ['hero', 'self', 'fight', 'target'],
      ['fight', 'moveX', 'brawler', 'moveX'],
      ['fight', 'moveY', 'brawler', 'moveY'],
      ['brawler', 'self', 'hand', 'character'],
      ['fight', 'attack', 'hand', 'use'],
    ],
    'Chơi: bot đỏ chạy tới, đấm, lùi lại một chút rồi vào tiếp. Bạn bị mất máu mỗi đòn trúng. Chạy ra xa quá 8 bước thì nó dừng lại.',
    'pink',
  );
