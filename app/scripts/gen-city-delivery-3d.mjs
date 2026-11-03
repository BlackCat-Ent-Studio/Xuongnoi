// Generates src/samples/city-delivery-3d.json (the 3D city sample) so the big board stays reproducible.
// Run from app/:  node scripts/gen-city-delivery-3d.mjs
// Only existing node kinds are used. Nodes are organised in graph.groups (one per bot, car loop, light, district...).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'samples', 'city-delivery-3d.json');

// ---------------------------------------------------------------- layout helpers

/** Rough on-canvas node sizes (same estimate the editor uses before a node is measured). */
const SIZES = {
  key: [200, 138], stick: [200, 138], 'on-start': [200, 136], and: [200, 138], or: [200, 138], not: [200, 110],
  const: [200, 110], math: [200, 138], compare: [200, 138], counter: [242, 282], timer: [249, 152], character: [264, 256],
  block: [372, 230], touch: [242, 178], 'win-lose': [200, 138], 'show-number': [200, 110], 'show-text': [200, 138],
  'guide-arrow': [220, 166], item: [300, 230], carry: [256, 204], 'hand-tool': [256, 282], 'go-to': [242, 360],
  'route-follow': [235, 386], sequence: [328, 308], 'select-number': [200, 278], vehicle: [285, 308], 'enter-exit': [256, 204],
  cargo: [271, 282], random: [200, 138], latch: [200, 166], camera: [372, 194], 'ui-meter': [200, 166], 'ui-start': [207, 110],
};
const GAP_X = 50;
const GAP_Y = 44;

const nodes = [];
const nodeById = new Map();
const wires = [];
const groups = [];
const notes = [];

class Group {
  constructor(key, name, color, maxW = 2300) {
    this.key = key;
    this.name = name;
    this.color = color;
    this.maxW = maxW;
    this.ids = [];
    this.cx = 0;
    this.cy = 0;
    this.rowH = 0;
    this.x = 0;
    this.y = 0;
    groups.push(this);
  }
  add(id, kind, params = {}) {
    if (nodeById.has(id)) throw new Error(`duplicate node id ${id}`);
    const size = SIZES[kind];
    if (!size) throw new Error(`no size for ${kind}`);
    if (this.cx > 0 && this.cx + size[0] > this.maxW) this.br();
    const node = { id, kind, params, pos: { x: this.cx, y: this.cy } };
    this.cx += size[0] + GAP_X;
    this.rowH = Math.max(this.rowH, size[1]);
    nodes.push(node);
    nodeById.set(id, { node, group: this });
    this.ids.push(id);
    return id;
  }
  /** Starts a new row of nodes. */
  br() {
    if (this.rowH > 0) {
      this.cx = 0;
      this.cy += this.rowH + GAP_Y;
      this.rowH = 0;
    }
  }
}

const V = (x, y, z) => ({ x, y, z });
const r2 = (n) => Math.round(n * 100) / 100;

/** One wire; its id is the input it feeds (an input takes one wire, so this is unique). */
function W(from, fromPort, to, toPort) {
  if (!nodeById.has(from)) throw new Error(`wire from unknown node ${from}`);
  if (!nodeById.has(to)) throw new Error(`wire to unknown node ${to}`);
  wires.push({ id: `${to}:${toPort}`, from: { node: from, port: fromPort }, to: { node: to, port: toPort } });
}

/** Block: p centre, s size, c colour. Solid unless `pick`. */
function blk(g, id, o) {
  const params = { position: V(...o.p), size: V(...o.s), color: o.c, type: o.pick ? 'pickup' : 'solid' };
  if (o.style) params.style = o.style;
  if (o.text) params.signText = o.text;
  return g.add(id, 'block', params);
}

function item(g, id, o) {
  const params = {
    position: V(...o.p), size: V(0.7, 0.7, 0.7), color: o.c, shape: o.shape, carryable: 'yes', holdStyle: o.hand ? 'hand' : 'head',
  };
  if (o.size) params.size = V(...o.size);
  if (o.tag) params.tag = o.tag;
  if (o.hand) params.size = V(0.8, 0.8, 0.8);
  return g.add(id, 'item', params);
}

function text(g, id, t, color = '#ffffff', corner = 'top-left') {
  if (t.length > 80) throw new Error(`text too long (${t.length}): ${t}`);
  return g.add(id, 'show-text', { text: t, color, corner });
}

// ---------------------------------------------------------------- world constants

const PITCH = 26; // district centre spacing (18 district + 8 road)
const COL = [-PITCH, 0, PITCH];
const ROW = [-PITCH, 0, PITCH];
const ROAD = [-39, -13, 13, 39]; // road centre lines on both axes
const INNER = [-13, 13];

const TYPE_KEY = { rau: 'rau', 'quặng': 'quang', 'thùng': 'thung' };
const TYPES = ['rau', 'quặng', 'thùng'];

const DIST = {
  farm: { c: 0, r: 0, name: 'Nông trại' },
  hoasen: { c: 1, r: 0, name: 'Khu Hoa Sen' },
  mine: { c: 2, r: 0, name: 'Mỏ đá' },
  phoco: { c: 0, r: 1, name: 'Phố Cổ' },
  cholon: { c: 1, r: 1, name: 'Chợ Lớn' },
  congtruong: { c: 2, r: 1, name: 'Công Trường' },
  bosong: { c: 0, r: 2, name: 'Bờ Sông' },
  cang: { c: 1, r: 2, name: 'Cảng kho' },
  doixanh: { c: 2, r: 2, name: 'Đồi Xanh' },
};
for (const d of Object.values(DIST)) {
  d.cx = COL[d.c];
  d.cz = ROW[d.r];
}

/** The nine orders: one specific house wants goods of one type. */
const NEED = 3;
const ORDER_SECONDS = 90;
const SLOTS = [
  { d: 'hoasen', house: 1, type: 'rau' },
  { d: 'phoco', house: 2, type: 'thùng' },
  { d: 'bosong', house: 1, type: 'thùng' },
  { d: 'cholon', house: 1, type: 'rau' },
  { d: 'cholon', house: 2, type: 'thùng' },
  { d: 'doixanh', house: 1, type: 'rau' },
  { d: 'doixanh', house: 2, type: 'quặng' },
  { d: 'congtruong', house: 1, type: 'quặng' },
  { d: 'congtruong', house: 2, type: 'thùng' },
];

// Colours of the group blocks on the main board.
const C = { ui: '#5aa9ff', orders: '#f7d046', truck: '#f0965a', source: '#3ecf8e', light: '#ff7f7f', car: '#a894ff', ped: '#f27ad0', deliver: '#f7d046', scene: '#8a93a6' };

// ---------------------------------------------------------------- groups: screen, orders, player truck

const gHud = new Group('hud', 'Màn hình bắt đầu và hướng dẫn', C.ui);
gHud.add('hu-start', 'ui-start', {
  title: 'Giao hàng 3D! WASD lái xe, chở ĐÚNG loại hàng tới nhà trong đơn',
  buttonText: 'Bấm để lái xe',
  pauseMenu: 'yes',
});
gHud.br();
text(gHud, 'hu-help-1', 'W A S D: lái xe tải. Tránh xe khác và người đi bộ!', '#ffffff', 'bottom-left');
text(gHud, 'hu-help-2', 'Vào ô vàng ở Nông trại, Mỏ đá, Cảng kho để chất hàng (tối đa 4).', '#ffffff', 'bottom-left');
text(gHud, 'hu-help-3', 'Giao 6 đơn là thắng, trễ 3 đơn là thua. Đụng xe: mất 1 món, chờ 5 giây.', '#ffffff', 'bottom-left');
text(gHud, 'hu-help-4', 'Xe đầy hoặc nhầm hàng? Bấm Space để bỏ bớt 1 món.', '#ffffff', 'bottom-left');

