import { getNodeDef } from '../../engine/registry';
import { h } from '../dom';
import type { EditorState } from '../editor-state';
import { categoryTile } from '../panels/panel-icons';
import { GROUP_COLORS, GROUP_NAME_MAX, deriveGroupPorts, findGroup } from './group-model';
import { GROUP_VI } from './group-text-vi';
import './group-inspector.css';

const T = GROUP_VI.inspector;

function button(label: string, title: string, disabled: boolean, onClick: () => void, extra = ''): HTMLButtonElement {
  const b = h('button', `btn pn-btn${extra}`, label);
  b.type = 'button';
  b.title = title;
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}

/** Inspector for a selected group: name, colour, members (click to open the group and select one), ports. False for an unknown id. */
export function renderGroupInspector(el: HTMLElement, state: EditorState, groupId: string): boolean {
  const graph = state.getGraph();
  const group = findGroup(graph, groupId);
  if (!group) return false;
  const playing = state.isPlaying();

  const head = h('div', 'pn-ihead');
  const names = h('div', 'pn-inames');
  names.append(h('div', 'prop-node-name pn-iname', group.name), h('div', 'pn-icat', GROUP_VI.group));
  head.append(names);
  el.append(head);

  const form = h('div', 'pn-sec pn-gform');
  const nameRow = h('label', 'pn-grow');
  nameRow.append(h('span', '', T.name));
  const name = h('input', 'pn-group-name');
  name.type = 'text';
  name.value = group.name;
  name.maxLength = GROUP_NAME_MAX;
  name.disabled = playing;
  name.addEventListener('change', () => state.renameGroup(group.id, name.value));
  name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') name.blur();
  });
  nameRow.append(name);

  const colorRow = h('div', 'pn-grow');
  colorRow.append(h('span', '', T.color));
  const swatches = h('span', 'pn-swatches');
  for (const c of [null, ...GROUP_COLORS]) {
    const sw = h('button', `pn-swatch${(group.color ?? null) === c ? ' on' : ''}${c === null ? ' none' : ''}`);
    sw.type = 'button';
    sw.disabled = playing;
    sw.title = c === null ? T.colorDefault : c;
    if (c) sw.style.background = c;
    sw.addEventListener('click', () => state.setGroupColor(group.id, c));
    swatches.append(sw);
  }
  colorRow.append(swatches);
  form.append(nameRow, colorRow);
  el.append(form);

  const members = h('div', 'pn-sec');
  const mh = h('div', 'pn-sec-h', T.members);
  mh.append(h('span', 'pn-sec-n', String(group.nodeIds.length)));
  members.append(mh);
  const list = h('ul', 'pn-members');
  for (const id of group.nodeIds) {
    const node = graph.nodes.find((n) => n.id === id);
    const def = node && getNodeDef(node.kind);
    if (!node || !def) continue;
    const li = h('li');
    const b = h('button', 'pn-member');
    b.type = 'button';
    b.title = T.open;
    const inst = typeof node.params.name === 'string' ? node.params.name.trim() : '';
    b.append(categoryTile(def.category), h('span', '', inst ? `${def.label} · ${inst}` : def.label));
    b.addEventListener('click', () => {
      state.enterGroup(group.id);
      state.select({ kind: 'node', id });
    });
    li.append(b);
    list.append(li);
  }
  members.append(list);
  el.append(members);

  const ports = deriveGroupPorts(graph, group);
  const ph = h('div', 'pn-sec');
  const phead = h('div', 'pn-sec-h', T.ports);
  phead.append(h('span', 'pn-sec-n', String(ports.length)));
  ph.append(phead);
  if (ports.length === 0) ph.append(h('p', 'pn-desc pn-dim', T.noPorts));
  for (const p of ports) ph.append(h('div', 'pn-gport', `${p.dir === 'in' ? '→' : '←'} ${p.label}`));
  el.append(ph);

  const actions = h('div', 'pn-actions');
  actions.append(
    button(GROUP_VI.ungroup, GROUP_VI.ungroupTip, playing, () => state.ungroupSelection()),
    button(T.duplicate, '', playing, () => state.duplicate()),
  );
  const danger = h('div', 'pn-danger');
  danger.append(button(T.delete, '', playing, () => state.deleteSelection(), ' danger'));
  el.append(actions, danger);
  return true;
}

/** Shown when several loose mảnh ghép are selected: explains and offers Gom nhóm. */
export function renderMultiSelect(el: HTMLElement, state: EditorState, count: number): void {
  const box = h('div', 'pn-empty-state');
  box.append(h('h3', '', T.multiTitle(count)), h('p', '', T.multiBody));
  const actions = h('div', 'pn-actions');
  actions.append(button(GROUP_VI.group, GROUP_VI.groupTip, state.isPlaying() || state.getScope() !== null, () => state.groupSelection()));
  box.append(actions);
  el.append(box);
}
