import { migrateWireRule } from '../../src/editor/graph/wire-rule-migration';
import type { Graph, ViewMode } from '../../src/engine/types';

/**
 * Boards written before "every action needs its own wire" expect "Bật", "Bắt đầu"... to be on when nothing is
 * wired. Loading such a board wires a "Khi bắt đầu" card into those inputs; this does the same for a graph a test
 * builds by hand, so the test still checks the piece it is about.
 */
export const wireStarts = (graph: Graph, mode: ViewMode): Graph => migrateWireRule(graph, mode);
