// The project carries no Node type definitions; this declares the few calls the measurement spikes need.
declare module 'node:fs' {
  export function writeFileSync(path: URL, data: string): void;
  export function appendFileSync(path: URL, data: string): void;
}
declare module 'node:child_process' {
  export function execSync(command: string, options: { encoding: 'utf8' }): string;
}
declare module 'node:os' {
  export function cpus(): { model: string }[];
}
declare module 'node:inspector' {
  export class Session {
    connect(): void;
    disconnect(): void;
    post(method: string, params: object | undefined, callback: (err: Error | null, result: unknown) => void): void;
  }
}
declare const process: { version: string };
