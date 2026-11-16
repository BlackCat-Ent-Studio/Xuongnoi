/** Vietnamese strings for the editor shell: top bar, menus, docks, layout presets, help. */
import type { ViewKind, Mode2d } from './view-switch';
import type { LayoutPreset } from './layout-model';

export const PRESET_LABELS: Record<LayoutPreset, string> = {
  default: 'Mặc định',
  split: 'Chia đôi',
  wide: 'Rộng bảng',
};

export const SHELL_TEXT = {
  menuAria: 'Menu chính',
  menuFile: 'Tệp',
  menuEdit: 'Sửa',
  menuView: 'Xem',
  menuHelp: 'Trợ giúp',

  // Tệp
  fileNew: 'Tạo mô phỏng mới',
  fileSamples: 'Bài mẫu',
  fileLibrary: 'Kho mô phỏng của tôi…',
  fileOpen: 'Mở file…',
  fileSave: 'Lưu',
  fileExport: 'Xuất ra file',
  fileGameSettings: 'Cài đặt mô phỏng',
  savedLocal: 'Đã lưu trong trình duyệt',

  // Sửa
  editUndo: 'Hoàn tác',
  editRedo: 'Làm lại',
  editAddNote: 'Thêm ghi chú',
  editDuplicate: 'Nhân đôi',
  editDelete: 'Xóa',
  editArrange: 'Sắp xếp gọn',
  editFit: 'Vừa màn hình',

  // Xem
  viewGame: 'Mô phỏng',
  viewGraph: 'Bảng nối',
  viewMaximize: 'Phóng to mô phỏng',
  viewLayout: 'Bố cục',
  viewLeftDock: 'Hiện dock trái',
  viewWireEnergy: 'Hiệu ứng dòng điện',

  // Trợ giúp
  helpLessons: 'Bài học',
  helpShortcuts: 'Phím tắt',
  helpHandbook: 'Sổ tay mảnh ghép',

  // View-mode segmented control
  modeGroupAria: 'Góc nhìn của mô phỏng',
  modeLockedTip: 'Bấm Dừng để đổi góc nhìn',
  modeKind: { '2d': '2D', '3d': '3D' } as Record<ViewKind, string>,
  /** The small switch beside the 2D button: which 2D view the button opens. */
  sub2dAria: 'Kiểu nhìn của 2D',
  sub2dFull: { '2d-side': 'Nhìn ngang', '2d-top': 'Nhìn từ trên' } as Record<Mode2d, string>,
  sub2dShort: { '2d-side': '↔', '2d-top': '↓' } as Record<Mode2d, string>,

  // Top bar
  gameNameLabel: 'Tên mô phỏng',
  playGroupAria: 'Điều khiển chạy thử',
  play: 'Chạy',
  playTip: 'Chạy thử mô phỏng',
  pause: 'Tạm dừng',
  pauseTip: 'Sắp có: tạm dừng để xem giá trị trên dây',
  step: '🐢 Từng bước',
  stepNext: '▶ Tiếp',
  stop: 'Dừng',
  stopTip: 'Dừng chạy, quay lại chỉnh sửa',
  stateEditing: 'Đang sửa',
  statePlaying: 'Đang chạy',
  layoutLabel: 'Bố cục',
  layoutPrefix: 'Bố cục: ',
  saveStatusSaved: 'Đã lưu tự động',
  saveStatusLesson: 'Bài học (không lưu)',
  helpButton: 'Phím tắt và hướng dẫn',
  undo: 'Hoàn tác (Ctrl+Z)',
  redo: 'Làm lại (Ctrl+Y)',

  // Docks
  tabScene: 'Cảnh',
  tabPalette: 'Mảnh ghép',
  tabGame: 'Mô phỏng',
  tabGraph: 'Bảng nối',
  tabProps: 'Thuộc tính',
  tabConsole: 'Bảng tin',
  tabLessons: 'Bài học',
  dockLeftAria: 'Dock trái',
  dockCenterAria: 'Khu giữa',
  dockRightAria: 'Dock phải',
  dockBottomAria: 'Dock dưới',
  scenePlaceholder: 'Danh sách vật trong cảnh sẽ hiện ở đây.',
  consolePlaceholder: 'Bảng tin sẽ hiện ở đây.',
  lessonsPlaceholder: 'Bài học sẽ hiện ở đây.',
  liveChip: 'Đang chạy',

  // Splitters
  splitterLeft: 'Kéo để đổi độ rộng dock trái (bấm đúp để về mặc định)',
  splitterRight: 'Kéo để đổi độ rộng dock phải (bấm đúp để về mặc định)',
  splitterBottom: 'Kéo để đổi độ cao dock dưới (bấm đúp để về mặc định)',

  // Help dialog
  helpTitle: 'Phím tắt',
  helpClose: 'Đóng',
  helpRows: [
    ['Ctrl + S', 'Lưu về máy'],
    ['Ctrl + Z / Ctrl + Y', 'Hoàn tác / Làm lại'],
    ['Ctrl + C / V / D', 'Sao chép / Dán / Nhân đôi mảnh ghép'],
    ['Delete', 'Xóa mảnh ghép hoặc dây đang chọn'],
    ['?', 'Mở bảng phím tắt'],
    ['F', 'Phóng to mô phỏng'],
    ['Esc', 'Thu mô phỏng về lại'],
    ['Mũi tên, Cách', 'Điều khiển khi đang chạy'],
  ] as ReadonlyArray<readonly [string, string]>,
} as const;