const gOrd = new Group('orders', 'Đơn hàng, tim và thắng thua', C.orders);
gOrd.add('od-start', 'on-start');
gOrd.add('od-or1', 'or');
gOrd.add('od-or2', 'or');
gOrd.add('od-roll', 'random', { min: 1, max: SLOTS.length, whole: 'yes', mode: 'press', seed: 0 });
gOrd.add('od-c6', 'const', { value: 6 });
gOrd.add('od-sub', 'math', { op: 'sub' });
gOrd.br();
gOrd.add('od-selA', 'select-number', { choices: 6 });
gOrd.add('od-selB', 'select-number', { choices: 3 });
gOrd.add('od-timer', 'timer', { seconds: ORDER_SECONDS });
gOrd.add('od-prog', 'counter', { start: 0, target: NEED });
gOrd.add('od-delivered', 'counter', { start: 0, target: 6 });
gOrd.add('od-hearts', 'counter', { start: 3, target: 0 });
gOrd.br();
gOrd.add('od-price', 'const', { value: 40 });
gOrd.add('od-money', 'math', { op: 'mul' });
gOrd.add('od-lose', 'compare', { op: 'le' });
gOrd.add('od-need', 'const', { value: NEED });
gOrd.add('od-open', 'compare', { op: 'lt' });
gOrd.add('od-end', 'win-lose', {
  winMessage: 'Giao đủ 6 đơn rồi! Cả thành phố cảm ơn bạn!',
  loseMessage: 'Trễ 3 đơn hàng rồi, hết tim. Thử lại nhé!',
});
gOrd.br();
gOrd.add('od-show-delivered', 'show-number', { label: 'Đã giao (cần 6 đơn)', corner: 'top-left' });
gOrd.add('od-show-hearts', 'show-number', { label: 'Tim', corner: 'top-left' });
gOrd.add('od-show-money', 'show-number', { label: 'Tiền', corner: 'top-left' });
gOrd.add('od-show-prog', 'show-number', { label: `Đã giao cho đơn này (cần ${NEED})`, corner: 'top-left' });
gOrd.add('od-meter', 'ui-meter', { label: 'Thời gian của đơn', min: 0, max: ORDER_SECONDS, color: '#ef4444', corner: 'top-right' });

// A new order starts at the beginning, when the current one is done and when it runs out of time.
W('od-start', 'fired', 'od-or1', 'a');
W('od-prog', 'reached', 'od-or1', 'b');
W('od-or1', 'out', 'od-or2', 'a');
W('od-timer', 'done', 'od-or2', 'b');
W('od-or2', 'out', 'od-roll', 'roll');
W('od-or2', 'out', 'od-timer', 'reset');
W('od-or2', 'out', 'od-prog', 'reset');
W('od-roll', 'value', 'od-selA', 'value');
W('od-roll', 'value', 'od-sub', 'a');
W('od-c6', 'value', 'od-sub', 'b');
W('od-sub', 'out', 'od-selB', 'value');
W('od-prog', 'reached', 'od-delivered', 'up');
W('od-timer', 'done', 'od-hearts', 'down');
W('od-delivered', 'value', 'od-money', 'a');
W('od-price', 'value', 'od-money', 'b');
W('od-hearts', 'value', 'od-lose', 'a');
// "Still taking goods": the house stops unloading the moment the order has all it asked for.
W('od-prog', 'value', 'od-open', 'a');
W('od-need', 'value', 'od-open', 'b');
W('od-delivered', 'reached', 'od-end', 'win');
W('od-lose', 'out', 'od-end', 'lose');
W('od-delivered', 'value', 'od-show-delivered', 'value');
W('od-hearts', 'value', 'od-show-hearts', 'value');
W('od-money', 'out', 'od-show-money', 'value');
W('od-prog', 'value', 'od-show-prog', 'value');
W('od-timer', 'left', 'od-meter', 'value');
W('hu-start', 'started', 'od-timer', 'run');

// ---------------------------------------------------------------- the player's truck

const gTk = new Group('truck', 'Xe tải của bạn, chất dỡ hàng và va chạm', C.truck);
gTk.add('tk-stick', 'stick', { scheme: 'wasd' });
gTk.add('tk-dump-key', 'key', { key: 'Space' });
gTk.add('tk-drop-or', 'or');
gTk.add('tk-boot', 'on-start');
gTk.add('tk-player', 'character', { position: V(2.2, 0.5, 14.4), speed: 5, color: '#3b82f6', look: 'human', role: 'player' });
gTk.add('tk-truck', 'vehicle', {
  position: V(0, 0.7, 13), model: 'truck', steerMode: 'direction', maxSpeed: 6, accel: 6, color: '#f97316', solid: 'yes', control: 'driver',
});
gTk.add('tk-enter', 'enter-exit', { reach: 4 });
gTk.add('tk-cam', 'camera', { mode: 'follow', zoom: 0.5, smoothness: 5, view: 'tilted', shakeTime: 0.4, shakeStrength: 1 });
gTk.br();
for (const t of TYPES) {
  const k = TYPE_KEY[t];
  gTk.add(`tk-cargo-${k}`, 'cargo', { capacity: 4, loadType: t, unloadType: t, reach: 4 });
}
gTk.add('tk-cargo-any', 'cargo', { capacity: 4, loadType: '', unloadType: '', reach: 4 });
gTk.br();
W('tk-stick', 'x', 'tk-truck', 'moveX');
W('tk-stick', 'y', 'tk-truck', 'moveY');
W('tk-stick', 'x', 'tk-player', 'moveX');
W('tk-stick', 'y', 'tk-player', 'moveY');
W('tk-player', 'self', 'tk-enter', 'character');
W('tk-boot', 'fired', 'tk-enter', 'press');
W('tk-truck', 'self', 'tk-cam', 'target');
for (const k of ['rau', 'quang', 'thung', 'any']) W('tk-truck', 'self', `tk-cargo-${k}`, 'vehicle');

// Unloading: only the type the active order asks for, only inside that house's yellow pad,
// one item at a time with a short pause so the order's counters settle between items.
gTk.add('tk-pace', 'timer', { seconds: 0.15 });
gTk.br();
const slotsOfType = (t) => SLOTS.map((s, i) => ({ ...s, i: i + 1 })).filter((s) => s.type === t);
for (const t of TYPES) {
  const k = TYPE_KEY[t];
  const mine = slotsOfType(t);
  let last = null;
  mine.forEach((s, n) => {
    if (n === 0) {
      last = { id: `tk-here-${s.i}`, port: 'out' };
      gTk.add(`tk-here-${s.i}`, 'or'); // funnel: a <- here_k from the district
    } else {
      const id = `tk-want-${k}-${n}`;
      gTk.add(id, 'or');
      W(last.id, last.port, id, 'a');
      gTk.add(`tk-here-${s.i}`, 'or');
      W(`tk-here-${s.i}`, 'out', id, 'b');
      last = { id, port: 'out' };
    }
  });
  gTk.br();
  gTk.add(`tk-has-${k}`, 'compare', { op: 'gt' });
  gTk.add(`tk-can-${k}`, 'and');
  gTk.add(`tk-go-${k}`, 'and');
  gTk.add(`tk-go2-${k}`, 'and');
  gTk.br();
  W(`tk-cargo-${k}`, 'typeCount', `tk-has-${k}`, 'a');
  W(last.id, last.port, `tk-can-${k}`, 'a');
  W(`tk-has-${k}`, 'out', `tk-can-${k}`, 'b');
  W(`tk-can-${k}`, 'out', `tk-go-${k}`, 'a');
  W('tk-pace', 'done', `tk-go-${k}`, 'b');
  W(`tk-go-${k}`, 'out', `tk-go2-${k}`, 'a');
  W('od-open', 'out', `tk-go2-${k}`, 'b');
  W(`tk-go2-${k}`, 'out', `tk-cargo-${k}`, 'unload');
}
// Any unload that counted is a delivery (the crash drop uses the untyped node, which is not wired here).
gTk.add('tk-dl-1', 'or');
gTk.add('tk-dl-2', 'or');
W('tk-cargo-rau', 'unloaded', 'tk-dl-1', 'a');
W('tk-cargo-quang', 'unloaded', 'tk-dl-1', 'b');
W('tk-dl-1', 'out', 'tk-dl-2', 'a');
W('tk-cargo-thung', 'unloaded', 'tk-dl-2', 'b');
W('tk-dl-2', 'out', 'od-prog', 'up');
W('tk-dl-2', 'out', 'tk-pace', 'reset');
gTk.br();

