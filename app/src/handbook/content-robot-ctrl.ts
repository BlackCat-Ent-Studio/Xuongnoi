import { TRY_BOARDS_ROBOT_CTRL as TRY } from './boards-robot-ctrl';
import type { HandbookEntry } from './types';

/** Handbook pages for the control and measurement pieces (PID controller, signal plot). */
export const HANDBOOK_ROBOT_CTRL: readonly HandbookEntry[] = [
  {
    kind: 'pid',
    purpose:
      'Tự tính "lệnh điều khiển" để một con số đo được (vị trí, tốc độ, nhiệt độ...) tiến về con số bạn muốn rồi đứng yên ở đó. Đây là bộ điều khiển kinh điển trong rô-bốt, xe tự hành và máy móc.',
    whenToUse:
      'Khi muốn một máy tự đi tới và giữ đúng một giá trị mà không cần tự canh: rô-bốt dừng đúng điểm, bục nâng giữ đúng độ cao, xe giữ đúng tốc độ. Mỗi tick (1/60 giây) mảnh ghép nhìn độ lệch rồi tính lại lệnh.',
    ports: {
      measured: 'Vào (số): giá trị đang đo được, ví dụ vị trí X của rô-bốt. Đây là "mắt" của bộ điều khiển.',
      target: 'Vào (số): giá trị muốn đạt tới. Không nối dây thì dùng số ở ô "Giá trị đặt (khi không nối dây)".',
      enable: 'Vào: bật thì bộ điều khiển làm việc. Không nối dây thì luôn bật (tính toán số không làm gì thế giới nên không cần dây mới chạy). Tắt thì lệnh ra bằng 0 và các phần tích lũy được giữ nguyên.',
      reset: 'Vào: mỗi lần bật lên một nhịp, xóa phần tích lũy (I) và trí nhớ của phần dự đoán (D). Dùng khi bắt đầu lại hoặc sau khi vật bị dịch chuyển đột ngột.',
      out: 'Ra (số): lệnh điều khiển, luôn nằm giữa "Điều khiển nhỏ nhất" và "Điều khiển lớn nhất". Nối vào cổng "Đi ngang" của nhân vật hay thứ cần điều khiển.',
      error: 'Ra (số): sai lệch = giá trị đặt trừ giá trị đo. Bằng 0 nghĩa là đã tới đúng chỗ. Dương nghĩa là còn thiếu.',
      saturated: 'Ra: bật khi lệnh bị cắt bởi giới hạn (đã "ga hết cỡ" mà vẫn chưa tới).',
      p: 'Ra (số, chỉ hiện khi bật "Hiện ba phần P, I, D"): phần tỉ lệ = Kp x sai lệch.',
      i: 'Ra (số, chỉ hiện khi bật "Hiện ba phần P, I, D"): phần tích lũy, tổng các sai lệch theo thời gian nhân Ki.',
      d: 'Ra (số, chỉ hiện khi bật "Hiện ba phần P, I, D"): phần dự đoán, đẩy ngược lại khi giá trị đo đang đổi nhanh.',
    },
    params: {
      kp: 'Kp (tỉ lệ): lệnh tỉ lệ thuận với độ lệch. Còn xa thì đẩy mạnh, gần tới thì đẩy nhẹ. Kp lớn thì tới nhanh nhưng dễ vọt quá đà và lắc; Kp nhỏ thì êm nhưng chậm, và thường dừng hơi thiếu một chút.',
      ki: 'Ki (tích lũy): cộng dồn độ lệch còn sót theo thời gian cho tới khi hết lệch hẳn. Ki giúp tới đúng giá trị đặt, nhưng Ki quá lớn làm đường đi lắc và vọt. Để 0 là tắt.',
      kd: 'Kd (dự đoán): nhìn tốc độ đang tới gần, hãm bớt trước khi vọt quá đà. Kd giúp êm hơn, nhưng Kd quá lớn làm lệnh giật vì nhiễu. Để 0 là tắt.',
      target: 'Giá trị đặt dùng khi cổng "Giá trị đặt" không có dây.',
      outMin: 'Lệnh điều khiển nhỏ nhất (ví dụ -1 là hết cỡ lùi). Lệnh không bao giờ thấp hơn số này.',
      outMax: 'Lệnh điều khiển lớn nhất (ví dụ 1 là hết cỡ tiến). Lệnh không bao giờ cao hơn số này. Nối vào nhân vật thì -1 đến 1 là vừa.',
      antiWindup:
        'Nâng cao. Có: khi lệnh đã chạm giới hạn thì phần tích lũy ngừng lớn thêm, nên khi tới nơi không bị vọt lố lâu. Không: phần tích lũy cứ lớn mãi (hiện tượng "wind-up").',
      dFilter: 'Nâng cao. Làm mượt phần D từ 0 đến 1. 0 là dùng thẳng giá trị thô (nhạy, dễ giật); gần 1 là rất mượt nhưng phản ứng chậm. Mặc định 0.2.',
      dOnMeasurement:
        'Nâng cao. Có: phần D chỉ nhìn giá trị đo, nên khi bạn đổi giá trị đặt đột ngột lệnh không bị giật mạnh. Không: D nhìn sai lệch, đổi giá trị đặt là giật một cái.',
      showParts: 'Nâng cao. Bật để hiện thêm ba ô ra P, I, D, giúp nối vào Đồ thị tín hiệu xem từng phần làm gì.',
    },
    example:
      'Nhân vật "Vị trí ngang" → PID "Giá trị đo"; Quy đổi khoảng (vị trí cần tới) → PID "Giá trị đặt"; PID "Điều khiển" → "Đi ngang" của nhân vật. Rô-bốt tự đi tới điểm đặt và dừng lại.',
    tips: [
      'Cách chỉnh dễ nhớ: đặt Ki và Kd bằng 0, tăng Kp tới khi rô-bốt tới nhanh mà chưa lắc. Nếu còn dừng thiếu một chút thì thêm một ít Ki. Nếu vọt quá đà thì thêm một ít Kd.',
      'Hầu hết thứ điều khiển được trong game chỉ nhận số từ -1 đến 1, nên để giới hạn -1 đến 1 cho khớp.',
      'Nối "Sai lệch" và "Điều khiển" vào Đồ thị tín hiệu để nhìn thấy bộ điều khiển đang nghĩ gì.',
      'Nhân vật trong game đi đúng tốc độ lệnh (không có đà), nên bộ điều khiển chỉ cần Kp là đủ. Với máy có quán tính hoặc trễ thì Ki và Kd mới thể hiện rõ.',
    ],
    lessonId: 'pid-control',
    tryBoard: TRY.pid!,
  },
  {
    kind: 'signal-plot',
    purpose: 'Vẽ lên màn hình game một đồ thị đường chạy theo thời gian cho tối đa ba con số, như máy hiện sóng. Rất hợp để xem bộ điều khiển hoạt động.',
    whenToUse:
      'Khi muốn nhìn con số thay đổi thế nào theo thời gian: giá trị đặt và giá trị đo của PID, tốc độ của xe, khoảng cách tới vật cản. Một dòng số không cho thấy xu hướng, đồ thị thì có.',
    ports: {
      a: 'Vào (số): tín hiệu của đường 1. Không nối thì đường này không vẽ.',
      b: 'Vào (số): tín hiệu của đường 2. Không nối thì đường này không vẽ.',
      c: 'Vào (số): tín hiệu của đường 3. Không nối thì đường này không vẽ.',
      pause: 'Vào: bật thì đồ thị đứng yên, không vẽ thêm. Tắt thì chạy tiếp. Tiện để chụp lại hình đẹp.',
    },
    params: {
      title: 'Tên viết phía trên đồ thị.',
      windowSeconds: 'Đồ thị hiện bao nhiêu giây gần nhất (từ 1 đến 60). Đổi số này giữa chừng sẽ vẽ lại từ đầu.',
      autoScale: 'Có: tự co giãn chiều cao cho vừa các đường. Không: dùng đúng khoảng "Nhỏ nhất" đến "Lớn nhất" bên dưới, giúp so sánh các lần chạy.',
      min: 'Số thấp nhất ở đáy đồ thị khi tắt tự chỉnh.',
      max: 'Số cao nhất ở đỉnh đồ thị khi tắt tự chỉnh.',
      labelA: 'Tên của đường 1 trong phần chú thích.',
      labelB: 'Tên của đường 2 trong phần chú thích.',
      labelC: 'Tên của đường 3 trong phần chú thích.',
      colorA: 'Màu đường 1. Mặc định xanh dương, cùng màu dây số.',
      colorB: 'Màu đường 2. Mặc định vàng.',
      colorC: 'Màu đường 3. Mặc định hồng.',
      legend: 'Có: hiện tên từng đường và con số hiện tại bên dưới đồ thị. Không: chỉ hiện đường.',
      corner: 'Góc màn hình đặt đồ thị.',
      width: 'Nâng cao. Chiều rộng đồ thị tính bằng điểm ảnh.',
      height: 'Nâng cao. Chiều cao đồ thị tính bằng điểm ảnh.',
    },
    example: 'Quy đổi khoảng (giá trị đặt) → "Tín hiệu 1"; Nhân vật "Vị trí ngang" → "Tín hiệu 2"; PID "Điều khiển" → "Tín hiệu 3". Ba đường chạy dần sang trái.',
    tips: [
      'Đồ thị chỉ nhận số. Muốn xem một tín hiệu bật/tắt thì đổi sang số trước.',
      'Đồ thị nhẹ: nó chỉ lưu tối đa vài trăm điểm và tự vẽ lại khoảng 20 lần mỗi giây.',
      'Đặt tên đường rõ ràng ("Giá trị đặt", "Vị trí") để người xem hiểu ngay đường nào là đường nào.',
    ],
    lessonId: 'pid-control',
    tryBoard: TRY['signal-plot']!,
  },
];
