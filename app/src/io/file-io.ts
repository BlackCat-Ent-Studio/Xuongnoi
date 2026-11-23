import type { Board } from '../engine/types';
import { parseBoard, serializeBoard } from './save-format';
import { IO_TEXT } from './text-vi';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Strips characters that are illegal in Windows/macOS file names. */
export function safeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().replace(/[. ]+$/, '');
  return cleaned || IO_TEXT.fallbackFileName;
}

export function downloadBoard(board: Board): void {
  const blob = new Blob([serializeBoard(board)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(board.name)}.xuongnoi.json`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickBoardFile(): Promise<Board | null> {
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
          const res = parseBoard(text);
          done(() => (res.ok ? resolve(res.board) : reject(new Error(res.error))));
        },
        () => done(() => reject(new Error(IO_TEXT.readFailed))),
      );
    });

    document.body.appendChild(input);
    input.click();
  });
}
