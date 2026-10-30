// The project carries no Node type definitions; this declares the few calls the tests need.
declare module 'node:fs' {
  export function readFileSync(path: URL, encoding: 'utf8'): string;
  export function readdirSync(path: URL): string[];
}