// Crash: stall 5 seconds, lose one item (any type), camera shakes.
gTk.add('tk-stall-timer', 'timer', { seconds: 5 });
gTk.add('tk-stall', 'latch', { start: 'off' });
gTk.add('tk-lost', 'latch', { start: 'off' });
gTk.add('tk-not-started', 'not');
gTk.add('tk-halt', 'or');
gTk.br();
W('tk-truck', 'crashed', 'tk-stall-timer', 'reset');
W('tk-truck', 'crashed', 'tk-stall', 'set');
W('tk-stall-timer', 'done', 'tk-stall', 'reset');
// The untyped node drops the top item: after a crash, or when the player presses Space to make room.
W('tk-truck', 'crashed', 'tk-drop-or', 'a');
W('tk-dump-key', 'pressed', 'tk-drop-or', 'b');
W('tk-drop-or', 'out', 'tk-cargo-any', 'unload');
W('tk-truck', 'crashed', 'tk-cam', 'shake');
gTk.add('tk-lost-now', 'and');
W('tk-cargo-any', 'unloaded', 'tk-lost-now', 'a');
W('tk-stall', 'on', 'tk-lost-now', 'b'); // the drop follows the crash by a tick or two, while the stall is on
W('tk-lost-now', 'out', 'tk-lost', 'set');
W('tk-stall-timer', 'done', 'tk-lost', 'reset');
W('hu-start', 'started', 'tk-not-started', 'in');
W('tk-stall', 'on', 'tk-halt', 'a');
W('tk-not-started', 'out', 'tk-halt', 'b');
W('tk-halt', 'out', 'tk-truck', 'stop');

gTk.add('tk-no-lost', 'not');
gTk.add('tk-msg-lost-on', 'and');
gTk.add('tk-msg-plain-on', 'and');
text(gTk, 'tk-msg-lost', 'Va chạm! Mất 1 món hàng, chờ 5 giây', '#fecaca', 'bottom-right');
text(gTk, 'tk-msg-plain', 'Va chạm! Chờ 5 giây', '#fecaca', 'bottom-right');
gTk.br();
W('tk-lost', 'on', 'tk-no-lost', 'in');
W('tk-stall', 'on', 'tk-msg-lost-on', 'a');
W('tk-lost', 'on', 'tk-msg-lost-on', 'b');
W('tk-stall', 'on', 'tk-msg-plain-on', 'a');
W('tk-no-lost', 'out', 'tk-msg-plain-on', 'b');
W('tk-msg-lost-on', 'out', 'tk-msg-lost', 'show');
W('tk-msg-plain-on', 'out', 'tk-msg-plain', 'show');

// Cargo on the truck, by type.
gTk.add('tk-show-rau', 'show-number', { label: 'Rau trên xe', corner: 'top-right' });
gTk.add('tk-show-quang', 'show-number', { label: 'Quặng trên xe', corner: 'top-right' });
gTk.add('tk-show-thung', 'show-number', { label: 'Thùng trên xe', corner: 'top-right' });
gTk.add('tk-show-all', 'show-number', { label: 'Hàng trên xe (tối đa 4)', corner: 'top-right' });
W('tk-cargo-rau', 'typeCount', 'tk-show-rau', 'value');
W('tk-cargo-quang', 'typeCount', 'tk-show-quang', 'value');
W('tk-cargo-thung', 'typeCount', 'tk-show-thung', 'value');
W('tk-cargo-any', 'count', 'tk-show-all', 'value');

// ---------------------------------------------------------------- source districts: bot worker + bay

/** A bay pad touched by the truck makes `load` pulses every 0.3 s; the bots keep it stocked. */
function bayLoader(g, p, padId, tag) {
  const k = TYPE_KEY[tag];
  g.add(`${p}-touch`, 'touch');
  g.add(`${p}-tick`, 'timer', { seconds: 0.3 });
  g.add(`${p}-tick-again`, 'or');
  g.add(`${p}-load`, 'and');
  W(padId, 'self', `${p}-touch`, 'b');
  W(`${p}-tick`, 'done', `${p}-tick-again`, 'a');
  W(`${p}-tick-again`, 'out', `${p}-tick`, 'reset');
  W(`${p}-touch`, 'touching', `${p}-load`, 'a');
  W(`${p}-tick`, 'done', `${p}-load`, 'b');
  W(`${p}-load`, 'out', `tk-cargo-${k}`, 'load');
  W('tk-truck', 'self', `${p}-touch`, 'a');
}

const GRID = [];
for (const dz of [-1.4, 0, 1.4]) for (const dx of [-2.1, -0.7, 0.7, 2.1]) GRID.push([dx, dz]);

/** Bot worker that cuts a crop / chips a rock and walks the goods to the bay (12 goods in all, 2 ready at the start). */
function worker(o) {
  const g = new Group(o.key, o.gname, C.source);
  const p = o.key;
  const bayX = o.d.cx;
  const bayZ = o.d.cz + o.bayDz;
  const botX = bayX + o.side * 4;
  g.add(`${p}-start`, 'on-start');
  g.add(`${p}-bot`, 'character', { position: V(botX, 0.5, bayZ), speed: 2.4, jumpPower: 10, color: o.botColor, look: o.look, role: 'bot' });
  g.add(`${p}-hand`, 'hand-tool', { reach: 1.3 });
  item(g, `${p}-tool`, { p: [botX + o.side * 0.6, 0.4, bayZ + 0.4], shape: o.toolShape, c: o.toolColor, hand: true });
  g.add(`${p}-seq`, 'sequence', { stepCount: 2, loop: 'yes' });
  g.br();
  g.add(`${p}-go-work`, 'go-to', { targetPos: V(bayX + o.side * 7, 0.4, bayZ), stopDistance: 1.2, pathfind: 'on' });
  g.add(`${p}-go-bay`, 'go-to', { targetPos: V(bayX + o.side * 2.3, 0.5, bayZ), stopDistance: 0.4, pathfind: 'on' });
  g.add(`${p}-or-next`, 'or');
  g.add(`${p}-or-gone`, 'or');
  g.add(`${p}-mx`, 'math', { op: 'add' });
  g.add(`${p}-my`, 'math', { op: 'add' });
  blk(g, `${p}-crop`, { p: [bayX + o.side * 7, o.cropH / 2, bayZ], s: [o.cropW, o.cropH, o.cropW], c: o.cropColor, style: o.cropStyle, pick: true });
  g.br();
  g.add(`${p}-count`, 'counter', { start: 2, target: 12 });
  g.add(`${p}-pickA`, 'select-number', { choices: 6 });
  g.add(`${p}-sub6`, 'math', { op: 'sub' });
  g.add(`${p}-c6`, 'const', { value: 6 });
  g.add(`${p}-pickB`, 'select-number', { choices: 6 });
  g.br();
  const pad = blk(g, `${p}-pad`, { p: [bayX, 0.105, bayZ], s: [6, 0.05, 6], c: '#fbbf24', pick: true });
  GRID.forEach(([dx, dz], i) => {
    item(g, `${p}-goods-${i + 1}`, { p: [bayX + dx, 0.35, bayZ + dz], shape: o.goodsShape, c: o.goodsColor, tag: o.tag });
  });
  g.br();
  text(g, `${p}-label`, o.label, '#ffffff');
  text(g, `${p}-label-work`, o.workLabel, '#ffffff');
  bayLoader(g, p, pad, o.tag);

  W(`${p}-bot`, 'self', `${p}-hand`, 'character');
  W(`${p}-start`, 'fired', `${p}-hand`, 'toggle');
  W(`${p}-bot`, 'self', `${p}-go-work`, 'self');
  W(`${p}-bot`, 'self', `${p}-go-bay`, 'self');
  W(`${p}-crop`, 'self', `${p}-go-work`, 'target');
  W(`${p}-seq`, 'step1', `${p}-go-work`, 'go');
  W(`${p}-seq`, 'step2', `${p}-go-bay`, 'go');
  W(`${p}-go-work`, 'arrivedPulse', `${p}-hand`, 'use');
  W(`${p}-crop`, 'usedOn', `${p}-or-gone`, 'a');
  W(`${p}-or-gone`, 'out', `${p}-crop`, 'hide');
  W(`${p}-crop`, 'usedOn', `${p}-or-next`, 'a');
  W(`${p}-go-bay`, 'arrivedPulse', `${p}-or-next`, 'b');
  W(`${p}-or-next`, 'out', `${p}-seq`, 'next');
  W(`${p}-go-bay`, 'arrivedPulse', `${p}-crop`, 'show');
  W(`${p}-go-bay`, 'arrivedPulse', `${p}-count`, 'up');
  W(`${p}-count`, 'value', `${p}-pickA`, 'value');
  W(`${p}-count`, 'value', `${p}-sub6`, 'a');
  W(`${p}-c6`, 'value', `${p}-sub6`, 'b');
  W(`${p}-sub6`, 'out', `${p}-pickB`, 'value');
  for (let i = 3; i <= 12; i++) {
    W(`${p}-start`, 'fired', `${p}-goods-${i}`, 'hide');
    if (i <= 6) W(`${p}-pickA`, `is${i}`, `${p}-goods-${i}`, 'show');
    else W(`${p}-pickB`, `is${i - 6}`, `${p}-goods-${i}`, 'show');
  }
  W(`${p}-go-work`, 'moveX', `${p}-mx`, 'a');
  W(`${p}-go-bay`, 'moveX', `${p}-mx`, 'b');
  W(`${p}-go-work`, 'moveY', `${p}-my`, 'a');
  W(`${p}-go-bay`, 'moveY', `${p}-my`, 'b');
  W(`${p}-mx`, 'out', `${p}-bot`, 'moveX');
  W(`${p}-my`, 'out', `${p}-bot`, 'moveY');
  W(pad, 'self', `${p}-label`, 'anchor');
  W(`${p}-crop`, 'self', `${p}-label-work`, 'anchor');
  return g;
}

