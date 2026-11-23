// The project carries no Node type definitions; this declares the one call the style test needs.
declare module 'node:fs' {
  export function readFileSync(path: URL, encoding: 'utf8'): string;
}
