// Proposed new display names. Only CHANGED rows are listed; everything else is "giữ" (kept).
// Node: [vi, en, note].  Port override: [vi, en, noteKey|note].
// Ids never change.

export const NOTES = {
  obj: 'Đối tượng = từ chung cho mọi vật / nhân vật / xe (bỏ "Vật", "(vật)")',
  self: 'Cổng "tự thân" của mọi mảnh vật thể đều tên giống nhau: Đối tượng / Self',
  pulse: 'Sự kiện 1 nhịp: bắt đầu bằng "Khi …" / On …',
  enable: 'Mọi công tắc "cho phép hoạt động" đều tên Bật / Enable',
  value: 'Số chung chung = Giá trị / Value (chuẩn IT)',
  reset: 'Mọi lệnh đưa về đầu đều tên Đặt lại / Reset',
  held: 'Trạng thái đang diễn ra: bắt đầu bằng "Đang …"',
  hide: 'Bỏ "(1 nhịp)": cổng này là lệnh ngắn Ẩn / Hiện',
  anchor: 'Gắn UI vào vật: Gắn vào đối tượng / Anchor',
  dest: 'Điểm đến / Destination: một từ cho mọi nơi để đi tới',
  step: 'Sequence dùng "Bước" (Step) thay cho "Việc"',
  legacy: 'Cổng cũ, chỉ để game cũ vẫn chạy: ghi rõ "(cũ)"',
  tidy: 'Bỏ chú thích trong ngoặc (đã có trong ô tuỳ chỉnh / tooltip)',
};

const obj = (en = 'Object') => ['Đối tượng', en, 'obj'];
const self = ['Đối tượng', 'Self', 'self'];
const enable = ['Bật', 'Enable', 'enable'];
const hide = ['Ẩn', 'Hide', 'hide'];
const show = ['Hiện', 'Show', 'hide'];
const value = (en = 'Value') => ['Giá trị', en, 'value'];
const reset = ['Đặt lại', 'Reset', 'reset'];
const anchor = ['Gắn vào đối tượng', 'Anchor', 'anchor'];

const routePoints = {};
for (let i = 1; i <= 8; i++) routePoints[`obj${i}`] = [`Điểm ${i}`, `Waypoint ${i}`, 'Bỏ "(vật)"; Waypoint là từ chuẩn cho điểm trên tuyến'];

