/** Vietnamese text of the "Làm game thật" lessons: grouping nodes and the final packing-factory project. */

export const GROUPS_TEXT = {
  title: 'Gom nhóm mảnh ghép',
  summary: 'Gom nhiều mảnh ghép thành một khối gọn, đổi tên, mở ra xem và nhân đôi.',
  boardName: 'Gom nhóm mảnh ghép',
  intro: {
    title: 'Bảng đang bừa bộn',
    text: 'Bảng này có hai bộ "bot đi tuần" giống nhau, mỗi bộ gồm một nhân vật bot và một mảnh ghép Đi tới. Game to lên thì mảnh ghép nhiều như rừng. Bài này dạy cách gom chúng thành từng khối gọn.',
    explain: 'Nhóm chỉ để bảng nhìn gọn. Game chạy y hệt như khi các mảnh ghép nằm rời.',
  },
  select: {
    title: 'Chọn một bộ bot',
    text: 'Chọn mảnh ghép nhân vật bot và mảnh ghép Đi tới đang được nhấp nháy: giữ Shift rồi kéo một khung quanh cả hai, hoặc bấm vào cái này rồi giữ Shift bấm cái kia.',
    explain: 'Phải chọn đúng hai mảnh ghép này, đừng chọn thừa.',
  },
  group: {
    title: 'Gom thành nhóm',
    text: 'Bấm Ctrl+G. Hai mảnh ghép gộp thành một khối có hình thư mục.',
    explain: 'Dây nối đi ra ngoài khối vẫn còn nguyên. Muốn tách nhóm ra, chọn khối rồi bấm Ctrl+Shift+G.',
  },
  rename: {
    title: 'Đặt tên cho nhóm',
    text: 'Khối nhóm đang được chọn. Ở bảng Thuộc tính bên phải, bấm vào ô "Tên nhóm", gõ tên mới (ví dụ "Bot đi tuần") rồi bấm Enter.',
    explain: 'Tên rõ ràng giúp bạn đọc bảng nhanh hơn, nhất là khi có nhiều nhóm.',
  },
  enter: {
    title: 'Mở nhóm ra xem',
    text: 'Bấm đúp (hai lần liên tiếp) vào khối nhóm để bước vào bên trong.',
    explain: 'Bên trong bạn thấy lại các mảnh ghép cũ và sửa được như bình thường.',
  },
  exit: {
    title: 'Quay ra ngoài',
    text: 'Bấm phím Esc để thoát ra bảng chính.',
  },
  select2: {
    title: 'Chọn khối nhóm',
    text: 'Bấm một lần vào khối nhóm để chọn nó.',
  },
  duplicate: {
    title: 'Nhân đôi cả nhóm',
    text: 'Bấm Ctrl+D. Bạn có thêm một nhóm y hệt, gồm cả các mảnh ghép bên trong.',
    explain: 'Làm một bộ thật chuẩn, gom nhóm rồi nhân đôi là cách làm nhanh nhất khi game cần nhiều thứ giống nhau.',
  },
  library: {
    title: 'Cất game vào Kho',
    text: 'Xưởng Nối tự lưu game của bạn vào "Kho game của tôi". Mở menu Tệp, chọn "Kho game của tôi…" để xem, đổi tên, nhân đôi hoặc mở lại game cũ. Bấm "Tiếp" khi xong.',
    explain: 'Muốn giữ bản dự phòng, dùng "Xuất ra file" trong menu Tệp.',
  },
  done: {
    title: 'Bảng của bạn gọn gàng hơn rồi!',
    text: 'Bạn đã biết gom nhóm, đặt tên, mở nhóm, nhân đôi nhóm và cất game vào Kho. Giờ đến dự án cuối.',
  },
} as const;