worker({
  key: 'fm', gname: 'Nông trại: bot nông dân và bãi rau', d: DIST.farm, bayDz: 6, side: -1, tag: 'rau',
  goodsShape: 'veggie', goodsColor: '#4ade80', botColor: '#16a34a', look: 'human', toolShape: 'bucket', toolColor: '#38bdf8',
  cropStyle: 'field', cropW: 1.8, cropH: 0.5, cropColor: '#3f8f3a', label: 'Nông trại: chất RAU', workLabel: 'Ruộng rau',
});
worker({
  key: 'mn', gname: 'Mỏ đá: bot thợ mỏ và bãi quặng', d: DIST.mine, bayDz: 6, side: 1, tag: 'quặng',
  goodsShape: 'ore', goodsColor: '#475569', botColor: '#f59e0b', look: 'robot', toolShape: 'pickaxe', toolColor: '#f59e0b',
  cropStyle: 'rock', cropW: 1.8, cropH: 1.2, cropColor: '#64748b', label: 'Mỏ đá: chất QUẶNG', workLabel: 'Tảng đá',
});

// Harbour: the loader carries 12 crates one by one from the pile to the bay.
{
  const p = 'pt';
  const d = DIST.cang;
  const g = new Group('pt', 'Cảng kho: bot bốc vác và bãi thùng', C.source);
  const bayX = d.cx;
  const bayZ = d.cz - 6;
  const pile = [d.cx + 4.5, d.cz + 3.2];
  g.add(`${p}-bot`, 'character', { position: V(d.cx + 2, 0.5, d.cz + 1.5), speed: 2.4, jumpPower: 10, color: '#0ea5e9', look: 'dino', role: 'bot' });
  g.add(`${p}-carry`, 'carry', { mode: 'separate', throwPower: 8 });
  g.add(`${p}-seq`, 'sequence', { stepCount: 2, loop: 'yes' });
  g.add(`${p}-go-pile`, 'go-to', { targetPos: V(pile[0], 0.5, pile[1]), stopDistance: 0.3, pathfind: 'on' });
  g.add(`${p}-go-bay`, 'go-to', { targetPos: V(bayX, 0.5, bayZ + 2), stopDistance: 0.5, pathfind: 'on' });
  g.add(`${p}-or-next`, 'or');
  g.add(`${p}-mx`, 'math', { op: 'add' });
  g.add(`${p}-my`, 'math', { op: 'add' });
  g.br();
  const pad = blk(g, `${p}-pad`, { p: [bayX, 0.105, bayZ], s: [6, 0.05, 6], c: '#fbbf24', pick: true });
  item(g, `${p}-ready-1`, { p: [bayX - 0.7, 0.35, bayZ], shape: 'crate', c: '#b45309', tag: 'thùng' });
  item(g, `${p}-ready-2`, { p: [bayX + 0.7, 0.35, bayZ], shape: 'crate', c: '#b45309', tag: 'thùng' });
  g.br();
  GRID.forEach(([dx, dz], i) => {
    item(g, `${p}-crate-${i + 1}`, { p: [pile[0] + dx * 0.22, 0.35, pile[1] + dz * 0.3], shape: 'crate', c: '#b45309', tag: 'thùng' });
  });
  g.br();
  text(g, `${p}-label`, 'Cảng kho: chất THÙNG', '#ffffff');
  bayLoader(g, p, pad, 'thùng');
  W(`${p}-bot`, 'self', `${p}-carry`, 'character');
  W(`${p}-bot`, 'self', `${p}-go-pile`, 'self');
  W(`${p}-bot`, 'self', `${p}-go-bay`, 'self');
  W(`${p}-seq`, 'step1', `${p}-go-pile`, 'go');
  W(`${p}-seq`, 'step2', `${p}-go-bay`, 'go');
  W(`${p}-go-pile`, 'arrivedPulse', `${p}-carry`, 'grab');
  W(`${p}-go-bay`, 'arrivedPulse', `${p}-carry`, 'drop');
  W(`${p}-go-pile`, 'arrivedPulse', `${p}-or-next`, 'a');
  W(`${p}-go-bay`, 'arrivedPulse', `${p}-or-next`, 'b');
  W(`${p}-or-next`, 'out', `${p}-seq`, 'next');
  W(`${p}-go-pile`, 'moveX', `${p}-mx`, 'a');
  W(`${p}-go-bay`, 'moveX', `${p}-mx`, 'b');
  W(`${p}-go-pile`, 'moveY', `${p}-my`, 'a');
  W(`${p}-go-bay`, 'moveY', `${p}-my`, 'b');
  W(`${p}-mx`, 'out', `${p}-bot`, 'moveX');
  W(`${p}-my`, 'out', `${p}-bot`, 'moveY');
  W(pad, 'self', `${p}-label`, 'anchor');
}

// ---------------------------------------------------------------- traffic lights (one clock per interior crossing)

