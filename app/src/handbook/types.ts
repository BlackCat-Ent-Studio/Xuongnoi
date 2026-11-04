import type { Board } from '../engine/types';

/**
 * Hand-written handbook page for one node kind. Port and param names, types and defaults are read from
 * the node definition at render time; this only carries the explanations a beginner needs.
 */
export interface HandbookEntry {
  /** Node kind this page explains (NodeDef.kind). */
  kind: string;
  /** "Dùng để": one or two plain sentences. */
  purpose: string;
  /** "Khi nào dùng": typical situations in games. */
  whenToUse: string;
  /** Explanation per input/output port id (NodeDef.inputs / outputs). */
  ports: Record<string, string>;
  /** Explanation per param id (NodeDef.params), advanced ones included. */
  params: Record<string, string>;
  /** A short wiring example in words, e.g. Phím bấm "Đang giữ phím" → "Nhảy" của Nhân vật. */
  example: string;
  /** Tips and common mistakes. */
  tips: string[];
  /** Course lesson id that teaches this node (see tutorial/course.ts). */
  lessonId: string;
  /** "Thử ngay": a small ready-wired board showing the node working; called each time it opens. */
  tryBoard: () => Board;
  /** More "Thử" boards for the advanced options (one extra button each); the main `tryBoard` stays as it is. */
  extraTries?: readonly { label: string; board: () => Board }[];
}
