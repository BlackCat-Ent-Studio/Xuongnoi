import type { GroupFail } from './group-model';

/** Vietnamese strings for "Nhóm mảnh ghép". */
export const GROUP_VI = {
  group: 'Gom nhóm',
  groupTip: 'Gói các mảnh ghép đang chọn thành một khối có tên (Ctrl G)',
  ungroup: 'Bung nhóm',
  ungroupTip: 'Mở khối ra, các mảnh ghép về lại bảng chính (Ctrl Shift G)',
  grouped: (name: string) => `Đã gom thành "${name}"`,
  ungrouped: (n: number) => (n === 1 ? 'Đã bung 1 nhóm' : `Đã bung ${n} nhóm`),
  fail: {
    'too-few': 'Chọn ít nhất 2 mảnh ghép rồi mới gom nhóm được',
    'has-group': 'Đang chọn cả một nhóm. Chưa gom nhóm vào trong nhóm được, hãy bung nhóm trước',
    'in-group': 'Đang ở trong một nhóm. Hãy quay ra bảng chính để gom nhóm',
    locked: 'Đang chạy mô phỏng nên chưa gom được. Bấm Dừng rồi thử lại',
  } satisfies Record<GroupFail | 'in-group' | 'locked', string>,
  inspector: {
    name: 'Tên nhóm',
    color: 'Màu',
    colorDefault: 'Màu mặc định',
    members: 'Mảnh ghép bên trong',
    open: 'Mở nhóm ra và chọn mảnh ghép này',
    ports: 'Cổng nối ra ngoài',
    noPorts: 'Chưa có dây nào nối ra ngoài',
    duplicate: 'Nhân đôi',
    delete: 'Xóa nhóm và mảnh ghép bên trong',
    multiTitle: (n: number) => `Đang chọn ${n} mảnh ghép`,
    multiBody: 'Gom lại thành một khối có tên cho bảng nối gọn hơn. Dây nối ra ngoài vẫn giữ nguyên.',
  },
} as const;