const LIGHTS = [];
INNER.forEach((ix, a) => {
  INNER.forEach((iz, b) => {
    const n = LIGHTS.length;
    const p = `lg${n + 1}`;
    const g = new Group(p, `Đèn giao thông ${n + 1} (ngã tư ${ix < 0 ? 'Tây' : 'Đông'} ${iz < 0 ? 'Bắc' : 'Nam'})`, C.light);
    g.add(`${p}-timer`, 'timer', { seconds: [3, 3.2, 2.8, 3.4][n] });
    g.add(`${p}-again`, 'or');
    g.add(`${p}-phase`, 'counter', { start: 1, target: 7 });
    g.add(`${p}-wrap`, 'or');
    g.add(`${p}-c1`, 'const', { value: 1 });
    g.add(`${p}-c6`, 'const', { value: 6 });
    g.add(`${p}-sub`, 'math', { op: 'sub' });
    g.add(`${p}-selb`, 'select-number', { choices: 2 });
    g.add(`${p}-is1`, 'or');
    g.add(`${p}-c3`, 'const', { value: 3 });
    g.add(`${p}-cm1`, 'const', { value: -1 });
    g.br();
    g.add(`${p}-sel`, 'select-number', { choices: 6 });
    g.add(`${p}-ew`, 'counter', { start: 3, target: 99 });
    g.add(`${p}-ns`, 'counter', { start: 2, target: 99 });
    g.br();
    for (const id of ['oe1', 'oe2', 'oe', 'on1', 'on2', 'on']) g.add(`${p}-${id}`, 'or');
    g.add(`${p}-go-ew`, 'not');
    g.add(`${p}-go-ns`, 'not');
    g.br();
    // Poles on the four corners: the north-east and south-west ones show the east-west colour.
    const poles = [
      ['ne', 4.9, -4.9, 'ew'], ['sw', -4.9, 4.9, 'ew'], ['nw', -4.9, -4.9, 'ns'], ['se', 4.9, 4.9, 'ns'],
    ];
    for (const [id, dx, dz] of poles) {
      blk(g, `${p}-pole-${id}`, { p: [ix + dx, 1.7, iz + dz], s: [0.9, 3.4, 0.9], c: '#a3a3a3', style: 'trafficlight' });
    }
    W(`${p}-timer`, 'done', `${p}-again`, 'a');
    W(`${p}-again`, 'out', `${p}-timer`, 'reset');
    W(`${p}-timer`, 'done', `${p}-phase`, 'up');
    W(`${p}-phase`, 'reached', `${p}-wrap`, 'a');
    W(`${p}-wrap`, 'out', `${p}-phase`, 'set');
    W(`${p}-c1`, 'value', `${p}-phase`, 'setAmount');
    W(`${p}-phase`, 'value', `${p}-sel`, 'value');
    // The counter shows 7 for a moment before it wraps to 1: count that as step 1 so no light ever drops out.
    W(`${p}-phase`, 'value', `${p}-sub`, 'a');
    W(`${p}-c6`, 'value', `${p}-sub`, 'b');
    W(`${p}-sub`, 'out', `${p}-selb`, 'value');
    W(`${p}-sel`, 'is1', `${p}-is1`, 'a');
    W(`${p}-selb`, 'is1', `${p}-is1`, 'b');
    W(`${p}-sel`, 'is3', `${p}-ew`, 'down');
    W(`${p}-sel`, 'is4', `${p}-ew`, 'add');
    W(`${p}-cm1`, 'value', `${p}-ew`, 'addAmount');
    W(`${p}-is1`, 'out', `${p}-ew`, 'set');
    W(`${p}-c3`, 'value', `${p}-ew`, 'setAmount');
    W(`${p}-sel`, 'is6', `${p}-ns`, 'down');
    W(`${p}-is1`, 'out', `${p}-ns`, 'add');
    W(`${p}-cm1`, 'value', `${p}-ns`, 'addAmount');
    W(`${p}-sel`, 'is4', `${p}-ns`, 'set');
    W(`${p}-c3`, 'value', `${p}-ns`, 'setAmount');
    // East-west must stop while yellow or red (steps 3..6), north-south in steps 6, 1, 2, 3.
    W(`${p}-sel`, 'is3', `${p}-oe1`, 'a');
    W(`${p}-sel`, 'is4', `${p}-oe1`, 'b');
    W(`${p}-sel`, 'is5', `${p}-oe2`, 'a');
    W(`${p}-sel`, 'is6', `${p}-oe2`, 'b');
    W(`${p}-oe1`, 'out', `${p}-oe`, 'a');
    W(`${p}-oe2`, 'out', `${p}-oe`, 'b');
    W(`${p}-sel`, 'is6', `${p}-on1`, 'a');
    W(`${p}-is1`, 'out', `${p}-on1`, 'b');
    W(`${p}-sel`, 'is2', `${p}-on2`, 'a');
    W(`${p}-sel`, 'is3', `${p}-on2`, 'b');
    W(`${p}-on1`, 'out', `${p}-on`, 'a');
    W(`${p}-on2`, 'out', `${p}-on`, 'b');
    W(`${p}-oe`, 'out', `${p}-go-ew`, 'in');
    W(`${p}-on`, 'out', `${p}-go-ns`, 'in');
    for (const [id, , , axis] of poles) W(`${p}-${axis}`, 'value', `${p}-pole-${id}`, 'pick');
    LIGHTS.push({ ix, iz, p, stopEW: `${p}-oe`, goEW: `${p}-go-ew`, stopNS: `${p}-on`, goNS: `${p}-go-ns` });
  });
});

// ---------------------------------------------------------------- bot cars on one-way loops

/** Clockwise loops (right-hand traffic): top edge east, right edge south, bottom west, left north. */
const LOOPS = [
  { key: 'lp1', name: 'Vòng xe 1 (góc Tây Bắc)', rect: [-37, 11, -37, 11], spawn: [1, 3], color: '#38bdf8', speed: [4.2, 4.6] },
  { key: 'lp2', name: 'Vòng xe 2 (góc Đông Bắc)', rect: [-11, 37, -37, 11], spawn: [0, 2], color: '#a3e635', speed: [4.4, 4] },
  { key: 'lp3', name: 'Vòng xe 3 (góc Tây Nam)', rect: [-37, 11, -11, 37], spawn: [0, 2], color: '#f472b6', speed: [4.0, 4.5] },
  { key: 'lp4', name: 'Vòng xe 4 (góc Đông Nam)', rect: [-11, 37, -11, 37], spawn: [1, 3], color: '#facc15', speed: [4.6, 4.2] },
  { key: 'lp5', name: 'Vòng ngoài thành phố', rect: [-37, 37, -37, 37], spawn: [0, 2], color: '#e2e8f0', speed: [4.3, 4.0] },
];

/** Approach lines (where a car must wait at a red light) that a straight edge from a to b crosses. */
function linesOnEdge(a, b) {
  const out = [];
  const east = b.x > a.x;
  const south = b.z > a.z;
  const horizontal = a.z === b.z;
  for (const ix of INNER) {
    for (const iz of INNER) {
      if (horizontal) {
        const laneZ = east ? iz + 2 : iz - 2;
        if (laneZ !== a.z) continue;
        const lineX = east ? ix - 5 : ix + 5;
        const lo = Math.min(a.x, b.x);
        const hi = Math.max(a.x, b.x);
        if (lineX > lo && lineX < hi) out.push({ ix, iz, dir: east ? 'E' : 'W', x: lineX, z: laneZ });
      } else {
        const laneX = south ? ix - 2 : ix + 2;
        if (laneX !== a.x) continue;
        const lineZ = south ? iz - 5 : iz + 5;
        const lo = Math.min(a.z, b.z);
        const hi = Math.max(a.z, b.z);
        if (lineZ > lo && lineZ < hi) out.push({ ix, iz, dir: south ? 'S' : 'N', x: laneX, z: lineZ });
      }
    }
  }
  return out;
}

