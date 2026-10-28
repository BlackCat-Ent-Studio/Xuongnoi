/** All Vietnamese text of the in-app tutorial. */

export const TUTORIAL_UI = {
  button: '📘 Hướng dẫn',
  menuTitle: 'Học làm game',
  menuHint: 'Mỗi bài có một bảng riêng. Game của bạn được giữ nguyên.',
  done: 'Đã học',
  inviteText: 'Bạn muốn học cách làm game không?',
  inviteYes: 'Có',
  inviteNo: 'Không',
  stepOf: (n: number, total: number) => `Bước ${n}/${total}`,
  back: '◀ Quay lại',
  next: 'Tiếp',
  nextHeld: 'Tiếp ▶',
  skip: 'Bỏ qua bước này',
  exit: 'Thoát',
  exitTitle: 'Thoát bài học và về game của bạn',
  finish: 'Hoàn thành',
  finished: (title: string) => `Bạn đã xong bài "${title}"!`,
  exited: 'Đã về game của bạn',
  restored: 'Đã khôi phục game của bạn',
  saveBlocked: 'Đang học: hãy bấm Thoát để về game của bạn rồi mới lưu.',
  backAtPlay: 'Bạn đang ở bước này rồi. Bấm Tiếp để đi tiếp.',
  nextLesson: 'Bài tiếp theo',
} as const;

