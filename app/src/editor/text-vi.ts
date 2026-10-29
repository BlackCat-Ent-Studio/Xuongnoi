import type { PortType, ViewMode } from '../engine/types';

export const MODE_LABELS: Record<ViewMode, string> = {
  '2d-side': '2D nhìn ngang',
  '2d-top': '2D nhìn từ trên',
  '3d': '3D',
};

export const MODE_HINTS: Record<ViewMode, string> = {
  '2d-side': 'Kiểu game chạy nhảy như Mario',
  '2d-top': 'Nhìn từ trên xuống, như game đi đường',
  '3d': 'Thế giới 3D, xoay camera được',
};

export const PORT_TYPE_LABELS: Record<PortType, string> = {
  bool: 'Đúng/Sai',
  number: 'Số',
  object: 'Vật thể',
};

export const TEXT_VI = {
  appName: 'Xưởng Nối',
  newGame: 'Tạo mới',
  play: 'Chơi',
  edit: 'Sửa',
  save: 'Lưu',
  open: 'Mở',
  openFile: 'Mở file…',
  samples: 'Game mẫu',
  viewAngle: 'Góc nhìn',
  boardName: 'Tên game',
  defaultBoardName: 'Game của tôi',
  newGameTitle: 'Tạo game mới',
  newGameWarning: 'Game đang mở sẽ được thay thế. Hãy bấm Lưu trước nếu muốn giữ lại.',
  cancel: 'Hủy',
  paletteTitle: 'Khối',
  paletteHint: 'Bấm hoặc kéo khối vào bảng nối dây',
  canvasEmpty: 'Bảng trống. Kéo khối từ cột bên trái vào đây, rồi nối cổng ra (phải) sang cổng vào (trái).',
  propsTitle: 'Thuộc tính',
  propsEmpty: 'Chọn một khối để chỉnh thuộc tính. Kéo vật thể trong khung game để đặt vị trí.',
  deleteNode: 'Xóa khối',
  deleteWire: 'Xóa dây',
  wireSelected: 'Dây nối',
  playLocked: 'Đang chơi: bấm "Sửa" để chỉnh.',
  pressKey: 'Bấm một phím…',
  saved: 'Đã lưu file',
  opened: 'Đã mở game',
  noSamples: 'Chưa có game mẫu',
  openFailed: 'Không mở được file',
  playFailed: 'Không chạy được game này',
  unavailableNodes: (n: number) => `${n} khối không dùng được ở góc nhìn này`,
  splitterTip: 'Kéo để đổi kích thước (bấm đúp để về mặc định)',
  maximize: '⛶ Phóng to',
  maximizeTip: 'Phóng to màn hình game (phím F)',
  restore: '🗗 Thu nhỏ',
  restoreTip: 'Thu nhỏ lại (phím Esc)',
  undo: '↩️ Hoàn tác',
  undoTip: 'Hoàn tác (Ctrl+Z)',
  redo: '↪️ Làm lại',
  redoTip: 'Làm lại (Ctrl+Y)',
  addNote: '📝 Ghi chú',
  addNoteTip: 'Thêm tờ ghi chú lên bảng nối dây',
  noteHolder: 'Gõ ghi chú ở đây…',
  noteDelete: 'Xóa ghi chú',
  noteColor: 'Đổi màu',
  noteResize: 'Kéo để đổi cỡ',
  copied: (n: number) => `Đã sao chép ${n} mục`,
  pasted: (n: number) => `Đã dán ${n} mục`,
  duplicated: (n: number) => `Đã nhân đôi ${n} mục`,
  yes: 'Đúng',
  no: 'Sai',
  none: '—',
} as const;

const SPECIAL_KEYS: Record<string, string> = {
  Space: 'Cách (Space)',
  ArrowLeft: '← Trái',
  ArrowRight: '→ Phải',
  ArrowUp: '↑ Lên',
  ArrowDown: '↓ Xuống',
  Enter: 'Enter',
  ShiftLeft: 'Shift trái',
  ShiftRight: 'Shift phải',
  ControlLeft: 'Ctrl trái',
  ControlRight: 'Ctrl phải',
  Tab: 'Tab',
};

/** Friendly name for a KeyboardEvent.code. */
export function keyLabel(code: string): string {
  const special = SPECIAL_KEYS[code];
  if (special) return special;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Numpad ${code.slice(6)}`;
  return code || '(chưa chọn)';
}

/** Text shown on a wire badge while playing. */
export function formatWireValue(type: PortType, value: boolean | number | string | null, objectName: string): string {
  if (type === 'bool') return value === true ? TEXT_VI.yes : TEXT_VI.no;
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '0.00';
  return typeof value === 'string' ? objectName : TEXT_VI.none;
}
