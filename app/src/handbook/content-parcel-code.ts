import { PARCEL_CODE_MAX, PARCEL_CODE_MIN } from '../engine/parcel-code';
import { tryCodeReader } from './boards-parcel-code';
import type { HandbookEntry } from './types';

export const HANDBOOK_PARCEL_CODE: readonly HandbookEntry[] = [
  {
    kind: 'code-reader',
    purpose: `Đọc mã số (${PARCEL_CODE_MIN} đến ${PARCEL_CODE_MAX}) mà một thùng hàng mang theo và đưa số đó ra dây, để máy biết thùng này phải đi đâu.`,
    whenToUse:
      'Khi mỗi kiện hàng có một số riêng: số tuyến, số cửa, số ô phải tới. Đặt một Vùng kích hoạt ở cổng quét trên băng chuyền, nối thùng đang ở trong vùng sang mảnh này, rồi dùng số đọc được để chọn đường đi.',
    ports: {
      thing: 'Vào (vật): vật cần đọc mã, thường là "Đối tượng đầu tiên" của Vùng kích hoạt đặt ở cổng quét, hoặc "Vật đang giữ" của Tay kẹp. Không nối dây thì không có gì để đọc.',
      code: `Ra (số): mã của vật đang được đọc, từ ${PARCEL_CODE_MIN} đến ${PARCEL_CODE_MAX}. Không có vật, hoặc vật không mang mã, thì ra 0.`,
      has: 'Ra: bật khi vật đang được đọc có mã, tắt khi không có gì để đọc. Nối cổng này để máy chỉ chạy tiếp khi đã đọc được.',
    },
    params: {
      display: 'Chọn "Có" thì có thêm một màn hình nhỏ màu đen trong cảnh. Mỗi lần đọc được một thùng, màn hình lóe sáng rồi hiện mã của thùng đó ở cả bốn mặt và giữ nguyên tới khi thùng sau được đọc. Mặc định "Không": không có gì thêm trong cảnh.',
      displayAt: 'Chỗ đặt màn hình (chỉ khi bật "Màn hình hiện mã"), ví dụ trên đầu cổng quét. Màn hình không chặn đường vật nào.',
    },
    example:
      'Số ngẫu nhiên "Giá trị" → "Mã gắn lên vật" của Tạo đối tượng; Vùng kích hoạt "Đối tượng đầu tiên" → "Vật cần đọc"; "Mã" → "Số thứ tự" của Bảng giá trị để đổi mã thành số cửa phải tới.',
    tips: [
      'Vật mang mã theo hai cách: mảnh Tạo đối tượng bật "Gắn mã cho vật mới" (mục Nâng cao) và nối một số vào "Mã gắn lên vật", hoặc mảnh Đồ vật có "Loại hàng" là một số.',
      'Số chỉ được in lên thùng khi "Kiểu kiện hàng" là "Thùng carton". Kiểu khác vẫn mang mã và vẫn đọc được, chỉ là không nhìn thấy số.',
      'Băng keo trên thùng vẫn là màu của loại hàng, không phải màu của mã. Muốn đọc màu thì dùng mảnh Đọc màu.',
      'Trên thùng, các số dễ đọc ngược như 6 và 9 có gạch chân: gạch nằm phía dưới con số.',
      '"Mã" chỉ có số trong lúc thùng còn ở trong vùng. Cần giữ số lâu hơn thì nối sang mảnh Nhớ số, dùng "Có mã" làm tín hiệu "Lưu".',
    ],
    lessonId: 'conveyor',
    tryBoard: tryCodeReader,
  },
];
