import { getNodeDef, listNodeDefs } from '../engine/registry';
import type { Board, NodeCategory, NodeDef, ParamDef, ParamValue, PortDef } from '../engine/types';
import { h } from '../editor/dom';
import { categoryTile } from '../editor/panels/panel-icons';
import { normalizeText } from '../editor/panels/palette-search';
import { keyLabel } from '../editor/text-vi';
import { NODE_CATEGORY_LABELS } from '../nodes';
import { chapterOf } from '../tutorial/course';
import { findLesson } from '../tutorial/lessons';
import { handbookEntry, type HandbookEntry } from './index';
import { buildRows, filterRows, levelOf, sectionsByCategory, sectionsByLevel, type HandbookRow } from './handbook-model';
import { HANDBOOK_TEXT as T } from './handbook-text-vi';
import { SOLID_BODIES_PAGE, type HandbookTopic } from './topic-solid-bodies';
import { ENGINEERING_PHYSICS_PAGE } from './topic-engineering-physics';

/** Topic pages shown above the node lists. */
const TOPICS: readonly HandbookTopic[] = [SOLID_BODIES_PAGE, ENGINEERING_PHYSICS_PAGE];
const isTopic = (id: string): boolean => TOPICS.some((t) => t.id === id);
import './handbook-dialog.css';
import './handbook-standalone.css';

export interface HandbookDialogDeps {
  /** Replaces the current game with this board, like opening a sample. */
  openBoard(board: Board): void;
  /** Starts a course lesson; false when the id is unknown. */
  startLesson(lessonId: string): boolean;
  /** Reading only (puzzle page): no "Thử ngay" and no lesson button, and the page gets its own colours. */
  readOnly?: boolean;
}

export interface HandbookDialog {
  /** Opens the handbook, on the page of `kind` when given. */
  open(kind?: string): void;
  close(): void;
}

const CATEGORY_ORDER: NodeCategory[] = ['input', 'logic', 'math', 'object', 'action', 'brain', 'output'];

/** How a default param value reads in the table. */
export function formatDefault(def: ParamDef): string {
  const v: ParamValue = def.default;
  switch (def.kind) {
    case 'select':
      return def.options?.find((o) => o.value === v)?.label ?? String(v);
    case 'key':
      return typeof v === 'string' ? keyLabel(v) : String(v);
    case 'vec3':
      return typeof v === 'object' ? `${v.x}, ${v.y}, ${v.z}` : String(v);
    default:
      return String(v);
  }
}

function typeCell(port: PortDef): HTMLElement {
  const cell = h('span', `hb-type type-${port.type}`);
  cell.append(h('i', 'hb-shape'), T.typeNames[port.type] ?? port.type);
  return cell;
}

function table(cols: readonly string[], rows: HTMLElement[][]): HTMLElement {
  const t = h('table', 'hb-table');
  const thead = h('thead');
  const head = h('tr');
  for (const c of cols) head.append(h('th', '', c));
  thead.append(head);
  const body = h('tbody');
  for (const cells of rows) {
    const tr = h('tr');
    for (const c of cells) {
      const td = h('td');
      td.append(c);
      tr.append(td);
    }
    body.append(tr);
  }
  t.append(thead, body);
  return t;
}

const text = (s: string, className = ''): HTMLElement => h('span', className, s);

