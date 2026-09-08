import sanitizeHtml from "sanitize-html";

/**
 * Sanitised on the server; the stored html came from a third-party page.
 *
 * Not DOMPurify: it needs a DOM, and isomorphic-dompurify supplies one with
 * jsdom, whose dependency chain fails to load under Vercel's bundler
 * (ERR_REQUIRE_ESM). Because that blew up at import time it took out every
 * item page, not only pages with html to show. sanitize-html parses rather
 * than building a DOM, so there is nothing to fail.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "blockquote", "pre", "code", "em", "strong", "b", "i", "u", "s",
    "ul", "ol", "li", "dl", "dt", "dd",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "a", "img", "figure", "figcaption", "picture", "source",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
    "span", "div", "sup", "sub", "abbr", "cite", "q", "time", "mark",
  ],
  allowedAttributes: {
    a: ["href", "title"],
    img: ["src", "srcset", "alt", "title", "width", "height", "loading"],
    source: ["srcset", "type", "media"],
    "*": ["id"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // Anything left pointing outward is untrusted, so it opens safely.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noreferrer noopener nofollow", target: "_blank" }),
    img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
  },
};

export function OriginalContent({ html, text }: { html: string | null; text: string }) {
  const clean = html ? sanitizeHtml(html, OPTIONS) : null;

  return (
    <details className="mt-14 border-t border-line pt-6">
      <summary className="cursor-pointer text-xs tracking-[0.12em] text-muted uppercase select-none hover:text-ink">
        Original content
      </summary>
      <div className="prose-reader mt-6">
        {clean ? <div dangerouslySetInnerHTML={{ __html: clean }} /> : <p className="whitespace-pre-wrap">{text}</p>}
      </div>
    </details>
  );
}
