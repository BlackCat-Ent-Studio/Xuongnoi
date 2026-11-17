import { TRY_BOARDS_LOGIC_EXTRAS as TRY } from './boards-logic-extras';
import type { HandbookEntry } from './types';

export const HANDBOOK_LOGIC_EXTRAS: readonly HandbookEntry[] = [
  {
    kind: 'bool-to-number',
    purpose: 'Đổi tín hiệu bật/tắt thành một con số: bật ra một số, tắt ra một số khác.',
    whenToUse:
      'Khi một công tắc, phím hay cảm biến (bật/tắt) cần điều khiển thứ chỉ nhận số, ví dụ giữ phím thì đi (1), thả phím thì đứng (0), hoặc bật thì tốc độ 5, tắt thì tốc độ 1.',
    ports: {
      on: 'Vào: tín hiệu bật/tắt cần đổi. Không nối dây thì coi như tắt.',
      value: 'Ra (số): "Số khi bật" lúc đang bật, "Số khi tắt" lúc đang tắt.',
    },
    params: {
      whenOn: 'Số ra khi tín hiệu đang bật. Mặc định 1.',
      whenOff: 'Số ra khi tín hiệu đang tắt. Mặc định 0.',
    },
    example: 'Phím Space "Đang giữ phím" → Đổi thành số "Bật/tắt"; "Giá trị" → "Đi ngang" của Nhân vật. Giữ phím thì đi, thả phím thì đứng.',
    tips: [
      'Đặt "Số khi tắt" là -1 để tín hiệu tắt làm nhân vật đi lùi.',
      'Hai số có thể là bất kỳ số nào, không nhất thiết là 0 và 1.',
    ],
    lessonId: 'health-color',
    tryBoard: TRY['bool-to-number'],
  },
  {
    kind: 'value-table',
    purpose: 'Một bảng ghi nhớ nhiều con số. Đưa vào "Số thứ tự", mảnh ghép đọc ra con số ở hàng đó.',
    whenToUse:
      'Khi mỗi bước của một việc cần một con số riêng: cánh tay rô-bốt đọc góc đã dạy cho từng bước của Chuỗi bước, xe chạy với tốc độ khác nhau ở mỗi chặng.',
    ports: {
      index: 'Vào (số): hàng cần đọc, tính từ 1 (làm tròn). Nối "Bước hiện tại" của Chuỗi bước vào đây.',
      value: 'Ra (số): con số ghi ở hàng được chọn.',
    },
    params: {
      rows: 'Số hàng được dùng, từ 2 đến 12. Các ô "Giá trị" sau hàng cuối không được đọc, dù vẫn hiện trong bảng.',
      v1: 'Giá trị ở hàng 1.',
      v2: 'Giá trị ở hàng 2.',
      v3: 'Giá trị ở hàng 3.',
      v4: 'Giá trị ở hàng 4 (dùng khi "Số hàng" từ 4 trở lên).',
      v5: 'Giá trị ở hàng 5 (dùng khi "Số hàng" từ 5 trở lên).',
      v6: 'Giá trị ở hàng 6 (dùng khi "Số hàng" từ 6 trở lên).',
      v7: 'Giá trị ở hàng 7 (dùng khi "Số hàng" từ 7 trở lên).',
      v8: 'Giá trị ở hàng 8 (dùng khi "Số hàng" từ 8 trở lên).',
      v9: 'Giá trị ở hàng 9 (dùng khi "Số hàng" từ 9 trở lên).',
      v10: 'Giá trị ở hàng 10 (dùng khi "Số hàng" từ 10 trở lên).',
      v11: 'Giá trị ở hàng 11 (dùng khi "Số hàng" từ 11 trở lên).',
      v12: 'Giá trị ở hàng 12 (dùng khi "Số hàng" là 12).',
      outside:
        'Khi "Số thứ tự" nhỏ hơn 1 hoặc lớn hơn "Số hàng": "Lấy hàng gần nhất" thì đọc hàng đầu hoặc hàng cuối; "Ra 0" thì ra số 0.',
    },
    example:
      'Chuỗi bước "Bước hiện tại" → Bảng giá trị "Số thứ tự"; "Giá trị" → góc của một Khớp xoay. Mỗi bước, cánh tay xoay tới góc ở hàng tương ứng.',
    tips: [
      'Số thứ tự đầu tiên là 1, giống "Bước hiện tại" của Chuỗi bước.',
      'Khi Chuỗi bước đã hoàn thành nó ra 0: chọn "Lấy hàng gần nhất" để giữ hàng đầu, hoặc "Ra 0" để về 0.',
      'Nối thêm một Bảng giá trị thứ hai cho cùng Số thứ tự nếu mỗi bước cần hai con số (ví dụ hai khớp).',
    ],
    lessonId: 'robot-arm',
    tryBoard: TRY['value-table'],
  },
  {
    kind: 'angle-diff',
    purpose: 'Tính góc A trừ góc B (độ) rồi đưa về khoảng từ -180 đến 180: cho biết nên quay bao nhiêu độ, về phía nào, theo đường ngắn nhất.',
    whenToUse:
      'Khi so hai góc mà góc có thể "quay vòng" (350 độ gần 10 độ hơn là 340 độ): điều khiển hướng quay của rô-bốt, khớp xoay tới góc đặt, kiểm tra hai hướng đã gần nhau chưa.',
    ports: {
      a: 'Vào (số): góc A, đơn vị độ. Không nối dây hay số không hợp lệ thì coi là 0.',
      b: 'Vào (số): góc B, đơn vị độ. Không nối dây hay số không hợp lệ thì coi là 0.',
      diff: 'Ra (số): A trừ B, nằm trong khoảng lớn hơn -180 và nhỏ hơn hoặc bằng 180. Dương nghĩa là A đang ở phía dương so với B.',
    },
    params: {},
    example:
      'Khớp xoay "Góc hiện tại" → Chênh lệch góc "Góc B"; góc muốn tới → "Góc A". Nối "Chênh lệch" vào Bộ điều khiển PID để khớp quay theo đường ngắn nhất.',
    tips: [
      'Hiệu đúng 180 độ luôn ra 180 (không phải -180).',
      'Góc lớn hơn 360 hay âm đều được: 725 trừ 5 ra 0.',
    ],
    lessonId: 'robot-arm',
    tryBoard: TRY['angle-diff'],
  },
];
