import { DISPATCHER_MAX_MACHINES } from '../nodes/dispatcher';
import { tryDispatcher, trySampleHold } from './boards-memory-dispatch';
import type { HandbookEntry } from './types';

const machines = Array.from({ length: DISPATCHER_MAX_MACHINES }, (_, k) => k + 1);
const perMachine = (id: string, text: (k: number) => string): Record<string, string> => Object.fromEntries(machines.map((k) => [`${id}${k}`, text(k)]));

export const HANDBOOK_MEMORY_DISPATCH: readonly HandbookEntry[] = [
  {
    kind: 'sample-hold',
    purpose: 'Nhớ một con số: lúc "Lưu" bật lên thì chép số đang ở "Giá trị" và giữ nguyên, dù sau đó "Giá trị" đổi.',
    whenToUse:
      'Khi một con số chỉ đúng trong chốc lát mà máy cần dùng lâu hơn: xe nhận hàng nhớ số cửa phải tới, cân nhớ khối lượng thùng vừa cân, robot nhớ vị trí lúc bắt đầu.',
    ports: {
      value: 'Vào (số): con số cần nhớ. Chỉ được đọc đúng lúc "Lưu" bật lên. Không nối dây thì coi là 0.',
      store: 'Vào: mỗi lần bật lên (từ tắt sang bật) là chép "Giá trị" vào bộ nhớ. Giữ bật mãi cũng chỉ lưu một lần. Không nối dây thì không bao giờ lưu.',
      clear: 'Vào: mỗi lần bật lên là đưa "Số nhớ" về "Số ban đầu". Bật cùng lúc với "Lưu" thì "Xoá" thắng.',
      held: 'Ra (số): con số đang nhớ. Chưa lưu lần nào thì là "Số ban đầu".',
      stored: 'Ra: bật đúng một nhịp mỗi lần vừa lưu xong.',
    },
    params: {
      start: 'Con số mảnh ghép nhớ lúc bắt đầu chạy và sau mỗi lần "Xoá". Mặc định 0.',
    },
    example: 'Số ngẫu nhiên "Giá trị" → Nhớ số "Giá trị"; Bộ điều phối "Giao máy 1" → "Lưu"; "Số nhớ" → Hiện số. Máy 1 nhớ số của việc nó vừa nhận.',
    tips: [
      '"Lưu" chỉ tính lúc vừa bật lên. Muốn lưu lại thì tín hiệu phải tắt rồi bật lần nữa.',
      'Khác Bộ đếm: Bộ đếm cộng trừ từng bước, còn Nhớ số chép nguyên một con số bất kỳ.',
      'Nối "Vừa lưu" sang mảnh khác để báo "đã có số mới".',
    ],
    lessonId: 'share-jobs',
    tryBoard: trySampleHold,
  },
  {
    kind: 'dispatcher',
    purpose: 'Chia việc cho nhiều máy: mỗi việc mới được giao cho đúng một máy đang rảnh. Máy nào cũng bận thì việc xếp hàng chờ.',
    whenToUse:
      'Khi có nhiều máy cùng làm một loại việc: ba xe chia nhau các kiện hàng vừa tới, hai cánh tay chia nhau các thùng trên băng chuyền, nhiều quầy chia nhau khách.',
    ports: {
      job: 'Vào: mỗi lần bật lên (từ tắt sang bật) là có một việc mới. Không nối dây thì không có việc nào.',
      jobId: 'Vào (số): con số đi kèm việc (ví dụ số cửa phải tới), được đọc đúng lúc "Có việc" bật lên. Không nối dây thì mã là 0.',
      ...perMachine('busy', (k) => `Vào: bật khi máy ${k} đang bận, tắt khi máy rảnh. Không nối dây thì máy ${k} luôn được coi là rảnh.`),
      chosen: 'Ra (số): số của máy vừa được giao việc gần nhất. Chưa giao việc nào thì là 0.',
      waiting: 'Ra: bật khi còn việc đang chờ mà máy nào cũng bận.',
      given: 'Ra (số): tổng số việc đã giao từ lúc bắt đầu chạy.',
      lastCode: 'Ra (số): mã của việc vừa được giao gần nhất, cho máy nào cũng vậy. Nối "Giao máy k" vào "Lưu" của một Nhớ số để máy k giữ lại mã của mình.',
      ...perMachine('give', (k) => `Ra: bật đúng một nhịp khi một việc được giao cho máy ${k}.`),
      ...perMachine('code', (k) => `Ra (số), chỉ hiện khi bật "Hiện cổng Mã cho máy k": mã của việc mà máy ${k} nhận gần nhất, giữ nguyên tới lần giao kế tiếp cho máy ${k}.`),
    },
    params: {
      machines: `Số máy cùng chia việc, từ 2 đến ${DISPATCHER_MAX_MACHINES}. Mỗi máy có một cổng "Máy k đang bận" và một cổng "Giao máy k".`,
      mode: '"Lần lượt": giao xoay vòng máy 1, 2, 3... rồi quay lại máy 1, bỏ qua máy đang bận, nên các máy được chia đều. "Máy rảnh đầu tiên": luôn giao cho máy rảnh có số nhỏ nhất, nên máy 1 làm nhiều nhất.',
      showCode: 'Nâng cao: bật thì mỗi máy có thêm một cổng ra "Mã cho máy k", giữ mã của việc máy đó nhận gần nhất. Việc nào cũng mang theo mã của mình, kể cả khi phải xếp hàng chờ.',
    },
    example:
      'Hẹn giờ "Hết giờ" → Bộ điều phối "Có việc"; "Giao máy 1" → Công tắc nhớ "Bật"; "Đang bật" của Công tắc nhớ → "Máy 1 đang bận". Máy làm xong thì "Tắt" Công tắc nhớ để nhận việc mới.',
    tips: [
      'Cổng "Máy k đang bận" phải bật ngay khi máy nhận "Giao máy k" (dùng Công tắc nhớ), nếu không máy có thể bị giao hai việc liền nhau.',
      'Mỗi nhịp chỉ giao một việc. Hai việc tới sát nhau thì việc sau được giao ở nhịp kế tiếp.',
      'Việc chờ được giao theo thứ tự tới trước, giao trước.',
      '"Có việc" bật sẵn từ lúc bắt đầu chạy cũng được tính là một việc.',
    ],
    lessonId: 'share-jobs',
    tryBoard: tryDispatcher,
  },
];
