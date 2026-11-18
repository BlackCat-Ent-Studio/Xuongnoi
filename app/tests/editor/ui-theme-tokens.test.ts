import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, inkOn, MIN_TEXT_CONTRAST } from '../../src/editor/theme/contrast';
import { GROUP_COLORS } from '../../src/editor/groups/group-model';

/** Reads the design tokens straight from the shipped stylesheet, so the test checks what the page really uses. */
const CSS = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');

function block(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule for ${selector}`);
  return CSS.slice(CSS.indexOf('{', start) + 1, CSS.indexOf('}', start));
}
function tokens(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block(selector).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

const THEMES = { light: tokens(":root[data-theme='light']"), dark: tokens(":root, :root[data-theme='dark']") } as const;
const CATEGORIES = ['input', 'logic', 'math', 'object', 'action', 'brain', 'output'] as const;
const hexOf = (t: Record<string, string>, name: string): string => {
  const v = t[name];
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`--${name} is not a hex colour: ${v}`);
  return v;
};

describe.each(['light', 'dark'] as const)('%s theme tokens', (name) => {
  const t = THEMES[name];

  it.each(CATEGORIES)('card header ink on the %s colour reads (>= 4.5:1) and is the ink the rule picks', (cat) => {
    const bg = hexOf(t, `c-${cat}`);
    const ink = hexOf(t, `ci-${cat}`);
    expect(contrastRatio(ink, bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(ink.toLowerCase()).toBe(inkOn(bg));
  });

  it('body text reads on the panel and on the board (>= 4.5:1)', () => {
    for (const fg of ['text', 'text2', 'text3']) {
      for (const bg of ['panel', 'panel2', 'bg', 'raise']) {
        expect(contrastRatio(hexOf(t, fg), hexOf(t, bg)), `--${fg} on --${bg}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      }
    }
  });

  it('chrome (top bar) text, accent text and the run button read', () => {
    expect(contrastRatio(hexOf(t, 'chrome-text'), hexOf(t, 'chrome'))).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(hexOf(t, 'chrome-text2'), hexOf(t, 'chrome'))).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(hexOf(t, 'chrome-text2'), hexOf(t, 'chrome-inset'))).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(hexOf(t, 'accent'), hexOf(t, 'panel'))).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(hexOf(t, 'run-ink'), hexOf(t, 'run'))).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(hexOf(t, 'accent-ink'), hexOf(t, 'accent'))).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(hexOf(t, 'warn'), hexOf(t, 'warn-bg'))).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(hexOf(t, 'danger'), hexOf(t, 'panel'))).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('non-text edges stand out (>= 3:1): card outline, field border, port shapes', () => {
    expect(contrastRatio(hexOf(t, 'card-line'), hexOf(t, 'bg'))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(hexOf(t, 'line2'), hexOf(t, 'panel'))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(hexOf(t, 'chrome-line2'), hexOf(t, 'chrome'))).toBeGreaterThanOrEqual(3);
    for (const type of ['bool', 'num', 'obj']) {
      // A port is its colour inside an edge: either one standing out from the card is enough to see the shape.
      const fill = contrastRatio(hexOf(t, `t-${type}`), hexOf(t, 'card-bg'));
      const edge = contrastRatio(hexOf(t, `t-${type}-edge`), hexOf(t, 'card-bg'));
      expect(Math.max(fill, edge), `port type ${type}`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(hexOf(t, `t-${type}-edge`), hexOf(t, 'bg')), `wire casing ${type}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the three port colours apart', () => {
    const colours = ['t-bool', 't-num', 't-obj'].map((n) => hexOf(t, n));
    expect(new Set(colours).size).toBe(3);
  });
});

describe('group card header ink', () => {
  it.each(GROUP_COLORS)('the ink picked for the group colour %s reads on it (>= 4.5:1)', (colour) => {
    expect(contrastRatio(inkOn(colour), colour)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
  it('an unreadable colour value falls back to the dark ink instead of throwing', () => {
    expect(inkOn('red')).toBe('#10151b');
  });
});

describe('display mode sizes', () => {
  const student = tokens(":root, :root[data-mode='student']");
  const teacher = tokens(":root[data-mode='teacher']");
  const px = (v: string | undefined): number => Number.parseFloat(v ?? 'NaN');

  it('match the agreed numbers', () => {
    expect([px(student.fs), px(student['fs-s']), px(student.row), px(student.hh), px(student.ctl)]).toEqual([15, 13, 34, 50, 36]);
    expect([px(teacher.fs), px(teacher['fs-s']), px(teacher.row), px(teacher.hh), px(teacher.ctl)]).toEqual([13, 12, 24, 34, 28]);
  });

  it('never go under the text and hit-area floors', () => {
    expect(px(student['fs-s'])).toBeGreaterThanOrEqual(12);
    expect(px(teacher['fs-s'])).toBeGreaterThanOrEqual(12);
    expect(px(student.ctl)).toBeGreaterThanOrEqual(28);
    expect(px(teacher.ctl)).toBeGreaterThanOrEqual(24);
    expect(px(student.row)).toBeGreaterThanOrEqual(28);
    expect(px(teacher.row)).toBeGreaterThanOrEqual(24);
  });

  it('a coarse pointer raises the controls and port rows to 44 px in both modes', () => {
    const coarse = CSS.slice(CSS.indexOf('@media (pointer: coarse)'));
    expect(coarse).toMatch(/--row:\s*44px/);
    expect(coarse).toMatch(/--ctl:\s*44px/);
    expect(coarse).toContain(":root[data-mode='teacher']");
  });
});

describe('light theme "Xám dịu": no pure-white large surfaces', () => {
  const t = THEMES.light;
  it.each(['bg', 'panel', 'panel2', 'raise', 'card-bg', 'card-head', 'card-adv'])('--%s is a soft grey, not #ffffff', (name) => {
    expect(hexOf(t, name).toLowerCase()).not.toBe('#ffffff');
  });
  it('uses the agreed soft surfaces', () => {
    expect([t.bg, t.panel, t.panel2, t.raise, t.line, t['card-bg']]).toEqual(['#dfe3e8', '#eceff3', '#e3e7ec', '#d8dde4', '#cbd2da', '#f1f3f6']);
  });
  it('the yellow Đúng/Sai wire reads on the soft board through its casing (>= 3:1)', () => {
    expect(contrastRatio(hexOf(t, 't-bool-edge'), hexOf(t, 'bg'))).toBeGreaterThanOrEqual(3);
  });
});
