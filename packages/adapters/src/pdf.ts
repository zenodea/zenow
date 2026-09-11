import { extractText, getDocumentProxy, getMeta } from "unpdf";
import { fetchBytes, isPdf, MAX_PDF_BYTES } from "./http.js";
import { AdapterError, type Adapter, type Fetched, type FetchContext } from "./types.js";

/** Less than this from a whole document means it is scanned, not typeset. */
const MIN_TEXT_LENGTH = 200;

const PDF_TIMEOUT_MS = 45_000;

/** `%PDF-` at the top, whatever the server claimed the content type was. */
function looksLikePdf(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d
  );
}

function titleFrom(info: Record<string, unknown>, url: URL): string {
  const title = typeof info.Title === "string" ? info.Title.trim() : "";
  if (title) return title;

  // A file name beats "untitled", once it stops looking like a file name.
  const last = url.pathname.split("/").filter(Boolean).at(-1) ?? url.hostname;
  return decodeURIComponent(last).replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || url.hostname;
}

function dateFrom(value: unknown): string | undefined {
  // PDF dates are D:YYYYMMDDHHmmSS with an optional timezone tail.
  if (typeof value !== "string") return undefined;
  const match = /^D:(\d{4})(\d{2})(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
}

/**
 * Turns a PDF's bytes into text. Layout is discarded -- columns, headers and
 * page furniture all flatten -- which is what the summarizer wants and not
 * what a reader would want, so nothing here pretends to reproduce the page.
 */
export async function extractPdf(bytes: Uint8Array, url: URL): Promise<Fetched> {
  if (!looksLikePdf(bytes)) {
    throw new AdapterError("unsupported", `${url.host} served something that is not a PDF`);
  }

  let text: string;
  let totalPages: number;
  let info: Record<string, unknown>;

  try {
    const document = await getDocumentProxy(bytes);
    const meta = await getMeta(document);
    const extracted = await extractText(document, { mergePages: true });
    info = (meta.info ?? {}) as Record<string, unknown>;
    text = extracted.text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    totalPages = extracted.totalPages;
  } catch (cause) {
    throw new AdapterError("unsupported", `Could not read the PDF at ${url.host}`, { cause });
  }

  if (text.length < MIN_TEXT_LENGTH) {
    throw new AdapterError(
      "no_content",
      "This PDF has no extractable text — it is probably scanned images, which would need OCR.",
    );
  }

  const author = typeof info.Author === "string" ? info.Author.trim() : "";
  const published = dateFrom(info.CreationDate);

  return {
    title: titleFrom(info, url),
    text,
    sourceType: "pdf",
    // A PDF's images are drawn objects, not files with urls; there is nothing
    // to link to, so the summarizer is told there are none.
    images: [],
    meta: {
      pages: totalPages,
      ...(author ? { author } : {}),
      ...(published ? { published_at: published } : {}),
    },
  };
}

export const pdfAdapter: Adapter = {
  name: "pdf",

  match(url) {
    if (/\.pdf$/i.test(url.pathname)) return true;
    // arXiv's pdf urls carry no extension.
    return /(^|\.)arxiv\.org$/i.test(url.hostname) && url.pathname.startsWith("/pdf/");
  },

  async fetch(url: URL, ctx: FetchContext): Promise<Fetched> {
    const fetched = await fetchBytes(url, ctx, {
      accept: "application/pdf,*/*;q=0.8",
      maxBytes: MAX_PDF_BYTES,
      timeoutMs: PDF_TIMEOUT_MS,
    });

    if (!isPdf(fetched.contentType) && !looksLikePdf(fetched.bytes)) {
      throw new AdapterError("unsupported", `${url.host} served ${fetched.contentType || "no content type"}`);
    }

    return extractPdf(fetched.bytes, new URL(fetched.finalUrl));
  },
};
