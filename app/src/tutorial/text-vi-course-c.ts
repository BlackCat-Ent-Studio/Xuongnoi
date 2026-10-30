/** Vietnamese texts of the lessons in course pack C (numbers and on-screen interface). */

export const HEALTH_COLOR_TEXT = {
  title: 'Thanh máu đổi màu',
  summary: 'Cho nhân vật có máu, vẽ thanh máu và hiện cảnh báo khi máu xuống thấp.',
  boardName: 'Thanh máu đổi màu',
  intro: {
    title: 'Bị bắn thì máu tụt',
    text: 'Bảng này có sẵn bạn (xanh), sàn nhà và một tháp bắn (rô-bốt cam) đứng bên phải, cứ 2 giây bắn một viên đạn vào bạn. Ta sẽ cho bạn có máu, vẽ thanh máu và hiện cảnh báo khi máu thấp.',
    explain: 'Con số là thứ dễ làm nhiều việc nhất: nối cùng một số máu vào nhiều mảnh ghép khác nhau.',
  },
  addHealth: {
    title: 'Thêm mảnh ghép Máu',
    text: 'Kéo mảnh ghép "Máu" (nhóm Hành động) vào bảng.',
    explain: 'Nhân vật chỉ bị đau khi có mảnh ghép Máu. Cổng "Máu còn" cho ta con số máu hiện tại.',
  },
  maxHp: {
    title: 'Chỉ cho 3 máu',
    text: 'Chọn mảnh ghép Máu, ở Thuộc tính đổi "Máu tối đa" thành 3.',
    explain: 'Máu 3 → 2 → 1 → 0 nên ta chia được thành 3 mức: khoẻ, yếu, sắp gục.',
  },
  wireSelf: {
    title: 'Máu này là máu của bạn',
    text: 'Nối cổng "Nhân vật" của nhân vật xanh (bạn) sang cổng "Nhân vật" của mảnh ghép Máu.',
  },
  addMeter: {
    title: 'Thêm Thanh đo',
    text: 'Kéo mảnh ghép "Thanh đo" (nhóm Kết quả) vào bảng.',
    explain: 'Thanh đo vẽ một con số thành thanh dài ngắn. Mặc định thanh rỗng ở 0 và đầy ở 100.',
  },
  addMap: {
    title: 'Thêm mảnh ghép Đổi thang số',
    text: 'Kéo mảnh ghép "Đổi thang số" (nhóm Tính toán) vào bảng.',
    explain: 'Máu chạy từ 0 đến 3 nhưng thanh đo cần 0 đến 100. Đổi thang số kéo giãn con số từ thang này sang thang kia.',
  },
  mapScale: {
    title: 'Báo thang cũ là 0 đến 3',
    text: 'Chọn mảnh ghép Đổi thang số, ở Thuộc tính đổi "Thang cũ: đến" thành 3. Thang mới giữ nguyên 0 đến 100.',
    explain: 'Máu 3 thành 100, máu 2 thành 67, máu 1 thành 33, máu 0 thành 0.',
  },
  wireHpMap: {
    title: 'Máu vào Đổi thang số',
    text: 'Nối cổng "Máu còn" của mảnh ghép Máu sang cổng "Số vào" của Đổi thang số.',
  },
  wireMapMeter: {
    title: 'Thang mới vào Thanh đo',
    text: 'Nối cổng "Số ra" của Đổi thang số sang cổng "Số cần đo" của Thanh đo.',
  },
  addSelect: {
    title: 'Thêm mảnh ghép Chọn theo số',
    text: 'Kéo mảnh ghép "Chọn theo số" (nhóm Logic) vào bảng.',
    explain: 'Nó nhận một số và bật đúng một cổng: số 1 bật "Là 1", số 2 bật "Là 2", số 3 bật "Là 3". Mặc định có 3 lựa chọn.',
  },
  wireHpSelect: {
    title: 'Máu vào Chọn theo số',
    text: 'Nối cổng "Máu còn" của mảnh ghép Máu sang cổng "Số" của Chọn theo số.',
    explain: 'Còn 1 máu thì "Là 1" bật, còn 3 máu thì "Là 3" bật.',
  },
  addText: {
    title: 'Thêm Hiện chữ',
    text: 'Kéo mảnh ghép "Hiện chữ" (nhóm Kết quả) vào bảng.',
  },
  textWords: {
    title: 'Viết lời cảnh báo',
    text: 'Chọn mảnh ghép Hiện chữ, ở Thuộc tính đổi "Chữ" thành lời cảnh báo, ví dụ "Sắp gục rồi!".',
  },
  wireWarn: {
    title: 'Chỉ cảnh báo khi còn 1 máu',
    text: 'Nối cổng "Là 1" của Chọn theo số sang cổng "Hiện" của Hiện chữ.',
    explain: 'Lời cảnh báo ẩn đi, chỉ hiện đúng lúc còn 1 máu.',
  },
  wireDead: {
    title: 'Hết máu là thua',
    text: 'Nối cổng "Hết máu" của mảnh ghép Máu sang cổng "Thua" của mảnh ghép Thắng/Thua.',
  },
  play: {
    title: 'Xem máu tụt',
    text: 'Bấm "Chơi" và đứng yên. Mỗi viên đạn trúng làm thanh đo ngắn lại, còn 1 máu thì lời cảnh báo hiện lên.',
    explain: 'Lần này bạn cứ đứng yên để bị bắn, cho thấy rõ thanh máu tụt và lời cảnh báo hiện lên.',
  },
  lost: {
    title: 'Hết máu rồi',
    text: 'Chơi tới khi bạn hết máu. Nếu muốn xem lại, bấm "Chơi lại" trên bảng kết quả.',
  },
  done: {
    title: 'Bạn biết đổi số thành hình rồi!',
    text: 'Đổi thang số biến máu thành thanh đo, Chọn theo số biến máu thành các mức để làm việc khác nhau. Thử thêm mảnh ghép "Hộp" và nối "Là 1/2/3" để đổi màu đèn báo.',
  },
} as const;

