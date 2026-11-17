import type { Board } from '../engine/types';

/** Handbook topic (not a node page): the per-game "Va chạm thật" switch. Plain data so the page text is easy to test. */
export const SOLID_BODIES_TOPIC = 'topic:solid-bodies';

export interface HandbookTopic {
  id: string;
  /** A ready-made board for the "Thử ngay" button; omitted = the page has no try button. */
  tryBoard?: () => Board;
  title: string;
  /** Small label next to the title; omitted = the shared "Công tắc" label. */
  tag?: string;
  intro: string;
  blocks: { heading: string; items: string[] }[];
}

export const SOLID_BODIES_PAGE: HandbookTopic = {
  id: SOLID_BODIES_TOPIC,
  title: 'Va chạm thật',
  intro:
    'Đây là một công tắc của cả game, không phải mảnh ghép. Tắt (kiểu cũ): chỉ tường, khối và xe chặn đường; nhân vật và đồ vật đi xuyên qua nhau. Bật: nhân vật và đồ vật đều là vật đặc, y như trong các màn Xưởng Bot giải đố.',
  blocks: [
    {
      heading: 'Bật / tắt ở đâu',
      items: [
        'Menu Tệp, mục "Cài đặt game", bấm "Va chạm thật".',
        'Hoặc ô tick "Va chạm thật" trong bảng Thuộc tính khi chưa chọn mảnh ghép nào.',
        'Đổi xong thì bấm Chạy: cài đặt có tác dụng từ lần chạy tiếp theo. Đang chạy thì không đổi được.',
        'Game mới tạo bật sẵn. Game mẫu, bài học, ví dụ "Thử ngay" và game cũ đã lưu vẫn tắt, chạy y như trước.',
      ],
    },
    {
      heading: 'Khi bật',
      items: [
        'Nhân vật không đi xuyên qua nhân vật khác, và không đi xuyên qua đồ vật nằm trên sàn. Đồ vật không chui vào đồ vật khác: hai thùng chồng lên nhau chứ không dính vào nhau. Chưa có đẩy: hai bên chỉ chặn nhau.',
        'Món đang cầm là một phần của người cầm: nó bị tường, cửa và vật khác chặn, và chặn luôn người cầm.',
        'Mảnh ghép Vùng không tính món đang được cầm trên tay, chỉ tính món đã đặt xuống.',
        'Rơi xuống vực vẫn chạy như cũ: không bị đưa về chỗ xuất phát, game của bạn tự quyết định thắng hay thua.',
        'Khung va chạm của nhân vật đúng bằng kích thước nhân vật trong game của bạn.',
      ],
    },
    {
      heading: 'Khiêng đồ khi bật (game 3D)',
      items: [
        'Món đồ được cầm thấp ở phía trước người (không còn đội trên đầu), để lúc thả nó không rơi lên đầu chính nhân vật.',
        'Cầm: nhân vật quay mặt về phía món đồ, món đồ bay lên tay. Thùng đang bị thùng khác đè lên thì chưa cầm được.',
        'Thả: món đồ rời tay ngay chỗ tay đang giữ rồi rơi thẳng xuống. "Khoảng cách thả" không còn tác dụng.',
        'Chỗ đó đã có tường, thùng hoặc người thì không thả được: nhân vật vẫn giữ món đồ. Bước sang chỗ trống rồi bấm Thả lại.',
        'Thả trên một thùng khác thì thùng nằm chồng lên đó (xếp chồng).',
      ],
    },
    {
      heading: 'Khiêng đồ khi bật (game 2D)',
      items: [
        'Đồ đang cầm vẫn bị tường chặn, và đồ nằm dưới sàn vẫn không chui vào nhau.',
        'Thả vẫn đặt món đồ cạnh người như trước (theo "Khoảng cách thả"). Chưa có thả-tại-tay và xếp chồng như bản 3D.',
      ],
    },
  ],
};