export const NEW_NAMES = {
  'ahead-sensor': {
    in: { who: obj('Origin') },
    out: {
      blocked: ['Đang bị chặn', 'Blocked', 'held'],
      thing: ['Đối tượng bị chặn', 'Hit object', 'obj'],
      hit: ['Khi gặp vật cản', 'On hit', 'pulse'],
    },
  },
  block: {
    in: {
      hide, show,
      pick: ['Đặt màu', 'Set color', 'Nhận số 1-2-3 để chọn màu; đã có trong ô tuỳ chỉnh Màu 1-3'],
      run: ['Bật băng chuyền', 'Conveyor', 'Ngắn gọn; EN "Conveyor" là từ chuẩn'],
      hiddenWhile: ['Ẩn khi bật', 'Hide while on', 'Ngắn hơn (cổng cũ)'],
    },
    out: { self, usedOn: ['Khi bị dùng lên', 'On tool hit', 'pulse'] },
  },
  not: { in: { in: ['Đầu vào', 'Input', '"Vào" nghe cụt; "Đầu vào" là từ chuẩn'] } },
  camera: {
    in: {
      target: ['Bám theo đối tượng', 'Follow target', 'obj'],
      zoom: ['Thu phóng', 'Zoom', 'Bỏ "(0 = mặc định)" (đã ghi trong tooltip). "Thu phóng" là từ chuẩn của Zoom'],
    },
  },
  cargo: {
    out: {
      loaded: ['Khi chất hàng', 'On loaded', 'pulse'],
      unloaded: ['Khi dỡ hàng', 'On unloaded', 'pulse'],
      typeCount: ['Số hàng theo loại', 'Count by type', 'Rõ nghĩa hơn "loại này"'],
    },
  },
  carry: { out: { heldItem: ['Đồ đang khiêng', 'Carried item', 'Dùng "Đồ" thống nhất với node Đồ vật'] } },
  character: {
    out: { self, onGround: ['Đang trên mặt đất', 'Grounded', 'held'] },
  },
  'color-sensor': {
    in: { who: obj() },
    out: { index: ['Chỉ số màu', 'Color index', '"Index" là từ chuẩn'] },
  },
  compare: { out: { out: ['Kết quả', 'Result', 'Giống Và / Hoặc / Đảo ngược / Phép tính'] } },
  const: { out: { value: value() } },
  counter: {
    in: {
      up: ['Tăng 1', 'Increment', 'Increment = Tăng; hợp với Giảm 1'],
      down: ['Giảm 1', 'Decrement', 'Decrement = Giảm'],
      reset: ['Đặt lại', 'Reset', 'reset'],
      addAmount: ['Lượng cộng thêm', 'Amount', '"Lượng" tự nhiên hơn "Số cộng thêm"'],
      add: ['Cộng thêm', 'Add', 'Lệnh ngắn'],
      setAmount: ['Giá trị mới', 'New value', 'value'],
      set: ['Đặt giá trị', 'Set value', 'value'],
    },
    out: { reached: ['Đã đạt mục tiêu', 'Reached', 'Nói rõ đạt cái gì'] },
  },
  distance: {
    in: { a: ['Đối tượng A', 'Object A', 'obj'], b: ['Đối tượng B', 'Object B', 'obj'] },
  },
  'enter-exit': {
    in: {
      character: ['Nhân vật', 'Character', 'Cùng tên với cổng của Khiêng đồ, Cầm dụng cụ, Tương tác'],
      press: ['Bấm (cũ)', 'Press (legacy)', 'legacy'],
    },
    out: {
      inVehicle: ['Đang trên xe', 'In vehicle', 'held'],
      vehicle: ['Xe đang dùng', 'Current vehicle', 'Ngắn gọn, rõ nghĩa'],
    },
  },
  'nearest-item': {
    vi: ['Tìm đồ gần nhất', 'Nearest Item', 'Dùng "Đồ" thống nhất với node Đồ vật'],
    in: {
      who: obj('Origin'),
      i1: ['Bỏ qua ô 1', 'Ignore slot 1', 'Ngắn hơn'],
      i2: ['Bỏ qua ô 2', 'Ignore slot 2', 'Ngắn hơn'],
      i3: ['Bỏ qua ô 3', 'Ignore slot 3', 'Ngắn hơn'],
      i4: ['Bỏ qua ô 4', 'Ignore slot 4', 'Ngắn hơn'],
    },
    out: {
      item: ['Đồ gần nhất', 'Nearest item', 'Dùng "Đồ"'],
      found: ['Đã tìm thấy', 'Found', 'held'],
    },
  },
  'go-to': {
    vi: ['Di chuyển', 'Move To', 'Quyết định của bạn (2b): chính xác "Di chuyển"'],
    in: {
      target: ['Điểm đến', 'Destination', 'dest'],
      go: enable,
      target2: ['Điểm đến 2', 'Destination 2', 'dest'],
      useTarget2: ['Dùng điểm đến 2', 'Use destination 2', 'dest'],
    },
    out: {
      arrived: ['Đã đến', 'Arrived', '"đến" thống nhất với "Điểm đến"'],
      arrivedPulse: ['Khi đến nơi', 'On arrive', 'pulse'],
      arrivedAt1: ['Đã đến điểm đến', 'Arrived at destination', 'dest'],
      arrivedAt2: ['Đã đến điểm đến 2', 'Arrived at destination 2', 'dest'],
    },
  },
  chase: { in: { go: enable } },
  fight: { in: { go: enable } },
  'guide-arrow': {
    in: {
      from: ['Từ đối tượng', 'From', 'obj'],
      to: ['Đến đối tượng', 'To', 'obj'],
    },
  },
  'hand-tool': {
    in: { toggle: ['Cầm / Cất (cũ)', 'Toggle (legacy)', 'legacy'] },
    out: {
      holding: ['Đang cầm', 'Equipped', 'held'],
      tool: ['Dụng cụ đang cầm', 'Held tool', 'Nói rõ là dụng cụ'],
      used: ['Khi dùng', 'On use', 'pulse'],
      hit: ['Khi trúng', 'On hit', 'pulse'],
    },
  },
  health: {
    out: {
      hp: ['Máu hiện tại', 'Current HP', 'Rõ nghĩa hơn "Máu còn"'],
      hurtPulse: ['Khi bị thương', 'On damaged', 'pulse'],
    },
  },
  interact: {
    out: {
      fired: ['Khi tương tác', 'On interact', 'pulse'],
      target: ['Đồ được dùng', 'Target', 'Dùng "Đồ"'],
    },
  },
  item: {
    in: { hide, show },
    out: {
      self,
      interacted: ['Khi được tương tác', 'On interact', 'pulse'],
      usedOn: ['Khi bị dùng lên', 'On tool hit', 'pulse'],
    },
  },
  key: { out: { pressed: ['Khi nhấn phím', 'On press', 'pulse (Unity: GetKeyDown)'] } },
  'map-range': {
    vi: ['Quy đổi khoảng', 'Map Range', '"Đổi thang số" khó hiểu; Quy đổi = chuyển giá trị từ khoảng này sang khoảng khác'],
    in: { value: ['Giá trị vào', 'Input', 'value'] },
    out: { value: ['Giá trị ra', 'Output', 'value'] },
  },
  'moving-platform': {
    in: { run: enable },
    out: {
      self: ['Đối tượng', 'Self', 'self'],
      moving: ['Đang di chuyển', 'Is moving', 'held'],
      arrived: ['Khi tới cuối đường', 'On reach end', 'pulse'],
    },
  },
  'on-start': { out: { fired: ['Khi bắt đầu', 'On start', 'pulse'] } },
  patrol: {
    in: { on: enable },
    out: { atEnd: ['Khi tới điểm cuối', 'On reach end', 'pulse; bỏ "đầu mút"'] },
  },
  portal: {
    in: { on: ['Bật', 'Enable', 'enable'] },
    out: {
      self,
      used: ['Khi có người vào', 'On enter', 'pulse'],
      who: ['Đối tượng vừa vào', 'Last entered', 'obj'],
    },
  },
  random: {
    out: { value: value(), rolled: ['Khi tung', 'On roll', 'pulse'] },
  },
  'rotating-platform': {
    in: { run: enable },
    out: {
      self,
      angle: ['Góc xoay', 'Angle', 'Bỏ "(độ)" (đơn vị)'],
      turned: ['Khi xoay xong', 'On rotated', 'pulse'],
    },
  },
  'route-follow': {
    in: {
      self: ['Đối tượng', 'Agent', 'Nhận Xe hoặc Bot'],
      ...routePoints,
    },
    out: {
      reached: ['Khi tới điểm', 'On reach point', 'pulse'],
      halted: ['Đang đứng yên', 'Halted', 'held'],
    },
  },
  'select-number': {
    in: { value: value() },
    out: { changed: ['Khi đổi', 'On change', 'pulse'] },
  },
  sequence: {
    vi: ['Chuỗi bước', 'Sequence', 'step'],
    in: {
      next: ['Sang bước kế', 'Next', 'Lệnh nhảy bước; "Next" là từ chuẩn'],
      reset: reset,
    },
    out: {
      index: ['Bước hiện tại', 'Current step', 'step'],
      finished: ['Đã hoàn thành', 'Finished', 'held'],
      step1: ['Bước 1', 'Step 1', 'step'],
      step2: ['Bước 2', 'Step 2', 'step'],
      step3: ['Bước 3', 'Step 3', 'step'],
    },
  },
  shooter: {
    in: { target: ['Mục tiêu', 'Target', 'Bỏ "(tuỳ chọn)": cổng không nối cũng chạy'] },
    out: {
      hit: ['Khi trúng', 'On hit', 'pulse'],
      lastHit: ['Đối tượng bị trúng', 'Hit object', 'obj'],
    },
  },
  'show-number': { in: { value: value() } },
  'show-text': { in: { anchor } },
  spawner: {
    vi: ['Tạo đối tượng', 'Spawner', 'obj'],
    in: {
      spawn: ['Tạo', 'Spawn', 'Lệnh ngắn'],
      at: ['Tại đối tượng', 'Spawn at', 'obj'],
      toucher: ['Chạm thử với', 'Touch test', 'Đối tượng dùng thử chạm'],
    },
    out: {
      lastSpawned: ['Đối tượng mới nhất', 'Latest', 'obj'],
      count: ['Số đang có', 'Count', 'Rõ nghĩa hơn'],
      spawned: ['Khi tạo', 'On spawn', 'pulse'],
      touched: ['Đang chạm thử', 'Touching', 'held'],
    },
  },
  'speed-sensor': {
    in: { who: obj() },
    out: {
      still: ['Đang đứng yên', 'Is still', 'held'],
      fast: ['Vượt ngưỡng', 'Above threshold', 'Rõ là so với ô "Ngưỡng"'],
    },
  },
  stick: {
    out: {
      x: ['Trục ngang', 'Horizontal', 'Bỏ "(trái-phải)"; Axis là từ chuẩn'],
      y: ['Trục dọc', 'Vertical', 'Bỏ "(xuống-lên)"'],
    },
  },
  teleport: {
    in: {
      who: obj('Target'),
      go: ['Dịch chuyển', 'Teleport', 'Lệnh = tên node (như "Bắn" trong Bắn đạn)'],
      dest: ['Điểm đến', 'Destination', 'dest'],
    },
    out: { done: ['Khi dịch chuyển', 'On teleport', 'pulse'] },
  },
  timer: {
    in: {
      run: ['Bắt đầu', 'Start', 'Lệnh ngắn; giữ bật thì đếm'],
      reset: reset,
    },
  },
  touch: {
    vi: ['Va chạm', 'Collision', 'Collision = tên chuẩn của Unity / Unreal / Godot'],
    in: {
      a: ['Đối tượng A', 'Object A', 'Thay "Vật chính"; A là vật được nới/thu vùng chạm (xem tooltip)'],
      b: ['Đối tượng B', 'Object B', 'Thay "Vật kia"'],
    },
    out: {
      began: ['Bắt đầu chạm', 'Enter', 'pulse (Enter)'],
      ended: ['Kết thúc chạm', 'Exit', 'pulse (Exit)'],
    },
  },
  'ui-button': {
    out: {
      pressed: ['Khi bấm', 'On click', 'pulse'],
      held: ['Đang giữ nút', 'Held', 'held; cảm ứng cũng dùng được'],
    },
  },
  'ui-dialog': {
    vi: ['Hộp thoại', 'Dialog', 'Dialog box = Hộp thoại (chuẩn IT)'],
    out: {
      a1: ['Khi chọn 1', 'On option 1', 'pulse'],
      a2: ['Khi chọn 2', 'On option 2', 'pulse'],
      a3: ['Khi chọn 3', 'On option 3', 'pulse'],
    },
  },
  'ui-meter': { in: { value: value(), anchor } },
  'ui-pick': {
    vi: ['Bấm vào đối tượng', 'Click Object', 'obj'],
    in: { target: obj('Target') },
    out: { pressed: ['Khi bấm', 'On click', 'pulse'] },
  },
  vehicle: {
    out: {
      self,
      crashed: ['Khi va chạm', 'On crash', 'pulse'],
      crashedWith: ['Đối tượng va phải', 'Crashed with', 'obj'],
    },
  },
  'vision-sensor': {
    out: {
      gained: ['Khi phát hiện', 'On spotted', 'pulse'],
      lost: ['Khi mất dấu', 'On lost', 'pulse'],
      nearest: ['Đối tượng gần nhất', 'Nearest', 'obj'],
    },
  },
  'sight-forecast': {
    in: { patrol: ['Tuyến đi tuần', 'Patrol route', 'Cùng tên với cổng ra của node Đi tuần'] },
    out: {
      window: ['Giây còn lại', 'Time left', 'Cùng tên với Hẹn giờ; bỏ "(giây)"'],
      need: ['Giây cần thiết', 'Time needed', 'Bỏ "(giây)"'],
    },
  },
  zone: {
    in: { follow: ['Bám theo đối tượng', 'Follow', 'obj'] },
    out: {
      inside: ['Đang có đối tượng', 'Occupied', 'held; "Có ai" đổi thành "đối tượng" cho đủ vật & xe'],
      entered: ['Khi đối tượng vào', 'Enter', 'pulse'],
      exited: ['Khi đối tượng ra', 'Exit', 'pulse'],
      count: ['Số đối tượng', 'Count', 'obj'],
      first: ['Đối tượng đầu tiên', 'First', 'obj'],
    },
  },
};
