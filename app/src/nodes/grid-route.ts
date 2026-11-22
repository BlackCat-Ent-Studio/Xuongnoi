import type { NodeDef } from '../engine/types';
import { listMarkers } from './floor-marker';
import { detourOnLanes, laneGraph, routeOnLanes } from './grid-lanes';
import { asBool, asNum, numParam } from './util';

interface GridRouteState {
  /** The cell and goal the detour memory below belongs to. */
  at: number;
  goal: number;
  /** Seconds "Tránh ô bị giữ" has been on without a break. */
  waited: number;
  /** True while the robot is sent through the other exit of its cell. */
  detour: boolean;
}

/**
 * The map reader of a floor of one-way lanes: from the cell the robot stands on and the cell it wants to reach, it names
 * the next cell to drive to. The lanes are the arrows painted on the floor markers; the card has no layout of its own.
 */
export const gridRouteNode: NodeDef<GridRouteState> = {
  kind: 'grid-route',
  label: 'Tìm đường trên lưới',
  category: 'math',
  description:
    'Bản đồ chỉ đường trên sàn có làn một chiều: đang ở ô này, muốn tới ô kia, thì bước kế tiếp là ô nào. Làn đường chính là các mũi tên vẽ trên Mốc sàn: từ một ô chỉ được sang ô mà mũi tên của nó chỉ tới. Mảnh ghép tìm đường ngắn nhất theo các mũi tên và cho ra "Ô kế tiếp". Tới ô đích rồi (hoặc không có đường) thì "Ô kế tiếp" chính là ô đang đứng. Nối "Số mốc" của Đọc mốc sàn vào "Ô đang đứng". Khi "Tránh ô bị giữ" bật liền quá số giây đã đặt (ô kế tiếp đang có robot khác), mảnh ghép đổi sang lối ra còn lại của ô, nếu lối đó vẫn dẫn tới đích.',
  inputs: [
    { id: 'at', type: 'number', label: 'Ô đang đứng', required: true },
    { id: 'goal', type: 'number', label: 'Ô đích' },
    { id: 'avoid', type: 'bool', label: 'Tránh ô bị giữ' },
  ],
  outputs: [
    { id: 'next', type: 'number', label: 'Ô kế tiếp' },
    { id: 'hasNext', type: 'bool', label: 'Còn phải đi' },
    { id: 'steps', type: 'number', label: 'Số ô còn lại' },
  ],
  params: [{ id: 'detourAfter', label: 'Chờ quá bao lâu thì đổi lối ra (giây; 0 = không bao giờ đổi)', kind: 'number', default: 3, min: 0, max: 60, step: 0.5 }],
  create: () => ({ at: 0, goal: 0, waited: 0, detour: false }),
  evaluate(ctx, i, params, s) {
    const at = Math.round(asNum(i.at));
    const goal = Math.round(asNum(i.goal));
    if (at !== s.at || goal !== s.goal) {
      s.at = at;
      s.goal = goal;
      s.waited = 0;
      s.detour = false;
    }
    const graph = laneGraph(listMarkers(ctx.world));
    const usual = routeOnLanes(graph, at, goal);

    // Patience: every time the wait has lasted the set time, the robot is sent through the other exit (and back again).
    const after = numParam(params, 'detourAfter', 3);
    if (asBool(i.avoid) && after > 0 && usual.length > 0) {
      s.waited += ctx.dt;
      if (s.waited >= after) {
        s.waited = 0;
        s.detour = !s.detour;
      }
    } else s.waited = 0;

    const other = s.detour ? detourOnLanes(graph, at, goal) : [];
    const path = other.length > 0 ? other : usual;
    return { next: path[0] ?? at, hasNext: goal >= 1 && at !== goal, steps: path.length };
  },
};
