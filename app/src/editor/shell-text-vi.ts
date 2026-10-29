/** Vietnamese strings for the editor shell: top bar, menus, docks, layout presets, help. */
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
  fileNew: 'Tạo mới…',
  fileOpen: 'Mở file…',
  fileSave: 'Lưu về máy',
  fileSamples: 'Game mẫu',
  fileViewAngle: 'Góc nhìn (cũng chọn khi tạo mới)',

  // Sửa
  editUndo: 'Hoàn tác',
  editRedo: 'Làm lại',
  editAddNote: 'Thêm ghi chú',
  editDuplicate: 'Nhân đôi',
  editDelete: 'Xóa mảnh ghép hoặc dây',

  // Xem
  viewGame: 'Màn chơi',
  viewGraph: 'Bảng nối',
  viewMaximize: 'Phóng to màn chơi',
  viewLayout: 'Bố cục',
  viewLeftDock: 'Hiện dock trái',

  // Trợ giúp
  helpShortcuts: 'Phím tắt',

  // Top bar
  gameNameLabel: 'Tên game',
  playGroupAria: 'Điều khiển chơi thử',
  play: 'Chơi',
  playTip: 'Chơi thử game',
  pause: 'Tạm dừng',
  pauseTip: 'Sắp có: tạm dừng để xem giá trị trên dây',
  step: 'Từng bước',
  stepTip: 'Sắp có: chạy đúng 1 khung hình khi đang tạm dừng',
  stop: 'Dừng',
  stopTip: 'Dừng chơi, quay lại chỉnh sửa',
  stateEditing: 'Đang sửa',
  statePlaying: 'Đang chơi',
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
  tabGame: 'Màn chơi',
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
  liveChip: 'Đang chơi',

  // Splitters
  splitterLeft: 'Kéo để đổi độ rộng dock trái (bấm đúp để về mặc định)',
  splitterRight: 'Kéo để đổi độ rộng dock phải (bấm đúp để về mặc định)',
  splitterBottom: 'Kéo để đổi độ cao dock dưới (bấm đúp để về mặc định)',

  // Help dialog
  helpTitle: 'Phím tắt',
  helpClose: 'Đóng',
  helpRows: [
    ['Ctrl + Z / Ctrl + Y', 'Hoàn tác / Làm lại'],
    ['Ctrl + C / V / D', 'Sao chép / Dán / Nhân đôi mảnh ghép'],
    ['Delete', 'Xóa mảnh ghép hoặc dây đang chọn'],
    ['F', 'Phóng to màn chơi'],
    ['Esc', 'Thu màn chơi về lại'],
    ['Mũi tên, Cách', 'Điều khiển khi đang chơi'],
  ] as ReadonlyArray<readonly [string, string]>,
} as const;
