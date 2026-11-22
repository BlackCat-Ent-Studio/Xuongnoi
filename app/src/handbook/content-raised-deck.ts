import { tryRaisedDeck } from './boards-raised-deck';
import type { HandbookEntry } from './types';

/** No lesson teaches the deck yet: the page shows no lesson button until a lesson with this id is registered. */
const LESSON = 'raised-deck';

/** Handbook page of the raised deck with holes. */
export const HANDBOOK_RAISED_DECK: readonly HandbookEntry[] = [
  {
    kind: 'raised-deck',
    purpose:
      'Một tầng sàn thép đặt trên cao, có các lỗ vuông xếp thành hàng và cột. Robot chạy trên mặt sàn như chạy trên mặt đất; vật thả vào lỗ thì rơi xuống tầng dưới.',
    whenToUse:
      'Khi xưởng cần hai tầng: robot phân loại chạy ở tầng trên và thả kiện hàng qua lỗ xuống thùng hứng ở tầng dưới; hoặc khi cần một sàn cao có chỗ trống để thả đồ, để tay máy thò xuống, để xe ở dưới chạy ngang qua.',
    ports: {
      self: 'Ra: tấm sàn đầu tiên của sàn nâng (dải sàn nằm trước hàng lỗ đầu tiên). Nối vào bất cứ chỗ nào cần một "Đối tượng", ví dụ Đo khoảng cách.',
    },
    params: {
      position:
        'Chỗ đặt sàn, tính bằng mét: x và z là điểm giữa sàn, y là độ cao của mặt đất bên dưới (chỗ chân trụ đứng). Mặc định y = 0,5, trùng mặt trên của một Vật thể dày 1 đặt ở y = 0.',
      top: 'Mặt trên của sàn cao hơn mặt đất bên dưới bao nhiêu mét, từ 0,3 đến 20. Mặc định 2,6. Robot đặt lên sàn phải có "Vị trí xuất hiện" cao hơn con số này.',
      holeCols: 'Số lỗ xếp theo trục X, từ 1 đến 5. Mặc định 1.',
      holeRows: 'Số lỗ xếp theo trục Z, từ 1 đến 5. Mặc định 1. Ví dụ 3 và 3 cho sàn 9 lỗ.',
      hole: 'Cạnh của mỗi lỗ vuông, tính bằng mét, từ 0,3 đến 3. Mặc định 0,7: vừa cho một thùng carton nhỏ rơi qua.',
      pitch:
        'Khoảng cách từ tâm lỗ này tới tâm lỗ bên cạnh, tính bằng mét. Mặc định 2. Lối đi giữa hai lỗ rộng bằng số này trừ đi "Cạnh lỗ" (2 - 0,7 = 1,3 m). Số nhỏ quá thì sàn tự giữ lại ít nhất 10 cm sàn giữa hai lỗ.',
      margin: 'Phần sàn từ mép lỗ ngoài cùng ra tới mép sàn, tính bằng mét, từ 0,1 đến 10. Mặc định 1,3: bằng một lối đi. Sàn tự rộng ra theo số lỗ, khoảng cách và lề.',
      thickness: 'Bề dày của tấm sàn, tính bằng mét, từ 0,05 đến 1. Mặc định 0,2.',
      color: 'Màu mặt sàn. Mặc định xám thép. Đổi được ngay lúc đang chạy. Viền vàng, viền xanh và chân trụ giữ màu riêng.',
      legs: 'Có vẽ chân trụ quanh mép sàn hay không. Chân trụ chỉ là hình vẽ: robot và thùng hàng đi xuyên qua được. Cần cột thật thì đặt thêm Vật thể.',
    },
    example:
      'Đặt một Vật thể làm mặt đất, đặt Sàn nâng có lỗ phía trên. Thân robot có "Vị trí xuất hiện" cao hơn mặt sàn; Đi tới điểm lái robot dọc lối đi cạnh lỗ; khay nghiêng đổ thùng hàng vào lỗ; một Vùng đặt dưới lỗ đếm thùng rơi xuống.',
    tips: [
      'Sàn chỉ là các tấm rắn ghép lại, giống Vật thể: 1 lỗ là 4 tấm, 3 x 3 lỗ là 16 tấm. Cái gì dùng được với Vật thể thì dùng được với sàn.',
      'Đổi số lỗ, cạnh lỗ, khoảng cách, lề, độ cao hay bề dày xong phải bấm Chạy lại; chỉ có màu đổi được ngay lúc đang chạy.',
      'Thùng rơi xuống nền trống sẽ trượt đi xa. Muốn thùng nằm lại dưới lỗ thì quây bốn Vật thể làm thành hứng ở tầng dưới.',
      'Cho robot đi trên lối đi giữa các lỗ: lối đi rộng bằng "Khoảng cách giữa hai lỗ" trừ "Cạnh lỗ", nên để rộng hơn chiều dài robot để robot quay đầu được.',
      'Sàn dùng cho góc nhìn 3D. Ở góc nhìn ngang chỉ thấy một lát cắt qua hàng lỗ giữa; ở góc nhìn từ trên xuống sàn chỉ là hình vẽ, không cản đường.',
    ],
    lessonId: LESSON,
    tryBoard: tryRaisedDeck,
  },
];
