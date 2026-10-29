import { CONNECT_FAIL_TEXT } from '../../engine/text-vi';
import type { PortRef } from '../../engine/types';
import type { EditorState } from '../editor-state';
import { SNAP_PX, nearestWithin, wirePath, type Point } from './graph-geometry';
import { checkPortPair, type Compat, type PortDir } from './port-compat';

interface Deps {
  root: HTMLElement;
  wireLayer: SVGElement;
  state: EditorState;
  notify: (text: string, kind?: 'info' | 'error') => void;
  toWorld: (clientX: number, clientY: number) => Point;
  showTip: (text: string | null, clientX?: number, clientY?: number) => void;
  /** Play the shake animation on a node. */
  shake: (nodeId: string) => void;
}

interface Entry {
  row: HTMLElement;
  ref: PortRef;
  dir: PortDir;
  compat: Compat;
}

export interface WireDrag {
  begin(row: HTMLElement, e: PointerEvent): boolean;
  move(e: PointerEvent): void;
  end(e: PointerEvent): void;
  cancel(): void;
}

const refOf = (row: HTMLElement): PortRef | null => {
  const { node, port } = row.dataset;
  return node && port ? { node, port } : null;
};

function dotClientCenter(row: HTMLElement): Point {
  const r = (row.querySelector('.wc-dot') ?? row).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Drags a wire from a port row. Compatible ports pulse and the rest dim; the wire snaps to a
 * compatible port within SNAP_PX, and the whole row is the hit area. Dropping on an occupied input
 * replaces the old wire. A wrong-type drop shakes the target node and says which types clashed.
 */
export function createWireDrag({ root, wireLayer, state, notify, toWorld, showTip, shake }: Deps): WireDrag {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let temp: SVGPathElement | null = null;
  let start: Entry | null = null;
  let entries: Entry[] = [];
  let target: Entry | null = null;

  function clearMarks(): void {
    if (target) target.row.classList.remove('snap', 'bad');
    target = null;
  }

  function finish(): void {
    clearMarks();
    showTip(null);
    temp?.remove();
    temp = null;
    root.classList.remove('wiring');
    for (const en of entries) en.row.classList.remove('ok', 'no', 'from');
    entries = [];
    start = null;
  }

  function pick(e: PointerEvent): Entry | null {
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const row = under instanceof Element ? under.closest<HTMLElement>('.wc-port') : null;
    const direct = row ? entries.find((en) => en.row === row) : undefined;
    if (direct && direct !== start) return direct;
    const okOnes = entries.filter((en) => en.compat.ok).map((en) => ({ en, ...dotClientCenter(en.row) }));
    return nearestWithin(okOnes, { x: e.clientX, y: e.clientY }, SNAP_PX)?.en ?? null;
  }

  return {
    begin(row, e) {
      const ref = refOf(row);
      const dir = row.dataset.dir as PortDir | undefined;
      if (!ref || !dir) return false;
      const graph = state.getGraph();
      entries = [...root.querySelectorAll<HTMLElement>('.wc-port')].flatMap((r) => {
        const rr = refOf(r);
        const rd = r.dataset.dir as PortDir | undefined;
        return rr && rd ? [{ row: r, ref: rr, dir: rd, compat: checkPortPair(graph, ref, dir, rr, rd) }] : [];
      });
      start = entries.find((en) => en.row === row) ?? null;
      if (!start) return false;
      for (const en of entries) en.row.classList.add(en === start ? 'from' : en.compat.ok ? 'ok' : 'no');
      root.classList.add('wiring');
      temp = document.createElementNS(SVG_NS, 'path');
      temp.setAttribute('class', `wc-wire-temp type-${row.dataset.type ?? 'bool'}`);
      wireLayer.append(temp);
      this.move(e);
      return true;
    },
    move(e) {
      if (!start || !temp) return;
      clearMarks();
      target = pick(e);
      const sc = dotClientCenter(start.row);
      const s = toWorld(sc.x, sc.y);
      const end = target ? dotClientCenter(target.row) : { x: e.clientX, y: e.clientY };
      const p = toWorld(end.x, end.y);
      temp.setAttribute('d', start.dir === 'out' ? wirePath(s.x, s.y, p.x, p.y) : wirePath(p.x, p.y, s.x, s.y));
      if (target) {
        target.row.classList.add(target.compat.ok ? 'snap' : 'bad');
        showTip(target.compat.ok ? null : target.compat.message, e.clientX, e.clientY);
      } else showTip(null);
    },
    end(e) {
      this.move(e);
      const from = start;
      const to = target;
      finish();
      if (!from || !to) return;
      if (!to.compat.ok) {
        shake(to.ref.node);
        notify(to.compat.message, 'error');
        return;
      }
      const [src, dst] = from.dir === 'out' ? [from.ref, to.ref] : [to.ref, from.ref];
      const res = state.connect(src, dst, { replace: true });
      if (!res.ok) notify(CONNECT_FAIL_TEXT[res.reason], 'error');
    },
    cancel: finish,
  };
}
