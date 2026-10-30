import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { listNodeDefs } from '../../src/engine/registry';
import { registerAllNodes } from '../../src/nodes';
import { COURSE } from '../../src/tutorial/course';
import { LESSONS } from '../../src/tutorial/lessons';

const TUTORIAL_DIR = new URL('../../src/tutorial/', import.meta.url);

describe('course coverage', () => {
  it('teaches every node kind in at least one lesson', () => {
    registerAllNodes();
    const sources = readdirSync(TUTORIAL_DIR)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => readFileSync(new URL(f, TUTORIAL_DIR), 'utf8'))
      .join('\n');
    const missing = listNodeDefs()
      .map((d) => d.kind)
      .filter((kind) => !sources.includes(`'${kind}'`) && !sources.includes(`"${kind}"`));
    expect(missing).toEqual([]);
  });

  it('places every registered lesson in a chapter and every chapter lesson is registered', () => {
    const listed = COURSE.flatMap((c) => c.lessonIds);
    expect(LESSONS.map((l) => l.id).sort()).toEqual([...listed].sort());
  });
});
