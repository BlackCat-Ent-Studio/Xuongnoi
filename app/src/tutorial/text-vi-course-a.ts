/** Vietnamese texts of the course lessons of pack A (titles carry no number: the course numbers them). */

export const SECRET_DOOR_TEXT = {
  title: 'Cửa bí mật',
  summary: 'Một cánh cửa tự mở lúc bắt đầu rồi tự đóng sập sau lưng bạn. Học "Khi bắt đầu" và "Đảo ngược".',
  boardName: 'Cửa bí mật',
  intro: {
    title: 'Cánh cửa chắn đường',
    text: 'Bạn đang đứng trong một căn phòng (hộp xanh mờ), cửa nâu chắn lối ra. Lá cờ vàng nằm ở bên kia. Ta sẽ làm cửa tự mở lúc bắt đầu, rồi tự đóng sập lại khi bạn đã đi ra khỏi phòng.',
    explain: 'Hộp xanh mờ là một "Vùng kích hoạt": nó biết có ai đang ở trong phòng hay không. Chạm vào lá cờ là thắng, phần này đã nối sẵn.',
  },
  onStart: {
    title: 'Thêm Khi bắt đầu',
    text: 'Kéo mảnh ghép "Khi bắt đầu" (nhóm Đầu vào) vào bảng.',
    explain: 'Nó bật đúng một nhịp ngay lúc trò chơi bắt đầu, rồi tắt. Rất hợp để "làm một việc lúc mở màn".',
  },
  open: {
    title: 'Cửa mở lúc bắt đầu',
    text: 'Nối "Khi bắt đầu" của Khi bắt đầu sang cổng "Ẩn" của Vật thể cánh cửa (hộp nâu cao).',
    explain: 'Hộp bị "ẩn đi" thì biến mất và không còn chắn đường. Chỉ một nhịp ngắn là đủ để cửa mở.',
  },
  not: {
    title: 'Thêm mảnh ghép Đảo ngược',
    text: 'Kéo mảnh ghép "Đảo ngược" (nhóm Logic) vào bảng.',
    explain: 'Mảnh ghép "Đảo ngược" đảo ngược tín hiệu: đang bật thì thành tắt, đang tắt thì thành bật.',
  },
  notIn: {
    title: 'Ở trong phòng hay không?',
    text: 'Nối cổng "Đang có đối tượng" của Vùng kích hoạt sang cổng "Đầu vào" của mảnh ghép Đảo ngược.',
    explain: 'Khi bạn còn ở trong phòng, "Đang có đối tượng" bật nên Đảo ngược tắt. Khi bạn đi ra khỏi phòng, Đảo ngược bật lên.',
  },
  close: {
    title: 'Đi ra thì cửa đóng lại',
    text: 'Nối cổng "Kết quả" của mảnh ghép Đảo ngược sang cổng "Hiện" của Vật thể cánh cửa.',
    explain: '"Hiện" cho cánh cửa hiện ra ở chỗ cũ. Cửa sập lại ngay sau lưng bạn, không quay đầu được nữa!',
  },
  play: {
    title: 'Chạy thử',
    text: 'Bấm "Chạy". Dùng phím mũi tên đi sang phải, ra khỏi phòng và chạm lá cờ vàng. Nhớ nhìn cánh cửa sập lại sau lưng.',
  },
  win: {
    title: 'Chạm lá cờ',
    text: 'Đi tới chạm lá cờ vàng. Chạm được là thắng.',
  },
  done: {
    title: 'Cửa bí mật xong rồi!',
    text: 'Bạn đã dùng "Khi bắt đầu" để làm một việc lúc mở màn, và "Đảo ngược" để làm điều ngược lại khi đã rời đi. Thử kéo cửa ra xa hơn, hoặc làm cho phòng nhỏ lại xem sao.',
  },
} as const;

