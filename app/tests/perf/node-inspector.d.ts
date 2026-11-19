// The project carries no Node type definitions; this declares the few calls the cost measurement needs.
declare module 'node:inspector' {
  export class Session {
    connect(): void;
    disconnect(): void;
    post(method: string, params: object | undefined, callback: (err: Error | null, result: unknown) => void): void;
  }
}
