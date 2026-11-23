import { CONSOLE_TEXT as C } from './console/console-text-vi';
import { computeIssues } from './console/issues';
import './console/console.css';
import { DOCK_CONSOLE_ID } from './dock-tabs';
import { h } from './dom';
import type { EditorState } from './editor-state';

export type LogKind = 'info' | 'ok' | 'warn' | 'error';
type Filter = 'all' | 'warn' | 'error';

export interface ConsoleDock {
  log(kind: LogKind, text: string): void;
  /** Current number of open issues (also shown on the tab). */
  issueCount(): number;
}

interface Entry {
  kind: LogKind;
  text: string;
  at: Date;
}

const MAX_LINES = 300;

const pad = (n: number): string => String(n).padStart(2, '0');
const stamp = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/**
 * Fills the `#dock-console` mount: pinned issue list on the left, timestamped log on the right.
 * Call after the shell is attached to the document so the mount and its tab can be found.
 * `onView` reveals a node (select + centre).
 */
export function mountConsoleDock(deps: { state: EditorState; onView: (nodeId: string) => void }): ConsoleDock | null {
  const mount = document.getElementById(DOCK_CONSOLE_ID);
  if (!mount) return null;
  const { state } = deps;
  const badge = h('span', 'cs-badge');
  badge.hidden = true;
  document.getElementById('tab-console')?.append(badge);

  // ---------- issues ----------
  const issueHead = h('div', 'cs-head');
  issueHead.append(h('span', 'grow', C.issuesTitle));
  const issueList = h('ul', 'cs-list');
  const issueCol = h('div', 'cs-col cs-issues');
  issueCol.append(issueHead, issueList);

  let count = 0;
  function renderIssues(): void {
    const issues = computeIssues(state.getGraph(), state.getMode());
    count = issues.length;
    badge.hidden = count === 0;
    badge.textContent = String(count);
    issueList.replaceChildren();
    if (count === 0) {
      issueList.append(h('li', 'cs-empty', C.issuesNone));
      return;
    }
    for (const it of issues) {
      const li = h('li', 'cs-issue');
      li.append(h('span', '', it.text));
      const nodeId = it.nodeId;
      if (nodeId) {
        const view = h('button', 'cs-btn', C.view);
        view.type = 'button';
        view.title = C.viewTip;
        view.addEventListener('click', () => deps.onView(nodeId));
        li.append(view);
      }
      issueList.append(li);
    }
  }
  state.subscribe((k) => {
    if (k === 'graph' || k === 'board' || k === 'mode') renderIssues();
  });
  renderIssues();

  // ---------- log ----------
  let filter: Filter = 'all';
  const entries: Entry[] = [];
  const logHead = h('div', 'cs-head');
  logHead.append(h('span', 'grow', C.logTitle));
  const filterBtns = new Map<Filter, HTMLButtonElement>();
  const group = h('div', 'cs-group');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', C.filterAria);
  const filters: [Filter, string][] = [
    ['all', C.filterAll],
    ['warn', C.filterWarn],
    ['error', C.filterError],
  ];
  for (const [f, label] of filters) {
    const b = h('button', 'cs-btn', label);
    b.type = 'button';
    b.addEventListener('click', () => {
      filter = f;
      renderLog();
    });
    filterBtns.set(f, b);
    group.append(b);
  }
  const clearBtn = h('button', 'cs-btn', C.clear);
  clearBtn.type = 'button';
  clearBtn.title = C.clearTip;
  clearBtn.addEventListener('click', () => {
    entries.length = 0;
    renderLog();
  });
  logHead.append(group, clearBtn);
  const logList = h('div', 'cs-list');
  logList.setAttribute('role', 'log');
  const logCol = h('div', 'cs-col cs-log');
  logCol.append(logHead, logList);

  const shown = (kind: LogKind): boolean => filter === 'all' || kind === filter;
  const lineEl = (e: Entry): HTMLElement => {
    const row = h('div', `cs-line ${e.kind}`);
    row.append(h('time', '', stamp(e.at)), h('span', '', e.text));
    return row;
  };
  function renderLog(): void {
    for (const [f, b] of filterBtns) {
      b.classList.toggle('on', f === filter);
      b.setAttribute('aria-pressed', String(f === filter));
    }
    const rows = entries.filter((e) => shown(e.kind)).map(lineEl);
    logList.replaceChildren(...(rows.length > 0 ? rows : [h('div', 'cs-empty', C.logEmpty)]));
    logList.scrollTop = logList.scrollHeight;
  }
  renderLog();

  const root = h('div', 'cs');
  root.append(issueCol, logCol);
  mount.append(root);

  return {
    issueCount: () => count,
    log(kind, text) {
      const e: Entry = { kind, text, at: new Date() };
      entries.push(e);
      if (entries.length > MAX_LINES) entries.shift();
      if (!shown(kind)) return;
      const stick = logList.scrollTop + logList.clientHeight >= logList.scrollHeight - 8;
      logList.querySelector('.cs-empty')?.remove();
      logList.append(lineEl(e));
      while (logList.childElementCount > MAX_LINES) logList.firstElementChild?.remove();
      if (stick) logList.scrollTop = logList.scrollHeight;
    },
  };
}
