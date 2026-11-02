/** Vietnamese texts of the lessons in course pack B (vehicles on routes, cargo, guide arrows). */

export const ROUTE_TRAFFIC_TEXT = {
  title: 'Xe chạy theo tuyến',
  summary: 'Cho một chiếc xe không người lái chạy vòng quanh bốn góc đường, và dừng lại ở vạch khi đèn giao thông đang đỏ.',
  boardName: 'Xe chạy theo tuyến',
  intro: {
    title: 'Xe tự chạy và đèn giao thông',
    text: 'Bảng này có một vòng đường, một chiếc xe xanh chưa ai lái, một cây đèn giao thông, hai mảnh ghép đếm giờ và một Máy quay đặt sẵn để thấy cả vòng đường. Ta sẽ cho xe tự chạy vòng quanh đường, rồi bắt nó dừng lại khi đèn đỏ.',
    explain: 'Xe tự chạy cần một "người lái" bằng mảnh ghép: mảnh ghép Chạy theo tuyến sẽ bấm cần ga và đánh lái thay bạn.',
  },
  route: {
    title: 'Thêm Chạy theo tuyến',
    text: 'Kéo mảnh ghép "Chạy theo tuyến" (nhóm Bộ não) vào bảng.',
    explain: 'Nó biết sẵn 4 điểm ở bốn góc vòng đường và lái xe đi lần lượt qua từng điểm, hết điểm cuối thì quay về điểm đầu.',
  },
  who: {
    title: 'Nói xe nào sẽ chạy',
    text: 'Nối cổng "Xe" của mảnh ghép Xe sang cổng "Ai" của Chạy theo tuyến.',
  },
  move: {
    title: 'Nối tay lái và chân ga',
    text: 'Nối cổng "Đi ngang" và cổng "Đi dọc" của Chạy theo tuyến sang hai cổng cùng tên của mảnh ghép Xe (hai sợi dây).',
    explain: 'Giống như cần điều khiển, nhưng người bấm lần này là mảnh ghép chứ không phải bạn.',
  },
  watch: {
    title: 'Xem xe chạy',
    text: 'Bấm "Chơi". Xe chạy vòng quanh bốn góc đường và không bao giờ dừng.',
  },
  edit: {
    title: 'Quay lại sửa',
    text: 'Bấm nút "Dừng" để làm tiếp.',
  },
  timer: {
    title: 'Hẹn giờ đổi đèn',
    text: 'Nối cổng "Hết giờ" của Hẹn giờ sang cổng "Cộng 1" của Bộ đếm.',
    explain: 'Hẹn giờ này đếm ngược 8 giây. Khi hết giờ, Bộ đếm cộng thêm 1: số đếm đổi từ 0 sang 1.',
  },
  color: {
    title: 'Số đếm đổi màu đèn',
    text: 'Nối cổng "Số đếm" của Bộ đếm sang cổng "Đổi màu (1, 2 hoặc 3)" của Hộp đèn giao thông (cây đèn cao).',
    explain: 'Hộp kiểu "Đèn giao thông" sáng đèn đỏ lúc đầu. Khi nhận số 1, nó đổi sang "Màu 1" mà ta đã đặt là xanh lá. Số 2 là "Màu 2", số 3 là "Màu 3".',
  },
  zone: {
    title: 'Thêm Vùng kích hoạt',
    text: 'Kéo mảnh ghép "Vùng kích hoạt" (nhóm Logic) vào bảng.',
    explain: 'Vùng kích hoạt là một hộp vô hình. Nó biết có xe nào đang nằm trong hộp không. Ta dùng nó làm vạch dừng.',
  },
  place: {
    title: 'Đặt vạch dừng lên đường',
    text: 'Chọn Vùng kích hoạt. Ở Thuộc tính, sửa ô "Tâm vùng" cho vùng nằm trên đoạn đường phía trên: để X = 0 và Z = -6.',
    explain: 'Lúc mới thêm, vùng nằm giữa bảng, không nằm trên đường nào. Khi chỉnh sửa bạn thấy vùng là hộp xanh mờ, lúc chơi thì nó vô hình.',
  },
  filter: {
    title: 'Chỉ đếm xe',
    text: 'Vẫn ở Thuộc tính của Vùng kích hoạt, đổi "Tính những gì" thành "Phương tiện".',
    explain: 'Chiếc xe là phương tiện chứ không phải nhân vật, nên mặc định cảm biến chưa thấy nó.',
  },
  not: {
    title: 'Thêm mảnh ghép Đảo ngược',
    text: 'Kéo mảnh ghép "Đảo ngược" (nhóm Logic) vào bảng.',
    explain: 'Mảnh ghép "Đảo ngược" đảo ngược tín hiệu: đang bật thì thành tắt.',
  },
  red: {
    title: 'Chưa đủ số là đèn đỏ',
    text: 'Nối cổng "Đã đủ" của Bộ đếm sang cổng "Vào" của mảnh ghép Đảo ngược.',
    explain: '"Đã đủ" bật khi đèn đã sang xanh. Qua mảnh ghép Đảo ngược, ta được tín hiệu "đèn đang đỏ".',
  },
  and: {
    title: 'Thêm mảnh ghép Và',
    text: 'Kéo mảnh ghép "Và" (nhóm Logic) vào bảng.',
    explain: 'Xe chỉ phải dừng khi cả hai điều cùng đúng: xe đang ở vạch dừng, và đèn đang đỏ.',
  },
  rule: {
    title: 'Xe ở vạch và đèn đỏ',
    text: 'Nối cổng "Có ai trong vùng" của Vùng kích hoạt sang cổng "A" của mảnh ghép Và. Nối cổng "Kết quả" của mảnh ghép Đảo ngược sang cổng "B" của mảnh ghép Và.',
  },
  stop: {
    title: 'Đèn đỏ thì dừng xe',
    text: 'Nối cổng "Kết quả" của mảnh ghép Và sang cổng "Dừng" của Chạy theo tuyến.',
    explain: 'Khi "Dừng" bật, xe phanh lại và đứng yên. Khi tắt thì xe chạy tiếp từ chỗ cũ.',
  },
  play: {
    title: 'Chạy thử',
    text: 'Bấm "Chơi". Xe chạy tới vạch dừng và đứng chờ. Khoảng 8 giây sau đèn chuyển xanh và xe chạy tiếp.',
  },
  done: {
    title: 'Xe biết chờ đèn đỏ rồi!',
    text: 'Bạn đã cho xe tự chạy theo tuyến và dừng ở vạch khi đèn đỏ. Hãy thử đổi số giây của Hẹn giờ, đổi tốc độ của Chạy theo tuyến, hoặc đặt thêm một chiếc xe nữa.',
  },
} as const;

