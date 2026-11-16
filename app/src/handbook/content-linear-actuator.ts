import { tryLinearActuator } from './boards-linear-actuator';
import type { HandbookEntry } from './types';

/** Handbook page of the Xi lanh đẩy (linear actuator). */
export const HANDBOOK_LINEAR_ACTUATOR: readonly HandbookEntry[] = [
  {
    kind: 'linear-actuator',
    purpose: 'Xi lanh đẩy: một thanh đẩy ra vào theo đường thẳng. Đầu thanh là khối rắn đẩy mọi thứ nằm trước nó, nhưng chỉ khi đủ lực.',
    whenToUse: 'Đẩy thùng khỏi bệ hay băng chuyền, đẩy cửa, ép, nâng lên một đoạn ngắn, hoặc làm giá đỡ cho cảm biến và tay kẹp chạy tới lui trên một đường thẳng.',
    ports: {
      base: 'Vật mà xi lanh gắn lên: hộp, thân robot, hoặc "Đầu khớp" / "Đầu thanh" của mảnh khác. Không bắt buộc: chưa nối thì xi lanh đứng cố định ở "Vị trí" trong thế giới.',
      extend: 'Bật thì thanh đẩy ra, tắt thì rút về. Chưa nối gì thì xi lanh nằm yên ở trạng thái rút về: mọi việc đều cần một sợi dây.',
      position: 'Vị trí muốn tới, từ 0 (rút hết) đến 1 (ra hết hành trình). Nối ô này thì nó thắng "Đẩy ra". Hợp để đẩy ra nửa chừng: 0,5 là một nửa hành trình.',
      tip: 'Mặt trước của đầu thanh, đi theo thanh khi nó ra vào. Nối vào "Gắn vào" của tay kẹp hay cảm biến để chúng chạy theo xi lanh.',
      positionNow: 'Thanh đang ra khỏi ống bao nhiêu mét (0 tới Hành trình).',
      extended: 'Bật khi thanh đã ra hết hành trình.',
      retracted: 'Bật khi thanh đã rút hết về.',
      force: 'Lực thanh đang đẩy (N): tổng ma sát của mọi vật đang bị đẩy. Khi quá tải hoặc tì vào tường thì bằng "Lực đẩy tối đa". Không đẩy gì thì bằng 0.',
      overloaded: 'Bật khi lực cần để đẩy lớn hơn "Lực đẩy tối đa": thanh đứng yên tại chỗ.',
    },
    params: {
      position: 'Chỗ đặt xi lanh trong thế giới (mét) khi chưa nối "Gắn vào". Đó là gốc của ống, mặc định sát mặt đất.',
      direction: 'Hướng đẩy trên mặt phẳng nằm, tính bằng độ: 0 là sang phải (+x), 90 là hướng về phía người xem (+z), giống hướng của thân robot. Nhìn ngang chỉ có sang phải hoặc sang trái.',
      orient: 'Nằm ngang là đẩy theo hướng đã đặt; Đẩy lên và Đẩy xuống làm thanh thẳng đứng (nhìn từ trên không có).',
      stroke: 'Hành trình (mét): thanh ra tối đa bao xa. Đổi xong cần chạy lại.',
      maxForce: 'Lực đẩy tối đa (N). Nhỏ vài chục N, lớn hàng nghìn N. Mặc định 100.',
      speed: 'Tốc độ thanh ra vào khi không bị cản (mét mỗi giây). Mặc định 1.',
      headSize: 'Cạnh của đầu thanh hình khối vuông (mét). Đầu lớn đẩy được vật rộng. Đổi xong cần chạy lại.',
      mount: 'Dời điểm gắn khỏi tâm của vật gắn (mét, theo chiều dọc / lên / ngang của vật); chỉ dùng khi đã nối "Gắn vào".',
      color: 'Màu ống, thanh và đầu đẩy.',
    },
    example:
      'Vùng kích hoạt "Khi đối tượng vào" → Chốt nhớ "Bật". Chốt nhớ "Đang bật" → Xi lanh "Đẩy ra". Xi lanh "Đã ra hết" → Chốt nhớ "Tắt". Hiện số: "Lực đang đẩy".',
    tips: [
      'Công thức: lực cần để đẩy F ≥ μ × m × 9,81 (μ là hệ số ma sát, m là khối lượng vật bị đẩy, kg). Ví dụ thùng 10 kg, μ 0,5: F = 0,5 × 10 × 9,81 = 49,05 N. Xi lanh 40 N đứng lại và báo "Quá tải", xi lanh 60 N đẩy được.',
      'Nhiều vật thì cộng lại: hai thùng 10 kg nằm sát nhau cần 98,1 N. Vật chồng lên vật bị đẩy cũng được tính: thùng dưới phải đẩy cả khối lượng thùng trên. Đẩy thẳng lên thì cộng thêm trọng lượng m × 9,81.',
      'Xi lanh không bao giờ đẩy xuyên tường: gặp tường hay sàn thì thanh dừng sát đó, vật bị đẩy cũng vậy. Rút về thì không kéo vật theo: vật nằm lại chỗ đã bị đẩy tới.',
      'Chưa tính quán tính khi bắt đầu đẩy, chỉ tính ma sát. Xem trang "Vật lý kỹ thuật" ở đầu Sổ tay.',
    ],
    lessonId: 'piston-push',
    tryBoard: tryLinearActuator,
  },
];