export const START_SCREEN_TEXT = {
  title: 'Màn hình bắt đầu',
  summary: 'Làm màn hình mở đầu cho game, nút bấm mở cửa, và đồng hồ chỉ chạy sau khi bấm bắt đầu.',
  boardName: 'Màn hình bắt đầu',
  intro: {
    title: 'Game có màn hình mở đầu',
    text: 'Bảng này có sẵn bạn, sàn nhà, một cánh cửa gỗ chắn đường và ngôi sao ở bên phải. Chạm ngôi sao là thắng. Ta sẽ thêm màn hình bắt đầu, nút mở cửa và đồng hồ đếm ngược.',
    explain: 'Game thật thường có màn hình tên game và nút "Bấm để chơi". Làm vậy người chơi có thời gian sẵn sàng.',
  },
  addStart: {
    title: 'Thêm Màn hình bắt đầu',
    text: 'Kéo mảnh ghép "Màn hình bắt đầu" (nhóm Đầu vào) vào bảng.',
    explain: 'Cổng "Đã bắt đầu" tắt cho tới khi người chơi bấm nút, rồi bật mãi. Nối nó vào mảnh ghép khác để chỉ chạy sau khi bắt đầu.',
  },
  startTitle: {
    title: 'Đặt tên game',
    text: 'Chọn Màn hình bắt đầu, ở Thuộc tính đổi "Tên game" thành tên bạn thích.',
  },
  addButton: {
    title: 'Thêm Nút trên màn hình',
    text: 'Kéo mảnh ghép "Nút trên màn hình" (nhóm Đầu vào) vào bảng.',
    explain: 'Nút nằm ở góc màn hình game. Mỗi lần bấm, cổng "Vừa bấm" bật một nhịp.',
  },
  buttonText: {
    title: 'Đặt chữ cho nút',
    text: 'Chọn Nút trên màn hình, ở Thuộc tính đổi "Chữ trên nút" thành "Mở cửa".',
  },
  wireDoor: {
    title: 'Bấm nút để mở cửa',
    text: 'Nối cổng "Vừa bấm" của Nút trên màn hình sang cổng "Ẩn đi" của Hộp màu nâu (cánh cửa).',
  },
  addTimer: {
    title: 'Thêm đồng hồ',
    text: 'Kéo mảnh ghép "Hẹn giờ" (nhóm Tính toán) vào bảng. Chọn nó, đổi "Số giây" thành 20.',
  },
  wireRun: {
    title: 'Đồng hồ chờ bắt đầu',
    text: 'Nối cổng "Đã bắt đầu" của Màn hình bắt đầu sang cổng "Chạy" của Hẹn giờ.',
    explain: 'Hẹn giờ đứng yên cho tới khi người chơi bấm nút bắt đầu, nên không ai bị mất giờ oan.',
  },
  wireLose: {
    title: 'Hết giờ là thua',
    text: 'Nối cổng "Hết giờ" của Hẹn giờ sang cổng "Thua" của mảnh ghép Thắng/Thua.',
  },
  play: {
    title: 'Thử chơi',
    text: 'Bấm "Chơi". Bấm nút trên màn hình bắt đầu, rồi bấm nút "Mở cửa" và chạy tới ngôi sao bằng mũi tên.',
    explain: 'Nhấn Esc khi đang chơi để tạm dừng. Menu tạm dừng bật tắt được ở Thuộc tính của Màn hình bắt đầu.',
  },
  win: {
    title: 'Chạm ngôi sao',
    text: 'Chơi tiếp cho tới khi chạm ngôi sao. Nếu hết giờ, bấm "Chơi lại" trên bảng kết quả.',
  },
  done: {
    title: 'Game của bạn có màn hình mở đầu!',
    text: 'Bạn đã biết Màn hình bắt đầu và Nút trên màn hình. Thử nối "Đã bắt đầu" vào thêm các mảnh ghép khác nữa.',
  },
} as const;

