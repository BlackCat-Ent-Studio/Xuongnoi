import type { Board } from '../engine/types';
import { parseCircuitFile, serializeCircuitFile, type CircuitFile } from './circuit-file';
import { parseBoard, serializeBoard } from './save-format';
import { IO_TEXT } from './text-vi';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Strips characters that are illegal in Windows/macOS file names. */
export function safeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().replace(/[. ]+$/, '');
  return cleaned || IO_TEXT.fallbackFileName;
}

function downloadText(text: string, fileName: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBoard(board: Board): void {
  downloadText(serializeBoard(board), `${safeFileName(board.name)}.xuongnoi.json`);
}

/** Saves one circuit of the board (with the circuits it contains) as `<tên>.bangmach.json`. False for an unknown circuit. */
export function downloadCircuit(board: Board, circuitId: string): boolean {
  const text = serializeCircuitFile(board, circuitId);
  const name = board.circuits?.find((c) => c.id === circuitId)?.name ?? '';
  if (text === null) return false;
  const cleaned = safeFileName(name);
  downloadText(text, `${name.trim() === '' || cleaned === IO_TEXT.fallbackFileName ? IO_TEXT.circuitFileName : cleaned}.bangmach.json`);
  return true;
}

export function pickBoardFile(): Promise<Board | null> {
  return pickJsonFile((text) => {
    const res = parseBoard(text);
    if (!res.ok) throw new Error(res.error);
    return res.board;
  });
}

/** Opens a file picker for a circuit file; resolves null if cancelled, rejects with a Vietnamese message on a bad file. */
export function pickCircuitFile(): Promise<CircuitFile | null> {
  return pickJsonFile((text) => {
    const res = parseCircuitFile(text);
    if (!res.ok) throw new Error(res.error);
    return res.file;
  });
}

function pickJsonFile<T>(read: (text: string) => T): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';

    const done = (fn: () => void): void => {
      input.remove();
      fn();
    };
    input.addEventListener('cancel', () => done(() => resolve(null)));
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return done(() => resolve(null));
      if (file.size > MAX_FILE_BYTES) return done(() => reject(new Error(IO_TEXT.fileTooBig)));
      file.text().then(
        (text) => {
          try {
            const value = read(text);
            done(() => resolve(value));
          } catch (e) {
            done(() => reject(e instanceof Error ? e : new Error(IO_TEXT.readFailed)));
          }
        },
        () => done(() => reject(new Error(IO_TEXT.readFailed))),
      );
    });

    document.body.appendChild(input);
    input.click();
  });
}
