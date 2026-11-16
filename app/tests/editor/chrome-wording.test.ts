import { describe, expect, it } from 'vitest';
import { SHELL_TEXT, PRESET_LABELS } from '../../src/editor/shell-text-vi';
import { TEXT_VI, MODE_HINTS, MODE_LABELS } from '../../src/editor/text-vi';
import { CONSOLE_TEXT } from '../../src/editor/console/console-text-vi';
import { PIP_TEXT } from '../../src/editor/pip/pip-text-vi';
import { LIBRARY_TEXT } from '../../src/editor/library-text-vi';
import { PANELS_TEXT_VI } from '../../src/editor/panels/panels-text-vi';
import { SCENE_TEXT } from '../../src/editor/scene/scene-text-vi';
import { GROUP_VI } from '../../src/editor/groups/group-text-vi';
import { IO_TEXT } from '../../src/io/text-vi';
import { DOCK_TEXT, LAUNCHPAD_TEXT } from '../../src/tutorial/dock-text-vi';
import { TUTORIAL_UI } from '../../src/tutorial/text-vi';
import { TEXT_VI as RENDER_TEXT } from '../../src/render/text-vi';

/** Every string reachable from a text table; functions are called with placeholder arguments. */
function collect(value: unknown, path: string, out: Array<[string, string]>): void {
  if (typeof value === 'string') out.push([path, value]);
  else if (typeof value === 'function') {
    try {
      const r = (value as (...a: unknown[]) => unknown)('x', 'x', 'x');
      collect(r, `${path}()`, out);
    } catch {
      /* not a text builder */
    }
  } else if (Array.isArray(value)) value.forEach((v, i) => collect(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collect(v, `${path}.${k}`, out);
  }
}

/** Strings that may keep the word on purpose. Anything else saying "game" or "chơi" is a regression. */
const ALLOWED_GAME = new Set<string>([
  'IO_TEXT.fallbackFileName', // default download file name when the board name is empty (ascii slug, not a label)
]);

describe('editor chrome wording', () => {
  const tables: Record<string, unknown> = {
    SHELL_TEXT, PRESET_LABELS, TEXT_VI, MODE_HINTS, MODE_LABELS, CONSOLE_TEXT, PIP_TEXT, LIBRARY_TEXT,
    PANELS_TEXT_VI, SCENE_TEXT, GROUP_VI, IO_TEXT, DOCK_TEXT, LAUNCHPAD_TEXT, TUTORIAL_UI, RENDER_TEXT,
  };
  const all: Array<[string, string]> = [];
  for (const [name, table] of Object.entries(tables)) collect(table, name, all);

  it('collects a meaningful number of strings', () => {
    expect(all.length).toBeGreaterThan(200);
  });

  it('never says "game" outside the allow-list', () => {
    const bad = all.filter(([p, s]) => /game/i.test(s) && !ALLOWED_GAME.has(p));
    expect(bad).toEqual([]);
  });

  it('never calls running the board "chơi" (the player role "Người chơi" is a node role, not a button)', () => {
    const bad = all.filter(([, s]) => /(^|[^Nn]gười )?\b[Cc]hơi\b/.test(s.replace(/[Nn]gười chơi/g, '')));
    expect(bad).toEqual([]);
  });

  it('uses the run/simulation labels', () => {
    expect(SHELL_TEXT.play).toBe('Chạy');
    expect(SHELL_TEXT.statePlaying).toBe('Đang chạy');
    expect(SHELL_TEXT.stateEditing).toBe('Đang sửa');
    expect(CONSOLE_TEXT.restart).toBe('Chạy lại');
    expect(TEXT_VI.defaultBoardName).toBe('Mô phỏng của tôi');
    expect(IO_TEXT.newBoardName).toBe('Mô phỏng mới');
    expect(TUTORIAL_UI.menuTitle).toBe('Bài học');
    expect(PANELS_TEXT_VI.gameSettingsTitle).toBe('Cài đặt mô phỏng');
    expect(PIP_TEXT.title).toBe('Xem mô phỏng');
    expect(PIP_TEXT.hintEdit).toBe('Bấm Chạy để thử mô phỏng ngay tại đây.');
  });
});
