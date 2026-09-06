import { AdapterError, type FetchContext } from "./types.js";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const DEFAULT_TIMEOUT_MS = 15_000;
export const MAX_BYTES = 5 * 1024 * 1024;

export type HttpOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
  accept?: string;
};

export type FetchedPage = {
  body: string;
  finalUrl: string;
  contentType: string;
};

function charsetOf(contentType: string): string {
  const match = /charset=["']?([\w-]+)/i.exec(contentType);
  return match?.[1]?.toLowerCase() ?? "utf-8";
}

async function readCapped(response: Response, maxBytes: number, url: URL): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer());

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new AdapterError("too_large", `${url.host} sent more than ${maxBytes} bytes`);
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Fetches text with a browser-ish identity, a hard timeout and a size cap. */
export async function fetchPage(url: URL, ctx: FetchContext, options: HttpOptions = {}): Promise<FetchedPage> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  ctx.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await ctx.fetch(url.toString(), {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": BROWSER_UA,
          accept: options.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          ...options.headers,
        },
      });
    } catch (cause) {
      if (controller.signal.aborted) {
        throw new AdapterError("timeout", `${url.host} did not respond in time`, { cause });
      }
      throw new AdapterError("http_error", `Could not reach ${url.host}`, { cause });
    }

    if (response.status === 403 || response.status === 429) {
      throw new AdapterError("blocked", `${url.host} refused the request (${response.status})`, {
        status: response.status,
      });
    }
    if (!response.ok) {
      throw new AdapterError("http_error", `${url.host} returned ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get("content-type") ?? "";
    const bytes = await readCapped(response, options.maxBytes ?? MAX_BYTES, url);

    return {
      body: new TextDecoder(charsetOf(contentType), { fatal: false }).decode(bytes),
      finalUrl: response.url || url.toString(),
      contentType,
    };
  } finally {
    clearTimeout(timer);
    ctx.signal?.removeEventListener("abort", abort);
  }
}

export function expectHtml(page: FetchedPage, url: URL): void {
  const type = page.contentType.split(";")[0]?.trim() ?? "";
  if (type && !/^(text\/html|application\/xhtml\+xml|text\/plain)$/.test(type)) {
    throw new AdapterError("unsupported", `${url.host} served ${type}, which is not readable text`);
  }
}
