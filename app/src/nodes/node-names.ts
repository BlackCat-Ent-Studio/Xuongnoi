import type { NodeDef } from '../engine/types';

/**
 * Display names of every node and port: plain Vietnamese plus a small standard English term.
 * Ids (node kinds, port ids, param ids) never change, so saved boards, samples and lessons load the same.
 * Row shape: [vi, en]. Ports are keyed by direction because an id may exist as both an input and an output.
 * The Vietnamese name replaces `label`; the English term fills `labelEn`.
 */
interface PortNames {
  in?: Record<string, [string, string]>;
  out?: Record<string, [string, string]>;
}
interface NodeNames {
  vi: string;
  en: string;
  /** Names the node had before the rename; the palette still finds the node by them. */
  was?: string | string[];
  /** Old English term, kept as a search alias. */
  wasEn?: string;
  ports: PortNames;
}

export const NODE_NAMES: Record<string, NodeNames> = {
  'ahead-sensor': {
    vi: 'Dò phía trước',
    en: 'Raycast',
    was: 'Cảm biến phía trước',
    ports: {
      in: {
        'who': ['Đối tượng', 'Origin'],
      },
      out: {
        'blocked': ['Đang bị chặn', 'Blocked'],
        'distance': ['Khoảng cách', 'Distance'],
        'thing': ['Đối tượng bị chặn', 'Hit object'],
        'hit': ['Khi gặp vật cản', 'On hit'],
      },
    },
  },
  'block': {
    vi: 'Vật thể',
    en: 'Object',
    was: 'Hộp',
    wasEn: 'Block',
    ports: {
      in: {
        'hide': ['Ẩn', 'Hide'],
        'show': ['Hiện', 'Show'],
        'pick': ['Đặt màu', 'Set color'],
        'run': ['Bật băng chuyền', 'Conveyor'],
        'reverse': ['Đảo chiều', 'Reverse'],
        'hiddenWhile': ['Ẩn khi bật', 'Hide while on'],
      },
      out: {
        'self': ['Đối tượng', 'Self'],
        'usedOn': ['Khi bị dùng lên', 'On tool hit'],
        'hidden': ['Đang ẩn', 'Hidden'],
        'damaged': ['Bị hỏng', 'Damaged'],
        'weight': ['Trọng lượng (N)', 'Weight (N)'],
      },
    },
  },
  'and': {
    vi: 'Và',
    en: 'AND',
    ports: {
      in: {
        'a': ['A', 'A'],
        'b': ['B', 'B'],
      },
      out: {
        'out': ['Kết quả', 'Result'],
      },
    },
  },
  'or': {
    vi: 'Hoặc',
    en: 'OR',
    ports: {
      in: {
        'a': ['A', 'A'],
        'b': ['B', 'B'],
      },
      out: {
        'out': ['Kết quả', 'Result'],
      },
    },
  },
  'not': {
    vi: 'Đảo ngược',
    en: 'NOT',
    was: 'Không',
    ports: {
      in: {
        'in': ['Đầu vào', 'Input'],
      },
      out: {
        'out': ['Kết quả', 'Result'],
      },
    },
  },
  'camera': {
    vi: 'Máy quay',
    en: 'Camera',
    ports: {
      in: {
        'on': ['Bật', 'Enable'],
        'target': ['Bám theo đối tượng', 'Follow target'],
        'zoom': ['Thu phóng', 'Zoom'],
        'shake': ['Rung', 'Shake'],
      },
      out: {
        'active': ['Đang dùng', 'Active'],
      },
    },
  },
  'cargo': {
    vi: 'Chở hàng',
    en: 'Cargo',
    was: 'Chất / Dỡ hàng',
    ports: {
      in: {
        'vehicle': ['Xe', 'Vehicle'],
        'load': ['Chất', 'Load'],
        'unload': ['Dỡ', 'Unload'],
        'unloadAll': ['Dỡ hết', 'Unload all'],
      },
      out: {
        'count': ['Số hàng', 'Count'],
        'loaded': ['Khi chất hàng', 'On loaded'],
        'unloaded': ['Khi dỡ hàng', 'On unloaded'],
        'top': ['Hàng trên cùng', 'Top item'],
        'typeCount': ['Số hàng theo loại', 'Count by type'],
      },
    },
  },
  'carry': {
    vi: 'Khiêng đồ',
    en: 'Carry',
    was: 'Cầm / Thả',
    ports: {
      in: {
        'character': ['Nhân vật', 'Character'],
        'grab': ['Nhấc lên', 'Pick up'],
        'drop': ['Thả', 'Drop'],
        'throw': ['Ném', 'Throw'],
      },
      out: {
        'holding': ['Đang khiêng', 'Is carrying'],
        'heldItem': ['Đồ đang khiêng', 'Carried item'],
        'tooHeavy': ['Quá nặng', 'Too heavy'],
      },
    },
  },
  'character': {
    vi: 'Nhân vật',
    en: 'Character',
    ports: {
      in: {
        'moveX': ['Đi ngang', 'Move X'],
        'moveY': ['Đi dọc', 'Move Y'],
        'jump': ['Nhảy', 'Jump'],
      },
      out: {
        'self': ['Đối tượng', 'Self'],
        'onGround': ['Đang trên mặt đất', 'Grounded'],
        'x': ['Vị trí X', 'Position X'],
        'y': ['Vị trí Y', 'Position Y'],
        'z': ['Vị trí Z', 'Position Z'],
      },
    },
  },
  'chase': {
    vi: 'Đuổi / Trốn',
    en: 'Chase / Flee',
    was: 'Đuổi theo / Tránh xa',
    ports: {
      in: {
        'self': ['Bot', 'Agent'],
        'target': ['Mục tiêu', 'Target'],
        'go': ['Bật', 'Enable'],
      },
      out: {
        'moveX': ['Đi ngang', 'Move X'],
        'moveY': ['Đi dọc', 'Move Y'],
        'jump': ['Nhảy', 'Jump'],
        'seeing': ['Đang thấy mục tiêu', 'Sees target'],
      },
    },
  },
  'code-reader': {
    vi: 'Đọc mã',
    en: 'Code Reader',
    ports: {
      in: {
        'thing': ['Vật cần đọc', 'Object to read'],
      },
      out: {
        'code': ['Mã', 'Code'],
        'has': ['Có mã', 'Has code'],
      },
    },
  },
  'color-sensor': {
    vi: 'Đọc màu',
    en: 'Color Check',
    was: 'Cảm biến màu',
    ports: {
      in: {
        'who': ['Đối tượng', 'Object'],
        'thing': ['Vật cần đọc', 'Object to read'],
      },
      out: {
        'index': ['Chỉ số màu', 'Color index'],
        'match': ['Đúng màu', 'Matches'],
      },
    },
  },
  'compare': {
    vi: 'So sánh',
    en: 'Compare',
    ports: {
      in: {
        'a': ['Số A', 'A'],
        'b': ['Số B', 'B'],
      },
      out: {
        'out': ['Kết quả', 'Result'],
      },
    },
  },
  'const': {
    vi: 'Số cố định',
    en: 'Constant',
    was: 'Hằng số',
    ports: {
      out: {
        'value': ['Giá trị', 'Value'],
      },
    },
  },
  'counter': {
    vi: 'Bộ đếm',
    en: 'Counter',
    ports: {
      in: {
        'up': ['Tăng 1', 'Increment'],
        'down': ['Giảm 1', 'Decrement'],
        'reset': ['Đặt lại', 'Reset'],
        'addAmount': ['Lượng cộng thêm', 'Amount'],
        'add': ['Cộng thêm', 'Add'],
        'setAmount': ['Giá trị mới', 'New value'],
        'set': ['Đặt giá trị', 'Set value'],
      },
      out: {
        'value': ['Số đếm', 'Count'],
        'reached': ['Đã đạt mục tiêu', 'Reached'],
      },
    },
  },
  'distance': {
    vi: 'Đo khoảng cách',
    en: 'Distance',
    was: 'Khoảng cách',
    ports: {
      in: {
        'a': ['Đối tượng A', 'Object A'],
        'b': ['Đối tượng B', 'Object B'],
      },
      out: {
        'distance': ['Khoảng cách', 'Distance'],
        'within': ['Trong tầm', 'In range'],
      },
    },
  },
  'enter-exit': {
    vi: 'Lên / Xuống xe',
    en: 'Enter / Exit Vehicle',
    ports: {
      in: {
        'character': ['Nhân vật', 'Character'],
        'enter': ['Lên xe', 'Enter'],
        'exit': ['Xuống xe', 'Exit'],
        'press': ['Bấm (cũ)', 'Press (legacy)'],
      },
      out: {
        'inVehicle': ['Đang trên xe', 'In vehicle'],
        'vehicle': ['Xe đang dùng', 'Current vehicle'],
      },
    },
  },
  'fight': {
    vi: 'Đánh địch',
    en: 'Attack AI',
    was: 'Đánh nhau',
    ports: {
      in: {
        'self': ['Bot', 'Agent'],
        'target': ['Mục tiêu', 'Target'],
        'go': ['Bật', 'Enable'],
      },
      out: {
        'moveX': ['Đi ngang', 'Move X'],
        'moveY': ['Đi dọc', 'Move Y'],
        'jump': ['Nhảy', 'Jump'],
        'attack': ['Ra đòn', 'Attack'],
      },
    },
  },
  'nearest-item': {
    vi: 'Tìm đồ gần nhất',
    en: 'Nearest Item',
    was: 'Tìm vật gần nhất',
    ports: {
      in: {
        'who': ['Đối tượng', 'Origin'],
        'pause': ['Tạm nghỉ', 'Pause'],
        'i1': ['Bỏ qua ô 1', 'Ignore slot 1'],
        'i2': ['Bỏ qua ô 2', 'Ignore slot 2'],
        'i3': ['Bỏ qua ô 3', 'Ignore slot 3'],
        'i4': ['Bỏ qua ô 4', 'Ignore slot 4'],
      },
      out: {
        'item': ['Đồ gần nhất', 'Nearest item'],
        'found': ['Đã tìm thấy', 'Found'],
        'distance': ['Khoảng cách', 'Distance'],
      },
    },
  },
  'next-free-slot': {
    vi: 'Ô trống kế tiếp',
    en: 'Next Free Slot',
    ports: {
      in: {
        's1': ['Ô 1', 'Slot 1'],
        's2': ['Ô 2', 'Slot 2'],
        's3': ['Ô 3', 'Slot 3'],
        's4': ['Ô 4', 'Slot 4'],
      },
      out: {
        'slot': ['Ô trống', 'Free slot'],
        'full': ['Đầy', 'All full'],
      },
    },
  },
  'go-to': {
    vi: 'Di chuyển',
    en: 'Move To',
    was: 'Đi tới',
    ports: {
      in: {
        'self': ['Bot', 'Agent'],
        'target': ['Điểm đến', 'Destination'],
        'go': ['Bật', 'Enable'],
        'target2': ['Điểm đến 2', 'Destination 2'],
        'useTarget2': ['Dùng điểm đến 2', 'Use destination 2'],
      },
      out: {
        'moveX': ['Đi ngang', 'Move X'],
        'moveY': ['Đi dọc', 'Move Y'],
        'jump': ['Nhảy', 'Jump'],
        'arrived': ['Đã đến', 'Arrived'],
        'arrivedPulse': ['Khi đến nơi', 'On arrive'],
        'arrivedAt1': ['Đã đến điểm đến', 'Arrived at destination'],
        'arrivedAt2': ['Đã đến điểm đến 2', 'Arrived at destination 2'],
      },
    },
  },
  'guide-arrow': {
    vi: 'Mũi tên chỉ đường',
    en: 'Waypoint Arrow',
    ports: {
      in: {
        'from': ['Từ đối tượng', 'From'],
        'to': ['Đến đối tượng', 'To'],
        'show': ['Hiện', 'Show'],
      },
      out: {
        'distance': ['Khoảng cách', 'Distance'],
      },
    },
  },
  'hand-tool': {
    vi: 'Cầm dụng cụ',
    en: 'Equip Tool',
    was: 'Cầm tay',
    ports: {
      in: {
        'character': ['Nhân vật', 'Character'],
        'equip': ['Cầm', 'Equip'],
        'unequip': ['Cất', 'Unequip'],
        'toggle': ['Cầm / Cất (cũ)', 'Toggle (legacy)'],
        'use': ['Dùng', 'Use'],
      },
      out: {
        'holding': ['Đang cầm', 'Equipped'],
        'tool': ['Dụng cụ đang cầm', 'Held tool'],
        'used': ['Khi dùng', 'On use'],
        'hit': ['Khi trúng', 'On hit'],
      },
    },
  },
  'health': {
    vi: 'Máu',
    en: 'Health',
    ports: {
      in: {
        'self': ['Nhân vật', 'Character'],
        'heal': ['Hồi máu', 'Heal'],
      },
      out: {
        'hp': ['Máu hiện tại', 'Current HP'],
        'hurtPulse': ['Khi bị thương', 'On damaged'],
        'dead': ['Hết máu', 'Dead'],
      },
    },
  },
  'interact': {
    vi: 'Tương tác',
    en: 'Interact',
    ports: {
      in: {
        'character': ['Nhân vật', 'Character'],
        'press': ['Bấm', 'Press'],
      },
      out: {
        'fired': ['Khi tương tác', 'On interact'],
        'target': ['Đồ được dùng', 'Target'],
      },
    },
  },
  'item': {
    vi: 'Đồ vật',
    en: 'Item',
    ports: {
      in: {
        'hide': ['Ẩn', 'Hide'],
        'show': ['Hiện', 'Show'],
      },
      out: {
        'self': ['Đối tượng', 'Self'],
        'held': ['Đang bị khiêng', 'Is carried'],
        'interacted': ['Khi được tương tác', 'On interact'],
        'inHand': ['Đang cầm tay', 'In hand'],
        'usedOn': ['Khi bị dùng lên', 'On tool hit'],
        'damaged': ['Bị hỏng', 'Damaged'],
        'weight': ['Trọng lượng (N)', 'Weight (N)'],
      },
    },
  },
  'key': {
    vi: 'Phím bấm',
    en: 'Key Input',
    ports: {
      out: {
        'held': ['Đang giữ phím', 'Is held'],
        'pressed': ['Khi nhấn phím', 'On press'],
      },
    },
  },
  'latch': {
    vi: 'Công tắc nhớ',
    en: 'Latch / Toggle',
    ports: {
      in: {
        'set': ['Bật', 'Set'],
        'reset': ['Tắt', 'Reset'],
        'toggle': ['Đảo', 'Toggle'],
      },
      out: {
        'on': ['Đang bật', 'Is on'],
      },
    },
  },
  'line-sensor': {
    vi: 'Cảm biến dò line',
    en: 'Line Sensor',
    ports: {
      in: {
        'who': ['Đối tượng', 'Mounted on'],
        'track': ['Đường line', 'Track'],
      },
      out: {
        'onLine': ['Thấy line', 'On line'],
        'level': ['Độ đậm', 'Level'],
        'entered': ['Khi gặp line', 'On enter'],
        'left': ['Khi rời line', 'On leave'],
      },
    },
  },
  'line-track': {
    vi: 'Đường line',
    en: 'Line Track',
    ports: {
      out: {
        'self': ['Đối tượng', 'Self'],
      },
    },
  },
  'map-range': {
    vi: 'Quy đổi khoảng',
    en: 'Map Range',
    was: 'Đổi thang số',
    ports: {
      in: {
        'value': ['Giá trị vào', 'Input'],
      },
      out: {
        'value': ['Giá trị ra', 'Output'],
      },
    },
  },
  'math': {
    vi: 'Phép tính',
    en: 'Math',
    ports: {
      in: {
        'a': ['Số A', 'A'],
        'b': ['Số B', 'B'],
      },
      out: {
        'out': ['Kết quả', 'Result'],
      },
    },
  },
  'moving-platform': {
    vi: 'Bệ di chuyển',
    en: 'Moving Platform',
    ports: {
      in: {
        'run': ['Bật', 'Enable'],
      },
      out: {
        'self': ['Đối tượng', 'Self'],
        'moving': ['Đang di chuyển', 'Is moving'],
        'arrived': ['Khi tới cuối đường', 'On reach end'],
      },
    },
  },
  'on-start': {
    vi: 'Khi bắt đầu',
    en: 'On Start',
    ports: {
      out: {
        'fired': ['Khi bắt đầu', 'On start'],
        'started': ['Đã bắt đầu', 'Started'],
      },
    },
  },
  'patrol': {
    vi: 'Đi tuần',
    en: 'Patrol',
    ports: {
      in: {
        'self': ['Bot', 'Agent'],
        'on': ['Bật', 'Enable'],
      },
      out: {
        'moveX': ['Đi ngang', 'Move X'],
        'moveY': ['Đi dọc', 'Move Y'],
        'atEnd': ['Khi tới điểm cuối', 'On reach end'],
        'route': ['Tuyến đi tuần', 'Patrol route'],
      },
    },
  },
  'bool-to-number': {
    vi: 'Đổi thành số',
    en: 'Bool to Number',
    was: 'Bật tắt thành số',
    ports: {
      in: {
        'on': ['Bật/tắt', 'On/off'],
      },
      out: {
        'value': ['Giá trị', 'Value'],
      },
    },
  },
  'value-table': {
    vi: 'Bảng giá trị',
    en: 'Lookup Table',
    was: ['Bảng tra', 'Tra bảng'],
    ports: {
      in: {
        'index': ['Số thứ tự', 'Index'],
      },
      out: {
        'value': ['Giá trị', 'Value'],
      },
    },
  },
  'angle-diff': {
    vi: 'Chênh lệch góc',
    en: 'Angle Difference',
    was: 'Hiệu góc',
    ports: {
      in: {
        'a': ['Góc A', 'Angle A'],
        'b': ['Góc B', 'Angle B'],
      },
      out: {
        'diff': ['Chênh lệch', 'Difference'],
      },
    },
  },
  'sample-hold': {
    vi: 'Nhớ số',
    en: 'Sample and Hold',
    was: 'Lưu số',
    ports: {
      in: {
        'value': ['Giá trị', 'Value'],
        'store': ['Lưu', 'Store'],
        'clear': ['Xoá', 'Clear'],
      },
      out: {
        'held': ['Số nhớ', 'Held value'],
        'stored': ['Vừa lưu', 'On store'],
      },
    },
  },
  'dispatcher': {
    vi: 'Bộ điều phối',
    en: 'Dispatcher',
    was: 'Chia việc',
    ports: {
      in: {
        'job': ['Có việc', 'Job waiting'],
      },
      out: {
        'chosen': ['Máy được chọn', 'Chosen machine'],
        'waiting': ['Đang chờ', 'Waiting'],
        'given': ['Đã giao', 'Jobs given'],
      },
    },
  },
  'pid': {
    vi: 'Bộ điều khiển PID',
    en: 'PID Controller',
    ports: {
      in: {
        'measured': ['Giá trị đo', 'Measured value'],
        'target': ['Giá trị đặt', 'Setpoint'],
        'enable': ['Bật', 'Enable'],
        'reset': ['Đặt lại', 'Reset'],
      },
      out: {
        'out': ['Điều khiển', 'Control output'],
        'error': ['Sai lệch', 'Error'],
        'saturated': ['Chạm giới hạn', 'Saturated'],
        'p': ['Phần tỉ lệ (P)', 'P term'],
        'i': ['Phần tích lũy (I)', 'I term'],
        'd': ['Phần dự đoán (D)', 'D term'],
      },
    },
  },
  'signal-plot': {
    vi: 'Đồ thị tín hiệu',
    en: 'Signal Plot / Scope',
    ports: {
      in: {
        'a': ['Tín hiệu 1', 'Signal 1'],
        'b': ['Tín hiệu 2', 'Signal 2'],
        'c': ['Tín hiệu 3', 'Signal 3'],
        'pause': ['Dừng vẽ', 'Pause'],
      },
    },
  },
  'portal': {
    vi: 'Cổng dịch chuyển',
    en: 'Portal',
    ports: {
      in: {
        'partner': ['Cổng đối diện', 'Partner'],
        'on': ['Bật', 'Enable'],
      },
      out: {
        'self': ['Đối tượng', 'Self'],
        'used': ['Khi có người vào', 'On enter'],
        'who': ['Đối tượng vừa vào', 'Last entered'],
      },
    },
  },
  'random': {
    vi: 'Số ngẫu nhiên',
    en: 'Random',
    ports: {
      in: {
        'roll': ['Tung', 'Roll'],
      },
      out: {
        'value': ['Giá trị', 'Value'],
        'rolled': ['Khi tung', 'On roll'],
      },
    },
  },
  'rotating-platform': {
    vi: 'Bệ xoay',
    en: 'Rotating Platform',
    ports: {
      in: {
        'turn': ['Xoay', 'Rotate'],
        'run': ['Bật', 'Enable'],
      },
      out: {
        'self': ['Đối tượng', 'Self'],
        'angle': ['Góc xoay', 'Angle'],
        'turned': ['Khi xoay xong', 'On rotated'],
      },
    },
  },
  'route-follow': {
    vi: 'Chạy theo tuyến',
    en: 'Follow Path',
    ports: {
      in: {
        'self': ['Đối tượng', 'Agent'],
        'on': ['Bật', 'Enable'],
        'stop': ['Dừng', 'Stop'],
        'go': ['Chạy', 'Go'],
        'obj1': ['Điểm 1', 'Waypoint 1'],
        'obj2': ['Điểm 2', 'Waypoint 2'],
        'obj3': ['Điểm 3', 'Waypoint 3'],
        'obj4': ['Điểm 4', 'Waypoint 4'],
        'obj5': ['Điểm 5', 'Waypoint 5'],
        'obj6': ['Điểm 6', 'Waypoint 6'],
        'obj7': ['Điểm 7', 'Waypoint 7'],
        'obj8': ['Điểm 8', 'Waypoint 8'],
      },
      out: {
        'moveX': ['Đi ngang', 'Move X'],
        'moveY': ['Đi dọc', 'Move Y'],
        'jump': ['Nhảy', 'Jump'],
        'blocked': ['Đang bị chặn', 'Blocked'],
        'reached': ['Khi tới điểm', 'On reach point'],
        'index': ['Điểm hiện tại', 'Current point'],
        'atPoint': ['Đang ở điểm', 'At point'],
        'route': ['Tuyến chạy', 'Route'],
        'halted': ['Đang đứng yên', 'Halted'],
      },
    },
  },
  'select-number': {
    vi: 'Chọn theo số',
    en: 'Switch / Select',
    ports: {
      in: {
        'value': ['Giá trị', 'Value'],
      },
      out: {
        'changed': ['Khi đổi', 'On change'],
        'is1': ['Bằng 1', 'Case 1'],
        'is2': ['Bằng 2', 'Case 2'],
        'is3': ['Bằng 3', 'Case 3'],
      },
    },
  },
  'sequence': {
    vi: 'Chuỗi bước',
    en: 'Sequence',
    was: 'Chuỗi việc',
    ports: {
      in: {
        'next': ['Sang bước kế', 'Next'],
        'reset': ['Đặt lại', 'Reset'],
      },
      out: {
        'index': ['Bước hiện tại', 'Current step'],
        'finished': ['Đã hoàn thành', 'Finished'],
        'step1': ['Bước 1', 'Step 1'],
        'step2': ['Bước 2', 'Step 2'],
        'step3': ['Bước 3', 'Step 3'],
      },
    },
  },
  'shooter': {
    vi: 'Bắn đạn',
    en: 'Shoot',
    ports: {
      in: {
        'shooter': ['Người bắn', 'Shooter'],
        'target': ['Mục tiêu', 'Target'],
        'fire': ['Bắn', 'Fire'],
      },
      out: {
        'hit': ['Khi trúng', 'On hit'],
        'lastHit': ['Đối tượng bị trúng', 'Hit object'],
      },
    },
  },
  'show-number': {
    vi: 'Hiện số',
    en: 'Show Number',
    ports: {
      in: {
        'value': ['Giá trị', 'Value'],
      },
    },
  },
  'show-text': {
    vi: 'Hiện chữ',
    en: 'Show Text',
    ports: {
      in: {
        'show': ['Hiện', 'Show'],
        'anchor': ['Gắn vào đối tượng', 'Anchor'],
      },
    },
  },
  'spawner': {
    vi: 'Tạo đối tượng',
    en: 'Spawner',
    was: ['Sinh vật thể', 'Tạo vật mới'],
    ports: {
      in: {
        'spawn': ['Tạo', 'Spawn'],
        'at': ['Tại đối tượng', 'Spawn at'],
        'toucher': ['Chạm thử với', 'Touch test'],
      },
      out: {
        'lastSpawned': ['Đối tượng mới nhất', 'Latest'],
        'count': ['Số đang có', 'Count'],
        'spawned': ['Khi tạo', 'On spawn'],
        'touched': ['Đang chạm thử', 'Touching'],
      },
    },
  },
  'force-sensor': {
    vi: 'Cảm biến lực / Cân',
    en: 'Force Sensor / Scale',
    ports: {
      in: {
        'who': ['Đối tượng', 'Object'],
      },
      out: {
        'force': ['Lực (N)', 'Force (N)'],
        'mass': ['Khối lượng (kg)', 'Mass (kg)'],
        'loaded': ['Có tải', 'Loaded'],
      },
    },
  },
  'joint': {
    vi: 'Khớp xoay (Servo)',
    en: 'Revolute Joint / Servo',
    ports: {
      in: {
        'base': ['Gắn vào', 'Mounted on'],
        'angle': ['Góc đặt', 'Target angle'],
        'power': ['Bật', 'Enable'],
      },
      out: {
        'tip': ['Đầu khớp', 'Joint tip'],
        'angleNow': ['Góc hiện tại', 'Current angle'],
        'load': ['Mô-men đang chịu', 'Torque load'],
        'overloaded': ['Quá tải', 'Overloaded'],
        'reached': ['Đã tới góc', 'At target angle'],
      },
    },
  },
  'link': {
    vi: 'Thanh nối',
    en: 'Link / Arm Segment',
    ports: {
      in: {
        'base': ['Gắn vào', 'Mounted on'],
      },
      out: {
        'tip': ['Đầu thanh', 'Link tip'],
      },
    },
  },
  'gripper': {
    vi: 'Tay kẹp',
    en: 'Gripper',
    ports: {
      in: {
        'base': ['Gắn vào', 'Mounted on'],
        'close': ['Kẹp', 'Close'],
        'force': ['Lực kẹp', 'Grip force'],
      },
      out: {
        'holding': ['Đang giữ', 'Holding'],
        'held': ['Vật đang giữ', 'Held object'],
        'gripForce': ['Lực đang kẹp', 'Grip force'],
        'slipped': ['Khi vật tuột', 'On slip'],
        'crushedOut': ['Khi làm hỏng vật', 'On crush'],
        'inReach': ['Có vật trong tầm', 'Object in reach'],
        'candidate': ['Vật trong tầm', 'Reachable object'],
        'fingerStalled': ['Ngón bị chặn', 'Finger blocked'],
        'fingerForce': ['Lực ngón đang ép', 'Finger press force'],
      },
    },
  },
  'linear-actuator': {
    vi: 'Xi lanh đẩy',
    en: 'Linear Actuator / Piston',
    ports: {
      in: {
        'base': ['Gắn vào', 'Mounted on'],
        'extend': ['Đẩy ra', 'Extend'],
        'position': ['Vị trí đặt', 'Target position'],
      },
      out: {
        'tip': ['Đầu đẩy', 'Rod tip'],
        'positionNow': ['Vị trí', 'Position'],
        'extended': ['Đã ra hết', 'Fully extended'],
        'retracted': ['Đã thu về', 'Fully retracted'],
        'force': ['Lực đang đẩy', 'Pushing force'],
        'overloaded': ['Quá tải', 'Overloaded'],
      },
    },
  },
  'speed-sensor': {
    vi: 'Đo tốc độ',
    en: 'Speed',
    was: 'Cảm biến tốc độ',
    ports: {
      in: {
        'who': ['Đối tượng', 'Object'],
      },
      out: {
        'speed': ['Tốc độ', 'Speed'],
        'still': ['Đang đứng yên', 'Is still'],
        'fast': ['Vượt ngưỡng', 'Above threshold'],
      },
    },
  },
  'stick': {
    vi: 'Cần điều khiển',
    en: 'Joystick / Axis',
    ports: {
      out: {
        'x': ['Trục ngang', 'Horizontal'],
        'y': ['Trục dọc', 'Vertical'],
      },
    },
  },
  'teleport': {
    vi: 'Dịch chuyển',
    en: 'Teleport',
    ports: {
      in: {
        'who': ['Đối tượng', 'Target'],
        'go': ['Dịch chuyển', 'Teleport'],
        'dest': ['Điểm đến', 'Destination'],
      },
      out: {
        'done': ['Khi dịch chuyển', 'On teleport'],
      },
    },
  },
  'timer': {
    vi: 'Hẹn giờ',
    en: 'Timer',
    ports: {
      in: {
        'run': ['Bắt đầu', 'Start'],
        'reset': ['Đặt lại', 'Reset'],
      },
      out: {
        'left': ['Giây còn lại', 'Time left'],
        'done': ['Hết giờ', 'Finished'],
      },
    },
  },
  'touch': {
    vi: 'Va chạm',
    en: 'Collision',
    was: ['Cảm biến chạm', 'Chạm nhau'],
    wasEn: 'Collision / Touch',
    ports: {
      in: {
        'a': ['Đối tượng A', 'Object A'],
        'b': ['Đối tượng B', 'Object B'],
      },
      out: {
        'touching': ['Đang chạm', 'Stay'],
        'began': ['Bắt đầu chạm', 'Enter'],
        'ended': ['Kết thúc chạm', 'Exit'],
      },
    },
  },
  'ui-button': {
    vi: 'Nút bấm',
    en: 'UI Button',
    was: 'Nút trên màn hình',
    ports: {
      in: {
        'show': ['Hiện', 'Show'],
      },
      out: {
        'pressed': ['Khi bấm', 'On click'],
        'held': ['Đang giữ nút', 'Held'],
      },
    },
  },
  'ui-dialog': {
    vi: 'Hộp thoại',
    en: 'Dialog',
    was: 'Hộp hỏi',
    wasEn: 'Dialog / Choice',
    ports: {
      in: {
        'ask': ['Hỏi', 'Ask'],
      },
      out: {
        'a1': ['Khi chọn 1', 'On option 1'],
        'a2': ['Khi chọn 2', 'On option 2'],
        'a3': ['Khi chọn 3', 'On option 3'],
        'asking': ['Đang hỏi', 'Is asking'],
      },
    },
  },
  'ui-meter': {
    vi: 'Thanh đo',
    en: 'Progress Bar',
    ports: {
      in: {
        'value': ['Giá trị', 'Value'],
        'anchor': ['Gắn vào đối tượng', 'Anchor'],
        'show': ['Hiện', 'Show'],
      },
    },
  },
  'ui-pick': {
    vi: 'Bấm vào đối tượng',
    en: 'Click Object',
    was: 'Bấm vào vật',
    ports: {
      in: {
        'target': ['Đối tượng', 'Target'],
      },
      out: {
        'pressed': ['Khi bấm', 'On click'],
      },
    },
  },
  'ui-start': {
    vi: 'Màn hình mở đầu',
    en: 'Title Screen',
    was: 'Màn hình bắt đầu',
    ports: {
      out: {
        'started': ['Đã bắt đầu', 'Started'],
      },
    },
  },
  'vehicle': {
    vi: 'Xe',
    en: 'Vehicle',
    was: 'Phương tiện',
    ports: {
      in: {
        'moveX': ['Đi ngang', 'Move X'],
        'moveY': ['Đi dọc', 'Move Y'],
        'stop': ['Phanh', 'Brake'],
        'leader': ['Theo xe đầu', 'Follow leader'],
      },
      out: {
        'self': ['Đối tượng', 'Self'],
        'hasDriver': ['Có người lái', 'Has driver'],
        'speed': ['Tốc độ', 'Speed'],
        'driver': ['Người lái', 'Driver'],
        'crashed': ['Khi va chạm', 'On crash'],
        'crashedWith': ['Đối tượng va phải', 'Crashed with'],
      },
    },
  },
  'vision-sensor': {
    vi: 'Tầm nhìn',
    en: 'Line of Sight',
    was: 'Cảm biến tầm nhìn',
    ports: {
      in: {
        'viewer': ['Người nhìn', 'Viewer'],
        'target': ['Mục tiêu', 'Target'],
      },
      out: {
        'seen': ['Đang thấy', 'Can see'],
        'gained': ['Khi phát hiện', 'On spotted'],
        'lost': ['Khi mất dấu', 'On lost'],
        'nearest': ['Đối tượng gần nhất', 'Nearest'],
        'distance': ['Khoảng cách', 'Distance'],
      },
    },
  },
  'robot-body': {
    vi: 'Thân robot',
    en: 'Robot Chassis',
    ports: {
      in: {
        'resetDistance': ['Đặt lại quãng đường', 'Reset distance'],
      },
      out: {
        'self': ['Đối tượng', 'Self'],
        'speed': ['Tốc độ', 'Speed'],
        'heading': ['Hướng', 'Heading'],
        'turnRate': ['Tốc độ quay', 'Turn rate'],
        'distance': ['Quãng đường', 'Distance'],
        'payload': ['Khối lượng đang chở', 'Payload'],
        'overloaded': ['Quá tải', 'Overloaded'],
        'pushing': ['Đang đẩy vật', 'Pushing'],
        'pushForce': ['Lực đang đẩy', 'Push force'],
      },
    },
  },
  'motor': {
    vi: 'Động cơ',
    en: 'Motor',
    ports: {
      in: {
        'body': ['Thân', 'Chassis'],
        'power': ['Công suất', 'Power'],
        'resetTurns': ['Đặt lại vòng', 'Reset turns'],
      },
      out: {
        'rpm': ['Vòng quay', 'RPM'],
        'turning': ['Đang quay', 'Spinning'],
        'turns': ['Số vòng đã quay', 'Turns'],
      },
    },
  },
  'sight-forecast': {
    vi: 'Dự đoán tầm nhìn',
    en: 'Sight Forecast',
    ports: {
      in: {
        'viewer': ['Người nhìn', 'Viewer'],
        'target': ['Mục tiêu', 'Target'],
        'patrol': ['Tuyến đi tuần', 'Patrol route'],
        'route': ['Tuyến của Mục tiêu', 'Target route'],
      },
      out: {
        'window': ['Giây còn lại', 'Time left'],
        'safe': ['An toàn', 'Safe'],
        'need': ['Giây cần thiết', 'Time needed'],
      },
    },
  },
  'win-lose': {
    vi: 'Thắng / Thua',
    en: 'Game Over',
    was: 'Thắng/Thua',
    ports: {
      in: {
        'win': ['Thắng', 'Win'],
        'lose': ['Thua', 'Lose'],
      },
    },
  },
  'zone': {
    vi: 'Vùng kích hoạt',
    en: 'Trigger Zone',
    was: 'Cảm biến vùng',
    ports: {
      in: {
        'follow': ['Bám theo đối tượng', 'Follow'],
      },
      out: {
        'inside': ['Đang có đối tượng', 'Occupied'],
        'entered': ['Khi đối tượng vào', 'Enter'],
        'exited': ['Khi đối tượng ra', 'Exit'],
        'count': ['Số đối tượng', 'Count'],
        'first': ['Đối tượng đầu tiên', 'First'],
      },
    },
  },
  'robot-goto': {
    vi: 'Đi tới điểm',
    en: 'Go To Point',
    ports: {
      in: {
        'robot': ['Robot', 'Robot'],
        'target': ['Đích', 'Target'],
        'go': ['Chạy', 'Run'],
        'x': ['Đích X', 'Target X'],
        'z': ['Đích Z', 'Target Z'],
        'face': ['Hướng khi tới', 'Final heading'],
      },
      out: {
        'left': ['Trái', 'Left power'],
        'right': ['Phải', 'Right power'],
        'arrived': ['Đã tới', 'Arrived'],
        'arrivedPulse': ['Khi tới nơi', 'On arrive'],
        'distance': ['Còn cách', 'Distance left'],
        'headingError': ['Lệch hướng', 'Heading error'],
      },
    },
  },
  'floor-marker': {
    vi: 'Mốc sàn',
    en: 'Floor Marker',
    ports: {
      out: {
        'self': ['Đối tượng', 'Self'],
        'x': ['X', 'X'],
        'z': ['Z', 'Z'],
        'number': ['Số mốc', 'Marker number'],
      },
    },
  },
  'floor-marker-sensor': {
    vi: 'Đọc mốc sàn',
    en: 'Marker Reader',
    ports: {
      in: {
        'who': ['Đối tượng', 'Origin'],
      },
      out: {
        'number': ['Số mốc', 'Marker number'],
        'on': ['Đang trên mốc', 'On marker'],
        'entered': ['Khi vào mốc', 'On enter'],
        'marker': ['Mốc', 'Marker'],
      },
    },
  },
  'floor-marker-find': {
    vi: 'Tìm mốc sàn',
    en: 'Find Marker',
    ports: {
      in: {
        'number': ['Số mốc', 'Marker number'],
      },
      out: {
        'marker': ['Mốc', 'Marker'],
        'x': ['X', 'X'],
        'z': ['Z', 'Z'],
        'found': ['Có mốc', 'Found'],
      },
    },
  },
  'raised-deck': {
    vi: 'Sàn nâng có lỗ',
    en: 'Raised Deck',
    ports: {
      out: {
        'self': ['Đối tượng', 'Self'],
      },
    },
  },
};

