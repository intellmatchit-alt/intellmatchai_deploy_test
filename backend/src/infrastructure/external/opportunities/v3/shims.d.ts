declare const process: { env: Record<string, string | undefined> };
declare class AbortController {
  signal: unknown;
  abort(): void;
}
declare function setTimeout(
  handler: (...args: unknown[]) => void,
  timeout?: number,
): unknown;
declare function clearTimeout(timeoutId: unknown): void;
declare function fetch(
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: unknown;
  },
): Promise<{ ok: boolean; status: number; json(): Promise<any> }>;
declare const console: {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
