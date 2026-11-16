import type { Endpoint, NodeFilter } from './graph-checks';
import { numParam, paramOf } from './graph-checks';
import { paramStep } from './lesson-param-step';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * "Cân nặng và lực": a scale platform with three crates falling on it. The learner adds the force sensor, reads the
 * total mass (kg) and the weight (N) on two number displays, and gives the red crate a real mass to see the reading change.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

/** Mass asked of the red crate. */
export const HEAVY_CRATE_KG = 10;

const T = {
  title: 'Cân nặng và lực',
  summary: 'Làm một cái cân: đọc khối lượng (kg) và lực (N) của các thùng đặt lên bàn cân.',
  boardName: 'Cân nặng và lực',
  intro: {
    title: 'Cái cân của nhà máy',
    text: 'Bảng này có một bàn cân màu xanh và ba cái thùng sắp rơi xuống đó. Thùng nào cũng có khối lượng thật tính bằng kg. Ta sẽ lắp mảnh Cảm biến lực / Cân để đọc xem trên bàn có bao nhiêu kg.',
    explain: 'Kilôgam (kg) là lượng chất trong vật. Niutơn (N) là lực vật đè xuống: bằng kg nhân 9,81. Xem thêm trang "Vật lý kỹ thuật" ở đầu Sổ tay.',
  },
  sensor: {
    title: 'Thêm cái cân',
    text: 'Kéo mảnh ghép "Cảm biến lực / Cân" (nhóm Logic) vào bảng.',
    explain: 'Nó cộng khối lượng mọi thứ đang nằm trên mặt trên của vật mà bạn nối vào.',
  },
  who: {
    title: 'Cân cái gì?',
    text: 'Nối cổng "Đối tượng" của Vật thể màu xanh (bàn cân) sang cổng "Đối tượng" của Cảm biến lực / Cân.',
  },
  mass: {
    title: 'Hiện khối lượng',
    text: 'Nối "Khối lượng (kg)" của Cảm biến lực / Cân sang cổng "Giá trị" của mảnh Hiện số có tên "Khối lượng (kg)".',
  },
  force: {
    title: 'Hiện lực',
    text: 'Nối "Lực (N)" của Cảm biến lực / Cân sang cổng "Giá trị" của mảnh Hiện số có tên "Lực (N)".',
    explain: 'Lực là trọng lượng: khối lượng nhân 9,81. Một thùng 1 kg đè khoảng 9,8 N.',
  },
  heavy: {
    title: 'Thùng đỏ nặng 10 kg',
    text: 'Chọn Đồ vật màu đỏ, mở mục Nâng cao trong Thuộc tính và đặt "Khối lượng (kg)" thành 10.',
    explain: 'Hai thùng kia đã được đặt sẵn 2 kg và 5 kg. Thùng đỏ để mặc định 1 kg.',
  },
  play: { title: 'Chơi thử', text: 'Bấm Chơi. Ba thùng rơi xuống bàn cân và các con số hiện ở góc màn hình.' },
  read: {
    title: 'Đọc số',
    text: 'Khối lượng phải là 2 + 5 + 10 = 17 kg, và lực là 17 × 9,81 = 166,77 N. Bấm Dừng, đổi khối lượng một thùng rồi chơi lại để xem số đổi theo.',
  },
  done: {
    title: 'Xong rồi!',
    text: 'Bạn đã làm một cái cân thật. Sau này cánh tay máy sẽ dùng chính những con số này: nhấc được bao nhiêu kg, kẹp bao nhiêu N thì không tuột.',
  },
};

const NODES: BuildArgs[1] = [
  { alias: 'floor', kind: 'block', x: 20, y: 20, params: { position: { x: 0, y: 0, z: 0 }, size: { x: 20, y: 1, z: 1 }, color: '#78716c' } },
  { alias: 'scale', kind: 'block', x: 20, y: 250, params: { position: { x: 0, y: 0.7, z: 0 }, size: { x: 4, y: 0.4, z: 1 }, color: '#0ea5e9' } },
  { alias: 'crate-a', kind: 'item', x: 270, y: 20, params: { shape: 'crate', position: { x: -1.2, y: 3, z: 0 }, color: '#a16207', mass: 2 } },
  { alias: 'crate-b', kind: 'item', x: 270, y: 250, params: { shape: 'crate', position: { x: 0, y: 3, z: 0 }, color: '#a16207', mass: 5 } },
  { alias: 'crate-c', kind: 'item', x: 270, y: 480, params: { shape: 'crate', position: { x: 1.2, y: 3, z: 0 }, color: '#ef4444' } },
  { alias: 'num-mass', kind: 'show-number', x: 770, y: 20, params: { label: 'Khối lượng (kg)', corner: 'top-left' } },
  { alias: 'num-force', kind: 'show-number', x: 770, y: 250, params: { label: 'Lực (N)', corner: 'top-left' } },
];
const WIRES: BuildArgs[2] = [];

const isScale: NodeFilter = (n) => paramOf(n, 'color') === '#0ea5e9';
const isRedCrate: NodeFilter = (n) => paramOf(n, 'color') === '#ef4444';
const labelled = (label: string): NodeFilter => (n) => paramOf(n, 'label') === label;

const SCALE_SELF: Endpoint = { kind: 'block', port: 'self', where: isScale };
const SENSOR_WHO: Endpoint = { kind: 'force-sensor', port: 'who' };
const SENSOR_MASS: Endpoint = { kind: 'force-sensor', port: 'mass' };
const SENSOR_FORCE: Endpoint = { kind: 'force-sensor', port: 'force' };
const NUM_MASS: Endpoint = { kind: 'show-number', port: 'value', where: labelled('Khối lượng (kg)') };
const NUM_FORCE: Endpoint = { kind: 'show-number', port: 'value', where: labelled('Lực (N)') };

export function createWeightForceLesson(kit: LessonKit): Lesson {
  return {
    id: 'weight-force',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-force-sensor', 'force-sensor'), title: T.sensor.title, text: T.sensor.text, explain: T.sensor.explain },
      { ...kit.wireStep('wire-who', SCALE_SELF, SENSOR_WHO), title: T.who.title, text: T.who.text },
      { ...kit.wireStep('wire-mass', SENSOR_MASS, NUM_MASS), title: T.mass.title, text: T.mass.text },
      { ...kit.wireStep('wire-force', SENSOR_FORCE, NUM_FORCE), title: T.force.title, text: T.force.text, explain: T.force.explain },
      {
        ...paramStep({
          id: 'heavy-crate',
          kind: 'item',
          where: isRedCrate,
          param: 'mass',
          advanced: true,
          done: (n) => (numParam(n, 'mass') ?? 0) >= HEAVY_CRATE_KG,
        }),
        title: T.heavy.title,
        text: T.heavy.text,
        explain: T.heavy.explain,
      },
      { id: 'play', title: T.play.title, text: T.play.text, target: () => [kit.playButton], check: (s) => s.playing },
      { id: 'read', title: T.read.title, text: T.read.text },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
