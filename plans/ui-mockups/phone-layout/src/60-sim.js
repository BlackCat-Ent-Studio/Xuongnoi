
/* ================= level 2 data + tiny simulation + logic checker ================= */
const CARDS = [
  { id: 'bot', x: 14, y: 22, cat: 'object', title: 'Nhân vật', sub: 'Rô-bốt chân', ins: [], outs: [['self', 'Nhân vật', 'obj'], ['x', 'Vị trí X', 'num']] },
  { id: 'btn', x: 14, y: 138, cat: 'object', title: 'Hộp', sub: 'Nút đỏ (cố định)', locked: true, ins: [], outs: [['self', 'Hộp', 'obj'], ['down', 'Bị đè', 'bool']] },
  { id: 'touch', x: 232, y: 70, cat: 'logic', title: 'Cảm biến chạm', sub: 'Logic', ins: [['a', 'Vật A', 'obj'], ['b', 'Vật B', 'obj']], outs: [['touching', 'Đang chạm', 'bool'], ['began', 'Vừa chạm', 'bool']] },
  { id: 'latch', x: 424, y: 70, cat: 'logic', title: 'Công tắc nhớ', sub: 'Logic', ins: [['set', 'Bật', 'bool'], ['reset', 'Tắt', 'bool']], outs: [['on', 'Đang bật', 'bool']] },
  { id: 'door', x: 610, y: 70, cat: 'object', title: 'Hộp cửa', sub: 'Cửa gỗ', ins: [['open', 'Mở cửa', 'bool']], outs: [['amount', 'Độ mở', 'num']] },
];
const WIRE_DEFS = [
  { id: 'w1', from: 'bot', fp: 'self', to: 'touch', tp: 'a', t: 'obj' },
  { id: 'w2', from: 'btn', fp: 'self', to: 'touch', tp: 'b', t: 'obj' },
  { id: 'w3', from: 'touch', fp: 'began', to: 'latch', tp: 'set', t: 'bool' },
  { id: 'w4', from: 'latch', fp: 'on', to: 'door', tp: 'open', t: 'bool' },
];
const SPEED = 3.4, DOOR_X = 3, STOP_X = DOOR_X - 1.6, BTN_X = -5, WIN_X = 9.3, START_X = -10, FAIL_AFTER = 3, GO_AT = 0.9;
const cfg = { cut: false, cutId: 'w1' };          // "Làm sai thử": one wire removed
const wireOn = (id) => !(cfg.cut && cfg.cutId === id);

function newSim() {
  return {
    T: 0, x: START_X, moving: false, stuck: 0, won: false, failed: false, endT: null,
    btnDown: false, touching: false, began: false, touchEver: false, latch: false, latchEver: false, doorCmd: false, door: 0, doorEver: false,
    botState: 'idle', doorState: 'closed', beganAt: -9,
    changed: { bot: null, touch: null, latch: null, door: null }, fired: {},
  };
}
function stepSim(s, dt) {
  s.T += dt; s.began = false;
  const pTouch = s.touching, pLatch = s.latch, pBot = s.botState, pDoor = s.doorState;
  if (!s.won && !s.failed) {
    let move = s.T > GO_AT;
    const nx = s.x + SPEED * dt;
    if (s.door < 0.92 && nx > STOP_X) { move = false; s.stuck += dt; } else s.stuck = 0;
    if (move) s.x = nx;
    s.moving = move;
    if (s.x >= WIN_X) { s.won = true; s.moving = false; s.endT = s.T; }
    else if (s.stuck > FAIL_AFTER) { s.failed = true; s.moving = false; s.endT = s.T; }
  }
  s.btnDown = Math.abs(s.x - BTN_X) < 0.75;
  s.touching = s.btnDown && wireOn('w1') && wireOn('w2');
  s.began = s.touching && !pTouch;
  if (s.began) s.beganAt = s.T;
  if (s.touching) s.touchEver = true;
  if (s.began && wireOn('w3')) s.latch = true;
  if (s.latch) s.latchEver = true;
  s.doorCmd = s.latch && wireOn('w4');
  if (s.doorCmd) s.door = Math.min(1, s.door + dt / 0.8);
  if (s.door > 0.92) s.doorEver = true;
  s.botState = s.won ? 'win' : s.moving ? 'walk' : s.stuck > 0 ? 'stuck' : 'idle';
  s.doorState = s.door > 0.92 ? 'open' : s.door > 0.02 ? 'opening' : 'closed';
  if (s.botState !== pBot) s.changed.bot = s.T;
  if (s.touching !== pTouch) s.changed.touch = s.T;
  if (s.latch !== pLatch) s.changed.latch = s.T;
  if (s.doorState !== pDoor) s.changed.door = s.T;
  // a wire "fires" when the signal on it rises; a removed wire never fires
  if (s.touching && !pTouch) { if (wireOn('w1')) s.fired.w1 = s.T; if (wireOn('w2')) s.fired.w2 = s.T; }
  if (s.began && wireOn('w3')) s.fired.w3 = s.T;
  if (s.latch && !pLatch && wireOn('w4')) s.fired.w4 = s.T;
}
function runTo(s, seconds) { while (s.T < seconds - 1e-6) stepSim(s, 1 / 60); }

