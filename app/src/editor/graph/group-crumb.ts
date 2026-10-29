import { GROUP_NAME_MAX, findGroup } from '../groups/group-model';
import { h } from '../dom';
import type { EditorState } from '../editor-state';

export const CRUMB_TEXT = {
  root: 'Bảng chính',
  back: 'Quay ra',
  backTip: 'Quay ra bảng chính (Esc)',
  nameLabel: 'Tên nhóm',
} as const;

export interface GroupCrumb {
  el: HTMLElement;
  /** Re-read the entered group: show or hide the bar and refresh the name. */
  update(): void;
}

/** Breadcrumb "Bảng chính › <name>" with an inline rename and the Quay ra button. Hidden on the main board. */
export function createGroupCrumb(state: EditorState): GroupCrumb {
  const el = h('div', 'wc-crumb wc-ui');
  el.hidden = true;
  const root = h('button', 'wc-crumb-root', CRUMB_TEXT.root);
  root.type = 'button';
  root.addEventListener('click', () => state.exitGroup());
  const name = h('input', 'wc-crumb-name');
  name.type = 'text';
  name.maxLength = GROUP_NAME_MAX;
  name.setAttribute('aria-label', CRUMB_TEXT.nameLabel);
  const back = h('button', 'wc-crumb-back', CRUMB_TEXT.back);
  back.type = 'button';
  back.title = CRUMB_TEXT.backTip;
  back.addEventListener('click', () => state.exitGroup());
  el.append(root, h('span', 'wc-crumb-sep', '›'), name, back);

  const commit = (): void => {
    const id = state.getScope();
    if (id) state.renameGroup(id, name.value);
    update();
  };
  name.addEventListener('change', commit);
  name.addEventListener('keydown', (e) => {
    e.stopPropagation(); // typing a name must not trigger board shortcuts
    if (e.key === 'Enter') name.blur();
    else if (e.key === 'Escape') {
      update();
      name.blur();
    }
  });

  function update(): void {
    const id = state.getScope();
    const group = id ? findGroup(state.getGraph(), id) : undefined;
    el.hidden = !group;
    if (!group) return;
    name.disabled = state.isPlaying();
    if (document.activeElement !== name) name.value = group.name;
  }

  return { el, update };
}
