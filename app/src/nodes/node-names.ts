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
  was?: string;
  ports: PortNames;
}

export const NODE_NAMES: Record<string, NodeNames> = {
  'ahead-sensor': {
    vi: 'Dò phía trước',
    en: 'Raycast',
    was: 'Cảm biến phía trước',
    ports: {
      in: {
        'who': ['Vật nhìn', 'Origin'],
      },
      out: {
        'blocked': ['Bị chặn', 'Hit'],
        'distance': ['Khoảng cách', 'Distance'],
        'thing': ['Vật bị chặn', 'Hit object'],
        'hit': ['Vừa gặp cản', 'Just hit'],
      },
    },
  },
  'block': {
    vi: 'Hộp',
    en: 'Block',
    ports: {
      in: {
        'hide': ['Ẩn đi (1 nhịp)', 'Hide'],
        'show': ['Hiện lại (1 nhịp)', 'Show'],
        'pick': ['Đổi màu 1-2-3', 'Set color'],
        'run': ['Chạy băng chuyền', 'Conveyor on'],
        'reverse': ['Đảo chiều', 'Reverse'],
        'hiddenWhile': ['Ẩn suốt lúc bật', 'Hide while ON'],
      },
      out: {
        'self': ['Hộp', 'Self'],
        'usedOn': ['Bị dùng lên', 'Used on'],
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
        'in': ['Vào', 'Input'],
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
        'target': ['Bám theo vật', 'Follow'],
        'zoom': ['Phóng to (0 = mặc định)', 'Zoom'],
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
        'loaded': ['Vừa chất', 'Loaded'],
        'unloaded': ['Vừa dỡ', 'Unloaded'],
        'top': ['Hàng trên cùng', 'Top item'],
        'typeCount': ['Số hàng loại này', 'Count of type'],
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
        'heldItem': ['Món đang khiêng', 'Carried item'],
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
        'self': ['Nhân vật', 'Self'],
        'onGround': ['Đang đứng đất', 'On ground'],
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
      },
      out: {
        'moveX': ['Đi ngang', 'Move X'],
        'moveY': ['Đi dọc', 'Move Y'],
        'jump': ['Nhảy', 'Jump'],
        'seeing': ['Đang thấy mục tiêu', 'Sees target'],
      },
    },
  },
  'color-sensor': {
    vi: 'Đọc màu',
    en: 'Color Check',
    was: 'Cảm biến màu',
    ports: {
      in: {
        'who': ['Vật', 'Object'],
      },
      out: {
        'index': ['Số màu', 'Color #'],
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
        'out': ['Đúng', 'True'],
      },
    },
  },
  'const': {
    vi: 'Số cố định',
    en: 'Constant',
    was: 'Hằng số',
    ports: {
      out: {
        'value': ['Số', 'Value'],
      },
    },
  },
  'counter': {
    vi: 'Bộ đếm',
    en: 'Counter',
    ports: {
      in: {
        'up': ['Cộng 1', 'Increment'],
        'down': ['Trừ 1', 'Decrement'],
        'reset': ['Về đầu', 'Reset'],
        'addAmount': ['Số cộng thêm', 'Amount'],
        'add': ['Cộng số', 'Add'],
        'setAmount': ['Số đặt', 'New value'],
        'set': ['Đặt số', 'Set'],
      },
      out: {
        'value': ['Số đếm', 'Count'],
        'reached': ['Đã đủ', 'Reached'],
      },
    },
  },
  'distance': {
    vi: 'Đo khoảng cách',
    en: 'Distance',
    was: 'Khoảng cách',
    ports: {
      in: {
        'a': ['Vật 1', 'Object A'],
        'b': ['Vật 2', 'Object B'],
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
        'character': ['Ai', 'Who'],
        'press': ['Bấm', 'Press'],
      },
      out: {
        'inVehicle': ['Đang ngồi trên xe', 'In vehicle'],
        'vehicle': ['Xe đang ngồi', 'Vehicle'],
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
      },
      out: {
        'moveX': ['Đi ngang', 'Move X'],
        'moveY': ['Đi dọc', 'Move Y'],
        'jump': ['Nhảy', 'Jump'],
        'attack': ['Ra đòn', 'Attack'],
      },
    },
  },
  'go-to': {
    vi: 'Đi tới',
    en: 'Move To',
    ports: {
      in: {
        'self': ['Bot', 'Agent'],
        'target': ['Đích (vật)', 'Destination'],
        'go': ['Cho đi', 'Go'],
      },
      out: {
        'moveX': ['Đi ngang', 'Move X'],
        'moveY': ['Đi dọc', 'Move Y'],
        'jump': ['Nhảy', 'Jump'],
        'arrived': ['Đã tới', 'Arrived'],
        'arrivedPulse': ['Vừa tới', 'Just arrived'],
      },
    },
  },
  'guide-arrow': {
    vi: 'Mũi tên chỉ đường',
    en: 'Waypoint Arrow',
    ports: {
      in: {
        'from': ['Từ', 'From'],
        'to': ['Tới', 'To'],
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
        'toggle': ['Cầm / Cất', 'Equip'],
        'use': ['Dùng', 'Use'],
      },
      out: {
        'holding': ['Đang cầm tay', 'Equipped'],
        'tool': ['Món trên tay', 'Tool'],
        'used': ['Vừa dùng', 'Used'],
        'hit': ['Trúng', 'Hit'],
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
        'hp': ['Máu còn', 'HP'],
        'hurtPulse': ['Vừa bị đánh', 'Damaged'],
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
        'fired': ['Vừa tương tác', 'Interacted'],
        'target': ['Món được dùng', 'Target'],
      },
    },
  },
  'item': {
    vi: 'Đồ vật',
    en: 'Item',
    ports: {
      in: {
        'hide': ['Ẩn đi (1 nhịp)', 'Hide'],
        'show': ['Hiện lại (1 nhịp)', 'Show'],
      },
      out: {
        'self': ['Đồ vật', 'Self'],
        'held': ['Đang bị khiêng', 'Is carried'],
        'interacted': ['Vừa được dùng', 'Interacted'],
        'inHand': ['Đang cầm tay', 'In hand'],
        'usedOn': ['Bị dùng lên', 'Used on'],
      },
    },
  },
  'key': {
    vi: 'Phím bấm',
    en: 'Key Input',
    ports: {
      out: {
        'held': ['Đang giữ phím', 'Is held'],
        'pressed': ['Vừa nhấn', 'Just pressed'],
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
  'map-range': {
    vi: 'Đổi thang số',
    en: 'Map Range',
    ports: {
      in: {
        'value': ['Số vào', 'Input'],
      },
      out: {
        'value': ['Số ra', 'Output'],
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
        'run': ['Chạy', 'Run'],
      },
      out: {
        'self': ['Bệ', 'Self'],
        'moving': ['Đang chạy', 'Is moving'],
        'arrived': ['Vừa tới cuối đường', 'Reached end'],
      },
    },
  },
  'on-start': {
    vi: 'Khi bắt đầu',
    en: 'On Start',
    ports: {
      out: {
        'fired': ['Vừa bắt đầu', 'Fired'],
      },
    },
  },
  'patrol': {
    vi: 'Đi tuần',
    en: 'Patrol',
    ports: {
      in: {
        'self': ['Bot', 'Agent'],
        'on': ['Hoạt động', 'Active'],
      },
      out: {
        'moveX': ['Đi ngang', 'Move X'],
        'moveY': ['Đi dọc', 'Move Y'],
        'atEnd': ['Vừa tới đầu mút', 'At end'],
      },
    },
  },
  'portal': {
    vi: 'Cổng dịch chuyển',
    en: 'Portal',
    ports: {
      in: {
        'partner': ['Cổng đối diện', 'Partner'],
        'on': ['Bật', 'Enabled'],
      },
      out: {
        'self': ['Cổng', 'Self'],
        'used': ['Vừa có người vào', 'Entered'],
        'who': ['Người vừa vào', 'Who'],
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
        'value': ['Số', 'Value'],
        'rolled': ['Vừa tung', 'Rolled'],
      },
    },
  },
  'rotating-platform': {
    vi: 'Bệ xoay',
    en: 'Rotating Platform',
    ports: {
      in: {
        'turn': ['Xoay', 'Rotate'],
        'run': ['Chạy', 'Run'],
      },
      out: {
        'self': ['Hộp xoay', 'Self'],
        'angle': ['Góc (độ)', 'Angle'],
        'turned': ['Vừa xoay xong', 'Rotated'],
      },
    },
  },
  'route-follow': {
    vi: 'Chạy theo tuyến',
    en: 'Follow Path',
    ports: {
      in: {
        'self': ['Ai', 'Agent'],
        'on': ['Bật', 'Enable'],
        'stop': ['Dừng', 'Stop'],
      },
      out: {
        'moveX': ['Đi ngang', 'Move X'],
        'moveY': ['Đi dọc', 'Move Y'],
        'jump': ['Nhảy', 'Jump'],
        'blocked': ['Đang bị chặn', 'Blocked'],
        'reached': ['Tới điểm', 'Reached point'],
        'index': ['Điểm hiện tại', 'Current point'],
      },
    },
  },
  'select-number': {
    vi: 'Chọn theo số',
    en: 'Switch / Select',
    ports: {
      in: {
        'value': ['Số', 'Value'],
      },
      out: {
        'changed': ['Vừa đổi', 'Changed'],
        'is1': ['Bằng 1', 'Case 1'],
        'is2': ['Bằng 2', 'Case 2'],
        'is3': ['Bằng 3', 'Case 3'],
      },
    },
  },
  'sequence': {
    vi: 'Chuỗi việc',
    en: 'Sequence',
    ports: {
      in: {
        'next': ['Xong việc', 'Step done'],
        'reset': ['Làm lại từ đầu', 'Restart'],
      },
      out: {
        'index': ['Đang làm việc số', 'Current step'],
        'finished': ['Đã xong hết', 'All done'],
        'step1': ['Việc 1', 'Step 1'],
        'step2': ['Việc 2', 'Step 2'],
        'step3': ['Việc 3', 'Step 3'],
      },
    },
  },
  'shooter': {
    vi: 'Bắn đạn',
    en: 'Shoot',
    ports: {
      in: {
        'shooter': ['Người bắn', 'Shooter'],
        'target': ['Ngắm vào (tuỳ chọn)', 'Aim at'],
        'fire': ['Bắn', 'Fire'],
      },
      out: {
        'hit': ['Trúng', 'Hit'],
        'lastHit': ['Vật vừa trúng', 'Hit object'],
      },
    },
  },
  'show-number': {
    vi: 'Hiện số',
    en: 'Show Number',
    ports: {
      in: {
        'value': ['Số cần hiện', 'Number'],
      },
    },
  },
  'show-text': {
    vi: 'Hiện chữ',
    en: 'Show Text',
    ports: {
      in: {
        'show': ['Hiện', 'Show'],
        'anchor': ['Gắn vào vật', 'Attach to'],
      },
    },
  },
  'spawner': {
    vi: 'Tạo vật mới',
    en: 'Spawner',
    was: 'Sinh vật thể',
    ports: {
      in: {
        'spawn': ['Tạo ra', 'Spawn'],
        'at': ['Tại vật', 'At'],
        'toucher': ['Vật thử chạm', 'Touch with'],
      },
      out: {
        'lastSpawned': ['Vật mới nhất', 'Latest'],
        'count': ['Đang có', 'Count'],
        'spawned': ['Vừa tạo', 'Spawned'],
        'touched': ['Đang chạm vật thử', 'Touching'],
      },
    },
  },
  'speed-sensor': {
    vi: 'Đo tốc độ',
    en: 'Speed',
    was: 'Cảm biến tốc độ',
    ports: {
      in: {
        'who': ['Vật', 'Object'],
      },
      out: {
        'speed': ['Tốc độ', 'Speed'],
        'still': ['Đứng yên', 'Is still'],
        'fast': ['Nhanh quá mức', 'Above limit'],
      },
    },
  },
  'stick': {
    vi: 'Cần điều khiển',
    en: 'Joystick / Axis',
    ports: {
      out: {
        'x': ['Ngang (trái-phải)', 'Horizontal'],
        'y': ['Dọc (xuống-lên)', 'Vertical'],
      },
    },
  },
  'teleport': {
    vi: 'Dịch chuyển',
    en: 'Teleport',
    ports: {
      in: {
        'who': ['Ai (vật)', 'Who'],
        'go': ['Đi', 'Go'],
        'dest': ['Nơi đến (vật)', 'Destination'],
      },
      out: {
        'done': ['Vừa dịch chuyển', 'Done'],
      },
    },
  },
  'timer': {
    vi: 'Hẹn giờ',
    en: 'Timer',
    ports: {
      in: {
        'run': ['Chạy', 'Start'],
        'reset': ['Đếm lại', 'Restart'],
      },
      out: {
        'left': ['Giây còn lại', 'Time left'],
        'done': ['Hết giờ', 'Finished'],
      },
    },
  },
  'touch': {
    vi: 'Chạm nhau',
    en: 'Collision / Touch',
    was: 'Cảm biến chạm',
    ports: {
      in: {
        'a': ['Vật chính', 'Self'],
        'b': ['Vật kia', 'Other'],
      },
      out: {
        'touching': ['Đang chạm', 'Stay'],
        'began': ['Mới chạm', 'Enter'],
        'ended': ['Vừa rời', 'Exit'],
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
        'pressed': ['Vừa bấm', 'Pressed'],
        'held': ['Đang giữ chuột', 'Held'],
      },
    },
  },
  'ui-dialog': {
    vi: 'Hộp hỏi',
    en: 'Dialog / Choice',
    ports: {
      in: {
        'ask': ['Hỏi', 'Ask'],
      },
      out: {
        'a1': ['Chọn 1', 'Option 1'],
        'a2': ['Chọn 2', 'Option 2'],
        'a3': ['Chọn 3', 'Option 3'],
        'asking': ['Đang hỏi', 'Is asking'],
      },
    },
  },
  'ui-meter': {
    vi: 'Thanh đo',
    en: 'Progress Bar',
    ports: {
      in: {
        'value': ['Số cần đo', 'Value'],
        'anchor': ['Gắn vào vật', 'Attach to'],
        'show': ['Hiện', 'Show'],
      },
    },
  },
  'ui-pick': {
    vi: 'Bấm vào vật',
    en: 'Click Object',
    ports: {
      in: {
        'target': ['Vật cần bấm', 'Object'],
      },
      out: {
        'pressed': ['Vừa bấm', 'Clicked'],
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
        'self': ['Xe', 'Self'],
        'hasDriver': ['Có người lái', 'Has driver'],
        'speed': ['Tốc độ', 'Speed'],
        'driver': ['Người lái', 'Driver'],
        'crashed': ['Vừa va chạm', 'Crashed'],
        'crashedWith': ['Va với', 'Hit by'],
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
        'gained': ['Vừa thấy', 'Spotted'],
        'lost': ['Vừa mất dấu', 'Lost'],
        'nearest': ['Vật gần nhất', 'Nearest'],
        'distance': ['Khoảng cách', 'Distance'],
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
        'follow': ['Gắn vào vật', 'Follow'],
      },
      out: {
        'inside': ['Có ai trong vùng', 'Is inside'],
        'entered': ['Vừa vào', 'On enter'],
        'exited': ['Vừa ra', 'On exit'],
        'count': ['Số lượng', 'Count'],
        'first': ['Vật đầu tiên', 'First object'],
      },
    },
  },
};

/** Extra words the palette and handbook search match: the English term and the name the node had before. */
export function nodeSearchAliases(kind: string): string[] {
  const n = NODE_NAMES[kind];
  return n ? [n.en, ...(n.was ? [n.was] : [])] : [];
}

/** Extra choice / step ports (4-6) that the review table does not list; they follow the same pattern as 1-3. */
function extraNames(kind: string, id: string): [string, string] | null {
  const m = /^(is|step)([4-6])$/.exec(id);
  if (!m) return null;
  if (kind === 'select-number' && m[1] === 'is') return [`Bằng ${m[2]}`, `Case ${m[2]}`];
  if (kind === 'sequence' && m[1] === 'step') return [`Việc ${m[2]}`, `Step ${m[2]}`];
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
    for (const p of dir === 'in' ? def.inputs : def.outputs) {
      const row = table[p.id] ?? extraNames(def.kind, p.id);
      if (!row) continue;
      p.label = row[0];
      p.labelEn = row[1];
    }
  }
  return def;
}
