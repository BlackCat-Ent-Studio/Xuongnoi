/** Vietnamese texts of the "Bot cầm cuốc" lesson. */
export const BOT_TOOL_TEXT = {
  title: '16. Bot cầm cuốc',
  summary: 'Dạy con bot tự đi nhặt cái cuốc, cầm lên tay rồi đập vỡ tảng đá chắn đường.',
  boardName: 'Bài 16 - Bot cầm cuốc',
  intro: {
    title: 'Bot cũng cầm được dụng cụ',
    text: 'Bảng này có một con bot, một cái cuốc nằm trên đất và một tảng đá chắn đường. Ta sẽ dạy bot đi tới cuốc, cầm lên tay, đi tới đá rồi đập vỡ nó.',
    explain: 'Mảnh ghép "Cầm dụng cụ" làm việc với mọi nhân vật, kể cả bot. Bot chỉ cần được "ra lệnh" bằng các mảnh ghép thay vì bấm phím.',
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
    title: 'Thêm Chuỗi bước',
    text: 'Kéo mảnh ghép "Chuỗi bước" (nhóm Bộ não) vào bảng.',
    explain: 'Chuỗi bước làm lần lượt từng bước. Bước 1 là đi tới cuốc, bước 2 là đi tới đá. Hai mảnh ghép "Di chuyển" đã có sẵn trên bảng.',
  },
  step1: {
    title: 'Bước 1: đi tới cuốc',
    text: 'Nối "Bước 1" của Chuỗi bước sang cổng "Bật" của mảnh ghép Di chuyển đang dẫn bot về phía cái cuốc (cái đứng gần bot hơn).',
    explain: '"Bật" là công tắc: mảnh ghép Di chuyển chỉ làm việc khi nó bật.',
  },
  step2: {
    title: 'Bước 2: đi tới đá',
    text: 'Nối "Bước 2" của Chuỗi bước sang cổng "Bật" của mảnh ghép Di chuyển còn lại (dẫn bot về phía tảng đá).',
  },
  next: {
    title: 'Xong bước này thì sang bước kế',
    text: 'Nối cổng "Kết quả" của mảnh ghép Hoặc sang cổng "Sang bước kế" của Chuỗi bước.',
    explain: 'Mảnh ghép Hoặc gom hai tín hiệu "Khi đến nơi". Mỗi lần bot tới nơi, Chuỗi bước chuyển sang bước kế tiếp.',
  },
  hand: {
    title: 'Thêm mảnh ghép Cầm dụng cụ',
    text: 'Kéo mảnh ghép "Cầm dụng cụ" (nhóm Hành động) vào bảng.',
    explain: 'Cầm dụng cụ nhặt món dụng cụ ở gần nhất lên tay, hoặc cất xuống. Nó cũng vung tay để dùng dụng cụ.',
  },
  handWho: {
    title: 'Nói bot sẽ cầm',
    text: 'Nối cổng "Đối tượng" của con bot sang cổng "Nhân vật" của mảnh ghép Cầm dụng cụ.',
  },
  handToggle: {
    title: 'Tới cuốc thì cầm lên',
    text: 'Nối "Khi đến nơi" của mảnh ghép Di chuyển (về phía cuốc) sang cổng "Cầm / Cất (cũ)" của Cầm dụng cụ.',
    explain: 'Khi bot vừa tới chỗ cuốc, mảnh ghép nhận một nhịp và bot nhặt cuốc lên tay.',
  },
  handUse: {
    title: 'Tới đá thì vung cuốc',
    text: 'Nối "Khi đến nơi" của mảnh ghép Di chuyển (về phía đá) sang cổng "Dùng" của Cầm dụng cụ.',
    explain: 'Khi bot vừa tới chỗ đá, nó vung cuốc. Thứ nằm ngay phía trước bot sẽ nhận tín hiệu "Khi bị dùng lên".',
  },
  and: {
    title: 'Chỉ cuốc mới đập được đá',
    text: 'Kéo mảnh ghép "Và" (nhóm Logic) vào bảng.',
    explain: 'Mảnh ghép "Và" chỉ bật khi cả hai đầu vào cùng bật: đá vừa bị dùng lên, và cái cuốc đang ở trên tay bot.',
  },
  rockUsed: {
    title: 'Đá vừa bị dùng lên',
    text: 'Nối cổng "Khi bị dùng lên" của Vật thể tảng đá (hộp xám cao) sang cổng "A" của mảnh ghép Và.',
  },
  inHand: {
    title: 'Cuốc đang ở trên tay',
    text: 'Nối cổng "Đang cầm" của cái cuốc sang cổng "B" của mảnh ghép Và.',
  },
  rockHide: {
    title: 'Đá bị đập thì vỡ',
    text: 'Nối cổng "Kết quả" của mảnh ghép Và sang cổng "Ẩn" của Vật thể tảng đá.',
    explain: 'Đá bị "ẩn đi" thì biến mất, đường được thông.',
  },
  end: {
    title: 'Thêm mảnh ghép Thắng / Thua',
    text: 'Kéo mảnh ghép "Thắng / Thua" (nhóm Kết quả) vào bảng.',
  },
  win: {
    title: 'Đá vỡ là thắng',
    text: 'Nối cổng "Kết quả" của mảnh ghép Và sang cổng "Thắng" của mảnh ghép Thắng / Thua.',
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
