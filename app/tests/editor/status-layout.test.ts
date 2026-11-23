import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');

function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`no CSS rule for ${selector}`);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

/**
 * The top-bar status note used to sit in the bar's flex row. When it appeared (or expired after 4 s) the bar
 * wrapped to a second line and the whole canvas jumped by one row, so a wire drag that started just before the
 * jump pressed on empty canvas and panned instead of connecting. It must stay out of the bar's layout.
 */
describe('top-bar status note layout', () => {
  it('floats over the page instead of taking part in the bar layout', () => {
    const status = rule('.status');
    expect(status).toMatch(/position:\s*absolute/);
    expect(status).toMatch(/pointer-events:\s*none/);
    expect(rule('.topbar')).toMatch(/position:\s*relative/);
  });

  it('takes no room while empty', () => {
    expect(rule('.status:empty')).toMatch(/display:\s*none/);
  });
});
