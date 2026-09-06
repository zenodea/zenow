import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { expectHtml, fetchPage } from "./http.js";
import { absoluteUrl, imagesFromElement, indexImages, isLikelyContentImage, type RawImage } from "./images.js";
import { AdapterError, type Adapter, type Fetched } from "./types.js";

/** Below this, Readability almost certainly lost to a client-rendered page. */
const MIN_TEXT_LENGTH = 300;

const HEAD_TAGS = new Set(["META", "TITLE", "LINK", "STYLE", "BASE"]);

/**
 * linkedom does not apply HTML5 implied-tag rules. A page that omits <head>
 * and <body> (danluu.com, plenty of hand-written html) parses with all of its
 * content as direct children of <html> and an empty body, which Readability
 * either ignores or trips over. Put the nodes where they would have gone in a
 * browser.
 */
function reparentStrayNodes(document: Document): void {
  const html = document.documentElement;
  const { head, body } = document;
  if (!html || !head || !body) return;

  for (const node of [...html.childNodes]) {
    if (node === head || node === body) continue;
    const tag = (node as Element).tagName;
    (tag && HEAD_TAGS.has(tag) ? head : body).appendChild(node);
  }
}

function metaContent(document: Document, names: string[]): string | undefined {
  for (const name of names) {
    const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    const content = el?.getAttribute("content")?.trim();
    if (content) return content;
  }
  return undefined;
}

function collapseWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compact(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== null));
}

/** Split out from the adapter so tests can run it against saved html. */
export function extractArticle(html: string, base: URL): Fetched {
  const { document } = parseHTML(html) as unknown as { document: Document };
  reparentStrayNodes(document);

  const baseHref = document.querySelector("base[href]")?.getAttribute("href");
  const resolveBase = baseHref ? new URL(baseHref, base) : base;

  // Readability mutates the document, so everything else comes out first.
  const documentTitle = document.title?.trim();
  const meta = compact({
    author: metaContent(document, ["author", "article:author", "og:article:author"]),
    published_at: metaContent(document, ["article:published_time", "og:published_time", "date"]),
    site_name: metaContent(document, ["og:site_name"]),
    description: metaContent(document, ["og:description", "description"]),
    canonical: absoluteUrl(document.querySelector("link[rel=canonical]")?.getAttribute("href"), resolveBase),
    url: base.toString(),
  });
  const ogTitle = metaContent(document, ["og:title", "twitter:title"]);
  const ogImage = absoluteUrl(metaContent(document, ["og:image", "og:image:url", "twitter:image"]), resolveBase);

  let article: ReturnType<Readability["parse"]>;
  try {
    article = new Readability(document, { charThreshold: MIN_TEXT_LENGTH }).parse();
  } catch (cause) {
    throw new AdapterError("no_content", `Readability could not parse ${base.host}`, { cause });
  }

  const text = collapseWhitespace(article?.textContent ?? "");
  if (text.length < MIN_TEXT_LENGTH) {
    throw new AdapterError(
      "needs_browser",
      `Only ${text.length} characters of readable text on ${base.host}; the page probably renders client-side`,
    );
  }

  const contentHtml = article?.content ?? "";
  const bodyImages: RawImage[] = contentHtml
    ? imagesFromElement(parseHTML(`<div>${contentHtml}</div>`).document as unknown as ParentNode, resolveBase)
    : [];
  const lead: RawImage[] = ogImage && isLikelyContentImage(ogImage) ? [{ url: ogImage }] : [];

  return {
    title: (article?.title || ogTitle || documentTitle || base.hostname).trim(),
    text,
    ...(contentHtml ? { html: contentHtml } : {}),
    images: indexImages([...lead, ...bodyImages]),
    meta: compact({
      ...meta,
      byline: article?.byline,
      excerpt: article?.excerpt,
      site_name: article?.siteName ?? meta.site_name,
    }),
  };
}

export const articleAdapter: Adapter = {
  name: "article",
  match: () => true,
  async fetch(url, ctx) {
    const page = await fetchPage(url, ctx);
    expectHtml(page, url);
    return extractArticle(page.body, new URL(page.finalUrl));
  },
};