export const FACTORY_TEXT = {
  title: 'Dự án cuối: Xưởng đóng gói',
  summary: 'Làm một xưởng đóng gói: băng chuyền chạy hộp, bot phân loại hàng vào đúng vùng, đủ số thì thắng.',
  boardName: 'Dự án cuối - Xưởng đóng gói',
  intro: {
    title: 'Xưởng đóng gói',
    text: 'Bảng này đã dựng sẵn xưởng: băng chuyền, một con bot, hai thùng hàng (một đỏ, một xanh) và hai vùng để đặt hàng. Việc của bạn là nối mọi thứ lại cho xưởng chạy: hộp chạy trên băng chuyền tới kho, bot phân loại hai thùng vào đúng vùng, đủ việc thì thắng.',
    explain: 'Đây là bài khó nhất: bạn dùng lại những mảnh ghép đã học. Cứ làm từng bước, bước nào cũng có chỉ dẫn.',
  },
  start: {
    title: 'Thêm Màn hình mở đầu',
    text: 'Kéo mảnh ghép "Màn hình mở đầu" (nhóm Đầu vào) vào bảng.',
    explain: 'Game chỉ chạy sau khi người chơi bấm nút "Bấm để chơi".',
  },
  startTimer: {
    title: 'Chờ bấm nút mới chạy',
    text: 'Nối cổng "Đã bắt đầu" của Màn hình mở đầu sang cổng "Chạy" của mảnh ghép Hẹn giờ.',
    explain: 'Hẹn giờ này cứ 2 giây lại bật một nhịp để nhả một hộp. Giờ nó chỉ đếm khi game đã bắt đầu.',
  },
  timerSpawn: {
    title: 'Hẹn giờ nhả hộp',
    text: 'Nối cổng "Hết giờ" của Hẹn giờ sang cổng "Tạo ra" của mảnh ghép Tạo vật mới.',
    explain: 'Mỗi lần Hẹn giờ kêu, Tạo vật mới tạo thêm một hộp (tối đa 3 hộp).',
  },
  beltAt: {
    title: 'Nhả hộp lên băng chuyền',
    text: 'Nối cổng "Hộp" của băng chuyền sang cổng "Tại vật" của Tạo vật mới.',
    explain: 'Hộp mới sẽ xuất hiện ngay trên băng chuyền rồi chạy sang phải, tới kho cuối băng.',
  },
  next: {
    title: 'Bot làm xong việc nào, qua việc đó',
    text: 'Bot đã có Chuỗi việc: lấy thùng đỏ, đặt vào vùng đỏ, lấy thùng xanh, đặt vào vùng xanh. Nối cổng "Kết quả" của mảnh ghép Hoặc ở cuối (hộp Hoặc nằm bên phải, đang nhấp nháy) sang cổng "Xong việc" của Chuỗi việc.',
    explain: 'Hoặc này gom bốn tín hiệu "Vừa tới", nên bot đi tới đâu là chuyển việc kế tiếp.',
  },
  grab: {
    title: 'Tới nơi thì cầm / thả',
    text: 'Nối cùng cổng "Kết quả" của Hoặc sang cổng "Nhấc lên" của mảnh ghép Khiêng đồ.',
    explain: 'Mảnh ghép Khiêng đồ này dùng một nút cho cả hai việc: lần đầu tới thùng thì cầm, lần tới vùng thì thả.',
  },
  goodsRed: {
    title: 'Vùng đỏ chỉ nhận hàng đỏ',
    text: 'Chọn mảnh ghép Vùng kích hoạt màu đỏ (vùng bên trái). Ở Thuộc tính, ô "Chỉ tính loại hàng" gõ đúng chữ: đỏ (không thêm dấu cách)',
    explain: 'Thùng hàng có "Loại hàng" ghi sẵn. Vùng chỉ đếm hàng đúng loại, hàng khác đặt vào cũng không tính.',
  },
  goodsBlue: {
    title: 'Vùng xanh chỉ nhận hàng xanh',
    text: 'Chọn mảnh ghép Vùng kích hoạt màu xanh (vùng bên phải). Ở ô "Chỉ tính loại hàng" gõ đúng chữ: xanh (không thêm dấu cách)',
  },
  counter: {
    title: 'Thêm bộ đếm hàng đã đóng gói',
    text: 'Kéo mảnh ghép "Bộ đếm" (nhóm Tính toán) vào bảng.',
  },
  target: {
    title: 'Đặt mục tiêu là 2',
    text: 'Chọn Bộ đếm. Ở Thuộc tính, đổi "Mục tiêu" thành 2, vì ta có hai thùng hàng cần phân loại.',
  },
  packed: {
    title: 'Mỗi thùng vào đúng vùng, đếm thêm 1',
    text: 'Nối cổng "Kết quả" của mảnh ghép Hoặc nằm cạnh hai vùng (nó gom hai nhịp "Vừa vào") sang cổng "Cộng 1" của Bộ đếm.',
    explain: 'Vì vùng chỉ nhận đúng loại hàng, thùng đặt nhầm vùng sẽ không được đếm.',
  },
  meter: {
    title: 'Thêm thanh đo tiến độ',
    text: 'Kéo mảnh ghép "Thanh đo" (nhóm Kết quả) vào bảng.',
  },
  meterSetup: {
    title: 'Chỉnh thanh đo',
    text: 'Chọn Thanh đo. Đổi "Tên thanh" thành chữ khác "Máu" (ví dụ "Đóng gói") và đổi "Lớn nhất" thành 2.',
    explain: 'Số đếm bằng "Lớn nhất" thì thanh đầy.',
  },
  meterWire: {
    title: 'Thanh đo theo dõi bộ đếm',
    text: 'Nối cổng "Số đếm" của Bộ đếm sang cổng "Số cần đo" của Thanh đo.',
  },
  reached: {
    title: 'Đếm đủ thì báo',
    text: 'Nối cổng "Đã đủ" của Bộ đếm sang cổng "A" của mảnh ghép Và (đang nhấp nháy). Cổng "B" của Và đã nối sẵn với vùng kho cuối băng chuyền: kho phải có đủ 3 hộp.',
    explain: 'Muốn thắng phải đủ cả hai: bot phân loại xong và kho cuối băng chuyền có đủ 3 hộp.',
  },
  end: {
    title: 'Thêm mảnh ghép kết thúc',
    text: 'Kéo mảnh ghép "Thắng / Thua" vào bảng.',
  },
  win: {
    title: 'Đủ việc thì thắng',
    text: 'Nối cổng "Kết quả" của mảnh ghép Và sang cổng "Thắng" của Thắng / Thua.',
  },
  play: {
    title: 'Mở cửa xưởng',
    text: 'Bấm "Chơi", rồi bấm nút "Bấm để chơi" trên màn hình. Xem hộp chạy trên băng chuyền và bot phân loại hàng.',
    explain: 'Nếu chưa thắng, bấm "Dừng" rồi kiểm tra lại các dây nối từng bước.',
  },
  won: {
    title: 'Chờ xưởng làm xong',
    text: 'Đợi một lúc cho đến khi đủ hộp ở kho và bot đặt xong hai thùng hàng.',
  },
  done: {
    title: 'Xưởng của bạn chạy rồi!',
    text: 'Bạn đã dùng Màn hình mở đầu, Hẹn giờ, Tạo vật mới, băng chuyền, Chuỗi việc, bot, Khiêng đồ, Vùng kích hoạt, Bộ đếm, Thanh đo và Thắng / Thua trong một game. Chúc mừng, bạn đã làm xong cả khóa!',
  },
} as const;
