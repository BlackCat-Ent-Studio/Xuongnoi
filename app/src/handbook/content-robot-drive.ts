import type { Board } from '../engine/types';
import { build, v } from './boards-math-object-output';
import type { HandbookEntry } from './types';

/** Handbook pages for the robot drive train: the chassis ("Thân robot") and its wheel motors ("Động cơ"). */

const BODY_PARAM_TEXT = {
  colliderSize:
    'Nâng cao. Cỡ của "vùng va chạm" vô hình dùng để chạm tường và khối. Để 0, 0, 0 thì vùng va chạm là hình vuông có cạnh bằng cạnh dài nhất của thân (để robot quay mà không kẹt góc). Đặt nhỏ hơn thì lọt khe hẹp dễ hơn.',
  colliderOffset: 'Nâng cao. Dịch vùng va chạm lệch khỏi tâm của thân (ngang, cao, sâu). Để 0, 0, 0 là nằm chính giữa.',
  gravityScale: 'Nâng cao. Mức bị kéo xuống: 1 là bình thường, 0 là lơ lửng. Chỉ có tác dụng khi game có trọng lực (nhìn ngang hoặc 3D).',
} as const;

/** Chassis with two motors that are driven by two constants: they differ, so the robot drives a circle. */
function tryRobotBody(): Board {
  return build(
    'Thử: Thân robot',
    '2d-top',
    'Nhìn từ trên xuống. Hai Động cơ gắn vào Thân robot, mỗi cái nhận một Số cố định làm công suất: bánh trái 1, bánh phải 0.5, nên robot chạy vòng tròn. Chỉnh "Khối lượng" hoặc "Độ bám" của Thân rồi chạy lại để thấy robot nặng hơn thì ì hơn, sàn trơn hơn thì trượt xa hơn.',
    [
      { id: 'left-power', kind: 'const', col: 0, row: 0, params: { value: 1 } },
      { id: 'right-power', kind: 'const', col: 0, row: 1, params: { value: 0.5 } },
      { id: 'body', kind: 'robot-body', col: 1, row: 0, params: { position: v(-3, 0.5, 2) } },
      { id: 'left-motor', kind: 'motor', col: 2, row: 0, params: { side: -0.4 } },
      { id: 'right-motor', kind: 'motor', col: 2, row: 1, params: { side: 0.4 } },
      { id: 'speed', kind: 'show-number', col: 3, row: 0, params: { label: 'Tốc độ (m/s)' } },
      { id: 'turn', kind: 'show-number', col: 3, row: 1, params: { label: 'Tốc độ quay (độ/giây)', corner: 'top-right' } },
    ],
    [
      ['left-power', 'value', 'left-motor', 'power'],
      ['right-power', 'value', 'right-motor', 'power'],
      ['body', 'self', 'left-motor', 'body'],
      ['body', 'self', 'right-motor', 'body'],
      ['body', 'speed', 'speed', 'value'],
      ['body', 'turnRate', 'turn', 'value'],
    ],
  );
}

/** Chassis with two motors; the arrow keys are mixed into a left and a right power (tank control). */
function tryMotor(): Board {
  return build(
    'Thử: Động cơ',
    '2d-top',
    'Nhìn từ trên xuống. Mũi tên lên/xuống là công suất chung của hai bánh, trái/phải làm hai bánh chạy lệch nhau: bánh trái = lên + phải, bánh phải = lên − phải. Bấm mũi tên lên để chạy thẳng, thêm phải để rẽ. Thử đổi "Chiều quay" của một động cơ, hoặc đặt "Vị trí ngang" của nó về 0.',
    [
      { id: 'stick', kind: 'stick', col: 0, row: 0 },
      { id: 'left-mix', kind: 'math', col: 1, row: 0, params: { op: 'add' } },
      { id: 'right-mix', kind: 'math', col: 1, row: 1, params: { op: 'sub' } },
      { id: 'body', kind: 'robot-body', col: 2, row: 0, params: { position: v(-4, 0.5, 0) } },
      { id: 'left-motor', kind: 'motor', col: 3, row: 0, params: { side: -0.4 } },
      { id: 'right-motor', kind: 'motor', col: 3, row: 1, params: { side: 0.4 } },
      { id: 'rpm', kind: 'show-number', col: 4, row: 0, params: { label: 'Vòng quay bánh trái' } },
      { id: 'wall', kind: 'block', col: 2, row: 2, params: { position: v(6, 0.5, 0), size: v(1, 1, 8), color: '#737373' } },
    ],
    [
      ['stick', 'y', 'left-mix', 'a'],
      ['stick', 'x', 'left-mix', 'b'],
      ['stick', 'y', 'right-mix', 'a'],
      ['stick', 'x', 'right-mix', 'b'],
      ['left-mix', 'out', 'left-motor', 'power'],
      ['right-mix', 'out', 'right-motor', 'power'],
      ['body', 'self', 'left-motor', 'body'],
      ['body', 'self', 'right-motor', 'body'],
      ['left-motor', 'rpm', 'rpm', 'value'],
    ],
  );
}