export const ASK_DIALOG_TEXT = {
  title: 'Hộp hỏi',
  summary: 'Chạm vào bạn bot thì hiện câu hỏi, chọn đúng câu trả lời để mở đường.',
  boardName: 'Hộp hỏi',
  intro: {
    title: 'Bot hỏi đường',
    text: 'Bảng này có sẵn bạn, sàn nhà, một bạn bot đứng giữa đường, cổng gỗ chắn đường và ngôi sao ở xa. Ta sẽ cho bot hỏi bạn một câu: trả lời đúng thì cổng mở, trả lời sai thì thua.',
    explain: 'Hộp hỏi cho người chơi chọn. Mỗi lựa chọn là một cổng riêng, nên bạn nối mỗi lựa chọn tới việc khác nhau.',
  },
  addTouch: {
    title: 'Thêm Cảm biến chạm',
    text: 'Kéo mảnh ghép "Cảm biến chạm" (nhóm Logic) vào bảng.',
    explain: 'Nó báo khi hai vật chạm nhau. Ở đây ta dùng nó để biết bạn đã lại gần bot.',
  },
  wireHero: {
    title: 'Vật A là bạn',
    text: 'Nối cổng "Nhân vật" của nhân vật xanh (bạn) sang cổng "Vật A" của Cảm biến chạm.',
  },
  wireBot: {
    title: 'Vật B là bạn bot',
    text: 'Nối cổng "Nhân vật" của rô-bốt cam (bot) sang cổng "Vật B" của Cảm biến chạm.',
  },
  addDialog: {
    title: 'Thêm Hộp hỏi',
    text: 'Kéo mảnh ghép "Hộp hỏi" (nhóm Đầu vào) vào bảng.',
    explain: 'Khi cổng "Hỏi" bật, hộp hiện câu hỏi với 2 hoặc 3 nút trả lời. Người chơi bấm nút nào thì cổng "Chọn" tương ứng bật một nhịp, rồi hộp đóng lại.',
  },
  wireAsk: {
    title: 'Chạm vào bot là hỏi',
    text: 'Nối cổng "Vừa chạm" của Cảm biến chạm sang cổng "Hỏi" của Hộp hỏi.',
  },
  question: {
    title: 'Viết câu hỏi',
    text: 'Chọn Hộp hỏi, ở Thuộc tính đổi "Câu hỏi" thành câu bạn thích, ví dụ "Bạn muốn làm gì?". Hai câu trả lời "Có" và "Không" bạn đổi tuỳ ý.',
  },
  wireOpen: {
    title: 'Chọn 1 mở cổng',
    text: 'Nối cổng "Chọn 1" của Hộp hỏi sang cổng "Ẩn đi" của Hộp màu nâu (cổng gỗ cao).',
    explain: 'Câu trả lời thứ nhất là câu đúng, nên đường mở ra.',
  },
  wireTrap: {
    title: 'Chọn 2 là thua',
    text: 'Nối cổng "Chọn 2" của Hộp hỏi sang cổng "Thua" của mảnh ghép Thắng/Thua.',
    explain: 'Câu trả lời thứ hai là bẫy. Cho mỗi lựa chọn một hậu quả khác nhau làm câu hỏi có ý nghĩa.',
  },
  play: {
    title: 'Thử trả lời',
    text: 'Bấm "Chơi". Đi sang phải tới chỗ bot, bấm câu trả lời bạn chọn trên hộp hỏi hiện ra, rồi chạy tới ngôi sao.',
  },
  win: {
    title: 'Tới ngôi sao',
    text: 'Chơi tiếp cho tới khi chạm ngôi sao. Nếu lỡ thua, bấm "Chơi lại" và chọn câu khác.',
  },
  done: {
    title: 'Bạn biết hỏi người chơi rồi!',
    text: 'Bạn đã biết Hộp hỏi. Thử cho 3 câu trả lời và nối mỗi câu tới một phần thưởng khác nhau.',
  },
} as const;
