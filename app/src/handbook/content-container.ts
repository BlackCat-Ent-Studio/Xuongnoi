import { tryContainer } from './boards-container';
import type { HandbookEntry } from './types';

/** No lesson teaches the cage yet: the page shows no lesson button until a lesson with this id is registered. */
const LESSON = 'container';

/** Handbook page of the cage that counts what falls into it. */
export const HANDBOOK_CONTAINER: readonly HandbookEntry[] = [
  {
    kind: 'container',
    purpose:
      'Một chiếc lồng hở miệng có bánh xe. Vật rơi vào thì nằm lại bên trong như vật thật; lồng đếm số vật đang nằm trong nó và báo khi đã đầy.',
    whenToUse:
      'Khi cần một cái thùng, giỏ hay xe đẩy hứng hàng và biết trong đó có bao nhiêu món: lồng hứng dưới lỗ thả của sàn nâng, thùng gom hàng ở cuối băng chuyền, giỏ đựng sản phẩm xong của một tay máy.',
    ports: {
      self: 'Ra: tấm đáy của lồng. Nối vào bất cứ chỗ nào cần một "Đối tượng", ví dụ Đo khoảng cách. Lồng gồm năm khối rắn (đáy và bốn thành) luôn đi cùng nhau như một vật.',
      count:
        'Ra: số đồ vật đang nằm trong lồng. Một vật được tính khi tâm của nó nằm giữa bốn thành, phía trên đáy và phía dưới miệng lồng. Đếm lại mỗi nhịp: vật nảy ra ngoài thì số này giảm ngay.',
      full: 'Ra: bật khi "Số vật bên trong" bằng hoặc lớn hơn "Sức chứa". Chỉ là tín hiệu báo: lồng không tự chặn vật rơi thêm vào. Nối vào đèn, nắp đậy, hoặc qua Đảo ngược để dừng máy cấp hàng.',
      took: 'Ra: bật đúng một nhịp cho mỗi vật mới vào lồng. Hai vật vào cùng một nhịp thì có hai nhịp bật nối nhau (cách nhau một nhịp tắt), nên nối vào "Tăng 1" của Bộ đếm sẽ đếm đủ. Vật nảy ra rồi rơi vào lại được tính là một lần nhận nữa.',
      first:
        'Ra: một vật đang nằm trong lồng (vật được tạo ra sớm nhất trong số đó); lồng trống thì không có gì. Nối vào "Vật cần thu hồi" của Tạo đối tượng để lấy từng vật ra, hoặc vào "Vật cần đọc" của Đọc mã.',
    },
    params: {
      position:
        'Chỗ đặt lồng, tính bằng mét: x và z là điểm giữa lồng, y là độ cao của mặt đất dưới bánh xe. Mặc định y = 0,5, trùng mặt trên của một Vật thể dày 1 đặt ở y = 0.',
      inside: 'Cạnh trong của lồng (lồng vuông), tính bằng mét, từ 0,3 đến 3. Mặc định 1: sáu thùng carton cỡ 0,32 x 0,26 x 0,28 m nằm gọn. Lồng 0,8 m thì thùng cỡ này dễ chồng cao quá miệng.',
      wall: 'Thành lồng cao bao nhiêu mét tính từ mặt đáy, từ 0,2 đến 3. Mặc định 1. Vật nằm cao hơn miệng lồng không được tính là ở trong.',
      capacity: 'Có bao nhiêu vật thì "Đã đầy" bật, từ 1 đến 24. Mặc định 6. Con số này chỉ để báo đầy: vật thứ 7 rơi vào vẫn nằm trong lồng và vẫn được đếm. Đổi được ngay lúc đang chạy.',
      clearance: 'Khoảng trống dưới đáy lồng, tính bằng mét, từ 0,05 đến 2. Mặc định 0,35: đủ cho một thân robot cao 0,24 m chui xuống gầm.',
      mass: 'Lồng rỗng nặng bao nhiêu kg, từ 0 đến 1000. Mặc định 20. Cân và cảm biến lực đọc con số này; nó không làm lồng chạy nhanh hay chậm.',
      look: 'Hình vẽ của lồng, hai lựa chọn. "Lồng lưới có bánh" (mặc định): thành lưới, bốn bánh nhỏ, nhìn thấy vật bên trong. "Thùng hộp kín": thành phẳng, che vật bên trong. Chỉ đổi hình vẽ: đáy và thành vẫn rắn như nhau.',
      color: 'Màu khung và lưới của lồng (hoặc màu thành của thùng hộp kín). Mặc định xám thép. Đổi được ngay lúc đang chạy.',
    },
    example:
      'Băng chuyền thả thùng vào Lồng chứa. "Số vật bên trong" → Hiện số. "Đã đầy" → Đảo ngược → Và → "Tạo" của Tạo đối tượng, để máy ngừng cấp thùng khi lồng đầy. "Vật bên trong" → "Vật cần thu hồi" và một nút bấm → "Thu hồi" để lấy thùng ra.',
    tips: [
      'Lồng không có cổng vào: nó không tự đổ, không tự xoá vật. Muốn làm trống lồng thì thu hồi từng vật qua "Vật bên trong" bằng mảnh Tạo đối tượng đã tạo ra vật đó (bật "Hiện ô Thu hồi" ở mục Nâng cao).',
      'Lồng không tự chạy. Muốn đưa lồng đi thì dùng mảnh Chốt gài đặt trên một chiếc xe: xe chui xuống gầm lồng, gài rồi chở lồng đi. Các mảnh khác không đưa được lồng: Xi lanh đẩy gặp thành lồng thì dừng sát lại như gặp tường, Bệ di chuyển chạy đi mà không chở lồng theo, Dịch chuyển không nhận lồng.',
      'Bật công tắc "Vật lý thật" để các thùng chồng lên nhau trong lồng. Tắt thì thùng vẫn rơi vào và vẫn được đếm, nhưng các thùng rơi cùng một chỗ sẽ nằm lồng vào nhau, nhìn như một thùng.',
      'Đèn ba màu: So sánh "Số vật bên trong" ≥ 5 cho màu vàng, "Đã đầy" cho màu đỏ, còn lại màu xanh; đưa con số 1, 2, 3 vào "Đặt màu" của một Vật thể kiểu "Đèn tháp ba tầng".',
      'Khi các thùng còn đang lăn, số đếm có thể nhảy qua lại giữa 5 và 6. Muốn khoá chắc khi đã đầy thì cho "Đã đầy" đi qua một Công tắc nhớ.',
      'Thả vật từ trên cao xuống: để miệng lồng nằm ngay dưới chỗ thả. Vật rơi lệch lên mép thành sẽ nằm trên mép hoặc rơi ra ngoài, và không được đếm.',
      'Đổi lòng lồng, chiều cao thành, khoảng hở gầm, khối lượng hay kiểu dáng xong phải bấm Chạy lại; sức chứa và màu đổi được ngay lúc đang chạy.',
      'Ở góc nhìn ngang, lồng hiện thành một lát cắt (đáy và hai thành). Ở góc nhìn từ trên xuống, lồng chỉ là một ô vẽ trên nền: không cản đường, vật nằm trên ô đó được đếm.',
    ],
    lessonId: LESSON,
    tryBoard: tryContainer,
  },
];
