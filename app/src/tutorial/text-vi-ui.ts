/** Vietnamese texts of the "Rương bí mật" lesson (clickable objects, countdown bar, game end). */
export const UI_CHEST_TEXT = {
  title: '17. Rương bí mật',
  summary: 'Bấm chuột vào rương để mở, có thanh đo đếm ngược thời gian.',
  boardName: 'Bài 17 - Rương bí mật',
  intro: {
    title: 'Mở rương bằng chuột',
    text: 'Bảng này có sẵn nhân vật, sàn nhà và một chiếc rương màu nâu. Ta sẽ làm game: bấm chuột vào rương trước khi hết giờ để thắng.',
    explain: 'Từ bài này, game không chỉ dùng bàn phím. Người chơi còn bấm chuột được vào vật và vào nút trên màn hình.',
  },
  pick: {
    title: 'Thêm mảnh ghép Bấm vào đối tượng',
    text: 'Kéo mảnh ghép "Bấm vào đối tượng" (nhóm Đầu vào) vào bảng.',
    explain: 'Nó báo một nhịp "Khi bấm" mỗi lần người chơi bấm chuột vào đúng vật mà bạn nối cho nó.',
  },
  wireChest: {
    title: 'Nói vật nào bấm được',
    text: 'Nối cổng "Đối tượng" của mảnh ghép Vật thể có màu nâu (cái rương) sang cổng "Đối tượng" của mảnh ghép Bấm vào đối tượng.',
  },
  winLose: {
    title: 'Thêm mảnh ghép Thắng / Thua',
    text: 'Kéo mảnh ghép "Thắng / Thua" (nhóm Kết quả) vào bảng.',
  },
  wireWin: {
    title: 'Bấm rương là thắng',
    text: 'Nối cổng "Khi bấm" của Bấm vào đối tượng sang cổng "Thắng" của mảnh ghép Thắng / Thua.',
  },
  timer: {
    title: 'Thêm đồng hồ đếm ngược',
    text: 'Kéo mảnh ghép "Hẹn giờ" (nhóm Tính toán) vào bảng. Chọn nó, ở Thuộc tính đổi "Số giây" thành 10.',
    explain: 'Hẹn giờ đếm ngược từ số giây bạn đặt, khi có tín hiệu bật ở cổng "Bắt đầu" (ở bước sau ta nối "Khi bắt đầu" vào đó).',
  },
  meter: {
    title: 'Thêm Thanh đo',
    text: 'Kéo mảnh ghép "Thanh đo" (nhóm Kết quả) vào bảng. Chọn nó, ở Thuộc tính đổi "Lớn nhất" thành 10 cho khớp với 10 giây.',
    explain: 'Thanh đo đầy khi con số bằng "Lớn nhất", và rỗng dần khi con số giảm về "Nhỏ nhất". Dùng được cho máu, thời gian, sức mạnh...',
  },
  wireMeter: {
    title: 'Cho thanh đo xem giờ',
    text: 'Nối cổng "Giây còn lại" của Hẹn giờ sang cổng "Giá trị" của Thanh đo.',
  },
  wireLose: {
    title: 'Hết giờ là thua',
    text: 'Nối cổng "Hết giờ" của Hẹn giờ sang cổng "Thua" của mảnh ghép Thắng / Thua.',
  },
  play: {
    title: 'Thử mở rương',
    text: 'Bấm "Chạy". Bấm chuột vào chiếc rương nâu trước khi thanh đo cạn.',
    explain: 'Nếu hết giờ, bạn thua. Bấm "Chạy lại" trên bảng kết quả để thử lại.',
  },
  win: {
    title: 'Mở được rương!',
    text: 'Chạy tiếp cho tới khi bấm trúng rương. Nếu lỡ thua, bấm "Chạy lại" trên bảng kết quả rồi thử lại.',
  },
  done: {
    title: 'Bạn làm game bấm chuột rồi!',
    text: 'Bạn đã biết dùng Bấm vào đối tượng và Thanh đo. Hãy thử thêm "Nút bấm" (nhóm Đầu vào), "Hộp thoại" và "Màn hình mở đầu" để game có thêm nút bấm và màn hình mở đầu.',
  },
} as const;
