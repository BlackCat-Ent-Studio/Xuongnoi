// Measuring spike only: the few Node things the spike tests use (the project has no Node type package).
declare module 'node:fs' {
  export function appendFileSync(path: string, data: string): void;
}
declare module 'node:os' {
  const os: { cpus(): unknown[]; freemem(): number };
  export default os;
}
declare const process: { env: Record<string, string | undefined> };
