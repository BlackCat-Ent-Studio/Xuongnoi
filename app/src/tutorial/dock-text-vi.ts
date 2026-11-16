/** Strings for the lessons dock and the empty-board launchpad. */
export const DOCK_TEXT = {
  listAria: 'Danh sách bài học',
  listDone: 'Đã học',
  idleTitle: 'Chọn một bài học để bắt đầu',
  idleText: 'Bài học chạy trên một bảng riêng, mô phỏng của bạn được giữ nguyên. Bấm một bài ở danh sách bên trái.',
  lessonStep: (lessonTitle: string, n: number, total: number) => `${lessonTitle}, bước ${n} trên ${total}`,
  stepsAria: (n: number, total: number) => `Bước ${n} trên ${total}`,
  show: 'Chỉ cho tôi',
  showTitle: 'Nhấp nháy mảnh ghép hoặc ô cần dùng ở bước này',
  back: 'Quay lại',
  next: 'Bước tiếp',
  skip: 'Bỏ qua bước',
  skipTitle: 'Bỏ qua bước này mà không làm',
  finish: 'Hoàn thành',
  exit: 'Thoát bài',
  exitTitle: 'Thoát bài học và về mô phỏng của bạn',
} as const;

export const LAUNCHPAD_TEXT = {
  title: 'Bảng nối đang trống',
  hint: 'Kéo mảnh ghép từ cột bên trái vào đây, hoặc bắt đầu theo một cách dưới.',
  learn: 'Học từ đầu',
  learnHint: 'Bài 1: cho nhân vật chạy và nhảy.',
  sample: 'Mở bài mẫu',
  sampleHint: 'Mở một máy đã nối sẵn để xem và sửa.',
  library: 'Mô phỏng của tôi',
  libraryHint: 'Mở lại một mô phỏng bạn đã làm trước đó.',
  blank: 'Tự làm',
  blankHint: 'Tự tìm mảnh ghép đầu tiên trong cột bên trái.',
  samplesTitle: 'Chọn một bài mẫu',
  samplesBack: 'Quay lại',
  noSamples: 'Chưa có bài mẫu.',
} as const;
