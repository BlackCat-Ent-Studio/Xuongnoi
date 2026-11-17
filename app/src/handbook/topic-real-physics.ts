import { tryCrateTipping } from './boards-real-physics';
import type { HandbookTopic } from './topic-solid-bodies';

/** Handbook topic (not a node page): the per-game "Vật lý thật" switch and the three formulas of the robot drive. */
export const REAL_PHYSICS_TOPIC = 'topic:real-physics';

export const REAL_PHYSICS_PAGE: HandbookTopic = {
  id: REAL_PHYSICS_TOPIC,
  title: 'Vật lý thật',
  tryBoard: tryCrateTipping,
  intro:
    'Đây là một công tắc của cả game, nằm ngay dưới "Va chạm thật"; không phải mảnh ghép. Tắt (kiểu cũ): robot tăng tốc, quay và dừng theo luật đơn giản, bánh không bao giờ trượt. Bật: robot chạy bằng lực thật (mỗi bánh chỉ kéo được tối đa bằng lực động cơ và độ bám của mặt đất), thùng và đồ vật nằm trên sàn là vật rắn thật (đổ, chồng, va nhau), trọng lực là số bạn chọn. Nhờ vậy bạn tính trước được bằng tay các số N, kg, μ.',
  blocks: [
    {
      heading: 'Bật / tắt ở đâu',
      items: [
        'Menu Tệp, mục "Cài đặt game", bấm "Vật lý thật". Hoặc ô tick "Vật lý thật" trong bảng Thuộc tính khi chưa chọn mảnh ghép nào.',
        'Đổi xong thì bấm Chạy: cài đặt có tác dụng từ lần chạy tiếp theo. Đang chạy thì không đổi được.',
        'Mặc định tắt, và game cũ, game mẫu, bài học vẫn chạy y như trước. Hai công tắc "Va chạm thật" và "Vật lý thật" độc lập nhau: bật cái nào tùy bạn.',
      ],
    },
    {
      heading: '1. Kéo và trượt (tăng tốc)',
      items: [
        'Mỗi bánh kéo robot với lực F = nhỏ hơn của (lực động cơ, μ × trọng lượng đè lên bánh). Lực động cơ là ô "Lực kéo bánh" (mặc định 6 N). Trọng lượng chia đều cho các bánh: m × 9,81 ÷ số bánh. Tăng tốc a = tổng F ÷ m, m là khối lượng robot cộng hàng đang chở.',
        'Ví dụ 1: robot 2 kg, hai động cơ 6 N, μ = 0,8. Bám tối đa mỗi bánh = 0,8 × 2 × 9,81 ÷ 2 = 7,85 N, lớn hơn 6 N nên động cơ là giới hạn: a = 12 ÷ 2 = 6 m/s². Chở thêm 1 kg: a = 12 ÷ 3 = 4 m/s². Đổi sàn trơn μ = 0,2: bám mỗi bánh chỉ 1,96 N, a = 0,2 × 9,81 = 1,96 m/s², bánh trượt.',
        'Bánh trượt khi động cơ muốn kéo mạnh hơn độ bám cho phép: lúc đó vành bánh quay nhanh hơn mặt đất. Bật "Hiện ô Đang trượt" trên Động cơ để có ô ra "Đang trượt" và "Tốc độ trượt" (m/s, nhanh hơn mặt đất bao nhiêu). Bánh bám tốt thì lăn đúng theo mặt đất.',
        'Robot đẩy thùng cũng không đẩy mạnh hơn độ bám của các bánh: lực đẩy tối đa = tổng min(Lực kéo tối đa, độ bám) của các bánh.',
      ],
    },
    {
      heading: '2. Quay (mô-men quán tính)',
      items: [
        'Hai bánh quay ngược chiều tạo mô-men xoắn T = tổng (F × khoảng cách ngang của bánh tới giữa). Gia tốc quay α = T ÷ I, với I = m × (dài² + rộng²) ÷ 12 (khối hộp quay quanh tâm).',
        'Ví dụ 2: robot 2 kg, dài 1 m, rộng 0,7 m: I = 2 × (1 + 0,49) ÷ 12 = 0,2483 kg·m². Hai bánh đặt cách giữa 0,35 m, mỗi bánh 6 N ngược chiều: T = 2 × 6 × 0,35 = 4,2 N·m, α = 4,2 ÷ 0,2483 = 16,9 rad/s² (khoảng 969 độ/s²). Nặng gấp đôi thì quay chậm đi một nửa.',
        'Không mô phỏng trượt ngang của bánh khi robot quay tại chỗ.',
      ],
    },
    {
      heading: '3. Phanh',
      items: [
        'Khi robot giảm tốc, mỗi bánh hãm với lực F = nhỏ hơn của (lực phanh, μ × trọng lượng đè lên bánh). Ô "Lực phanh" của Động cơ mặc định 0: chỉ phanh bằng ma sát. Phanh bằng ma sát thì a = μ × 9,81 và quãng dừng d = v² ÷ (2 × μ × 9,81): không phụ thuộc khối lượng, y như ngoài đời.',
        'Ví dụ 3: chạy 1 m/s, μ = 0,8, chỉ ma sát: d = 1 ÷ (2 × 0,8 × 9,81) = 0,064 m, robot 2 kg hay 5 kg đều thế. Đặt "Lực phanh" 2 N mỗi động cơ (hai động cơ = 4 N): robot 2 kg có a = 4 ÷ 2 = 2 m/s², d = 1 ÷ (2 × 2) = 0,25 m; robot 5 kg có a = 4 ÷ 5 = 0,8 m/s², d = 1 ÷ (2 × 0,8) = 0,625 m. Nặng hơn thì dừng xa hơn. Nếu lực phanh lớn hơn độ bám thì ma sát quyết định và quãng dừng lại như nhau.',
        'Thả công suất về 0 là bánh bị hãm: robot dừng theo cách trên và bánh coi như đang bị khóa nên có thể báo "Đang trượt" lúc phanh gấp.',
      ],
    },
    {
      heading: '4. Thùng và đồ vật: đổ, chồng, va chạm',
      items: [
        'Khi bật, mọi đồ vật nằm tự do (thùng, hộp, bóng của mảnh ghép Đồ vật hoặc Tạo đối tượng) là vật rắn thật: chúng đổ, lăn, chồng lên nhau, va vào nhau, vào tường, sàn, băng chuyền và robot. Tắt thì đồ vật chạy y như trước: không lật, không đè nhau.',
        'Khối lượng và ma sát của thùng lấy từ ô "Khối lượng" và "Hệ số ma sát bề mặt" (mục Nâng cao của mảnh ghép tạo ra nó). Khi bật, ô "Độ trượt" không dùng nữa: thùng trượt theo ma sát thật, lực cản = μ × m × 9,81. Ô "Độ nảy" vẫn dùng.',
        'Ví dụ 4, đẩy cao thì đổ, đẩy thấp thì trượt: thùng 10 kg, cao 1,2 m, rộng 0,4 m, μ = 0,5. Trượt khi lực đẩy F ≥ μ × m × 9,81 = 49,05 N. Đổ khi F × độ cao đẩy ≥ m × 9,81 × (rộng ÷ 2) = 19,62 N·m. Đẩy ở 1,1 m: đổ khi F ≥ 17,8 N, nhỏ hơn 49,05 N nên thùng đổ trước khi kịp trượt. Đẩy ở 0,15 m: đổ cần F ≥ 130,8 N, lớn hơn nhiều nên thùng chỉ trượt. Bấm "Thử ngay" để xem hai thùng này.',
        'Thùng đang trượt mà bị chặn lại cũng có thể đổ: khi μ lớn hơn (rộng ÷ 2) ÷ (độ cao khối tâm), ở đây 0,2 ÷ 0,6 = 0,33 và μ = 0,5, ma sát dưới đáy làm nó chúi tới. Đẩy nhanh vào đỉnh thùng thì đổ dù lực không lớn; muốn đẩy mà không đổ thì đẩy thấp và chậm.',
        'Robot đẩy thùng vẫn bị giới hạn lực như cũ: thùng cần F = μ × m × 9,81 mà tổng lực đẩy của các bánh (nhỏ hơn của lực động cơ và độ bám) không đủ thì robot đứng lại, thùng không nhúc nhích. Piston, cánh tay và bệ trượt vẫn đẩy thùng theo cách cũ của chúng (có giới hạn lực, nhưng đẩy tới đâu thùng ở tới đó, không có đà).',
        'Băng chuyền kéo thùng bằng ma sát: thùng nhanh dần với a = μ × 9,81 cho tới khi bằng tốc độ băng. Thùng chạm tường cuối thì dừng và băng trượt dưới nó. Tay kẹp: thùng đang được kẹp hay đang khiêng thì rời khỏi mô phỏng, thả ra thì rơi tiếp từ chỗ đó.',
      ],
    },
    {
      heading: 'Trọng lực',
      items: [
        'Ô "Trọng lực (m/s²)" nằm ngay dưới công tắc "Vật lý thật" trong bảng Thuộc tính (khi chưa chọn mảnh ghép nào). Mặc định 9,81 (Trái Đất); Mặt Trăng 1,62; điền 0 thì mọi thứ lơ lửng. Chỉ có tác dụng khi bật "Vật lý thật", từ lần Chạy sau.',
        'Trọng lực này kéo mọi thứ rơi: nhân vật, xe, robot và thùng. Tắt "Vật lý thật" thì vẫn là trọng lực cũ như trước (30), game cũ không đổi. Game đã lưu mà chưa có ô này đọc là 9,81.',
        'Ví dụ 5: thả thùng từ độ cao h = 4,905 m (tâm thùng cách sàn 4,905 m). Rơi h = g × t² ÷ 2 nên t = căn(2 × h ÷ g). Trái Đất g = 9,81: t = 1 giây. Mặt Trăng g = 1,62: t = 2,46 giây.',
      ],
    },
    {
      heading: 'Chưa mô phỏng',
      items: [
        'Dồn trọng lượng lên bánh trước khi phanh hay sau khi tăng tốc: tổng độ bám vẫn là μ × m × 9,81 nên các số ở trên không đổi.',
        'Mọi bánh coi như chịu trọng lượng bằng nhau; hàng chở coi như đặt giữa thân. Robot không bị lật.',
        'Thùng chỉ chạm thân robot, xe và khối (hộp bao quanh), không chạm bánh riêng lẻ. Băng chuyền chỉ kéo thùng bằng ma sát: không có lực kéo riêng. Chưa có ma sát lăn: quả bóng lăn mãi trên sàn phẳng. Đạn bắn ra không thuộc mô phỏng này.',
      ],
    },
  ],
};
