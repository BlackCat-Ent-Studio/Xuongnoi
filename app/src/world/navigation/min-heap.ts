/**
 * Binary min-heap of (priority, id) pairs. Ties on priority break toward the smaller id,
 * so a search always pops in the same order (deterministic paths).
 */
export class MinHeap {
  private prio: number[] = [];
  private ids: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  clear(): void {
    this.prio.length = 0;
    this.ids.length = 0;
  }

  push(priority: number, id: number): void {
    let i = this.ids.length;
    this.prio.push(priority);
    this.ids.push(id);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  /** Removes and returns the id with the lowest priority, or -1 when empty. */
  pop(): number {
    const n = this.ids.length;
    if (n === 0) return -1;
    const top = this.ids[0]!;
    const lastPrio = this.prio.pop()!;
    const lastId = this.ids.pop()!;
    if (n > 1) {
      this.prio[0] = lastPrio;
      this.ids[0] = lastId;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < n - 1 && this.less(l, m)) m = l;
        if (r < n - 1 && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private less(a: number, b: number): boolean {
    const pa = this.prio[a]!;
    const pb = this.prio[b]!;
    return pa < pb || (pa === pb && this.ids[a]! < this.ids[b]!);
  }

  private swap(a: number, b: number): void {
    const p = this.prio[a]!;
    this.prio[a] = this.prio[b]!;
    this.prio[b] = p;
    const id = this.ids[a]!;
    this.ids[a] = this.ids[b]!;
    this.ids[b] = id;
  }
}
