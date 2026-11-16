import { tryGripper, tryJoint, tryLink } from './boards-robot-arm';
import type { HandbookEntry } from './types';

/** Handbook pages of the robot arm pieces: Khớp xoay (Servo), Thanh nối, Tay kẹp. */
export const HANDBOOK_ROBOT_ARM: readonly HandbookEntry[] = [
  {
    kind: 'joint',
    purpose: 'Khớp của tay máy, như một động cơ servo: quay tới góc bạn đặt, nhưng chỉ khi đủ sức giữ phần tay phía sau.',
    whenToUse: 'Vai và khuỷu của cánh tay, cổ tay, đế xoay của cần cẩu; mọi chỗ cần một thanh quay quanh một điểm và cần biết nó chịu bao nhiêu mô-men.',
    ports: {
      base: 'Vật mà khớp gắn lên: một Vật thể, thân robot, hoặc "Đầu khớp" / "Đầu thanh" của mảnh khác (nối nối tiếp thành cánh tay). Bắt buộc nối.',
      angle: 'Góc muốn tới, tính bằng độ. Trục ngang: 0 là thẳng ra phía trước, 90 là hướng lên, -90 là hướng xuống. Chưa nối thì khớp giữ ở "Góc bắt đầu".',
      power: 'Bật servo. Chưa nối hoặc tắt thì servo buông tay: không giữ gì, phần tay phía sau sụp xuống theo trọng lượng.',
      tip: 'Đầu quay của khớp. Nối vào "Gắn vào" của Thanh nối, của khớp tiếp theo hoặc của Tay kẹp.',
      angleNow: 'Góc khớp đang có (độ), có thể còn đang trên đường tới "Góc đặt".',
      load: 'Mô-men khớp đang phải chịu để giữ mọi thứ phía sau (N·m). Khớp trục đứng luôn ra 0 vì trọng lực không có tay đòn.',
      overloaded: 'Bật khi mô-men cần giữ lớn hơn "Mô-men tối đa" (hoặc servo chưa được bật). Lúc đó khớp trễ dần xuống.',
      reached: 'Bật khi góc hiện tại nằm trong "Sai số cho phép" quanh "Góc đặt" và khớp không quá tải. Dùng để nối sang bước kế tiếp của chuỗi: khớp tới nơi rồi mới kẹp.',
    },
    params: {
      axis: 'Ngang: gập lên xuống trong mặt phẳng đứng (thấy rõ ở nhìn ngang và 3D). Đứng: xoay quanh trục đứng (thấy ở nhìn từ trên và 3D). Mỗi kiểu nhìn chỉ vẽ trục nó thấy được.',
      start: 'Góc lúc bắt đầu chơi, tính bằng độ so với vật gắn.',
      min: 'Góc nhỏ nhất khớp được phép tới (độ).',
      max: 'Góc lớn nhất khớp được phép tới (độ).',
      maxTorque: 'Sức quay tối đa (N·m). Servo nhỏ vài N·m, servo công nghiệp hàng trăm N·m. Mặc định 50.',
      maxSpeed: 'Tốc độ quay tối đa khi khớp còn đủ sức (độ mỗi giây). Mặc định 90.',
      tolerance: 'Sai số cho phép (độ) để "Đã tới góc" bật. Mặc định 1.',
      mount: 'Dời điểm gắn khỏi tâm của vật (mét, theo chiều dọc / lên / ngang của vật). Ví dụ gắn lên mặt trên của cột cao 1,6 m thì đặt "lên" 0,8.',
      color: 'Màu hình hộp nhỏ vẽ tại khớp.',
    },
    example:
      'Vật thể (cột) "Đối tượng" → Khớp xoay "Gắn vào". Khởi động "Đã bắt đầu" → "Bật". Quy đổi khoảng "Giá trị ra" → "Góc đặt". Hiện số: "Mô-men đang chịu".',
    tips: [
      'Công thức: mô-men cần giữ M = Σ m × 9,81 × L (khối lượng mỗi vật phía sau × 9,81 × khoảng cách ngang tới khớp). Ví dụ thanh 8 kg cách khớp 0,5 m: M = 8 × 9,81 × 0,5 = 39,2 N·m. Khớp 30 N·m không giữ nổi, 50 N·m thì giữ được.',
      'Khi quá tải khớp không giật mà sụp dần: tốc độ sụp tỉ lệ với phần mô-men vượt. Cánh tay duỗi ngang tốn mô-men nhất; nhấc tay lên cao thì tay đòn ngắn lại và nhẹ hơn.',
      'Chưa tính quán tính khi tăng tốc, chỉ tính trọng lực. Xem trang "Vật lý kỹ thuật" ở đầu Sổ tay.',
    ],
    lessonId: 'robot-arm',
    tryBoard: tryJoint,
  },
  {
    kind: 'link',
    purpose: 'Một đoạn cánh tay cứng, vẽ như một thanh dài. Nó chỉ đi theo khớp phía trước và có khối lượng thật.',
    whenToUse: 'Cánh tay trên, cẳng tay, cần cẩu: gắn xen kẽ Khớp - Thanh - Khớp - Thanh - Tay kẹp để làm tay máy nhiều đốt.',
    ports: {
      base: 'Nơi đầu thanh gắn vào: thường là "Đầu khớp" của một khớp, hoặc đầu của thanh khác. Bắt buộc nối.',
      tip: 'Đầu xa của thanh. Nối vào "Gắn vào" của khớp tiếp theo hoặc của Tay kẹp.',
    },
    params: {
      length: 'Chiều dài thanh (mét).',
      mass: 'Khối lượng thanh (kg), tính như đặt ở giữa thanh. Đây là tải mà các khớp phía trước phải giữ.',
      thickness: 'Độ dày để vẽ (mét); không ảnh hưởng tính toán.',
      color: 'Màu thanh.',
    },
    example: 'Khớp xoay "Đầu khớp" → Thanh nối "Gắn vào"; Thanh nối "Đầu thanh" → Khớp xoay (khuỷu) "Gắn vào".',
    tips: [
      'Thanh không tự quay: nó cứ thẳng theo hướng khớp phía trước. Muốn thanh gập thì thêm khớp.',
      'Thanh dài và nặng làm khớp chịu mô-men lớn: M = khối lượng × 9,81 × (nửa chiều dài, vì khối lượng đặt ở giữa).',
      'Thanh chỉ để vẽ và tính tải, không chặn đường: vật khác đi xuyên qua nó.',
    ],
    lessonId: 'robot-arm',
    tryBoard: tryLink,
  },
  {
    kind: 'gripper',
    purpose: 'Tay kẹp ở cuối cánh tay. Kẹp một món đồ vật bằng hai ngón với lực bạn chọn, và cho biết kẹp có giữ được hay không.',
    whenToUse: 'Gắp thùng lên băng chuyền, nhấc hàng nặng nhẹ khác nhau, kiểm tra lực kẹp vừa đủ: không tuột mà cũng không làm hỏng hàng dễ vỡ.',
    ports: {
      base: 'Đầu thanh nối hoặc đầu khớp mà tay kẹp gắn vào. Bắt buộc nối.',
      close: 'Bật để kẹp: nó kẹp món đồ vật gần nhất trong tầm với mà bề ngang vừa độ mở. Tắt thì nhả. Chưa nối thì không kẹp.',
      force: 'Lực kẹp mỗi ngón (N). Chưa nối thì dùng "Lực kẹp mặc định"; luôn bị giới hạn ở "Lực kẹp tối đa".',
      holding: 'Bật khi đang giữ một món đồ vật.',
      held: 'Món đồ vật đang giữ, nối tiếp vào mảnh khác.',
      gripForce: 'Lực mỗi ngón đang ép (N), 0 khi tay đang mở.',
      slipped: 'Một nhịp lúc món đồ tuột khỏi tay vì lực kẹp không đủ. Phải nhả rồi kẹp lại.',
      crushedOut: 'Một nhịp lúc món đồ bị hỏng vì kẹp quá mạnh (nó méo và sẫm màu, vẫn kẹp được).',
      inReach: 'Bật khi có món đồ vật kẹp được ngay: nằm trong tầm với và bề ngang vừa độ mở. Giữ nguyên trạng thái, không phải một nhịp. Nối vào "Kẹp" để tay tự kẹp khi tới nơi.',
      candidate: 'Món đồ vật đó (món gần nhất kẹp được). Khi đang giữ thì là món đang giữ.',
    },
    params: {
      defaultForce: 'Lực kẹp mỗi ngón khi chưa nối "Lực kẹp" (N). Mặc định 20.',
      maxForce: 'Lực kẹp mỗi ngón lớn nhất (N). Mặc định 120.',
      fingerMu: 'Hệ số ma sát của ngón μ. Ma sát dùng để kẹp là số NHỎ HƠN giữa μ của ngón và μ của món đồ (mặc định 0,8 và 0,5 nên ra 0,5).',
      width: 'Độ mở (mét): món đồ rộng hơn (tính theo chiều hai ngón khép lại) thì không kẹp được.',
      reach: 'Tầm với (mét): tâm món đồ phải cách điểm kẹp không quá số này.',
      mass: 'Khối lượng của chính tay kẹp (kg), tải thêm cho các khớp.',
      fingers: 'Số ngón (1 đến 4). Hình vẽ luôn là hai ngón nhưng tính toán dùng số này.',
      color: 'Màu tay kẹp.',
    },
    example:
      'Thanh nối "Đầu thanh" → Tay kẹp "Gắn vào". Phím bấm Cách "Đang giữ phím" → "Kẹp". Hiện số "Lực đang kẹp". Mảnh "Khi vật tuột" → Chốt nhớ → Hiện chữ.',
    tips: [
      'Giữ được khi số ngón × μ × lực mỗi ngón ≥ khối lượng × 9,81. Ví dụ thùng 5 kg, μ 0,5, 2 ngón: cần 5 × 9,81 ÷ (2 × 0,5) = 49,05 N. 40 N thì tuột, 50 N thì giữ.',
      'Hỏng khi tổng lực ép (số ngón × lực mỗi ngón) vượt "Lực chịu nén tối đa" của món đồ. Thùng dễ vỡ chịu 60 N: kẹp 2 × 35 = 70 N là hỏng.',
      'Thùng đang nằm trên bàn thì bàn đỡ, chỉ khi nhấc lên mới cần ma sát. Món đang giữ làm nặng thêm mọi khớp phía sau. Xem trang "Vật lý kỹ thuật" ở đầu Sổ tay.',
    ],
    lessonId: 'robot-arm',
    tryBoard: tryGripper,
  },
];