const CAR_STATS = [];
for (const L of LOOPS) {
  const g = new Group(L.key, L.name, C.car);
  const [xl, xr, zt, zb] = L.rect;
  const corners = [{ x: xl, z: zt }, { x: xr, z: zt }, { x: xr, z: zb }, { x: xl, z: zb }];
  // Which stop lines this loop passes, and which of them each car meets (cars share the loop).
  const lines = new Map();
  for (let e = 0; e < 4; e++) {
    for (const ln of linesOnEdge(corners[e], corners[(e + 1) % 4])) lines.set(`${ln.ix}_${ln.iz}_${ln.dir}`, ln);
  }
  const lineIds = new Map();
  [...lines.values()].forEach((ln, i) => {
    const id = `${L.key}-line-${i + 1}`;
    const ew = ln.dir === 'E' || ln.dir === 'W';
    blk(g, id, {
      p: [ln.x, 0.06, ln.z],
      s: ew ? [0.4, 0.04, 3.4] : [3.4, 0.04, 0.4],
      c: '#ef4444',
      pick: true,
    });
    const light = LIGHTS.find((l) => l.ix === ln.ix && l.iz === ln.iz);
    W(ew ? light.stopEW : light.stopNS, 'out', id, 'show');
    W(ew ? light.goEW : light.goNS, 'out', id, 'hide');
    lineIds.set(`${ln.ix}_${ln.iz}_${ln.dir}`, id);
  });
  g.br();
  L.spawn.forEach((cornerIdx, k) => {
    const car = `${L.key}-car${k + 1}`;
    const rt = `${L.key}-route${k + 1}`;
    const pt = corners[cornerIdx];
    g.add(car, 'vehicle', {
      position: V(pt.x, 0.6, pt.z), model: 'car', steerMode: 'direction', maxSpeed: 6, accel: 6, color: k === 0 ? L.color : '#f8fafc', solid: 'yes', control: 'auto',
    });
    g.add(rt, 'route-follow', {
      count: 4, p1: V(corners[0].x, 0.5, corners[0].z), p2: V(corners[1].x, 0.5, corners[1].z),
      p3: V(corners[2].x, 0.5, corners[2].z), p4: V(corners[3].x, 0.5, corners[3].z),
      style: 'loop', speed: L.speed[k], lookAhead: 1.6,
    });
    W(car, 'self', rt, 'self');
    // The car waits whenever it touches a red approach line that lies on its way.
    const touches = [];
    for (const [key, id] of lineIds) {
      const t = `${L.key}-t${k + 1}-${touches.length + 1}`;
      g.add(t, 'touch');
      W(car, 'self', t, 'a');
      W(id, 'self', t, 'b');
      touches.push(t);
    }
    let prev = null;
    touches.forEach((t, n) => {
      if (n === 0) prev = { id: t, port: 'touching' };
      else {
        const o = `${L.key}-o${k + 1}-${n}`;
        g.add(o, 'or');
        W(prev.id, prev.port, o, 'a');
        W(t, 'touching', o, 'b');
        prev = { id: o, port: 'out' };
      }
    });
    if (prev) W(prev.id, prev.port, rt, 'stop');
    g.br();
    CAR_STATS.push({ car, route: rt, loop: L.key });
  });
}

// ---------------------------------------------------------------- pedestrians

{
  const g = new Group('ped', 'Người đi bộ qua đường', C.ped);
  const CROSS = [[-13, -26], [13, -26], [-13, 0], [13, 0], [-13, 26], [13, 26]];
  const looks = ['human', 'cat', 'human', 'chick', 'human', 'robot'];
  const colors = ['#ec4899', '#f97316', '#14b8a6', '#eab308', '#8b5cf6', '#64748b'];
  CROSS.forEach(([x, z], i) => {
    const id = `ped${i + 1}`;
    const west = i % 2 === 0;
    const a = x - 5.2;
    const b = x + 5.2;
    g.add(`${id}-who`, 'character', { position: V(west ? a : b, 0.5, z), speed: 1.5, jumpPower: 10, color: colors[i], look: looks[i], role: 'bot' });
    g.add(`${id}-route`, 'route-follow', {
      count: 2, p1: V(a, 0.5, z), p2: V(b, 0.5, z), style: 'pingpong', speed: 1.5, lookAhead: 1.2,
    });
    W(`${id}-who`, 'self', `${id}-route`, 'self');
    W(`${id}-route`, 'moveX', `${id}-who`, 'moveX');
    W(`${id}-route`, 'moveY', `${id}-who`, 'moveY');
    g.br();
  });
}

// ---------------------------------------------------------------- the world: roads and the fence

{
  const g = new Group('roads', 'Mặt đường, vạch qua đường và tường rào', C.scene);
  blk(g, 'wd-ground', { p: [0, -0.5, 0], s: [100, 1, 100], c: '#8fb867' });
  g.br();
  ROAD.forEach((z, i) => blk(g, `wd-road-h${i + 1}`, { p: [0, 0.02, z], s: [86, 0.04, 8], c: '#4b5563', style: 'road', pick: true }));
  g.br();
  let n = 0;
  ROAD.forEach((x, i) => {
    for (const zc of ROW) blk(g, `wd-road-v${i + 1}-${++n}`, { p: [x, 0.02, zc], s: [8, 0.04, 18], c: '#4b5563', style: 'road', pick: true });
  });
  g.br();
  // Zebra crossings where the pedestrians cross (stripes run along the walking direction).
  [[-13, -26], [13, -26], [-13, 0], [13, 0], [-13, 26], [13, 26]].forEach(([x, z], i) => {
    for (const k of [-1.5, -0.5, 0.5, 1.5]) {
      blk(g, `wd-zebra-${i + 1}-${k}`, { p: [x, 0.065, z + k], s: [7, 0.03, 0.45], c: '#f8fafc', pick: true });
    }
    g.br();
  });
  // The edge of the world, in short pieces and well away from the lanes: a long box right beside a turning car
  // makes its obstacle check over-cautious (it only knows axis-aligned boxes) and the car would stop for good.
  for (let k = 0; k < 18; k++) {
    const c = -42.5 + k * 5;
    blk(g, `wd-fence-n${k + 1}`, { p: [c, 0.7, -45.2], s: [5, 1.4, 0.4], c: '#92400e', style: 'fence' });
    blk(g, `wd-fence-s${k + 1}`, { p: [c, 0.7, 45.2], s: [5, 1.4, 0.4], c: '#92400e', style: 'fence' });
    blk(g, `wd-fence-w${k + 1}`, { p: [-45.2, 0.7, c], s: [0.4, 1.4, 5], c: '#92400e', style: 'fence' });
    blk(g, `wd-fence-e${k + 1}`, { p: [45.2, 0.7, c], s: [0.4, 1.4, 5], c: '#92400e', style: 'fence' });
  }
}

// ---------------------------------------------------------------- district scenery

/** Seeded random numbers so the generated board never changes between runs. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Scenery helper bound to one district group. Coordinates are offsets from the district centre. */
function scenery(key, d, plinthColor) {
  const g = new Group(`sc-${key}`, `${d.name}: cảnh quan`, C.scene);
  let n = 0;
  const id = (what) => `sc-${key}-${what}${++n}`;
  const at = (dx, y, dz) => [d.cx + dx, y, d.cz + dz];
  blk(g, `sc-${key}-plinth`, { p: at(0, 0.04, 0), s: [18, 0.08, 18], c: plinthColor, style: 'sidewalk', pick: true });
  const api = {
    g,
    /** A solid building: size (w, h, depth); doors face +Z. */
    house(dx, dz, w, h, dd, color, style = 'house') {
      blk(g, id(style), { p: at(dx, h / 2 + 0.08, dz), s: [w, h, dd], c: color, style });
    },
    tree(dx, dz, color = '#4ade80', h = 2.6) {
      blk(g, id('tree'), { p: at(dx, h / 2 + 0.08, dz), s: [1.8, h, 1.8], c: color, style: 'tree' });
    },
    lamp(dx, dz, color = '#9ca3af') {
      blk(g, id('lamp'), { p: at(dx, 1.9, dz), s: [0.8, 3.6, 0.8], c: color, style: 'lamppost' });
    },
    rock(dx, dz, s = 2.4, color = '#78716c') {
      blk(g, id('rock'), { p: at(dx, s * 0.4 + 0.08, dz), s: [s, s * 0.8, s], c: color, style: 'rock' });
    },
    fence(dx, dz, len, alongX, color = '#a16207') {
      // Pieces of at most 5 units (see the edge-of-world fence).
      const parts = Math.ceil(len / 5);
      const each = len / parts;
      for (let k = 0; k < parts; k++) {
        const off = -len / 2 + each * (k + 0.5);
        blk(g, id('fence'), {
          p: at(dx + (alongX ? off : 0), 0.7 + 0.08, dz + (alongX ? 0 : off)),
          s: alongX ? [each, 1.4, 0.4] : [0.4, 1.4, each],
          c: color,
          style: 'fence',
        });
      }
    },
    flat(dx, dz, w, dd, color, style = 'box', y = 0.1) {
      blk(g, id('flat'), { p: at(dx, y, dz), s: [w, 0.06, dd], c: color, style, pick: true });
    },
    field(dx, dz, w, dd, color = '#3f8f3a') {
      blk(g, id('field'), { p: at(dx, 0.3, dz), s: [w, 0.5, dd], c: color, style: 'field', pick: true });
    },
    crates(dx, dz, color = '#b45309') {
      blk(g, id('crate'), { p: at(dx, 0.7, dz), s: [2.2, 1.2, 1.4], c: color });
    },
    sign(dx, dz, label) {
      blk(g, id('sign'), { p: at(dx, 1.2, dz), s: [3.6, 2.4, 0.3], c: '#f8fafc', style: 'sign', text: label });
    },
  };
  return api;
}

