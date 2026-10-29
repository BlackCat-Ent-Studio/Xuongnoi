/** Vietnamese texts of the "Bot cầm cuốc" lesson. */
export const BOT_TOOL_TEXT = {
  title: '16. Bot cầm cuốc',
  summary: 'Dạy con bot tự đi nhặt cái cuốc, cầm lên tay rồi đập vỡ tảng đá chắn đường.',
  boardName: 'Bài 16 - Bot cầm cuốc',
  intro: {
    title: 'Bot cũng cầm được dụng cụ',
    text: 'Bảng này có một con bot, một cái cuốc nằm trên đất và một tảng đá chắn đường. Ta sẽ dạy bot đi tới cuốc, cầm lên tay, đi tới đá rồi đập vỡ nó.',
    explain: 'Mảnh ghép "Cầm tay" làm việc với mọi nhân vật, kể cả bot. Bot chỉ cần được "ra lệnh" bằng các mảnh ghép thay vì bấm phím.',
  },
  watch: {
    title: 'Xem thử trước',
    text: 'Bấm "Chơi". Bot đứng yên vì chưa ai bảo nó làm gì.',
  },
  edit: {
    title: 'Quay lại sửa',
    text: 'Bấm nút "Dừng" để làm tiếp.',
  },
  sequence: {
    title: 'Thêm Chuỗi việc',
    text: 'Kéo mảnh ghép "Chuỗi việc" (nhóm Bộ não) vào bảng.',
    explain: 'Chuỗi việc làm lần lượt từng việc. Việc 1 là đi tới cuốc, việc 2 là đi tới đá. Hai mảnh ghép "Đi tới" đã có sẵn trên bảng.',
  },
  step1: {
    title: 'Việc 1: đi tới cuốc',
    text: 'Nối "Việc 1" của Chuỗi việc sang cổng "Cho đi" của mảnh ghép Đi tới đang dẫn bot về phía cái cuốc (cái đứng gần bot hơn).',
    explain: '"Cho đi" là công tắc: mảnh ghép Đi tới chỉ làm việc khi nó bật.',
  },
  step2: {
    title: 'Việc 2: đi tới đá',
    text: 'Nối "Việc 2" của Chuỗi việc sang cổng "Cho đi" của mảnh ghép Đi tới còn lại (dẫn bot về phía tảng đá).',
  },
  next: {
    title: 'Xong việc thì làm việc tiếp',
    text: 'Nối cổng "Kết quả" của mảnh ghép Hoặc sang cổng "Xong việc" của Chuỗi việc.',
    explain: 'Mảnh ghép Hoặc gom hai tín hiệu "Vừa tới". Mỗi lần bot tới nơi, Chuỗi việc chuyển sang việc kế tiếp.',
  },
  hand: {
    title: 'Thêm mảnh ghép Cầm tay',
    text: 'Kéo mảnh ghép "Cầm tay" (nhóm Hành động) vào bảng.',
    explain: 'Cầm tay nhặt món dụng cụ ở gần nhất lên tay, hoặc cất xuống. Nó cũng vung tay để dùng dụng cụ.',
  },
  handWho: {
    title: 'Nói bot sẽ cầm',
    text: 'Nối cổng "Nhân vật" của con bot sang cổng "Nhân vật" của mảnh ghép Cầm tay.',
  },
  handToggle: {
    title: 'Tới cuốc thì cầm lên',
    text: 'Nối "Vừa tới" của mảnh ghép Đi tới (về phía cuốc) sang cổng "Cầm/Cất" của Cầm tay.',
    explain: 'Khi bot vừa tới chỗ cuốc, mảnh ghép nhận một nhịp và bot nhặt cuốc lên tay.',
  },
  handUse: {
    title: 'Tới đá thì vung cuốc',
    text: 'Nối "Vừa tới" của mảnh ghép Đi tới (về phía đá) sang cổng "Dùng" của Cầm tay.',
    explain: 'Khi bot vừa tới chỗ đá, nó vung cuốc. Thứ nằm ngay phía trước bot sẽ nhận tín hiệu "Vừa bị dùng lên".',
  },
  and: {
    title: 'Chỉ cuốc mới đập được đá',
    text: 'Kéo mảnh ghép "Và" (nhóm Logic) vào bảng.',
    explain: 'Mảnh ghép "Và" chỉ bật khi cả hai đầu vào cùng bật: đá vừa bị dùng lên, và cái cuốc đang ở trên tay bot.',
  },
  rockUsed: {
    title: 'Đá vừa bị dùng lên',
    text: 'Nối cổng "Vừa bị dùng lên" của Hộp tảng đá (hộp xám cao) sang cổng "A" của mảnh ghép Và.',
  },
  inHand: {
    title: 'Cuốc đang ở trên tay',
    text: 'Nối cổng "Đang ở trên tay" của cái cuốc sang cổng "B" của mảnh ghép Và.',
  },
  rockHide: {
    title: 'Đá bị đập thì vỡ',
    text: 'Nối cổng "Kết quả" của mảnh ghép Và sang cổng "Ẩn đi" của Hộp tảng đá.',
    explain: 'Đá bị "ẩn đi" thì biến mất, đường được thông.',
  },
  end: {
    title: 'Thêm mảnh ghép Thắng/Thua',
    text: 'Kéo mảnh ghép "Thắng/Thua" (nhóm Kết quả) vào bảng.',
  },
  win: {
    title: 'Đá vỡ là thắng',
    text: 'Nối cổng "Kết quả" của mảnh ghép Và sang cổng "Thắng" của mảnh ghép Thắng/Thua.',
  },
  play: {
    title: 'Chạy thử',
    text: 'Bấm "Chơi" và xem bot đi nhặt cuốc, cầm lên tay rồi đập vỡ tảng đá.',
  },
  won: {
    title: 'Chờ bot đập đá',
    text: 'Cứ để bot tự làm. Khi tảng đá vỡ, trò chơi báo thắng.',
  },
  done: {
    title: 'Bot làm thợ đá giỏi quá!',
    text: 'Bạn đã dạy bot đi tới dụng cụ, cầm lên tay và dùng nó. Hãy thử đổi cái cuốc thành thanh kiếm, hoặc đặt thêm tảng đá nữa.',
  },
} as const;
