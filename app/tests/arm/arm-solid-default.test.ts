import { beforeAll, describe, expect, it } from 'vitest';
import { jointNode } from '../../src/nodes/joint';
import { linkNode } from '../../src/nodes/link';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';

/**
 * "Chắn vật" of links and joints. An open parameter means what it says: "Không" is a drawn-only piece even with "Vật lý thật" on
 * (a pupil can build a phantom arm) and "Có" is solid with it off. The default of a NEW card is "Tự động": solid when the board plays
 * with "Vật lý thật" (a real arm stands in the way), drawn-only without it, so a switch-off board is built and plays as it always did.
 * A board saved before the setting existed keeps passing through things (`legacyDefault` "Không").
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

describe('default of "Chắn vật"', () => {
  for (const def of [linkNode, jointNode]) {
    it(`${def.kind}: a new card is "Tự động", a saved board without the setting is "Không"`, () => {
      const p = def.params.find((q) => q.id === 'solid')!;
      expect(p.default).toBe('auto');
      expect(p.legacyDefault).toBe('no');
      expect(p.options?.map((o) => o.value)).toEqual(['auto', 'no', 'yes']);
    });
  }

  function arm(solid: Record<string, string>, realPhysics: boolean) {
    const nodes: NodeSpec[] = [
      ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 30 } }],
      ['ped', 'block', { position: { x: 0, y: 0.5, z: 0 }, size: { x: 0.4, y: 1, z: 0.4 } }],
      ['go', 'on-start'],
      ['j', 'joint', { axis: 'pitch', start: 0, min: -90, max: 90, maxTorque: 100, mount: { x: 0, y: 1, z: 0 }, ...solid }],
      ['l', 'link', { length: 2, mass: 0, ...solid }],
    ];
    const wires: WireSpec[] = [
      ['ped', 'self', 'j', 'base'],
      ['go', 'started', 'j', 'power'],
      ['j', 'tip', 'l', 'base'],
    ];
    const r = rig(nodes, wires, '3d', false, realPhysics, realPhysics ? rapier : undefined);
    r.tick(5);
    return r;
  }
  // Each piece draws one box of its own; the solid cubes it adds when it is solid come on top of that.
  const bodiesOf = (r: ReturnType<typeof arm>, owner: string) => r.world.entities().filter((e) => e.ownerNodeId === owner).length - 1;
  const solidIn = (r: ReturnType<typeof arm>): boolean => bodiesOf(r, 'l') > 0 && bodiesOf(r, 'j') === 1;
  const drawnOnly = (r: ReturnType<typeof arm>): boolean => bodiesOf(r, 'l') === 0 && bodiesOf(r, 'j') === 0;

  it('"Tự động" is solid with the switch on and drawn-only with it off', () => {
    expect(solidIn(arm({ solid: 'auto' }, true))).toBe(true);
    expect(drawnOnly(arm({ solid: 'auto' }, false))).toBe(true);
  });

  it('"Không" stays drawn-only with the switch on: the pupil\'s explicit choice is kept', () => {
    expect(drawnOnly(arm({ solid: 'no' }, true))).toBe(true);
  });

  it('"Có" is solid with the switch off too (as it always was)', () => {
    expect(solidIn(arm({ solid: 'yes' }, false))).toBe(true);
    expect(solidIn(arm({ solid: 'yes' }, true))).toBe(true);
  });

  it('a card made without the setting (an old board, rig fills the legacy value) is drawn-only', () => {
    expect(drawnOnly(arm({}, true))).toBe(true);
  });
});