export const TRAIN_TEXT = {
  title: 'Tàu hỏa',
  summary: 'Ghép một đoàn tàu gồm đầu máy và hai toa, cho chạy bám đường ray và dừng ở ga.',
  boardName: 'Tàu hỏa',
  intro: {
    title: 'Làm một đoàn tàu',
    text: 'Bảng này có vòng đường ray, ba chiếc xe xếp thành hàng trên ray và một Máy quay đặt sẵn để thấy cả vòng ray. Ta sẽ biến chúng thành đầu máy và hai toa, nối chúng với nhau, rồi cho cả đoàn chạy.',
    explain: 'Đoàn tàu chạy theo đúng đường ray, không trượt ra ngoài như xe hơi. Chỉ đầu máy cần người lái, hai toa tự chạy theo sau.',
  },
  rail: {
    title: 'Sửa đoạn ray còn thiếu',
    text: 'Đoạn đường bên phải còn trơn, chưa có thanh ray. Chọn nó, ở Thuộc tính đổi "Kiểu dáng" thành "Đường ray".',
    explain: 'Kiểu "Đường ray" chỉ để trang trí: nó vẽ thanh ray và tà vẹt. Tàu chạy theo các điểm của tuyến chứ không theo hình vẽ.',
  },
  loco: {
    title: 'Chiếc xe đầu là đầu máy',
    text: 'Chọn chiếc Xe đứng ở đầu hàng (bên phải nhất). Ở Thuộc tính đổi "Loại xe" thành "Đầu máy (tàu)".',
  },
  wagons: {
    title: 'Hai chiếc sau là toa tàu',
    text: 'Chọn từng chiếc Xe còn lại và đổi "Loại xe" thành "Toa tàu". Làm cho cả hai chiếc.',
  },
  tow1: {
    title: 'Toa 1 bám theo đầu máy',
    text: 'Nối cổng "Xe" của đầu máy sang cổng "Theo xe đầu" của toa đứng ngay sau nó.',
    explain: 'Toa nào có "Theo xe đầu" thì đi theo đúng vết bánh của chiếc xe phía trước và không cần ai lái.',
  },
  tow2: {
    title: 'Toa 2 bám theo toa 1',
    text: 'Nối cổng "Xe" của toa 1 sang cổng "Theo xe đầu" của toa cuối.',
    explain: 'Nối tiếp từng toa vào toa trước nó, đoàn tàu dài bao nhiêu cũng được.',
  },
  route: {
    title: 'Thêm Chạy theo tuyến',
    text: 'Kéo mảnh ghép "Chạy theo tuyến" (nhóm Bộ não) vào bảng.',
  },
  who: {
    title: 'Đầu máy chạy theo tuyến',
    text: 'Nối cổng "Xe" của đầu máy sang cổng "Ai" của Chạy theo tuyến.',
  },
  follow: {
    title: 'Chạy bám ray',
    text: 'Chọn Chạy theo tuyến. Ở Thuộc tính đổi "Cách chạy" thành "Bám ray".',
    explain: 'Bám ray chạy đúng đường nối các điểm và bo mượt ở góc, nên không cần nối "Đi ngang" / "Đi dọc". Cách "Lái tới từng điểm" thì cua rộng và dễ trôi lệch khỏi đường.',
  },
  watch: {
    title: 'Xem tàu chạy',
    text: 'Bấm "Chơi". Đầu máy kéo hai toa chạy vòng quanh đường ray và không bao giờ dừng.',
  },
  edit: {
    title: 'Quay lại sửa',
    text: 'Bấm nút "Dừng" để làm tiếp.',
  },
  timer: {
    title: 'Thêm Hẹn giờ cho ga',
    text: 'Kéo mảnh ghép "Hẹn giờ" (nhóm Tính toán) vào bảng.',
    explain: 'Ta cho tàu đỗ vài giây mỗi khi tới một điểm, như đỗ ở ga.',
  },
  seconds: {
    title: 'Đỗ 3 giây',
    text: 'Chọn Hẹn giờ. Ở Thuộc tính, đổi "Số giây" thành 3.',
  },
  reached: {
    title: 'Tới ga thì đếm lại',
    text: 'Nối cổng "Tới điểm" của Chạy theo tuyến sang cổng "Đếm lại" của Hẹn giờ.',
    explain: '"Tới điểm" bật một nhịp mỗi lần tàu đi qua một điểm. Mỗi nhịp bắt Hẹn giờ đếm lại từ đầu.',
  },
  not: {
    title: 'Thêm mảnh ghép Đảo ngược',
    text: 'Kéo mảnh ghép "Đảo ngược" (nhóm Logic) vào bảng.',
  },
  waiting: {
    title: 'Chưa hết giờ là còn đỗ',
    text: 'Nối cổng "Hết giờ" của Hẹn giờ sang cổng "Vào" của mảnh ghép Đảo ngược.',
    explain: 'Trong 3 giây đầu, Hẹn giờ chưa hết, mảnh ghép Đảo ngược cho tín hiệu "đang đỗ".',
  },
  stop: {
    title: 'Đang đỗ thì dừng tàu',
    text: 'Nối cổng "Kết quả" của mảnh ghép Đảo ngược sang cổng "Dừng" của Chạy theo tuyến.',
  },
  play: {
    title: 'Chạy thử',
    text: 'Bấm "Chơi". Tàu đỗ 3 giây, chạy tới góc kế tiếp, đỗ lại 3 giây, và cứ thế vòng quanh.',
  },
  done: {
    title: 'Chuyến tàu đã sẵn sàng!',
    text: 'Bạn đã ghép đầu máy với các toa, cho tàu bám ray và đỗ ở ga. Hãy thử thêm một toa nữa, đổi tốc độ, hoặc chọn kiểu "Đi rồi quay lại".',
  },
} as const;