export function createHandbookDialog(deps: HandbookDialogDeps): HandbookDialog {
  const overlay = h('div', deps.readOnly ? 'modal-overlay hb-standalone' : 'modal-overlay');
  overlay.hidden = true;
  const box = h('div', 'modal hb-modal');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', T.title);

  const closeBtn = h('button', 'btn ghost', T.close);
  closeBtn.type = 'button';
  closeBtn.addEventListener('click', () => close());
  const head = h('div', 'hb-head');
  head.append(h('h2', 'modal-title', T.title), closeBtn);

  const search = h('input', 'hb-search');
  search.type = 'search';
  search.placeholder = T.searchPlaceholder;
  search.setAttribute('aria-label', T.searchLabel);
  const modeBar = h('div', 'hb-mode');
  modeBar.append(h('span', '', T.groupByLabel));
  const modeBtns = new Map<'level' | 'category', HTMLButtonElement>();
  for (const [id, label] of [['level', T.groupByLevel], ['category', T.groupByCategory]] as const) {
    const b = h('button', 'hb-mode-btn', label);
    b.type = 'button';
    b.dataset.hbMode = id;
    b.addEventListener('click', () => {
      mode = id;
      renderList();
    });
    modeBtns.set(id, b);
    modeBar.append(b);
  }
  const list = h('div', 'hb-list');
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', T.listLabel);
  const side = h('div', 'hb-side');
  side.append(search, modeBar, list);
  const page = h('div', 'hb-page');
  box.append(head, side, page);
  overlay.append(box);
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) close();
  });
  document.body.append(overlay);

  let mode: 'level' | 'category' = 'level';
  let selected = '';
  let rows: HandbookRow[] = [];

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  search.addEventListener('input', renderList);

  function loadRows(): void {
    rows = buildRows(listNodeDefs(), handbookEntry);
  }

  function rowButton(row: HandbookRow): HTMLElement {
    const b = h('button', `hb-row cat-${row.category}${row.kind === selected ? ' selected' : ''}`);
    b.type = 'button';
    b.dataset.kind = row.kind;
    b.setAttribute('role', 'option');
    b.setAttribute('aria-selected', String(row.kind === selected));
    b.append(h('span', 'hb-row-label', row.label), h('span', 'hb-tag', NODE_CATEGORY_LABELS[row.category]));
    b.addEventListener('click', () => select(row.kind));
    return b;
  }

  /** The "Va chạm thật" topic sits above the node lists; while searching it shows only when the words match. */
  function topicSection(): HTMLElement | null {
    const q = normalizeText(search.value);
    const shown = TOPICS.filter((t) => q === '' || normalizeText(t.title).includes(q));
    if (shown.length === 0) return null;
    const sec = h('section', 'hb-sec');
    sec.dataset.section = 'topics';
    sec.append(h('h3', 'hb-sec-h', T.topicsHeading));
    for (const topic of shown) {
      const on = selected === topic.id;
      const b = h('button', 'hb-row hb-topic' + (on ? ' selected' : ''));
      b.type = 'button';
      b.dataset.kind = topic.id;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(on));
      b.append(h('span', 'hb-row-label', topic.title), h('span', 'hb-tag', topic.tag ?? T.topicTag));
      b.addEventListener('click', () => select(topic.id));
      sec.append(b);
    }
    return sec;
  }

  function renderList(): void {
    for (const [id, b] of modeBtns) {
      b.classList.toggle('on', id === mode);
      b.setAttribute('aria-pressed', String(id === mode));
    }
    const found = filterRows(rows, search.value);
    const topic = topicSection();
    if (found.length === 0) {
      list.replaceChildren(...(topic ? [topic] : [h('p', 'hb-empty', T.noResults(search.value.trim()))]));
      return;
    }
    if (search.value.trim()) {
      // While searching, one flat list in match order so the best match sits on top.
      const sec = h('section', 'hb-sec');
      sec.dataset.section = 'results';
      sec.append(h('h3', 'hb-sec-h', T.searchResults(found.length)), ...found.map(rowButton));
      list.replaceChildren(...(topic ? [topic] : []), sec);
      return;
    }
    const sections = mode === 'level' ? sectionsByLevel(found) : sectionsByCategory(found, CATEGORY_ORDER);
    const nodes: HTMLElement[] = topic ? [topic] : [];
    for (const s of sections) {
      const title = typeof s.key === 'number' ? T.levelTitles[s.key] ?? T.levelBadge(s.key) : NODE_CATEGORY_LABELS[s.key];
      const sec = h('section', 'hb-sec');
      sec.dataset.section = s.id;
      sec.append(h('h3', 'hb-sec-h', title), ...s.rows.map(rowButton));
      nodes.push(sec);
    }
    list.replaceChildren(...nodes);
  }

  function section(title: string, ...body: HTMLElement[]): HTMLElement {
    const sec = h('section', 'hb-block');
    sec.append(h('h3', '', title), ...body);
    return sec;
  }

  function portsTable(ports: PortDef[], entry: HandbookEntry | undefined): HTMLElement {
    if (ports.length === 0) return h('p', 'hb-muted', T.noPorts);
    return table(
      T.portCols,
      ports.map((p) => {
        const name = h('span', 'hb-name');
        name.append(h('b', '', p.label));
        if (p.labelEn) name.append(h('small', 'hb-port-en', p.labelEn));
        if (p.required) name.append(h('em', 'hb-req', T.required));
        return [name, typeCell(p), text(entry?.ports[p.id] ?? T.noExplain)];
      }),
    );
  }

  function paramsBlock(params: ParamDef[], entry: HandbookEntry | undefined): HTMLElement {
    if (params.length === 0) return section(T.params, h('p', 'hb-muted', T.noParams));
    const toRows = (list: ParamDef[]): HTMLElement[][] =>
      list.map((p) => [h('b', '', p.label), text(formatDefault(p), 'hb-default'), text(entry?.params[p.id] ?? T.noExplain)]);
    const main = params.filter((p) => !p.advanced);
    const extra = params.filter((p) => p.advanced);
    const sec = section(T.params);
    if (main.length > 0) sec.append(table(T.paramCols, toRows(main)));
    if (extra.length > 0) {
      const details = h('details', 'hb-adv');
      details.append(h('summary', '', T.advanced), table(T.paramCols, toRows(extra)));
      sec.append(details);
    }
    return sec;
  }

  function actions(entry: HandbookEntry): HTMLElement | null {
    const bar = h('div', 'hb-actions');
    const tryBtn = h('button', 'btn primary', T.tryNow);
    tryBtn.type = 'button';
    tryBtn.dataset.hbAction = 'try';
    tryBtn.addEventListener('click', () => {
      deps.openBoard(entry.tryBoard());
      close();
    });
    bar.append(tryBtn);
    for (const extra of entry.extraTries ?? []) {
      const btn = h('button', 'btn', extra.label);
      btn.type = 'button';
      btn.dataset.hbAction = 'try-extra';
      btn.addEventListener('click', () => {
        deps.openBoard(extra.board());
        close();
      });
      bar.append(btn);
    }
    const lesson = findLesson(entry.lessonId);
    if (lesson) {
      const lessonBtn = h('button', 'btn', T.learnLesson(lesson.title));
      lessonBtn.type = 'button';
      lessonBtn.dataset.hbAction = 'lesson';
      lessonBtn.addEventListener('click', () => {
        if (!deps.startLesson(entry.lessonId)) return;
        close();
      });
      bar.append(lessonBtn);
    }
    return bar;
  }

  function renderTopic(topic: HandbookTopic): void {
    const title = h('div', 'hb-title');
    const names = h('div', 'hb-names');
    names.append(h('h3', 'hb-node-name', topic.title), h('div', 'hb-meta', topic.tag ?? T.topicTag));
    title.append(names);
    const nodes: HTMLElement[] = [title, h('p', '', topic.intro)];
    for (const block of topic.blocks) {
      const ul = h('ul', 'hb-tips');
      for (const item of block.items) ul.append(h('li', '', item));
      nodes.push(section(block.heading, ul));
    }
    page.replaceChildren(...nodes);
    page.scrollTop = 0;
  }

  function renderPage(): void {
    const topic = TOPICS.find((t) => t.id === selected);
    if (topic) {
      renderTopic(topic);
      return;
    }
    const def: NodeDef | undefined = getNodeDef(selected);
    if (!def) {
      page.replaceChildren(h('p', 'hb-muted hb-pick', T.pickOne));
      return;
    }
    const entry = handbookEntry(def.kind);
    const nodes: HTMLElement[] = [];
    const title = h('div', `hb-title cat-${def.category}`);
    const names = h('div', 'hb-names');
    const meta = h('div', 'hb-meta');
    meta.append(h('span', 'hb-tag', NODE_CATEGORY_LABELS[def.category]));
    const lv = levelOf(entry);
    if (entry && chapterOf(entry.lessonId)) meta.append(h('span', 'hb-level', T.levelBadge(lv)));
    const heading = h('h3', 'hb-node-name', def.label);
    if (def.labelEn) heading.append(h('small', 'hb-node-en', def.labelEn));
    names.append(heading, meta);
    title.append(categoryTile(def.category, true), names);
    nodes.push(title);

    if (entry) {
      nodes.push(section(T.purpose, h('p', '', entry.purpose)), section(T.whenToUse, h('p', '', entry.whenToUse)));
    } else {
      nodes.push(h('p', 'hb-note', T.noEntryNote), section(T.purpose, h('p', '', def.description)));
    }
    nodes.push(section(T.inputs, portsTable(def.inputs, entry)), section(T.outputs, portsTable(def.outputs, entry)), paramsBlock(def.params, entry));
    if (entry) {
      nodes.push(section(T.example, h('p', 'hb-example', entry.example)));
      if (entry.tips.length > 0) {
        const ul = h('ul', 'hb-tips');
        for (const tip of entry.tips) ul.append(h('li', '', tip));
        nodes.push(section(T.tips, ul));
      }
      const bar = deps.readOnly ? null : actions(entry);
      if (bar) nodes.push(bar);
    }
    page.replaceChildren(...nodes);
    page.scrollTop = 0;
  }

  function select(kind: string): void {
    selected = kind;
    for (const b of list.querySelectorAll<HTMLElement>('.hb-row')) {
      const on = b.dataset.kind === kind;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-selected', String(on));
    }
    renderPage();
  }

  function open(kind?: string): void {
    loadRows();
    search.value = '';
    if (kind && (isTopic(kind) || getNodeDef(kind))) selected = kind;
    else if (!selected || (!isTopic(selected) && !getNodeDef(selected))) selected = rows[0]?.kind ?? '';
    renderList();
    renderPage();
    overlay.hidden = false;
    window.addEventListener('keydown', onKey);
    list.querySelector<HTMLElement>('.hb-row.selected')?.scrollIntoView?.({ block: 'center' });
    (kind ? closeBtn : search).focus();
  }
  function close(): void {
    overlay.hidden = true;
    window.removeEventListener('keydown', onKey);
  }
  return { open, close };
}