export const CHASE_GAME_TEXT = {
  title: 'Trò đuổi bắt',
  summary: 'Một con bot đỏ đuổi theo bạn, một con bot xanh chạy trốn bạn. Học mảnh ghép "Đuổi / Trốn".',
  boardName: 'Trò đuổi bắt',
  intro: {
    title: 'Hai con bot',
    text: 'Bảng này có bạn (xanh dương), bot đỏ và bot xanh lá. Chạm bot đỏ là thua, chạm bot xanh lá là thắng. Hiện giờ hai bot đứng yên. Ta sẽ cho bot đỏ đuổi bạn, bot xanh lá chạy trốn bạn.',
    explain: 'Hai chỗ chạm đã nối sẵn bằng Va chạm. Phần còn lại là "bộ não" cho hai con bot.',
  },
  chase: {
    title: 'Thêm Đuổi / Trốn',
    text: 'Kéo mảnh ghép "Đuổi / Trốn" (nhóm Bộ não) vào bảng.',
    explain: 'Bot để mắt tới một vật. Thấy vật trong tầm nhìn thì đuổi theo hoặc chạy trốn, vật ra quá xa thì bỏ cuộc.',
  },
  chaseWires: {
    title: 'Nối bộ não cho bot đỏ',
    text: 'Nối ba dây: cổng "Đối tượng" của bot đỏ sang "Bot"; cổng "Đối tượng" của bạn (xanh dương) sang "Mục tiêu"; rồi "Đi ngang" của mảnh ghép sang cổng "Đi ngang" của bot đỏ.',
    explain: '"Bot" là con được điều khiển, "Mục tiêu" là vật nó để mắt tới. Mặc định cách làm là "Đuổi theo".',
  },
  catchDistance: {
    title: 'Khoảng bắt được',
    text: 'Chọn mảnh ghép Đuổi theo vừa nối. Mở mục "Nâng cao" trong Thuộc tính, đổi "Khoảng bắt được" thành 0.8.',
    explain: 'Bot đuổi tới gần bạn thì dừng lại ở khoảng cách này. Thân bạn rộng 1 ô, nên khoảng 0.8 là bot đứng sát và chạm được bạn. Đặt từ 1 trở lên thì bot chỉ đứng cạnh mà không chạm tới.',
  },
  chase2: {
    title: 'Thêm một mảnh ghép nữa',
    text: 'Kéo thêm một mảnh ghép "Đuổi / Trốn" nữa vào bảng, cho bot xanh lá.',
  },
  flee: {
    title: 'Đổi sang Tránh xa',
    text: 'Chọn mảnh ghép mới thêm. Ở Thuộc tính, đổi "Cách làm" thành "Tránh xa".',
    explain: 'Ở cách "Tránh xa", bot chạy ngược hướng với mục tiêu. Ra mép sàn thì nó dừng lại, không nhảy xuống vực.',
  },
  fleeWires: {
    title: 'Nối bộ não cho bot xanh lá',
    text: 'Với mảnh ghép "Tránh xa": nối "Đối tượng" của bot xanh lá sang "Bot", "Đối tượng" của bạn sang "Mục tiêu", và "Đi ngang" của mảnh ghép sang "Đi ngang" của bot xanh lá.',
  },
  play: {
    title: 'Chạy thử',
    text: 'Bấm "Chạy". Dùng phím mũi tên chạy sang phải đuổi bot xanh lá, và đừng để bot đỏ bắt được bạn nhé!',
  },
  win: {
    title: 'Bắt được bot xanh lá',
    text: 'Dồn bot xanh lá vào mép sàn rồi chạm nó. Bot đỏ chạy chậm hơn bạn nên cứ chạy đi.',
  },
  done: {
    title: 'Trò đuổi bắt hay quá!',
    text: 'Một mảnh ghép làm được cả hai việc: đuổi theo và chạy trốn. Thử đổi "Tầm nhìn" để bot thấy xa hơn, hoặc hoán đổi vai: bot đỏ chạy trốn, bot xanh đuổi bạn.',
  },
} as const;

