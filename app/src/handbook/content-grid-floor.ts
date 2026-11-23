import { CELL_HOLD_MAX_ROBOTS } from '../nodes/cell-hold';
import { tryCellHold, tryGridFleet, tryGridRoute } from './boards-grid-floor';
import type { HandbookEntry } from './types';

/** No lesson teaches these two pieces yet (see tutorial/course-pack-n.ts); the pages and their "Thử ngay" boards explain them. */
const LESSON = 'grid-floor';

const robots = Array.from({ length: CELL_HOLD_MAX_ROBOTS }, (_, k) => k + 1);
const perRobot = (id: string, text: (k: number) => string): Record<string, string> => Object.fromEntries(robots.map((k) => [`${id}${k}`, text(k)]));

/** Handbook pages of the pieces for a floor of one-way lanes shared by several robots. */
export const HANDBOOK_GRID_FLOOR: readonly HandbookEntry[] = [
  {
    kind: 'grid-route',
    purpose:
      'Bản đồ chỉ đường trên sàn có làn một chiều: đang đứng ở ô này, muốn tới ô kia, thì bước kế tiếp là ô nào. Làn đường chính là các mũi tên vẽ trên Mốc sàn.',
    whenToUse:
      'Khi robot phải tự tìm đường trên một sàn kẻ ô mà mỗi làn chỉ được đi một chiều: sàn phân loại kiện hàng có lỗ thả, kho hàng có nhiều xe tự hành, bãi xe một chiều. Đích đổi lúc nào thì đường đổi theo lúc đó.',
    ports: {
      at: 'Vào (số): số của ô robot đang đứng. Bắt buộc nối, thường từ "Số mốc" của Đọc mốc sàn. Số 0 (robot không đứng trên mốc nào) thì không có đường.',
      goal: 'Vào (số): số của ô muốn tới. Không nối dây hoặc bằng 0 thì coi như không có đích: robot được bảo đứng yên.',
      avoid:
        'Vào: nối từ "Robot k đang chờ ô" của Bảng giữ ô. Khi cổng này bật liền quá "Chờ quá bao lâu thì đổi lối ra", mảnh ghép đổi sang lối ra còn lại của ô đang đứng (nếu lối đó vẫn dẫn tới đích). Vẫn bị chờ thêm ngần ấy giây thì đổi về lối cũ. Không nối dây thì không bao giờ đổi lối.',
      next: 'Ra (số): số của ô kế tiếp phải sang, luôn là ô mà một mũi tên của ô đang đứng chỉ tới. Đã ở ô đích, không có đích hoặc không có đường thì bằng chính "Ô đang đứng".',
      hasNext: 'Ra: bật khi có đích mà robot chưa đứng ở ô đích. Tắt nghĩa là "đã ở ô đích" (hoặc chưa có đích).',
      steps: 'Ra (số): còn phải đi qua bao nhiêu ô nữa (tính cả ô đích). 0 khi đã tới, và cũng 0 khi không có đường nào tới đích.',
    },
    params: {
      detourAfter:
        'Số giây robot chịu chờ trước khi thử lối ra khác, tính từ lúc "Tránh ô bị giữ" bật. Mặc định 3. Đặt 0 thì không bao giờ đổi lối. Số nhỏ quá (1 giây) làm robot hay bỏ đường ngắn để đi vòng; trên sàn thử 6 robot, 3 giây không làm chậm việc mà vẫn gỡ được chỗ kẹt.',
    },
    example:
      'Đọc mốc sàn "Số mốc" → "Ô đang đứng"; số ô cần tới (Số cố định, Bảng giá trị...) → "Ô đích"; "Ô kế tiếp" → "Số mốc" của Tìm mốc sàn → "Mốc" → "Đích" của Đi tới điểm. Có nhiều robot thì "Ô kế tiếp" đi vào "Ô robot k muốn tới" của Bảng giữ ô, và "Ô robot k được đi" mới đi vào Tìm mốc sàn.',
    tips: [
      'Mảnh này chỉ đọc mũi tên trên các Mốc sàn. Mốc không có mũi tên là ngõ cụt: tới được nhưng không đi tiếp được.',
      'Mũi tên chỉ tới mốc gần nhất nằm thẳng hướng đó trên cùng một tầng sàn. Mũi tên chỉ ra ngoài sàn thì không dẫn tới đâu.',
      'Đừng vẽ hai ô chỉ mũi tên vào nhau: hai robot sẽ đòi ô của nhau và không ai nhường được. Làn một chiều xen kẽ (hàng này sang phải, hàng kế sang trái) tránh được chuyện đó.',
      'Mảnh này không biết có robot khác. Muốn nhiều robot không đụng nhau phải dùng thêm Bảng giữ ô.',
      'Muốn biết "đã tới đích để đổ hàng": dùng "Còn phải đi" tắt VÀ "Robot k đứng giữa ô" của Bảng giữ ô bật.',
    ],
    lessonId: LESSON,
    tryBoard: tryGridRoute,
  },
  {
    kind: 'cell-hold',
    purpose:
      'Bảng ghi ô sàn nào đang có robot giữ, một tấm dùng chung cho cả đội robot. Luật chỉ có một câu: mỗi ô chỉ một xe; xe giữ ô mình đang đứng, muốn sang ô khác thì xin, ô trống mới được đi.',
    whenToUse:
      'Khi nhiều robot chạy chung một sàn kẻ ô (Mốc sàn xếp sát nhau) và không được đụng nhau: xe phân loại kiện hàng, xe tự hành trong kho. Giống các "khoá khu gian" của đường sắt: mỗi đoạn ray chỉ một đoàn tàu.',
    ports: {
      held: 'Ra (số): đang có bao nhiêu ô bị giữ. Mỗi robot giữ ít nhất ô nó đứng; đang chạy sang ô khác thì giữ thêm ô sắp tới.',
      ...perRobot('robot', (k) => `Vào: Thân robot của robot ${k} (cổng "Đối tượng"). Bảng nhìn chỗ robot đang đứng để biết thân nó đè lên những ô nào. Không nối dây thì robot ${k} không được cho đi ô nào, và các robot khác không biết có nó.`),
      ...perRobot('want', (k) => `Vào (số): ô robot ${k} muốn sang, thường là "Ô kế tiếp" của Tìm đường trên lưới. Bằng 0 hoặc bằng ô đang giữ thì robot không xin gì. Cổng này được đọc chậm một nhịp.`),
      ...perRobot('cell', (k) => `Ra (số): ô robot ${k} đang được phép đứng hoặc chạy tới. Lúc đầu là ô nó đang đứng. Nối qua Tìm mốc sàn vào "Đích" của Đi tới điểm. 0 khi robot không đứng trên mốc nào.`),
      ...perRobot('wait', (k) => `Ra: bật khi robot ${k} đã sẵn sàng sang ô nó xin nhưng ô đó đang bị robot khác giữ. Nối vào "Tránh ô bị giữ" của Tìm đường trên lưới để chờ lâu thì đổi lối.`),
      ...perRobot('stood', (k) => `Ra: bật khi robot ${k} đã đứng yên ở giữa ô nó được cho đi. Tắt ngay trong nhịp ô đó đổi. Dùng cổng này thay cho "Đã tới" của Đi tới điểm để biết lúc được đổ hàng hay nhận hàng.`),
    },
    params: {
      robots: `Số robot dùng chung bảng, từ 1 đến ${CELL_HOLD_MAX_ROBOTS}. Mặc định 2. Mỗi robot có hai cổng vào và ba cổng ra mang số của nó. Hai robot xin cùng một ô trong cùng một nhịp thì robot số nhỏ hơn được đi.`,
      flow: 'Mặc định "Có": robot đang đi thẳng được xin ô kế tiếp ngay khi tâm nó vào trong ô đang giữ, nên không phải dừng ở từng ô (trên sàn thử nhanh hơn khoảng 16 %). Trước khi rẽ robot vẫn dừng ở giữa ô. Chọn "Không" thì ô nào cũng vào giữa rồi mới xin.',
      arriveWithin: 'Robot được coi là đứng giữa ô khi tâm nó cách tâm ô không quá số mét này. Mặc định 0,06. Phải lớn hơn sai số dừng của Đi tới điểm (khoảng 0,02 đến 0,03 với cài đặt mặc định), nếu không robot không bao giờ được xin ô mới.',
      heldColor: 'Màu của ô đang bị giữ lúc game chạy. Mặc định đỏ. Ô được trả lại màu của nó khi không còn ai giữ.',
    },
    example:
      'Mỗi robot: Thân robot "Đối tượng" → "Robot 1"; Tìm đường trên lưới "Ô kế tiếp" → "Ô robot 1 muốn tới"; "Ô robot 1 được đi" → "Số mốc" của Tìm mốc sàn → "Mốc" → "Đích" của Đi tới điểm; "Robot 1 đang chờ ô" → "Tránh ô bị giữ". Robot là một bảng mạch chép nhiều bản thì bốn sợi dây đó đi qua bốn chân của bảng mạch.',
    tips: [
      'Chỉ dùng MỘT Bảng giữ ô cho cả sàn. Hai bảng không biết gì về nhau.',
      'Robot nào không nối vào bảng thì đứng im, và các robot khác sẽ đâm vào nó vì bảng không biết nó đứng đó.',
      'Robot phải bắt đầu ở giữa một Mốc sàn, và các mốc phải xếp sát nhau (cỡ ô bằng khoảng cách giữa hai tâm ô).',
      'Ô nhỏ nhất cho thân robot 0,9 x 0,7 m là khoảng 1,2 m; 1,4 m thì hai xe cạnh nhau cùng quay vẫn cách nhau hơn 30 cm.',
      'Trên sàn một chiều, kẹt cứng chỉ xảy ra khi robot đứng kín một vòng ô. Vòng nhỏ nhất quanh một lỗ có 8 ô, nên 7 robot trở xuống không thể tự kẹt.',
      'Chỉ nhìn bằng cảm biến Dò phía trước thì từ 4 robot trở lên là kẹt: cảm biến không phân biệt được "xe kia muốn vào ô của mình" với "xe kia chỉ đang đứng đó".',
    ],
    lessonId: LESSON,
    tryBoard: tryCellHold,
    extraTries: [{ label: 'Thử: 4 robot trên sàn 9 lỗ', board: tryGridFleet }],
  },
];
