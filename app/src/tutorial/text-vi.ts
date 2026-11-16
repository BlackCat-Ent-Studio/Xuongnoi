/** All Vietnamese text of the in-app tutorial. */

export const TUTORIAL_UI = {
  button: '📘 Hướng dẫn',
  menuTitle: 'Bài học',
  menuHint: 'Mỗi bài có bảng riêng. Mô phỏng của bạn không bị đổi.',
  done: 'Đã học',
  inviteText: 'Bạn muốn học cách làm mô phỏng không?',
  inviteYes: 'Có',
  inviteNo: 'Không',
  stepOf: (n: number, total: number) => `Bước ${n}/${total}`,
  back: '◀ Quay lại',
  next: 'Tiếp',
  nextHeld: 'Tiếp ▶',
  skip: 'Bỏ qua bước này',
  exit: 'Thoát',
  exitTitle: 'Thoát bài học và về mô phỏng của bạn',
  finish: 'Hoàn thành',
  finished: (title: string) => `Bạn đã xong bài "${title}"!`,
  exited: 'Đã về mô phỏng của bạn',
  restored: 'Đã khôi phục mô phỏng của bạn',
  saveBlocked: 'Đang học: hãy bấm Thoát để về mô phỏng của bạn rồi mới lưu.',
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
      text: 'Game được làm từ các mảnh ghép. Mỗi mảnh ghép làm một việc. Bạn nối chúng bằng dây để chúng nói chuyện với nhau.',
      explain: 'Mảnh ghép nằm ở cột bên trái. Bảng ở giữa là nơi bạn nối dây.',
    },
    floor: {
      title: 'Làm sàn nhà',
      text: 'Kéo mảnh ghép "Mảnh ghép" từ cột bên trái thả vào bảng ở giữa.',
      explain: 'Vật thể là một cục vuông đứng yên trong game. Ta dùng nó làm sàn.',
    },
    size: {
      title: 'Kéo dài sàn',
      text: 'Ở bảng Thuộc tính, đổi Kích thước X thành 20 để sàn dài ra.',
      explain: 'Kích thước X là chiều ngang. Số càng lớn thì sàn càng dài.',
    },
    hero: {
      title: 'Thêm nhân vật',
      text: 'Kéo mảnh ghép "Nhân vật" vào bảng.',
      explain: 'Nhân vật là người bạn điều khiển. Nó nhận lệnh đi và nhảy qua các cổng bên trái.',
    },
    play: {
      title: 'Chạy thử',
      text: 'Bấm nút "Chạy" ở trên cùng.',
      explain: 'Nhân vật rơi xuống và đứng trên sàn. Nhưng chưa điều khiển được vì chưa nối dây.',
    },
    edit: {
      title: 'Quay lại sửa',
      text: 'Bấm nút "Dừng" để trở về chỉnh game.',
    },
    stick: {
      title: 'Thêm cần điều khiển',
      text: 'Kéo mảnh ghép "Cần điều khiển" vào bảng.',
      explain: 'Cần điều khiển đọc các phím mũi tên. Nó báo cho bạn biết đang bấm sang trái hay sang phải.',
    },
    wireStick: {
      title: 'Nối để chạy',
      text: 'Kéo từ cổng "Trục ngang" (bên phải cần điều khiển) sang cổng "Đi ngang" (bên trái nhân vật).',
      explain: 'Cổng ra ở bên phải mảnh ghép, cổng vào ở bên trái. Dây cùng màu mới nối được với nhau.',
    },
    key: {
      title: 'Thêm phím nhảy',
      text: 'Kéo mảnh ghép "Phím bấm" vào bảng.',
      explain: 'Mảnh ghép này biết một phím có đang được giữ hay không. Mặc định là phím Cách (Space).',
    },
    wireKey: {
      title: 'Nối để nhảy',
      text: 'Nối cổng "Đang giữ phím" của Phím bấm sang cổng "Nhảy" của nhân vật.',
      explain: 'Cổng "Đang giữ phím" bật lên khi bạn giữ phím. Lúc đó nhân vật sẽ nhảy.',
    },
    playMove: {
      title: 'Chạy thử nào',
      text: 'Bấm "Chạy". Dùng phím mũi tên để chạy, phím Cách để nhảy.',
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
      title: 'Thêm một mảnh ghép nữa',
      text: 'Kéo thêm một mảnh ghép "Mảnh ghép" vào bảng. Đây sẽ là ngôi sao.',
      explain: 'Vật thể nào cũng giống nhau lúc đầu. Ta đổi thuộc tính để nó thành sàn hay thành sao.',
    },
    type: {
      title: 'Biến nó thành vật nhặt',
      text: 'Chọn hộp mới. Ở Thuộc tính, đổi "Loại hộp" thành "Vật nhặt".',
      explain: 'Vật nhặt không chặn đường. Nhân vật đi xuyên qua được, nên ta biết khi nào nhân vật chạm vào.',
    },
    place: {
      title: 'Đặt ngôi sao đúng chỗ',
      text: 'Đổi Vị trí X thành 4 và Y thành 1. Ngôi sao sẽ nằm trên sàn, bên phải nhân vật.',
      explain: 'Bạn cũng có thể kéo vật thể ngay trong khung game để đặt.',
    },
    touch: {
      title: 'Thêm Va chạm',
      text: 'Kéo mảnh ghép "Va chạm" vào bảng.',
      explain: 'Mảnh ghép này biết hai vật có đang chạm nhau không.',
    },
    wireA: {
      title: 'Nối nhân vật vào Va chạm',
      text: 'Nối cổng "Đối tượng" (bên phải nhân vật) sang cổng "Đối tượng A" của Va chạm.',
      explain: 'Cổng màu cam là cổng "vật thể". Nó đại diện cho cả cái vật đó.',
    },
    wireB: {
      title: 'Nối ngôi sao vào Va chạm',
      text: 'Nối cổng "Đối tượng" của ngôi sao sang cổng "Đối tượng B".',
    },
    hide: {
      title: 'Nhặt xong thì biến mất',
      text: 'Nối cổng "Đang chạm" của Va chạm sang cổng "Ẩn" của ngôi sao.',
      explain: 'Khi nhân vật chạm, ngôi sao được lệnh "ẩn đi" và biến mất như đã nhặt.',
    },
    counter: {
      title: 'Thêm bộ đếm',
      text: 'Kéo mảnh ghép "Bộ đếm" vào bảng.',
      explain: 'Bộ đếm nhớ một con số. Mỗi lần nhận tín hiệu "Tăng 1", nó tăng lên một.',
    },
    wireCount: {
      title: 'Mỗi lần chạm, cộng một',
      text: 'Nối cổng "Bắt đầu chạm" của Va chạm sang cổng "Tăng 1" của bộ đếm.',
      explain: '"Bắt đầu chạm" chỉ bật đúng một lần lúc bắt đầu chạm, nên mỗi sao chỉ tính một điểm.',
    },
    show: {
      title: 'Hiện điểm lên màn hình',
      text: 'Kéo mảnh ghép "Hiện số" vào bảng.',
      explain: 'Mảnh ghép này vẽ một con số trên góc màn hình lúc chạy.',
    },
    wireShow: {
      title: 'Nối số đếm ra màn hình',
      text: 'Nối cổng "Số đếm" của bộ đếm sang cổng "Giá trị".',
    },
    play: {
      title: 'Đi nhặt sao',
      text: 'Bấm "Chạy", chạy sang phải và chạm vào ngôi sao. Xem điểm tăng lên!',
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
      text: 'Chọn mảnh ghép Bộ đếm. Đổi "Mục tiêu" thành 1, vì game chỉ có một ngôi sao.',
      explain: 'Khi số đếm đạt mục tiêu, cổng "Đã đạt mục tiêu" của bộ đếm sẽ bật lên.',
    },
    end: {
      title: 'Thêm mảnh ghép kết thúc',
      text: 'Kéo mảnh ghép "Thắng / Thua" vào bảng.',
      explain: 'Khi cổng "Thắng" bật, game báo thắng. Khi cổng "Thua" bật, game báo thua.',
    },
    wireWin: {
      title: 'Đủ sao thì thắng',
      text: 'Nối cổng "Đã đạt mục tiêu" của bộ đếm sang cổng "Thắng".',
    },
    compare: {
      title: 'Thêm mảnh ghép so sánh',
      text: 'Kéo mảnh ghép "So sánh" vào bảng.',
      explain: 'So sánh hai con số rồi báo Đúng hoặc Sai.',
    },
    wireHeight: {
      title: 'Lấy độ cao nhân vật',
      text: 'Nối cổng "Vị trí Y" của nhân vật sang cổng "Số A" của So sánh.',
      explain: 'Vị trí Y là độ cao. Rơi xuống thấp thì số này càng nhỏ.',
    },
    op: {
      title: 'Chọn kiểu so sánh',
      text: 'Chọn mảnh ghép So sánh. Đổi "Kiểu so sánh" thành "< nhỏ hơn".',
    },
    constant: {
      title: 'Thêm một con số cố định',
      text: 'Kéo mảnh ghép "Số cố định" vào bảng.',
      explain: 'Số cố định là một con số không đổi. Ở đây nó là mức "quá thấp".',
    },
    constValue: {
      title: 'Đặt mức quá thấp',
      text: 'Chọn Số cố định, đổi "Giá trị" thành -5.',
    },
    wireLimit: {
      title: 'Nối mức quá thấp',
      text: 'Nối cổng "Giá trị" của Số cố định sang cổng "Số B" của So sánh.',
    },
    wireLose: {
      title: 'Rơi quá thấp thì thua',
      text: 'Nối cổng "Kết quả" của So sánh sang cổng "Thua".',
      explain: 'Khi độ cao nhỏ hơn -5, cổng "Kết quả" bật lên và game báo thua.',
    },
    play: {
      title: 'Chạy thử',
      text: 'Bấm "Chạy".',
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
  l4: {
    title: '4. Cầm và dùng đồ',
    summary: 'Nhặt chìa khoá, mang tới ổ khoá và mở cánh cửa chắn đường.',
    boardName: 'Bài 4 - Cầm và dùng đồ',
    intro: {
      title: 'Cánh cửa bị khoá',
      text: 'Bảng này có sẵn nhân vật, sàn, một cánh cửa chắn đường, một cái thùng tím là ổ khoá và ô xanh là đích. Ta cần làm chiếc chìa để mở cửa.',
      explain: 'Nhân vật có thể cầm đồ, thả hoặc ném đồ, và "tương tác" với đồ ở gần.',
    },
    item: {
      title: 'Thêm một món đồ',
      text: 'Kéo mảnh ghép "Đồ vật" vào bảng. Đây sẽ là chiếc chìa khoá.',
      explain: 'Đồ vật rơi xuống đất và không chặn đường. Nhân vật nhặt được nó lên.',
    },
    shape: {
      title: 'Biến nó thành chìa khoá',
      text: 'Chọn đồ vật mới. Ở Thuộc tính, đổi "Hình dạng" thành "Chìa khoá".',
      explain: 'Hình dạng chỉ để nhìn cho đẹp. Bạn còn có hộp, quả bóng và thùng.',
    },
    carry: {
      title: 'Thêm mảnh ghép cầm / thả',
      text: 'Kéo mảnh ghép "Khiêng đồ" vào bảng.',
      explain: 'Mảnh ghép này cho nhân vật cầm món đồ ở gần. Mỗi nhân vật chỉ cầm được một món.',
    },
    wireCarry: {
      title: 'Nói ai sẽ cầm',
      text: 'Nối cổng "Đối tượng" (bên phải nhân vật) sang cổng "Nhân vật" của mảnh ghép Khiêng đồ.',
    },
    keyE: {
      title: 'Thêm phím để cầm',
      text: 'Kéo thêm một mảnh ghép "Phím bấm" vào bảng.',
      explain: 'Mảnh ghép Phím bấm đầu tiên đang dùng cho nhảy, nên ta cần một mảnh ghép nữa.',
    },
    keyECode: {
      title: 'Chọn phím E',
      text: 'Chọn mảnh ghép Phím bấm mới. Ở Thuộc tính, bấm ô "Phím" rồi nhấn phím E.',
    },
    wireGrab: {
      title: 'Bấm E để cầm',
      text: 'Nối cổng "Khi nhấn phím" của phím E sang cổng "Nhấc lên" của mảnh ghép Khiêng đồ.',
      explain: '"Khi nhấn phím" chỉ bật một nhịp lúc nhấn xuống, nên mỗi lần bấm chỉ cầm một lần.',
    },
    playCarry: {
      title: 'Thử cầm chìa',
      text: 'Bấm "Chạy". Đi sang phải tới chiếc chìa rồi bấm E. Chìa sẽ nằm trên đầu bạn.',
    },
    edit: {
      title: 'Quay lại sửa',
      text: 'Bấm nút "Dừng" để làm tiếp phần mở cửa.',
    },
    interact: {
      title: 'Thêm mảnh ghép tương tác',
      text: 'Kéo mảnh ghép "Tương tác" vào bảng.',
      explain: 'Khi bấm, nhân vật "dùng" món đồ gần nhất. Món đồ đó sẽ báo "Khi được tương tác".',
    },
    wireInteract: {
      title: 'Nói ai sẽ tương tác',
      text: 'Nối cổng "Đối tượng" của nhân vật sang cổng "Nhân vật" của mảnh ghép Tương tác.',
    },
    keyF: {
      title: 'Thêm phím để dùng',
      text: 'Kéo thêm một mảnh ghép "Phím bấm" nữa vào bảng.',
    },
    keyFCode: {
      title: 'Chọn phím F',
      text: 'Chọn mảnh ghép Phím bấm mới nhất. Đổi "Phím" thành phím F.',
    },
    wirePress: {
      title: 'Bấm F để dùng',
      text: 'Nối cổng "Khi nhấn phím" của phím F sang cổng "Bấm" của mảnh ghép Tương tác.',
    },
    and: {
      title: 'Chỉ mở khi có chìa',
      text: 'Kéo mảnh ghép "Và" vào bảng.',
      explain: 'Mảnh ghép "Và" chỉ bật khi cả hai đầu vào cùng bật. Ở đây: vừa dùng ổ khoá, vừa đang cầm chìa.',
    },
    wireLock: {
      title: 'Ổ khoá vừa được dùng',
      text: 'Nối cổng "Khi được tương tác" của cái thùng tím (ổ khoá) sang cổng "A" của mảnh ghép Và.',
      explain: 'Thùng tím là đồ vật "Cố định": không cầm được, chỉ để bấm F vào.',
    },
    wireHolding: {
      title: 'Đang cầm chìa',
      text: 'Nối cổng "Đang khiêng" của mảnh ghép Khiêng đồ sang cổng "B" của mảnh ghép Và.',
    },
    wireOpen: {
      title: 'Mở cửa',
      text: 'Nối cổng "Kết quả" của mảnh ghép Và sang cổng "Ẩn" của cánh cửa (mảnh ghép cao màu nâu).',
      explain: 'Cửa bị "ẩn đi" thì biến mất, nhân vật đi qua được.',
    },
    play: {
      title: 'Mở cửa nào',
      text: 'Bấm "Chạy". Nhặt chìa bằng E, mang tới sát cánh cửa rồi bấm F.',
    },
    win: {
      title: 'Đi tới đích',
      text: 'Khi cửa biến mất, chạy sang phải tới ô xanh để thắng.',
      explain: 'Muốn thả chìa, đổi "Cách dùng" của mảnh ghép Khiêng đồ thành "1 phím cầm-thả". Muốn ném, nối thêm một phím vào cổng "Ném".',
    },
    done: {
      title: 'Bạn mở được cửa rồi!',
      text: 'Bạn đã biết cầm, dùng đồ và kết hợp bằng mảnh ghép Và. Thử đổi hình dạng, sức ném, hoặc tự làm một game giấu chìa nhé.',
    },
  },
  l5: {
    title: '5. Dụng cụ cầm tay',
    summary: 'Cầm chiếc cuốc trên tay và đập vỡ tảng đá chắn đường.',
    boardName: 'Bài 5 - Dụng cụ cầm tay',
    intro: {
      title: 'Tảng đá chắn đường',
      text: 'Bảng này có sẵn nhân vật, sàn, một tảng đá cao chắn đường và ô xanh là đích. Ta sẽ làm một chiếc cuốc để đập vỡ tảng đá.',
      explain: 'Ngoài việc khiêng đồ trên đầu, nhân vật còn cầm được dụng cụ trên tay và vung nó vào thứ ở phía trước.',
    },
    item: {
      title: 'Thêm một món đồ',
      text: 'Kéo mảnh ghép "Đồ vật" vào bảng. Đây sẽ là chiếc cuốc.',
    },
    shape: {
      title: 'Biến nó thành cái cuốc',
      text: 'Chọn đồ vật mới. Ở Thuộc tính, đổi "Hình dạng" thành "Cuốc".',
      explain: 'Bạn còn có kiếm, búa, đuốc, gậy phép và xô nước để tự làm game khác.',
    },
    hold: {
      title: 'Cho cầm trên tay',
      text: 'Vẫn ở đồ vật đó, đổi "Cách cầm" thành "Cầm trên tay".',
      explain: 'Món "Khiêng trên đầu" dùng với mảnh ghép Khiêng đồ. Món "Cầm trên tay" dùng với mảnh ghép Cầm dụng cụ, hai bên không lẫn vào nhau.',
    },
    tool: {
      title: 'Thêm mảnh ghép Cầm dụng cụ',
      text: 'Kéo mảnh ghép "Cầm dụng cụ" vào bảng.',
      explain: 'Mảnh ghép này cho nhân vật nhặt dụng cụ, cất xuống, và vung dụng cụ vào thứ ở phía trước.',
    },
    wireTool: {
      title: 'Nói ai sẽ cầm',
      text: 'Nối cổng "Đối tượng" (bên phải nhân vật) sang cổng "Nhân vật" của mảnh ghép Cầm dụng cụ.',
    },
    keyE: {
      title: 'Thêm phím để cầm',
      text: 'Kéo thêm một mảnh ghép "Phím bấm" vào bảng.',
    },
    keyECode: {
      title: 'Chọn phím E',
      text: 'Chọn mảnh ghép Phím bấm mới. Ở Thuộc tính, bấm ô "Phím" rồi nhấn phím E.',
    },
    wireEquip: {
      title: 'Bấm E để cầm hoặc cất',
      text: 'Nối cổng "Khi nhấn phím" của phím E sang cổng "Cầm / Cất (cũ)" của mảnh ghép Cầm dụng cụ.',
      explain: 'Bấm lần một thì nhặt dụng cụ gần nhất lên tay, bấm lần nữa thì đặt xuống.',
    },
    keyF: {
      title: 'Thêm phím để vung',
      text: 'Kéo thêm một mảnh ghép "Phím bấm" nữa vào bảng.',
    },
    keyFCode: {
      title: 'Chọn phím F',
      text: 'Chọn mảnh ghép Phím bấm mới nhất. Đổi "Phím" thành phím F.',
    },
    wireUse: {
      title: 'Bấm F để vung',
      text: 'Nối cổng "Khi nhấn phím" của phím F sang cổng "Dùng" của mảnh ghép Cầm dụng cụ.',
      explain: 'Mỗi lần vung mất khoảng một phần ba giây, vung xong mới vung tiếp được.',
    },
    playTool: {
      title: 'Thử vung cuốc',
      text: 'Bấm "Chạy". Đi sang phải tới chiếc cuốc, bấm E để cầm, rồi bấm F để vung thử.',
    },
    edit: {
      title: 'Quay lại sửa',
      text: 'Bấm nút "Dừng" để làm tiếp phần đập đá.',
    },
    and: {
      title: 'Chỉ cuốc mới đập được đá',
      text: 'Kéo mảnh ghép "Và" vào bảng.',
      explain: 'Vung dụng cụ nào trúng đá thì đá cũng báo "Khi bị dùng lên". Mảnh ghép "Và" giúp đòi thêm điều kiện: phải đang cầm cuốc.',
    },
    wireRock: {
      title: 'Đá vừa bị dùng lên',
      text: 'Nối cổng "Khi bị dùng lên" của tảng đá (mảnh ghép cao màu xám) sang cổng "A" của mảnh ghép Và.',
    },
    wireInHand: {
      title: 'Cuốc đang ở trên tay',
      text: 'Nối cổng "Đang cầm" của chiếc cuốc sang cổng "B" của mảnh ghép Và.',
    },
    wireBreak: {
      title: 'Đập vỡ đá',
      text: 'Nối cổng "Kết quả" của mảnh ghép Và sang cổng "Ẩn" của tảng đá.',
      explain: 'Đá bị "ẩn đi" thì biến mất, nhân vật đi qua được.',
    },
    play: {
      title: 'Đập đá nào',
      text: 'Bấm "Chạy". Nhặt cuốc bằng E, đi sát tảng đá rồi bấm F.',
    },
    win: {
      title: 'Đi tới đích',
      text: 'Khi đá vỡ, chạy sang phải tới ô xanh để thắng.',
      explain: 'Thử thêm một chiếc kiếm: cầm kiếm vung vào đá thì đá không vỡ, vì điều kiện "đang cầm cuốc" không đúng.',
    },
    done: {
      title: 'Bạn đập được đá rồi!',
      text: 'Bạn đã biết cầm dụng cụ trên tay, vung nó, và dùng mảnh ghép Và để chỉ đúng dụng cụ mới có tác dụng. Thử đổi sang búa hay xô nước nhé.',
    },
  },
  l6: {
    title: '6. Tạo bot',
    summary: 'Làm một lính gác tự đi tuần, chạm vào là thua.',
    boardName: 'Bài 6 - Tạo bot',
    intro: {
      title: 'Bot là gì?',
      text: 'Bảng này có sẵn nhân vật của bạn và sàn nhà. Ta sẽ thêm một "bot": nhân vật tự đi lại mà không cần ai bấm phím.',
      explain: 'Bot cũng là mảnh ghép Nhân vật. Chỉ khác là hướng đi của nó đến từ các mảnh ghép "Bộ não" thay vì từ phím bấm.',
    },
    bot: {
      title: 'Thêm nhân vật thứ hai',
      text: 'Kéo thêm một mảnh ghép "Nhân vật" nữa vào bảng.',
    },
    role: {
      title: 'Cho nó làm bot',
      text: 'Chọn nhân vật mới thêm. Ở Thuộc tính, đổi "Vai trò" thành "Bot".',
      explain: 'Màn hình chỉ bám theo nhân vật "Người chơi". Bot tự chạy nên camera không bám theo nó.',
    },
    patrol: {
      title: 'Thêm bộ não đi tuần',
      text: 'Kéo mảnh ghép "Đi tuần" (nhóm Bộ não) vào bảng.',
      explain: 'Mảnh ghép này cho bot đi qua đi lại giữa điểm A và điểm B, dừng nghỉ một chút ở mỗi đầu.',
    },
    wireSelf: {
      title: 'Nói bộ não điều khiển ai',
      text: 'Nối cổng "Đối tượng" của bot (mảnh ghép Nhân vật mới) sang cổng "Bot" của mảnh ghép Đi tuần.',
      explain: 'Bộ não cần biết bot đang đứng ở đâu thì mới dẫn đường được.',
    },
    wireMove: {
      title: 'Nối hướng đi',
      text: 'Nối cổng "Đi ngang" của mảnh ghép Đi tuần sang cổng "Đi ngang" của bot.',
      explain: 'Giống cần điều khiển: số dương là đi sang phải, số âm là đi sang trái. Chỉ khác là mảnh ghép Đi tuần tự đưa ra con số.',
    },
    playPatrol: {
      title: 'Xem bot đi tuần',
      text: 'Bấm "Chạy". Bot sẽ tự đi qua đi lại trên sàn.',
    },
    edit: {
      title: 'Quay lại sửa',
      text: 'Bấm nút "Dừng" để làm tiếp.',
    },
    touch: {
      title: 'Chạm bot là thua',
      text: 'Kéo mảnh ghép "Va chạm" vào bảng.',
    },
    wireA: {
      title: 'Vật A là bạn',
      text: 'Nối cổng "Đối tượng" của nhân vật bạn điều khiển (mảnh ghép có sẵn) sang cổng "Đối tượng A" của Va chạm.',
    },
    wireB: {
      title: 'Vật B là bot',
      text: 'Nối cổng "Đối tượng" của bot sang cổng "Đối tượng B" của Va chạm.',
    },
    end: {
      title: 'Thêm mảnh ghép kết thúc',
      text: 'Kéo mảnh ghép "Thắng / Thua" vào bảng.',
    },
    wireLose: {
      title: 'Chạm là thua',
      text: 'Nối cổng "Đang chạm" của Va chạm sang cổng "Thua" của mảnh ghép Thắng / Thua.',
    },
    play: {
      title: 'Để bot bắt thử',
      text: 'Bấm "Chạy". Đi sang phải về phía bot cho nó chạm vào bạn.',
    },
    caught: {
      title: 'Bị bắt rồi!',
      text: 'Khi bot chạm vào bạn thì game báo thua. Vậy là lính gác của bạn đã làm việc.',
      explain: 'Muốn bot đuổi theo bạn, dùng mảnh ghép "Đuổi / Trốn". Muốn bot đi lấy đồ, dùng "Di chuyển" cùng "Chuỗi bước".',
    },
    done: {
      title: 'Bạn tạo được bot rồi!',
      text: 'Bạn đã biết đặt vai trò Bot, gắn bộ não Đi tuần và dùng Va chạm để thua khi bị bắt. Hãy thử các bộ não khác trong Sổ tay mảnh ghép nhé.',
    },
  },
  l7: {
    title: '7. Bot quăng thùng',
    summary: 'Bảo bot làm ba việc lần lượt: cầm thùng, mang ra bệ xanh rồi quăng thùng đi, sau đó đi về chỗ cũ.',
    boardName: 'Bài 7 - Bot quăng thùng',
    intro: {
      title: 'Làm lần lượt từng việc',
      text: 'Bot ở bên trái, thùng nằm giữa sàn, bệ xanh ở bên phải. Ta muốn bot làm 3 việc: 1) đi tới thùng và cầm lên, 2) mang ra bệ xanh và quăng thùng đi, 3) đi về chỗ cũ.',
      explain: 'Bảng đã có sẵn 3 mảnh ghép "Di chuyển" (một mảnh ghép cho mỗi việc) và các dây nối hướng đi vào bot. Thiếu mỗi một thứ: ai bảo mảnh ghép nào làm trước.',
    },
    watch: {
      title: 'Xem chuyện gì xảy ra',
      text: 'Bấm "Chạy" để xem bot lúc chưa có ai chỉ huy.',
      explain: 'Cả 3 mảnh ghép Di chuyển cùng kéo bot về những hướng khác nhau nên bot đi lung tung, không làm việc nào ra việc nào.',
    },
    edit: {
      title: 'Quay lại sửa',
      text: 'Bấm nút "Dừng" để làm tiếp.',
    },
    sequence: {
      title: 'Thêm người chỉ huy',
      text: 'Kéo mảnh ghép "Chuỗi bước" (nhóm Bộ não) vào bảng.',
      explain: 'Chuỗi bước chỉ cho một bước chạy mỗi lúc. Xong bước này nó mới bật bước kế tiếp.',
    },
    count: {
      title: 'Đếm số bước',
      text: 'Chọn mảnh ghép Chuỗi bước. Ở Thuộc tính, đổi "Số bước" thành 3.',
      explain: 'Ba việc thì có ba cổng "Bước 1", "Bước 2", "Bước 3" cùng được dùng.',
    },
    wire1: {
      title: 'Bước 1: tới chỗ thùng',
      text: 'Nối cổng "Bước 1" của Chuỗi bước sang cổng "Bật" của mảnh ghép Di chuyển đang chỉ về phía cái thùng (mảnh ghép trên cùng).',
      explain: 'Mảnh ghép Di chuyển chỉ chạy khi "Bật" bật. Bước 1 bật thì chỉ mảnh ghép này làm việc.',
    },
    wire2: {
      title: 'Bước 2: tới bệ xanh',
      text: 'Nối cổng "Bước 2" sang cổng "Bật" của mảnh ghép Di chuyển ở giữa (đích là bệ xanh).',
    },
    wire3: {
      title: 'Bước 3: đi về',
      text: 'Nối cổng "Bước 3" sang cổng "Bật" của mảnh ghép Di chuyển cuối cùng (đích là chỗ bot đứng lúc đầu).',
    },
    wireNext: {
      title: 'Báo xong việc',
      text: 'Nối cổng "Kết quả" của mảnh ghép "Hoặc" (mảnh ghép dưới, nhận tín hiệu từ mảnh ghép Di chuyển cuối) sang cổng "Sang bước kế" của Chuỗi bước.',
      explain: 'Hai mảnh ghép "Hoặc" gom tín hiệu "Khi đến nơi" của cả 3 mảnh ghép Di chuyển. Mỗi lần bot tới nơi, Chuỗi bước nhận một nhịp và chuyển sang bước kế tiếp.',
    },
    playOrder: {
      title: 'Xem bot làm theo thứ tự',
      text: 'Bấm "Chạy". Bot đi tới thùng, rồi ra bệ xanh, rồi đi về. Nhưng nó chưa biết cầm hay quăng thùng.',
    },
    edit2: {
      title: 'Quay lại sửa',
      text: 'Bấm nút "Dừng" để dạy bot cầm và quăng thùng.',
    },
    carry: {
      title: 'Dạy bot cầm đồ',
      text: 'Kéo mảnh ghép "Khiêng đồ" vào bảng.',
      explain: 'Bot cũng dùng được mảnh ghép Khiêng đồ như người chơi, chỉ khác là tín hiệu đến từ các mảnh ghép bộ não thay vì phím bấm.',
    },
    wireCarry: {
      title: 'Nói ai cầm',
      text: 'Nối cổng "Đối tượng" của bot (mảnh ghép Nhân vật màu cam) sang cổng "Nhân vật" của mảnh ghép Khiêng đồ.',
    },
    wireGrab: {
      title: 'Tới thùng thì cầm',
      text: 'Nối cổng "Khi đến nơi" của mảnh ghép Di chuyển thứ nhất (đích là thùng) sang cổng "Nhấc lên" của mảnh ghép Khiêng đồ.',
      explain: '"Khi đến nơi" chỉ bật một nhịp đúng lúc bot tới nơi, rất hợp để bấm "nút" cầm.',
    },
    wireDrop: {
      title: 'Tới bệ thì quăng',
      text: 'Nối cổng "Khi đến nơi" của mảnh ghép Di chuyển thứ hai (đích là bệ xanh) sang cổng "Ném" của mảnh ghép Khiêng đồ.',
      explain: '"Ném" làm bot quăng thùng bay đi thật xa, nên thùng sẽ rơi qua khỏi bệ xanh. Bài sau ta sẽ học cách đặt thùng nhẹ nhàng xuống bệ.',
    },
    wireFinished: {
      title: 'Làm xong hết thì thắng',
      text: 'Kéo thêm dây từ cổng "Đã hoàn thành" của Chuỗi bước sang cổng "Thắng" của mảnh ghép Thắng / Thua.',
      explain: 'Khi cả ba bước xong, Chuỗi bước báo "Đã hoàn thành". Ta dùng tín hiệu đó để kết thúc game.',
    },
    play: {
      title: 'Xem bot làm việc',
      text: 'Bấm "Chạy" và chờ bot: tới thùng, cầm lên, mang ra bệ xanh, quăng thùng bay đi, rồi đi về chỗ cũ.',
    },
    win: {
      title: 'Bot làm xong rồi!',
      text: 'Cả ba việc đã xong theo đúng thứ tự và game báo thắng. Thùng đã bay qua khỏi bệ xanh.',
      explain: 'Muốn bot lặp lại mãi, đổi "Làm hết thì" của Chuỗi bước thành "Lặp lại từ bước 1".',
    },
    done: {
      title: 'Bạn biết giao nhiều việc cho bot rồi!',
      text: 'Bạn đã dùng Chuỗi bước để xếp thứ tự, Di chuyển để bot tự tìm đường và Khiêng đồ để bot cầm và quăng đồ. Thử đổi sang 4 bước hoặc cho bot lặp lại xem sao.',
    },
  },
  l8: {
    title: '8. Bot đặt thùng',
    summary: 'Bot mang thùng ra bệ xanh. Game chỉ thắng khi thùng nằm yên trên bệ, nên phải đổi "Ném" thành "Thả".',
    boardName: 'Bài 8 - Bot đặt thùng',
    intro: {
      title: 'Ném và Thả khác nhau',
      text: 'Bảng này giống bài trước: bot cầm thùng, ra bệ xanh rồi quăng thùng đi. Lần này game chỉ báo thắng khi bot làm xong hết VÀ thùng đang chạm bệ xanh.',
      explain: '"Ném" quăng thùng bay đi xa. "Thả" chỉ buông tay cho thùng rơi xuống ngay chỗ bot đứng. Muốn đặt thùng lên bệ thì phải dùng "Thả".',
    },
    watchThrow: {
      title: 'Xem thùng bay đi',
      text: 'Bấm "Chạy". Nhìn thùng bay qua khỏi bệ xanh và game không báo thắng.',
      explain: 'Bot làm xong cả ba việc nhưng thùng không nằm trên bệ, nên Va chạm không bật. Mảnh ghép "Và" cần cả hai tín hiệu cùng bật mới cho thắng.',
    },
    edit: {
      title: 'Quay lại sửa',
      text: 'Bấm nút "Dừng" để đổi cách bot đặt thùng.',
    },
    removeThrow: {
      title: 'Bỏ dây "Ném"',
      text: 'Bấm vào dây nối từ "Khi đến nơi" của mảnh ghép Di chuyển thứ hai (đích là bệ xanh) sang cổng "Ném", rồi bấm phím Delete để xóa dây.',
      explain: 'Nếu cùng lúc có dây vào cả "Ném" và "Thả" thì "Ném" thắng, thùng vẫn bay đi. Vì vậy phải xóa dây "Ném" trước.',
    },
    wireDrop: {
      title: 'Tới bệ thì thả',
      text: 'Nối cổng "Khi đến nơi" của mảnh ghép Di chuyển thứ hai (đích là bệ xanh) sang cổng "Thả" của mảnh ghép Khiêng đồ.',
    },
    play: {
      title: 'Xem bot đặt thùng',
      text: 'Bấm "Chạy" và chờ bot: cầm thùng, ra bệ xanh, thả thùng xuống bệ, rồi đi về chỗ cũ.',
    },
    win: {
      title: 'Thùng nằm trên bệ rồi!',
      text: 'Thùng nằm yên trên bệ xanh, bot đã về chỗ cũ và game báo thắng.',
      explain: 'Va chạm báo thùng đang chạm bệ, mảnh ghép "Và" gộp với tín hiệu "Đã hoàn thành" nên mới cho thắng.',
    },
    done: {
      title: 'Bạn biết bảo bot đặt đồ rồi!',
      text: '"Ném" để quăng đồ thật xa, "Thả" để đặt đồ xuống ngay chỗ đứng. Nhớ chỉ nối một trong hai cho mỗi lần bot buông thùng.',
    },
  },
} as const;
