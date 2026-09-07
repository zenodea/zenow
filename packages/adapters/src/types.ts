import type { ImageRef, SourceType } from "@reader/shared";

export type Fetched = {
  title: string;
  /** What the summarizer reads. */
  text: string;
  /** Cleaned markup for "show original", when the source has any. */
  html?: string;
  images: ImageRef[];
  meta: Record<string, unknown>;
};

export type Logger = {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
};

export type FetchContext = {
  fetch: typeof fetch;
  log: Logger;
  signal?: AbortSignal;
  /** Optional; without it the reddit adapter falls back to the public json. */
  reddit?: { clientId: string; clientSecret: string };
};

export interface Adapter {
  readonly name: SourceType;
  match(url: URL): boolean;
  fetch(url: URL, ctx: FetchContext): Promise<Fetched>;
}

export type AdapterErrorCode =
  | "http_error"
  | "blocked"
  | "timeout"
  | "too_large"
  | "unsupported"
  | "needs_browser"
  | "no_content";

/** Carries enough for the worker to choose between backing off and giving up. */
export class AdapterError extends Error {
  readonly code: AdapterErrorCode;
  readonly status: number | undefined;

  constructor(code: AdapterErrorCode, message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "AdapterError";
    this.code = code;
    this.status = options.status;
  }

  get retryable(): boolean {
    if (this.code === "timeout" || this.code === "blocked") return true;
    if (this.code === "http_error") return (this.status ?? 0) >= 500;
    return false;
  }
}
