/** Pure search helpers for the palette: diacritic-insensitive matching with synonyms. */

/** Lower-case, strip Vietnamese diacritics (NFD + đ -> d) and collapse whitespace. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extra words people type for a block, keyed by node kind. Matched after normalizing. */
export const PALETTE_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  character: ['mèo', 'người chơi', 'nhân vật chính', 'player', 'nhan vat'],
  item: ['xu', 'đồng xu', 'vật phẩm', 'tiền', 'coin', 'thu thập'],
  block: ['hộp', 'thùng', 'tường', 'sàn', 'bục'],
  key: ['nút', 'bàn phím', 'nhấn phím'],
  stick: ['joystick', 'điều khiển', 'mũi tên', 'wasd'],
  touch: ['chạm', 'va chạm', 'đụng'],
  zone: ['vùng', 'khu vực'],
  health: ['hp', 'sinh mệnh', 'thanh máu', 'tim'],
  fight: ['chiến đấu', 'tấn công', 'đánh'],
  shooter: ['súng', 'bắn', 'đạn'],
  patrol: ['tuần tra', 'đi qua đi lại'],
  chase: ['đuổi', 'trốn', 'kẻ địch', 'quái'],
  timer: ['đếm ngược', 'thời gian', 'giờ'],
  counter: ['điểm', 'đếm', 'tính điểm'],
  'win-lose': ['chiến thắng', 'thua cuộc', 'kết thúc', 'hết game'],
  'show-number': ['điểm số', 'hiển thị số'],
  'show-text': ['hiển thị chữ', 'thông báo', 'văn bản'],
  'guide-arrow': ['mũi tên', 'chỉ đường', 'hướng dẫn', 'la bàn', 'khoảng cách'],
  camera: ['góc nhìn', 'máy ảnh'],
  portal: ['cổng', 'dịch chuyển'],
  spawner: ['sinh ra', 'tạo ra', 'xuất hiện'],
  vehicle: ['xe', 'lái xe', 'ô tô'],
  'select-number': ['switch', 'chọn', 'chọn theo số', 'lựa chọn', 'menu', 'phân nhánh'],
  random: ['ngẫu nhiên', 'may rủi', 'xúc xắc'],
  math: ['cộng', 'trừ', 'nhân', 'chia', 'toán'],
  compare: ['lớn hơn', 'nhỏ hơn', 'bằng nhau'],
  and: ['cả hai', 'và'],
  or: ['một trong hai', 'hoặc'],
  not: ['đảo ngược', 'phủ định'],
  'on-start': ['bắt đầu', 'khởi động', 'mở đầu'],
};

export interface SearchItem {
  kind: string;
  title: string;
  description: string;
}

/** Items matching every word of `query`, title matches first, then description/synonym matches. */
export function searchItems<T extends SearchItem>(
  items: readonly T[],
  query: string,
  synonyms: Readonly<Record<string, readonly string[]>> = PALETTE_SYNONYMS,
): T[] {
  const q = normalizeText(query);
  if (!q) return [...items];
  const words = q.split(' ');
  const scored: { item: T; score: number; index: number }[] = [];
  items.forEach((item, index) => {
    const title = normalizeText(item.title);
    const rest = normalizeText(`${item.description} ${(synonyms[item.kind] ?? []).join(' ')} ${item.kind}`);
    const all = `${title} ${rest}`;
    if (!words.every((w) => all.includes(w))) return;
    let score = 1;
    if (title === q) score = 4;
    else if (title.startsWith(q)) score = 3;
    else if (title.includes(q)) score = 2.5;
    else if (words.every((w) => title.includes(w))) score = 2;
    scored.push({ item, score, index });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((s) => s.item);
}
