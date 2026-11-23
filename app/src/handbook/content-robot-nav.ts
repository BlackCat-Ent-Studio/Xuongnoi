import { tryFloorMarker, tryFloorMarkerFind, tryFloorMarkerSensor, tryRobotGoto } from './boards-robot-nav';
import type { HandbookEntry } from './types';

const LESSON = 'robot-to-marker';

/** Handbook pages of the pieces that let a robot drive freely to a place: the driver, the numbered floor marker and its two readers. */
export const HANDBOOK_ROBOT_NAV: readonly HandbookEntry[] = [
  {
    kind: 'robot-goto',
    purpose:
      'Bộ lái của robot hai động cơ: nhìn robot đang ở đâu, mũi quay hướng nào, rồi tính công suất cho động cơ bên trái và bên phải để robot chạy tới đích và dừng lại ở đó.',
    whenToUse:
      'Khi robot phải tự chạy tới một chỗ trên sàn trống mà không có vạch để dò: xe tự hành trong kho chạy từ trạm nhận hàng tới cửa đổ hàng, robot quay về chỗ đỗ, robot đi lần lượt qua nhiều mốc.',
    ports: {
      robot: 'Vào: Thân robot cần lái. Bắt buộc nối. Chưa nối thì mọi cổng ra đều là 0 và tắt.',
      target:
        'Vào: vật đánh dấu đích, thường là "Đối tượng" của một Mốc sàn hoặc "Mốc" của Tìm mốc sàn; vật nào cũng được (thùng hàng, robot khác). Chỉ dùng khi "Đích lấy từ" đang chọn cổng này. Để trống, hoặc vật đang ẩn, thì robot đứng chờ.',
      go: 'Vào: bật thì robot được phép chạy, tắt thì hai công suất về 0 và robot dừng lại. Không nối dây thì robot không bao giờ chạy. Nối "Đã bắt đầu" của Khi bắt đầu, hoặc tín hiệu "đường trống" từ cảm biến.',
      x: 'Vào (số): toạ độ X của đích, tính bằng mét. Chỉ có khi "Đích lấy từ" chọn "Hai con số".',
      z: 'Vào (số): toạ độ Z của đích, tính bằng mét. Chỉ có khi "Đích lấy từ" chọn "Hai con số".',
      face: 'Vào (số): hướng mũi robot phải quay về sau khi tới nơi, tính bằng độ (0 = sang phải, 90 = xuống dưới, giống "Hướng" của Thân robot). Chỉ có khi bật "Tới nơi thì quay mũi về một hướng". Không nối dây thì là 0.',
      left: 'Ra (số): công suất cho động cơ bên trái, từ -1 đến 1. Nối sang "Công suất" của Động cơ gắn bên trái thân.',
      right: 'Ra (số): công suất cho động cơ bên phải, từ -1 đến 1. Nối sang "Công suất" của Động cơ gắn bên phải thân.',
      arrived:
        'Ra: bật khi robot đã ở trong khoảng "Coi như đã tới" quanh đích (và đã quay đúng hướng, nếu có chọn). Giữ bật cho tới khi robot bị đẩy ra xa hơn 1,5 lần khoảng đó hoặc đích đổi sang chỗ khác. Không phụ thuộc "Chạy".',
      arrivedPulse: 'Ra: bật đúng một nhịp lúc "Đã tới" vừa bật. Dùng để đếm chuyến, chuyển sang đích kế tiếp, bật khay đổ hàng.',
      distance: 'Ra (số): khoảng cách từ tâm robot tới đích, tính bằng mét. Chưa có đích thì là 0.',
      headingError: 'Ra (số): mũi robot đang lệch bao nhiêu độ so với hướng tới đích. Số dương là đích nằm bên phải, số âm là bên trái. Tới nơi rồi thì là 0 (hoặc độ lệch so với "Hướng khi tới").',
    },
    params: {
      targetFrom:
        'Đích lấy từ đâu. "Vật nối vào cổng Đích" (mặc định): tới chỗ vật đó đang đứng. "Điểm đặt sẵn": tới điểm gõ ở ô bên dưới. "Hai con số": hiện thêm hai cổng "Đích X", "Đích Z" để nối số vào (ví dụ X, Z của Mốc sàn hoặc số lấy từ Bảng giá trị).',
      targetPos: 'Điểm đích khi chọn "Điểm đặt sẵn", tính bằng mét. Chỉ x và z được dùng.',
      power: 'Công suất lớn nhất mảnh này giao cho mỗi động cơ, từ 0 đến 1. Mặc định 0,6. Số lớn thì robot chạy và quay nhanh hơn, nhưng hàng chở trên khay dễ trượt hơn.',
      tolerance: 'Robot được coi là "đã tới" khi tâm của nó cách đích không quá số mét này. Mặc định 0,1. Robot vẫn lăn tiếp vào gần giữa (khoảng một phần tư con số này) rồi mới dừng.',
      slowDistance: 'Từ khoảng cách này (mét) robot bắt đầu chậm dần: công suất giảm đều theo quãng đường còn lại. Mặc định 1. Đặt 0 thì chạy hết ga tới sát đích, dễ trượt quá.',
      turnGain: 'Mỗi độ lệch hướng đổi thành bao nhiêu công suất rẽ. Mặc định 0,02 (lệch 30 độ là rẽ hết cỡ ở công suất 0,6). Số lớn thì bẻ lái gắt, số nhỏ thì lượn vòng rộng.',
      pivotAngle: 'Lệch hướng từ bao nhiêu độ trở lên thì robot đứng lại quay tại chỗ, không chạy tới nữa. Dưới mức này robot vừa chạy vừa rẽ, càng lệch càng chạy chậm. Mặc định 45.',
      turnDamp: 'Nâng cao. Bớt công suất rẽ khi robot đang quay nhanh, để mũi không lắc qua lắc lại quanh hướng đích. Mặc định 0,002 cho mỗi độ/giây. Đặt 0 là tắt.',
      minPower: 'Nâng cao. Công suất nhỏ nhất khi robot còn đang đi, để mấy xăng-ti-mét cuối không kéo dài mãi. Mặc định 0,08.',
      faceOnArrive: 'Nâng cao. Chọn "Có" thì hiện cổng "Hướng khi tới": tới nơi robot quay tại chỗ về hướng đó (sai số 2 độ) rồi mới bật "Đã tới". Dùng khi robot phải đứng vuông vức trước cửa đổ hàng.',
    },
    example:
      'Thân robot "Đối tượng" → "Robot"; Mốc sàn "Đối tượng" → "Đích"; Khi bắt đầu "Đã bắt đầu" → "Chạy"; "Trái" → "Công suất" của Động cơ bên trái; "Phải" → "Công suất" của Động cơ bên phải.',
    tips: [
      'Mảnh này chỉ ra lệnh. Robot chạy được hay không là do Động cơ, bánh xe và độ bám: không nối "Trái" / "Phải" sang Động cơ thì robot đứng yên.',
      'Động cơ bên trái phải có "Vị trí ngang" là số âm, bên phải là số dương. Lắp ngược thì robot quay lưng lại với đích.',
      'Muốn robot dừng khi có vật cản: nối "Đang bị chặn" của Dò phía trước qua Đảo ngược rồi vào "Chạy".',
      'Robot chở thùng trên khay: giảm "Công suất chạy tối đa" hoặc "Độ tăng tốc" của Động cơ để thùng không trượt khi phanh.',
      'Đi nhiều chặng: nối "Khi tới nơi" vào "Tăng 1" của Bộ đếm, cho số đếm chọn mốc kế tiếp qua Tìm mốc sàn.',
    ],
    lessonId: LESSON,
    tryBoard: tryRobotGoto,
  },
  {
    kind: 'floor-marker',
    purpose: 'Một ô đánh số sơn trên sàn để đặt tên cho một chỗ. Ô không cản đường, đi đè lên được. Nó cho biết vị trí của mình để robot tìm tới.',
    whenToUse: 'Đánh dấu trạm nhận hàng, các cửa đổ hàng số 1, 2, 3..., chỗ đỗ, các ngã rẽ trên sàn kho; bất cứ chỗ nào robot cần "đi tới" hoặc cần biết "mình đang ở đâu".',
    ports: {
      self: 'Ra: chính ô mốc này. Nối vào "Đích" của Đi tới điểm để robot chạy tới đây.',
      x: 'Ra (số): toạ độ X của tâm ô, tính bằng mét.',
      z: 'Ra (số): toạ độ Z của tâm ô, tính bằng mét.',
      number: 'Ra (số): số ghi trên ô.',
    },
    params: {
      number: 'Số của mốc, từ 1 đến 999, là số nguyên. Mặc định 1. Đây là số mà Đọc mốc sàn báo ra và Tìm mốc sàn tìm theo. Nên đặt mỗi mốc một số khác nhau.',
      position: 'Chỗ đặt tâm ô, tính bằng mét: x và z là vị trí trên sàn, y là độ cao mặt sàn nơi ô được sơn (mặc định 0,5, trùng mặt trên của một hộp sàn dày 1).',
      size: 'Cạnh của ô vuông, tính bằng mét, từ 0,2 đến 10. Mặc định 1. Ô to thì Đọc mốc sàn bắt được robot từ xa tâm hơn.',
      color: 'Màu của ô. Mặc định cam. Màu chỉ để nhìn.',
      exits:
        'Mũi tên chiều đi vẽ trên ô: robot được rời ô này theo hướng nào. Mặc định "Không có mũi tên": ô trông và chạy y như trước. Một mũi tên là một đoạn làn một chiều; hai mũi tên là ngã rẽ. Mảnh Tìm đường trên lưới chỉ đi theo các mũi tên này. Hướng tính trên sàn: sang phải là +x, xuống dưới là +z (giống "Hướng" 0 và 90 độ của Thân robot).',
    },
    example: 'Mốc sàn (số 3) "Đối tượng" → "Đích" của Đi tới điểm. Hoặc: Hằng số 3 → "Số mốc" của Tìm mốc sàn → "Mốc" → "Đích".',
    tips: [
      'Mốc là hình sơn phẳng: không chặn robot, không chặn thùng hàng, cảm biến Dò phía trước không thấy nó.',
      'Đổi số, vị trí hay cỡ xong phải bấm Chạy lại; chỉ có màu đổi được ngay lúc đang chạy.',
      'Hai mốc trùng số thì Tìm mốc sàn lấy mốc được tạo trước. Tốt nhất đừng để trùng.',
      'Sàn có hai tầng: đặt số khác nhau cho mỗi tầng (ví dụ tầng trên từ 1, tầng dưới từ 101), vì Tìm mốc sàn tìm theo số trên cả bảng.',
      'Khi game chạy, ô đang bị một robot giữ (xem Bảng giữ ô) tạm đổi sang màu đỏ rồi trở lại màu của nó.',
    ],
    lessonId: LESSON,
    tryBoard: tryFloorMarker,
  },
  {
    kind: 'floor-marker-sensor',
    purpose: 'Cho biết một vật đang đứng trên Mốc sàn số mấy, giống robot kho hàng đọc mã dán dưới sàn. Không đứng trên mốc nào thì ra 0.',
    whenToUse: 'Robot cần biết mình đang ở trạm nào: tới đúng cửa số 3 mới đổ hàng, về tới mốc đỗ thì báo rảnh, đi qua mốc ngã tư thì chạy chậm lại.',
    ports: {
      who: 'Vào: vật cần hỏi (thân robot, xe, nhân vật). Bắt buộc nối. Tâm của vật phải nằm trong ô mốc thì mới tính là đang đứng trên mốc.',
      number: 'Ra (số): số của mốc vật đang đứng trên; 0 khi không đứng trên mốc nào. Hai ô chồng lên nhau thì lấy ô có tâm gần vật hơn; hai tầng sàn chồng lên nhau thì lấy ô của tầng gần chân vật nhất.',
      on: 'Ra: bật suốt lúc vật đang đứng trên một mốc.',
      entered: 'Ra: bật một nhịp mỗi lần vật vừa vào một mốc (kể cả đi thẳng từ mốc này sang mốc khác).',
      marker: 'Ra: chính ô mốc đó (để trống khi không đứng trên mốc nào).',
    },
    params: {},
    example: 'Thân robot "Đối tượng" → "Đối tượng" của Đọc mốc sàn; "Số mốc" → "Giá trị" của Hiện số.',
    tips: [
      'Muốn so "đã tới đúng cửa chưa": đưa "Số mốc" và số cửa cần tới vào So sánh (bằng).',
      'Mốc nhỏ quá thì robot chạy nhanh có thể lướt qua trong một hai nhịp: tăng "Cỡ ô" của mốc.',
    ],
    lessonId: LESSON,
    tryBoard: tryFloorMarkerSensor,
  },
  {
    kind: 'floor-marker-find',
    purpose: 'Đổi một con số thành Mốc sàn mang số đó, kèm X và Z của nó. Nhờ vậy "tới cửa số 3" trở thành một chỗ cụ thể trên sàn.',
    whenToUse: 'Khi đích của robot là một con số thay đổi lúc chạy: số cửa của kiện hàng vừa nhận, "Mã vừa giao" của Bộ điều phối, số đếm của Bộ đếm khi đi lần lượt qua các mốc.',
    ports: {
      number: 'Vào (số): số mốc cần tìm (làm tròn). Không nối dây thì là 0, tức là không tìm thấy.',
      marker: 'Ra: ô mốc mang số đó. Nối vào "Đích" của Đi tới điểm. Không có mốc nào mang số đó thì để trống, robot đứng chờ.',
      x: 'Ra (số): toạ độ X của mốc tìm được (0 khi không có).',
      z: 'Ra (số): toạ độ Z của mốc tìm được (0 khi không có).',
      found: 'Ra: bật khi có mốc mang số đó.',
    },
    params: {},
    example: 'Bộ điều phối "Mã vừa giao" → "Số mốc"; "Mốc" → "Đích" của Đi tới điểm; "Có mốc" → "Chạy".',
    tips: [
      'Dùng số 0 làm "chưa có việc": không có mốc số 0 nên robot đứng chờ.',
      'Không có mảnh này vẫn làm được bằng hai Bảng giá trị (một bảng X, một bảng Z), nhưng phải gõ lại toạ độ từng mốc và sửa tay mỗi khi dời mốc.',
    ],
    lessonId: LESSON,
    tryBoard: tryFloorMarkerFind,
  },
];