export const LESSON_TEXT = {
  l1: {
    title: '1. Đi và nhảy',
    summary: 'Làm nhân vật biết chạy và nhảy trên sàn.',
    boardName: 'Bài 1 - Đi và nhảy',
    intro: {
      title: 'Chào bạn!',
      text: 'Game được làm từ các khối. Mỗi khối làm một việc. Bạn nối chúng bằng dây để chúng nói chuyện với nhau.',
      explain: 'Khối nằm ở cột bên trái. Bảng ở giữa là nơi bạn nối dây.',
    },
    floor: {
      title: 'Làm sàn nhà',
      text: 'Kéo khối "Khối" từ cột bên trái thả vào bảng ở giữa.',
      explain: 'Khối là một cục vuông đứng yên trong game. Ta dùng nó làm sàn.',
    },
    size: {
      title: 'Kéo dài sàn',
      text: 'Ở bảng Thuộc tính, đổi Kích thước X thành 20 để sàn dài ra.',
      explain: 'Kích thước X là chiều ngang. Số càng lớn thì sàn càng dài.',
    },
    hero: {
      title: 'Thêm nhân vật',
      text: 'Kéo khối "Nhân vật" vào bảng.',
      explain: 'Nhân vật là người bạn điều khiển. Nó nhận lệnh đi và nhảy qua các cổng bên trái.',
    },
    play: {
      title: 'Thử chơi',
      text: 'Bấm nút "Chơi" ở trên cùng.',
      explain: 'Nhân vật rơi xuống và đứng trên sàn. Nhưng chưa điều khiển được vì chưa nối dây.',
    },
    edit: {
      title: 'Quay lại sửa',
      text: 'Bấm nút "Sửa" để trở về chỉnh game.',
    },
    stick: {
      title: 'Thêm cần điều khiển',
      text: 'Kéo khối "Cần điều khiển" vào bảng.',
      explain: 'Cần điều khiển đọc các phím mũi tên. Nó báo cho bạn biết đang bấm sang trái hay sang phải.',
    },
    wireStick: {
      title: 'Nối để chạy',
      text: 'Kéo từ cổng "Ngang" (bên phải cần điều khiển) sang cổng "Đi ngang" (bên trái nhân vật).',
      explain: 'Cổng ra ở bên phải khối, cổng vào ở bên trái. Dây cùng màu mới nối được với nhau.',
    },
    key: {
      title: 'Thêm phím nhảy',
      text: 'Kéo khối "Phím bấm" vào bảng.',
      explain: 'Khối này biết một phím có đang được giữ hay không. Mặc định là phím Cách (Space).',
    },
    wireKey: {
      title: 'Nối để nhảy',
      text: 'Nối cổng "Đang giữ" của Phím bấm sang cổng "Nhảy" của nhân vật.',
      explain: 'Cổng "Đang giữ" bật lên khi bạn giữ phím. Lúc đó nhân vật sẽ nhảy.',
    },
    playMove: {
      title: 'Chơi thử nào',
      text: 'Bấm "Chơi". Dùng phím mũi tên để chạy, phím Cách để nhảy.',
    },
    done: {
      title: 'Giỏi lắm!',
      text: 'Nhân vật của bạn đã chạy và nhảy được. Thử vài lần cho vui, rồi bấm Hoàn thành.',
    },
  },
  l2: {
    title: '2. Nhặt sao, tính điểm',
    summary: 'Nhặt ngôi sao và hiện điểm trên màn hình.',
    boardName: 'Bài 2 - Nhặt sao',
    intro: {
      title: 'Thêm ngôi sao',
      text: 'Bảng này đã có sẵn nhân vật biết chạy nhảy. Bây giờ ta thêm ngôi sao để nhặt và đếm điểm.',
      explain: 'Bạn cứ làm theo từng bước, mỗi bước chỉ một việc nhỏ.',
    },
    star: {
      title: 'Thêm một khối nữa',
      text: 'Kéo thêm một khối "Khối" vào bảng. Đây sẽ là ngôi sao.',
      explain: 'Khối nào cũng giống nhau lúc đầu. Ta đổi thuộc tính để nó thành sàn hay thành sao.',
    },
    type: {
      title: 'Biến nó thành vật nhặt',
      text: 'Chọn khối mới. Ở Thuộc tính, đổi "Loại khối" thành "Vật nhặt".',
      explain: 'Vật nhặt không chặn đường. Nhân vật đi xuyên qua được, nên ta biết khi nào nhân vật chạm vào.',
    },
    place: {
      title: 'Đặt ngôi sao đúng chỗ',
      text: 'Đổi Vị trí X thành 4 và Y thành 1. Ngôi sao sẽ nằm trên sàn, bên phải nhân vật.',
      explain: 'Bạn cũng có thể kéo vật thể ngay trong khung game để đặt.',
    },
    touch: {
      title: 'Thêm cảm biến chạm',
      text: 'Kéo khối "Cảm biến chạm" vào bảng.',
      explain: 'Khối này biết hai vật có đang chạm nhau không.',
    },
    wireA: {
      title: 'Nối nhân vật vào cảm biến',
      text: 'Nối cổng "Nhân vật" (bên phải nhân vật) sang cổng "Vật A" của Cảm biến chạm.',
      explain: 'Cổng màu cam là cổng "vật thể". Nó đại diện cho cả cái vật đó.',
    },
    wireB: {
      title: 'Nối ngôi sao vào cảm biến',
      text: 'Nối cổng "Khối" của ngôi sao sang cổng "Vật B".',
    },
    hide: {
      title: 'Nhặt xong thì biến mất',
      text: 'Nối cổng "Đang chạm" của cảm biến sang cổng "Ẩn đi" của ngôi sao.',
      explain: 'Khi nhân vật chạm, ngôi sao được lệnh "ẩn đi" và biến mất như đã nhặt.',
    },
    counter: {
      title: 'Thêm bộ đếm',
      text: 'Kéo khối "Bộ đếm" vào bảng.',
      explain: 'Bộ đếm nhớ một con số. Mỗi lần nhận tín hiệu "Cộng 1", nó tăng lên một.',
    },
    wireCount: {
      title: 'Mỗi lần chạm, cộng một',
      text: 'Nối cổng "Vừa chạm" của cảm biến sang cổng "Cộng 1" của bộ đếm.',
      explain: '"Vừa chạm" chỉ bật đúng một lần lúc bắt đầu chạm, nên mỗi sao chỉ tính một điểm.',
    },
    show: {
      title: 'Hiện điểm lên màn hình',
      text: 'Kéo khối "Hiện số" vào bảng.',
      explain: 'Khối này vẽ một con số trên góc màn hình lúc chơi.',
    },
    wireShow: {
      title: 'Nối số đếm ra màn hình',
      text: 'Nối cổng "Số đếm" của bộ đếm sang cổng "Số cần hiện".',
    },
    play: {
      title: 'Đi nhặt sao',
      text: 'Bấm "Chơi", chạy sang phải và chạm vào ngôi sao. Xem điểm tăng lên!',
    },
    done: {
      title: 'Tuyệt vời!',
      text: 'Ngôi sao biến mất và điểm tăng lên một. Bấm Hoàn thành khi bạn đã thử xong.',
    },
  },
  l3: {
    title: '3. Thắng và thua',
    summary: 'Cho game một kết thúc: nhặt đủ sao thì thắng, rơi xuống vực thì thua.',
    boardName: 'Bài 3 - Thắng và thua',
    intro: {
      title: 'Cho game kết thúc',
      text: 'Bảng này đã có sẵn game nhặt sao. Giờ ta định ra khi nào thắng, khi nào thua.',
      explain: 'Thắng khi nhặt đủ sao. Thua khi nhân vật rơi khỏi sàn.',
    },
    goal: {
      title: 'Đặt mục tiêu',
      text: 'Chọn khối Bộ đếm. Đổi "Mục tiêu" thành 1, vì game chỉ có một ngôi sao.',
      explain: 'Khi số đếm đạt mục tiêu, cổng "Đã đủ" của bộ đếm sẽ bật lên.',
    },
    end: {
      title: 'Thêm khối kết thúc',
      text: 'Kéo khối "Thắng/Thua" vào bảng.',
      explain: 'Khi cổng "Thắng" bật, game báo thắng. Khi cổng "Thua" bật, game báo thua.',
    },
    wireWin: {
      title: 'Đủ sao thì thắng',
      text: 'Nối cổng "Đã đủ" của bộ đếm sang cổng "Thắng".',
    },
    compare: {
      title: 'Thêm khối so sánh',
      text: 'Kéo khối "So sánh" vào bảng.',
      explain: 'So sánh hai con số rồi báo Đúng hoặc Sai.',
    },
    wireHeight: {
      title: 'Lấy độ cao nhân vật',
      text: 'Nối cổng "Vị trí Y" của nhân vật sang cổng "Số A" của So sánh.',
      explain: 'Vị trí Y là độ cao. Rơi xuống thấp thì số này càng nhỏ.',
    },
    op: {
      title: 'Chọn kiểu so sánh',
      text: 'Chọn khối So sánh. Đổi "Kiểu so sánh" thành "< nhỏ hơn".',
    },
    constant: {
      title: 'Thêm một con số cố định',
      text: 'Kéo khối "Hằng số" vào bảng.',
      explain: 'Hằng số là một con số không đổi. Ở đây nó là mức "quá thấp".',
    },
    constValue: {
      title: 'Đặt mức quá thấp',
      text: 'Chọn Hằng số, đổi "Giá trị" thành -5.',
    },
    wireLimit: {
      title: 'Nối mức quá thấp',
      text: 'Nối cổng "Số" của Hằng số sang cổng "Số B" của So sánh.',
    },
    wireLose: {
      title: 'Rơi quá thấp thì thua',
      text: 'Nối cổng "Đúng" của So sánh sang cổng "Thua".',
      explain: 'Khi độ cao nhỏ hơn -5, cổng "Đúng" bật lên và game báo thua.',
    },
    play: {
      title: 'Chơi thử',
      text: 'Bấm "Chơi".',
    },
    win: {
      title: 'Nhặt sao để thắng',
      text: 'Chạy sang phải và chạm vào ngôi sao để thắng nhé.',
      explain: 'Muốn thử thua thì cứ chạy rơi khỏi mép sàn.',
    },
    done: {
      title: 'Bạn làm được rồi!',
      text: 'Bây giờ bạn đã biết làm một game có đi, nhảy, nhặt đồ, thắng và thua. Bấm Hoàn thành rồi tự làm game của riêng mình nhé.',
    },
  },
} as const;
