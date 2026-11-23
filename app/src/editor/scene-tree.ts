import { getNodeDef } from '../engine/registry';
import { h } from './dom';
import type { EditorState } from './editor-state';
import { icon } from './icons';
import { buildSceneModel, type SceneRoot } from './scene/scene-model';
import { SCENE_TEXT } from './scene/scene-text-vi';
import './scene/scene-tree.css';

export interface SceneTree {
  el: HTMLElement;
  dispose(): void;
}

/**
 * ARIA tree of scene objects, rebuilt from the board graph on every change.
 * Selecting an item selects that node in the editor state. The wiring canvas has no public pan API, so no pan.
 */
export function mountSceneTree(host: HTMLElement, state: EditorState, onReveal?: (nodeId: string) => void): SceneTree {
  const collapsed = new Set<string>(); // group keys the user collapsed; survive rebuilds
  let focusKey: string | null = null;

  const root = h('div', 'scene-tree-wrap');
  root.style.height = '100%';
  host.append(root);

  const keyOf = (li: HTMLElement): string => li.dataset.key ?? '';
  const visibleItems = (tree: HTMLElement): HTMLElement[] =>
    Array.from(tree.querySelectorAll<HTMLElement>('[role=treeitem]')).filter(
      (li) => !li.parentElement?.closest('[role=treeitem][aria-expanded=false]'),
    );

  function setRoving(tree: HTMLElement, target: HTMLElement | null): void {
    const items = visibleItems(tree);
    const t = target ?? items.find((i) => i.getAttribute('aria-selected') === 'true') ?? items[0] ?? null;
    for (const li of tree.querySelectorAll<HTMLElement>('[role=treeitem]')) li.tabIndex = li === t ? 0 : -1;
    focusKey = t ? keyOf(t) : null;
  }

  function toggleGroup(li: HTMLElement, open: boolean): void {
    li.setAttribute('aria-expanded', String(open));
    if (open) collapsed.delete(keyOf(li));
    else collapsed.add(keyOf(li));
    const g = li.querySelector<HTMLElement>(':scope > ul');
    if (g) g.hidden = !open;
  }

  function activate(li: HTMLElement): void {
    const id = li.dataset.nodeId;
    if (id) {
      state.select({ kind: 'node', id });
      onReveal?.(id);
    } else toggleGroup(li, li.getAttribute('aria-expanded') !== 'true');
  }

  function groupRow(key: string, label: string, count: number, children: HTMLElement[]): HTMLElement {
    const li = h('li');
    li.setAttribute('role', 'treeitem');
    li.dataset.key = key;
    const open = !collapsed.has(key);
    li.setAttribute('aria-expanded', String(open));
    const row = h('div', 'st-row');
    const chev = icon('chev');
    chev.setAttribute('class', 'ic st-chev');
    row.append(chev, h('span', 'st-group-label', label), h('span', 'st-count', SCENE_TEXT.count(count)));
    const ul = h('ul');
    ul.setAttribute('role', 'group');
    ul.hidden = !open;
    ul.append(...children);
    li.append(row, ul);
    return li;
  }

  function build(roots: SceneRoot[]): HTMLElement {
    const tree = h('ul', 'scene-tree');
    tree.setAttribute('role', 'tree');
    tree.setAttribute('aria-label', SCENE_TEXT.treeAria);
    for (const r of roots) {
      const groups = r.groups.map((g) => {
        const items = g.items.map((it) => {
          const li = h('li');
          li.setAttribute('role', 'treeitem');
          li.dataset.key = `n:${it.nodeId}`;
          li.dataset.nodeId = it.nodeId;
          li.setAttribute('aria-selected', 'false');
          const row = h('div', 'st-row');
          row.title = SCENE_TEXT.itemTip;
          const tile = h('span', 'st-tile');
          tile.style.setProperty('--c', `var(--c-${it.category})`);
          tile.append(icon(it.icon));
          row.append(h('span', 'st-chev-gap'), tile, h('span', 'st-label', it.label));
          if (it.hint) row.append(h('span', 'st-hint', it.hint));
          li.append(row);
          return li;
        });
        return groupRow(`g:${r.id}:${g.id}`, g.label, g.items.length, items);
      });
      const total = r.groups.reduce((n, g) => n + g.items.length, 0);
      tree.append(groupRow(`r:${r.id}`, r.label, total, groups));
    }
    return tree;
  }

  function syncSelection(): void {
    const tree = root.querySelector<HTMLElement>('[role=tree]');
    if (!tree) return;
    const multi = state.getMulti();
    for (const li of tree.querySelectorAll<HTMLElement>('[data-node-id]')) {
      li.setAttribute('aria-selected', String(multi.has(li.dataset.nodeId ?? '')));
    }
  }

  function render(): void {
    const roots = buildSceneModel(state.getGraph(), getNodeDef);
    root.replaceChildren();
    if (roots.length === 0) {
      root.append(h('div', 'st-empty', SCENE_TEXT.empty));
      return;
    }
    const tree = build(roots);
    root.append(tree);
    syncSelection();
    const prev = focusKey
      ? Array.from(tree.querySelectorAll<HTMLElement>('[role=treeitem]')).find((l) => keyOf(l) === focusKey)
      : null;
    setRoving(tree, prev ?? null);
  }

  root.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[role=treeitem]');
    if (!li) return;
    const tree = li.closest<HTMLElement>('[role=tree]');
    if (tree) setRoving(tree, li);
    activate(li);
  });

  const setHover = (li: HTMLElement | null): void => {
    root.querySelector('.st-row.hover')?.classList.remove('hover');
    li?.querySelector(':scope > .st-row')?.classList.add('hover');
  };
  root.addEventListener('mouseover', (e) => setHover((e.target as HTMLElement).closest<HTMLElement>('[role=treeitem]')));
  root.addEventListener('mouseleave', () => setHover(null));

  root.addEventListener('keydown', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[role=treeitem]');
    const tree = li?.closest<HTMLElement>('[role=tree]');
    if (!li || !tree) return;
    const items = visibleItems(tree);
    const i = items.indexOf(li);
    const focusAt = (t: HTMLElement | undefined): void => {
      if (!t) return;
      setRoving(tree, t);
      t.focus();
    };
    const isGroup = li.hasAttribute('aria-expanded');
    const expanded = li.getAttribute('aria-expanded') === 'true';
    switch (e.key) {
      case 'ArrowDown':
        focusAt(items[i + 1]);
        break;
      case 'ArrowUp':
        focusAt(items[i - 1]);
        break;
      case 'Home':
        focusAt(items[0]);
        break;
      case 'End':
        focusAt(items[items.length - 1]);
        break;
      case 'ArrowRight':
        if (isGroup && !expanded) toggleGroup(li, true);
        else if (isGroup) focusAt(items[i + 1]);
        break;
      case 'ArrowLeft':
        if (isGroup && expanded) toggleGroup(li, false);
        else focusAt(li.parentElement?.closest<HTMLElement>('[role=treeitem]') ?? undefined);
        break;
      case 'Enter':
      case ' ':
        activate(li);
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  });

  const unsub = state.subscribe((kind) => {
    if (kind === 'selection') syncSelection();
    else if (kind === 'graph' || kind === 'board' || kind === 'params') render();
  });
  render();

  return { el: root, dispose: unsub };
}
