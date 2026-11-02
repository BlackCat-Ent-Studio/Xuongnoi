import { describe, expect, it } from 'vitest';
import { handbookEntry } from '../../src/handbook';
import { SOLID_BODIES_PAGE, SOLID_BODIES_TOPIC } from '../../src/handbook/topic-solid-bodies';
import { puzzleWorldOptions } from '../../src/puzzle/world-options';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';

describe('handbook topic "Va chạm thật"', () => {
  it('has plain, non-empty text and a stable id', () => {
    expect(SOLID_BODIES_TOPIC).toBe(SOLID_BODIES_PAGE.id);
    expect(SOLID_BODIES_PAGE.intro.trim()).not.toBe('');
    expect(SOLID_BODIES_PAGE.blocks.length).toBeGreaterThanOrEqual(3);
    for (const b of SOLID_BODIES_PAGE.blocks) {
      expect(b.heading.trim()).not.toBe('');
      expect(b.items.length).toBeGreaterThan(0);
      for (const i of b.items) expect(i.trim()).not.toBe('');
    }
  });

  it('the carry page points to it', () => {
    const carry = handbookEntry('carry')!;
    expect([...carry.tips, ...Object.values(carry.params)].join(' ')).toContain('Va chạm thật');
  });
});

describe('who gets which world rules', () => {
  it('the puzzle keeps its own options, with the fall respawn and the 1.6x collision box', () => {
    const o = puzzleWorldOptions('3d')!;
    expect(o).toMatchObject({ solidBodies: true, respawnFallen: true });
    expect(o.characterBox?.size.y).toBeCloseTo(1.6);
    // The side-view puzzle levels play with the same solid bodies: nobody walks through anybody.
    expect(puzzleWorldOptions('2d-side')).toEqual(o);
  });

  it('the editor gets only the solid-body rules: no scaled box, no respawn, no puzzle hold point', () => {
    const o = worldOptionsForGraph({ nodes: [], wires: [], settings: { solidBodies: true } })!;
    expect(o).toEqual({ solidBodies: true, frontCarryAll: true });
  });
});