export const COLLIDER_GRAVITY_TEXT = {
  title: 'Va chạm và trọng lực',
  summary: 'Đưa thùng hàng lên bệ trên cao. Học mục "Nâng cao": trọng lực, vùng va chạm và cách tính "nằm trọn bên trong".',
  boardName: 'Va chạm và trọng lực',
  intro: {
    title: 'Thùng lên bệ trên cao',
    text: 'Có một thùng to nằm trên sàn và một bệ xanh lơ lửng rất cao. Bấm G để cầm thùng, bấm Cách (Space) để nhảy, bấm G lần nữa để thả. Ta sẽ chỉnh vài thứ trong mục "Nâng cao" để đưa được thùng lên bệ.',
    explain: 'Nhân vật, phím, Khiêng đồ và Thắng / Thua đã có sẵn. Mục "Nâng cao" nằm gập ở cuối bảng Thuộc tính, bấm vào để mở ra.',
  },
  touch: {
    title: 'Thêm Va chạm',
    text: 'Kéo mảnh ghép "Va chạm" (nhóm Logic) vào bảng.',
    explain: 'Nó kiểm tra hai vật có đang chạm nhau không.',
  },
  touchWires: {
    title: 'Thùng và bệ',
    text: 'Nối cổng "Đối tượng" của cái thùng sang "Đối tượng A", và cổng "Đối tượng" của bệ xanh sang "Đối tượng B" của Va chạm.',
  },
  win: {
    title: 'Chạm là thắng',
    text: 'Nối cổng "Đang chạm" của Va chạm sang cổng "Thắng" của mảnh ghép Thắng / Thua.',
  },
  inside: {
    title: 'Phải nằm trọn bên trong',
    text: 'Chọn Va chạm. Ở Thuộc tính, đổi "Tính khi nào" thành "A nằm trọn trong B".',
    explain: 'Mặc định chỉ cần chạm mép là tính. Chọn "nằm trọn" thì thùng phải lọt hẳn vào trong bệ mới tính. Mảnh ghép Vùng kích hoạt cũng có lựa chọn "Tính khi nào" giống vậy.',
  },
  hold: {
    title: 'Phải nằm yên một lúc',
    text: 'Vẫn ở Va chạm. Đổi "Chạm bao lâu mới tính (giây)" thành 0.5.',
    explain: 'Thùng đang được bạn cầm bay ngang qua bệ thì không tính. Phải nằm yên trong bệ nửa giây mới thắng.',
  },
  heroGravity: {
    title: 'Nhảy cao như trên Mặt Trăng',
    text: 'Chọn nhân vật. Mở mục "Nâng cao", đổi "Hệ số trọng lực" thành 0.3.',
    explain: 'Hệ số 1 là bình thường. Nhỏ hơn thì nhẹ hơn và nhảy cao hơn, lớn hơn thì nặng hơn. Số 0 thì bay lơ lửng.',
  },
  crateGravity: {
    title: 'Thùng bay lơ lửng',
    text: 'Chọn cái thùng. Mở mục "Nâng cao", đổi "Hệ số trọng lực" thành 0.',
    explain: 'Thùng không còn bị kéo xuống. Thả nó ở đâu, nó nằm im ở đó, kể cả giữa trời.',
  },
  collider: {
    title: 'Thu nhỏ vùng va chạm',
    text: 'Vẫn ở cái thùng. Trong "Nâng cao", đổi "Cỡ vùng va chạm" thành X = 1, Y = 1, Z = 1.',
    explain: 'Thùng to thế này không lọt vừa bệ. "Vùng va chạm" là cái hộp vô hình dùng để tính chạm. Thu nhỏ nó thì thùng vẫn to như cũ nhưng dễ lọt vào bệ hơn. Số 0 nghĩa là bằng kích thước thật.',
  },
  play: {
    title: 'Mang thùng lên bệ',
    text: 'Bấm "Chạy". Đứng cạnh thùng, bấm G để cầm. Đi sang phải tới dưới bệ xanh, nhảy lên và bấm G để thả thùng vào trong bệ.',
  },
  won: {
    title: 'Thùng nằm trọn trong bệ',
    text: 'Thả thùng giữa lúc đang ở trên cao. Thùng nằm trọn trong bệ xanh là thắng.',
  },
  done: {
    title: 'Chỉnh được cả trọng lực!',
    text: 'Bạn đã dùng "Hệ số trọng lực", "Cỡ vùng va chạm" và "Tính khi nào". Thử đặt trọng lực của thùng là 2 để nó nặng hơn, hoặc tăng "Cỡ vùng va chạm" xem chuyện gì xảy ra.',
  },
} as const;