/* ---------- logic checker: compares what each wired piece did with what it should do ---------- */
const CHECK_ROWS = [
  { id: 'bot', name: 'Nhân vật', expect: 'Dẫm nút đỏ rồi đi tới cờ' },
  { id: 'touch', name: 'Cảm biến chạm', expect: 'Phải bật khi bot dẫm lên nút đỏ' },
  { id: 'latch', name: 'Công tắc nhớ', expect: 'Phải bật (và nhớ) sau khi cảm biến chạm' },
  { id: 'door', name: 'Hộp cửa', expect: 'Phải mở ra trước khi bot tới cửa' },
];
const CHAIN = ['touch', 'latch', 'door'];
const REASONS = {
  touch: { w1: ['Cảm biến chạm chưa bao giờ bật — ô “Vật A” chưa nối với Nhân vật, nên nó không biết bot đã dẫm lên nút.', 'Chưa bao giờ bật: ô Vật A chưa nối Nhân vật'], any: ['Cảm biến chạm chưa bao giờ bật — bot chưa dẫm lên nút.', 'Chưa bao giờ bật: bot chưa dẫm nút'] },
  latch: { w3: ['Công tắc nhớ chưa bao giờ bật — Cảm biến chạm đã báo “vừa chạm” nhưng dây chưa nối vào ô “Bật”.', 'Chưa bao giờ bật: “Vừa chạm” chưa nối vào ô Bật'], any: ['Công tắc nhớ chưa bao giờ bật — chưa có tín hiệu nào vào ô “Bật”.', 'Chưa bao giờ bật: ô Bật chưa nhận tín hiệu'] },
  door: { w4: ['Hộp cửa chưa nhận lệnh mở — Công tắc nhớ đã bật nhưng dây chưa nối vào ô “Mở cửa”, nên bot kẹt trước cửa.', 'Chưa nhận lệnh: “Đang bật” chưa nối vào ô Mở cửa'], any: ['Hộp cửa chưa mở nên bot kẹt trước cửa.', 'Cửa vẫn đóng, bot kẹt'] },
};
function reasonFor(id, which) { const r = REASONS[id]; return (cfg.cut && r[cfg.cutId]) ? r[cfg.cutId][which] : r.any[which]; }

function evalChecker(s) {
  const sat = { bot: s.won, touch: s.touchEver, latch: s.latchEver, door: s.doorEver };
  const culprit = s.failed ? (CHAIN.find((k) => !sat[k]) || null) : null;
  const stateText = {
    bot: s.won ? 'Đã tới cờ' : s.failed ? 'Kẹt trước cửa' : s.moving ? 'Đang đi · x ' + s.x.toFixed(1) : s.botState === 'stuck' ? 'Đứng chờ cửa' : 'Đứng chờ',
    touch: s.touching ? 'BẬT' : 'TẮT', latch: s.latch ? 'BẬT' : 'TẮT',
    door: s.doorState === 'open' ? 'Mở' : s.doorState === 'opening' ? 'Đang mở' : 'Đóng',
  };
  const rows = CHECK_ROWS.map((r) => {
    let verdict = sat[r.id] ? 'ok' : (s.failed ? (culprit === r.id ? 'bad' : 'blocked') : 'pending');
    const ch = s.changed[r.id];
    return { ...r, state: stateText[r.id], time: ch === null ? 'chưa đổi' : 'đổi ' + ch.toFixed(1) + 's', verdict,
      why: verdict === 'bad' ? reasonFor(r.id, 1) : '' , whyLong: verdict === 'bad' ? reasonFor(r.id, 0) : '' };
  });
  return { rows, culprit, okCount: rows.filter((r) => r.verdict === 'ok').length };
}
