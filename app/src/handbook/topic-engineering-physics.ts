import type { HandbookTopic } from './topic-solid-bodies';

/** Handbook topic (not a node page): the real quantities (kg, N, friction, torque) that machines are built from. */
export const ENGINEERING_PHYSICS_TOPIC = 'topic:engineering-physics';

export const ENGINEERING_PHYSICS_PAGE: HandbookTopic = {
  id: ENGINEERING_PHYSICS_TOPIC,
  title: 'Vật lý kỹ thuật',
  tag: 'Kiến thức',
  intro:
    'Các mảnh ghép máy móc dùng số đo thật như ngoài đời: kilôgam (kg), niutơn (N), hệ số ma sát, mô-men (N·m). Nhờ vậy bạn trả lời được câu hỏi thật: cánh tay này nhấc được bao nhiêu kg, kẹp bao nhiêu lực thì thùng không tuột, ép mạnh quá thì thùng có hỏng không. Mục "Nâng cao" của Vật thể, Đồ vật, Nhân vật và Xe có ba ô vật liệu: Khối lượng, Hệ số ma sát và Lực chịu nén. Để nguyên mặc định thì game chạy y như trước.',
  blocks: [
    {
      heading: 'Kilôgam (kg) khác niutơn (N)',
      items: [
        'Khối lượng (kg) là "bao nhiêu chất" trong vật; mang đi đâu cũng không đổi. Trọng lượng (N) là lực mà Trái Đất kéo vật xuống: W = m × g, với g = 9,81.',
        'Ví dụ: thùng 5 kg nặng 5 × 9,81 = 49,05 N. Thùng 1 kg nặng khoảng 9,8 N (gần 10 N).',
        'Mảnh Cảm biến lực / Cân đọc cả hai: "Khối lượng (kg)" và "Lực (N)".',
      ],
    },
    {
      heading: 'Ma sát và lực kẹp',
      items: [
        'Ma sát: lực cản khi hai mặt cọ vào nhau. F ma sát = μ × lực ép. μ (đọc là "muy") là hệ số ma sát: 0 là trơn như băng, 0,5 là bình thường, 1,5 là rất nhám như cao su.',
        'Càng kẹp có 2 ngón ép hai bên thùng. Hai bên cùng giữ, nên thùng không tuột khi: 2 × μ × F ≥ m × g. F là lực ép của mỗi ngón (N).',
        'Ví dụ: thùng 5 kg, μ = 0,5, hai ngón: F ≥ 49,05 / (2 × 0,5) = 49,05 N. Lực kẹp nhỏ hơn thì thùng tuột; bề mặt trơn hơn (μ nhỏ) thì phải kẹp mạnh hơn.',
        'Nhấc nhanh lên cũng cần kẹp chặt hơn, vì thùng vừa nặng vừa phải tăng tốc: 2 × μ × F ≥ m × (g + a).',
      ],
    },
    {
      heading: 'Kẹp quá mạnh thì hỏng',
      items: [
        '"Lực chịu nén tối đa" (N) là lực ép lớn nhất mà vật chịu được. Ép mạnh hơn thì vật bị hỏng: nó bị bẹp xuống và ngả màu đỏ sẫm, và hỏng luôn cho đến khi chơi lại.',
        'Để 0 nghĩa là vật không bao giờ hỏng (mặc định).',
        'Vì vậy kẹp phải đủ mạnh để không tuột, nhưng không quá mạnh để không làm hỏng: lực kẹp tốt nằm giữa hai mức đó.',
      ],
    },
    {
      heading: 'Mô-men và sức nâng của khớp',
      items: [
        'Mô-men (N·m) là "lực xoay" của động cơ khớp: mô-men = lực × cánh tay đòn (khoảng cách tới trục xoay).',
        'Muốn giữ một vật nặng ở xa trục thì cần mô-men lớn: mô-men cần ≥ m × g × L, với L là khoảng cách (m). Cánh tay duỗi ngang là khó nhất; ngẩng lên thẳng đứng thì gần như không tốn mô-men.',
        'Ví dụ: khớp 30 N·m, vật cách trục 0,5 m: m ≤ 30 / (9,81 × 0,5) = 6,1 kg. Vật cách 1 m thì chỉ nhấc được khoảng 3 kg.',
        'Các đoạn tay của chính cánh tay cũng nặng, và cũng đè lên khớp: cộng chúng vào trước khi tính phần còn lại cho vật cần nhấc.',
      ],
    },
    {
      heading: 'Khiêng đồ theo cân nặng',
      items: [
        'Mảnh Khiêng đồ có ô "Sức nâng tối đa (kg)" trong mục Nâng cao. Để 0 là nhấc được mọi thứ như cũ. Đặt 10 thì món nặng hơn 10 kg không nhấc nổi.',
        'Bật "Báo quá nặng" để có ô ra "Quá nặng": nó bật khi bạn định nhấc món quá nặng, dùng để hiện chữ hoặc kêu lên.',
      ],
    },
  ],
};