export const CONVEYOR_TEXT = {
  title: 'Băng chuyền',
  summary: 'Cho những thùng hàng chạy trên băng chuyền về khu thu hàng. Học Kiểu dáng Băng chuyền, hướng chạy và nút đảo chiều.',
  boardName: 'Băng chuyền',
  intro: {
    title: 'Dây chuyền thu hàng',
    text: 'Trên cái bục có ba thùng xanh lá và một thùng đỏ. Bên trái có khu thu hàng (hộp xanh mờ). Ta sẽ biến cái bục thành băng chuyền chở hàng về khu thu. Thu đủ ba thùng xanh lá là thắng.',
    explain: 'Băng chuyền chở mọi thứ nằm trên mặt nó, kể cả bạn nếu bạn đứng lên.',
  },
  style: {
    title: 'Biến bục thành băng chuyền',
    text: 'Chọn cái bục (Vật thể dài thấp ở giữa). Ở Thuộc tính, đổi "Kiểu dáng" thành "Băng chuyền".',
    explain: 'Kiểu Băng chuyền tự chạy với tốc độ vừa phải dọc theo cạnh dài của hộp.',
  },
  direction: {
    title: 'Cho băng chạy sang trái',
    text: 'Vẫn ở cái bục. Mở mục "Nâng cao", đổi "Hướng băng chuyền" thành "Ngược trục X".',
    explain: 'Trục X chạy từ trái sang phải. "Ngược trục X" là chạy từ phải sang trái, đúng hướng về khu thu hàng.',
  },
  key: {
    title: 'Thêm Phím bấm',
    text: 'Kéo mảnh ghép "Phím bấm" (nhóm Đầu vào) vào bảng. Phím mặc định là Cách (Space).',
  },
  reverse: {
    title: 'Giữ phím để chạy ngược',
    text: 'Nối cổng "Đang giữ phím" của Phím bấm sang cổng "Đảo chiều" của cái bục.',
    explain: 'Chừng nào còn giữ phím, băng chạy ngược lại. Thả phím ra thì băng chạy lại như cũ. Hữu ích khi hàng chạy quá đà.',
  },
  filter: {
    title: 'Khu thu chỉ tính đồ vật',
    text: 'Chọn Vùng kích hoạt (khu thu hàng). Ở Thuộc tính, đổi "Tính những gì" thành "Đồ vật".',
    explain: 'Thùng hàng là "đồ vật". Nhờ vậy nhân vật đi qua khu thu không bị tính nhầm.',
  },
  goods: {
    title: 'Chỉ tính thùng xanh',
    text: 'Vẫn ở Vùng kích hoạt. Điền "Chỉ tính loại hàng" là xanh.',
    explain: 'Ba thùng xanh lá mang nhãn "xanh", thùng đỏ mang nhãn "do". Khu thu chỉ đếm hàng đúng nhãn.',
  },
  min: {
    title: 'Đủ ba thùng mới tính',
    text: 'Vẫn ở Vùng kích hoạt. Đổi "Ít nhất bao nhiêu vật" thành 3.',
    explain: 'Cổng "Đang có đối tượng" chỉ bật khi có từ 3 vật trở lên trong khu thu.',
  },
  win: {
    title: 'Đủ hàng là thắng',
    text: 'Nối cổng "Đang có đối tượng" của Vùng kích hoạt sang cổng "Thắng" của mảnh ghép Thắng / Thua.',
  },
  play: {
    title: 'Mở băng chuyền',
    text: 'Bấm "Chạy" và xem các thùng chạy về bên trái. Thử giữ phím Cách để băng chạy ngược.',
  },
  won: {
    title: 'Chờ hàng về',
    text: 'Chờ ba thùng xanh lá chạy tới khu thu hàng. Thùng đỏ có tới đó cũng không được tính.',
  },
  done: {
    title: 'Dây chuyền chạy tốt!',
    text: 'Bạn đã dùng Kiểu dáng Băng chuyền, hướng chạy, đảo chiều và đếm hàng theo loại. Thử đặt thêm thùng xanh, hoặc đổi "Ít nhất bao nhiêu vật" lên 4.',
  },
} as const;
