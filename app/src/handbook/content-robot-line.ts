import { tryLineSensor, tryLineSensor3d, tryLineTrack } from './boards-robot-line';
import type { HandbookEntry } from './types';

const POINT_TEXT = (k: number): string =>
  `Điểm thứ ${k} của vạch khi chọn dạng "Tự vẽ", tính bằng mét: chỉ x và z được dùng (y bỏ qua). Điểm nào sau số điểm đã chọn thì không dùng.`;

const POINT_PARAMS: Record<string, string> = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`p${i + 1}`, POINT_TEXT(i + 1)]));

/** Handbook pages of the line-following pieces. */
export const HANDBOOK_ROBOT_LINE: readonly HandbookEntry[] = [
  {
    kind: 'line-track',
    purpose: 'Sơn một vạch (đường line) lên sàn để robot hay nhân vật dò theo. Vạch không cản đường, đi đè lên được.',
    whenToUse: 'Làm sân cho xe dò đường, đường đua vòng tròn, băng chuyền vẽ sơn, bài tập "bám theo vạch đen" cho robot.',
    ports: {
      self: 'Chính vạch này. Nối vào "Đường line" của Cảm biến dò line nếu muốn mắt chỉ nhìn đúng vạch này (khi bảng có nhiều vạch).',
    },
    params: {
      shape: 'Dạng vạch có sẵn: bầu dục (vòng kín), đường thẳng, chữ S, số 8. Chọn "Tự vẽ" để dùng các điểm bên dưới. Mặc định là hình bầu dục.',
      center: 'Tâm của dạng có sẵn, tính bằng mét: x và z là chỗ đặt giữa vạch, y là độ cao mặt sàn nơi vạch được sơn (mặc định 0,5, trùng mặt trên của một hộp sàn dày 1). Trong góc nhìn từ bên cạnh vạch nằm dọc theo sàn.',
      length: 'Chiều dài tổng của dạng có sẵn, theo trục x, tính bằng mét. Mặc định 12.',
      breadth: 'Chiều rộng tổng của dạng có sẵn, theo trục z, tính bằng mét (bầu dục, chữ S, số 8). Mặc định 6. Đường thẳng không dùng.',
      width: 'Bề rộng của vạch, tính bằng mét, từ 0,02 đến 3. Mặc định 0,2. Vạch càng mảnh càng khó dò.',
      color: 'Màu của vạch. Mặc định đen. Màu chỉ để nhìn: cảm biến dò line không phân biệt màu.',
      count: 'Số điểm dùng khi chọn "Tự vẽ", từ 2 đến 16. Mặc định 4.',
      closed: 'Có: điểm cuối nối ngược về điểm đầu thành vòng kín. Không: vạch có hai đầu hở. Chỉ dùng khi chọn "Tự vẽ"; bầu dục và số 8 luôn kín, đường thẳng và chữ S luôn hở.',
      smooth: 'Có: các góc của dạng "Tự vẽ" được bo tròn cho xe chạy mượt. Không: giữ góc nhọn.',
      radius: 'Bán kính bo góc, tính bằng mét (0 đến 5). Mặc định 1. Góc nào nằm giữa hai đoạn ngắn thì tự bo nhỏ hơn để không vượt quá đoạn.',
      ...POINT_PARAMS,
    },
    example: 'Mảnh Đường line (bầu dục) "Đối tượng" → "Đường line" của Cảm biến dò line; Nhân vật "Đối tượng" → "Đối tượng" của Cảm biến.',
    tips: [
      'Vạch là hình vẽ phẳng trên sàn: nhân vật và xe đi qua bình thường, không bị vướng hay bị chặn.',
      'Đổi dạng, bề rộng hay điểm xong phải bấm Chơi lại mới có hiệu lực; chỉ có màu đổi được ngay lúc đang chơi.',
      'Muốn đường riêng của mình: chọn "Tự vẽ", đặt số điểm rồi gõ x, z từng điểm. Bật "Bo tròn góc" để khúc cua mềm.',
      'Vạch chỉ là một chỗ để đọc. Muốn biết vật có đang đứng trên vạch không, hãy dùng mảnh Cảm biến dò line.',
    ],
    lessonId: 'line-eyes',
    tryBoard: tryLineTrack,
  },
  {
    kind: 'line-sensor',
    purpose: 'Một "mắt" nhìn xuống sàn dưới một vật xem có đang thấy vạch line không, giống mắt hồng ngoại của xe dò đường. Cho ra cả số "Độ đậm" từ 0 đến 1.',
    whenToUse: 'Xe hay robot bám theo vạch: đặt 2 hoặc 3 mắt lệch trái, giữa, phải rồi so sánh để biết nên rẽ bên nào. Cũng dùng để biết vật vừa chạm vạch xuất phát hay vạch đích.',
    ports: {
      who: 'Vật mang mắt (nhân vật, xe, thân robot...). Bắt buộc nối. Mắt đi theo vị trí vật và xoay theo hướng vật đang quay mặt. Chưa nối thì mắt tắt hết.',
      track: 'Không bắt buộc. Nối "Đối tượng" của một Đường line để mắt chỉ nhìn đúng vạch đó; để trống thì mắt thấy mọi vạch trên bảng.',
      onLine: 'Bật khi "Độ đậm" từ ngưỡng trở lên (và lớn hơn 0), tắt khi không. Bật suốt lúc đang thấy line.',
      level: 'Phần của vòng đọc đang nằm trên vạch, từ 0 (không dính vạch) đến 1 (vòng đọc nằm trọn trong vạch). Khi vòng đọc đang bước qua mép vạch thì ra số ở giữa, tăng dần, không nhảy lùi. Nếu bật "Đảo ngược" thì ra 1 trừ số đó.',
      entered: 'Bật một nhịp lúc mắt vừa chuyển từ không thấy sang thấy line.',
      left: 'Bật một nhịp lúc mắt vừa chuyển từ thấy sang không thấy line.',
    },
    params: {
      side: 'Mắt lệch sang bên bao nhiêu mét so với tâm vật, nhìn theo hướng vật đang quay mặt: số âm là bên trái, số dương là bên phải. Mặc định 0. Góc nhìn từ bên cạnh không dùng số này.',
      forward: 'Mắt lệch ra phía trước bao nhiêu mét (số âm là ra phía sau). Mặc định 0,6, tức là hơi nhô ra trước mũi nhân vật.',
      spot: 'Đường kính vòng đọc dưới mắt, tính bằng mét (0 đến 5). Mặc định 0,3. Vòng nhỏ đọc chính xác, vòng to đọc mờ hơn. Đặt 0 để đọc đúng một điểm.',
      threshold: 'Ngưỡng từ 0 đến 1: "Độ đậm" từ mức này trở lên thì "Thấy line" bật. Mặc định 0,5 (nửa vòng đọc nằm trên vạch).',
      invert: 'Có: "Độ đậm" đổi thành 1 trừ phần nằm trên vạch, nên mắt báo "thấy" khi đang ở trên nền, không phải trên vạch (dùng để biết xe đã rời hẳn khỏi vạch). Mặc định Không.',
    },
    example: 'Nhân vật "Đối tượng" → Cảm biến dò line "Đối tượng"; Đường line "Đối tượng" → "Đường line"; "Độ đậm" → "Giá trị" của Hiện số; "Thấy line" → "Hiện" của Hiện chữ.',
    tips: [
      'Đặt hai mắt lệch trái và phải một chút (ví dụ -0,25 và 0,25) để vạch nằm giữa hai mắt: mắt nào chạm vạch trước cho biết xe đang lệch về phía đó.',
      'Vật phải có hướng quay mặt (nhân vật đã đi, xe, thân robot) thì mắt mới xoay theo. Nhân vật chưa nhúc nhích nhìn về bên phải.',
      'Một chấm tròn nhỏ dưới vật cho thấy chỗ mắt đang đọc; chấm xanh lá khi thấy line, xám khi không. Chấm chỉ hiện lúc đang chơi và to bằng cỡ vòng đọc lúc mắt bắt đầu đọc.',
      'Nếu "Độ đậm" chỉ nhích nhẹ rồi tụt, vạch đang quá mảnh so với vòng đọc: tăng bề rộng vạch hoặc giảm cỡ vòng đọc.',
    ],
    lessonId: 'line-eyes',
    tryBoard: tryLineSensor,
    extraTries: [{ label: 'Thử trong 3D', board: tryLineSensor3d }],
  },
];
