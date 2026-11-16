import type { PortType, ViewMode } from '../engine/types';

export const MODE_LABELS: Record<ViewMode, string> = {
  '2d-side': '2D nhìn ngang',
  '2d-top': '2D nhìn từ trên',
  '3d': '3D',
};

export const MODE_HINTS: Record<ViewMode, string> = {
  '2d-side': 'Mô phỏng nhìn ngang, như màn chạy nhảy',
  '2d-top': 'Nhìn từ trên xuống, như bản đồ đi đường',
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
  play: 'Chạy',
  edit: 'Sửa',
  save: 'Lưu',
  open: 'Mở',
  openFile: 'Mở file…',
  samples: 'Bài mẫu',
  viewAngle: 'Góc nhìn',
  boardName: 'Tên mô phỏng',
  defaultBoardName: 'Mô phỏng của tôi',
  newGameTitle: 'Tạo mô phỏng mới',
  newGameWarning: 'Mô phỏng đang mở sẽ được thay thế. Hãy bấm Lưu trước nếu muốn giữ lại.',
  cancel: 'Hủy',
  paletteTitle: 'Mảnh ghép',
  paletteHint: 'Bấm hoặc kéo mảnh ghép vào bảng nối dây',
  canvasEmpty: 'Bảng trống. Kéo mảnh ghép từ cột bên trái vào đây, rồi nối cổng ra (phải) sang cổng vào (trái).',
  propsTitle: 'Thuộc tính',
  propsEmpty: 'Chọn một mảnh ghép để chỉnh thuộc tính. Kéo vật thể trong khung mô phỏng để đặt vị trí.',
  deleteNode: 'Xóa mảnh ghép',
  deleteWire: 'Xóa dây',
  wireSelected: 'Dây nối',
  playLocked: 'Đang chạy: bấm "Sửa" để chỉnh.',
  pressKey: 'Bấm một phím…',
  saved: 'Đã lưu file',
  opened: 'Đã mở mô phỏng',
  noSamples: 'Chưa có bài mẫu',
  openFailed: 'Không mở được file',
  playFailed: 'Không chạy được mô phỏng này',
  unavailableNodes: (n: number) => `${n} mảnh ghép không dùng được ở góc nhìn này`,
  splitterTip: 'Kéo để đổi kích thước (bấm đúp để về mặc định)',
  maximize: '⛶ Phóng to',
  maximizeTip: 'Phóng to khung mô phỏng (phím F)',
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
