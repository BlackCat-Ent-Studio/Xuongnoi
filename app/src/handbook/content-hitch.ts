import { tryHitch } from './boards-hitch';
import type { HandbookEntry } from './types';

/** No lesson teaches the hitch yet: the page shows no lesson button until a lesson with this id is registered. */
const LESSON = 'hitch';

/** Handbook page of the hitch that lets a carrier take a body along. */
export const HANDBOOK_HITCH: readonly HandbookEntry[] = [
  {
    kind: 'hitch',
    purpose:
      'Gài một vật vào xe để xe chở vật đó đi, rồi nhả ra ở chỗ cần đặt. Vật đi cùng xe từng nhịp nhưng không xoay theo xe.',
    whenToUse:
      'Khi một chiếc xe phải mang một vật lớn đi nơi khác: xe tự hành chui gầm chở Lồng chứa đầy thùng ra bến, robot chở kệ hàng trong kho, xe nâng mang một kiện hàng đặt lên giá.',
    ports: {
      carrier:
        'Vào: chiếc xe sẽ chở vật, thường là "Đối tượng" của Thân robot. Cũng nhận nhân vật, phương tiện hoặc một Bệ di chuyển. Không nối thì chốt không làm gì.',
      on: 'Vào: bật thì chốt giữ vật, tắt thì nhả. Đây là tín hiệu giữ mức: phải bật suốt lúc chở. Đang bật mà chưa có vật nào trong tầm thì chốt chờ, vật vào tầm là gài ngay.',
      holding: 'Ra: bật suốt lúc chốt đang giữ một vật. Nối vào "Xong bước" của Chuỗi bước để biết đã gài xong.',
      thing:
        'Ra: vật đang được giữ; không giữ gì thì không có gì. Với Lồng chứa thì đây là tấm đáy của lồng, giống cổng "Đối tượng" của lồng. Nối vào Đo khoảng cách hay bất cứ chỗ nào cần một "Đối tượng".',
      took: 'Ra: bật đúng một nhịp lúc chốt vừa giữ được vật. Nối vào "Sang bước kế" của Chuỗi bước hoặc "Tăng 1" của Bộ đếm.',
      released:
        'Ra: bật đúng một nhịp lúc chốt vừa nhả vật, dù nhả vì "Gài" tắt hay vì xe hoặc vật bị ẩn đi.',
    },
    params: {
      reach:
        'Vật phải ở gần xe tới mức nào mới gài được, tính bằng mét trên mặt bằng từ tâm xe tới tâm vật. Mặc định 0,6: xe chui gầm chỉ cần dừng gần giữa lồng. Theo chiều cao, khoảng hở giữa xe và vật cũng phải nằm trong tầm này, nên lồng ở tầng trên không bị gài nhầm.',
      what: 'Chốt được giữ loại vật nào. "Lồng chứa" (mặc định): chỉ các lồng. "Đồ vật rời": chỉ các Đồ vật không nằm trong lồng nào và không ai đang cầm. "Cả hai": lấy vật gần nhất trong hai loại. Vật thể (hộp, tường, sàn) không gài được.',
      offset:
        'Vật nằm ở đâu so với tâm xe lúc được chở, tính bằng mét: x là ra phía mũi xe, z là sang bên phải xe, y là nâng vật lên bao nhiêu so với lúc nó đang đứng. Mặc định 0, 0, 0: vật nằm ngay giữa xe và giữ nguyên độ cao, dành cho xe chui gầm. Lúc vừa gài, vật được kéo nhẹ về vị trí này (không quá 0,5 m mỗi giây), không bị giật tới.',
      maxMass:
        'Vật nặng hơn con số này (kg, tính cả đồ nằm bên trong nó) thì chốt không gài. Mặc định 0: không giới hạn. Vật gần nhất quá nặng thì chốt bỏ qua nó và thử vật gần kế tiếp.',
    },
    example:
      '"Đối tượng" của Thân robot → "Xe" của Chốt gài. Chuỗi bước: bước 1 lái robot tới gầm lồng bằng Đi tới điểm; bước 2 và bước 3 cùng nối qua Hoặc vào "Gài"; "Đang gài" → "Xong bước 2"; bước 3 lái tới chỗ đặt lồng; bước 4 "Gài" tắt nên lồng nằm lại, robot chạy đi.',
    tips: [
      '"Gài" là tín hiệu giữ mức, không phải một nhịp bấm. Nối một nhịp (ví dụ "Khi tới nơi") vào thì chốt gài rồi nhả ngay. Hãy dùng "Bước" của Chuỗi bước, hoặc một Công tắc nhớ.',
      'Vật chỉ đổi chỗ, không bao giờ xoay: xe rẽ thì lồng vẫn giữ nguyên hướng. Nếu "Vị trí vật so với xe" khác 0 thì khi xe quay mũi, vật đi vòng theo mũi xe nhưng vẫn không xoay.',
      'Vật đang gài không đi xuyên khối rắn. Nó chạm tường, cột hay một lồng khác thì dừng lại và xe dừng cùng với nó, kể cả khi riêng thân xe còn lọt qua được. Nhả ra thì xe lại đi tiếp một mình.',
      'Một vật chỉ thuộc về một chốt. Chốt thứ hai chỉ gài được sau khi chốt thứ nhất nhả.',
      'Bật công tắc "Vật lý thật" thì vật đang gài và mọi thứ nằm trong nó đè lên xe: "Khối lượng đang chở" của Thân robot tăng, xe tăng tốc chậm hơn, và nếu vượt "Tải tối đa" thì xe báo "Quá tải" và đứng yên. Tắt công tắc thì xe vẫn gài, chở và nhả, nhưng không bị đè nặng.',
      'Xe tăng tốc và phanh thế nào thì lồng bị lắc thế ấy, vì lồng đi sát theo xe từng nhịp. Với động cơ mặc định, sáu thùng trong lồng vẫn nằm yên bên trong khi xe xuất phát, rẽ và dừng.',
      'Lồng đặt lên một Bệ di chuyển sẽ không đi theo bệ: bệ chạy đi còn lồng ở lại. Muốn bệ (ví dụ thùng xe tải) chở lồng thì đặt thêm một Chốt gài có "Xe" là chính cái bệ đó, mỗi lồng một chốt.',
      'Lồng không có chân rắn: chỉ đáy và bốn thành là rắn. Một robot thấp đi lọt qua dưới gầm lồng, kể cả chỗ hình vẽ có bánh xe của lồng.',
      'Ở góc nhìn từ trên xuống, Lồng chứa chỉ là một ô vẽ trên nền nên không gài được; Đồ vật rời vẫn gài được. Ở góc nhìn ngang, lồng là một lát cắt và được chở dọc theo trục X.',
    ],
    lessonId: LESSON,
    tryBoard: tryHitch,
  },
];
