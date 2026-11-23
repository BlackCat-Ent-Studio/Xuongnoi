# Brainstorm: "Kho game của tôi", a library of many games inside Xưởng Nối

Date: 2026-10-29 22:50. Status: user approved. They said "no thumbnails, the name is enough"; the other answers take the ⭐ defaults (1a 2a 3a 4a).

## Problem
The app keeps exactly one game:
- autosave uses `xuong-noi:autosave` in localStorage, via `io/autosave.ts`;
- "Tạo game mới" and "Mở game mẫu" replace the current game;
- keeping a game means exporting a file by hand.

The user wants a place inside the app that stores many games. Opening one restores both Màn chơi and Bảng nối (the "recipe").

## Decisions
| # | Decision |
|---|---|
| No thumbnails | Each entry shows its name and its last-modified date only |
| 1a | Reached from the Tệp menu ("Kho game của tôi…"), plus a "Game của tôi" card on the launchpad/welcome next to Học từ đầu and Mở game mẫu |
| 2a | Automatic. The current game is always an entry and stays updated through the existing autosave. New game, sample, lesson or file open never loses the old game, because it stays in the library |
| 3a | Opening an entry loads it as the editable current game |
| 4a | One agent in a worktree, plus a real browser check |

## Design notes
- Storage goes in localStorage under new keys:
  - an index key (list of {id, name, updatedAt});
  - one key per game holding the serialized board, in the existing save format.
  - IndexedDB is not needed at this size. Handle quota errors with a clear Vietnamese message.
- The current game id is remembered. Autosave writes both the old key and the library entry, so old autosave keeps working. On first run, migrate the existing autosave into the library as one entry.
- Lessons must NOT create library entries. The tutorial already stashes the learner's board, so keep that flow intact.
- The library dialog shows a list of entries, each with Mở, Đổi tên, Nhân đôi and Xóa. Xóa needs a confirm inside the dialog, not `window.confirm`. Entries are sorted by last modified, and the current game is marked.
- "Xuất ra file" stays for backup. Add a note that the library lives in this browser only.

## Acceptance
- Unit tests (node env; mock storage like the autosave tests do) cover:
  - create, update, rename, duplicate, delete, list order;
  - migration from the old autosave;
  - quota error handling;
  - lesson boards not stored.
- Browser check:
  - make game A, then "Tạo game mới", then make game B, then open a sample;
  - reload the page, open the library, and see A and B (and the sample, if the user edited it);
  - opening A shows its board and it plays.
- The 3 gates are green.

## Out of scope
Thumbnails, cloud sync, folders, search.