export const CARGO_TEXT = {
  title: 'Chở hàng',
  summary: 'Lái xe tải tới chỗ hàng, chất đúng loại hàng lên thùng xe, chở tới bãi dỡ và đếm số lần giao hàng để thắng.',
  boardName: 'Chở hàng',
  intro: {
    title: 'Xe tải chở hàng',
    text: 'Bảng này có một nhân vật, một xe tải và vài món đồ nằm trên đường: hai thùng hàng nâu và một viên đá. Phím E để lên hoặc xuống xe, mũi tên để lái. Ta sẽ làm cho xe chất thùng hàng lên và dỡ xuống ở bãi giao hàng.',
    explain: 'Mỗi món đồ có "Loại hàng" là một chữ bạn đặt. Thùng hàng loại "thùng", viên đá loại "đá". Xe chỉ chất loại hàng mà ta chọn.',
  },
  cargo: {
    title: 'Thêm Chở hàng',
    text: 'Kéo mảnh ghép "Chở hàng" (nhóm Hành động) vào bảng.',
    explain: 'Mảnh ghép này lo việc đặt hàng lên thùng xe và lấy hàng xuống.',
  },
  vehicle: {
    title: 'Nói xe nào chở hàng',
    text: 'Nối cổng "Xe" của mảnh ghép Xe (xe tải) sang cổng "Xe" của Chở hàng.',
  },
  loadType: {
    title: 'Chỉ chất thùng hàng',
    text: 'Chọn Chở hàng. Ở Thuộc tính, gõ chữ thùng vào ô "Loại cần chất".',
    explain: 'Có đặt loại thì xe bỏ qua món khác loại, ví dụ viên đá nằm sát xe nhất cũng không được chất lên.',
  },
  unloadType: {
    title: 'Chỉ dỡ thùng hàng',
    text: 'Vẫn ở Thuộc tính, gõ chữ thùng vào ô "Loại cần dỡ".',
    explain: 'Ô này cũng quyết định "Số hàng loại này" đếm loại nào: ở đây là đếm thùng hàng trên xe.',
  },
  key: {
    title: 'Thêm nút bấm',
    text: 'Kéo thêm một mảnh ghép "Phím bấm" (nhóm Đầu vào) vào bảng.',
  },
  keyL: {
    title: 'Chọn phím L',
    text: 'Chọn mảnh ghép Phím bấm mới thêm. Ở Thuộc tính, bấm vào ô "Phím" rồi nhấn phím L.',
  },
  load: {
    title: 'Bấm L để chất hàng',
    text: 'Nối cổng "Vừa nhấn" của Phím bấm (phím L) sang cổng "Chất" của Chở hàng.',
    explain: 'Mỗi lần bấm L, xe chất món hàng đúng loại ở gần nhất và trong tầm với.',
  },
  zone: {
    title: 'Thêm bãi dỡ hàng',
    text: 'Kéo mảnh ghép "Vùng kích hoạt" (nhóm Logic) vào bảng.',
    explain: 'Vùng mặc định nằm ngay giữa bảng, chỗ có ô vàng trên đường. Đó sẽ là bãi dỡ hàng.',
  },
  filter: {
    title: 'Chỉ tính xe',
    text: 'Chọn Vùng kích hoạt. Ở Thuộc tính đổi "Tính những gì" thành "Phương tiện".',
  },
  and: {
    title: 'Thêm mảnh ghép Và',
    text: 'Kéo mảnh ghép "Và" (nhóm Logic) vào bảng.',
    explain: 'Ta chỉ dỡ hàng khi xe ở trong bãi và bạn bấm L.',
  },
  inZone: {
    title: 'Xe đang ở trong bãi',
    text: 'Nối cổng "Có ai trong vùng" của Vùng kích hoạt sang cổng "A" của mảnh ghép Và.',
  },
  pressL: {
    title: 'Và bạn bấm L',
    text: 'Nối cổng "Vừa nhấn" của Phím bấm (phím L) sang cổng "B" của mảnh ghép Và.',
  },
  unload: {
    title: 'Trong bãi thì L là dỡ hàng',
    text: 'Nối cổng "Kết quả" của mảnh ghép Và sang cổng "Dỡ" của Chở hàng.',
    explain: 'Ngoài bãi, bấm L chỉ chất hàng. Trong bãi, "Dỡ" được ưu tiên hơn "Chất", nên bấm L là dỡ một món xuống.',
  },
  counter: {
    title: 'Thêm Bộ đếm',
    text: 'Kéo mảnh ghép "Bộ đếm" (nhóm Tính toán) vào bảng.',
  },
  target: {
    title: 'Giao đủ 2 thùng',
    text: 'Chọn Bộ đếm. Ở Thuộc tính đổi "Mục tiêu" thành 2.',
  },
  count: {
    title: 'Mỗi lần dỡ là một lần giao',
    text: 'Nối cổng "Vừa dỡ" của Chở hàng sang cổng "Cộng 1" của Bộ đếm.',
  },
  show: {
    title: 'Thêm Hiện số',
    text: 'Kéo mảnh ghép "Hiện số" (nhóm Kết quả) vào bảng.',
  },
  showCount: {
    title: 'Hiện số thùng trên xe',
    text: 'Nối cổng "Số hàng loại này" của Chở hàng sang cổng "Số cần hiện" của Hiện số.',
    explain: 'Trong lúc chơi, góc màn hình cho biết xe đang chở mấy thùng hàng.',
  },
  end: {
    title: 'Thêm mảnh ghép Thắng / Thua',
    text: 'Kéo mảnh ghép "Thắng / Thua" (nhóm Kết quả) vào bảng.',
  },
  win: {
    title: 'Giao đủ là thắng',
    text: 'Nối cổng "Đã đủ" của Bộ đếm sang cổng "Thắng" của mảnh ghép Thắng / Thua.',
  },
  play: {
    title: 'Giao hàng thử',
    text: 'Bấm "Chơi". Bấm E để lên xe, lái sang phải tới gần hai thùng hàng, bấm L hai lần để chất. Lái tiếp vào bãi giữa đường rồi bấm L hai lần để dỡ.',
  },
  won: {
    title: 'Giao đủ hai thùng',
    text: 'Chất hai thùng hàng lên xe, chở tới bãi rồi dỡ cả hai xuống. Viên đá thì để nguyên đó.',
  },
  done: {
    title: 'Bạn là tài xế giao hàng rồi!',
    text: 'Bạn đã cho xe chất đúng loại hàng, dỡ ở bãi và đếm số lần giao. Hãy thử thêm một loại hàng khác với Chở hàng thứ hai, hoặc tăng mục tiêu của Bộ đếm.',
  },
} as const;