/** Extra words the palette and handbook search match: the English term and the name the node had before. */
export function nodeSearchAliases(kind: string): string[] {
  const n = NODE_NAMES[kind];
  return n ? [n.en, ...(n.was ? [n.was].flat() : []), ...(n.wasEn ? [n.wasEn] : [])] : [];
}

/** Extra choice / step / step-done ports (4-12; "done" from 1) that the review table does not list; they follow the same pattern as 1-3. */
function extraNames(kind: string, id: string): [string, string] | null {
  const m = /^(is|step|done)([1-9]|1[0-2])$/.exec(id);
  if (!m) return null;
  if (kind === 'select-number' && m[1] === 'is') return [`Bằng ${m[2]}`, `Case ${m[2]}`];
  if (kind === 'sequence' && m[1] === 'step') return [`Bước ${m[2]}`, `Step ${m[2]}`];
  if (kind === 'sequence' && m[1] === 'done') return [`Xong bước ${m[2]}`, `Step ${m[2]} done`];
  return null;
}

/** Puts the approved names onto a node definition in place (safe to run twice). */
export function applyNodeNames<T extends NodeDef<any>>(def: T): T { // eslint-disable-line @typescript-eslint/no-explicit-any
  const names = NODE_NAMES[def.kind];
  if (!names) return def;
  def.label = names.vi;
  def.labelEn = names.en;
  for (const dir of ['in', 'out'] as const) {
    const table = names.ports[dir] ?? {};
    for (const p of dir === 'in' ? [...def.inputs, ...(def.optionalInputs?.all ?? [])] : [...def.outputs, ...(def.optionalOutputs?.all ?? [])]) {
      const row = table[p.id] ?? extraNames(def.kind, p.id);
      if (!row) continue;
      p.label = row[0];
      p.labelEn = row[1];
    }
  }
  return def;
}