// -- source districts
{
  const s = scenery('farm', DIST.farm, '#d9f99d');
  s.house(6.6, -4.6, 4.4, 3.4, 4, '#dc2626', 'factory');
  s.field(-4.5, -6, 6.4, 3.6);
  s.field(1.5, -6, 6.4, 3.6, '#4d9a3d');
  s.fence(-7.5, -1.5, 5, false);
  s.fence(8.2, 2.6, 3, false);
  s.tree(-8, 4);
  s.tree(8, -0.5 + 5.5);
  s.tree(-7.6, -8.2);
  s.tree(8, -8.2);
  s.lamp(7.6, 7.4);
  s.sign(5.5, 8.3, DIST.farm.name);
}
{
  const s = scenery('mine', DIST.mine, '#d6d3d1');
  s.house(-6.4, -4.8, 4.4, 3.2, 4, '#64748b', 'factory');
  s.rock(0, -6.2, 3.2);
  s.rock(5.2, -5.4, 2.6, '#57534e');
  s.rock(-8, 3.8, 2.2);
  s.rock(8, 2.8, 2.4, '#57534e');
  s.rock(-1.5, -2.8, 1.8);
  s.fence(-7.8, 7, 3.6, false);
  s.lamp(-7.6, 7.4);
  s.sign(-5.5, 8.3, DIST.mine.name);
}
{
  const s = scenery('cang', DIST.cang, '#cbd5e1');
  s.house(-5.5, 7.2, 4.4, 3.4, 3.2, '#0ea5e9', 'factory');
  s.house(0, 7.2, 4.4, 3.4, 3.2, '#f59e0b', 'factory');
  s.house(5.5, 7.2, 4.4, 3.4, 3.2, '#ef4444', 'factory');
  s.crates(-7, 2.4);
  s.crates(-7, 4.2, '#0f766e');
  s.crates(7, -1.8, '#7c2d12');
  s.lamp(-8, -8);
  s.lamp(8, -8);
  s.fence(-8.5, -3, 4, false);
  s.sign(-6.8, -8.3, DIST.cang.name);
}

// -- residential and commercial districts (front row = the houses in the delivery group)
{
  const s = scenery('hoasen', DIST.hoasen, '#fce7f3');
  s.house(-4.2, -0.6, 3.4, 2.8, 3.2, '#f9a8d4');
  s.house(4.2, -0.6, 3.4, 2.8, 3.2, '#fef08a');
  s.flat(0, -6.6, 9, 3.4, '#7dd3fc', 'box', 0.12);
  s.flat(-1.5, -6.4, 1.1, 1.1, '#f472b6', 'box', 0.16);
  s.flat(1.8, -6.9, 1.1, 1.1, '#f9a8d4', 'box', 0.16);
  s.tree(-7.4, -6.5, '#fb7185');
  s.tree(7.4, -6.5, '#fb7185');
  s.tree(-7.6, 3.6, '#f9a8d4');
  s.tree(7.6, 3.6, '#f9a8d4');
  s.lamp(-8.2, -3.5);
  s.lamp(8.2, -3.5);
  s.fence(0, -8.6, 14, true, '#f472b6');
  s.sign(0, 8.3, DIST.hoasen.name);
}
{
  const s = scenery('phoco', DIST.phoco, '#e7e5e4');
  s.house(-4.2, -0.6, 3.4, 3, 3.2, '#a16207', 'shop');
  s.house(4.2, -0.6, 3.4, 3, 3.2, '#7c2d12', 'shop');
  s.house(-4.4, -6.2, 3.6, 3.4, 3.2, '#b45309', 'shop');
  s.house(0, -6.2, 3.6, 3.4, 3.2, '#92400e', 'shop');
  s.house(4.4, -6.2, 3.6, 3.4, 3.2, '#9a3412', 'shop');
  s.lamp(-7.8, 3.4);
  s.lamp(7.8, 3.4);
  s.lamp(-7.8, -3.4);
  s.lamp(7.8, -3.4);
  s.tree(-8, -8.2, '#65a30d');
  s.tree(8, -8.2, '#65a30d');
  s.sign(0, 8.3, DIST.phoco.name);
}
{
  const s = scenery('bosong', DIST.bosong, '#ccfbf1');
  s.house(-4.2, -0.6, 3.4, 2.8, 3.2, '#67e8f9');
  s.house(4.2, -0.6, 3.4, 2.8, 3.2, '#a5b4fc');
  s.flat(0, -7.2, 18, 3.6, '#38bdf8', 'box', 0.1);
  s.fence(0, -5.2, 14, true, '#0f766e');
  s.tree(-7.6, 3.8, '#34d399');
  s.tree(7.6, 3.8, '#34d399');
  s.tree(-7.8, -3.4, '#34d399');
  s.tree(7.8, -3.4, '#34d399');
  s.lamp(-8.2, 3.4);
  s.lamp(8.2, 3.4);
  s.sign(0, 8.3, DIST.bosong.name);
}
{
  const s = scenery('cholon', DIST.cholon, '#fef3c7');
  s.house(-3.6, -0.6, 3.2, 2.6, 3, '#ef4444', 'stall');
  s.house(3.6, -0.6, 3.2, 2.6, 3, '#22c55e', 'stall');
  s.house(-5.6, -6, 3.2, 2.6, 3, '#f59e0b', 'stall');
  s.house(-1.8, -6, 3.2, 2.6, 3, '#3b82f6', 'stall');
  s.house(1.8, -6, 3.2, 2.6, 3, '#ec4899', 'stall');
  s.house(5.6, -6, 3.2, 2.6, 3, '#14b8a6', 'stall');
  s.lamp(-8, 3.6);
  s.lamp(8, 3.6);
  s.lamp(-8, -3.4);
  s.lamp(8, -3.4);
  s.sign(0, 8.3, DIST.cholon.name);
}
{
  const s = scenery('doixanh', DIST.doixanh, '#bbf7d0');
  s.house(-4.2, -0.6, 3.4, 2.8, 3.2, '#4ade80');
  s.house(4.2, -0.6, 3.4, 2.8, 3.2, '#a3e635');
  s.rock(-4, -6.4, 3.8, '#65a30d');
  s.rock(3, -6.6, 4.2, '#4d7c0f');
  s.rock(7.6, -3.4, 2.2, '#65a30d');
  s.tree(-8, -3.2, '#16a34a');
  s.tree(-7.8, 3.8, '#15803d');
  s.tree(7.8, 3.8, '#15803d');
  s.tree(0, -2.6, '#22c55e');
  s.tree(-8, -8, '#16a34a');
  s.tree(8, -8, '#16a34a');
  s.fence(0, 1.9, 4, true, '#854d0e');
  s.sign(0, 8.3, DIST.doixanh.name);
}
{
  const s = scenery('congtruong', DIST.congtruong, '#d6d3d1');
  s.crates(-4.4, -0.6, '#b45309');
  s.crates(4.4, -0.6, '#0f766e');
  s.crates(-3.6, -2.4, '#7c2d12');
  s.house(-4.6, -6.4, 4.4, 3.4, 3.4, '#9ca3af', 'factory');
  s.house(1.0, -6.4, 4.4, 3.4, 3.4, '#6b7280', 'factory');
  s.house(6.4, -6.4, 3.4, 3.4, 3.4, '#9ca3af', 'factory');
  s.rock(-7.6, -2.4, 2.0, '#a8a29e');
  s.rock(7.8, 3.4, 2.2, '#a8a29e');
  s.fence(-8.2, 3.4, 4.4, false, '#eab308');
  s.lamp(8.2, 0.6);
  s.sign(0, 8.3, DIST.congtruong.name);
}

