import type { HandbookTopic } from './topic-solid-bodies';

/** Handbook topic (not a node page): the per-game "Vật lý thật" switch and the three formulas of the robot drive. */
export const REAL_PHYSICS_TOPIC = 'topic:real-physics';

export const REAL_PHYSICS_PAGE: HandbookTopic = {
  id: REAL_PHYSICS_TOPIC,
  title: 'Vật lý thật',
  intro:
    'Đây là một công tắc của cả game, nằm ngay dưới "Va chạm thật"; không phải mảnh ghép. Tắt (kiểu cũ): robot tăng tốc, quay và dừng theo luật đơn giản, bánh không bao giờ trượt. Bật: robot chạy bằng lực thật: mỗi bánh chỉ kéo được tối đa bằng lực động cơ và độ bám của mặt đất, nên bạn tính trước được bằng tay các số N, kg, μ.',
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
      heading: 'Chưa mô phỏng',
      items: [
        'Dồn trọng lượng lên bánh trước khi phanh hay sau khi tăng tốc: tổng độ bám vẫn là μ × m × 9,81 nên các số ở trên không đổi.',
        'Mọi bánh coi như chịu trọng lượng bằng nhau; hàng chở coi như đặt giữa thân. Robot không bị lật.',
      ],
    },
  ],
};
