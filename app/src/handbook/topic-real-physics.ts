import { tryCrateTipping } from './boards-real-physics';
import type { HandbookTopic } from './topic-solid-bodies';

/** Handbook topic (not a node page): the per-game "Vật lý thật" switch and the three formulas of the robot drive. */
export const REAL_PHYSICS_TOPIC = 'topic:real-physics';

export const REAL_PHYSICS_PAGE: HandbookTopic = {
  id: REAL_PHYSICS_TOPIC,
  title: 'Vật lý thật',
  tryBoard: tryCrateTipping,
  intro:
    'Đây là một công tắc của cả game, nằm ngay dưới "Va chạm thật"; không phải mảnh ghép. Tắt (kiểu cũ): robot tăng tốc, quay và dừng theo luật đơn giản, bánh không bao giờ trượt. Bật: robot chạy bằng lực thật (mỗi bánh chỉ kéo được tối đa bằng lực động cơ và độ bám của mặt đất), thùng và đồ vật nằm trên sàn là vật rắn thật (đổ, chồng, va nhau), trọng lực là số bạn chọn. Nhờ vậy bạn tính trước được bằng tay các số N, kg, μ.',
  blocks: [
    {
      heading: 'Bật / tắt ở đâu',
      items: [
        'Menu Tệp, mục "Cài đặt game", bấm "Vật lý thật". Hoặc ô tick "Vật lý thật" trong bảng Thuộc tính khi chưa chọn mảnh ghép nào.',
        'Đổi xong thì bấm Chạy: cài đặt có tác dụng từ lần chạy tiếp theo. Đang chạy thì không đổi được.',
        'Mặc định tắt, và game cũ, game mẫu, bài học vẫn chạy y như trước. Hai công tắc "Va chạm thật" và "Vật lý thật" độc lập nhau: bật cái nào tùy bạn.',
      ],
    },
    {
      heading: '1. Kéo và trượt (tăng tốc)',
      items: [
        'Mỗi bánh kéo robot với lực F = nhỏ hơn của (lực động cơ, μ × trọng lượng đè lên bánh). Lực động cơ là ô "Lực kéo động cơ" (mặc định 30 N), nhân với công suất; chính số này cũng là lực khi robot đẩy thùng. Trọng lượng chia đều cho các bánh: m × 9,81 ÷ số bánh. Tăng tốc a = tổng F ÷ m, m là khối lượng robot cộng hàng đang chở.',
        'Ví dụ 1: robot 2 kg, hai động cơ 30 N (mặc định), μ = 0,8. Bám tối đa mỗi bánh = 0,8 × 2 × 9,81 ÷ 2 = 7,85 N, nhỏ hơn 30 N nên độ bám là giới hạn: a = μ × 9,81 = 7,85 m/s² và bánh trượt thoáng qua lúc xuất phát (tới khi robot đuổi kịp tốc độ bánh, khoảng 0,25 s; chạy đều thì hết trượt). Robot 40 kg thì ngược lại: bám 0,8 × 40 × 9,81 ÷ 2 = 157 N mỗi bánh, lớn hơn 30 N nên động cơ là giới hạn: a = 60 ÷ 40 = 1,5 m/s², không trượt. Đặt động cơ 6 N cho robot 2 kg: a = 12 ÷ 2 = 6 m/s²; chở thêm 1 kg: a = 12 ÷ 3 = 4 m/s². Đổi sàn trơn μ = 0,2: bám mỗi bánh chỉ 1,96 N, a = 0,2 × 9,81 = 1,96 m/s², bánh trượt. Lưu ý "Độ tăng tốc" của động cơ (mặc định 400 vòng/phút mỗi giây, khoảng 6,3 m/s² ở mép bánh) cũng giới hạn: nếu nó chậm hơn độ bám thì bánh không trượt.',
        'Bánh trượt khi động cơ muốn kéo mạnh hơn độ bám cho phép: lúc đó vành bánh quay nhanh hơn mặt đất. Bật "Hiện ô Đang trượt" trên Động cơ để có ô ra "Đang trượt" và "Tốc độ trượt" (m/s, nhanh hơn mặt đất bao nhiêu). Bánh bám tốt thì lăn đúng theo mặt đất.',
        'Robot đẩy thùng cũng không đẩy mạnh hơn độ bám của các bánh: lực đẩy tối đa = tổng min(Lực kéo động cơ × công suất, độ bám) của các bánh.',
      ],
    },
    {
      heading: '2. Quay (mô-men quán tính)',
      items: [
        'Hai bánh quay ngược chiều tạo mô-men xoắn T = tổng (F × khoảng cách ngang của bánh tới giữa). Gia tốc quay α = T ÷ I, với I = m × (dài² + rộng²) ÷ 12 (khối hộp quay quanh tâm).',
        'Ví dụ 2: robot 2 kg, dài 1 m, rộng 0,7 m: I = 2 × (1 + 0,49) ÷ 12 = 0,2483 kg·m². Hai bánh đặt cách giữa 0,35 m, mỗi bánh 6 N ngược chiều: T = 2 × 6 × 0,35 = 4,2 N·m, α = 4,2 ÷ 0,2483 = 16,9 rad/s² (khoảng 969 độ/s²). Nặng gấp đôi thì quay chậm đi một nửa.',
        'Không mô phỏng trượt ngang của bánh khi robot quay tại chỗ.',
      ],
    },
    {
      heading: '3. Phanh',
      items: [
        'Khi robot giảm tốc, mỗi bánh hãm với lực F = nhỏ hơn của (lực phanh, μ × trọng lượng đè lên bánh). Ô "Lực phanh" của Động cơ mặc định 0: chỉ phanh bằng ma sát. Phanh bằng ma sát thì a = μ × 9,81 và quãng dừng d = v² ÷ (2 × μ × 9,81): không phụ thuộc khối lượng, y như ngoài đời.',
        'Ví dụ 3: chạy 1 m/s, μ = 0,8, chỉ ma sát: d = 1 ÷ (2 × 0,8 × 9,81) = 0,064 m, robot 2 kg hay 5 kg đều thế. Đặt "Lực phanh" 2 N mỗi động cơ (hai động cơ = 4 N): robot 2 kg có a = 4 ÷ 2 = 2 m/s², d = 1 ÷ (2 × 2) = 0,25 m; robot 5 kg có a = 4 ÷ 5 = 0,8 m/s², d = 1 ÷ (2 × 0,8) = 0,625 m. Nặng hơn thì dừng xa hơn. Nếu lực phanh lớn hơn độ bám thì ma sát quyết định và quãng dừng lại như nhau.',
        'Thả công suất về 0 là bánh bị hãm: robot dừng theo cách trên và bánh coi như đang bị khóa nên có thể báo "Đang trượt" lúc phanh gấp.',
      ],
    },
    {
      heading: '4. Thùng và đồ vật: đổ, chồng, va chạm',
      items: [
        'Khi bật, mọi đồ vật nằm tự do (thùng, hộp, bóng của mảnh ghép Đồ vật hoặc Tạo đối tượng) là vật rắn thật: chúng đổ, lăn, chồng lên nhau, va vào nhau, vào tường, sàn, băng chuyền và robot. Tắt thì đồ vật chạy y như trước: không lật, không đè nhau.',
        'Khối lượng và ma sát của thùng lấy từ ô "Khối lượng" và "Hệ số ma sát bề mặt" (mục Nâng cao của mảnh ghép tạo ra nó). Khi bật, ô "Độ trượt" không dùng nữa: thùng trượt theo ma sát thật, lực cản = μ × m × 9,81. Ô "Độ nảy" vẫn dùng.',
        'Ví dụ 4, đẩy cao thì đổ, đẩy thấp thì trượt: thùng 10 kg, cao 1,2 m, rộng 0,4 m, μ = 0,5. Trượt khi lực đẩy F ≥ μ × m × 9,81 = 49,05 N. Đổ khi F × độ cao đẩy ≥ m × 9,81 × (rộng ÷ 2) = 19,62 N·m. Đẩy ở 1,1 m: đổ khi F ≥ 17,8 N, nhỏ hơn 49,05 N nên thùng đổ trước khi kịp trượt. Đẩy ở 0,15 m: đổ cần F ≥ 130,8 N, lớn hơn nhiều nên thùng chỉ trượt. Bấm "Thử ngay" để xem hai thùng này.',
        'Thùng đang trượt mà bị chặn lại cũng có thể đổ: khi μ lớn hơn (rộng ÷ 2) ÷ (độ cao khối tâm), ở đây 0,2 ÷ 0,6 = 0,33 và μ = 0,5, ma sát dưới đáy làm nó chúi tới. Đẩy nhanh vào đỉnh thùng thì đổ dù lực không lớn; muốn đẩy mà không đổ thì đẩy thấp và chậm.',
        'Robot đẩy thùng vẫn bị giới hạn lực như cũ: thùng cần F = μ × m × 9,81 mà tổng lực đẩy của các bánh (nhỏ hơn của lực động cơ và độ bám) không đủ thì robot đứng lại, thùng không nhúc nhích. Piston, khớp với thanh nối và bệ trượt cũng đẩy thùng bằng va chạm thật: đầu piston chạm cao thì thùng đổ, chạm thấp thì thùng trượt và giữ đà. Lực piston và khớp cần là lực thật của thùng: nhỏ hơn của F_trượt = μ × m × 9,81 và F_đổ = m × 9,81 × b ÷ h (b là nửa bề rộng đáy, h là độ cao chỗ chạm thùng). Ví dụ 7: thùng 10 kg, cao 1,2 m, rộng 0,4 m (b = 0,2 m), μ 0,5. Piston đẩy ở h = 1,1 m: F_đổ = 10 × 9,81 × 0,2 ÷ 1,1 = 17,8 N, F_trượt = 49,05 N nên cần 17,8 N: piston 30 N làm thùng đổ, piston 15 N đứng lại và "Quá tải". Đẩy ở h = 0,15 m: F_đổ = 130,8 N nên thùng trượt và cần 49,05 N: piston 45 N đứng lại. Hai thùng sát nhau đẩy thấp cần 98,1 N (cộng từng thùng); thùng chồng lên nhau tính cả khối lượng thùng trên. Khớp cần mô-men M = lực × khoảng cách tới trục. Thùng đã nghiêng thì tính theo hình dạng thật: điểm tựa là cạnh đáy phía xa, khối tâm càng gần điểm tựa càng cần ít lực, quá điểm cân bằng thì thùng tự đổ. Ô "Lực đang đẩy" của piston và "Mô-men đang chịu" của khớp hiện đúng số cần này; thiếu lực thì "Quá tải", đầu piston hay thanh nối đứng lại và thùng không nhúc nhích. Thùng bị kẹp giữa đầu piston và tường thì piston dừng sát, không ép thùng xuyên tường.',
        'Tay kẹp cũng là vật rắn thật: lòng bàn tay và hai ngón đi theo cánh tay (khớp xoay đẩy chúng như đẩy một thanh nối, kể cả khi thẻ Thanh nối để "Chắn vật" = Không) và theo hai ngón mở / khép (mặc định 1 m/s, đổi ở ô "Tốc độ khép ngón"). Thùng nằm trên đường đi bị đẩy, đổ hoặc chặn lại đúng như khi thanh nối hay piston đẩy: cần lực nhỏ hơn của F_trượt và F_đổ, mỗi thùng một phần, thiếu lực thì khớp đứng lại ("Quá tải" bật, "Mô-men đang chịu" hiện số cần), thùng sát tường, sát thành băng hay nằm trên bàn thì tay dừng chứ không ép thùng xuyên qua. Ngón đang khép mà gặp thùng chưa được kẹp thì đẩy nó với lực không quá "Lực kẹp" của mỗi ngón và đứng lại khi lực đó không đủ. Thùng chỉ được tính là đang kẹp khi cả hai ngón đã chạm hai mặt thùng (mất khoảng 0,2 đến 0,35 s với tốc độ khép 1 m/s); trước đó nó vẫn là vật tự do, ngón đang khép đẩy được và "Đang giữ" chưa bật. Thùng đang được kẹp là một phần của bàn tay nên không bị chính tay đẩy; nhả ra thì hai ngón rời khỏi mặt thùng và thùng rơi thẳng. Bật "Hiện báo ngón bị chặn" ở tay kẹp để xem "Ngón bị chặn" và "Lực ngón đang ép". Ngón chỉ đẩy một thùng (không ép nó giữa hai ngón) thì không làm hỏng thùng, vì lực ép tính cho cặp ngón đã kẹp. Ví dụ 9: thùng 2 kg, μ 0,5, cao 0,3 m, rộng 0,4 m nằm sát một ngón nhưng điểm kẹp chưa nằm trong thùng nên tay không kẹp nó. Đẩy trượt cần 0,5 × 2 × 9,81 = 9,81 N, đẩy đổ cần 2 × 9,81 × 0,2 ÷ 0,3 = 13,1 N nên thùng trượt và cần 9,81 N. Lực kẹp 8 N: hai ngón đứng lại, thùng không nhúc nhích; 12 N: ngón đẩy thùng trượt tới giữa hai ngón. Hạ bàn tay mở xuống nắp một thùng cao 1,75 m: tay dừng cách nắp 0 đến 5 mm, "Quá tải" bật và "Mô-men đang chịu" = 9,81 N × khoảng cách từ trục tới lòng bàn tay (3,0 đến 3,3 m), tay không lún vào thùng. Thùng gặp bàn tay và thanh nối (khi thanh để "Chắn vật" = Có) bằng đúng hình hộp đã vẽ, kể cả khi tay hay thanh nghiêng: đo được ở nghiêng 45 độ, lúc thùng bắt đầu nhúc nhích thì khoảng cách tới hình vẽ trong khoảng ± 2 mm (trước đây tới 27 mm, và có lúc hộp lún sâu 55 mm vào thùng). Người, robot và xe vẫn gặp các khối vuông bao ngoài như cũ.',
        'Băng chuyền kéo thùng bằng ma sát: thùng nhanh dần với a = μ × 9,81 cho tới khi bằng tốc độ băng. Thùng chạm tường cuối thì dừng và băng trượt dưới nó. Tay kẹp: thùng đang được kẹp rời khỏi mô phỏng nhưng giữ nguyên góc so với bàn tay (cánh tay nâng 30 độ thì thùng nghiêng theo 30 độ), thả ra thì rơi tiếp từ chỗ và góc đó. Nhân vật khiêng, cầm trên tay hay xe chở cũng giữ góc như vậy: thùng đang nghiêng 30 độ so với hướng nhìn của người khiêng (hay của xe) lúc nhấc lên thì nghiêng đúng góc ấy suốt lúc mang, quay theo người khiêng, và thả ra vẫn nghiêng 30 độ rồi rơi tiếp từ đó. Thùng đã đứng thẳng thì vẫn đứng thẳng. Món cầm trên tay được vẽ ngay trên bàn tay nhân vật nên không thấy góc nghiêng, nhưng góc vẫn được nhớ và dùng lại khi bỏ ra. Xe vẫn xếp thùng vào các ô cố định như cũ (theo chiều cao thùng đứng thẳng), nên thùng nghiêng trong ô của nó có thể thò góc sang thùng bên cạnh.',
        'Thùng đã đổ hay đang lăn được các thẻ đọc theo hình dạng thật của nó, không theo cái hộp thẳng đứng lúc đầu: thẻ Va chạm (kể cả "Nới / thu vùng chạm" khi dùng làm cảm biến đo gần), thẻ Vùng kích hoạt với cách tính "Chạm mép" và "Nằm trọn bên trong", Cảm biến lực kiểu cân, và cú bấm chuột vào thùng lúc chạy. Cách tính "Tâm vật vào trong" vẫn đo từ tâm thùng (tâm của thùng đổ nằm đúng chỗ thật). Thẻ Đo khoảng cách và thẻ Tìm đồ gần nhất đo tới điểm gần nhất trên mặt thùng chứ không tới tâm: thùng dài 1,2 m nằm ngang, tâm cách vật đo 3 ô, thì đầu gần cách 3 - 0,6 = 2,4 ô (thùng 0,4 m đứng thẳng cách 3 - 0,2 = 2,8 ô). Tìm đồ gần nhất xếp theo khoảng này, nên thùng nằm có đầu gần hơn thắng thùng có tâm gần hơn. Thẻ Ô trống kế tiếp vẫn tính theo tâm thùng ("một ô có đồ khi tâm một món nằm trên nó"): thùng nằm vắt qua hai ô chỉ tính cho ô chứa tâm của nó.',
        'Cân: mỗi thùng đè xuống những gì đỡ nó (bàn cân, khối sàn, thùng nằm dưới) bằng đúng phần của nó. Quy tắc đòn bẩy: các lực đỡ cộng lại bằng trọng lượng thùng và cân bằng quanh khối tâm của thùng. Mỗi chỗ đỡ đẩy lên tại giữa phần đáy thùng đang tựa lên nó (nhìn từ trên); với hai chỗ đỡ A và B thì phần của A = khối lượng × (khoảng cách từ khối tâm tới B) ÷ (khoảng cách từ A tới B). Thùng chồng lên thùng thì thùng dưới nhận cả khối lượng thùng trên rồi chia tiếp xuống các chỗ đỡ của nó, nên bàn cân đọc tổng cả chồng; cộng số đọc của mọi chỗ đỡ luôn ra đúng khối lượng. Thùng chỉ được tính là tựa lên một mặt khi đáy nó cách mặt đó không quá 2 cm (hoặc lún vào không quá 5 cm) và phần đáy chồng lên mặt một diện tích; thùng chỉ đứng sát cạnh bên bàn cân, hay đã trượt hẳn ra ngoài, thì không đè lên.',
        'Ví dụ 6: thùng 10 kg, rộng 0,4 m, nằm nửa trên bàn cân, nửa trên khối sàn cùng độ cao, đường nối ở giữa thùng. Mỗi phần đáy rộng 0,2 m nên giữa phần cách khối tâm 0,1 m mỗi bên: mỗi bên đỡ 10 × 0,1 ÷ 0,2 = 5 kg (máy đo được 5,00 và 5,00, tổng 10). Dịch thùng sang phải 0,15 m: chỉ còn 0,05 m đáy trên bàn cân (giữa phần ở -0,025 m), 0,35 m trên khối sàn (giữa phần ở 0,175 m), khối tâm ở 0,15 m: bàn cân đọc 10 × (0,175 - 0,15) ÷ (0,175 + 0,025) = 1,25 kg, khối sàn 8,75 kg. Thêm thùng 4 kg lên giữa thùng 10 kg đang nằm nửa-nửa: thùng dưới nhận 14 kg đặt giữa nó nên mỗi bên 7 kg. Thùng gác nghiêng một đầu trên sàn, một chỗ trên mép bàn cân: số đọc theo đòn bẩy (ma sát ở chỗ tựa nghiêng không tính nên sai số vài phần trăm). Cân băng chuyền: thùng đang trượt lên cân đọc tăng dần theo phần đã nằm lên cân, đủ khối lượng khi nằm trọn trên cân.',
      ],
    },
    {
      heading: 'Trọng lực',
      items: [
        'Ô "Trọng lực (m/s²)" nằm ngay dưới công tắc "Vật lý thật" trong bảng Thuộc tính (khi chưa chọn mảnh ghép nào). Mặc định 9,81 (Trái Đất); Mặt Trăng 1,62; điền 0 thì mọi thứ lơ lửng. Chỉ có tác dụng khi bật "Vật lý thật", từ lần Chạy sau.',
        'Trọng lực này kéo mọi thứ rơi: nhân vật, xe, robot và thùng. Tắt "Vật lý thật" thì vẫn là trọng lực cũ như trước (30), game cũ không đổi. Game đã lưu mà chưa có ô này đọc là 9,81.',
        'Ví dụ 5: thả thùng từ độ cao h = 4,905 m (tâm thùng cách sàn 4,905 m). Rơi h = g × t² ÷ 2 nên t = căn(2 × h ÷ g). Trái Đất g = 9,81: t = 1 giây. Mặt Trăng g = 1,62: t = 2,46 giây.',
      ],
    },
    {
      heading: 'Chưa mô phỏng',
      items: [
        'Cân đọc theo vị trí (đòn bẩy), không đọc lực ép thật của bộ máy: lúc thùng đang rơi, va hay bị đẩy thì không có cú giật ở số đọc, chỉ đúng khi thùng nằm yên. Tầm với của "Khiêng" và của "Xếp hàng lên xe" vẫn tính từ tâm thùng.',
        'Dồn trọng lượng lên bánh trước khi phanh hay sau khi tăng tốc: tổng độ bám vẫn là μ × m × 9,81 nên các số ở trên không đổi.',
        'Mọi bánh coi như chịu trọng lượng bằng nhau; hàng chở coi như đặt giữa thân. Robot không bị lật.',
        'Thùng chỉ chạm thân robot, xe và khối (hộp bao quanh), không chạm bánh riêng lẻ. Băng chuyền chỉ kéo thùng bằng ma sát: không có lực kéo riêng. Thẻ Dò phía trước và Tầm nhìn vẫn không coi đồ vật là vật cản (như khi tắt); muốn đo tới mặt thùng thì dùng thẻ Va chạm với "Nới / thu vùng chạm". Quả bóng vẫn được các thẻ đọc như hộp bao quanh nó. Chưa có ma sát lăn: quả bóng lăn mãi trên sàn phẳng. Piston không đưa cho thùng nhiều tốc độ hơn lực còn thừa của nó cho phép: a = (lực tối đa − lực cần) ÷ m, nên thanh chạy 12 m/s vẫn chỉ tăng tốc thùng với a đó (đầu thanh dừng sát thùng rồi đi theo thùng). Ví dụ 8: piston 100 N, thùng 10 kg, μ 0,5: a = (100 − 49,05) ÷ 10 = 5,1 m/s², sau khi đẩy 1,6 m thùng đạt v = căn(2 × 5,1 × 1,6) = 4 m/s dù thanh đặt 6 hay 12 m/s. Khớp cũng theo đúng quy tắc đó khi thanh hay bàn tay của nó đẩy một thùng: thùng chỉ nhận thêm a = (lực tối đa ở chỗ chạm − lực cần) ÷ m, thanh quay nhanh thì dừng sát thùng rồi đi theo thùng. Ví dụ 10: thùng 10 kg, μ 0,5 cách trục 1,3 m, khớp 150 N·m: lực ở chỗ chạm 150 ÷ 1,3 = 115 N, cần 49,05 N nên a = (115 − 49,05) ÷ 10 = 6,6 m/s². Quay 15, 40 hay 120 độ/s thì động năng thùng không bao giờ vượt lực thừa × quãng đã đẩy (trước đây 40 độ/s ném thùng đi 24 m/s, hơn 2700 J so với lực cho phép). Lực chỉ được kiểm tra với thùng mà đầu thanh chạm trực tiếp hoặc qua hàng thùng sát nhau, chưa đọc lực tiếp xúc từ engine. Đạn bắn ra không thuộc mô phỏng này.',
        'Tay kẹp: tốc độ khép ngón là số bạn chọn, nhưng thùng chạm vào ngón đang chạy nhanh vẫn bị hất đi chút ít (đo được 2 mm ở 1 m/s với thùng 2 kg; ngón dừng cách mặt thùng 0,4 mm để không đập vào nó, ngón chạm thẳng vào mặt thùng thì hất đi 8 mm đến 5 cm). Lực ép của ngón lên thùng được kiểm tra bằng lực đẩy cần thiết, không đọc lực tiếp xúc của engine; một ngón đẩy thùng vào tường không làm thùng hỏng. Thẻ Thanh nối hay Khớp để "Chắn vật" = Không thì chính thanh vẫn đi xuyên thùng, chỉ bàn tay là rắn (lựa chọn của bạn được giữ đúng như viết); thẻ mới thêm vào mặc định là "Tự động" (chắn khi bật "Vật lý thật", chỉ để vẽ khi tắt). Bảng đã lưu với "Vật lý thật" bật từ trước nay có bàn tay rắn, nên cách hạ tay vào thùng có thể phải dạy lại.',
      ],
    },
  ],
};