// ---------------------------------------------------------------- district deliveries (houses, yellow pads, order text, arrows)

const FRONT = {
  hoasen: [['house', '#f472b6'], ['house', '#facc15']],
  phoco: [['shop', '#f59e0b'], ['shop', '#ef4444']],
  bosong: [['house', '#38bdf8'], ['house', '#818cf8']],
  cholon: [['shop', '#fde047'], ['house', '#fb923c']],
  doixanh: [['house', '#22c55e'], ['house', '#84cc16']],
  congtruong: [['factory', '#fb923c'], ['factory', '#facc15']],
};
const DISTRICT_ORDER = ['hoasen', 'phoco', 'bosong', 'cholon', 'doixanh', 'congtruong'];
const ACTIVE_SOURCE = (i) => (i <= 6 ? { node: 'od-selA', port: `is${i}` } : { node: 'od-selB', port: `is${i - 6}` });

for (const key of DISTRICT_ORDER) {
  const d = DIST[key];
  const g = new Group(`dl-${key}`, `${d.name}: nhà nhận hàng`, C.deliver);
  const mine = SLOTS.map((s, i) => ({ ...s, i: i + 1 })).filter((s) => s.d === key);
  FRONT[key].forEach(([style, color], idx) => {
    const n = idx + 1;
    const hx = d.cx + (idx === 0 ? -4.4 : 4.4);
    const hz = d.cz + 5.3;
    const id = `dl-${key}-house${n}`;
    blk(g, id, { p: [hx, 1.7 + 0.08, hz], s: [4.4, 3.4, 4.4], c: color, style });
    text(g, `dl-${key}-name${n}`, `Nhà ${n}`, '#ffffff');
    W(id, 'self', `dl-${key}-name${n}`, 'anchor');
    g.br();
    const slot = mine.find((s) => s.house === n);
    if (!slot) return;
    const pad = `dl-${key}-pad${n}`;
    blk(g, pad, { p: [hx, 0.105, d.cz + 10.7], s: [4.6, 0.05, 4.6], c: '#fde047', pick: true });
    const k = slot.i;
    g.add(`dl-${key}-act${n}`, 'or'); // funnel for the "this order is active" signal
    g.add(`dl-${key}-touch${n}`, 'touch');
    g.add(`dl-${key}-here${n}`, 'and');
    text(g, `dl-${key}-here-label${n}`, 'Giao ở đây!', '#fca5a5');
    text(g, `dl-${key}-order${n}`, `Đơn: ${d.name} – Nhà ${n} cần ${NEED} ${slot.type}`, '#fde68a', 'top-right');
    g.add(`dl-${key}-arrow${n}`, 'guide-arrow', { color: '#f59e0b', showDistance: 'yes' });
    g.br();
    const src = ACTIVE_SOURCE(k);
    W(src.node, src.port, `dl-${key}-act${n}`, 'a');
    W('tk-truck', 'self', `dl-${key}-touch${n}`, 'a');
    W(pad, 'self', `dl-${key}-touch${n}`, 'b');
    W(`dl-${key}-touch${n}`, 'touching', `dl-${key}-here${n}`, 'a');
    W(`dl-${key}-act${n}`, 'out', `dl-${key}-here${n}`, 'b');
    W(`dl-${key}-here${n}`, 'out', `tk-here-${k}`, 'a');
    W(id, 'self', `dl-${key}-here-label${n}`, 'anchor');
    W(`dl-${key}-act${n}`, 'out', `dl-${key}-here-label${n}`, 'show');
    W(`dl-${key}-act${n}`, 'out', `dl-${key}-order${n}`, 'show');
    W('tk-truck', 'self', `dl-${key}-arrow${n}`, 'from');
    W(id, 'self', `dl-${key}-arrow${n}`, 'to');
    W(`dl-${key}-act${n}`, 'out', `dl-${key}-arrow${n}`, 'show');
  });
}

// ---------------------------------------------------------------- main board layout

function portCount(g) {
  const inside = new Set(g.ids);
  const keys = new Set();
  for (const w of wires) {
    const a = inside.has(w.from.node);
    const b = inside.has(w.to.node);
    if (a && !b) keys.add(`o|${w.from.node}|${w.from.port}`);
    else if (b && !a) keys.add(`i|${w.to.node}|${w.to.port}`);
  }
  return keys.size;
}

const find = (key) => groups.find((g) => g.key === key);
const COLUMNS = [
  { title: 'Màn hình, đơn hàng và xe của bạn', keys: ['hud', 'orders', 'truck'] },
  { title: 'Ba khu cấp hàng (bot làm việc)', keys: ['fm', 'mn', 'pt'] },
  { title: 'Đèn giao thông', keys: ['lg1', 'lg2', 'lg3', 'lg4'] },
  { title: 'Xe tự chạy và người đi bộ', keys: ['lp1', 'lp2', 'lp3', 'lp4', 'lp5', 'ped'] },
  { title: 'Nhà nhận hàng của sáu khu', keys: DISTRICT_ORDER.map((k) => `dl-${k}`) },
  { title: 'Cảnh quan (chỉ để trang trí)', keys: ['roads', ...Object.keys(DIST).map((k) => `sc-${k}`)] },
];
const COL_PITCH = 560;
COLUMNS.forEach((col, ci) => {
  let y = 60;
  notes.push({
    id: `note-col${ci + 1}`, text: col.title, color: ['blue', 'yellow', 'pink', 'green', 'yellow', 'blue'][ci],
    pos: { x: ci * COL_PITCH, y: -70 }, size: { w: 420, h: 90 },
  });
  for (const k of col.keys) {
    const g = find(k);
    if (!g) throw new Error(`layout: no group ${k}`);
    g.x = ci * COL_PITCH;
    g.y = y;
    y += 150 + 26 * portCount(g) + 40;
  }
});

// ---------------------------------------------------------------- write

const groupOut = groups.map((g) => ({ id: g.key, name: g.name.slice(0, 40), color: g.color, nodeIds: g.ids, x: g.x, y: g.y }));
for (const g of groups) if (g.name.length > 40) throw new Error(`group name too long: ${g.name}`);
// Unique group ids, no node in two groups, every node grouped.
const grouped = new Set(groups.flatMap((g) => g.ids));
if (grouped.size !== nodes.length) throw new Error('some nodes are not grouped');

const line = (o) => JSON.stringify(o);
const text_ = [
  '{',
  '  "format_version": 1,',
  '  "name": "Thành phố giao hàng 3D",',
  '  "mode": "3d",',
  '  "graph": {',
  '    "nodes": [',
  nodes.map((n) => `      ${line(n)}`).join(',\n'),
  '    ],',
  '    "wires": [',
  wires.map((w) => `      ${line(w)}`).join(',\n'),
  '    ],',
  '    "groups": [',
  groupOut.map((g) => `      ${line(g)}`).join(',\n'),
  '    ]',
  '  },',
  '  "notes": [',
  notes.map((n) => `    ${line(n)}`).join(',\n'),
  '  ]',
  '}',
  '',
].join('\r\n');
writeFileSync(OUT, text_, 'utf8');
console.log(`wrote ${OUT}: ${nodes.length} nodes, ${wires.length} wires, ${groups.length} groups, ${notes.length} notes, ${CAR_STATS.length} cars`);