export const GUIDE_TEXT = {
  title: 'Mũi tên dẫn đường',
  summary: 'Vẽ mũi tên chỉ đường từ nhân vật tới cờ, và đổi mũi tên sang cờ kế tiếp sau khi chạm cờ đầu.',
  boardName: 'Mũi tên dẫn đường',
  intro: {
    title: 'Chỉ đường cho người chơi',
    text: 'Bảng này có một nhân vật đi được bằng mũi tên và hai lá cờ: cờ vàng ở gần, cờ đỏ ở xa. Chạm cờ đỏ là thắng. Ta sẽ thêm mũi tên dẫn đường để người chơi biết phải đi đâu.',
    explain: 'Mũi tên lơ lửng phía trên nhân vật, chỉ về phía đích và ghi số đơn vị còn lại.',
  },
  arrow: {
    title: 'Thêm Mũi tên chỉ đường',
    text: 'Kéo mảnh ghép "Mũi tên chỉ đường" (nhóm Kết quả) vào bảng.',
  },
  from: {
    title: 'Mũi tên xuất phát từ nhân vật',
    text: 'Nối cổng "Nhân vật" của nhân vật sang cổng "Từ" của Mũi tên chỉ đường.',
  },
  to: {
    title: 'Mũi tên chỉ về cờ vàng',
    text: 'Nối cổng "Hộp" của lá cờ vàng sang cổng "Tới" của Mũi tên chỉ đường.',
    explain: 'Cờ vàng là lá gần nhân vật hơn, nằm bên trái cờ đỏ.',
  },
  watch: {
    title: 'Xem mũi tên',
    text: 'Bấm "Chơi". Mũi tên chỉ về cờ vàng. Đi tới đó: khi đến gần, mũi tên tự biến mất.',
  },
  edit: {
    title: 'Quay lại sửa',
    text: 'Bấm nút "Dừng" để làm tiếp.',
  },
  arrow2: {
    title: 'Thêm mũi tên thứ hai',
    text: 'Kéo thêm một mảnh ghép "Mũi tên chỉ đường" vào bảng. Mũi tên này sẽ chỉ về cờ đỏ.',
  },
  from2: {
    title: 'Mũi tên 2 từ nhân vật',
    text: 'Nối cổng "Nhân vật" của nhân vật sang cổng "Từ" của mũi tên thứ hai.',
  },
  to2: {
    title: 'Mũi tên 2 chỉ về cờ đỏ',
    text: 'Nối cổng "Hộp" của lá cờ đỏ sang cổng "Tới" của mũi tên thứ hai.',
  },
  counter: {
    title: 'Thêm Bộ đếm để nhớ đang đi cờ nào',
    text: 'Kéo mảnh ghép "Bộ đếm" (nhóm Tính toán) vào bảng.',
    explain: 'Số đếm 1 nghĩa là đang đi tới cờ vàng, số đếm 2 nghĩa là đang đi tới cờ đỏ.',
  },
  start: {
    title: 'Bắt đầu từ 1',
    text: 'Chọn Bộ đếm. Ở Thuộc tính đổi "Bắt đầu từ" thành 1.',
  },
  touch: {
    title: 'Chạm cờ vàng thì đếm',
    text: 'Nối cổng "Đang chạm" của Chạm nhau (cái chạm cờ vàng) sang cổng "Cộng 1" của Bộ đếm.',
    explain: 'Hai Chạm nhau đã có sẵn: một cái canh cờ vàng, một cái canh cờ đỏ (cái này đã nối sang Thắng / Thua).',
  },
  select: {
    title: 'Thêm Chọn theo số',
    text: 'Kéo mảnh ghép "Chọn theo số" (nhóm Logic) vào bảng.',
    explain: 'Nó nhận một số và chỉ bật đúng một cổng "Bằng 1", "Bằng 2"... tương ứng.',
  },
  selectIn: {
    title: 'Số đếm đi vào Chọn theo số',
    text: 'Nối cổng "Số đếm" của Bộ đếm sang cổng "Số" của Chọn theo số.',
  },
  show1: {
    title: 'Số 1 thì hiện mũi tên 1',
    text: 'Nối cổng "Bằng 1" của Chọn theo số sang cổng "Hiện" của mũi tên chỉ về cờ vàng.',
  },
  show2: {
    title: 'Số 2 thì hiện mũi tên 2',
    text: 'Nối cổng "Bằng 2" của Chọn theo số sang cổng "Hiện" của mũi tên chỉ về cờ đỏ.',
    explain: 'Lúc đầu chỉ mũi tên 1 hiện. Chạm cờ vàng thì số đếm lên 2, mũi tên 1 tắt và mũi tên 2 hiện.',
  },
  play: {
    title: 'Chạy thử',
    text: 'Bấm "Chơi". Đi theo mũi tên tới cờ vàng, rồi theo mũi tên mới tới cờ đỏ.',
  },
  won: {
    title: 'Theo mũi tên tới cờ đỏ',
    text: 'Đi sang phải theo mũi tên. Chạm cờ đỏ là thắng.',
  },
  done: {
    title: 'Không ai lạc đường nữa!',
    text: 'Bạn đã vẽ mũi tên chỉ đường và đổi đích khi người chơi đã tới nơi. Hãy thử thêm cờ thứ ba, đặt "Chọn theo số" có 3 lựa chọn, hoặc đổi màu mũi tên.',
  },
} as const;
