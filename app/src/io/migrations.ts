import { IO_TEXT } from './text-vi';

export const CURRENT_FORMAT_VERSION = 1;

type RawBoard = Record<string, unknown>;

/** `migrations[n]` upgrades a version-n file to version n+1. Empty while v1 is the only format. */
export const migrations: Record<number, (data: RawBoard) => RawBoard> = {};

export type MigrateResult = { ok: true; data: RawBoard } | { ok: false; error: string };

/** Brings a raw parsed file up to CURRENT_FORMAT_VERSION, or explains why it can't. */
export function migrateToCurrent(raw: RawBoard): MigrateResult {
  let version = raw.format_version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: IO_TEXT.badVersion };
  }
  if (version > CURRENT_FORMAT_VERSION) {
    return { ok: false, error: IO_TEXT.newerVersion(version, CURRENT_FORMAT_VERSION) };
  }
  let data = raw;
  while (version < CURRENT_FORMAT_VERSION) {
    const step = migrations[version];
    if (!step) return { ok: false, error: IO_TEXT.noMigration(version) };
    data = { ...step(data), format_version: version + 1 };
    version++;
  }
  return { ok: true, data };
}
