declare const process: { env: Record<string, string | undefined> };

declare class AbortController {
  signal: unknown;
  abort(): void;
}

declare function setTimeout(handler: (...args: unknown[]) => void, timeout?: number): unknown;
declare function clearTimeout(timeoutId: unknown): void;

declare function fetch(
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: unknown;
  },
): Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
}>;

declare const console: {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

declare module 'express' {
  export type Request = any;
  export type Response = any;
  export type NextFunction = any;
  export interface Router {
    get: (...args: any[]) => Router;
    post: (...args: any[]) => Router;
    use: (...args: any[]) => Router;
  }
  export function Router(): Router;
}

declare module 'express-validator' {
  export const body: any;
  export const param: any;
  export const query: any;
  export function validationResult(req: any): { isEmpty(): boolean; array(): any[] };
}