export const HANDBOOK_ROBOT_DRIVE: readonly HandbookEntry[] = [
  {
    kind: 'robot-body',
    purpose: 'Thân của một robot: một khối nằm trên mặt đất có khối lượng và độ bám thật. Tự nó không chạy; chỉ các Động cơ gắn lên nó mới đẩy nó đi.',
    whenToUse:
      'Làm robot tự hành, xe dò đường, robot giao hàng, bất kỳ cỗ máy nào có bánh. Thân cho biết robot đang chạy nhanh bao nhiêu, đang hướng về đâu và đang quay nhanh bao nhiêu để các mảnh ghép khác (cảm biến, bộ điều khiển) dùng.',
    ports: {
      self: 'Ra (vật): chính Thân này. Nối vào cổng "Thân" của từng Động cơ để gắn bánh lên nó.',
      speed: 'Ra (số): tốc độ chạy tới, đơn vị mét trên giây. Dương là chạy tới, âm là đang lùi.',
      heading: 'Ra (số): hướng mũi robot, đơn vị độ. 0 là sang phải, 90 là xuống dưới (nhìn từ trên), tăng dần theo chiều kim đồng hồ. Nhìn ngang thì luôn là 0.',
      turnRate: 'Ra (số): tốc độ quay, độ trên giây. Dương là đang rẽ phải (cùng chiều kim đồng hồ), âm là rẽ trái.',
      distance:
        'Ra (số, chỉ hiện khi bật "Hiện ô Quãng đường"): quãng đường robot đã đi được trên mặt đất tính từ lúc bắt đầu, đơn vị mét, như đồng hồ đo quãng đường. Chạy vòng thì tính theo chiều dài đường cong, quay tại chỗ thì gần như không tăng.',
      resetDistance: 'Vào (bật/tắt, chỉ hiện khi bật "Hiện ô Quãng đường"): mỗi lần bật lên một nhịp thì đặt "Quãng đường" về 0 rồi đếm lại từ đầu.',
      payload:
        'Ra (số, chỉ hiện khi bật "Hiện ô Khối lượng chở"): tổng khối lượng (kg) của những thứ đang nằm trên mặt trên của thân, kể cả thứ chồng lên thứ đó. Khối lượng này cộng vào khối lượng thân khi động cơ phải đẩy.',
      overloaded: 'Ra (bật/tắt, chỉ hiện khi bật "Hiện ô Khối lượng chở"): bật khi hàng đang chở nặng hơn "Tải tối đa" nên động cơ không đẩy nổi.',
      pushing: 'Ra (bật/tắt, chỉ hiện khi bật "Hiện ô Đang đẩy vật"): bật khi robot đang đẩy một vật nằm trên sàn, kể cả lúc nó bị kẹt vì vật quá nặng.',
      pushForce:
        'Ra (số, N, chỉ hiện khi bật "Hiện ô Đang đẩy vật"): lực đang đẩy. Đẩy được thì là lực cần để đẩy vật (và các vật bị vật đó đẩy theo); bị kẹt thì là toàn bộ lực mà các động cơ đang có. Không đẩy gì thì bằng 0.',
    },
    params: {
      position: 'Chỗ robot xuất hiện lúc bắt đầu chạy (tâm của thân).',
      heading: 'Mũi robot quay về đâu lúc bắt đầu, tính bằng độ: 0 là sang phải, 90 là xuống dưới.',
      length: 'Chiều dài thân, tính bằng mét (theo hướng mũi).',
      width: 'Chiều rộng thân, tính bằng mét. Hai bánh đặt ở hai bên nên bề ngang thường hơn "Vị trí ngang" của bánh một chút.',
      height: 'Chiều cao thân, tính bằng mét.',
      mass: 'Khối lượng, kg. Càng nặng thì mỗi lần ga hay phanh robot càng ì: lực đẩy của các Động cơ chia cho khối lượng. Chỉnh được ngay khi đang chạy.',
      maxPayload:
        'Nâng cao. Tải tối đa, kg. Hàng nằm trên thân nặng hơn mức này thì động cơ không đẩy nổi, robot đứng yên (đang chạy thì phanh lại) cho tới khi bớt hàng. Để 0 là không giới hạn. Chỉnh được ngay khi đang chạy.',
      showDistance: 'Nâng cao. Bật để hiện thêm ô ra "Quãng đường" và ô vào "Đặt lại quãng đường". Tắt thì thẻ Thân giữ nguyên như cũ.',
      showPayload: 'Nâng cao. Bật để hiện thêm hai ô ra "Khối lượng đang chở" và "Quá tải". Tắt thì thẻ Thân giữ nguyên như cũ.',
      pushObjects:
        'Nâng cao. "Có" (mặc định): robot đi vào thùng, đồ vật nằm trên sàn thì đẩy chúng đi, giống xi lanh đẩy. Lực cần là F = μ × (khối lượng vật + hàng nằm trên vật) × 9,81, cộng dồn nếu đẩy nhiều vật nối nhau; ví dụ thùng 10 kg, μ 0,5 cần 49,05 N. Lực robot có là tổng "Lực kéo tối đa" của các Động cơ, mỗi cái nhân với công suất. Lực không đủ thì robot đứng lại sát vật (bánh vẫn quay). Vật bị đẩy không xuyên qua tường: gặp tường thì cả vật lẫn robot dừng. Đồ nằm trên mặt trên của thân thì đi theo robot chứ không bị đẩy. "Không": robot đi xuyên qua vật như cũ.',
      showPush: 'Nâng cao. Bật để hiện thêm hai ô ra "Đang đẩy vật" và "Lực đang đẩy". Tắt thì thẻ Thân giữ nguyên như cũ.',
      friction:
        'Độ bám mặt đất. Số lớn (0.8, giày cao su) thì robot tăng tốc và dừng gấp; số nhỏ (0.1, mặt băng) thì robot trượt thêm một đoạn dài mới dừng, và cũng khó tăng tốc. Chỉnh được ngay khi đang chạy.',
      color: 'Màu thân robot. Đổi được ngay khi đang chạy.',
      solid: '"Có" thì người đi bộ không đi xuyên qua robot.',
      ...BODY_PARAM_TEXT,
    },
    example:
      'Thân robot "Đối tượng" → "Thân" của hai Động cơ (một bên trái, một bên phải); Số cố định 1 → "Công suất" của cả hai động cơ thì robot chạy thẳng; "Tốc độ" của Thân → Hiện số để xem robot chạy nhanh bao nhiêu.',
    tips: [
      'Thân không có cổng vào: nó chỉ chạy khi có Động cơ gắn vào và Động cơ có dây "Công suất". Không có động cơ nào thì robot đứng yên mãi.',
      'Kích thước, màu, vị trí chỉ đọc lúc bắt đầu chạy (màu thì đổi được ngay); "Khối lượng" và "Độ bám" sửa được cả khi đang chạy.',
      'Để robot quay mà không kẹt góc, vùng va chạm là hình vuông cạnh bằng chiều dài (hoặc rộng) lớn nhất. Muốn khác thì chỉnh "Cỡ vùng va chạm" trong Nâng cao.',
      'Đơn vị là mét, kg, giây, độ; nhìn ngang thì robot chỉ chạy theo trục ngang, không quay. Chở hàng: đồ vật đặt trên mặt trên của thân sẽ đi và quay cùng robot (nhìn ngang hoặc 3D; nhìn từ trên xuống thì đồ không xếp chồng nên không tính). Hàng càng nặng thì robot càng ì, quá "Tải tối đa" thì đứng yên.',
    ],
    lessonId: 'two-motor-robot',
    tryBoard: tryRobotBody,
  },
  {
    kind: 'motor',
    purpose: 'Một động cơ có bánh xe, gắn lên Thân robot. Công suất bạn nối vào quyết định bánh quay nhanh hay chậm, tiến hay lùi.',
    whenToUse:
      'Mỗi bánh một Động cơ. Hai động cơ hai bên chạy bằng nhau thì robot chạy thẳng; chạy lệch nhau thì rẽ; ngược chiều nhau thì quay tại chỗ. Một động cơ lệch khỏi giữa thì robot đi vòng tròn. Dùng cho robot dò đường, xe tự hành, mọi cỗ máy có bánh.',
    ports: {
      body: 'Vào (vật): nối "Đối tượng" của Thân robot muốn gắn bánh lên. Không nối thì bánh quay trơ, không đẩy ai.',
      power: 'Vào (số): công suất từ -1 đến 1. 1 là quay hết tốc độ tới, -1 là hết tốc độ lùi, 0 là đứng yên. Không nối dây thì tính là 0 nên bánh không quay.',
      rpm: 'Ra (số): vòng quay thật của bánh lúc này, tính bằng vòng mỗi phút. Dương là đẩy robot tới. Bánh tăng tốc từ từ nên số này đuổi theo công suất chứ không nhảy ngay. Khi game bật "Vật lý thật", bánh lăn theo mặt đất và chỉ quay nhanh hơn mặt đất khi trượt.',
      turning: 'Ra: bật khi bánh đang quay.',
      turns:
        'Ra (số, chỉ hiện khi bật "Hiện bộ đếm vòng"): tổng số vòng bánh đã quay từ lúc bắt đầu, như bộ mã hóa vòng quay (encoder). Có dấu: quay tới thì tăng, quay lùi thì giảm. Số vòng × 2π × bán kính bánh là quãng đường bánh đã lăn (nếu robot không bị kẹt).',
      resetTurns: 'Vào (bật/tắt, chỉ hiện khi bật "Hiện bộ đếm vòng"): mỗi lần bật lên một nhịp thì đặt "Số vòng đã quay" về 0 rồi đếm lại.',
      slipping:
        'Ra (bật/tắt, chỉ hiện khi bật "Hiện ô Đang trượt"): bật khi bánh đang trượt, nghĩa là động cơ muốn kéo mạnh hơn độ bám của mặt đất cho phép nên bánh quay nhanh hơn mặt đất. Chỉ có khi game bật "Vật lý thật"; không thì luôn tắt.',
      slipSpeed:
        'Ra (số, m/s, chỉ hiện khi bật "Hiện ô Đang trượt"): tốc độ vành bánh nhanh hơn mặt đất bao nhiêu mét mỗi giây lúc bánh trượt; bánh bám tốt thì bằng 0. Chỉ có khi game bật "Vật lý thật".',
    },
    params: {
      side: 'Chỗ gắn bánh theo bề ngang thân, tính bằng mét tính từ đường giữa: số âm là bên trái, số dương là bên phải. Hai bánh càng xa nhau thì robot rẽ càng chậm mà chắc. Một bánh gắn lệch tâm sẽ làm robot đi vòng.',
      forward: 'Chỗ gắn bánh theo chiều dọc thân, mét: số dương là phía trước, số âm là phía sau. Chỉ để vẽ bánh đúng chỗ; chuyển động chỉ phụ thuộc vị trí ngang.',
      wheelRadius: 'Bán kính bánh, mét. Bánh to đi được xa hơn cho mỗi vòng quay: tốc độ = vòng quay × 2π × bán kính ÷ 60.',
      maxRpm: 'Tốc độ tối đa của động cơ khi công suất là 1, vòng mỗi phút. Mặc định 120 vòng/phút với bánh 0.15 m ra khoảng 1.9 m/s.',
      accel: 'Độ tăng tốc của động cơ, vòng/phút mỗi giây. Nhỏ thì bánh ì khi bắt đầu quay và khi dừng; lớn thì đổi tốc độ gần như tức thì.',
      reverse: '"Đảo chiều" thì công suất dương làm bánh quay lùi. Dùng khi động cơ bên kia lắp ngược chiều.',
      maxForce:
        'Lực kéo tối đa của động cơ này, đơn vị niu-tơn (N), khi công suất là 1; công suất nhỏ hơn thì lực nhỏ theo (công suất 0,5 là một nửa). Chỉ có tác dụng khi robot đẩy vật: lực của cả robot là tổng lực các động cơ đang quay cùng chiều robot chạy. Ví dụ hai động cơ 30 N cho 60 N, đủ đẩy một thùng 10 kg (cần 49,05 N); hai động cơ 20 N chỉ có 40 N nên robot đứng lại trước thùng. Không đẩy gì thì số này không đổi chuyển động của robot. Mặc định 30 N.',
      showTurns: 'Nâng cao. Bật để hiện thêm ô ra "Số vòng đã quay" và ô vào "Đặt lại vòng". Tắt thì thẻ Động cơ giữ nguyên như cũ.',
      driveForce:
        'Nâng cao, chỉ có tác dụng khi game bật "Vật lý thật". Lực tối đa (N) mà động cơ này kéo robot khi tăng tốc. Mặc định 6 N. Lực thật còn bị chặn bởi độ bám: μ × trọng lượng đè lên bánh. Xem trang "Vật lý thật".',
      brakeForce:
        'Nâng cao, chỉ có tác dụng khi game bật "Vật lý thật". Lực phanh tối đa (N) của động cơ này khi robot giảm tốc. 0 là chỉ phanh bằng ma sát (dừng cùng một quãng dù robot nặng hay nhẹ). Đặt số dương thì robot nặng cần quãng dừng dài hơn: a = tổng lực phanh ÷ khối lượng. Lực phanh cũng không vượt được độ bám.',
      showSlip: 'Nâng cao. Bật để hiện thêm hai ô ra "Đang trượt" và "Tốc độ trượt". Tắt thì thẻ Động cơ giữ nguyên như cũ.',
    },
    example:
      'Cần điều khiển → hai Phép tính (lên + phải cho bánh trái, lên − phải cho bánh phải) → "Công suất" của hai Động cơ; "Đối tượng" của Thân robot → "Thân" của cả hai.',
    tips: [
      'Đừng quên dây "Công suất": không có nó thì bánh không quay và robot không chạy, đúng như động cơ không có điện.',
      'Chuyển động của robot do TẤT CẢ động cơ trên Thân cùng quyết định: tốc độ tới là trung bình các bánh, độ quay là chênh lệch giữa bánh bên trái và bên phải chia cho bề rộng giữa hai bánh.',
      'Một động cơ không nối công suất vẫn tính là một bánh đứng yên: nó hãm bên đó nên robot vòng về phía bánh ấy.',
      'Nhìn ngang thì robot chỉ chạy theo trục ngang, không quay. Bộ đếm vòng đếm vòng quay của bánh, kể cả lúc robot bị tường chặn mà bánh vẫn quay trượt. Muốn biết robot thật sự đi được bao xa thì dùng "Quãng đường" của Thân robot. Đẩy vật chỉ tính ma sát: đủ "Lực kéo tối đa" thì robot đẩy hết tốc độ, thiếu thì đứng lại (bánh vẫn quay).',
    ],
    lessonId: 'two-motor-robot',
    tryBoard: tryMotor,
  },
];
